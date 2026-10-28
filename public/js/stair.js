// SVMHS GROUND — '영상고 계단 오르기' (2026-10-28 하율 "무한의 계단을 사이트에 — 이름은 영상고 계단 오르기", 미리보기 깃발 stair-game)
// 2차(같은 날 하율 "디테일·그래픽 디벨롭, 바로 출시해도 될 정도로 · 픽셀로"): 160×240 픽셀 화면을 그대로 키워 그림(또렷한 픽셀).
// 규칙(무한 계단식 — 이름·그림·소리는 전부 새로 만듦): 계단은 한 칸씩 왼쪽/오른쪽으로 꺾이며 끝없이 이어짐.
//   '오르기' = 보고 있는 쪽으로 한 칸 · '방향 바꾸기' = 몸을 돌려 반대쪽으로 한 칸. 계단이 없는 쪽으로 오르면 헛디뎌 끝.
//   '종 게이지'는 계속 줄고 한 칸마다 조금 참(stair-score.js) — 다 떨어지면 종이 쳐서 지각, 끝.
// 캐릭터는 '집에 가고 싶어!'에서 꾸민 캐릭터 그대로(runner.js buildSprites). 글자(점수·층·안내)는 social.js playStair가 DOM으로.
// 배경: 학교 1~5층(복도 벽·창문·게시판·교실 문·소화기·시계) → 옥상(난간·물탱크) → 하늘(구름·새) → 구름 위(노을) → 우주(별·행성·별똥별)
import { GAIN, FLOOR, drain, floorName, zoneOf } from './stair-score.js';
import { buildSprites, loadChar, SPR_W, SPR_H } from './runner.js';

export const W = 160, H = 240;
const DX = 22, DY = 10, SW = 22, ST = DY, FOOT = 168;   // 2026-10-28 17:52 하율: 계단 높이 12 → 8과 12의 중간(10), 꼭짓점은 계속 붙게 세로 간격도 10
const PS = 2, CS = 1.5;   // 캔버스 = 논리 화면 × 2(PS) · 캐릭터는 1.5배(CS, 하율 "캐릭터가 계단에 비해 너무 작다") → 캐릭터 그림 한 픽셀 = 캔버스 3픽셀로 고르게   // 2026-10-28 하율 "계단 중간을 이어 놓으니 헷갈림 → 끝과 끝을 이어서": 가로 간격 = 계단 폭(한 칸의 끝 = 다음 칸의 시작)   // 계단 가로·세로 간격 · 계단 폭·두께 · 캐릭터 발 높이(화면 y)
const OL = '#2a2846';
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

/* ===== 픽셀 그림 (문자 → 캔버스, o = 외곽선) ===== */
function pix(rows, col) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.') continue; g.fillStyle = ch === 'o' ? (col.o || OL) : col[ch] || '#f0f'; g.fillRect(x, y, 1, 1); } });
  return cv;
}
const flipCv = src => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; };
// 3×5 픽셀 글자(표지판용)
const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  F: '111100110100100', R: '110101110101101', m: '000000111111101', '-': '000000111000000', ' ': '000000000000000' };
const txtW = s => String(s).length * 4 - 1;
function pxText(g, s, x, y, c) { g.fillStyle = c; for (const ch of String(s)) { const f = FONT[ch] || FONT[' ']; for (let i = 0; i < 15; i++) if (f[i] === '1') g.fillRect(x + i % 3, y + ((i / 3) | 0), 1, 1); x += 4; } }

let ART = null;
function art() {
  if (ART) return ART;
  const stair = (top, face, edge, hi) => {   // 폭 SW 픽셀: 윗면 하이라이트·윗면·모서리 줄·앞면·앞면 그늘
    const mid = n => 'o' + n.repeat(SW - 2) + 'o', cap = '.' + 'o'.repeat(SW - 2) + '.';
    return pix([cap, mid('h'), mid('t'), mid('e'), ...Array(ST - 6).fill(mid('f')), mid('F'), cap],   // 높이 = 세로 간격(DY) → 아래 칸 윗면과 꼭짓점이 딱 붙음(2026-10-28 하율)
      { h: hi, t: top, e: edge, f: face, F: mix(face, OL, .25) });
  };
  ART = {
    // 계단(구역마다 재질): 학교 = 회색 돌계단+노란 미끄럼 방지 줄 · 하늘 = 하늘색 블록 · 구름 위 = 분홍 · 우주 = 보라 빛 · 층 계단 = 노랑
    st: {
      school: stair('#d9dde8', '#9aa3c0', '#ffd25e', '#ffffff'),
      sky: stair('#d8efff', '#6fb6f2', '#ffffff', '#ffffff'),
      dusk: stair('#ffe1ea', '#f29bb5', '#ffffff', '#ffffff'),
      space: stair('#e2dcff', '#8a7be0', '#c8f0ff', '#ffffff'),
      land: stair('#fff1b8', '#f5b03a', '#ff8a5b', '#ffffff'),
      roof: stair('#c8f5b4', '#4fbf5f', '#ffffff', '#ffffff'),   // 옥상 계단 = 초록(옥상 바닥과 같은 색)
      hint: stair('#c9f7d6', '#46c46e', '#ffffff', '#ffffff'),
    },
    win: pix([   // 창문(밖은 하늘)
      'oooooooooooooooooo',
      'owwwwwwwowwwwwwwwo',
      'osssssssoskssssso'.padEnd(17, 's') + 'o',
      'osssssssosssssssso',
      'osskkssssossssssso'.slice(0, 18),
      'osssssssosssssssso',
      'oooooooooooooooooo',
      'osssssssosssssssso',
      'ossssssssosssssssso'.slice(0, 18),
      'osssssssosssssssso',
      'osssssssosssssssso',
      'oooooooooooooooooo',
      'obbbbbbbbbbbbbbbbo',
      'oooooooooooooooooo',
    ], { w: '#ffffff', s: '#9fd8ff', k: '#ffffff', b: '#c9b9a0' }),
    board: pix([   // 게시판(종이 3장)
      'oooooooooooooooooooo',
      'occcccccccccccccccco',
      'ocwwwwwcccyyyycccppo'.slice(0, 20),
      'ocwkkkwcccyyyyccppco'.slice(0, 20),
      'ocwwwwwcccykkycccppo'.slice(0, 20),
      'ocwkkwwcccyyyycccppo'.slice(0, 20),
      'ocwwwwwcccccccccppco'.slice(0, 20),
      'occcccccccccccccccco',
      'oooooooooooooooooooo',
    ], { c: '#c98f55', w: '#ffffff', k: '#9aa3c0', y: '#ffe48a', p: '#ffb0c8' }),
    door: pix([   // 교실 문(창 + 반 표지)
      '..oooooooo..',
      '..onnnnnno..',
      '..oooooooo..',
      'oooooooooooo',
      'oddddddddddo',
      'odssssssssdo',
      'odssssssssdo',
      'odssssssssdo',
      'oddddddddddo',
      'oddddddddddo',
      'oddddddddkdo',
      'oddddddddkdo',
      'oddddddddddo',
      'oddddddddddo',
      'oddddddddddo',
      'oddddddddddo',
      'oDDDDDDDDDDo',
      'oooooooooooo',
    ], { n: '#ffffff', d: '#7fa8e0', D: '#5d86c0', s: '#cfeaff', k: '#ffd25e' }),
    fire: pix([   // 소화기
      '..ooo.',
      '.okko.',
      'oooooo',
      'orrrro',
      'orwrro',
      'orrrro',
      'orrrro',
      'oRRRRo',
      'oooooo',
    ], { k: '#3b3b49', r: '#ff5a5a', R: '#d63f4a', w: '#ffffff' }),
    clock: pix([   // 벽시계
      '..oooo..',
      '.owwwwo.',
      'owwwkwwo',
      'owwwkwwo',
      'owwkkwwo',
      'owwwwwwo',
      '.owwwwo.',
      '..oooo..',
    ], { w: '#ffffff', k: OL }),
    cloud: pix([
      '.......oooo..........',
      '.....oowwwwoo........',
      '..oooowwwwwwwooooo...',
      '.owwwwwwwwwwwwwwwwoo.',
      'owwwwwwwwwwwwwwwwwWWo',
      '.oWWWWWWWWWWWWWWWWWo.',
      '..ooooooooooooooooo..',
    ], { w: '#ffffff', W: '#dfeaf7', o: '#b9cde6' }),
    bird: [pix(['o...o', '.o.o.', '..o..'], {}), pix(['.....', 'oo.oo', '..o..'], {})],
    tank: pix([   // 옥상 물탱크
      '..oooooooooo..',
      '.owwwwwwwwwwo.',
      'owwwwwwwwwwwwo',
      'oWWWWWWWWWWWWo',
      'owwwwwwwwwwwwo',
      'oWWWWWWWWWWWWo',
      'owwwwwwwwwwwwo',
      'oooooooooooooo',
      '.o..o....o..o.',
      '.o..o....o..o.',
    ], { w: '#e6edf7', W: '#c3cee0' }),
    planet: pix([
      '....oooooo....',
      '..oohhppppoo..',
      '.ohhppppppppo.',
      'oooooooooooooooo'.slice(0, 14),
      'oppppppppppppo',
      '.oPPppppppPPo.',
      '..ooPPPPPPoo..',
      '....oooooo....',
    ], { p: '#ffb36b', P: '#e07f4a', h: '#ffe0b0' }),
  };
  ART.cloudF = flipCv(ART.cloud);
  return ART;
}

/* ===== 하늘 색: 구역마다 위·아래 색 (층 f 기준, 사이에서 섞음) ===== */
const SKYK = [[5, '#7cc8ff', '#d6f0ff'], [7, '#5cb2f2', '#bfe6ff'], [8.3, '#ff9aa8', '#ffd9a8'], [9.6, '#4b3f8f', '#c56f9a'], [10.6, '#141a3d', '#2d2f6b'], [99, '#0b0e26', '#1c1f4d']];   // 층(100칸) 기준
function skyAt(f) {
  if (f <= SKYK[0][0]) return [SKYK[0][1], SKYK[0][2]];
  for (let i = 0; i < SKYK.length - 1; i++) { const [a, t1, b1] = SKYK[i], [b, t2, b2] = SKYK[i + 1]; if (f < b) { const t = (f - a) / (b - a); return [mix(t1, t2, t), mix(b1, b2, t)]; } }
  return [SKYK.at(-1)[1], SKYK.at(-1)[2]];
}
const kindOf = i => i === FLOOR * 5 ? 'roof' : i > 0 && i % FLOOR === 0 ? 'land' : i < FLOOR * 5 ? 'school' : i < FLOOR * 8 ? 'sky' : i < FLOOR * 10 ? 'dusk' : 'space';

export function createStair(cv, o = {}) {
  const g = cv.getContext('2d');
  cv.width = W * PS; cv.height = H * PS; g.imageSmoothingEnabled = false;
  const A = art();
  let spr = null, sprF = null;
  const loadSpr = () => { spr = buildSprites(o.char || loadChar()); sprF = {}; for (const k of ['run1', 'run2', 'jump', 'dead']) { sprF[k] = flipCv(spr[k]); sprF[k + '_rim'] = flipCv(spr[k + '_rim']); } };
  loadSpr();
  let raf = 0, last = 0, alive = true, sound = !!o.sound, ac = null, rnd = rng(o.seed ?? (Date.now() & 0xffff));
  const st = { scene: 'ready', steps: 0, turns: 0, ms: 0, gauge: 1, floor: 0, face: 1, why: '', shown: false, fast: 0, endAt: 0 };
  let overT = 0, lowT = 0, recent = [], xs = [], run = 0, runDir = 1, px = 0, py = 0, fromX = 0, fromY = 0, moveT = 1, fall = null, shake = 0, parts = [], camX = 0, camY = 0, t = 0, flash = 0, stepN = 0, shoot = null;
  const stars = Array.from({ length: 60 }, (_, i) => [hash(i * 3 + 1) * W, hash(i * 3 + 2) * 400, hash(i * 3 + 3)]);

  function more(n) {   // 같은 방향으로 1~6칸 이어지다 꺾임(처음 한 칸은 항상 오른쪽 → 첫 '오르기'가 실패하지 않게)
    while (xs.length < n) {
      const i = xs.length;
      if (i === 0) { xs.push(0); continue; }
      if (i === 1) { xs.push(1); runDir = 1; run = 1; continue; }
      const turnP = run >= 6 ? 1 : run <= 1 ? .22 : .38;
      if (rnd() < turnP) { runDir = -runDir; run = 0; }
      xs.push(xs[i - 1] + runDir); run++;
    }
  }
  function reset() {
    clearTimeout(overT); recent = [];   // 끝난 판의 결과 알림이 새 판 시작 뒤에 뒤늦게 와서 새 판의 시작 티켓을 써 버리던 버그(2026-10-28 하율 화면 '게임을 다시 시작해 주세요')
    xs = []; more(60); Object.assign(st, { scene: 'ready', steps: 0, turns: 0, ms: 0, gauge: 1, floor: 0, face: 1, why: '', shown: false, fast: 0, endAt: 0 });
    px = fromX = 0; py = fromY = 0; moveT = 1; fall = null; shake = 0; parts = []; camX = 0; camY = 0; flash = 0; stepN = 0;
  }

  /* ----- 소리 (8비트 느낌, 첫 입력 뒤에 만듦, 기본 꺼짐) ----- */
  function beep(f, d = .06, type = 'square', v = .05, f2) {
    if (!sound) return;
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const tt = ac.currentTime, gn = ac.createGain(), os = ac.createOscillator();
      os.type = type; os.frequency.setValueAtTime(f, tt); if (f2) os.frequency.exponentialRampToValueAtTime(f2, tt + d);
      gn.gain.setValueAtTime(v, tt); gn.gain.exponentialRampToValueAtTime(.0001, tt + d);
      os.connect(gn).connect(ac.destination); os.start(tt); os.stop(tt + d + .02);
    } catch {}
  }
  // 효과음은 1차 그대로(2026-10-28 하율 "효과음은 수정 전이 나았다 → 효과음만 롤백")
  const tune = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .09, 'triangle', .06), i * 70));

  /* ----- 입력: 'climb' 오르기 · 'turn' 방향 바꾸기 ----- */
  function input(kind) {
    if (!alive || st.scene === 'over') return;
    if (st.scene === 'pause') { st.scene = 'play'; last = 0; o.onPause?.(false); return; }   // 멈춤을 푸는 입력은 오르지 않음
    if (st.scene === 'ready') { st.scene = 'play'; o.onStart?.(); }
    if (kind === 'turn') { st.face = -st.face; st.turns++; }
    const i = st.steps, nx = xs[i + 1];
    fromX = fromX + (px - fromX) * moveT; fromY = fromY + (py - fromY) * moveT;
    if (nx - xs[i] !== st.face) {   // 계단이 없는 쪽 → 헛디딤
      fall = { x: xs[i] + st.face * .9, y: i, vx: st.face * .9, vy: -1.6, r: 0 };
      shake = 4; beep(300, .35, 'sawtooth', .05, 70); end('miss'); return;
    }
    st.steps++; px = nx; py = st.steps; moveT = 0; stepN++;
    const now = performance.now(); recent.push(now); if (recent.length > 8) recent.shift();
    st.fast = recent.length === 8 && now - recent[0] < 1000 ? 1 : 0;   // 1초에 8칸 넘게 = 달리는 중(등 뒤 속도선)
    st.gauge = Math.min(1, st.gauge + GAIN);
    if (st.steps + 40 > xs.length) more(st.steps + 60);
    parts.push({ x: xs[i] * DX - st.face * 6, y: -i * DY, vx: -st.face * 14, vy: -6, t: 0, c: '#ffffff' }, { x: xs[i] * DX - st.face * 2, y: -i * DY, vx: -st.face * 6, vy: -10, t: 0, c: '#e6edf7' });
    const f = Math.floor(st.steps / FLOOR);
    if (f > st.floor) {
      const z = zoneOf(f) !== zoneOf(st.floor); st.floor = f; flash = 1; tune(z);
      for (let k = 0; k < 10; k++) parts.push({ x: px * DX + (k - 5) * 3, y: -py * DY - 4, vx: (k - 5) * 9, vy: -30 - (k % 3) * 12, t: 0, c: ['#ffd25e', '#ff8fb0', '#7cc4ff', '#ffffff'][k % 4], g: 1 });
      o.onFloor?.(f, f <= 5 ? floorName(f) + ' 도착!' : z ? zoneOf(f) + ' 도착!' : floorName(f, true) + ' 돌파!', z || f <= 5);
    } else beep(392 + (st.steps % 8) * 28, .045, 'square', .035);
    o.onStep?.(st.steps);
  }
  function end(why) {
    if (st.scene === 'over') return;
    st.scene = 'over'; st.why = why; st.endAt = performance.now();
    if (why === 'time') { shake = 3; [880, 660, 880, 660].forEach((f, i) => setTimeout(() => beep(f, .16, 'triangle', .06), i * 170)); }
    overT = setTimeout(() => { if (!alive) return; st.shown = true; st.shownAt = performance.now(); o.onOver?.({ steps: st.steps, turns: st.turns, ms: Math.round(st.ms), why, floor: st.floor }); }, why === 'time' ? 900 : 750);
  }
  function pause() { if (st.scene === 'play') { st.scene = 'pause'; o.onPause?.(true); } }

  /* ----- 그리기 ----- */
  const R = Math.round;
  let shX = 0, shY = 0;
  const sx = wx => R(W / 2 + wx - camX + shX), sy = wy => R(FOOT + wy - camY + shY);
  // ----- 벽 장식(픽셀 직접 그리기) -----
  const box = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const frameBox = (x, y, w, h, c) => { box(x - 1, y - 1, w + 2, h + 2, OL); box(x, y, w, h, c); };
  function win(x, y) {   // 창문 32×34: 흰 창틀 · 하늘(구역 따라 바뀌는 바깥 색) · 반짝 줄 · 창턱
    const [top] = skyAt(-camY / DY / FLOOR + 3);
    frameBox(x, y, 32, 30, '#ffffff'); box(x + 2, y + 2, 28, 26, top); box(x + 2, y + 18, 28, 10, mix(top, '#ffffff', .35));
    box(x + 15, y + 2, 2, 26, '#ffffff'); box(x + 2, y + 14, 28, 2, '#ffffff');
    box(x + 4, y + 9, 2, 2, '#ffffff'); box(x + 6, y + 7, 2, 2, '#ffffff'); box(x + 19, y + 24, 2, 2, '#ffffff'); box(x + 21, y + 22, 2, 2, '#ffffff');
    box(x + 4, y + 20, 8, 3, '#ffffff'); box(x + 6, y + 18, 5, 2, '#ffffff');   // 창밖 구름
    frameBox(x - 2, y + 31, 36, 3, '#c9a37a');
  }
  function elev(x, y) {   // 엘리베이터 30×52 — 영상고엔 엘리베이터가 없다(하율) → 노랑·검정 테이프로 X, 버튼도 꺼짐
    frameBox(x, y, 30, 52, '#c3cbd9'); box(x + 2, y + 2, 26, 48, '#9aa3b5'); box(x + 14, y + 2, 2, 48, '#7d869a');
    for (let i = 0; i < 26; i++) { const c = (i >> 1) % 2 ? '#ffd25e' : '#2a2846';
      box(x + 2 + i, y + 6 + R(i * 1.6), 2, 2, c); box(x + 26 - i, y + 6 + R(i * 1.6), 2, 2, c); }
    frameBox(x + 33, y + 20, 5, 9, '#e6edf7'); box(x + 34, y + 22, 3, 2, '#9aa3b5'); box(x + 34, y + 26, 3, 2, '#9aa3b5');
  }
  function door(x, y, fl, k = 0) {   // 교실 문 24×46 + 위 반 표지(2-1 …)
    const nm = (fl + 1) + '-' + ((fl + k) % 6 + 1);
    frameBox(x + 2, y - 10, 20, 7, '#ffffff'); pxText(g, nm, x + 12 - (txtW(nm) >> 1), y - 9, OL);
    frameBox(x, y, 24, 46, '#7fa8e0'); box(x, y + 43, 24, 3, '#5d86c0');
    frameBox(x + 4, y + 4, 16, 12, '#cfeaff'); box(x + 5, y + 5, 3, 2, '#ffffff');
    box(x + 18, y + 24, 3, 4, '#ffd25e'); box(x + 18, y + 27, 3, 1, OL);
  }
  function board(x, y) {   // 게시판 36×24: 코르크 + 종이 3장 + 압정
    frameBox(x, y, 36, 24, '#d49a5f'); box(x, y + 21, 36, 3, '#b77f47');
    frameBox(x + 3, y + 3, 10, 13, '#ffffff'); box(x + 5, y + 6, 6, 1, '#9aa3c0'); box(x + 5, y + 9, 5, 1, '#9aa3c0'); box(x + 5, y + 12, 6, 1, '#9aa3c0');
    frameBox(x + 16, y + 4, 9, 10, '#ffe48a'); box(x + 18, y + 7, 5, 4, '#ff8f9a');
    frameBox(x + 27, y + 3, 6, 15, '#ffb0c8'); box(x + 28, y + 5, 4, 1, '#ffffff');
    box(x + 7, y + 2, 2, 2, '#ff5a5a'); box(x + 20, y + 3, 2, 2, '#5ab8ff'); box(x + 29, y + 2, 2, 2, '#62d9b8');
  }
  function clock(x, y) {   // 벽시계 13×13 — 바늘이 실제 시각
    box(x + 3, y, 7, 13, OL); box(x, y + 3, 13, 7, OL); box(x + 1, y + 1, 11, 11, OL);
    box(x + 3, y + 1, 7, 11, '#ffffff'); box(x + 1, y + 3, 11, 7, '#ffffff'); box(x + 2, y + 2, 9, 9, '#ffffff');
    const d = new Date(), a1 = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * 6.283, a2 = d.getMinutes() / 60 * 6.283;
    g.fillStyle = OL; for (let r = 0; r <= 3; r++) g.fillRect(R(x + 6 + Math.sin(a1) * r), R(y + 6 - Math.cos(a1) * r), 1, 1);
    g.fillStyle = '#ff5a5a'; for (let r = 0; r <= 4; r++) g.fillRect(R(x + 6 + Math.sin(a2) * r), R(y + 6 - Math.cos(a2) * r), 1, 1);
  }
  function lamp(x, by) {   // 요술 램프(바닥 by에 놓임, 22×11) + 위로 피어오르는 연기 + 반짝이
    const y = by - 11, Y = '#ffd25e', D = '#e09a2a', Lt = '#fff1b8';
    box(x + 8, y, 4, 2, OL); box(x + 9, y - 1, 2, 1, OL);                                       // 뚜껑 꼭지
    box(x + 5, y + 2, 10, 2, OL); box(x + 6, y + 2, 8, 1, Y);                                   // 뚜껑
    box(x + 3, y + 4, 14, 6, OL); box(x + 4, y + 4, 12, 5, Y); box(x + 4, y + 8, 12, 1, D); box(x + 5, y + 5, 4, 1, Lt);   // 몸통
    box(x + 16, y + 5, 3, 2, OL); box(x + 18, y + 4, 3, 2, OL); box(x + 20, y + 3, 2, 2, OL); box(x + 17, y + 5, 2, 1, Y); box(x + 19, y + 4, 1, 1, Y);   // 주둥이
    box(x, y + 4, 2, 1, OL); box(x - 1, y + 5, 1, 3, OL); box(x, y + 8, 3, 1, OL);              // 손잡이
    box(x + 6, y + 10, 8, 1, OL);                                                               // 받침
    for (let k = 0; k < 4; k++) { const tt = (t * .8 + k / 4) % 1, sx0 = R(x + 21 + Math.sin(tt * 6 + k) * 2), sy0 = R(y + 2 - tt * 22);   // 연기
      g.globalAlpha = 1 - tt; box(sx0, sy0, 2 + (k % 2), 2, '#e2dcff'); g.globalAlpha = 1; }
    if (Math.floor(t * 3) % 3 === 0) { box(x + 2, y - 3, 1, 3, '#ffffff'); box(x + 1, y - 2, 3, 1, '#ffffff'); }
    if (Math.floor(t * 3 + 1) % 3 === 0) { box(x + 15, y - 5, 1, 3, '#ffffff'); box(x + 14, y - 4, 3, 1, '#ffffff'); }
  }
  function fireX(x, y) {   // 소화기 8×16
    box(x + 2, y - 3, 4, 3, OL); box(x + 5, y - 2, 3, 1, OL);
    frameBox(x, y, 8, 15, '#ff5a5a'); box(x, y + 12, 8, 3, '#d63f4a'); frameBox(x + 2, y + 4, 4, 4, '#ffffff');
  }
  function bg(f) {
    // 하늘(창밖·옥상 위) — 8줄씩 계단 모양으로 색이 바뀌는 픽셀 그라디언트
    const [top, bot] = skyAt(f);
    for (let y = 0; y < H; y += 8) { g.fillStyle = mix(top, bot, y / H); g.fillRect(0, y, W, 8); }
    if (f > 9.2) {   // 별: 반짝(밝기 2단계)
      const a = Math.min(1, (f - 9.2) / 1.2);
      for (const [x, y0, k] of stars) {
        const y = ((y0 - camY * .08) % 400 + 400) % 400 - 80; if (y < 0 || y > H) continue;
        g.globalAlpha = a * ((t * 2 + k * 9) % 3 < .4 ? .4 : 1); g.fillStyle = k > .8 ? '#ffe9a8' : '#ffffff';
        g.fillRect(R(x), R(y), 1, 1); if (k > .9) { g.fillRect(R(x) - 1, R(y), 3, 1); g.fillRect(R(x), R(y) - 1, 1, 3); }
      }
      g.globalAlpha = a; g.drawImage(A.planet, W - 34, R(30 - (camY * .03) % 20)); g.globalAlpha = 1;
      if (!shoot && Math.random() < .004) shoot = { x: Math.random() * W, y: Math.random() * 80, t: 0 };
      if (shoot) { shoot.t += 1 / 60; g.fillStyle = '#ffffff'; for (let k = 0; k < 8; k++) { g.globalAlpha = 1 - k / 8; g.fillRect(R(shoot.x - shoot.t * 160 + k * 2), R(shoot.y + shoot.t * 60 - k), 2, 1); } g.globalAlpha = 1; if (shoot.t > .8) shoot = null; }
    }
    if (f > 4.5 && f < 10.6) {   // 구름(느리게 따라옴) · 하늘에선 새
      const a = Math.min(1, (f - 4.5) * 2) * (f > 9.6 ? (10.6 - f) : 1);
      g.globalAlpha = a;
      for (let k = -2; k < 6; k++) {
        const band = Math.floor(-camY * .3 / 70) + k, y = R(band * -70 + camY * .3 + H), x = R(hash(band) * (W + 30) - 25 - camX * .15) % (W + 40);
        if (y > -10 && y < H) g.drawImage(hash(band + 7) > .5 ? A.cloud : A.cloudF, x < -30 ? x + W + 40 : x, y);
      }
      if (f > 5.2 && f < 8) { const by = R(60 + Math.sin(t * .7) * 10), bx = R(((t * 18) % (W + 20)) - 10); g.drawImage(A.bird[Math.floor(t * 5) % 2], bx, by); g.drawImage(A.bird[Math.floor(t * 5 + 1) % 2], bx - 9, by + 5); }
      g.globalAlpha = 1;
    }
    // 학교 건물 안(1~5층): 벽이 화면을 덮고, 옥상 위로 갈수록 아래로 내려가며 하늘이 드러남
    const roofY = sy(-FLOOR * 5 * DY) + 2;   // 5층 계단(옥상 바닥) 높이
    if (roofY < H) {
      const top0 = Math.max(0, roofY);
      g.fillStyle = '#f4ecdb'; g.fillRect(0, top0, W, H - top0);
      g.fillStyle = '#efe4cd'; for (let y = top0 + ((R(-camY * .6) % 6) + 6) % 6; y < H; y += 6) g.fillRect(0, y, W, 1);   // 벽 줄무늬
      // 장식: 층마다 같은 자리(벽에 붙어 있으니 계단과 같이 움직임). 층 높이 = FLOOR*DY
      const FH = FLOOR * DY;
      for (let fl = 0; fl < 5; fl++) {
        const base = sy(-fl * FH);   // 그 층 바닥
        if (base < top0 - 10 || base - FH > H + 10) continue;
        g.save(); g.beginPath(); g.rect(0, top0, W, H - top0); g.clip();
        g.fillStyle = '#9cc4ee'; g.fillRect(0, base - 26, W, 3);   // 허리 띠
        g.fillStyle = '#e3d6bb'; g.fillRect(0, base - 23, W, 23);   // 아래 벽(걸레받이 위)
        // 벽 장식: 한 층(1000px)을 300px 구간으로 나눠 반복, 구간마다 왼쪽·오른쪽 번갈아(계단 뒤 벽에 붙어 있음)
        for (let k = 0; k * 300 < FH - 120; k++) {
          const b = base - k * 300; if (b < top0 - 300 || b - 300 > H) continue;
          const flip = (fl + k) % 2 ? -1 : 1, at = (sd, w) => (sd * flip < 0 ? 5 : W - w - 5);
          if (k === 1) elev(at(1, 30), b - 52); else door(at(1, 24), b - 46, fl, k);
          if (k === 0) fireX(at(-1, 8), b - 18);
          win(at(-1, 32), b - 110);
          if (k !== 1) clock(at(1, 13), b - 104);
          board(at(1, 36), b - 172);
          win(at(-1, 32), b - 214);
          win(at(1, 32), b - 280);
        }
        // 층 바닥(두꺼운 띠) + 층 번호
        g.fillStyle = '#c9b9a0'; g.fillRect(0, base, W, 4); g.fillStyle = OL; g.fillRect(0, base, W, 1); g.fillRect(0, base + 4, W, 1);
        g.restore();
      }
      // 옥상(2026-10-28 하율 "옥상은 초록색, 요술 램프가 놓여 있게"): 초록 우레탄 바닥 + 난간 + 물탱크 + 요술 램프
      g.fillStyle = '#4fbf5f'; g.fillRect(0, roofY - 2, W, 10); g.fillStyle = '#8fe08a'; g.fillRect(0, roofY - 2, W, 2); g.fillStyle = '#ffffff'; for (let x = 4; x < W; x += 24) g.fillRect(x, roofY + 2, 12, 1);   // 우레탄 바닥 흰 줄
      g.fillStyle = '#3a9a4a'; g.fillRect(0, roofY + 6, W, 2); g.fillStyle = OL; g.fillRect(0, roofY - 3, W, 1); g.fillRect(0, roofY + 8, W, 1);
      for (let x = 2; x < W; x += 7) g.fillRect(x, roofY - 16, 1, 13);
      g.fillRect(0, roofY - 17, W, 1); g.fillRect(0, roofY - 10, W, 1);
      g.drawImage(A.tank, 10, roofY - 28);
      lamp(W - 44, roofY - 3);

    }
  }
  function drawStair(i) {
    const x = sx(xs[i] * DX) - SW / 2, y = sy(-i * DY);
    if (y < -12 || y > H + 2) return;
    const missHint = st.why === 'miss' && i === st.steps + 1 && Math.floor(t * 6) % 2;   // 헛디딘 뒤: 원래 올랐어야 할 계단을 초록으로 깜빡
    let k = missHint ? 'hint' : kindOf(i);
    if ((k === 'land' || k === 'roof') && flash > 0 && i === st.floor * FLOOR && Math.floor(t * 12) % 2) k = 'hint';
    g.drawImage(A.st[k], x, y);
    if (i > 0 && i % FLOOR === 0) {   // 층 표지판(2F·RF·50m …)
      const f = i / FLOOR, s = f < 5 ? (f + 1) + 'F' : f === 5 ? 'RF' : (f - 5) * 100 + 'm', w = txtW(s) + 6, tx = x + SW / 2 - (w >> 1), ty = y - 22;
      g.fillStyle = OL; g.fillRect(x + SW / 2, ty + 9, 1, 13);
      g.fillStyle = OL; g.fillRect(tx - 1, ty - 1, w + 2, 11); g.fillStyle = '#ffffff'; g.fillRect(tx, ty, w, 9); g.fillStyle = '#ffd25e'; g.fillRect(tx, ty + 8, w, 1);
      pxText(g, s, tx + 3, ty + 2, OL);
    }
  }
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
    if (st.scene === 'play') {
      st.ms += dt * 1000; st.gauge -= drain(st.steps) * dt;
      if (st.gauge <= 0) { st.gauge = 0; end('time'); }
    }
    moveT = Math.min(1, moveT + dt / .075);
    flash = Math.max(0, flash - dt / .9);
    const cx = fromX + (px - fromX) * moveT, cy = fromY + (py - fromY) * moveT;
    camX += (cx * DX - camX) * Math.min(1, dt * 10); camY += (-cy * DY - camY) * Math.min(1, dt * 14);
    if (st.scene === 'ready') { camX = cx * DX; camY = -cy * DY; }
    shake = Math.max(0, shake - dt * 12); shX = shake ? R((Math.random() - .5) * shake * 2) : 0; shY = shake ? R((Math.random() - .5) * shake * 2) : 0;
    g.setTransform(PS, 0, 0, PS, 0, 0); g.imageSmoothingEnabled = false;
    const f = -camY / DY / FLOOR;
    bg(f);
    const top = Math.floor(cy) + 24, bot = Math.max(0, Math.floor(cy) - 8);
    for (let i = Math.min(top, xs.length - 1); i >= bot; i--) drawStair(i);
    // 발밑 먼지·축하 가루
    parts = parts.filter(p => (p.t += dt) < (p.g ? .9 : .3));
    for (const p of parts) { g.fillStyle = p.c; g.globalAlpha = p.g ? 1 : 1 - p.t / .3; const yy = p.y + p.vy * p.t + (p.g ? 60 * p.t * p.t : 0); g.fillRect(sx(p.x + p.vx * p.t), sy(yy), p.g ? 2 : 2, p.g ? 2 : 1); }
    g.globalAlpha = 1;
    // 캐릭터
    const S = st.face > 0 ? spr : sprF;
    if (fall) {   // 헛디딤: 놀란 얼굴로 튀어 올랐다가 빙글 떨어짐
      if (st.scene !== 'ready') { fall.vy += dt * 7; fall.x += fall.vx * dt; fall.y -= fall.vy * dt * 1.6; fall.r += dt * 8 * Math.sign(fall.vx); }
      const fx = sx(fall.x * DX), fy = sy(-fall.y * DY);
      g.save(); g.translate(fx, fy - SPR_H * CS / 2); g.rotate(Math.round(fall.r / (Math.PI / 2)) * Math.PI / 2); g.scale(CS, CS);
      g.drawImage(S.dead_rim, -SPR_W / 2 - 1, -SPR_H / 2 - 1); g.drawImage(S.dead, -SPR_W / 2, -SPR_H / 2); g.restore();
    } else {
      const lift = moveT < 1 ? R(Math.sin(moveT * Math.PI) * 4) : 0;
      const kx = sx(cx * DX), ky = sy(-cy * DY) - lift;
      const fr = st.why === 'time' ? 'dead' : moveT < .6 ? 'jump' : st.scene === 'play' || st.scene === 'pause' ? (stepN % 2 ? 'run1' : 'run2') : (Math.floor(t * 2) % 2 ? 'run1' : 'run2');
      if (st.fast && st.scene === 'play') {   // 빠르게 오르는 중: 등 뒤 픽셀 속도선
        g.fillStyle = '#ffffff';
        for (let k = 0; k < 3; k++) { const l = 4 + ((stepN + k * 3) % 5) * 2, yy = ky - 8 - k * 8; g.fillRect(st.face > 0 ? kx - 18 - l : kx + 18, yy, l, 1); }
      }
      g.save(); g.translate(kx, ky); g.scale(CS, CS); g.drawImage(S[fr + '_rim'], -SPR_W / 2 - 1, -SPR_H); g.drawImage(S[fr], -SPR_W / 2, -SPR_H + 1); g.restore();
      if (st.why === 'time') {   // 지각: 머리 위 땀·ZZ 대신 '!'
        const hy = R(ky - SPR_H * CS); g.fillStyle = OL; g.fillRect(kx - 1, hy - 9, 3, 6); g.fillRect(kx - 1, hy - 2, 3, 2); g.fillStyle = '#ff5a5a'; g.fillRect(kx, hy - 8, 1, 4);
      }
    }
    o.onFrame?.(st);
  }
  const vis = () => { if (document.hidden) pause(); };
  const blur = () => pause();
  document.addEventListener('visibilitychange', vis); window.addEventListener('blur', blur);
  reset(); raf = requestAnimationFrame(frame);
  return {
    st, input, reset, pause,
    setChar(c) { o.char = c; loadSpr(); },
    setSound(v) { sound = !!v; if (v) beep(660, .05); },
    destroy() { alive = false; clearTimeout(overT); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', blur); try { ac?.close(); } catch {} },
    get xs() { return xs; },   // 테스트용(정답 방향 확인)
  };
}
