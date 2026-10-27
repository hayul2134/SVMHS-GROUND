// SVMHS GROUND — '반납 5분 전!' (기자재실 정리 = 테트리스 방식 블록 쌓기, 2026-10-27 하율)
// 블록 7종을 촬영 장비로: I 붐 마이크 · O 카메라 · T 삼각대 · L 감독 의자 · J 카메라 슬라이더 · S 케이블 · Z 슬레이트.
// 한 블록 = 장비 하나의 그림(칸마다 따로 그리지 않음) → 쌓인 뒤에도 그림 조각이 그대로 남고, 줄이 지워지면 장비가 잘려 나감.
//   방법: 장비마다 기본 방향 그림을 N×N 상자 크기로 한 번 그리고 90°씩 돌린 4장을 미리 만든다(SRS 회전 = N×N 상자 회전과 같음).
//   쌓인 칸은 {장비, 방향, 상자 안 위치}를 기억해 그 그림의 해당 칸만 잘라서 그린다.
// 규칙: 10×20(+위 숨은 2줄) · 7개 묶음 무작위(7-bag) · SRS 회전·벽 차기 · 보관(hold) · 다음 3개 · 고스트 · 잠금 지연 0.5초(움직이면 최대 15번 연장)
// 점수는 gear-score.js(서버와 공용). 고정 타임스텝 1/60초. 논리 해상도: 한 칸 12px → 판 120×240, CSS로 정수 배 확대(또렷한 픽셀).
import { LINE_PTS, levelOf, SOFT_PT, HARD_PT } from './gear-score.js';

export const C = 12, COLS = 10, ROWS = 22, HID = 2, VIS = ROWS - HID;
export const BW = COLS * C, BH = VIS * C;
const STEP = 1 / 60, DAS = 10, ARR = 2, LOCK = 30, LOCK_MAX = 15, CLEAR_T = 16;   // 프레임 단위(60fps)
const OL = '#2a2846';

/* ===== 장비 7종 (SRS 기본 방향 칸, 상자 크기 N) ===== */
export const KIND = {
  I: { n: '붐 마이크', N: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], body: '#c3cbe0' },
  O: { n: '카메라', N: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], body: '#4a5170' },
  T: { n: '삼각대', N: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], body: '#ff8f5a' },
  L: { n: '감독 의자', N: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], body: '#f3dca8' },   // 2026-10-27 하율: LED 조명 → 확성기 → 감독 의자
  J: { n: '카메라 슬라이더', N: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], body: '#5b8cff' },
  S: { n: '케이블', N: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], body: '#ff8a3d' },
  Z: { n: '슬레이트', N: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], body: '#2e2f45' },
};
export const ORDER = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
const rotCell = ([x, y], N, r) => { for (let i = 0; i < r; i++) [x, y] = [N - 1 - y, x]; return [x, y]; };
const cellsOf = (k, r) => KIND[k].cells.map(c => rotCell(c, KIND[k].N, k === 'O' ? 0 : r));

// SRS 벽 차기 (y는 아래가 +). 키: '시작>끝'
const K3 = { '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]] };
const K4 = { '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]] };

/* ===== 그림 (픽셀) ===== */
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); };
function disc(g, cx, cy, r, col) { g.fillStyle = col; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) g.fillRect(cx + x, cy + y, 1, 1); }
function box(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
// 장비 몸통: 칸들을 한 덩어리로 — 테두리 선 없이 꽉 채움(아래 body 설명), 붙은 칸끼리는 이어짐,
// 바깥 모서리는 둥글게, 안쪽으로 꺾인 모서리도 선을 이어 줌, 위·왼쪽 밝게·아래·오른쪽 어둡게
const RIM = '#f7f9ff';
const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function body(g, cells, col) {
  // 2026-10-27 하율 "닿고 나서 채워지는 게 이상함 → 처음부터 딱 맞게": 테두리 선 없이 칸을 끝까지 꽉 채움.
  //   장비끼리 구분은 바깥 면 1px 밝은 선(위·왼쪽)·어두운 선(아래·오른쪽)으로만 → 붙여 쌓아도 틈이 안 생김
  const has = (x, y) => cells.some(c => c[0] === x && c[1] === y);
  col = mix(col, '#ffffff', .14);
  const hi = mix(col, '#ffffff', .55), lo = shade(col, .62);
  for (const [cx, cy] of cells) {
    const x = cx * C, y = cy * C, L = !has(cx - 1, cy), R = !has(cx + 1, cy), T = !has(cx, cy - 1), B = !has(cx, cy + 1);
    box(g, x, y, C, C, col);
    if (T) box(g, x, y, C, 1, hi); if (L) box(g, x, y, 1, C, hi);
    if (B) box(g, x, y + C - 1, C, 1, lo); if (R) box(g, x + C - 1, y, 1, C, lo);
    if (T && R) box(g, x + C - 1, y, 1, 1, col); if (B && L) box(g, x, y + C - 1, 1, 1, col);   // 밝은 선·어두운 선이 만나는 모서리는 중간색
    // 안쪽으로 꺾인 모서리: 대각선 칸이 비었으면 그 점을 밝게/어둡게 이어 줌
    if (!L && !T && !has(cx - 1, cy - 1)) box(g, x, y, 1, 1, hi);
    if (!R && !B && !has(cx + 1, cy + 1)) box(g, x + C - 1, y + C - 1, 1, 1, lo);
  }
}
const ART = {
  I(g) {   // 붐 마이크: 왼쪽 손잡이 → 은색 붐대(마디) → 오른쪽 털 윈드실드
    const y = C;
    box(g, 2, y + 3, 9, 6, '#2f3247'); for (let i = 3; i < 11; i += 2) box(g, i, y + 3, 1, 6, '#474b66');   // 고무 손잡이
    box(g, 11, y + 5, 25, 2, '#8d97b4'); box(g, 11, y + 4, 25, 1, '#e6ebf7');   // 붐대
    box(g, 20, y + 3, 2, 6, '#5b6585'); box(g, 29, y + 3, 2, 6, '#5b6585');   // 마디
    box(g, 34, y + 2, 12, 8, '#7d8597');   // 털(데드캣)
    g.fillStyle = '#a6adbd'; for (const [a, b] of [[35, 3], [38, 2], [41, 3], [44, 4], [36, 6], [40, 6], [43, 7], [37, 8], [42, 9], [45, 6]]) g.fillRect(a, y + b, 1, 1);
    g.fillStyle = '#5f6677'; for (const [a, b] of [[36, 4], [39, 5], [42, 4], [45, 8], [38, 9], [41, 7]]) g.fillRect(a, y + b, 1, 1);
    box(g, 34, y + 2, 1, 8, '#626a7d');
  },
  O(g) {   // 카메라: 뷰파인더 · 셔터 · 녹화 불 · 큰 렌즈
    box(g, 3, 2, 7, 3, '#6a7396'); box(g, 4, 2, 5, 1, '#8e97bb');   // 뷰파인더
    box(g, 15, 2, 4, 2, '#2a2f44');   // 셔터 버튼
    box(g, 19, 4, 2, 2, '#ff5a5a'); box(g, 19, 4, 1, 1, '#ffb1b1');   // 녹화 불
    disc(g, 12, 14, 8, OL); disc(g, 12, 14, 7, '#e8ecf7'); disc(g, 12, 14, 5, '#2a4a8a'); disc(g, 12, 14, 3, '#5ab8ff'); disc(g, 12, 14, 1, '#1b2c5c');
    box(g, 9, 11, 2, 2, '#ffffff'); box(g, 14, 17, 1, 1, '#bfe6ff');   // 유리 반사
  },
  T(g) {   // 삼각대: 위 칸 = 카메라 판·핸들, 아래 줄 = 가운데 기둥 + 벌어진 다리 + 다리 잠금
    box(g, 14, 3, 8, 3, '#3a3f55'); box(g, 15, 3, 6, 1, '#6a7396');   // 카메라 판
    box(g, 22, 5, 1, 1, '#3a3f55'); box(g, 23, 6, 1, 1, '#3a3f55'); box(g, 24, 7, 1, 1, '#3a3f55');   // 팬 핸들
    disc(g, 18, 9, 2, '#ffd25e');   // 헤드
    box(g, 17, 11, 2, 7, '#3a3f55');   // 기둥
    for (let i = 0; i < 9; i++) { box(g, 16 - i - 1, 15 + Math.floor(i * .9), 2, 1, '#3a3f55'); box(g, 19 + i, 15 + Math.floor(i * .9), 2, 1, '#3a3f55'); }   // 다리
    box(g, 9, 19, 2, 2, '#ffd25e'); box(g, 25, 19, 2, 2, '#ffd25e');   // 다리 잠금
    box(g, 5, 21, 3, 1, '#2a2846'); box(g, 28, 21, 3, 1, '#2a2846');   // 발
  },
  L(g) {   // 감독 의자: 오른쪽 위 = 빨간 천 등받이(흰 글씨 띠), 아래 줄 = 앉는 천 + 나무 X자 다리
    const W = '#8a5a32', w = '#b07a45';
    box(g, 25, 2, 2, 20, W); box(g, 33, 2, 2, 20, W);   // 등받이 기둥
    box(g, 27, 3, 6, 7, '#d63a52'); box(g, 27, 3, 6, 1, '#ff8a9a'); box(g, 28, 6, 4, 1, '#f7f9ff'); box(g, 28, 8, 3, 1, '#f7f9ff');   // 등받이 천 + 글씨
    box(g, 2, 13, 33, 2, W); box(g, 3, 15, 30, 3, '#d63a52'); box(g, 3, 15, 30, 1, '#ff8a9a');   // 팔걸이 막대 + 앉는 천
    for (let i = 0; i < 6; i++) { box(g, 6 + i * 2, 18 + i, 2, 1, w); box(g, 16 - i * 2, 18 + i, 2, 1, w); box(g, 21 + i * 2, 18 + i, 2, 1, w); box(g, 31 - i * 2, 18 + i, 2, 1, w); }   // X자 다리 두 쌍
    box(g, 4, 23, 31, 1, W);   // 바닥 가로대
  },
  J(g) {   // 카메라 슬라이더: 왼쪽 위 = 받침 위 작은 카메라(렌즈 오른쪽), 아래 줄 = 은색 레일 두 줄 + 양 끝 받침
    box(g, 2, 3, 8, 6, '#2f3247'); box(g, 3, 4, 3, 1, '#474b66'); box(g, 8, 2, 2, 1, '#ff5a6e');   // 카메라 몸통·빨간 녹화 불
    box(g, 9, 4, 3, 4, '#1d2238'); box(g, 10, 5, 1, 2, '#8fe8ff');   // 렌즈
    box(g, 5, 9, 2, 3, '#474b66');   // 볼 헤드
    box(g, 2, 12, 10, 3, '#2f3247'); box(g, 3, 13, 8, 1, '#5b6585');   // 움직이는 받침(캐리지)
    box(g, 2, 16, 32, 2, '#e6ebf7'); box(g, 2, 19, 32, 2, '#c3cbe0'); box(g, 2, 18, 32, 1, '#8d97b4');   // 레일 두 줄
    box(g, 1, 15, 3, 7, '#2f3247'); box(g, 32, 15, 3, 7, '#2f3247');   // 양 끝 받침
    box(g, 2, 22, 1, 2, '#2f3247'); box(g, 33, 22, 1, 2, '#2f3247'); box(g, 17, 21, 2, 3, '#2f3247');   // 다리
  },
  S(g) {   // 케이블: 사선 줄무늬(감긴 선) + 양 끝 XLR 단자
    g.fillStyle = shade('#ff8a3d', .8);
    for (let i = -24; i < 40; i += 4) for (let t = 0; t < 24; t++) { const x = i + t, y = t; if (x >= 0 && x < 36) g.fillRect(x, y, 1, 1); }
    // 몸통 밖으로 나간 줄무늬 지우기는 그린 뒤 마스크로(아래 mask)
    box(g, 30, 3, 5, 6, '#c3cbe0'); box(g, 34, 4, 1, 4, '#8d97b4'); box(g, 31, 4, 1, 1, '#5b6585'); box(g, 31, 6, 1, 1, '#5b6585');   // 오른쪽 위 단자
    box(g, 1, 15, 5, 6, '#c3cbe0'); box(g, 1, 16, 1, 4, '#8d97b4'); box(g, 4, 16, 1, 1, '#5b6585'); box(g, 4, 18, 1, 1, '#5b6585');   // 왼쪽 아래 단자
  },
  Z(g) {   // 슬레이트: 위 줄 = 흑백 사선 막대(딱딱이), 아래 줄 = 칠판 + 분필 글씨
    for (let x = 1; x < 23; x++) for (let y = 2; y < 10; y++) if (((x + y) >> 2) % 2) box(g, x, y, 1, 1, '#f3f5fa');
    box(g, 11, 10, 3, 3, '#c3cbe0');   // 경첩
    box(g, 14, 15, 18, 1, '#e8ecf7'); box(g, 14, 19, 18, 1, '#e8ecf7'); box(g, 22, 13, 1, 9, '#e8ecf7');   // 칸 줄
    box(g, 15, 13, 3, 1, '#ffe27a'); box(g, 24, 17, 4, 1, '#8fe8ff'); box(g, 15, 21, 5, 1, '#ffb1d9');   // 분필 글씨
  },
};
// 그림 만들기: 몸통 → 세부 → 몸통 밖으로 나간 픽셀 지우기 → 90°씩 돌린 4장
function buildArt() {
  const out = {};
  for (const k of ORDER) {
    const { N, cells, body: col } = KIND[k], S = N * C;
    const [c, g] = canvasOf(S, S);
    body(g, cells, col);
    const [d, dg] = canvasOf(S, S);
    ART[k](dg);
    // 세부 그림은 몸통 안쪽(테두리 2px 안)에만
    const [m, mg] = canvasOf(S, S);
    for (const [cx, cy] of cells) mg.fillRect(cx * C, cy * C, C, C);
    mg.globalCompositeOperation = 'destination-out';
    const has = (x, y) => cells.some(q => q[0] === x && q[1] === y);
    for (const [cx, cy] of cells) {   // 테두리 2px(남색 선·흰 선) 안쪽에만
      if (!has(cx - 1, cy)) mg.fillRect(cx * C, cy * C, 1, C);
      if (!has(cx + 1, cy)) mg.fillRect(cx * C + C - 1, cy * C, 1, C);
      if (!has(cx, cy - 1)) mg.fillRect(cx * C, cy * C, C, 1);
      if (!has(cx, cy + 1)) mg.fillRect(cx * C, cy * C + C - 1, C, 1);
    }
    dg.globalCompositeOperation = 'destination-in'; dg.drawImage(m, 0, 0);
    g.drawImage(d, 0, 0);
    const rots = [c];
    for (let r = 1; r < 4; r++) {
      const [rc, rg] = canvasOf(S, S);
      rg.translate(S, 0); rg.rotate(Math.PI / 2); rg.drawImage(rots[r - 1], 0, 0);
      rots.push(rc);
    }
    out[k] = rots;
  }
  return out;
}

/* ===== 게임 ===== */
function rng(seed) { const f = () => { f.s = (f.s + 0x6D2B79F5) | 0; let t = f.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.s = seed | 0; return f; }
// 떨어지는 속도: 한 칸 내려오는 데 걸리는 프레임(가이드라인 공식, 교실용으로 빠른 쪽은 1칸/2프레임에서 멈춤)
export const gravF = lv => Math.max(2, Math.round(60 * Math.pow(.8 - (lv - 1) * .007, lv - 1)));
export const CLEAR_NAME = ['', '정리!', '깔끔하게 정리!', '칼각 정리!', '기자재!'];   // 4줄 = 원작의 '테트리스' 자리 (2026-10-27 하율: 어이없어서 재밌게)

export function createGear(canvas, opt = {}) {
  const g = canvas.getContext('2d');
  canvas.width = BW; canvas.height = BH; g.imageSmoothingEnabled = false;
  const ART_IMG = buildArt();
  const st = {};
  let rand, raf = 0, last = 0, acc = 0, alive = true, sound = !!opt.sound, actx = null;
  const keys = { left: false, right: false, down: false };

  function reset(seed = (Math.random() * 1e9) | 0) {
    rand = rng(seed);
    Object.assign(st, {
      scene: 'ready', frames: 0, ms: 0, score: 0, lines: 0, level: 1, pieces: 0, b2b: false,
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      bag: [], queue: [], cur: null, hold: null, held: false,
      grav: 0, lock: 0, lockN: 0, das: 0, dasDir: 0, clearRows: [], clearT: 0, flash: 0, shake: 0, parts: [], pops: [], trails: [], rings: [], stop: 0, bump: 0, seed,
    });
    while (st.queue.length < 5) st.queue.push(nextKind());
  }
  function nextKind() { if (!st.bag.length) { st.bag = [...ORDER]; for (let i = 6; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [st.bag[i], st.bag[j]] = [st.bag[j], st.bag[i]]; } } return st.bag.pop(); }

  /* --- 소리 (기본 꺼짐 — 교실) --- */
  function beep(f1, f2, dur, type = 'square', vol = .04, delay = 0) {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), v = actx.createGain(), t = actx.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(v).connect(actx.destination); o.start(t); o.stop(t + dur + .02);
    } catch {}
  }

  // 깨지는 소리: 짧은 잡음(부서짐) + 낮은 '쿵' — 타격감 (2026-10-27 하율)
  let noiseBuf = null;
  function crunch(vol = .12, dur = .18, cut = 2400, delay = 0) {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * .4, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const src = actx.createBufferSource(), f = actx.createBiquadFilter(), v = actx.createGain(), t = actx.currentTime + delay;
      src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(200, t + dur);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f).connect(v).connect(actx.destination); src.start(t); src.stop(t + dur + .02);
    } catch {}
  }
  const thump = (vol = .09) => beep(120, 40, .16, 'sine', vol);
  const fxAt = (cs, p) => { const xs = cs.map(c => (p.x + c[0]) * C + C / 2), ys = cs.map(c => (p.y + c[1] - HID) * C + C / 2); return [xs.reduce((a, b) => a + b) / xs.length, ys.reduce((a, b) => a + b) / ys.length]; };

  /* --- 판 --- */
  const fits = (k, r, x, y) => cellsOf(k, r).every(([cx, cy]) => { const bx = x + cx, by = y + cy; return bx >= 0 && bx < COLS && by < ROWS && (by < 0 || !st.board[by][bx]); });
  function spawn(k) {
    const x = k === 'O' ? 4 : 3, y = 0;
    st.cur = { k, r: 0, x, y };
    st.grav = 0; st.lock = 0; st.lockN = 0;
    if (!fits(k, 0, x, y)) return over();
    if (fits(k, 0, x, y + 1)) st.cur.y++;   // 숨은 줄에서 한 칸 내려와 보이게 시작(가이드라인)
  }
  function newPiece() { const k = st.queue.shift(); st.queue.push(nextKind()); spawn(k); st.held = false; opt.onQueue?.(); }
  function start() { if (st.scene !== 'ready') return; st.scene = 'play'; newPiece(); opt.onStart?.(); }
  function move(dx) {
    const p = st.cur; if (!p || !fits(p.k, p.r, p.x + dx, p.y)) return false;
    p.x += dx; resetLock(); beep(330, 300, .03, 'square', .02); return true;
  }
  function rotate(dir) {
    const p = st.cur; if (!p) return false;
    if (p.k === 'O') { resetLock(); return true; }
    const to = (p.r + dir + 4) % 4, kicks = (p.k === 'I' ? K4 : K3)[p.r + '>' + to];
    for (const [dx, dy] of kicks) if (fits(p.k, to, p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; p.r = to; resetLock(); beep(520, 640, .04, 'square', .025); return true; }
    return false;
  }
  function resetLock() { const p = st.cur; if (p && !fits(p.k, p.r, p.x, p.y + 1) && st.lockN < LOCK_MAX) { st.lock = 0; st.lockN++; } }
  const grounded = () => { const p = st.cur; return p && !fits(p.k, p.r, p.x, p.y + 1); };
  function softStep() { const p = st.cur; if (p && fits(p.k, p.r, p.x, p.y + 1)) { p.y++; st.score += SOFT_PT; return true; } return false; }
  function hardDrop() {
    const p = st.cur; if (!p || st.scene !== 'play' || st.clearT) return;
    let n = 0; while (fits(p.k, p.r, p.x, p.y + 1)) { p.y++; n++; }
    st.score += n * HARD_PT; st.shake = Math.max(st.shake, 4); st.bump = 1;
    const cs = cellsOf(p.k, p.r);
    for (const [cx, cy] of cs) if (n) for (let i = 0; i < 3; i++) st.parts.push({ x: (p.x + cx) * C + rand() * C, y: (p.y + cy - HID) * C + C, vx: (rand() - .5) * 70, vy: -30 - rand() * 50, t: .4, c: '#e6ebf7' });
    // 내리꽂은 자취(위에서 떨어진 빛줄기)
    if (n > 1) for (const [cx, cy] of cs) st.trails.push({ x: (p.x + cx) * C, y0: (p.y + cy - n - HID) * C, y1: (p.y + cy - HID) * C, t: .18 });
    if (n) { const [fx, fy] = fxAt(cs, p); opt.onScore?.(n * HARD_PT, fx, fy, 0); }
    thump(.07);
    lockPiece();
  }
  function hold() {
    if (st.scene !== 'play' || st.held || !st.cur || st.clearT) return;
    const k = st.cur.k;
    if (st.hold) { const h = st.hold; st.hold = k; spawn(h); } else { st.hold = k; newPiece(); }
    st.held = true; beep(440, 330, .06, 'triangle', .03); opt.onQueue?.();
  }
  function lockPiece() {
    const p = st.cur; if (!p) return;
    let above = true;
    for (const [i, [cx, cy]] of cellsOf(p.k, p.r).entries()) {
      const bx = p.x + cx, by = p.y + cy;
      if (by >= 0) st.board[by][bx] = { k: p.k, r: p.k === 'O' ? 0 : p.r, sx: cx, sy: cy };
      if (by >= HID) above = false; void i;
    }
    st.cur = null; st.pieces++;
    beep(150, 90, .07, 'triangle', .05);
    if (above) return over();   // 보이는 칸에 하나도 못 들어감 = 장비실 꽉 참
    const full = []; for (let y = 0; y < ROWS; y++) if (st.board[y].every(Boolean)) full.push(y);
    if (full.length) {
      const n = full.length, tet = n === 4, lv = st.level;
      const pts = LINE_PTS[n] * lv * (tet && st.b2b ? 1.5 : 1);
      st.score += Math.round(pts); st.b2b = tet; st.lines += n; st.level = levelOf(st.lines);
      st.clearRows = full; st.clearT = CLEAR_T; st.flash = tet ? 1 : .6; st.shake = tet ? 10 : 4 + n; st.stop = tet ? 7 : 4;   // stop = 잠깐 멈칫(히트스톱)
      // 깨지기(2026-10-27 2차 하율 "깔끔한 느낌이 안 남"): 칸이 통째로 하얗게 번쩍 → 작아지며 사라짐, 가운데 → 바깥 순서로 차례차례. 흩날리는 조각은 없앰
      for (const y of full) for (let x = 0; x < COLS; x++) { const c = st.board[y][x]; st.pops.push({ k: c.k, r: c.r, sx: c.sx, sy: c.sy, x: x * C, y: (y - HID) * C, d: Math.abs(x - 4.5) * .016, t: 0 }); }
      st.rings.push({ y: ((full[0] + full[full.length - 1]) / 2 - HID) * C + C / 2, t: .45, n });
      crunch(tet ? .2 : .13, tet ? .32 : .2, tet ? 3200 : 2400); thump(tet ? .16 : .11);
      if (tet) { [523, 659, 784, 1047].forEach((f, i) => beep(f, f, .12, 'square', .045, .06 + i * .07)); crunch(.12, .25, 1800, .12); }
      else beep(660, 990, .12 + n * .03, 'square', .04, .04);
      opt.onScore?.(Math.round(pts), BW / 2, ((full[0] + full[full.length - 1]) / 2 - HID) * C + C / 2, n);
      opt.onClear?.(n, CLEAR_NAME[n] + (tet && pts > LINE_PTS[4] * lv ? ' 연속!' : ''), Math.round(pts), st.level > lv);
    } else newPiece();
  }
  function finishClear() {
    const rows = st.clearRows; st.clearRows = [];
    st.board = st.board.filter((_, y) => !rows.includes(y));
    while (st.board.length < ROWS) st.board.unshift(Array(COLS).fill(null));
    newPiece();
  }
  function over() { if (st.scene === 'over') return; st.scene = 'over'; st.cur = null; st.shake = 6; beep(300, 60, .5, 'sawtooth', .05); opt.onOver?.({ score: st.score, lines: st.lines, level: st.level, pieces: st.pieces, ms: Math.round(st.ms) }); }

  function update(dt) {
    if (st.stop > 0) { st.stop--; return; }   // 히트스톱: 깨지는 순간 몇 프레임 멈칫
    for (const q of st.parts) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; }
    st.parts = st.parts.filter(q => q.t > 0);
    for (const q of st.pops) q.t += dt; st.pops = st.pops.filter(q => q.t < q.d + .2);
    for (const q of st.trails) q.t -= dt; st.trails = st.trails.filter(q => q.t > 0);
    for (const q of st.rings) q.t -= dt; st.rings = st.rings.filter(q => q.t > 0);
    st.shake = Math.max(0, st.shake - dt * 30); st.flash = Math.max(0, st.flash - dt * 3); st.bump = Math.max(0, st.bump - dt * 8);
    if (st.scene !== 'play') return;
    st.frames++; st.ms += dt * 1000;
    if (st.clearT) { if (--st.clearT === 0) finishClear(); return; }
    const p = st.cur; if (!p) return;
    // 좌우 누르고 있으면: DAS 10프레임 뒤 ARR 2프레임마다
    const dir = keys.left && !keys.right ? -1 : keys.right && !keys.left ? 1 : 0;
    if (dir !== st.dasDir) { st.dasDir = dir; st.das = 0; }
    else if (dir) { st.das++; if (st.das >= DAS && (st.das - DAS) % ARR === 0) move(dir); }
    // 떨어짐
    const gf = keys.down ? Math.max(1, Math.floor(gravF(st.level) / 20)) : gravF(st.level);
    if (++st.grav >= gf) { st.grav = 0; if (keys.down ? softStep() : (fits(p.k, p.r, p.x, p.y + 1) && (p.y++, true))) st.lock = 0; }
    if (grounded()) { if (++st.lock >= LOCK) lockPiece(); }
  }

  /* --- 그리기 --- */
  const ghostY = p => { let y = p.y; while (fits(p.k, p.r, p.x, y + 1)) y++; return y; };
  function drawCellAt(c, px, py) { g.drawImage(ART_IMG[c.k][c.r], c.sx * C, c.sy * C, C, C, px, py, C, C); }
  function drawPiece(p, y, alpha = 1) {
    g.globalAlpha = alpha;
    const N = KIND[p.k].N, img = ART_IMG[p.k][p.k === 'O' ? 0 : p.r];
    for (const [cx, cy] of cellsOf(p.k, p.r)) { const by = y + cy - HID; if (by < 0) continue; g.drawImage(img, cx * C, cy * C, C, C, (p.x + cx) * C, by * C, C, C); }
    g.globalAlpha = 1; void N;
  }
  function draw() {
    g.save();
    const sh = st.shake > 0 ? Math.round((rand() - .5) * st.shake) : 0, shx = st.shake > 3 ? Math.round((rand() - .5) * st.shake * .6) : 0;
    g.clearRect(0, 0, BW, BH);
    // 기자재실 선반 안쪽
    g.fillStyle = '#1d2238'; g.fillRect(0, 0, BW, BH);
    g.fillStyle = '#232945'; for (let x = 0; x < COLS; x++) for (let y = 0; y < VIS; y++) if ((x + y) % 2) g.fillRect(x * C, y * C, C, C);
    g.fillStyle = '#2c3354'; for (let y = 4; y < VIS; y += 5) g.fillRect(0, y * C - 1, BW, 1);   // 선반 줄
    g.translate(shx, sh + Math.round(st.bump * 2));
    const gone = st.clearT > 0;   // 지워지는 줄의 칸은 pops가 대신 그림
    for (let y = HID; y < ROWS; y++) { if (gone && st.clearRows.includes(y)) continue; for (let x = 0; x < COLS; x++) { const c = st.board[y][x]; if (c) drawCellAt(c, x * C, (y - HID) * C); } }
    if (st.clearT) {   // 지워지는 줄: 처음 2프레임 새하얗게 번쩍 → 빈 줄에 남은 빛이 가운데로 사라짐
      const k = st.clearT / CLEAR_T;
      for (const y of st.clearRows) {
        if (gone) { const w = Math.round(BW * k); g.fillStyle = `rgba(255,255,255,${k * .35})`; g.fillRect(BW / 2 - w / 2, (y - HID) * C + C / 2 - 1, w, 2); }   // 가운데 얇은 빛줄
      }
    }
    for (const r of st.rings) {   // 줄이 깨질 때 위아래로 퍼지는 충격파
      const k = 1 - r.t / .45, h = 4 + k * (24 + r.n * 10);
      g.fillStyle = `rgba(255,255,255,${(1 - k) * .55})`; g.fillRect(0, Math.round(r.y - h), BW, 2); g.fillRect(0, Math.round(r.y + h), BW, 2);
    }
    for (const q of st.trails) { g.fillStyle = `rgba(255,255,255,${q.t / .18 * .22})`; g.fillRect(q.x + 2, q.y0, C - 4, q.y1 - q.y0); }
    const p = st.cur;
    if (p && st.scene === 'play') {
      const gy = ghostY(p);
      if (gy !== p.y) {   // 고스트(놓일 자리): 예전처럼 칸만 — 테두리 없이 안쪽을 흰색으로 채워 밝게 (2026-10-27 하율)
        g.fillStyle = 'rgba(255,255,255,.42)';
        for (const [cx, cy] of cellsOf(p.k, p.r)) { const by = gy + cy - HID; if (by < 0) continue; g.fillRect((p.x + cx) * C + 1, by * C + 1, C - 2, C - 2); }
      }
      drawPiece(p, p.y);
    }
    for (const q of st.pops) {   // 깨지는 칸: 차례가 오면 하얗게 → 가운데로 줄어들며 사라짐
      const k = Math.max(0, (q.t - q.d) / .2), sz = Math.round(C * (1 - k * k));
      if (sz <= 0) continue;
      const o = (C - sz) / 2;
      if (k < .25) { drawCellAt(q, q.x, q.y); g.fillStyle = `rgba(255,255,255,${k === 0 ? .55 : .9})`; g.fillRect(q.x, q.y, C, C); }
      else { g.fillStyle = `rgba(255,255,255,${1 - k * .6})`; g.fillRect(q.x + o, q.y + o, sz, sz); }
    }
    for (const q of st.parts) { g.globalAlpha = Math.min(1, q.t * 2); g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }
    g.globalAlpha = 1;
    if (st.flash) { g.fillStyle = `rgba(255,255,255,${st.flash * .35})`; g.fillRect(0, 0, BW, BH); }
    g.restore();
  }
  // 작은 칸(보관·다음)에 장비 한 개 그리기: 기본 방향, 가운데 정렬
  function drawMini(cv, k, dim = false) {
    const mg = cv.getContext('2d'); mg.imageSmoothingEnabled = false;
    mg.clearRect(0, 0, cv.width, cv.height); if (!k) return;
    const cs = KIND[k].cells, xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * C, h = (Math.max(...ys) - Math.min(...ys) + 1) * C;
    mg.globalAlpha = dim ? .35 : 1;
    mg.drawImage(ART_IMG[k][0], Math.min(...xs) * C, Math.min(...ys) * C, w, h, Math.round((cv.width - w) / 2), Math.round((cv.height - h) / 2), w, h);
    mg.globalAlpha = 1;
  }

  /* --- 루프 --- */
  function frame(t) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = t; if (st.scene === 'play') pause(); return; }
    const dt = Math.min(.1, (t - (last || t)) / 1000); last = t;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
  }
  function pause() { if (st.scene !== 'play') return; st.scene = 'pause'; keys.left = keys.right = keys.down = false; opt.onPause?.(true); }
  function resume() { if (st.scene !== 'pause') return; st.scene = 'play'; last = 0; opt.onPause?.(false); }
  reset(opt.seed);
  raf = requestAnimationFrame(frame);

  return {
    st, reset, start, pause, resume, drawMini, hardDrop, hold,
    input(name, down) {
      if (st.scene === 'ready') { if (down) start(); return; }   // 아무 키나 누르면 시작(그 키로 블록을 움직이진 않음)
      if (st.scene === 'pause') { if (down) resume(); return; }
      if (st.scene !== 'play') return;
      if (name === 'left' || name === 'right') { keys[name] = down; if (down) { st.dasDir = name === 'left' ? -1 : 1; st.das = 0; if (!st.clearT) move(st.dasDir); } }
      else if (name === 'down') { keys.down = down; if (down && !st.clearT && softStep()) st.lock = 0; }
      else if (!down || st.clearT) return;
      else if (name === 'cw') rotate(1);
      else if (name === 'ccw') rotate(-1);
      else if (name === 'drop') hardDrop();
      else if (name === 'hold') hold();
    },
    setSound(v) { sound = v; },
    destroy() { alive = false; cancelAnimationFrame(raf); try { actx?.close(); } catch {} },
    step(n = 1, quiet = false) { for (let i = 0; i < n; i++) update(STEP); if (!quiet) draw(); },   // 테스트용
    draw, art: ART_IMG,
  };
}
