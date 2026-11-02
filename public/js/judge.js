// SVMHS GROUND — 복도의 심판(2026-11-02 하율: "언더테일 몰살 루트 샌즈전을 정말 똑같이 — 저작권 문제 되는 것만 바꿔서, 내 화면에만", 미리보기 깃발 judge-game)
// 원작의 '전투 구조·조작·공격 패턴 방식'만 따름. 캐릭터·이름·대사·음악·그림·효과음은 전부 새로 만듦(원작 에셋·문구 안 씀).
//   원작 → 여기: 해골 → 선도부장(체육복·완장·안경) · 뼈 → 자(30cm 자) · 해골 레이저 포 → 확성기 빔 · 하트 → 별
//   파란 영혼(중력) → 파란 별 · 파란 뼈(움직이면 아픔) → 파란 자 · KR → 벌점 · FIGHT/ACT/ITEM/MERCY → 공격/행동/가방/봐주기
// 흐름(원작과 같음): 독백 → 선공 → [메뉴 → 행동 → 대사 → 공격] 반복 → 중간 봐주기 제안(누르면 함정) → 2막(중간 지점 저장)
//   → 필살기 → 상대가 졸면 상자를 밀어 공격 버튼까지 → 마지막 한 방
// 데미지: 무적 시간 없음 — 닿아 있는 동안 1/30초마다 HP 1 + 벌점(서서히 HP를 깎음, 벌점만으로는 1 아래로 안 내려감)
// 서버·랭킹 없음 → 이 기기 기록만(sg_jd_rec · sg_jd_ck 중간 지점 · sg_jd_snd)
// createJudge(el, O) → { start, destroy, _g(검사용) }
import { store } from './util.js';

const VW = 640, VH = 480, FONT = 'Jua, system-ui, sans-serif';
const MAXHP = 92, SPD = 150, DT = 1 / 60;
const BTN = [{ n: '공격', x: 32 }, { n: '행동', x: 185 }, { n: '가방', x: 345 }, { n: '봐주기', x: 498 }];
const ITEMS0 = [['급식 돈가스', 999, '* 급식 돈가스를 먹었다. 바삭하다!'], ['컵라면', 90, '* 컵라면을 후루룩 먹었다.'], ['떡볶이', 60, '* 떡볶이를 먹었다. 맵다!'], ['소시지빵', 40, '* 소시지빵을 먹었다. 힘이 난다!'],
  ['초코우유', 45, '* 초코우유를 마셨다.'], ['초코우유', 45, '* 초코우유를 마셨다.'], ['바나나우유', 45, '* 바나나우유를 마셨다.'], ['바나나우유', 45, '* 바나나우유를 마셨다.']];
const BLUE = '#2fb8ff';

/* ── 대사 ── */
const INTRO = ['오늘 날씨 진짜 좋다.', '창밖엔 새가 울고, 운동장엔 꽃이 폈고…', '이런 날엔 너 같은 애가…', '복도에서 벌점 받고 반성문 써야 되는데.'];
const AFTER_FIRST = ['어라, 첫 방에 안 쓰러졌네?', '보통 다들 여기서 교무실 가던데.'];
const FLAVOR = ['* 끝이 안 보이는 복도. 종이 울리기 직전이다.', '* 선도부장이 주머니에 손을 넣은 채 하품을 한다.', '* 복도 창문으로 바람이 불어온다.', '* 어디선가 실내화 끄는 소리가 들린다.',
  '* 선도부장이 출석부를 만지작거린다.', '* 벌점 카드가 바닥에 흩어져 있다.', '* 형광등이 깜빡인다.', '* 너는 오늘 하루를 떠올린다… 급식 줄, 매점, 복도.'];
const FLAVOR2 = ['* 진짜 결투다.', '* 선도부장의 숨이 조금 거칠어졌다.', '* 선도부장이 땀을 닦는다.', '* 선도부장이 지쳐 보인다.', '* 선도부장의 눈이 반쯤 감겨 있다.'];
const SPARE_OFFER = ['있잖아. 너 진짜 힘들지?', '나도 힘들어. 그러니까 우리 이쯤 하자.', '봐주기 눌러 봐. 진짜로 그냥 보내 줄게.', '선배 말 믿어 봐.'];
const SPARE_TRAP = ['…진짜 눌렀네.', '미안. 선도부 규칙 1조.', '봐주는 척하고 잡는다.'];
const SPARE_NO = ['그래. 그럴 줄 알았어.', '그럼 지금부터 진짜 시작이다.'];
const FINAL_PRE = ['헉… 헉…', '좋아. 이제 내 필살기 보여 줄 차례야.', '피하든 말든, 이게 마지막이야.'];
const DEATH = ['…아. 결국 이렇게 됐네.', '벌점은… 내일 줄게.', '…매점 갈 거면, 빵 하나만 남겨 둬.'];

/* ── 작은 도구 ── */
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const OPP = { d: 'u', u: 'd', l: 'r', r: 'l' };

/* ── 공격 패턴 (A = 공격 도구, lv = 2막 배율) ── */
function aFirst(A) {
  A.box(220, 130); A.mode('blue', 'd');
  A.at(0, () => A.slam('d')); A.at(0.05, () => A.stab('d', 26, 0.32, 0.7));
  A.at(1.25, () => A.mode('red'));
  A.at(1.35, () => { const B = A.B; A.gb(B.x - 80, B.y + B.h / 2, 0, 1); A.gb(B.x + B.w + 80, B.y + B.h / 2, Math.PI, 1); });
  A.at(2.3, () => { const B = A.B; A.gb(B.x + B.w * .25, B.y - 90, Math.PI / 2, .9); A.gb(B.x + B.w * .75, B.y - 90, Math.PI / 2, .9); });
  A.at(3.2, () => { A.gbAim(170, 1); A.gbAim(170, 1); });
  A.at(4.0, () => { A.gbAim(180, 1.2); });
  A.dur(4.4);
}
function aGap(A, lv = 1) {
  A.box(280, 110); A.mode('blue', 'd'); A.soulAt(.2, 1);
  const n = Math.round(12 * lv), sp = 210 * lv, gap = .5 / lv;
  for (let i = 0; i < n; i++) A.at(i * gap, () => {
    const B = A.B, x = B.x + B.w + 6;
    if (i % 3 === 2) A.r(x, B.y, 10, B.h - 42, -sp, 0);
    else if (i > n * .6 && i % 2) { A.r(x, B.y + B.h - 18, 10, 18, -sp, 0); A.r(x, B.y, 10, B.h - 18 - 52, -sp, 0); }
    else A.r(x, B.y + B.h - 22, 10, 22, -sp, 0);
  });
  A.dur(n * gap + 300 / sp + .2);
}
function aRandBlast(A, lv = 1) {
  A.box(170, 170); A.mode('red');
  const n = Math.round(9 * lv), gap = .45 / lv;
  for (let i = 0; i < n; i++) A.at(i * gap, () => A.gbAim(rnd(150, 190), rnd(.8, 1.1)));
  A.dur(n * gap + 1.4);
}
function aBlueWhite(A, lv = 1) {
  A.box(240, 110); A.mode('blue', 'd'); A.soulAt(.25, 1);
  const pat = [0, 1, 0, 0, 1, 0, 1, 1, 0, 1], sp = 170 * lv, gap = .58 / lv;
  pat.forEach((b, i) => A.at(i * gap, () => {
    const B = A.B, x = B.x + B.w + 6;
    if (b) A.r(x, B.y, 10, B.h, -sp, 0, true); else A.r(x, B.y + B.h - 22, 10, 22, -sp, 0);
  }));
  A.dur(pat.length * gap + 260 / sp + .2);
}
function aPlat(A, lv = 1) {
  A.box(320, 130); A.mode('blue', 'd');
  const sp = 110 * lv, T = 7.5;
  A.at(0, () => { const B = A.B; A.plat(B.x + 10, B.y + B.h - 40, 110, -28); A.soulTo(B.x + 60, B.y + B.h - 40 - 5); });
  A.at(.05, () => A.stab('d', 14, .7, T - .4));
  for (let t = .3, i = 0; t < T - 1.2; t += .85 / lv, i++) A.at(t, () => {
    const B = A.B; A.plat(B.x + B.w + 4, B.y + B.h - 40 - (i % 3 === 1 ? 26 : 0), 72, -sp);
    if (i % 3 === 2) A.r(B.x + B.w + 30, B.y, 10, B.h - 92, -sp, 0);
  });
  A.dur(T);
}
function aRing(A, lv = 1) {
  A.box(160, 160); A.mode('red');
  const cxy = () => [A.B.x + A.B.w / 2, A.B.y + A.B.h / 2];
  for (let k = 0; k < 6; k++) A.at(k * .22 / lv, () => { const [x, y] = cxy(), a = k * Math.PI / 3; A.gb(x + Math.cos(a) * 175, y + Math.sin(a) * 175, a + Math.PI, .85); });
  for (let k = 0; k < 6; k++) A.at(2 / lv + k * .2 / lv, () => A.gbAim(175, .85));
  A.at(3.7 / lv, () => { const [x, y] = cxy(); for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; A.gb(x + Math.cos(a) * 190, y + Math.sin(a) * 190, a + Math.PI, 1.1); } });
  A.dur(3.7 / lv + 1.6);
}
function aSlam(A, lv = 1, n = 6, rand = false) {
  A.box(150, 150); A.mode('blue', 'd');
  const gap = 1.05 / lv; let last = 'u';
  for (let i = 0; i < n; i++) A.at(i * gap, () => {
    let d = rand ? pick(['d', 'l', 'u', 'r'].filter(x => x !== last)) : ['d', 'l', 'u', 'r', 'd', 'u', 'l', 'r'][i % 8];
    last = d; A.slam(d); A.stab(d, 24, .26 / Math.sqrt(lv), .42);
  });
  A.dur(n * gap + .6);
}
function aMaze(A, lv = 1, blue = false) {
  A.box(170, 170); A.mode('red');
  const n = Math.round(10 * lv), gap = .6 / lv, sp = 110 * lv; let g0 = .5;
  for (let i = 0; i < n; i++) A.at(i * gap, () => {
    const B = A.B; g0 = clamp(g0 + rnd(-.35, .35), .18, .82); const gx = B.x + B.w * g0, half = 24, up = i % 2 && lv > 1;
    const y = up ? B.y + B.h + 4 : B.y - 14, vy = up ? -sp : sp, bl = blue && i % 3 === 1;
    if (bl) A.r(B.x, y, B.w, 10, 0, vy, true);
    else { A.r(B.x, y, gx - half - B.x, 10, 0, vy); A.r(gx + half, y, B.x + B.w - gx - half, 10, 0, vy); }
  });
  A.dur(n * gap + 200 / sp);
}
function aSweep(A, lv = 1) {
  A.box(220, 140); A.mode('red'); A.soulAt(.8, .5);
  const n = 10, gap = .62 / lv, sp = 160 * lv;
  for (let i = 0; i < n; i++) A.at(i * gap, () => {
    const B = A.B, x = B.x - 16;
    if (i % 2 === 0) A.r(x, B.y, 10, B.h, sp, 0, true);
    else { const g = B.y + rnd(30, B.h - 30); A.r(x, B.y, 10, g - 22 - B.y, sp, 0); A.r(x, g + 22, 10, B.y + B.h - g - 22, sp, 0); }
  });
  A.dur(n * gap + 240 / sp);
}
function aSine(A, lv = 1) {
  A.box(260, 140); A.mode('red'); A.soulAt(.2, .5);
  const T = 5, sp = 200 * lv, gp = 23;
  for (let t = 0; t < T; t += .1) A.at(t, () => {
    const B = A.B, gc = B.y + B.h / 2 + Math.sin(t * 2.2 * lv) * 40, x = B.x + B.w + 4;
    A.r(x, B.y, 8, gc - gp - B.y, -sp, 0); A.r(x, gc + gp, 8, B.y + B.h - gc - gp, -sp, 0);
  });
  if (lv > 1) for (let k = 0; k < 3; k++) A.at(1.5 + k * 1.2, () => A.gbAim(180, .7));
  A.dur(T + 290 / sp);
}
function aCombo(A, lv = 1) {
  A.box(260, 120); A.mode('blue', 'd'); A.soulAt(.5, 1);
  const T = 7, sp = 190 * lv;
  for (let t = 0; t < T - 1; t += .72 / lv) A.at(t, () => { const B = A.B; A.r(B.x + B.w + 6, B.y + B.h - 20, 10, 20, -sp, 0); });
  for (let t = .6; t < T - 1; t += 1.25 / lv) A.at(t, () => { const B = A.B; A.gb(clamp(A.soul.x, B.x + 10, B.x + B.w - 10), B.y - 95, Math.PI / 2, .8); });
  A.dur(T);
}
function aBig(A, lv = 1) {
  A.box(180, 180); A.mode('red');
  A.at(0, () => A.gb(clamp(A.soul.x, A.B.x, A.B.x + A.B.w), A.B.y - 120, Math.PI / 2, 2));
  A.at(.7, () => A.gbAim(170, .8));
  A.at(1.3, () => A.gb(A.B.x - 130, clamp(A.soul.y, A.B.y, A.B.y + A.B.h), 0, 2));
  A.at(1.9, () => A.gbAim(170, .8));
  A.at(2.6, () => A.gbAim(220, 2));
  A.at(3.2, () => { A.gbAim(170, .8); A.gbAim(170, .8); });
  if (lv > 1) A.at(3.9, () => A.gbAim(220, 2));
  A.dur(lv > 1 ? 5.6 : 4.9);
}
function aSpecial(A) {   // 필살기: 쾅쾅 → 확성기 원 → 쾅쾅(빨라짐) → 소용돌이 → 지쳐서 느려지는 쾅
  A.box(170, 170); A.mode('blue', 'd');
  let t = 0, last = 'u';
  const slam = (gap, w) => { A.at(t, () => { const d = pick(['d', 'l', 'u', 'r'].filter(x => x !== last)); last = d; A.slam(d); A.stab(d, 24, w, .4); }); t += gap; };
  for (let i = 0; i < 10; i++) slam(.85, .25);
  A.at(t, () => A.mode('red')); t += .2;
  for (let r = 0; r < 3; r++) { const o = r * .5; for (let k = 0; k < 6; k++) A.at(t + k * .12, () => { const x = A.B.x + A.B.w / 2, y = A.B.y + A.B.h / 2, a = o + k * Math.PI / 3; A.gb(x + Math.cos(a) * 180, y + Math.sin(a) * 180, a + Math.PI, .8); }); t += 1.5; }
  A.at(t, () => A.mode('blue', 'd')); t += .1;
  for (let i = 0; i < 12; i++) slam(.68, .22);
  A.at(t, () => A.mode('red')); t += .2;
  for (let k = 0; k < 18; k++) A.at(t + k * .17, () => { const x = A.B.x + A.B.w / 2, y = A.B.y + A.B.h / 2, a = k * .62; A.gb(x + Math.cos(a) * 190, y + Math.sin(a) * 190, a + Math.PI, .9); });
  t += 18 * .17 + 1.4;
  A.at(t, () => A.mode('blue', 'd')); t += .1;
  [1, 1.2, 1.45, 1.75, 2.1, 2.6].forEach(g => slam(g, .3));
  A.dur(t + .4);
}
// 순서: 선공 → 1막 12턴 → 봐주기 제안 → 2막 6턴 → 필살기
const P1 = [
  ['너, 오늘 하루 종일 뭐 했는지 알아?', aGap], ['급식 줄 맨 앞부터 맨 뒤까지, 전부 새치기했잖아.', aRandBlast], ['매점 빵도 싹 쓸어 갔고.', aBlueWhite],
  ['애들이 다 배고프다고 울더라.', aPlat], ['솔직히 나도 귀찮아. 선도부 일 같은 거.', aRing], ['근데 말이야… 누군가는 해야 되잖아.', aSlam],
  ['그게 하필 나라서 좀 억울하긴 한데.', aMaze], ['너 지금까지 몇 번 다시 해 봤어?', aSweep], ['…표정 보니까 꽤 많이 했나 보네.', aSine],
  ["나도 알아. 넌 '다시 하기'를 누를 수 있다는 거.", aCombo], ['그러니까 나도 그냥 계속 막을 거야.', A => aSlam(A, 1.15, 8, true)], ['…좋아. 이거 하나만 더.', aBig],
];
const P2 = [
  ['이제 조금 진지하게 갈게.', A => aSine(A, 1.25)], ['근데 나 사실 체력이 별로 안 좋거든.', A => aSlam(A, 1.3, 9, true)], ['체육 시간에도 맨날 구석에서 쉬었어.', A => aRandBlast(A, 1.5)],
  ['그래도 오늘은 좀 뛰어 볼게.', A => aPlat(A, 1.25)], ['급식 당번한테도 이렇게 열심히 한 적 없는데.', A => aMaze(A, 1.3, true)], ['…헉. 헉.', A => aBig(A, 1.3)],
];

export function createJudge(el, O = {}) {
  el.innerHTML = `<div class="jd"><div class="jd-wrap"><canvas class="jd-cv"></canvas>
    <div class="jd-pad" hidden><div class="jd-dp"><button type="button" data-k="U">▲</button><button type="button" data-k="L">◀</button><button type="button" data-k="R">▶</button><button type="button" data-k="D">▼</button></div>
    <div class="jd-ab"><button type="button" data-k="X">취소</button><button type="button" data-k="Z">확인</button></div></div>
    <button type="button" class="jd-ib jd-snd" aria-label="소리"></button></div>
    <p class="jd-bar">방향키 이동 · Z/Enter 확인 · X/Shift 취소(누르고 있으면 천천히) · Esc 멈춤 · 파란 별일 때 ↑ 점프 · 파란 자는 가만히 있으면 안 아픔</p></div>`;
  const wrap = el.querySelector('.jd-wrap'), cv = el.querySelector('.jd-cv'), cx = cv.getContext('2d'), pad = el.querySelector('.jd-pad'), sndB = el.querySelector('.jd-snd');
  let W = 640, H = 480, S = 1, alive = true, raf = 0, last = 0, acc = 0;
  const rec = Object.assign({ best: 0, clear: 0, deaths: 0, fast: 0 }, store.get('jd_rec', {}) || {});
  let snd = store.get('jd_snd', true) !== false;

  /* ── 크기: 4:3 고정 화면을 칸에 맞춰 늘림 ── */
  function fit() {
    const fs = document.fullscreenElement === wrap;
    let w = fs ? innerWidth : Math.min(el.clientWidth || 640, 1100), top = Math.max(8, wrap.getBoundingClientRect().top);
    let h = fs ? innerHeight : Math.max(300, innerHeight - top - 50);
    S = Math.min(w / VW, h / VH); W = Math.round(VW * S); H = Math.round(VH * S);
    const D = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    S *= D;
  }

  /* ── 소리(Web Audio 합성) ── */
  let AC = null, master = null, musOn = false, musT = 0, musStep = 0, noiseBuf = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = snd ? .5 : 0; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * .5, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  }
  function tone(f, d, type = 'square', g = .08, t0 = 0, f2 = 0) {
    if (!AC || !snd) return; const t = AC.currentTime + t0, o = AC.createOscillator(), v = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(v); v.connect(master); o.start(t); o.stop(t + d + .02);
  }
  function noise(d, g = .1, t0 = 0, hp = 800) {
    if (!AC || !snd) return; const t = AC.currentTime + t0, s = AC.createBufferSource(), f = AC.createBiquadFilter(), v = AC.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp; v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f); f.connect(v); v.connect(master); s.start(t); s.stop(t + d + .02);
  }
  const SFX = {
    blip: () => tone(520, .03, 'square', .025), sel: () => tone(880, .06, 'square', .05), ok: () => { tone(660, .05, 'square', .05); tone(990, .07, 'square', .05, .05); },
    hit: () => { tone(180, .08, 'square', .07, 0, 90); noise(.05, .05, 0, 2000); }, slam: () => { tone(90, .18, 'sine', .25, 0, 40); noise(.12, .12, 0, 200); },
    warn: () => tone(1200, .05, 'square', .03), charge: () => tone(200, .4, 'sawtooth', .04, 0, 900), fire: () => { noise(.5, .14, 0, 300); tone(110, .5, 'sawtooth', .06, 0, 70); },
    slash: () => noise(.18, .12, 0, 3000), miss: () => tone(300, .15, 'triangle', .06, 0, 200), heal: () => { [523, 659, 784].forEach((f, i) => tone(f, .1, 'triangle', .08, i * .07)); },
    crack: () => { noise(.1, .2, 0, 1500); tone(140, .2, 'square', .08, 0, 60); }, big: () => { noise(.6, .25, 0, 100); tone(70, .7, 'sawtooth', .15, 0, 30); },
  };
  // 배경 음악(직접 작곡한 루프, E단조 150BPM, 16분음표 단계)
  const n2f = n => 440 * Math.pow(2, (n - 69) / 12);
  const BASS = [40, 36, 38, 35];   // E C D B
  const LEAD = [[76, 0, 79, 0, 81, 0, 83, 0], [0, 0, 79, 0, 76, 0, 74, 0], [78, 0, 81, 0, 86, 0, 84, 83], [83, 0, 0, 0, 75, 0, 78, 0],
    [83, 0, 81, 79, 0, 76, 0, 79], [84, 0, 83, 81, 0, 79, 76, 0], [86, 0, 84, 83, 0, 81, 78, 0], [83, 0, 0, 0, 0, 0, 0, 0]];
  function music() {
    if (!AC || !musOn) return; const st = 60 / 150 / 4;
    while (musT < AC.currentTime + .25) {
      const s = musStep % 128, bar = Math.floor(s / 16), b = s % 16, t0 = musT - AC.currentTime;
      if (snd) {
        if (b % 2 === 0) tone(n2f(BASS[bar % 4] + (b % 4 === 2 ? 12 : 0)), st * 1.8, 'triangle', .12, t0);
        if (b % 2 === 0) { const ln = LEAD[bar][b / 2]; if (ln) tone(n2f(ln), st * 1.7, 'square', .035, t0); }
        if (b % 8 === 0) tone(110, .12, 'sine', .22, t0, 45);
        if (b % 8 === 4) noise(.09, .08, t0, 1500);
        if (b % 2 === 1) noise(.025, .025, t0, 7000);
      }
      musT += st; musStep++;
    }
  }
  function musStart() { if (!ac()) return; if (!musOn) { musOn = true; musT = AC.currentTime + .05; musStep = 0; } }
  function setSnd(v) { snd = v; store.set('jd_snd', v); if (master) master.gain.value = v ? .5 : 0; sndB.textContent = v ? '소리 켬' : '소리 끔'; }
  sndB.onclick = () => { ac(); setSnd(!snd); };
  setSnd(snd);

  /* ── 입력 ── */
  const held = { L: 0, R: 0, U: 0, D: 0, Z: 0, X: 0 }, pr = new Set();
  const KM = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', KeyZ: 'Z', Enter: 'Z', NumpadEnter: 'Z', Space: 'Z', KeyX: 'X', ShiftLeft: 'X', ShiftRight: 'X', KeyC: 'C' };
  const press = k => { if (!held[k]) pr.add(k); held[k] = 1; ac(); };
  function kd(e) {
    if (!alive || e.target?.closest?.('input,textarea')) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); togglePause(); return; }
    const k = KM[e.code]; if (!k) return; e.preventDefault(); if (e.repeat && k !== 'Z') return; press(k);
  }
  function ku(e) { const k = KM[e.code]; if (k) held[k] = 0; }
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  pad.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); press(k); b.classList.add('on'); });
    const up = () => { held[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') pad.hidden = false; ac(); if (st === 'title' || st === 'over' || st === 'end' || paused) press('Z'), setTimeout(() => held.Z = 0, 60); });
  if (matchMedia?.('(pointer:coarse)').matches) pad.hidden = false;

  /* ── 상태 ── */
  let st = 'title', paused = false, T = 0;          // T: 전체 시간
  let hp = MAXHP, kr = 0, krT = 0, hitAcc = -1, items = [], turn = 0, phase = 1, sel = 0, sub = 0, subList = null, subKind = '';
  let runT0 = 0, fromCk = false, trapped = false, menuTxt = '', bossDx = 0, bossDxT = 0, bossFace = 'smile', shake = 0, flash = 0;
  const box = { x: 32, y: 250, w: 576, h: 140, tx: 32, ty: 250, tw: 576, th: 140 };
  const soul = { x: 320, y: 320, mode: 'red', g: 'd', vf: 0, ground: false, slam: false, moved: false, vis: true };
  let hz = [], evs = [], atk = null, at = 0, atkDur = 0, atkEnd = null, plats = [];
  let talkQ = [], talkI = 0, talkN = 0, talkCb = null, talkBlip = 0;   // 말풍선
  let msg = '', msgN = 0, msgCb = null;                               // 상자 글
  let runMs = 0, bar = null, dmgPop = null, deadT = 0, shards = [], endT = 0, sleepZ = 0;

  const setBox = (w, h, cxp = 320, cyp) => { h = Math.min(h, 175); box.tw = w; box.th = h; box.tx = cxp - w / 2; box.ty = cyp == null ? 392 - h : cyp - h / 2; };   // 원작처럼 아래 변을 고정
  const menuBox = () => { box.tx = 32; box.ty = 250; box.tw = 576; box.th = 140; };
  const boxSettled = () => Math.abs(box.x - box.tx) + Math.abs(box.y - box.ty) + Math.abs(box.w - box.tw) + Math.abs(box.h - box.th) < 1;

  function talk(lines, cb, face) { talkQ = lines.slice(); talkI = 0; talkN = 0; talkCb = cb; if (face) bossFace = face; st = 'talk'; }
  function say(text, cb) { msg = text; msgN = 0; msgCb = cb; st = 'msg'; menuBox(); }

  function newRun(ck) {
    hp = MAXHP; kr = 0; items = ITEMS0.map(a => a.slice()); trapped = false; fromCk = !!ck; runT0 = T; bossFace = 'smile'; hz = []; plats = [];
    menuBox(); box.x = box.tx; box.y = box.ty; box.w = box.tw; box.h = box.th; musStart();
    if (ck) { phase = 2; turn = 0; talk(['또 왔네.', '이번엔 바로 진짜부터 하자.'], () => toMenu()); }
    else { phase = 1; turn = 0; talk(INTRO, () => { bossFace = 'dark'; runAttack(aFirst, () => talk(AFTER_FIRST, () => toMenu(), 'smile')); }); }
  }
  function toMenu() {
    st = 'menu'; menuBox(); soul.mode = 'red';
    const pool = phase === 1 ? FLAVOR : FLAVOR2;
    menuTxt = turn === 0 && phase === 1 ? FLAVOR[0] : phase === 3 ? '* 선도부장이 지쳐서 서서 졸고 있다.' : pool[(turn + (phase === 2 ? 0 : 1)) % pool.length];
    msg = menuTxt; msgN = 0;
  }
  // 플레이어 행동이 끝난 뒤 → 상대 차례
  function enemyTurn() {
    if (phase === 1 && turn >= P1.length) {   // 봐주기 제안
      bossFace = 'smile'; talk(SPARE_OFFER, () => { phase = 'offer'; toMenu(); menuTxt = msg = '* 선도부장이 봐주겠다고 한다.'; });
      return;
    }
    if (phase === 'offer') { talk(SPARE_NO, () => { phase = 2; turn = 0; store.set('jd_ck', 1); rec.best = Math.max(rec.best, 13); saveRec(); toMenu(); }, 'dark'); return; }
    if (phase === 2 && turn >= P2.length) {
      bossFace = 'tired'; talk(FINAL_PRE, () => { bossFace = 'dark'; runAttack(aSpecial, () => { phase = 3; bossFace = 'sleep'; rec.best = Math.max(rec.best, 20); saveRec(); startPush(); }); });
      return;
    }
    const L = phase === 1 ? P1 : P2, [line, fn] = L[turn];
    bossFace = phase === 2 && turn >= 3 ? 'tired' : turn % 3 === 2 ? 'dark' : 'smile';
    talk([line], () => runAttack(fn, () => { turn++; rec.best = Math.max(rec.best, phase === 1 ? turn : 13 + turn); saveRec(); toMenu(); }));
  }
  function saveRec() { store.set('jd_rec', rec); }

  /* ── 공격 실행 ── */
  function runAttack(fn, done) {
    hz = []; plats = []; evs = []; at = -.35; atkEnd = done; atkDur = 0; st = 'dodge';
    const A = {
      get B() { return { x: box.tx + 5, y: box.ty + 5, w: box.tw - 10, h: box.th - 10 }; }, soul,
      at: (t, f) => evs.push([t, f]), dur: t => { atkDur = t; },
      box: (w, h) => setBox(w, h), mode: (m, g = 'd') => { soul.mode = m; soul.g = g; soul.vf = 0; soul.slam = false; },
      soulAt: (fx, fy) => { const B = A.B; soul.x = B.x + 6 + (B.w - 12) * fx; soul.y = B.y + 6 + (B.h - 12) * fy; },
      soulTo: (x, y) => { soul.x = x; soul.y = y; soul.vf = 0; },
      slam: d => { soul.mode = 'blue'; soul.g = d; soul.vf = 1150; soul.slam = true; SFX.slam(); },
      r: (x, y, w, h, vx, vy, blue = false) => { if (w > 0 && h > 0) hz.push({ k: 'r', x, y, w, h, vx, vy, blue }); },
      stab: (side, d, warn = .4, hold = .5) => { hz.push({ k: 's', side, d, warn, hold, t: 0 }); SFX.warn(); },
      gb: (x, y, ang, sc = 1) => { hz.push({ k: 'g', x, y, ang, sc, t: 0, f: false }); },
      gbAim: (r, sc = 1) => { const a = Math.random() * Math.PI * 2, x = soul.x + Math.cos(a) * r, y = soul.y + Math.sin(a) * r; hz.push({ k: 'g', x, y, ang: a + Math.PI, sc, t: 0, f: false }); },
      plat: (x, y, w, vx) => plats.push({ x, y, w, vx }),
    };
    setBox(160, 140); soul.mode = 'red'; soul.vf = 0; soul.slam = false;
    fn(A); evs.sort((a, b) => a[0] - b[0]);
    const B = A.B; if (!(soul.x > B.x && soul.x < B.x + B.w && soul.y > B.y && soul.y < B.y + B.h)) { soul.x = B.x + B.w / 2; soul.y = B.y + B.h / 2; }
    if (soul.mode === 'blue' && soul.g === 'd' && !plats.length) soul.y = B.y + B.h - 5;
  }

  /* ── 별(플레이어) 움직임 ── */
  function inner() { return { x: box.x + 5, y: box.y + 5, w: box.w - 10, h: box.h - 10 }; }
  function moveSoul(dt) {
    const B = inner(), r = 5, ox = soul.x, oy = soul.y, sp = SPD * (held.X ? .5 : 1);
    if (soul.mode === 'red') {
      soul.x += ((held.R ? 1 : 0) - (held.L ? 1 : 0)) * sp * dt; soul.y += ((held.D ? 1 : 0) - (held.U ? 1 : 0)) * sp * dt;
    } else {
      const g = soul.g, vert = g === 'd' || g === 'u', sgn = g === 'd' || g === 'r' ? 1 : -1;
      const jumpK = { d: 'U', u: 'D', l: 'R', r: 'L' }[g];
      if (vert) soul.x += ((held.R ? 1 : 0) - (held.L ? 1 : 0)) * sp * dt; else soul.y += ((held.D ? 1 : 0) - (held.U ? 1 : 0)) * sp * dt;
      if (held[jumpK] && soul.ground && !soul.slam) { soul.vf = -300; soul.ground = false; }
      const G = soul.slam ? 0 : soul.vf < 0 && held[jumpK] ? 650 : 1700;
      soul.vf = Math.min(soul.slam ? 1150 : 480, soul.vf + G * dt);
      if (vert) soul.y += sgn * soul.vf * dt; else soul.x += sgn * soul.vf * dt;
      soul.ground = false;
      // 발판(아래 중력일 때만)
      if (g === 'd' && soul.vf >= 0) for (const p of plats) {
        if (soul.x > p.x - 3 && soul.x < p.x + p.w + 3 && oy + r <= p.y + 1 && soul.y + r >= p.y) { soul.y = p.y - r; soul.vf = 0; soul.ground = true; soul.slam = false; soul.x += p.vx * dt; }
      }
    }
    const x0 = B.x + r, x1 = B.x + B.w - r, y0 = B.y + r, y1 = B.y + B.h - r;
    if (soul.mode === 'blue') {
      const g = soul.g, wall = g === 'd' ? soul.y >= y1 : g === 'u' ? soul.y <= y0 : g === 'l' ? soul.x <= x0 : soul.x >= x1;
      if (wall) { if (soul.slam) { shake = .25; } soul.slam = false; soul.vf = 0; soul.ground = true; }
    }
    soul.x = clamp(soul.x, x0, x1); soul.y = clamp(soul.y, y0, y1);
    soul.moved = Math.abs(soul.x - ox) + Math.abs(soul.y - oy) > .05;
  }

  /* ── 위험물 ── */
  const stabRect = (h, B) => {
    const d = h.d * (h.t < h.warn ? 0 : h.t < h.warn + .08 ? (h.t - h.warn) / .08 : h.t < h.warn + .08 + h.hold ? 1 : Math.max(0, 1 - (h.t - h.warn - .08 - h.hold) / .12));
    return h.side === 'd' ? [B.x, B.y + B.h - d, B.w, d] : h.side === 'u' ? [B.x, B.y, B.w, d] : h.side === 'l' ? [B.x, B.y, d, B.h] : [B.x + B.w - d, B.y, d, B.h];
  };
  const GB = { in: .35, ch: .8, fire: 1.3, out: 1.65 };
  function updHz(dt) {
    const B = inner();
    for (const h of hz) {
      if (h.k === 'r') { h.x += h.vx * dt; h.y += h.vy * dt; if (h.x > B.x + B.w + 400 || h.x + h.w < B.x - 400 || h.y > B.y + B.h + 400 || h.y + h.h < B.y - 400) h.dead = 1; }
      else if (h.k === 's') { h.t += dt; if (h.t > h.warn + .2 + h.hold + .1) h.dead = 1; }
      else if (h.k === 'g') { h.t += dt; if (!h.c && h.t > GB.in) { h.c = 1; SFX.charge(); } if (!h.f && h.t > GB.ch) { h.f = true; SFX.fire(); shake = Math.max(shake, .12 * h.sc); } if (h.t > GB.out + .4) h.dead = 1; }
    }
    hz = hz.filter(h => !h.dead);
    for (const p of plats) p.x += p.vx * dt;
    plats = plats.filter(p => p.x + p.w > B.x - 50);
  }
  function touching() {
    const B = inner(), r = 3.5;   // 맞는 범위는 그림보다 작게(원작처럼)
    for (const h of hz) {
      let hit = false;
      if (h.k === 'r') { if (h.blue && !soul.moved) continue; const x0 = Math.max(h.x, B.x), x1 = Math.min(h.x + h.w, B.x + B.w), y0 = Math.max(h.y, B.y), y1 = Math.min(h.y + h.h, B.y + B.h); hit = soul.x + r > x0 && soul.x - r < x1 && soul.y + r > y0 && soul.y - r < y1; }
      else if (h.k === 's') { if (h.t < h.warn + .02) continue; const [x, y, w, hh] = stabRect(h, B); hit = soul.x + r > x && soul.x - r < x + w && soul.y + r > y && soul.y - r < y + hh; }
      else if (h.k === 'g') {
        if (h.t < GB.ch || h.t > GB.out) continue;
        const w = 32 * h.sc * (h.t < GB.fire ? 1 : 1 - (h.t - GB.fire) / (GB.out - GB.fire)), dx = soul.x - h.x, dy = soul.y - h.y;
        const al = dx * Math.cos(h.ang) + dy * Math.sin(h.ang), pe = -dx * Math.sin(h.ang) + dy * Math.cos(h.ang);
        hit = al > 0 && Math.abs(pe) < w / 2 + r; if (hit) return 2;
      }
      if (hit) return 1;
    }
    return 0;
  }
  function damage(kind) {
    if (O._god) return;
    hp -= 1; kr = Math.min(40, kr + (kind === 2 ? 2 : 1)); kr = Math.min(kr, Math.max(0, hp - 1)); flash = .08;
    SFX.hit(); if (hp <= 0) die();
  }
  function krTick(dt) {
    if (kr <= 0) { krT = 0; return; }
    const iv = kr >= 40 ? 1 / 30 : kr >= 30 ? 2 / 30 : kr >= 20 ? 5 / 30 : kr >= 10 ? 15 / 30 : 1;
    krT += dt; while (krT >= iv && kr > 0) { krT -= iv; if (hp > 1) hp--; kr--; }
  }
  function die() {
    hp = 0; kr = 0; st = 'dead'; deadT = 0; musOn = false; shards = []; rec.deaths++; saveRec(); SFX.crack();
  }

  /* ── 막바지: 상자 밀기 ── */
  function startPush() { st = 'push'; setBox(150, 150, 320, 310); soul.mode = 'red'; hz = []; plats = []; msg = '* 선도부장이 지쳐서 서서 졸고 있다.'; }

  /* ── 공격 막대 ── */
  function startBar(final) { st = 'bar'; menuBox(); bar = { t: 0, x: 0, stop: -1, final, done: false }; }
  function barHit() {
    const b = bar; b.stop = b.x; SFX.slash();
    st = 'slash'; b.t2 = 0;
    if (!b.final) { bossDx = 1; bossDxT = 0; }
  }

  /* ── 갱신 ── */
  function step(dt) {
    T += dt;
    // 상자 크기·위치 애니메이션
    const k = Math.min(1, dt * 14); box.x += (box.tx - box.x) * k; box.y += (box.ty - box.y) * k; box.w += (box.tw - box.w) * k; box.h += (box.th - box.h) * k;
    if (shake > 0) shake -= dt; if (flash > 0) flash -= dt;
    if (bossDx) { bossDxT += dt; if (bossDxT > 1.2) { bossDx = 0; } }
    krTick(st === 'dead' || st === 'end' || st === 'title' ? 0 : dt);
    if (musOn) music();
    const P = k2 => pr.has(k2);

    if (st === 'title') {
      const opts = titleOpts(); if (P('U')) { sel = (sel + opts.length - 1) % opts.length; SFX.blip(); } if (P('D')) { sel = (sel + 1) % opts.length; SFX.blip(); }
      if (P('Z')) { SFX.ok(); const o = opts[sel]; if (o.id === 'new') newRun(false); else if (o.id === 'ck') newRun(true); else if (o.id === 'help') st = 'help'; }
    } else if (st === 'help') { if (P('Z') || P('X')) { st = 'title'; SFX.blip(); } }
    else if (st === 'talk') {
      const line = talkQ[talkI] || ''; talkN = Math.min(line.length, talkN + dt * 28);
      if ((talkBlip += dt) > .06 && talkN < line.length) { talkBlip = 0; SFX.blip(); }
      if (P('Z') || P('X')) { if (talkN < line.length) talkN = line.length; else if (++talkI >= talkQ.length) { const cb = talkCb; talkCb = null; cb?.(); } else talkN = 0; }
    } else if (st === 'msg') {
      msgN = Math.min(msg.length, msgN + dt * 32);
      if (P('Z') || P('X')) { if (msgN < msg.length) msgN = msg.length; else { const cb = msgCb; msgCb = null; cb?.(); } }
    } else if (st === 'menu') {
      msgN = Math.min(msg.length, msgN + dt * 32);
      if (P('L')) { sel = (sel + 3) % 4; SFX.blip(); } if (P('R')) { sel = (sel + 1) % 4; SFX.blip(); }
      if (P('Z')) {
        SFX.sel();
        if (sel === 0) { subKind = 'fight'; subList = ['선도부장']; sub = 0; st = 'sub'; }
        else if (sel === 1) { subKind = 'act'; subList = ['선도부장']; sub = 0; st = 'sub'; }
        else if (sel === 2) { if (!items.length) { SFX.miss(); } else { subKind = 'item'; subList = items.map(i => i[0]); sub = 0; st = 'sub'; } }
        else { subKind = 'mercy'; subList = ['봐주기']; sub = 0; st = 'sub'; }
      }
    } else if (st === 'sub') {
      const n = subList.length, cols = subKind === 'item' ? 2 : 1;
      if (P('U')) { sub = (sub - cols + n) % n; SFX.blip(); } if (P('D')) { sub = (sub + cols) % n; SFX.blip(); }
      if (cols === 2 && P('L')) { sub = sub - 1 < 0 ? n - 1 : sub - 1; SFX.blip(); } if (cols === 2 && P('R')) { sub = (sub + 1) % n; SFX.blip(); }
      if (P('X')) { st = 'menu'; SFX.blip(); }
      else if (P('Z')) {
        SFX.sel();
        if (subKind === 'fight') startBar(false);
        else if (subKind === 'act') {
          if (subList[0] === '선도부장') { subList = ['살펴보기']; sub = 0; }
          else say('* 선도부장 — 공격 1 · 방어 1.\n* 전교에서 제일 만만한 선배. 한 번에 1밖에 못 깎는다.', () => enemyTurn());
        } else if (subKind === 'item') {
          const it = items.splice(sub, 1)[0], before = hp; hp = Math.min(MAXHP, hp + it[1]); kr = Math.min(kr, Math.max(0, hp - 1)); SFX.heal();
          say(it[2] + '\n* ' + (hp >= MAXHP ? 'HP가 가득 찼다.' : `HP가 ${hp - before} 회복됐다.`), () => enemyTurn());
        } else {
          if (phase === 'offer') {   // 원작처럼 봐주기는 함정 — 별 둘레에서 확성기 8개가 한꺼번에(사실상 못 피함)
            trapped = true; bossFace = 'dark';
            talk(SPARE_TRAP, () => runAttack(A => { A.box(120, 120); A.mode('red'); A.at(0, () => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; A.gb(A.soul.x + Math.cos(a) * 150, A.soul.y + Math.sin(a) * 150, a + Math.PI, 1.8); } }); A.dur(2.4); },
              () => { phase = 2; turn = 0; store.set('jd_ck', 1); toMenu(); }));
          }
          else say('* 선도부장을 봐주려 했다.\n* …선도부장은 봐줄 생각이 없다.', () => enemyTurn());
        }
      }
    } else if (st === 'bar') {
      bar.t += dt; bar.x = bar.t / 1.5;
      if (P('Z') || bar.x >= 1) barHit();
    } else if (st === 'slash') {
      bar.t2 += dt;
      if (bar.final) {
        if (bar.t2 > .6 && !dmgPop) { dmgPop = { t: 0 }; SFX.big(); shake = .5; bossFace = 'hurt'; }
        if (dmgPop) dmgPop.t += dt;
        if (bar.t2 > 2.6) { dmgPop = null; st = 'ending'; talk(DEATH, () => { st = 'leave'; endT = 0; }, 'hurt'); }
      } else if (bar.t2 > 1.4) { SFX.miss(); bar = null; enemyTurn(); }
    } else if (st === 'dodge') {
      at += dt;
      while (evs.length && evs[0][0] <= at) evs.shift()[1]();
      moveSoul(dt); updHz(dt);
      const tk = touching();
      if (tk) { if (hitAcc < 0) { hitAcc = 0; damage(tk); } else { hitAcc += dt; if (hitAcc >= 1 / 30) { hitAcc -= 1 / 30; damage(tk); } } } else hitAcc = -1;   // 닿은 순간 1 + 닿아 있는 동안 1/30초마다
      if (st === 'dodge' && at >= atkDur && !evs.length && !hz.some(h => h.k === 'g')) { const cb = atkEnd; atkEnd = null; hz = []; plats = []; cb?.(); }
    } else if (st === 'push') {
      sleepZ += dt;
      moveSoul(dt);
      const B = inner();
      if (held.L && soul.x <= B.x + 6) { box.tx -= 45 * dt; box.x = box.tx; }
      if (box.tx <= 36) { box.tx = 32; startBar(true); bossFace = 'sleep'; }
    } else if (st === 'leave') {
      endT += dt; if (endT > 2.2) { st = 'end'; endT = 0; musOn = false; rec.clear++; const tm = Math.round((T - runT0) * 1000); runMs = tm; if (!fromCk && (!rec.fast || tm < rec.fast)) rec.fast = tm; rec.best = 21; saveRec(); store.set('jd_ck', 0); }
    } else if (st === 'end') { endT += dt; if (endT > 1 && P('Z')) { st = 'title'; sel = 0; } }
    else if (st === 'dead') {
      deadT += dt;
      if (deadT > .9 && !shards.length) { for (let i = 0; i < 6; i++) shards.push({ x: soul.x, y: soul.y, vx: rnd(-120, 120), vy: rnd(-220, -60), r: rnd(0, 6) }); SFX.crack(); }
      for (const s of shards) { s.vy += 500 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 6; }
      if (deadT > 2.4 && P('Z')) { st = 'title'; sel = 0; }
    }
    pr.clear();
  }
  function titleOpts() {
    const o = [{ id: 'new', n: '처음부터 결투' }];
    if (store.get('jd_ck', 0)) o.push({ id: 'ck', n: '중간 지점부터' });
    o.push({ id: 'help', n: '조작법' });
    if (sel >= o.length) sel = 0;
    return o;
  }

  /* ── 그리기 ── */
  const X = cx;
  function txt(s, x, y, size = 20, col = '#fff', al = 'left', w = 400) { X.font = `${size}px ${FONT}`; X.fillStyle = col; X.textAlign = al; X.textBaseline = 'top'; X.fillText(s, x, y, w); }
  function drawStar(x, y, r, col) {
    X.save(); X.translate(x, y); X.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .48 : r; X.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    X.closePath(); X.fillStyle = col; X.fill(); X.restore();
  }
  function drawBoss(x, y) {
    const breathe = Math.sin(T * 2.2) * 1.5, f = bossFace, slp = f === 'sleep';
    let dx = 0; if (bossDx) { const p = bossDxT; dx = p < .2 ? ease(p / .2) * 70 : p < .9 ? 70 : 70 * (1 - ease((p - .9) / .3)); }
    if (st === 'leave') { dx = endT * 140; X.globalAlpha = Math.max(0, 1 - endT / 2); }
    X.save(); X.translate(x + dx, y + (slp ? Math.sin(T * 1.2) * 2 : 0));
    X.lineWidth = 3; X.strokeStyle = '#11131f'; X.lineJoin = 'round';
    // 다리·신발
    X.fillStyle = '#26315e'; X.fillRect(-20, 52, 17, 46); X.fillRect(3, 52, 17, 46); X.strokeRect(-20, 52, 17, 46); X.strokeRect(3, 52, 17, 46);
    X.fillStyle = '#f2f2f2'; X.fillRect(-23, 96, 22, 9); X.fillRect(1, 96, 22, 9); X.strokeRect(-23, 96, 22, 9); X.strokeRect(1, 96, 22, 9);
    // 몸통(체육복)
    X.save(); X.translate(0, breathe);
    X.fillStyle = '#2f4a9a'; X.beginPath(); X.roundRect(-34, -8, 68, 64, 12); X.fill(); X.stroke();
    X.strokeStyle = '#fff'; X.lineWidth = 2; X.beginPath(); X.moveTo(0, -6); X.lineTo(0, 54); X.stroke();
    X.fillStyle = '#fff'; X.fillRect(-34, 6, 5, 46); X.fillRect(29, 6, 5, 46);
    // 팔(주머니에 손)
    X.strokeStyle = '#11131f'; X.lineWidth = 3; X.fillStyle = '#2f4a9a';
    X.beginPath(); X.roundRect(-46, -2, 16, 46, 7); X.fill(); X.stroke(); X.beginPath(); X.roundRect(30, -2, 16, 46, 7); X.fill(); X.stroke();
    X.fillStyle = '#e8384f'; X.fillRect(-47, 8, 18, 12); X.strokeRect(-47, 8, 18, 12);
    X.font = `9px ${FONT}`; X.fillStyle = '#fff'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('선도', -38, 14.5);
    // 머리
    X.fillStyle = '#ffdcbc'; X.beginPath(); X.arc(0, -34, 28, 0, Math.PI * 2); X.fill(); X.stroke();
    X.fillStyle = '#1d1d2b'; X.beginPath(); X.arc(0, -38, 29, Math.PI * 1.02, Math.PI * 1.98); X.lineTo(22, -40); X.lineTo(10, -48); X.lineTo(-2, -42); X.lineTo(-14, -48); X.lineTo(-26, -40); X.closePath(); X.fill();
    // 안경
    X.strokeStyle = '#11131f'; X.lineWidth = 2.2; X.strokeRect(-20, -36, 15, 11); X.strokeRect(5, -36, 15, 11); X.beginPath(); X.moveTo(-5, -31); X.lineTo(5, -31); X.stroke();
    X.lineWidth = 2.4;
    if (f === 'dark') { X.fillStyle = 'rgba(255,255,255,.95)'; X.fillRect(-19, -35, 13, 9); X.fillRect(6, -35, 13, 9); X.fillStyle = BLUE; X.globalAlpha *= .6 + .4 * Math.sin(T * 9); X.fillRect(6, -35, 13, 9); X.globalAlpha = st === 'leave' ? Math.max(0, 1 - endT / 2) : 1; }
    else if (f === 'smile') { X.beginPath(); X.arc(-12.5, -29, 4, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); X.beginPath(); X.arc(12.5, -29, 4, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
    else if (f === 'sleep') { X.beginPath(); X.moveTo(-17, -30); X.lineTo(-8, -30); X.moveTo(8, -30); X.lineTo(17, -30); X.stroke(); }
    else { X.fillStyle = '#11131f'; X.beginPath(); X.arc(-12.5, -30, 2, 0, 7); X.arc(12.5, -30, 2, 0, 7); X.fill(); }
    // 입
    X.beginPath();
    if (f === 'hurt') { X.moveTo(-6, -16); X.lineTo(6, -16); }
    else if (f === 'sleep') { X.arc(0, -15, 3, 0, Math.PI * 2); }
    else { X.moveTo(-8, -17); X.quadraticCurveTo(0, f === 'tired' ? -16 : -12, 9, -18); }
    X.stroke();
    if (f === 'tired' || f === 'hurt') { X.fillStyle = '#8fd6ff'; X.beginPath(); X.moveTo(24, -46); X.quadraticCurveTo(30, -36, 24, -34); X.quadraticCurveTo(18, -36, 24, -46); X.fill(); }
    X.restore(); X.restore();
    if (slp) for (let i = 0; i < 3; i++) { const p = (sleepZ * .6 + i / 3) % 1; X.globalAlpha = 1 - p; txt('Z', x + 30 + p * 30, y - 70 - p * 40, 14 + p * 10, '#cfd6ff'); X.globalAlpha = 1; }
  }
  function drawRuler(x, y, w, h, blue) {
    X.fillStyle = blue ? BLUE : '#f6f6f6'; X.fillRect(x, y, w, h);
    X.fillStyle = blue ? '#0b5f8c' : '#7d7d7d';
    if (h >= w) for (let yy = y + 3, i = 0; yy < y + h - 2; yy += 5, i++) X.fillRect(x, yy, i % 2 ? 3 : 5, 1);
    else for (let xx = x + 3, i = 0; xx < x + w - 2; xx += 5, i++) X.fillRect(xx, y, 1, i % 2 ? 3 : 5);
  }
  function drawGb(h) {
    const t = h.t, sc = h.sc;
    let px = h.x, py = h.y, rot = h.ang;
    if (t < GB.in) { const p = ease(t / GB.in); px = h.x - Math.cos(h.ang) * (1 - p) * 140; py = h.y - Math.sin(h.ang) * (1 - p) * 140; rot = h.ang + (1 - p) * 1.4; }
    if (t > GB.fire) { const p = (t - GB.fire) / .6; px = h.x - Math.cos(h.ang) * p * p * 300; py = h.y - Math.sin(h.ang) * p * p * 300; }
    // 빔
    if (t >= GB.ch && t < GB.out) {
      const w = 32 * sc * (t < GB.fire ? 1 + .08 * Math.sin(t * 60) : 1 - (t - GB.fire) / (GB.out - GB.fire));
      X.save(); X.translate(h.x, h.y); X.rotate(h.ang);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(10 * sc, -w / 2 - 4, 1400, w + 8);
      X.fillStyle = '#fff'; X.fillRect(10 * sc, -w / 2, 1400, w); X.restore();
    }
    X.save(); X.translate(px, py); X.rotate(rot); X.scale(sc, sc);
    X.lineWidth = 2.5; X.strokeStyle = '#11131f';
    X.fillStyle = '#d6dbe8'; X.beginPath(); X.roundRect(-34, -6, 12, 12, 3); X.fill(); X.stroke();   // 손잡이
    X.fillStyle = '#f4f4f4'; X.beginPath(); X.moveTo(-24, -9); X.lineTo(10, -24); X.lineTo(10, 24); X.lineTo(-24, 9); X.closePath(); X.fill(); X.stroke();
    X.fillStyle = t > GB.in && t < GB.out ? (t < GB.ch ? `rgba(120,200,255,${.4 + .6 * ((t - GB.in) / (GB.ch - GB.in))})` : '#fff') : '#3a3f55';
    X.beginPath(); X.ellipse(10, 0, 5, 24, 0, 0, Math.PI * 2); X.fill(); X.stroke();
    X.fillStyle = '#e8384f'; X.fillRect(-14, -12, 6, 24);
    X.restore();
  }
  function drawBox() {
    X.fillStyle = '#000'; X.fillRect(box.x, box.y, box.w, box.h);
    X.strokeStyle = '#fff'; X.lineWidth = 4; X.strokeRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
  }
  function drawHud() {
    const y = 404;
    txt('나', 32, y, 20); txt('LV 19', 90, y, 20);
    txt('HP', 222, y + 3, 14);
    const bw = MAXHP * 1.2, bx = 250;
    X.fillStyle = '#c81e2e'; X.fillRect(bx, y, bw, 20);
    X.fillStyle = '#ff2fd6'; X.fillRect(bx, y, Math.max(0, hp) * 1.2, 20);
    X.fillStyle = '#ffe14a'; X.fillRect(bx, y, Math.max(0, hp - kr) * 1.2, 20);
    txt('벌점', bx + bw + 10, y + 3, 14, kr ? '#ff2fd6' : '#fff');
    txt(`${Math.max(0, hp)} / ${MAXHP}`, bx + bw + 52, y, 20, kr ? '#ff2fd6' : '#fff');
    for (let i = 0; i < 4; i++) {
      const b = BTN[i], on = (st === 'menu' || (st === 'sub' && i === sel)) && i === sel, x = b.x, by = 432;
      X.strokeStyle = on ? '#ffe14a' : '#ff8a1e'; X.lineWidth = 3; X.strokeRect(x, by, 110, 40);
      txt(b.n, x + 63, by + 9, 20, on ? '#ffe14a' : '#ff8a1e', 'center');
      if (on && st === 'menu') drawStar(x + 18, by + 20, 9, '#ff3b4e');
      else drawIcon(i, x + 18, by + 20, on ? '#ffe14a' : '#ff8a1e');
    }
  }
  function drawIcon(i, x, y, c) {
    X.strokeStyle = c; X.lineWidth = 2.5; X.beginPath();
    if (i === 0) { X.moveTo(x - 7, y + 7); X.lineTo(x + 7, y - 7); X.moveTo(x - 4, y - 1); X.lineTo(x + 1, y + 4); }
    else if (i === 1) { X.arc(x, y - 2, 4, 0, 7); X.moveTo(x - 7, y + 8); X.quadraticCurveTo(x, y, x + 7, y + 8); }
    else if (i === 2) { X.rect(x - 7, y - 4, 14, 11); X.moveTo(x - 3, y - 4); X.lineTo(x - 3, y - 8); X.lineTo(x + 3, y - 8); X.lineTo(x + 3, y - 4); }
    else { X.moveTo(x - 7, y + 7); X.lineTo(x + 7, y - 7); X.moveTo(x - 7, y - 7); X.lineTo(x + 7, y + 7); }
    X.stroke();
  }
  function wrapText(s, x, y, size, n) {
    const shown = s.slice(0, Math.floor(n)); const lines = shown.split('\n');
    lines.forEach((l, i) => txt(l, x, y + i * (size + 10), size, '#fff', 'left', 540));
  }
  function bubble(s, n, bx, by) {
    const w = 230, lines = []; let cur = ''; const shown = s.slice(0, Math.floor(n));
    X.font = `17px ${FONT}`;
    for (const ch of shown) { if (X.measureText(cur + ch).width > w - 26) { lines.push(cur); cur = ch; } else cur += ch; }
    lines.push(cur);
    const h = Math.max(54, 20 + 24 * Math.max(2, lines.length));
    X.fillStyle = '#fff'; X.beginPath(); X.roundRect(bx, by, w, h, 10); X.fill();
    X.beginPath(); X.moveTo(bx, by + 22); X.lineTo(bx - 14, by + 30); X.lineTo(bx, by + 36); X.fill();
    lines.forEach((l, i) => txt(l, bx + 13, by + 12 + i * 24, 17, '#11131f'));
  }
  function render() {
    X.setTransform(S, 0, 0, S, 0, 0);
    X.fillStyle = '#000'; X.fillRect(0, 0, VW, VH);
    if (shake > 0) X.translate(rnd(-3, 3), rnd(-3, 3));
    if (st === 'title' || st === 'help') return renderTitle();
    if (st === 'end') return renderEnd();
    if (st !== 'dead') drawBoss(320, 106);
    drawBox();
    // 상자 안
    X.save(); X.beginPath(); X.rect(box.x + 4, box.y + 4, box.w - 8, box.h - 8); X.clip();
    if (st === 'dodge' || st === 'push') {
      for (const p of plats) { X.fillStyle = '#5fd38a'; X.fillRect(p.x, p.y, p.w, 5); X.fillStyle = '#2e8a52'; X.fillRect(p.x, p.y + 5, p.w, 2); }
      const B = inner();
      for (const h of hz) {
        if (h.k === 'r') drawRuler(h.x, h.y, h.w, h.h, h.blue);
        else if (h.k === 's') {
          if (h.t < h.warn) { const [x, y, w, hh] = (() => { const d = h.d; return h.side === 'd' ? [B.x, B.y + B.h - d, B.w, d] : h.side === 'u' ? [B.x, B.y, B.w, d] : h.side === 'l' ? [B.x, B.y, d, B.h] : [B.x + B.w - d, B.y, d, B.h]; })();
            if (Math.floor(h.t * 16) % 2 === 0) { X.strokeStyle = '#ff3b4e'; X.lineWidth = 2; X.strokeRect(x + 1, y + 1, w - 2, hh - 2); } }
          else { const [x, y, w, hh] = stabRect(h, B); const vert = h.side === 'd' || h.side === 'u';
            if (vert) for (let xx = x; xx < x + w; xx += 12) drawRuler(xx + 1, y, 8, hh, false); else for (let yy = y; yy < y + hh; yy += 12) drawRuler(x, yy + 1, w, 8, false); }
        }
      }
    }
    if (st === 'menu' || st === 'msg') wrapText(msg, 56, 274, 22, msgN);
    if (st === 'sub') {
      const cols = subKind === 'item' ? 2 : 1;
      subList.forEach((s, i) => { const cx2 = 90 + (i % cols) * 250, cy2 = 270 + Math.floor(i / cols) * 30; txt('* ' + s, cx2, cy2, 21); if (i === sub) drawStar(cx2 - 20, cy2 + 12, 9, '#ff3b4e'); });
    }
    if (st === 'bar' || st === 'slash') {
      const bx = box.x + 14, bw = box.w - 28, by = box.y + 14, bh = box.h - 28;
      X.strokeStyle = '#fff'; X.lineWidth = 2;
      for (let i = 0; i < 6; i++) { X.beginPath(); X.ellipse(320, by + bh / 2, 18 + i * 46, bh / 2 - 4, 0, 0, Math.PI * 2); X.globalAlpha = .25 + i * .08; X.stroke(); }
      X.globalAlpha = 1; X.fillStyle = '#fff'; X.fillRect(318, by + 4, 4, bh - 8);
      const cxp = bx + (bar.stop >= 0 ? bar.stop : bar.x) * bw;
      X.fillStyle = st === 'slash' && Math.floor(bar.t2 * 12) % 2 ? '#ffe14a' : '#fff'; X.fillRect(cxp - 4, by, 8, bh); X.strokeStyle = '#000'; X.strokeRect(cxp - 4, by, 8, bh);
    }
    X.restore();
    if (st === 'dodge') for (const h of hz) if (h.k === 'g') drawGb(h);
    if (st === 'slash') {
      const p = Math.min(1, bar.t2 / .4); X.strokeStyle = '#ff3b4e'; X.lineWidth = 6;
      if (p < 1) { X.beginPath(); X.moveTo(290, 80); X.lineTo(290 + 60 * p, 80 + 90 * p); X.stroke(); }
      if (!bar.final && bar.t2 > .35) txt('빗나감', 400 + 40, 70, 30, '#c0c0c0', 'center');
      if (bar.final && dmgPop) { txt('999999', 320, 40 - Math.min(20, dmgPop.t * 60), 40, '#ff3b4e', 'center'); X.fillStyle = '#c81e2e'; X.fillRect(250, 92, 140, 12); X.fillStyle = '#5fd38a'; X.fillRect(250, 92, 140 * Math.max(0, 1 - dmgPop.t), 12); }
    }
    if (st === 'talk' || st === 'ending') bubble(talkQ[talkI] || '', talkN, 372, 60);
    // 별
    if ((st === 'dodge' || st === 'push') && soul.vis) drawStar(soul.x, soul.y, 9, soul.mode === 'blue' ? BLUE : '#ff3b4e');
    if (st === 'dead') {
      if (deadT < .9) drawStar(soul.x, soul.y, 9, deadT > .4 ? '#a51a2a' : '#ff3b4e');
      for (const s of shards) { X.save(); X.translate(s.x, s.y); X.rotate(s.r); X.fillStyle = '#ff3b4e'; X.fillRect(-3, -3, 6, 6); X.restore(); }
      if (deadT > 1.8) { X.globalAlpha = Math.min(1, (deadT - 1.8) * 2); txt('결투 실패', 320, 150, 54, '#fff', 'center'); txt(trapped ? '선배 말은 다 믿으면 안 돼…' : '아직 쉬는 시간이 남았어. 다시 해 보자!', 320, 230, 20, '#cfd6ff', 'center'); txt('Z / 탭: 처음 화면', 320, 300, 16, '#8890b0', 'center'); X.globalAlpha = 1; }
    }
    if (st !== 'dead') drawHud();
    if (flash > 0) { X.fillStyle = 'rgba(255,0,0,.12)'; X.fillRect(0, 0, VW, VH); }
    if (paused) { X.setTransform(S, 0, 0, S, 0, 0); X.fillStyle = 'rgba(0,0,0,.7)'; X.fillRect(0, 0, VW, VH); txt('일시정지', 320, 190, 40, '#fff', 'center'); txt('Esc / 탭으로 계속', 320, 250, 18, '#cfd6ff', 'center'); }
  }
  function renderTitle() {
    drawBoss(320, 150);
    txt('복도의 심판', 320, 262, 44, '#fff', 'center');
    if (st === 'help') {
      ['방향키 / 화면 패드: 별 움직이기 · X 누르고 있으면 천천히', 'Z / Enter: 확인 · X: 취소', '빨간 별: 자유롭게 움직임 · 파란 별: 중력! ↑로 점프', '파란 자: 가만히 있으면 안 아픔 · 흰 자: 무조건 피하기', '빨간 테두리 경고 → 자가 솟아오름 · 확성기: 빔 방향 피하기', '닿아 있는 동안 계속 깎이고, 벌점은 HP를 천천히 깎음']
        .forEach((l, i) => txt(l, 320, 318 + i * 24, 16, '#cfd6ff', 'center', 600));
      txt('Z: 돌아가기', 320, 462, 14, '#8890b0', 'center'); return;
    }
    const o = titleOpts();
    o.forEach((x, i) => { txt(x.n, 320, 320 + i * 34, 24, i === sel ? '#ffe14a' : '#fff', 'center'); if (i === sel) drawStar(320 - X.measureText(x.n).width / 2 - 22, 333 + i * 34, 9, '#ff3b4e'); });
    const best = rec.clear ? `승리 ${rec.clear}번 · 가장 빠른 승리 ${fmtT(rec.fast)}` : `가장 멀리 간 곳 ${rec.best ? (rec.best >= 20 ? '마지막 한 방 앞' : rec.best > 13 ? `2막 ${rec.best - 13}턴` : `1막 ${rec.best}턴`) : '—'}`;
    txt(`${best} · 쓰러진 횟수 ${rec.deaths}`, 320, 440, 14, '#8890b0', 'center', 600);
  }
  const fmtT = ms => ms ? `${Math.floor(ms / 60000)}분 ${Math.floor(ms / 1000) % 60}초` : '—';
  function renderEnd() {
    txt('결투 승리', 320, 150, 54, '#ffe14a', 'center');
    txt('선도부장은 하품을 하며 복도 끝으로 사라졌다.', 320, 230, 20, '#fff', 'center', 600);
    txt(`걸린 시간 ${fmtT(runMs)}${fromCk ? ' (중간 지점부터)' : ''} · 지금까지 쓰러진 횟수 ${rec.deaths}`, 320, 270, 16, '#cfd6ff', 'center', 600);
    if (endT > 1) txt('Z / 탭: 처음 화면', 320, 330, 16, '#8890b0', 'center');
  }

  /* ── 루프 ── */
  function togglePause() { if (st === 'title' || st === 'end' || st === 'dead') return; paused = !paused; held.L = held.R = held.U = held.D = held.Z = held.X = 0; }
  const vis = () => { if (document.hidden && !paused && st !== 'title' && st !== 'end' && st !== 'dead') togglePause(); };
  const blur = () => { if (!paused && (st === 'dodge' || st === 'push')) togglePause(); };
  document.addEventListener('visibilitychange', vis); addEventListener('blur', blur); addEventListener('resize', fit);
  function loop(ts) {
    if (!alive) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (ts - last) / 1000 || 0); last = ts;
    if (paused) { if (pr.has('Z')) { paused = false; } pr.clear(); }
    else { acc += dt * (O._speed || 1); let n = 0; while (acc >= DT && n++ < 30) { step(DT); acc -= DT; } if (n >= 30) acc = 0; }
    render();
  }
  return {
    start() { fit(); last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); musOn = false;
      document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku);
      document.removeEventListener('visibilitychange', vis); removeEventListener('blur', blur); removeEventListener('resize', fit);
      try { AC?.close(); } catch {}
    },
    _g: { get st() { return st; }, get hp() { return hp; }, get turn() { return turn; }, get phase() { return phase; }, step, newRun, press, held, enemyTurn, soul, box,
      jump(ph, t) { phase = ph; turn = t; }, set god(v) { O._god = v; } },
  };
}
