// SVMHS GROUND — 복도의 심판(2026-11-02 하율: "언더테일 몰살 루트 샌즈전을 정말 똑같이 — 저작권 문제 되는 것만 바꿔서", 미리보기 깃발 judge-game)
// 2차(같은 날 하율 "물리엔진부터 패턴까지 완전 똑같이, 연출도, 도트로, 캐릭터는 제대로"):
//   원작 보스전의 수치를 그대로 옮김 — 별(영혼) 속도 150(X 누르면 75)px/초, 파란 별 점프 180·손 떼면 −30으로 끊김·속도 구간별 중력(540/180/450/180)·최대 낙하 750,
//   내려꽂기(330 이상이면 쿵+흔들림), 맞는 판정 = 별 가운데 점이 공격 안에 있을 때 1/30초마다 HP 1 + 벌점(자 6→2, 확성기 10→2, 최대 40, HP−1까지),
//   벌점은 40/30/20/10/그 아래일 때 1/30·2/30·5/30·15/30·1초마다 HP 1, 상자 크기 480px/초, 확성기(날아와 자리 잡기 → 대기 → 쏘기 → 물러나며 가속).
//   공격 순서·타이밍·위치 = judge-data.js 스크립트(원작 공격 24종을 줄 단위로 재현), 공격은 '반항'(원작의 FIGHT)을 해야만 다음으로 넘어감(다른 행동은 같은 공격 반복).
//   1막 12턴 → 13번째에 쉬면서 봐주기 제안(누르면 함정) → 2막(메뉴에도 자가 찌름, 중간 지점 저장) → 필살기 → 선도부장이 졸면 상자를 밀어 '공격'까지 → 마지막 한 방.
// 캐릭터·대사·그림·음악·효과음은 전부 새로 만듦(원작 파일·문구 안 씀). 그림 = judge-art.js(도트), 글꼴 = 갈무리(OFL, /fonts).
// 서버·랭킹 없음 → 이 기기 기록만(sg_jd_rec · sg_jd_ck 중간 지점 · sg_jd_snd)
import { store } from './util.js';
import { SCRIPTS } from './judge-data.js';
import { buildArt } from './judge-art.js';

const VW = 640, VH = 480, DT = 1 / 60, MAXHP = 92;
const F11 = '"JdGalmuri11", "Galmuri11", Jua, monospace', F9 = '"JdGalmuri9", "Galmuri9", Jua, monospace';
const ORANGE = '#ff7f27', YELLOW = '#ffff00', BLUECOL = '#14a9ff', ORANGECOL = '#ffa040';
const MENU_ZONE = [33, 251, 608, 391];
const BTNS = [{ n: '반항', x: 32 }, { n: '행동', x: 184 }, { n: '가방', x: 344 }, { n: '자비', x: 496 }];
const ITEMS0 = [['돈가스', 99, '급식 돈가스'], ['컵라면', 90, '컵라면'], ['떡볶이', 60, '떡볶이'], ['소시지빵', 40, '소시지빵'], ['소시지빵', 40, '소시지빵'], ['소시지빵', 40, '소시지빵'], ['소시지빵', 40, '소시지빵'], ['소시지빵', 40, '소시지빵']];
// 공격 순서(원작과 같은 자리): 0 = 선공, 1~13 1막, 14~22 2막, 23 필살기
const P1 = ['intro', 'bonegap1', 'bluebone', 'bonegap2', 'platforms1', 'platforms2', 'platforms3', 'platforms4', 'platformblaster', 'platforms4hard', 'bonegap1fast', 'boneslideh', 'bonegap2', 'platformblasterfast'];
const P2 = ['multi1', 'randomblaster1', 'multi2', 'bonestab1', 'bonestab2', 'randomblaster2', 'boneslidev', 'multi3', 'bonestab3'];
/* ── 대사(전부 새로 씀) ── */
const INTRO = [['오늘 날씨 진짜 좋다.', 'closed'], ['창밖엔 새가 울고, 운동장엔 꽃이 폈고…', 'closed'], ['이런 날엔 너 같은 애가…', 'closed'], ['복도에서 벌점 받고 반성문 써야 되는데.', 'noeyes', 'slow']];
const LINES = {
  1: ['너, 오늘 하루 종일 뭐 했는지 알아?'], 2: ['급식 줄 맨 앞부터 맨 뒤까지 전부 새치기했잖아.'], 3: ['매점 빵도 싹 쓸어 갔고.'], 4: ['애들이 다 배고프다고 울더라.'],
  5: ['솔직히 나도 귀찮아. 선도부 일 같은 거.'], 6: ['근데 말이야… 누군가는 해야 되잖아.'], 7: ['그게 하필 나라서 좀 억울하긴 한데.'], 8: ['너 지금까지 몇 번 다시 해 봤어?'],
  9: ['…표정 보니까 꽤 많이 했나 보네.'], 10: ["나도 알아. 넌 '다시 하기'를 누를 수 있다는 거."], 11: ['그러니까 나도 그냥 계속 막을 거야.'], 12: ['…좋아. 이것만 버티면 잠깐 쉬자.'],
  13: ['있잖아. 너 진짜 힘들지?', '나도 힘들어. 그러니까 우리 이쯤 하자.', '자비 눌러서 봐주기 해 봐. 진짜로 그냥 보내 줄게.', '선배 말 믿어 봐.'],
  14: ['그래. 그럴 줄 알았어.', '그럼 지금부터 진짜 시작이다.'], 15: ['이제 조금 진지하게 갈게.'], 16: ['근데 나 사실 체력이 별로 안 좋거든.'], 17: ['체육 시간에도 맨날 구석에서 쉬었어.'],
  18: ['그래도 오늘은 좀 뛰어 볼게.'], 19: ['급식 당번한테도 이렇게 열심히 한 적 없는데.'], 20: ['…헉. 헉.'], 21: ['아직이야. 아직 안 끝났어.'], 22: ['좋아. 슬슬 마무리하자.'],
  23: ['헉… 헉…', '좋아. 이제 내 필살기 보여 줄 차례야.', '피하든 말든, 이게 마지막이야.'],
};
const FACE = { 2: 'lookleft', 5: 'wink', 7: 'closed', 9: 'wink', 10: 'noeyes', 13: 'closed', 14: 'noeyes', 16: 'closed', 19: 'tired1', 20: 'tired1', 21: 'tired1', 22: 'noeyes', 23: 'tired2' };
const TRAP = ['…진짜 눌렀네.', '미안. 선도부 규칙 1조.', '봐주는 척하고 잡는다.'];
const CK_LINES = ['…또 왔네?', '이번엔 바로 진짜부터 하자.'];
const STALL = [['헉… 헉…', 'tired2', 2], ['…', 'tired2', 1.5], ['그래. 사실 필살기 같은 건 없어.', 'tired1', 3], ['그냥 여기서 계속 버틸 거야.', 'tired1', 3], ['네가 지겨워서 포기할 때까지.', 'closed', 3], ['…', 'tired2', 2.5], ['…진짜로.', 'tired2', 2.5], ['…', 'sleep', 2.5], ['…', 'sleep', 2]];
const DEATH = ['…아. 결국 이렇게 됐네.', '벌점은… 내일 줄게.', '…매점 갈 거면, 빵 하나만 남겨 둬.'];

const josa = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 ? '을' : '를'; };
const cleanName = v => String(v || '').replace(/[<>\n\r\t]/g, '').trim().slice(0, 6);
const rnd = n => Math.floor(Math.random() * n);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const D2R = Math.PI / 180;

export function createJudge(el, O = {}) {
  el.innerHTML = `<div class="jd"><div class="jd-wrap"><canvas class="jd-cv"></canvas>
    <div class="jd-pad" hidden><div class="jd-dp"><button type="button" data-k="U">▲</button><button type="button" data-k="L">◀</button><button type="button" data-k="R">▶</button><button type="button" data-k="D">▼</button></div>
    <div class="jd-ab"><button type="button" data-k="X">X</button><button type="button" data-k="Z">Z</button></div></div>
    <input class="jd-name" type="text" maxlength="6" autocomplete="off" spellcheck="false" aria-label="이름" hidden><button type="button" class="jd-ib jd-snd" aria-label="소리"></button><button type="button" class="jd-ib jd-fs" aria-label="전체 화면"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
    <p class="jd-bar">방향키 이동 · Z/Enter 확인 · X/Shift 취소(누르고 있으면 천천히) · Esc 멈춤 · 파란 별: ↑ 점프 · 파란 자: 가만히 있으면 안 아픔</p></div>`;
  const wrap = el.querySelector('.jd-wrap'), cv = el.querySelector('.jd-cv'), X = cv.getContext('2d'), pad = el.querySelector('.jd-pad');
  const sndB = el.querySelector('.jd-snd'), fsB = el.querySelector('.jd-fs'), nameIn = el.querySelector('.jd-name');
  const ART = buildArt();
  let S = 1, alive = true, raf = 0, last = 0, acc = 0, paused = false;
  const rec = Object.assign({ best: 0, clear: 0, deaths: 0, fast: 0 }, store.get('jd_rec', {}) || {});
  let snd = store.get('jd_snd', true) !== false;

  /* ── 글꼴(갈무리, OFL) — 실패하면 기본 글꼴 ── */
  try {
    for (const [n, f] of [['JdGalmuri11', 'galmuri11-judge.woff2'], ['JdGalmuri9', 'galmuri9-judge.woff2']]) {
      const ff = new FontFace(n, `url(/fonts/${f})`); ff.load().then(x => document.fonts.add(x)).catch(() => {});
    }
  } catch {}

  /* ── 크기 ── */
  const isFs = () => (document.fullscreenElement || document.webkitFullscreenElement) === wrap;
  function fit() {
    let w, h;
    if (isFs()) { w = innerWidth; h = innerHeight; }
    else { w = Math.min(el.clientWidth || 640, 1280); const top = Math.max(8, wrap.getBoundingClientRect().top); h = Math.max(300, innerHeight - top - 46); }
    let k = Math.min(w / VW, h / VH); if (k >= 1) k = Math.floor(k * 2) / 2;   // 큰 화면은 0.5배 단위로(도트 균일)
    const D = Math.min(2, window.SG_DPR || devicePixelRatio || 1);
    cv.width = Math.round(VW * k * D); cv.height = Math.round(VH * k * D); cv.style.width = Math.round(VW * k) + 'px'; cv.style.height = Math.round(VH * k) + 'px';
    S = k * D;
  }
  fsB.onclick = () => { fsB.blur(); try { if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap)?.catch?.(() => {}); } catch {} };
  const onFs = () => { fit(); setTimeout(fit, 120); setTimeout(fit, 400); };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

  /* ── 소리(Web Audio로 직접 합성) ── */
  let AC = null, master = null, musG = null, noiseBuf = null;
  function ac() {
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = snd ? .55 : 0; master.connect(AC.destination);
        musG = AC.createGain(); musG.gain.value = 1; musG.connect(master);
        noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch { AC = null; }
    }
    if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  }
  function tone(f, d, type = 'square', g = .08, t0 = 0, f2 = 0, dest) {
    if (!AC) return; const t = AC.currentTime + t0, o = AC.createOscillator(), v = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(v); v.connect(dest || master); o.start(t); o.stop(t + d + .02);
  }
  function noise(d, g = .1, t0 = 0, lo = 800, hi = 0, f2 = 0) {
    if (!AC) return; const t = AC.currentTime + t0, s = AC.createBufferSource(), f = AC.createBiquadFilter(), v = AC.createGain();
    s.buffer = noiseBuf; f.type = hi ? 'bandpass' : 'highpass'; f.frequency.setValueAtTime(hi || lo, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d); if (hi) f.Q.value = .8;
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f); f.connect(v); v.connect(master); s.start(t); s.stop(t + d + .02);
  }
  const SFX = {
    talk: () => tone(185, .045, 'square', .06),                    // 선도부장 목소리(낮은 '뿍')
    txt: () => tone(740, .025, 'square', .03),                      // 상자 글자
    move: () => tone(1050, .03, 'square', .035),
    select: () => { tone(880, .04, 'square', .05); tone(1320, .05, 'square', .04, .035); },
    Flash: () => { noise(.06, .12, 0, 3000); tone(60, .06, 'square', .08); },
    Ding: () => { tone(1568, .5, 'sine', .14); tone(3136, .3, 'sine', .04); },
    Warning: () => { tone(1500, .05, 'square', .05); tone(1500, .05, 'square', .05, .08); },
    BoneStab: () => { noise(.12, .14, 0, 0, 5200, 1500); tone(900, .08, 'square', .04, 0, 1800); },
    Slam: () => { tone(110, .22, 'sine', .35, 0, 38); noise(.16, .16, 0, 0, 400, 120); },
    PlayerDamaged: () => { tone(330, .07, 'square', .09, 0, 110); tone(240, .06, 'square', .07, .05, 80); },
    GasterBlaster: (r = 1.2) => { noise(.55 / r, .1, 0, 0, 500, 3800); tone(140 * r, .55 / r, 'sawtooth', .05, 0, 520 * r); },
    GasterBlast: () => { noise(.9, .2, 0, 0, 1800, 300); tone(90, .8, 'sawtooth', .1, 0, 55); },
    GasterBlast2: () => noise(.5, .1, 0, 6000),
    PlayerFight: () => { noise(.22, .14, 0, 0, 2500, 7000); },
    Hit: () => { tone(80, .5, 'square', .18, 0, 30); noise(.4, .2, 0, 0, 900, 200); },
    Heal: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .09, 'square', .045, i * .055)),
    Break: () => { noise(.08, .2, 0, 2500); tone(160, .12, 'square', .1, 0, 60); },
    Shatter: () => { noise(.35, .15, 0, 3500); [1800, 1400, 2200].forEach((f, i) => tone(f, .08, 'square', .03, .03 * i)); },
  };
  function play(name, rate) { if (!ac() || !snd) return; const f = SFX[name]; if (f) f(rate); }
  // 배경 음악(직접 작곡: E단조, 빠른 칩튠 록) — 나중에 허락받은 음원으로 바꿀 땐 이 부분만 교체
  const n2f = n => 440 * Math.pow(2, (n - 69) / 12);
  const BASS = [[40, 40, 52, 40, 50, 40, 48, 47], [36, 36, 48, 36, 47, 36, 45, 43], [38, 38, 50, 38, 48, 38, 47, 45], [35, 35, 47, 35, 45, 47, 42, 43]];
  const LEAD = [[76, 0, 79, 76, 0, 74, 76, 0, 79, 0, 81, 79, 0, 76, 74, 0], [72, 0, 76, 72, 0, 71, 72, 0, 76, 0, 79, 81, 0, 79, 76, 0],
    [74, 0, 78, 74, 0, 81, 0, 79, 78, 0, 74, 0, 76, 78, 79, 0], [78, 0, 0, 75, 0, 0, 71, 0, 75, 78, 81, 0, 83, 0, 0, 0],
    [88, 0, 86, 83, 0, 86, 88, 0, 91, 0, 88, 0, 86, 83, 81, 0], [84, 0, 83, 79, 0, 83, 84, 0, 88, 0, 84, 0, 83, 79, 76, 0],
    [86, 0, 83, 78, 0, 83, 86, 0, 90, 0, 86, 0, 88, 86, 83, 0], [87, 0, 0, 0, 83, 0, 0, 0, 78, 0, 75, 0, 71, 0, 0, 0]];
  let musOn = false, musPause = false, musT = 0, musStep = 0;
  function music() {
    if (!AC || !musOn || musPause) return; const st = 60 / 140 / 4;
    while (musT < AC.currentTime + .2) {
      const s = musStep % 128, bar = s >> 4, b = s & 15, t0 = musT - AC.currentTime;
      if (snd && t0 > -.05) {
        if (!(b & 1)) tone(n2f(BASS[bar & 3][b >> 1]), st * 1.7, 'triangle', .16, t0, 0, musG);
        const ln = LEAD[bar][b]; if (ln) tone(n2f(ln), st * 1.6, 'square', .045, t0, 0, musG);
        if (b % 4 === 2) tone(n2f(LEAD[bar][b - 2] || 76) / 2, st, 'square', .02, t0, 0, musG);
        if (b === 0 || b === 6 || b === 8 || b === 14) tone(120, .1, 'sine', .3, t0, 40, musG);
        if (b === 4 || b === 12) { const v = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime + t0; v.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 1400; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12); v.connect(f); f.connect(g); g.connect(musG); v.start(t); v.stop(t + .13); }
        if (b & 1) { const v = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime + t0; v.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7500; g.gain.setValueAtTime(.035, t); g.gain.exponentialRampToValueAtTime(.0001, t + .03); v.connect(f); f.connect(g); g.connect(musG); v.start(t); v.stop(t + .04); }
      }
      musT += st; musStep++;
    }
  }
  function musStart() { if (!ac()) return; musOn = true; musPause = false; musT = AC.currentTime + .08; musStep = 0; }
  function musSetPause(p) { if (p === musPause) return; musPause = p; if (!p && AC) musT = AC.currentTime + .05; }
  function setSnd(v) { snd = v; store.set('jd_snd', v); if (master) master.gain.value = v ? .55 : 0; sndB.textContent = v ? '소리 켬' : '소리 끔'; }
  sndB.onclick = () => { ac(); setSnd(!snd); sndB.blur(); };
  [sndB, fsB].forEach(b => { b.tabIndex = -1; b.addEventListener('pointerdown', e => e.preventDefault()); });
  setSnd(snd);

  /* ── 입력 ── */
  const held = { L: 0, R: 0, U: 0, D: 0, Z: 0, X: 0 }, pr = new Set(), rel = new Set();
  const KM = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', KeyZ: 'Z', Enter: 'Z', NumpadEnter: 'Z', Space: 'Z', KeyX: 'X', ShiftLeft: 'X', ShiftRight: 'X' };
  const press = k => { if (!held[k]) pr.add(k); held[k] = 1; ac(); };
  const release = k => { if (held[k]) rel.add(k); held[k] = 0; };
  function kd(e) {
    if (alive && e.target === nameIn) {   // 이름 칸: Enter 확정 · Esc 돌아가기(사이트의 'Esc = 게임 닫기'보다 먼저)
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); nameDone(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); nameClose(); G.mode = 'title'; }
      return;
    }
    if (!alive || e.target?.closest?.('input,textarea')) return;
    if (!el.isConnected) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {   // 결투 중 Esc = 멈춤(사이트의 'Esc = 게임 닫기'보다 먼저 받음) · 처음 화면에선 사이트에 넘김
      if (['title', 'help', 'win', 'dead', 'nameok'].includes(G.mode) && !paused) return;
      e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) togglePause(); return;
    }
    syncMods(e);
    if (e.metaKey || e.ctrlKey || e.altKey) return;   // 단축키(화면 캡처 등)는 게임 입력 아님
    const k = KM[e.code]; if (!k) return; e.preventDefault(); if (e.repeat) return; if (k === 'X') xSrc.add(e.code); press(k);
  }
  function ku(e) {
    const k = KM[e.code]; if (k) e.preventDefault();
    if (k === 'X') { xSrc.delete(e.code); if (!xSrc.size) release('X'); } else if (k) release(k);
    syncMods(e);
  }
  // X(느리게) = KeyX·Shift 중 하나라도 눌려 있을 때. 키를 뗀 알림을 놓쳐도 다음 키·마우스 입력 때 실제 상태로 바로잡음
  const xSrc = new Set();
  function syncMods(e) { if (!e.shiftKey && (xSrc.has('ShiftLeft') || xSrc.has('ShiftRight'))) { xSrc.delete('ShiftLeft'); xSrc.delete('ShiftRight'); if (!xSrc.size) release('X'); } }
  const clearKeys = () => { xSrc.clear(); for (const k in held) held[k] = 0; };
  addEventListener('focus', clearKeys); addEventListener('pointermove', syncMods, true);
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  pad.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); if (k === 'X') xSrc.add('pad'); press(k); b.classList.add('on'); });
    const up = () => { if (k === 'X') { xSrc.delete('pad'); if (xSrc.size) { b.classList.remove('on'); return; } } release(k); b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') pad.hidden = false; ac(); if (paused) togglePause(); else if (['title', 'over', 'win', 'help'].includes(G.mode)) { press('Z'); setTimeout(() => release('Z'), 50); } });
  if (matchMedia?.('(pointer:coarse)').matches) pad.hidden = false;

  /* ═════════ 게임 상태 ═════════ */
  const G = { mode: 'title', sel: 0 };
  let T = 0;                           // 전체 시간(초)
  let hp = MAXHP, kr = 0, krT = 0, lastDmg = -9, items = [], hits = 0, lastScript = 'intro', ck = false, runT0 = 0, trapped = false, deathAt = 0;
  const zone = { l: 33, t: 251, r: 608, b: 391, tl: 33, tt: 251, tr: 608, tb: 391, speed: 480, end: null, vis: true };
  const heart = { x: 320, y: 320, vx: 0, vy: 0, mode: 0, ang: 90, slammed: false, slamDmg: false, maxFall: 750, vis: true, on: false, spd: 150 };
  const sans = { x: 320, y: 235, anim: 'Idle', head: 'closed', torso: 'default', pose: null, poseT: 0, sweat: 0, tT: 0, hT: 0, xs: 0, dodge: 0, dodgeT: 0, alpha: 1, walk: 0 };
  let bones = [], stabs = [], warns = [], gbs = [], plats = [], mbones = [], mbBottom = false, mbT = 0, mbAlt = 0;
  let black = false, shake = 0, shakeT = 0, shX = 0, shY = 0;
  let bubble = null;                   // { text, n, auto, cb }
  let info = null;                     // 상자 글 { text, n, inter, cb }
  let menu = null;                     // { kind:'main'|'list', items, sel, back, page }
  let target = null, strike = null, dmgText = null, popTexts = [];
  let TL = null;                       // 스크립트 실행기
  let stall = null, ending = null, over = null, winT = 0;

  /* ── 스크립트 실행기(원작 공격 스크립트 해석) ── */
  function tlPlay(name) {
    const lines = SCRIPTS[name].split('\n').map(l => l.split('|'));
    const labels = {}; lines.forEach((c, i) => { if (c[1] && c[1][0] === ':') labels[c[1].slice(1)] = i + 1; });
    TL = { lines, labels, vars: { pi: Math.PI }, line: 1, t: 0, run: true, cur: null, name };
    tlLoad();
  }
  function tlLoad() {
    const raw = TL.lines[TL.line - 1]; if (!raw) { TL.cur = null; return; }
    TL.cur = raw.map(tok => tok && tok[0] === '$' ? TL.vars[tok.slice(1)] : tok);
  }
  function tlJump(target) { const n = /^\d+$/.test(String(target)) ? +target : TL.labels[target]; if (n) TL.line = n - 1; }
  function tlTick(dt) {
    if (!TL) return;
    let guard = 0;
    while (TL && TL.run && TL.cur && TL.line <= TL.lines.length && TL.t >= parseFloat(TL.cur[0] || 0)) {
      const c = TL.cur, d = parseFloat(c[0] || 0);
      if (c[1] && c[1][0] !== ':') tlExec(c[1], c.slice(2));
      if (!TL) return;
      TL.t -= d; TL.line++; tlLoad();
      if (++guard > 1000) { TL.run = false; break; }
    }
    if (TL && TL.run) TL.t += dt;
  }
  const num = v => parseFloat(v) || 0;
  function tlExec(cmd, a) {
    const V = TL.vars;
    switch (cmd) {
      case 'SET': V[a[0]] = isNaN(+a[1]) ? a[1] : +a[1]; break;
      case 'ADD': V[a[0]] = num(a[1]) + num(a[2]); break;
      case 'SUB': V[a[0]] = num(a[1]) - num(a[2]); break;
      case 'MUL': V[a[0]] = num(a[1]) * num(a[2]); break;
      case 'DIV': V[a[0]] = num(a[1]) / num(a[2]); break;
      case 'MOD': V[a[0]] = num(a[1]) % num(a[2]); break;
      case 'FLOOR': V[a[0]] = Math.floor(num(a[1])); break;
      case 'SIN': V[a[0]] = Math.sin(num(a[1]) * D2R); break;
      case 'COS': V[a[0]] = Math.cos(num(a[1]) * D2R); break;
      case 'ANGLE': V[a[0]] = Math.atan2(num(a[4]) - num(a[2]), num(a[3]) - num(a[1])) / D2R; break;
      case 'RND': V[a[0]] = rnd(num(a[1])); break;
      case 'JMPABS': tlJump(a[0]); break;
      case 'JMPREL': TL.line += Math.trunc(num(a[0])) - 1; break;
      case 'JMPZ': if (num(a[1]) === 0) tlJump(a[0]); break;
      case 'JMPNZ': if (num(a[1]) !== 0) tlJump(a[0]); break;
      case 'JMPE': if (num(a[1]) === num(a[2])) tlJump(a[0]); break;
      case 'JMPNE': if (num(a[1]) !== num(a[2])) tlJump(a[0]); break;
      case 'JMPL': if (num(a[1]) < num(a[2])) tlJump(a[0]); break;
      case 'JMPNL': if (num(a[1]) >= num(a[2])) tlJump(a[0]); break;
      case 'JMPG': if (num(a[1]) > num(a[2])) tlJump(a[0]); break;
      case 'JMPNG': if (num(a[1]) <= num(a[2])) tlJump(a[0]); break;
      case 'GetHeartPos': V[a[0]] = heart.x; V[a[1]] = heart.y; break;
      case 'TLPause': TL.run = false; break;
      case 'TLResume': TL.run = true; break;
      case 'EndAttack': endAttack(); break;
      case 'CombatZoneResize': zoneResize(num(a[0]), num(a[1]), num(a[2]), num(a[3]), a[4] === 'TLResume' ? 'tl' : null); break;
      case 'CombatZoneResizeInstant': zone.tl = zone.l = num(a[0]); zone.tt = zone.t = num(a[1]); zone.tr = zone.r = num(a[2]); zone.tb = zone.b = num(a[3]); zone.vis = true; clampHeart(); break;
      case 'CombatZoneSpeed': zone.speed = num(a[0]); break;
      case 'HeartMode': setMode(num(a[0])); break;
      case 'HeartTeleport': heart.x = num(a[0]); heart.y = num(a[1]); heart.vis = true; break;
      case 'HeartMaxFallSpeed': heart.maxFall = num(a[0]); break;
      case 'SansSlam': slam(num(a[0])); break;
      case 'SansSlamDamage': heart.slamDmg = num(a[0]) !== 0; break;
      case 'BoneH': boneH(num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5])); break;
      case 'BoneV': boneV(num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5])); break;
      case 'BoneHRepeat': for (let i = 0; i < num(a[5]); i++) boneH(num(a[0]) - Math.cos(num(a[3]) * 90 * D2R) * num(a[6]) * i, num(a[1]) - Math.sin(num(a[3]) * 90 * D2R) * num(a[6]) * i, num(a[2]), num(a[3]), num(a[4]), 0); break;
      case 'BoneVRepeat': for (let i = 0; i < num(a[5]); i++) boneV(num(a[0]) - Math.cos(num(a[3]) * 90 * D2R) * num(a[6]) * i, num(a[1]) - Math.sin(num(a[3]) * 90 * D2R) * num(a[6]) * i, num(a[2]), num(a[3]), num(a[4]), 0); break;
      case 'SineBones': {
        const n = num(a[0]), sp = num(a[1]), spd = num(a[2]), h = num(a[3]);
        for (let i = 0; i < n; i++) {
          const x = sp > 0 ? zone.r + sp * i : zone.l + sp * i, dir = sp > 0 ? 2 : 0, sine = Math.floor(Math.sin(i / 3) * 28);
          let y = zone.t + 6; boneV(x, y, h + sine, dir, spd, 0);
          y = zone.t + 6 + h + sine + 39; boneV(x, y, zone.b - 5 - y, dir, spd, 0);
        }
        break;
      }
      case 'BoneStab': boneStab(num(a[0]), num(a[1]), num(a[2]), num(a[3])); break;
      case 'GasterBlaster': gaster(num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5]), num(a[6]), num(a[7])); break;
      case 'Platform': plats.push({ x: num(a[0]), y: num(a[1]), w: num(a[2]), dir: num(a[3]), sp: num(a[4]), rev: num(a[5]) > 0, vx: 0, vy: 0 }); break;
      case 'PlatformRepeat': for (let i = 0; i < num(a[5]); i++) plats.push({ x: num(a[0]) - Math.cos(num(a[3]) * 90 * D2R) * num(a[6]) * i, y: num(a[1]) - Math.sin(num(a[3]) * 90 * D2R) * num(a[6]) * i, w: num(a[2]), dir: num(a[3]), sp: num(a[4]), rev: false, vx: 0, vy: 0 }); break;
      case 'BlackScreen': if (num(a[0])) { black = true; zone.vis = false; musSetPause(true); bones = []; stabs = []; warns = []; gbs = []; plats = []; } else { black = false; zone.vis = true; musSetPause(false); } break;
      case 'Sound': play(a[0], a[1] ? num(a[1]) : undefined); break;
      case 'SansAnimation': sans.pose = null; sans.anim = a[0] || ''; sans.tT = sans.hT = 0; break;
      case 'SansBody': sans.anim = ''; sans.pose = { HandUp: 'up', HandDown: 'down', HandLeft: 'left', HandRight: 'right' }[a[0]] || 'down'; sans.poseT = 0; break;
      case 'SansTorso': sans.pose = null; sans.torso = a[0] === 'Shrug' ? 'shrug' : 'default'; break;
      case 'SansHead': sans.head = { Default: 'default', LookLeft: 'lookleft', Wink: 'wink', ClosedEyes: 'closed', NoEyes: 'noeyes', BlueEye: 'blue', Tired1: 'tired1', Tired2: 'tired2' }[a[0]] || 'default'; break;
      case 'SansSweat': sans.sweat = num(a[0]); break;
      case 'SansX': sans.x = num(a[0]); break;
      case 'SansRepeat': sans.xs = -900; break;
      case 'SansEndRepeat': sans.xs = 0; break;
      case 'SansText': bubble = { text: a[0], n: 0, auto: 1.4 }; break;
    }
  }

  /* ── 공격 물체 ── */
  function boneV(x, y, h, dir, sp, col) { bones.push({ v: 1, x, y, w: 10, h, dir, sp, col: col | 0, karma: 6 }); }
  function boneH(x, y, w, dir, sp, col) { bones.push({ v: 0, x, y, w, h: 10, dir, sp, col: col | 0, karma: 6 }); }
  function boneStab(dir, dist, warn, stay) {
    play('Warning');
    let wr; const W = zone.r - zone.l, H = zone.b - zone.t;
    if (dir === 0) wr = [zone.r - (dist - 3) - 8, zone.t + 8, dist - 3, H - 16];
    else if (dir === 1) wr = [zone.l + 8, zone.b - (dist - 3) - 8, W - 16, dist - 3];
    else if (dir === 2) wr = [zone.l + 8, zone.t + 8, dist - 3, H - 16];
    else wr = [zone.l + 8, zone.t + 8, W - 16, dist - 3];
    warns.push({ dir, dist, warn, stay, r: wr, t: 0 });
  }
  function spawnStab(w) {
    play('BoneStab');
    const W = zone.r - zone.l, H = zone.b - zone.t, s = { dir: w.dir, dist: w.dist, stay: w.stay, rev: false, karma: 6 };
    if (w.dir === 1 || w.dir === 3) { s.w = W; s.h = w.dist + 8; s.x = zone.l; s.dx = s.x;
      if (w.dir === 1) { s.y = zone.b - 5; s.dy = zone.b - 5 - w.dist; } else { s.y = zone.t + 5 - s.h; s.dy = zone.t + 5 - s.h + w.dist; } }
    else { s.w = w.dist + 8; s.h = H; s.y = zone.t; s.dy = s.y;
      if (w.dir === 0) { s.x = zone.r - 5; s.dx = zone.r - 5 - w.dist; } else { s.x = zone.l + 5 - s.w; s.dx = zone.l + 5 - s.w + w.dist; } }
    stabs.push(s);
  }
  function gaster(size, sx, sy, ex, ey, eang, spin, blast) {
    const hS = size === 0 ? 1 : size === 1 ? 2 : 3, wS = size === 2 ? 3 : 2;
    gbs.push({ x: sx, y: sy, ex, ey, eang, ang: 90, st: 0, timer: spin, blastT: blast, hS, wS, scale: hS / 2, base: 0, bt: 0, op: 100, leave: 0, fireT: 0, karma: 10, hit: false, dead: false });
    if (T - (G.gbSnd || -9) > .05) { play('GasterBlaster', 1.2); G.gbSnd = T; }
  }

  /* ── 별(영혼) ── */
  function setMode(m) { heart.mode = m; heart.ang = 90; }
  function slam(dir) {
    setMode(1); heart.slammed = true; heart.ang = Math.floor(dir) * 90;
    heart.vx = Math.cos(heart.ang * D2R) * heart.maxFall; heart.vy = Math.sin(heart.ang * D2R) * heart.maxFall;
    if (Math.abs(heart.vx) < 1e-6) heart.vx = 0; if (Math.abs(heart.vy) < 1e-6) heart.vy = 0;
  }
  const inner = () => ({ l: zone.l + 5 + 8, t: zone.t + 5 + 8, r: zone.r - 5 - 8, b: zone.b - 5 - 8 });
  function clampHeart() { const I = inner(); if (I.r < I.l || I.b < I.t) return; heart.x = clamp(heart.x, I.l, I.r); heart.y = clamp(heart.y, I.t, I.b); }
  const gdir = () => [Math.round(Math.cos(heart.ang * D2R)), Math.round(Math.sin(heart.ang * D2R))];
  function onPlat(dx, dy) {   // 별 아래(중력 방향)에 발판이 있나
    if (heart.ang !== 90 && heart.ang !== 270) return null;
    for (const p of plats) {
      const top = p.y, bot = p.y + 7;
      if (heart.x + 8 <= p.x || heart.x - 8 >= p.x + p.w) continue;
      if (heart.ang === 90 && heart.vy >= p.vy - .01 && Math.abs(heart.y + 8 + dy - top) <= 2.5 && heart.y < top) return p;
      if (heart.ang === 270 && heart.vy <= p.vy + .01 && Math.abs(heart.y - 8 + dy - bot) <= 2.5 && heart.y > bot) return p;
    }
    return null;
  }
  function solid(dx, dy) {
    const I = inner();
    if (heart.x + dx < I.l - .01 || heart.x + dx > I.r + .01 || heart.y + dy < I.t - .01 || heart.y + dy > I.b + .01) return true;
    return !!onPlat(dx, dy);
  }
  function moveHeart(dt) {
    const sp = held.X ? 75 : 150;
    if (heart.mode === 0) {
      heart.vy = held.U === held.D ? 0 : held.U ? -sp : sp;
      heart.vx = held.L === held.R ? 0 : held.L ? -sp : sp;
    } else {
      const [gx, gy] = gdir(), jumpK = { '0': 'L', '90': 'U', '180': 'R', '270': 'D' }[((heart.ang % 360) + 360) % 360];
      if (pr.has(jumpK) && solid(gx, gy)) { heart.vx -= gx * 180; heart.vy -= gy * 180; }
      let down = heart.vx * gx + heart.vy * gy;
      if (rel.has(jumpK) && down < -30) { down = -30; if (gx) heart.vx = gx * down; else heart.vy = gy * down; }
      const g = down < 240 && down > 15 ? 540 : down <= 15 && down > -30 ? 180 : down <= -30 && down > -120 ? 450 : down <= -120 ? 180 : 0;
      if (!solid(gx * .2, gy * .2)) {
        heart.vx += gx * g * dt; heart.vy += gy * g * dt;
        const mf = heart.maxFall;
        if (gx > 0 && heart.vx > mf) heart.vx = mf; if (gx < 0 && heart.vx < -mf) heart.vx = -mf;
        if (gy > 0 && heart.vy > mf) heart.vy = mf; if (gy < 0 && heart.vy < -mf) heart.vy = -mf;
      }
      if (gx) {   // 옆으로 떨어질 때 위아래 이동
        heart.vy = 0;
        if (held.U !== held.D) heart.vy += held.U ? -sp : sp;
      } else {
        heart.vx = 0;
        const p = onPlat(0, gy * .5);
        if (p) { heart.vx = p.vx; heart.vy = p.vy; heart.y = gy > 0 ? p.y - 8.05 : p.y + 7 + 8.05; }
        if (held.L !== held.R) heart.vx += held.L ? -sp : sp;
      }
    }
    // 이동 + 벽(상자) 충돌
    const I = inner();
    const step = (ax) => {
      const v = ax ? heart.vy : heart.vx; if (!v) return;
      let p = (ax ? heart.y : heart.x) + v * dt, hitW = false;
      const lo = ax ? I.t : I.l, hi = ax ? I.b : I.r;
      if (p < lo) { p = lo; hitW = true; } if (p > hi) { p = hi; hitW = true; }
      if (ax && heart.mode === 1 && !hitW && heart.ang === 90 && v > 0) {   // 발판 위로 착지
        for (const pl of plats) { if (heart.x + 8 > pl.x && heart.x - 8 < pl.x + pl.w && heart.y + 8 <= pl.y + 2 && p + 8 >= pl.y && v >= pl.vy) { p = pl.y - 8.05; hitW = true; break; } }
      }
      if (ax) heart.y = p; else heart.x = p;
      if (hitW) {
        if (heart.slammed) { heart.slammed = false; if (Math.abs(v) >= 330) { play('PlayerDamaged'); play('Slam'); doShake(Math.floor(Math.abs(v) / 90)); if (heart.slamDmg && hp > 1) hp--; } }
        if (ax) heart.vy = 0; else heart.vx = 0;
      }
    };
    step(0); step(1);
  }
  function doShake(n) { shake = n; shakeT = 0; }

  /* ── 피해·벌점 ── */
  function damage(d, k) { lastDmg = T; if (O._god) return; hp -= d; kr += k; play('PlayerDamaged'); }
  function checkHits() {
    if (!heart.vis || T - lastDmg < .033) return;
    const hx = heart.x, hy = heart.y, moving = heart.vx !== 0 || heart.vy !== 0;
    const inR = (x, y, w, h) => hx >= x && hx <= x + w && hy >= y && hy <= y + h;
    const zoneClip = (x, y, w, h) => { const x0 = Math.max(x, zone.l), y0 = Math.max(y, zone.t), x1 = Math.min(x + w, zone.r), y1 = Math.min(y + h, zone.b); return hx >= x0 && hx <= x1 && hy >= y0 && hy <= y1; };
    for (const b of bones) {
      if (!(b.v ? zoneClip(b.x, b.y, b.w, b.h) : inR(b.x, b.y, b.w, b.h))) continue;
      if (b.col === 1 && !moving) continue; if (b.col === 2 && moving) continue;
      damage(1, b.karma); if (b.karma >= 3) b.karma = 2; return;
    }
    for (const s of stabs) if (zoneClip(s.x, s.y, s.w, s.h)) { damage(1, s.karma); if (s.karma >= 3) s.karma = 2; return; }
    for (const g of gbs) {
      if (!g.hit) continue;
      const dx = hx - g.x, dy = hy - g.y, c = Math.cos(g.ang * D2R), s = Math.sin(g.ang * D2R);
      const al = dx * c + dy * s - 70 * g.scale, pe = -dx * s + dy * c, hh = g.base * 3 / 4;
      if (al >= 0 && al <= 1000 && Math.abs(pe) <= hh / 2) { damage(1, g.karma); if (g.karma >= 3) g.karma = 2; return; }
    }
    for (const m of mbones) if (inR(m.x - 7, m.y - 22, 14, 44)) { damage(1, 0); if (hp < 1) hp = 1; return; }
  }
  function krTick(dt) {
    if (kr > 40) kr = 40;
    if (kr >= hp) kr = hp - 1;
    if (kr < 0) kr = 0;
    if (kr > 0 && hp > 1) {
      krT += dt;
      const iv = kr >= 40 ? .033 : kr >= 30 ? .066 : kr >= 20 ? .166 : kr >= 10 ? .5 : 1;
      if (krT >= iv) { kr--; hp--; krT = 0; }
    }
    if (hp > MAXHP) hp = MAXHP;
  }

  /* ── 상자 크기 ── */
  function zoneResize(l, t, r, b, end) { zone.tl = l; zone.tt = t; zone.tr = r; zone.tb = b; zone.end = end; zone.vis = true; }
  function zoneTick(dt) {
    const m = zone.speed * dt, mv = (k, tk) => { const d = zone[tk] - zone[k]; zone[k] += Math.sign(d) * Math.min(m, Math.abs(d)); };
    mv('l', 'tl'); mv('t', 'tt'); mv('r', 'tr'); mv('b', 'tb');
    if (zone.end && zone.l === zone.tl && zone.t === zone.tt && zone.r === zone.tr && zone.b === zone.tb) {
      const e = zone.end; zone.end = null;
      if (e === 'tl' && TL) TL.run = true; else if (typeof e === 'function') e();
    }
    if (heart.on || G.mode === 'attack') clampHeart();
  }

  /* ── 물체 갱신 ── */
  function objTick(dt) {
    for (const b of bones) { b.x += Math.cos(b.dir * 90 * D2R) * dt * b.sp; b.y += Math.sin(b.dir * 90 * D2R) * dt * b.sp; }
    bones = bones.filter(b => !((b.dir === 0 && b.x > VW) || (b.dir === 1 && b.y > VH) || (b.dir === 2 && b.x < -b.w) || (b.dir === 3 && b.y < -b.h)));
    for (const w of warns) { w.t += dt; if (w.t >= w.warn) { w.dead = 1; spawnStab(w); } }
    warns = warns.filter(w => !w.dead);
    for (const s of stabs) {
      const sp = s.dist * 10, cx = Math.cos(s.dir * 90 * D2R), cy = Math.sin(s.dir * 90 * D2R);
      if (s.rev) { s.x += cx * dt * sp; s.y += cy * dt * sp; }
      else {
        s.x -= cx * dt * sp; s.y -= cy * dt * sp;
        if ((cx && (s.x - s.dx) * -cx >= 0) || (cy && (s.y - s.dy) * -cy >= 0)) { s.x = s.dx; s.y = s.dy; }
        if (s.x === s.dx && s.y === s.dy) { s.stay -= Math.min(dt, s.stay); if (s.stay <= 0) s.rev = true; }
      }
      if (s.x > VW + 50 || s.y > VH + 50 || s.x + s.w < -50 || s.y + s.h < -50) s.dead = 1;
    }
    stabs = stabs.filter(s => !s.dead);
    for (const p of plats) {
      if (p.rev) {
        const W = 5;
        if (p.dir === 0 && p.x + p.w >= zone.r - W) p.dir = 2; else if (p.dir === 2 && p.x <= zone.l + 3) p.dir = 0;
      }
      const ox = p.x, oy = p.y;
      p.x += Math.cos(p.dir * 90 * D2R) * p.sp * dt; p.y += Math.sin(p.dir * 90 * D2R) * p.sp * dt;
      p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
    }
    plats = plats.filter(p => p.x < VW + 400 && p.x + p.w > -400);
    for (const g of gbs) {
      if (g.st === 0) {   // 들어오기
        const k = Math.min(1, dt * 10);
        if (Math.abs(g.x - g.ex) >= 3) g.x += (g.ex - g.x) * k; else g.x = g.ex;
        if (Math.abs(g.y - g.ey) >= 3) g.y += (g.ey - g.y) * k; else g.y = g.ey;
        if (Math.abs(g.ang - g.eang) >= 3) g.ang += (g.eang - g.ang) * k; else g.ang = g.eang;
        if (g.x === g.ex && g.y === g.ey && g.ang === g.eang) g.st = 1;
      } else if (g.st === 1) { g.timer -= Math.min(dt, g.timer); if (g.timer <= 0) { g.st = 2; g.timer = .1; g.fireT = 0; } }
      else if (g.st === 2) { g.timer -= Math.min(dt, g.timer); g.fireT += dt; if (g.timer <= 0) { g.st = 3; g.beam = true; g.hit = true; g.bt = 0; if (T - (G.gbFire || -9) > .05) { play('GasterBlast'); play('GasterBlast2'); G.gbFire = T; } if (g.hS > 1) doShake(5); } }
      else if (g.st === 3) { g.fireT += dt; g.leave += 30 * (dt * 60); g.x -= Math.cos(g.ang * D2R) * dt * g.leave; g.y -= Math.sin(g.ang * D2R) * dt * g.leave; }
      if (g.beam) {
        g.bt += dt;
        const full = 35 * g.hS;
        if (g.bt <= 4 / 30) g.base = Math.min(full, g.base + Math.floor(full / 4) * dt * 30); else if (g.bt <= 4 / 30 + dt * 1.01 && g.bt < 5 / 30 + g.blastT) g.base = full;
        if (g.bt > 5 / 30 + g.blastT) { g.base *= Math.pow(.8, dt * 30); g.op = 100 - ((g.bt - g.blastT) * 30 - 5) * 10; if (g.base < 2) g.dead = true; }
        if (g.op < 80) g.hit = false;
      }
      if (g.st === 3 && (g.x < -300 || g.x > VW + 300 || g.y < -300 || g.y > VH + 300) && !g.beam) g.dead = true;
    }
    gbs = gbs.filter(g => !g.dead);
  }
  function menuBonesTick(dt) {
    for (const m of mbones) {
      if (m.k === 'L') { m.t += dt; m.x = -30 + Math.abs(Math.sin(600 * m.t / Math.PI * D2R)) * 105; if (m.x > 64) m.t -= dt * .72; if (m.kill && m.x <= -8) m.dead = 1; m.y = 292; }
      else {
        if (m.st === 0) { m.y -= 300 * dt; if (m.y <= 440 + 22) { m.y = 462; m.st = 1; } }
        else if (m.st === 1) { m.x -= 150 * dt; if (m.x <= m.stop) { m.x = m.stop; m.st = 2; } }
        else { m.y += 300 * dt; if (m.y - 22 > VH) m.dead = 1; }
      }
    }
    if (mbBottom) {
      mbT += dt;
      if (mbT >= .6) {
        mbT -= .6;
        for (const i of [0 + mbAlt, 2 + mbAlt]) mbones.push({ k: 'B', x: BTNS[i].x + 110 + 7, y: VH + 22, st: 0, stop: BTNS[i].x - 14 + 7 });
        mbAlt = mbAlt ? 0 : 1;
      }
    }
    mbones = mbones.filter(m => !m.dead);
  }

  /* ═════════ 흐름 ═════════ */
  function resetVars() { zone.speed = 480; setMode(heart.mode); heart.maxFall = 750; heart.slamDmg = false; sans.xs = 0; sans.x = 320; }
  function startAttack(name) {
    heart.on = true; heart.vx = heart.vy = 0; resetVars(); mbones = []; mbBottom = false; black = false; zone.vis = true; bones = []; stabs = []; warns = []; gbs = []; plats = [];
    info = null; menu = null; bubble = null; G.mode = 'attack';
    sans.anim = sans.anim || 'Idle';
    lastScript = name; tlPlay(name);
  }
  function endAttack() {
    TL = null; bones = []; stabs = []; warns = []; gbs = []; plats = []; black = false; zone.vis = true; bubble = null;
    heart.vis = true; heart.on = false; resetVars(); musSetPause(false);
    if (hits >= 23) return startStall();
    sans.pose = null; sans.anim = 'Idle'; sans.head = 'default'; sans.torso = 'default';
    let t = kr >= 20 ? '* 온몸이 천근만근 무겁다.' : kr >= 10 ? '* 어깨가 점점 무거워진다.' : '* 등 뒤가 서늘하다.';
    if (hits === 0) t = '* 오늘은 긴 하루가 될 것 같다.';
    if (hits === 13) { t = '* 선도부장이 숨을 고르고 있다.'; musSetPause(true); }
    if (hits === 15) t = '* 이제부터가 진짜다.';
    if (hits === 19) t = '* 복도 시계 초침 소리가 유난히 크다.';
    if (hits === 20) t = '* 선도부장이 눈에 띄게 지쳐 있다.';
    if (hits === 21) t = '* 선도부장이 소매를 걷어붙인다.';
    if (hits === 22) t = '* 선도부장의 눈빛이 달라졌다.';
    if (hits > 13 && hits !== 16 && hits !== 17 && hits <= 22) mbones.push({ k: 'L', x: -10, y: 292, t: 0 });
    if (hits > 15 && hits <= 22) { mbBottom = true; mbT = 0; mbAlt = 0; }
    G.flavor = t;
    zoneResize(...MENU_ZONE, () => openMain());
    G.mode = 'toMenu';
  }
  function openMain() { G.mode = 'menu'; menu = { kind: 'main', sel: menu?.kind === 'main' ? menu.sel : G.lastBtn || 0 }; info = { text: G.flavor, n: 0 }; }
  // 플레이어 행동 끝 → 선도부장 차례
  function enemyTurn(progress) {
    menu = null; info = null;
    if (!progress) return startAttack(hits === 0 ? 'bonegap1' : lastScript);   // 공격 말고 다른 행동은 같은 공격 반복(첫 턴만 1막 첫 공격)
    const n = hits, lines = LINES[n];
    const name = n <= 12 ? P1[Math.min(n, 13)] : n === 13 ? 'spare' : n <= 22 ? P2[n - 14] : 'final';
    if (n === 14) { musSetPause(false); store.set('jd_ck', 1); }
    rec.best = Math.max(rec.best, n); saveRec();
    if (lines) { talk(lines, () => startAttack(name), FACE[n] || 'default'); }
    else startAttack(name);
  }
  function talk(lines, cb, face) {
    G.mode = 'talk'; heart.on = false; sans.head = face || sans.head;
    const q = lines.map(l => Array.isArray(l) ? l : [l, null]); let i = 0;
    const next = () => { if (i >= q.length) { bubble = null; cb?.(); return; } const [txt, f, fx] = q[i++]; if (f) sans.head = f; bubble = { text: txt, n: 0, cb: next, rate: fx === 'slow' ? 5 : 22, shake: fx === 'slow' }; };
    next();
  }
  function saveRec() { store.set('jd_rec', rec); }

  function newRun(fromCk) {
    hp = MAXHP; kr = 0; krT = 0; items = ITEMS0.map(a => a.slice()); trapped = false; ck = fromCk; runT0 = T;
    bones = []; stabs = []; warns = []; gbs = []; plats = []; mbones = []; mbBottom = false; TL = null; black = false; stall = null; ending = null; over = null;
    sans.x = 320; sans.alpha = 1; sans.walk = 0; sans.sweat = 0; sans.pose = null; sans.anim = 'Idle'; sans.torso = 'default';
    zone.l = zone.tl = MENU_ZONE[0]; zone.t = zone.tt = MENU_ZONE[1]; zone.r = zone.tr = MENU_ZONE[2]; zone.b = zone.tb = MENU_ZONE[3]; zone.vis = true;
    heart.mode = 0; heart.vis = true; G.lastBtn = 0; musStart();
    if (fromCk) { hits = 14; talk(CK_LINES, () => { musSetPause(false); hits = 14; enemyTurnAt(14); }, 'noeyes'); }
    else { hits = 0; sans.anim = ''; talk(INTRO, () => startAttack('intro'), 'closed'); musSetPause(true); }
  }
  function enemyTurnAt(n) { hits = n; const name = P2[n - 14]; startAttack(name); }

  /* ── 메뉴 ── */
  function mainAction(i) {
    G.lastBtn = i; play('select');
    if (i === 0) menu = { kind: 'list', what: 'fight', items: ['선도부장'], sel: 0 };
    else if (i === 1) menu = { kind: 'list', what: 'actEnemy', items: ['선도부장'], sel: 0 };
    else if (i === 2) { if (!items.length) { play('move'); return; } menu = { kind: 'list', what: 'item', items: items.map(x => x[0]), sel: 0, page: 0 }; }
    else menu = { kind: 'list', what: 'mercy', items: ['봐주기'], sel: 0 };
    info = null;
  }
  function listAction() {
    const m = menu; play('select');
    if (m.what === 'fight') { menu = null; startTarget(false); }
    else if (m.what === 'actEnemy') menu = { kind: 'list', what: 'act', items: ['살펴보기'], sel: 0 };
    else if (m.what === 'act') {
      menu = null;
      const t = hits > 0 ? ['* 선도부장 - 공격 1 방어 1', '* 전교에서 제일 만만한 선배.', '* 한 번에 1밖에 못 깎는다.'] : ['* 선도부장 - 공격 1 방어 1', '* 전교에서 제일 만만한 선배.', '* 한 번에 1밖에 못 깎는다.'];
      showText(t.join('\n'), () => hits > 0 ? showText('* 언젠가는 지칠 거다.\n* 계속 몰아붙이자.', () => enemyTurn(false)) : enemyTurn(false));
    } else if (m.what === 'item') {
      const idx = m.page * 4 + m.sel, it = items.splice(idx, 1)[0]; menu = null;
      const before = hp; hp = Math.min(MAXHP, hp + it[1]); play('Heal');
      showText(`* ${it[2]}${josa(it[2])} 먹었다.\n* ${hp >= MAXHP ? '체력이 가득 찼다.' : `체력이 ${hp - before} 회복됐다.`}`, () => enemyTurn(false));
    } else if (m.what === 'mercy') {
      menu = null;
      if (hits === 13) { trapped = true; talk(TRAP, () => trapAttack(), 'noeyes'); }
      else enemyTurn(false);
    }
  }
  function showText(text, cb) { G.mode = 'text'; info = { text, n: 0, inter: true, cb }; }
  function trapAttack() {   // 봐주기 함정: 상자 바닥에서 자가 계속 솟아 HP를 다 깎음
    G.mode = 'attack'; heart.on = true; menu = null; info = null;
    zoneResize(133, 251, 508, 391, null); setMode(1); heart.x = 320; heart.y = 376; heart.slamDmg = false;
    TL = { lines: [], labels: {}, vars: {}, line: 1, t: 0, run: false, cur: null, name: 'trap' };
    G.trapT = -.6; G.trapK = 0;
  }

  /* ── 공격 막대 ── */
  function startTarget(final) {
    G.mode = 'target'; heart.vis = false;
    const dir = final ? 0 : rnd(2) ? 2 : 0;
    target = { st: 0, x: dir ? zone.r : zone.l, dir, w: 548, op: 1, final, blink: 0 };
  }
  function targetTick(dt, active) {
    const t = target; if (!t) return;
    if (t.st === 0) { if (!active) { t.st = 2; return; }
      t.x += (t.dir ? -1 : 1) * dt * 360;
      if ((t.dir === 0 && t.x > zone.r) || (t.dir === 2 && t.x < zone.l)) { t.st = 2; popTexts.push({ text: '빗나감', x: 272, y: 76, t: 0, life: 1 }); if (!t.final) enemyTurn(false); else t.x = zone.l, t.st = 0; }   // 안 누르면 빗나감(진행 안 됨) · 마지막 한 방은 다시
      else if (pr.has('Z')) {
        t.st = 1; strike = { t: 0, x: sans.x, y: sans.y - 96 }; play('PlayerFight');
        if (t.final) { ending = { t: 0, ph: 0 }; }
        else { sans.dodge = 1; sans.dodgeT = 0; }
      }
    } else if (t.st === 1) { t.blink += dt; }
    else { t.w -= dt * 960; t.op -= dt * 240 / 100; if (t.op <= 0) target = null; }
  }
  function afterDodge() { target && (target.st = 2); hits++; enemyTurn(true); }

  /* ── 필살기 뒤: 버티기 → 졸기 → 상자 밀기 ── */
  function startStall() {
    G.mode = 'stall'; heart.on = true; setMode(0); musOn = false; sans.pose = null; sans.anim = 'Tired'; sans.head = 'tired2'; sans.sweat = 3;
    stall = { i: 0, t: 0, asleep: false, pushedL: false, pushedD: false };
    nextStall();
  }
  function nextStall() {
    const s = stall; if (s.i >= STALL.length) { s.asleep = true; sans.head = 'sleep'; bubble = null; return; }
    const [txt, face, dur] = STALL[s.i++]; sans.head = face; bubble = { text: txt, n: 0, auto: dur, cb: nextStall };
  }
  function stallTick(dt) {
    const s = stall; moveHeart(dt);
    const I = inner();
    if (!s.asleep) {
      if (heart.x <= I.l + .01 && held.L) {   // 졸기 전에 밀면 가운데로 되돌림 + 처음부터
        heart.x = (zone.l + zone.r) / 2; heart.y = (zone.t + zone.b) / 2; s.i = 4; bubble = { text: '어디 가? 아직 안 끝났어.', n: 0, auto: 2, cb: nextStall }; sans.head = 'noeyes';
      }
      return;
    }
    if (heart.x <= I.l + .01 && held.L && zone.l > 20) { const d = Math.min(60 * dt, zone.l - 20); zone.l -= d; zone.r -= d; zone.tl = zone.l; zone.tr = zone.r; heart.x -= d; }
    if (zone.l <= 30 && heart.y >= I.b - .01 && held.D) { const d = 60 * dt; zone.t += d; zone.b += d; zone.tt = zone.t; zone.tb = zone.b; heart.y += d; }
    // 별이 '반항' 버튼에 닿으면
    if (heart.x >= BTNS[0].x && heart.x <= BTNS[0].x + 110 && heart.y >= 432 && heart.y <= 474) {
      G.mode = 'final'; stall = null; zoneResize(...MENU_ZONE, () => startTarget(true)); zone.speed = 900; heart.vis = false;
    }
  }
  function endingTick(dt) {
    const e = ending; e.t += dt;
    if (e.ph === 0 && e.t > .1) { e.ph = 1; sans.head = 'default'; sans.dodge = 1; sans.dodgeT = 0; popTexts.push({ text: '빗나감', x: 272, y: 50, t: 0, life: .8, delay: .55 }); }
    if (e.ph === 1 && e.t > 1.0) { e.ph = 2; sans.dodge = 0; strike = { t: 0, x: sans.x, y: sans.y - 96 }; play('PlayerFight'); }
    if (e.ph === 2 && e.t > 1.5) { e.ph = 3; play('Hit'); doShake(8); sans.head = 'hurt'; sans.anim = ''; dmgText = { n: 9999999, t: 0 }; }
    if (e.ph === 3 && e.t > 3.2) { e.ph = 4; dmgText = null; target = null; talk(DEATH, () => { e.ph = 5; e.t2 = 0; }, 'hurt'); G.mode = 'endtalk'; }
    if (e.ph === 5) { e.t2 += dt; sans.walk += dt; sans.x -= 22 * dt; sans.alpha = Math.max(0, 1 - e.t2 / 4); if (e.t2 > 4.5) win(); }
  }
  function win() {
    G.mode = 'win'; winT = 0; musOn = false; rec.clear++; const tm = Math.round((T - runT0) * 1000); if (!ck && (!rec.fast || tm < rec.fast)) rec.fast = tm; rec.best = 24; G.winMs = tm; saveRec(); store.set('jd_ck', 0);
  }
  function die() {
    G.mode = 'dead'; over = { t: 0, x: heart.x, y: heart.y, sh: [] }; TL = null; musOn = false; rec.deaths++; saveRec();
    if (hits >= 14 && !trapped) store.set('jd_ck', 1);
  }

  /* ═════════ 한 틱 ═════════ */
  function step(dt) {
    T += dt;
    if (shake > 0) { shakeT += dt; while (shakeT >= 1 / 30 && shake > 0) { shakeT -= 1 / 30; shake--; shX = shake * (Math.random() < .5 ? 1 : -1); shY = shake * (Math.random() < .5 ? 1 : -1); } } else shX = shY = 0;
    if (musOn) music();
    // 선도부장 몸짓
    sans.tT += dt; sans.hT += dt; if (sans.pose) sans.poseT += dt;
    if (sans.xs) { sans.x += sans.xs * dt; sans.xs -= 45 * dt; if (sans.x < -100) { sans.x = 740; sans.head = ['default', 'lookleft', 'wink', 'closed', 'noeyes'][rnd(5)]; sans.torso = rnd(4) ? 'default' : 'shrug'; } sans.y = zone.t - 16; }
    else if (G.mode !== 'stall' && G.mode !== 'final') sans.y = zone.tt - 16;
    if (sans.dodge) {
      sans.dodgeT += dt;
      if (sans.dodge === 1) { sans.x = 320 - Math.sin(sans.dodgeT * 225 * D2R) * 100; if (sans.dodgeT >= .4) { sans.x = 220; sans.dodge = 2; sans.dodgeT = 0; if (!ending) popTexts.push({ text: '빗나감', x: 272, y: 50, t: 0, life: 1.5, delay: .6 }); } }
      else if (sans.dodge === 2) { if (sans.dodgeT >= 1.1) { sans.dodge = 3; sans.dodgeT = 0; } }
      else if (sans.dodge === 3) { sans.x = 320 - Math.cos(sans.dodgeT * 225 * D2R) * 100; if (sans.dodgeT >= .4) { sans.x = 320; sans.dodge = 0; if (!ending) afterDodge(); } }
    }
    if (bubble) { const L = bubble.text.length; if (bubble.n < L) { const o = Math.floor(bubble.n); bubble.n = Math.min(L, bubble.n + dt * (bubble.rate || 22)); if (Math.floor(bubble.n) > o && bubble.text[o] !== ' ') play('talk'); } else if (bubble.auto != null) { bubble.auto -= dt; if (bubble.auto <= 0) { const cb = bubble.cb; bubble = null; cb?.(); } } }
    if (info) { const L = info.text.length; if (info.n < L) { const o = Math.floor(info.n); info.n = Math.min(L, info.n + dt * 30); if (Math.floor(info.n) > o && info.text[o] !== ' ' && info.text[o] !== '\n') play('txt'); } }
    for (const p of popTexts) { if (p.delay > 0) p.delay -= dt; else p.t += dt; }
    popTexts = popTexts.filter(p => p.t < p.life);
    if (strike) { strike.t += dt; if (strike.t > .5) strike = null; }
    if (dmgText) dmgText.t += dt;
    zoneTick(dt); targetTick(dt, G.mode === 'target');
    const m = G.mode;
    if (m === 'title') {
      const o = titleOpts(); if (pr.has('U')) { G.sel = (G.sel + o.length - 1) % o.length; play('move'); } if (pr.has('D')) { G.sel = (G.sel + 1) % o.length; play('move'); }
      if (pr.has('Z')) { play('select'); const id = o[G.sel].id; if (id === 'new') { if (pname(true)) newRun(false); else nameOpen(() => newRun(false)); } else if (id === 'ck') newRun(true); else if (id === 'name') nameOpen(() => { G.mode = 'title'; }); else G.mode = 'help'; }
    } else if (m === 'help') { if (pr.has('Z') || pr.has('X')) { G.mode = 'title'; play('move'); } }
    else if (m === 'nameok') {
      G.nameT += dt;
      if (pr.has('L') || pr.has('R')) { G.nameSel = 1 - G.nameSel; play('move'); }
      if (pr.has('X')) { play('move'); nameOpen(G.nameAfter); }
      else if (pr.has('Z') && G.nameT > .3) { play('select'); if (G.nameSel) { store.set('jd_name', G.nameVal); const a = G.nameAfter; G.nameAfter = null; a?.(); } else nameOpen(G.nameAfter); }
    }
    else if (m === 'talk' || m === 'endtalk') {
      krTick(dt);
      if (bubble && (pr.has('Z') || pr.has('X'))) { if (bubble.n < bubble.text.length) { bubble.n = bubble.text.length; bubble.shake = false; } else if (bubble.auto == null) { const cb = bubble.cb; bubble = null; cb?.(); } }
    } else if (m === 'attack') {
      tlTick(dt); if (heart.on) moveHeart(dt); objTick(dt); checkHits(); krTick(dt);
      if (TL?.name === 'trap') { G.trapT += dt; if (G.trapT >= .09 && G.trapK < 60) { G.trapT = 0; boneStab(1, 30 + (G.trapK % 4) * 25, .02, 30); G.trapK++; } }
    } else if (m === 'menu') {
      krTick(dt); menuBonesTick(dt); checkMenuHit();
      if (menu?.kind === 'main') {
        if (pr.has('L')) { menu.sel = (menu.sel + 3) % 4; play('move'); } if (pr.has('R')) { menu.sel = (menu.sel + 1) % 4; play('move'); }
        if (pr.has('Z')) mainAction(menu.sel);
        if (pr.has('X') && info && info.n < info.text.length) info.n = info.text.length;
      } else if (menu?.kind === 'list') {
        const n = menu.what === 'item' ? Math.min(4, menu.items.length - menu.page * 4) : menu.items.length;
        if (menu.what === 'item') {
          const pages = Math.ceil(menu.items.length / 4), col = menu.sel % 2, row = menu.sel >> 1, cnt = pg => Math.min(4, menu.items.length - pg * 4);
          if (pr.has('R')) { if (col === 0 && menu.sel + 1 < n) menu.sel++; else if (menu.page < pages - 1) { menu.page++; menu.sel = Math.min(row * 2, cnt(menu.page) - 1); } play('move'); }
          if (pr.has('L')) { if (col === 1) menu.sel--; else if (menu.page > 0) { menu.page--; menu.sel = Math.min(row * 2 + 1, cnt(menu.page) - 1); } play('move'); }
          if (pr.has('U') && menu.sel >= 2) { menu.sel -= 2; play('move'); } if (pr.has('D') && menu.sel + 2 < n) { menu.sel += 2; play('move'); }
        } else { if (pr.has('U')) { menu.sel = (menu.sel + n - 1) % n; play('move'); } if (pr.has('D')) { menu.sel = (menu.sel + 1) % n; play('move'); } }
        if (pr.has('X')) { play('move'); const back = { act: 'actEnemy' }[menu.what]; if (back) menu = { kind: 'list', what: back, items: ['선도부장'], sel: 0 }; else openMain(); }
        else if (pr.has('Z')) listAction();
      }
      if (hp <= 0) die();
    } else if (m === 'text') {
      krTick(dt);
      if (pr.has('Z') || pr.has('X')) { if (info.n < info.text.length) { info.n = info.text.length; } else { const cb = info.cb; info = null; cb?.(); } }
    } else if (m === 'target') { krTick(dt); if (ending) endingTick(dt); }
    else if (m === 'stall') { stallTick(dt); krTick(dt); }
    else if (m === 'final' || m === 'toMenu') { krTick(dt); if (m === 'toMenu') { menuBonesTick(dt); } }
    else if (m === 'dead') {
      const o = over; o.t += dt;
      if (o.t > 20 / 30 && !o.split) { o.split = true; play('Break'); }
      if (o.t > 1.6 && !o.sh.length) { play('Shatter'); for (let i = 0; i < 6; i++) o.sh.push({ x: o.x, y: o.y, vx: (Math.random() * 2 - 1) * 120, vy: -Math.random() * 180 - 40, f: rnd(4), a: 0 }); }
      for (const s of o.sh) { s.vy += 300 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += dt * 8; }
      if (o.t > 3.2 && !o.msg) o.msg = { text: trapped ? '선배 말을 다 믿으면 안 돼…' : hits >= 14 ? '거의 다 왔어. 한 번만 더!' : '아직 쉬는 시간이 남았어…\n포기하지 마!', n: 0 };
      if (o.msg) { const L = o.msg.text.length; if (o.msg.n < L) { const ol = Math.floor(o.msg.n); o.msg.n = Math.min(L, o.msg.n + dt * 18); if (Math.floor(o.msg.n) > ol) play('txt'); } }
      if (o.t > 3.6 && pr.has('Z')) { G.mode = 'title'; G.sel = 0; }
    } else if (m === 'win') { winT += dt; if (winT > 1.5 && pr.has('Z')) { G.mode = 'title'; G.sel = 0; } }
    if (G.mode === 'attack' || G.mode === 'menu' || G.mode === 'stall') { if (hp <= 0) die(); }
    if (ending && G.mode === 'endtalk') endingTick(dt);
    pr.clear(); rel.clear();
  }
  function checkMenuHit() {
    if (!menu) return;
    // 메뉴 별 위치: 버튼 왼쪽 / 목록 글자 왼쪽
    let hx, hy;
    if (menu.kind === 'main') { hx = BTNS[menu.sel].x + 8 + 8; hy = 432 + 21; }
    else if (menu.what === 'item') { hx = 64 + (menu.sel % 2) * 256 - 26 + 8; hy = 272 + (menu.sel >> 1) * 32 + 15; }
    else { hx = 64 - 26 + 8; hy = 272 + menu.sel * 32 + 15; }
    heart.x = hx; heart.y = hy; heart.vis = true; heart.vx = heart.vy = 0;
    checkHits();
  }
  /* ── 이름 정하기(원작의 이름 짓기 화면처럼: 입력 → '이 이름이 맞나요?' → 아니요/예) ── */
  function pname(raw) { const n = cleanName(store.get('jd_name', '')); return raw ? n : n || '나'; }
  function nameOpen(after) {
    G.mode = 'name'; G.nameAfter = after; nameIn.value = pname(true); nameIn.hidden = false; placeName();
    setTimeout(() => { try { nameIn.focus(); nameIn.select(); } catch {} }, 0);
  }
  function placeName() { const k = cv.clientWidth / VW || 1; nameIn.style.fontSize = Math.round(30 * k) + 'px'; nameIn.style.top = Math.round(214 * k) + 'px'; }
  function nameClose() { nameIn.hidden = true; nameIn.blur(); }
  function nameDone() { const v = cleanName(nameIn.value); if (!v) { play('move'); return; } G.nameVal = v; G.nameT = 0; G.nameSel = 1; nameClose(); G.mode = 'nameok'; play('select'); }
  function titleOpts() {
    const o = [{ id: 'new', n: '처음부터 결투' }];
    if (store.get('jd_ck', 0)) o.push({ id: 'ck', n: '중간 지점부터' });
    o.push({ id: 'name', n: '이름 바꾸기' }, { id: 'help', n: '조작법' });
    if (G.sel >= o.length) G.sel = 0;
    return o;
  }

  /* ═════════ 그리기 ═════════ */
  const img = (c, x, y, sx = 2, sy = sx) => X.drawImage(c, Math.round(x), Math.round(y), c.width * sx, c.height * sy);
  function txt(s, x, y, size = 22, col = '#fff', al = 'left', font = F11) { X.font = `${size}px ${font}`; X.fillStyle = col; X.textAlign = al; X.textBaseline = 'top'; X.fillText(s, Math.round(x), Math.round(y)); }
  function drawSans() {
    const sx = sans.x, sy = sans.y; if (sans.alpha <= 0) return;
    X.globalAlpha = sans.alpha;
    let tx = 0, ty = 0, hx = 0, hy = 0;
    const T1 = sans.tT;
    if (sans.anim === 'Idle') { const t = T1 % 1.2; tx = Math.sin(360 * t / 1.2 * D2R); ty = Math.sin(720 * t / 1.2 * D2R); hy = -Math.sin(720 * t / 1.2 * D2R) * .4; }
    else if (sans.anim === 'HeadBob') { const t = T1 % 1.1; hx = Math.sin(360 * t / 1.1 * D2R); hy = Math.sin(720 * t / 1.1 * D2R); }
    else if (sans.anim === 'Tired') { const t = T1 % 3.8; ty = Math.sin(360 * t / 3.8 * D2R); hy = Math.sin(360 * t / 3.8 * D2R); }
    const walkBob = sans.walk ? Math.abs(Math.sin(sans.walk * 6)) * -3 : 0;
    const legsY = sy - 46 + walkBob;
    img(ART.legs, sx - 44, legsY);
    const torso = sans.pose ? ART.torso.base : ART.torso[sans.torso] || ART.torso.default;
    const tW = torso.width * 2, torsoY = legsY - 50 + 4 + ty;
    img(torso, sx - tW / 2 + tx, torsoY);
    if (sans.pose) { const f = Math.min(4, Math.floor(sans.poseT * 20)); img(ART.arm[sans.pose][f], sx + 34 - 64 + tx, torsoY + 12 - 64); }
    let hk = sans.head; if (hk === 'blue') hk = Math.floor(T * 12) % 2 ? 'blue0' : 'blue1';
    const headY = torsoY - 60 + 4 + hy;
    img(ART.head[hk] || ART.head.default, sx - 32 + hx + tx * .5, headY);
    if (sans.sweat) img(ART.sweat[Math.min(3, sans.sweat)], sx - 32 + hx, headY + 2);
    X.globalAlpha = 1;
  }
  function drawRuler(x, y, w, h, col) {   // 자 — 굵기가 일정한 납작한 자 + 한쪽 가장자리 눈금(5칸마다 긴 눈금)
    const fill = col === 1 ? BLUECOL : col === 2 ? ORANGECOL : '#f4f6ff', edge = col === 1 ? '#0e7fc4' : col === 2 ? '#c06a10' : '#aab2cf', tick = col === 1 ? '#064a75' : col === 2 ? '#6e3a00' : '#3a3f55';
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); if (w <= 0 || h <= 0) return;
    X.fillStyle = fill; X.fillRect(x, y, w, h);
    X.fillStyle = edge;
    if (h >= w) {   // 세로 자
      X.fillRect(x + w - 1, y, 1, h); X.fillRect(x, y, w, 1); X.fillRect(x, y + h - 1, w, 1);
      X.fillStyle = tick; for (let yy = 3, i = 0; yy < h - 2; yy += 3, i++) X.fillRect(x, y + yy, i % 5 === 0 ? Math.ceil(w * .6) : Math.ceil(w * .3), 1);
    } else {        // 가로 자
      X.fillRect(x, y + h - 1, w, 1); X.fillRect(x, y, 1, h); X.fillRect(x + w - 1, y, 1, h);
      X.fillStyle = tick; for (let xx = 3, i = 0; xx < w - 2; xx += 3, i++) X.fillRect(x + xx, y, 1, i % 5 === 0 ? Math.ceil(h * .6) : Math.ceil(h * .3));
    }
  }
  function drawGb(g) {
    if (g.beam) {
      X.save(); X.translate(g.x, g.y); X.rotate(g.ang * D2R);
      const s = Math.sin(g.bt * 30 / 1.5) * g.base / 4, a = Math.max(0, Math.min(1, g.op / 100));
      X.globalAlpha = a; X.fillStyle = '#ffffff';
      const b1 = g.base + s, b2 = g.base / 1.25 + s, b3 = g.base / 2 + s;
      X.fillRect(70 * g.scale, -b1 / 2, 1000, b1);
      X.fillRect(60 * g.scale, -b2 / 2, 10 * g.scale, b2);
      X.fillRect(50 * g.scale, -b3 / 2, 10 * g.scale, b3);
      X.globalAlpha = 1; X.restore();
    }
    const f = g.st >= 2 ? Math.min(4, 1 + Math.floor(g.fireT * 30)) - (g.st === 3 && Math.floor(g.fireT * 30) % 2 ? 1 : 0) : 0;
    const im = ART.gb[Math.max(0, f)];
    X.save(); X.translate(g.x, g.y); X.rotate(g.ang * D2R); X.drawImage(im, -im.width * g.wS / 2, -im.height * g.hS / 2, im.width * g.wS, im.height * g.hS); X.restore();
  }
  function drawZone() {
    if (!zone.vis) return;
    X.fillStyle = '#000'; X.fillRect(zone.l, zone.t, zone.r - zone.l, zone.b - zone.t);
  }
  function drawZoneBorder() {
    if (!zone.vis) return;
    X.fillStyle = '#fff'; const w = zone.r - zone.l, h = zone.b - zone.t;
    X.fillRect(zone.l, zone.t, w, 5); X.fillRect(zone.l, zone.b - 5, w, 5); X.fillRect(zone.l, zone.t, 5, h); X.fillRect(zone.r - 5, zone.t, 5, h);
  }
  function drawHud() {
    txt(`${pname()}   3학년`, 32, 401, 22);
    txt('체력', 248, 403, 18, '#fff', 'right', F9);
    const bw = Math.floor(MAXHP * 1.2);
    X.fillStyle = '#c00000'; X.fillRect(256, 400, bw, 21);
    X.fillStyle = '#ff00ff'; X.fillRect(256, 400, bw * Math.max(0, hp) / MAXHP, 21);
    X.fillStyle = '#ffff00'; X.fillRect(256, 400, bw * Math.max(0, hp - kr) / MAXHP, 21);
    txt(`${String(Math.max(0, hp)).padStart(2, '0')} / ${MAXHP}`, 256 + bw + 18, 401, 22, kr > 0 ? '#ff00ff' : '#fff');
    for (let i = 0; i < 4; i++) {
      const b = BTNS[i], on = menu?.kind === 'main' ? menu.sel === i : (menu && G.lastBtn === i), col = on ? YELLOW : ORANGE;
      X.fillStyle = col; X.fillRect(b.x, 432, 110, 3); X.fillRect(b.x, 471, 110, 3); X.fillRect(b.x, 432, 3, 42); X.fillRect(b.x + 107, 432, 3, 42);
      txt(b.n, b.x + 66, 442, 22, col, 'center');
      if (!(on && menu?.kind === 'main')) drawIcon(i, b.x + 20, 453, col);
    }
  }
  function drawIcon(i, x, y, c) {   // 버튼 아이콘(도트)
    X.fillStyle = c; const R = (a, b, w, h) => X.fillRect(x + a, y + b, w, h);
    if (i === 0) { for (let k = 0; k < 9; k++) R(-6 + k, 4 - k, 2, 2); R(-7, 1, 6, 2); R(-5, -1, 2, 6); }
    else if (i === 1) { R(-3, -8, 6, 6); R(-6, 0, 12, 2); R(-7, 2, 3, 6); R(4, 2, 3, 6); R(-3, 2, 6, 6); }
    else if (i === 2) { R(-7, -3, 14, 11); X.fillStyle = '#000'; R(-5, -1, 10, 2); X.fillStyle = c; R(-3, -7, 2, 4); R(1, -7, 2, 4); R(-3, -7, 6, 2); }
    else { for (let k = 0; k < 7; k++) { R(-7 + k * 2, -7 + k * 2, 3, 3); R(5 - k * 2, -7 + k * 2, 3, 3); } }
  }
  function drawHeart(x, y, split) {
    const im = heart.mode === 1 && G.mode !== 'menu' ? ART.star.blue : ART.star.red;
    img(split ? ART.star.split : im, x - 8, y - (split ? 10 : 8), 1);
  }
  function drawBubble(b) {
    const x = Math.round(sans.x + 52), y = Math.round(sans.y - 170);
    const lines = wrapLines(b.text.slice(0, Math.floor(b.n)), 200, 18, F9);
    const h = Math.max(104, 24 + lines.length * 24);
    X.fillStyle = '#fff'; X.fillRect(x + 14, y, 223, h); X.fillRect(x + 12, y + 2, 2, h - 4); X.fillRect(x + 237, y + 2, 2, h - 4);
    for (let k = 0; k < 12; k++) X.fillRect(x + 14 - k, y + 34 + k / 2, 1, Math.max(1, 12 - k));   // 꼬리
    if (b.shake) {   // 글자마다 따로 덜덜 떨림
      X.font = `18px ${F9}`;
      lines.forEach((l, i) => { let cx = x + 30; for (const ch of l) { const jx = Math.round((Math.random() - .5) * 2.4), jy = Math.round((Math.random() - .5) * 2.4); txt(ch, cx + jx, y + 14 + i * 24 + jy, 18, '#000', 'left', F9); X.font = `18px ${F9}`; cx += X.measureText(ch).width; } });
    } else lines.forEach((l, i) => txt(l, x + 30, y + 14 + i * 24, 18, '#000', 'left', F9));
  }
  function wrapLines(s, w, size, font) {
    X.font = `${size}px ${font}`; const out = [];
    for (const para of s.split('\n')) { let cur = ''; for (const ch of para) { if (X.measureText(cur + ch).width > w) { out.push(cur); cur = ch.trimStart(); } else cur += ch; } out.push(cur); }
    return out;
  }
  function drawInfo(i) {
    const shown = i.text.slice(0, Math.floor(i.n)).split('\n');
    shown.forEach((l, k) => txt(l, 52, 272 + k * 32, 22));
  }
  function drawMenuList() {
    const m = menu;
    if (m.what === 'item') {
      const pg = m.items.slice(m.page * 4, m.page * 4 + 4);
      pg.forEach((s, i) => txt('* ' + s, 64 + (i % 2) * 256, 272 + (i >> 1) * 32, 22));
      txt(`${m.page + 1}쪽`, 384, 336, 22);
    } else {
      m.items.forEach((s, i) => txt('* ' + s, 64, 272 + i * 32, 22, m.what === 'mercy' && hits === 13 ? YELLOW : '#fff'));
    }
  }
  function drawTarget() {
    const t = target, cx = 320, cy = 321, w = Math.max(0, t.w), h = 117;
    X.globalAlpha = Math.max(0, Math.min(1, t.op));
    X.fillStyle = '#000'; X.fillRect(cx - w / 2, cy - h / 2, w, h);
    X.strokeStyle = '#fff'; X.lineWidth = 2;
    for (let k = 0; k < 9; k++) { const rw = w / 2 * (1 - k / 9); X.strokeRect(cx - rw, cy - h / 2 + 6 + k * 2, rw * 2, h - 12 - k * 4); }
    X.fillStyle = '#20c040'; X.fillRect(cx - 6, cy - h / 2 + 6, 12, h - 12);
    X.fillStyle = '#fff'; for (let k = -13; k <= 13; k++) if (k) X.fillRect(cx + k * 20 - 1, cy - h / 2 + 8, 2, k % 2 ? 10 : 18);
    X.globalAlpha = 1;
    if (t.st < 2) {
      const blink = t.st === 1 && Math.floor(t.blink * 12) % 2;
      X.fillStyle = blink ? '#000' : '#fff'; X.fillRect(t.x - 7, cy - 64, 14, 128);
      X.fillStyle = blink ? '#fff' : '#000'; X.fillRect(t.x - 3, cy - 60, 6, 120);
    }
  }
  function drawStrike() {
    const s = strike, f = Math.min(5, Math.floor(s.t * 14));
    X.fillStyle = '#ff2020';
    const len = [12, 40, 70, 96, 70, 30][f], wdt = [4, 6, 8, 10, 6, 4][f];
    X.save(); X.translate(s.x, s.y); X.rotate(-0.9);
    X.fillRect(-wdt / 2, -len / 2, wdt, len); X.restore();
  }
  function render() {
    X.setTransform(S, 0, 0, S, 0, 0); X.imageSmoothingEnabled = false;
    X.fillStyle = '#000'; X.fillRect(0, 0, VW, VH);
    const m = G.mode;
    if (m === 'title' || m === 'help') return renderTitle();
    if (m === 'name') { txt('이름을 정해 주세요.', 320, 130, 30, '#fff', 'center'); X.fillStyle = '#fff'; X.fillRect(200, 262, 240, 3); txt('최대 6글자 · Enter 확정 · Esc 돌아가기', 320, 300, 18, '#c8c8c8', 'center', F9); return; }
    if (m === 'nameok') {
      const k = Math.min(1, G.nameT / 2.4), sz = 30 + k * 60, j = () => (Math.random() - .5) * 2 * k;
      X.save(); X.translate(320 + j(), 200 + j()); txt(G.nameVal, 0, -sz / 2, sz, '#fff', 'center'); X.restore();
      txt('이 이름이 맞나요?', 320, 70, 22, '#fff', 'center');
      ['아니요', '예'].forEach((t, i) => { const x = i ? 420 : 220, on = G.nameSel === i; txt(t, x, 400, 26, on ? YELLOW : '#fff', 'center'); if (on) { X.font = `26px ${F11}`; img(ART.star.red, x - X.measureText(t).width / 2 - 26, 405, 1); } });
      return;
    }
    if (m === 'win') return renderWin();
    if (m === 'dead') return renderDead();
    X.translate(shX, shY);
    drawSans();
    if (bubble) drawBubble(bubble);
    drawZone();
    // 상자 안(잘림): 세로 자·찌르기·발판
    X.save(); X.beginPath(); X.rect(zone.l, zone.t, zone.r - zone.l, zone.b - zone.t); X.clip();
    for (const p of plats) { X.fillStyle = '#008000'; X.fillRect(p.x, p.y, p.w, 7); X.fillStyle = '#20e040'; X.fillRect(p.x, p.y, p.w, 2); X.fillRect(p.x, p.y + 5, p.w, 2); X.fillRect(p.x, p.y, 2, 7); X.fillRect(p.x + p.w - 2, p.y, 2, 7); }
    for (const b of bones) if (b.v) drawRuler(b.x, b.y, b.w, b.h, b.col);
    for (const s of stabs) {
      if (s.dir === 1 || s.dir === 3) for (let x = s.x; x < s.x + s.w; x += 12) drawRuler(x + 1, s.y, 10, s.h, 0);
      else for (let y = s.y; y < s.y + s.h; y += 12) drawRuler(s.x, y + 1, s.w, 10, 0);
    }
    if (info && (m === 'menu' || m === 'text')) drawInfo(info);
    if (menu?.kind === 'list') drawMenuList();
    if (target) drawTarget();
    X.restore();
    for (const w of warns) { X.strokeStyle = '#ff0000'; X.lineWidth = 2; X.strokeRect(w.r[0] + 1, w.r[1] + 1, w.r[2] - 2, w.r[3] - 2); }
    for (const b of bones) if (!b.v) drawRuler(b.x, b.y, b.w, b.h, b.col);
    drawZoneBorder();
    for (const g of gbs) drawGb(g);
    drawHud();
    for (const mb of mbones) drawRuler(mb.x - 7, mb.y - 22, 14, 44, 0);
    if (heart.vis && (m === 'attack' || m === 'stall' || (m === 'menu' && menu))) drawHeart(heart.x, heart.y);
    if (black) { X.fillStyle = '#000'; X.fillRect(-10, -10, VW + 20, VH + 20); if (heart.vis) drawHeart(heart.x, heart.y); }
    if (strike) drawStrike();
    for (const p of popTexts) if (!(p.delay > 0)) txt(p.text, p.x, p.y - Math.min(10, p.t * 40), 30, '#c0c0c0');
    if (dmgText) {
      const t = dmgText.t; txt(String(dmgText.n), 320, 50 - (t < .3 ? Math.sin(t / .3 * Math.PI) * 18 : 0), 32, '#ff2020', 'center');
      X.fillStyle = '#404040'; X.fillRect(220, 92, 200, 13); X.fillStyle = '#00ff00'; X.fillRect(220, 92, 200 * Math.max(0, 1 - t / 1.2), 13);
    }
    if (paused) { X.setTransform(S, 0, 0, S, 0, 0); X.fillStyle = 'rgba(0,0,0,.72)'; X.fillRect(0, 0, VW, VH); txt('일시정지', 320, 200, 44, '#fff', 'center'); txt('Esc · 화면 탭으로 계속', 320, 262, 18, '#c8c8c8', 'center', F9); }
  }
  function renderTitle() {
    sans.y = 236; const sv = { ...sans }; sans.x = 320; sans.head = G.mode === 'help' ? 'wink' : 'default'; sans.pose = null; sans.anim = 'Idle'; drawSans(); Object.assign(sans, sv);
    txt('복도의 심판', 320, 258, 44, '#fff', 'center');
    if (G.mode === 'help') {
      ['방향키·화면 패드: 별 움직이기 (X 누르고 있으면 천천히)', 'Z/Enter 확인 · X 취소 · Esc 멈춤', '빨간 별: 자유롭게 · 파란 별: 중력! 점프는 ↑(길게 누르면 높이)',
        '흰 자: 무조건 피하기 · 파란 자: 가만히 있으면 안 아픔', "'반항'을 해야 결투가 진행됨 · 맞은 뒤에도 체력이 천천히 더 깎임"].forEach((l, i) => txt(l, 320, 318 + i * 26, 18, '#c8c8c8', 'center', F9));
      txt('Z: 돌아가기', 320, 454, 18, '#808080', 'center', F9); return;
    }
    titleOpts().forEach((o, i) => { const on = i === G.sel; txt(o.n, 320, 312 + i * 32, 22, on ? YELLOW : '#fff', 'center'); if (on) { X.font = `22px ${F11}`; img(ART.star.red, 320 - X.measureText(o.n).width / 2 - 26, 315 + i * 32, 1); } });
    const best = rec.clear ? `승리 ${rec.clear}번 · 가장 빠른 승리 ${fmtT(rec.fast)}` : `가장 멀리 간 곳 ${rec.best ? (rec.best >= 23 ? '필살기' : rec.best >= 14 ? `2막 ${rec.best - 13}턴` : `1막 ${rec.best}턴`) : '—'}`;
    txt(`${pname(true) ? pname() + ' · ' : ''}${best} · 쓰러진 횟수 ${rec.deaths}`, 320, 452, 18, '#808080', 'center', F9);
  }
  const fmtT = ms => ms ? `${Math.floor(ms / 60000)}분 ${Math.floor(ms / 1000) % 60}초` : '—';
  function renderDead() {
    const o = over;
    if (o.t < 1.6) { if (o.split || o.t > 20 / 30) drawHeart(o.x, o.y, true); else drawHeart(o.x, o.y); }
    for (const s of o.sh) { X.save(); X.translate(s.x, s.y); X.rotate(s.a); X.drawImage(ART.shard[s.f], -8, -8); X.restore(); }
    if (o.t > 2.4) { X.globalAlpha = Math.min(1, (o.t - 2.4) * 1.5); txt('결투 실패', 320, 110, 64, '#fff', 'center'); X.globalAlpha = 1; }
    if (o.msg) o.msg.text.slice(0, Math.floor(o.msg.n)).split('\n').forEach((l, i) => txt(l, 150, 290 + i * 34, 22));
    if (o.t > 3.6) txt('Z · 화면 탭: 처음 화면', 320, 440, 18, '#808080', 'center', F9);
  }
  function renderWin() {
    txt('* 이겼다!', 120, 150, 22); txt('* 상점 0점, 벌점 0점을 얻었다.', 120, 190, 22); txt(`* ${pname()}${pname().length ? '은(는)' : ''} 졸업장을 받았다.`, 120, 230, 22);
    txt(`걸린 시간 ${fmtT(G.winMs)}${ck ? ' (중간 지점부터)' : ''} · 지금까지 쓰러진 횟수 ${rec.deaths}`, 320, 320, 18, '#c8c8c8', 'center', F9);
    if (winT > 1.5) txt('Z · 화면 탭: 처음 화면', 320, 440, 18, '#808080', 'center', F9);
  }

  /* ── 루프 ── */
  function togglePause() { if (['title', 'help', 'win', 'dead', 'name', 'nameok'].includes(G.mode)) return; paused = !paused; for (const k in held) held[k] = 0; if (AC) { paused ? AC.suspend?.() : AC.resume?.(); } }
  const vis = () => { if (document.hidden && !paused) togglePause(); };
  const blur = () => { clearKeys(); if (!paused && ['attack', 'stall'].includes(G.mode)) togglePause(); };
  document.addEventListener('visibilitychange', vis); addEventListener('blur', blur); addEventListener('resize', fit); addEventListener('resize', placeName);
  function loop(ts) {
    if (!alive) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (ts - last) / 1000 || 0); last = ts;
    if (paused) { if (pr.has('Z')) togglePause(); pr.clear(); rel.clear(); }
    else { acc += dt * (O._speed ?? 1); let n = 0; while (acc >= DT && n++ < 12) { step(DT); acc -= DT; } if (n >= 12) acc = 0; }
    render();
  }
  return {
    start() { fit(); last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); musOn = false;
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      document.removeEventListener('visibilitychange', vis); removeEventListener('focus', clearKeys); removeEventListener('pointermove', syncMods, true); removeEventListener('blur', blur); removeEventListener('resize', fit); removeEventListener('resize', placeName);
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
      try { AC?.close(); } catch {}
    },
    _g: { G, heart, zone, sans, step, press, release, held, newRun, startAttack, enemyTurn, get hp() { return hp; }, set hp(v) { hp = v; }, get hits() { return hits; }, set hits(v) { hits = v; }, get kr() { return kr; },
      get TL() { return TL; }, get counts() { return { bones: bones.length, gbs: gbs.length, stabs: stabs.length, plats: plats.length }; }, render },
  };
}
