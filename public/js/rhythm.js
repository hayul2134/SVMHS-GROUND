// SVMHS GROUND — 방송실 리듬 배틀(2026-11-02 하율: "프라이데이 나이트 펌킨 방식", 미리보기 깃발 rhythm-game)
// 2차(같은 날 하율 "디벨롭 — 바로 출시해도 될 정도로, FNF를 많이 참고"): FNF의 구조를 따름 —
//   스토리 모드(방송부 주간 3곡 연속)·자유 플레이·난이도 3단(노트 수·속도)·상대/내 화살표 줄·카메라가 부르는 사람 쪽으로·마디마다 줌 쿵
//   아래 체력 바 + 얼굴 아이콘(박자마다 통통, 지면 울상)·판정 4단(완벽/좋아/아쉬워/별로)+콤보 숫자·완벽 판정 물보라·놓치면 내 캐릭터가 파랗게
//   카운트다운 3·2·1·가자·Enter/Esc 멈춤·게임 오버·결과 등급·설정(아래로 스크롤·가운데 보기·빈 누르기 허용·타격음·박자 보정)
// 이름·캐릭터·노래·그림은 전부 새로 만듦(FNF 에셋 안 씀). 노래는 Web Audio 합성 — 멜로디(음 단계)가 곧 채보(단계 % 4 = 화살표)
// 서버·랭킹 없음(랭크 규칙은 하율 결정 대기) → 이 기기 기록만: sg_rb_rec(곡_난이도 최고 점수·정확도) · sg_rb_week · sg_rb_opt · sg_rb_off(ms)
// createRhythm(el, O) → { start, destroy }
import { store } from './util.js';

const FONT = 'Jua, system-ui, sans-serif', INK = '#2a2846';
const COL = ['#b07cff', '#3fc4f2', '#3ed27a', '#ff5d72'];
const ROT = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
const KEY_DEF = [['KeyD', 'ArrowLeft'], ['KeyF', 'ArrowDown'], ['KeyJ', 'ArrowUp'], ['KeyK', 'ArrowRight']];
const KEY_BAN = new Set(['Escape', 'Enter', 'NumpadEnter', 'KeyP', 'Tab', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'CapsLock']);
const keyName = c => !c ? '없음' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : ({ ArrowLeft: '←', ArrowDown: '↓', ArrowUp: '↑', ArrowRight: '→', Space: '스페이스', ShiftLeft: '왼 Shift', ShiftRight: '오른 Shift', Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Quote: "'", BracketLeft: '[', BracketRight: ']', Backspace: '←지우기' })[c] || c.replace('Numpad', '키패드 ');
const ARW = ['←', '↓', '↑', '→'];
const DIFFS = [{ n: '쉬움', sp: 1.05, miss: .016 }, { n: '보통', sp: 1.3, miss: .021 }, { n: '어려움', sp: 1.55, miss: .025 }];
// 판정(FNF 창: 45/90/135/166ms)
const RATE = [
  { n: '완벽!', ms: 45, sc: 350, hp: .0115, w: 1, c: '#ffd84a' },
  { n: '좋아', ms: 90, sc: 200, hp: .0115, w: .7, c: '#7ee0ff' },
  { n: '아쉬워', ms: 135, sc: 100, hp: .004, w: .4, c: '#b9f27c' },
  { n: '별로', ms: 166, sc: 50, hp: 0, w: .15, c: '#ffb27a' },
];
const MAJ = [0, 2, 4, 5, 7, 9, 11], MINS = [0, 2, 3, 5, 7, 8, 10];
const CH = {
  me: { name: '나', body: '#3d7bff', body2: '#2b5fd6', pants: '#2a2f55', hair: '#1d1d2b', skin: '#ffdcbc', hs: 'short', acc: 'cap', capC: '#ffd84a', wave: 'triangle', lp: 3400 },
  sb: { name: '방송부 선배', body: '#9a6cff', body2: '#7a4fe0', pants: '#33285a', hair: '#3b2a7a', skin: '#ffdcbc', hs: 'bob', acc: 'headset', capC: '#3a3d5c', wave: 'square', lp: 1800 },
  gd: { name: '급식 당번', body: '#3ec28f', body2: '#2a9a6e', pants: '#2f3a5c', hair: '#4a2f22', skin: '#ffd9b8', hs: 'short', acc: 'chef', capC: '#ffffff', apron: 1, wave: 'square', lp: 2600 },
  bj: { name: '방송부장', body: '#e0465a', body2: '#b8323f', pants: '#2a2238', hair: '#2a1a1a', skin: '#f7d2b0', hs: 'spike', acc: 'glasses', capC: '#2a2238', wave: 'sawtooth', lp: 1500 },
  pe: { name: '체육부장', body: '#ff8a3d', body2: '#e06a20', pants: '#e06a20', hair: '#1d1d2b', skin: '#f2c9a4', hs: 'short', acc: 'band', capC: '#ff3b5c', wave: 'square', lp: 2200 },
  art: { name: '미술부 선배', body: '#2fb8a8', body2: '#22917f', pants: '#2a2f55', hair: '#c0504d', skin: '#ffdcbc', hs: 'bob', acc: 'beret', capC: '#2a2846', wave: 'triangle', lp: 1700 },
  stu: { name: '전교 1등', body: '#f4f4f8', body2: '#c8ccd8', pants: '#3a4270', hair: '#222230', skin: '#ffdcbc', hs: 'short', acc: 'glasses', capC: '#fff', wave: 'square', lp: 2000 },
  ed: { name: '편집부 선배', body: '#4a4e6e', body2: '#363a56', pants: '#22263e', hair: '#7a5cff', skin: '#f7d2b0', hs: 'spike', acc: 'headset', capC: '#3a3d5c', wave: 'sawtooth', lp: 1800 },
  dc: { name: '댄스부 에이스', body: '#ff4fa0', body2: '#d93583', pants: '#2a2846', hair: '#ffd84a', skin: '#ffdcbc', hs: 'bob', acc: 'cap', capC: '#2a2846', wave: 'square', lp: 2400 },
  lee: { name: 'MR.LEE', body: '#24242e', body2: '#3a3a48', pants: '#1c1c26', hair: '#141418', skin: '#f2c9a4', hs: 'curly', acc: 'shades', capC: '#141418', jaw: 1, tall: 80, torso: 70, chain: 1, wave: 'sawtooth', lp: 1300, oct: -12 },
  fr: { name: '친구', body: '#ffb84d', body2: '#e8962a', pants: '#33406e', hair: '#5a3a2a', skin: '#ffdcbc', hs: 'bob', acc: 'none', capC: '#fff' },
};
const GREY = { body: '#6d7fbd', body2: '#56669f', pants: '#3a4270', hair: '#2d3460', skin: '#c7cfee', capC: '#8d9ad0' };
const DRUMS = {
  basic: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', b: 'x.....x.x.......' },
  synco: { k: 'x.....x...x.....', s: '....x.......x..x', h: 'x.xxx.x.x.xxx.x.', b: 'x..x..x...x..x..' },
  drive: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', b: 'x.x.x.x.x.x.x.x.' },
};
// 곡: sec = I(전주 2마디) · O/P(선배/나 4마디) · X(1마디씩 주고받기) · E(마무리 1마디), 글자 = 프레이즈. 프레이즈 = '박,음 단계[,길게 누르는 박]'
const SONGS = [
  { id: 's1', name: '쉬는 시간 10분 전', opp: 'sb', stage: 'studio', bpm: 120, root: 69, sc: MINS, prog: [0, -4, 3, -2], q: [0, 1, 1, 1], drum: 'basic', pad: 1, arp: 0,
    sec: 'I Oa Pa Ob Pb Oc Pc Xd Od Pd E',
    ph: ['0,0 1,2 2,4 3,2 4,3 5,2 6,1 8,0 9,2 10,4 11,5 12,4,2 14,2 15,1',
      '0,4 0.5,3 1,2 2,4 2.5,5 3,4 4,2,1.5 6,0 6.5,1 7,2 8,4 9,5 10,6,1 12,5 12.5,4 13,3 14,2,1.5',
      '0,0 0.5,1 1,2 1.5,3 2,4 3,2 4,5 5,4 5.5,3 6,2 7,1 8,0 8.5,2 9,4 9.5,6 10,7,1 12,6 12.5,5 13,4 13.5,3 14,4,1.5',
      '0,7 1,6 1.5,5 2,4 3,4 3.5,5 4,6,1 6,4 6.5,2 7,0 8,1 8.5,2 9,3 10,4 10.5,5 11,6 12,7,1 14,4 15,0'] },
  { id: 's2', name: '급식 줄 서기', opp: 'gd', stage: 'cafe', bpm: 140, root: 65, sc: MAJ, prog: [0, 5, -3, -5], q: [1, 1, 0, 1], drum: 'synco', pad: 1, arp: 0,
    sec: 'I Oa Pa Ob Pb Oc Pc Od Pd Xb E',
    ph: ['0,0 0.75,2 1.5,4 2.5,2 3,1 4,0 4.75,2 5.5,4 6,5,1 8,4 8.5,3 9,2 9.75,1 10.5,0 11,1 12,2,2 15,4',
      '0,5 0.5,4 1,2 1.5,4 2,5 3,7,1 4.5,5 5,4 5.5,2 6,0 7,2 8,4 8.75,5 9.5,4 10,2 10.75,1 11.5,0 12,2 12.5,3 13,4,2',
      '0,0 0,3 1,1 1.5,2 2,3 2.5,2 3,1 4,4 4,1 5,5 5.5,4 6,3 6.5,4 7,5 8,7 8.5,6 9,5 9.5,4 10,3 10.5,2 11,1 11.5,0 12,4,1 13.5,2 14,0,1.5',
      '0,2 0.5,2 1,4 1.5,4 2,5 2.75,4 3.5,2 4,0,1 6,4 6.5,5 7,7 8,6 8.5,5 9,4 9.5,3 10,2 10.5,3 11,4 11.5,5 12,7,2 15,0'] },
  { id: 's3', name: '영상고 2짱 래퍼', opp: 'lee', stage: 'hall', boss: 1, bpm: 178, root: 62, sc: MINS, prog: [0, -4, -2, -5], q: [0, 1, 1, 1], drum: 'drive', pad: 1, arp: 1,
    sec: 'I Oa Pa Ob Pb Xc Oc Pc Od Pd Xa Xb Oc Pc Xd E',
    ph: ['0,0 0.5,0 1,2 1.5,0 2,3 2.5,0 3,4 3.5,3 4,2 4.5,0 5,2 5.5,4 6,7,1 7.5,6 8,4 8.5,4 9,5 9.5,4 10,3 10.5,2 11,1 11.5,2 12,0,2 14,4 14.5,5 15,6 15.5,7',
      '0,7 0.5,6 1,5 1.5,4 2,3 2.5,4 3,5 3.5,6 4,7,1 5.5,4 6,2 6.5,4 7,7 8,5 8.25,6 8.5,5 9,4 9.5,2 10,0 10.5,2 11,4 11.5,5 12,4 12.5,2 13,0 13.5,1 14,2,1.5',
      '0,0 0,3 1,1 1,2 2,0 2.5,1 3,2 3.5,3 4,4 4,7 5,5 5.5,6 6,4 6.5,5 7,6 7.5,7 8,0 8.5,2 8.75,3 9,4 9.5,6 10,7 10.5,6 11,4 11.5,2 12,3,1 13.5,1 14,0,1.5',
      '0,4 0.25,5 0.5,6 0.75,7 1,4 2,0 2.5,4 3,7 3.5,4 4,2 4.5,3 5,4 5.5,5 6,6 6.5,5 7,4 7.5,3 8,0 8,3 9,1 9,2 10,0 10,3 11,1 11,2 12,4,3 15,0'] },
  { id: 's4', name: '종례 전 마지막 곡', opp: 'bj', stage: 'class', bpm: 150, root: 62, sc: MINS, prog: [0, -4, -2, -5], q: [0, 1, 1, 1], drum: 'drive', pad: 1, arp: 1, rhy: 'pop', sec: 'I Oa Pa Ob Pb Oc Pc Xd Od Pd E' },
  { id: 's5', name: '체육복 갈아입기', opp: 'pe', stage: 'gym', bpm: 132, root: 64, sc: MAJ, prog: [0, -3, 5, 7], q: [1, 0, 1, 1], drum: 'synco', pad: 0, arp: 1, rhy: 'funk', sec: 'I Oa Pa Ob Pb Xc Oc Pc Od Pd E' },
  { id: 's6', name: '옥상 달빛', opp: 'art', stage: 'roof', bpm: 104, root: 67, sc: MINS, prog: [0, -4, -7, -2], q: [0, 1, 0, 1], drum: 'basic', pad: 1, arp: 1, rhy: 'funk', sec: 'I Oa Pa Ob Pb Oc Pc Od Pd E' },
  { id: 's7', name: '기말고사 D-1', opp: 'stu', stage: 'class', bpm: 158, root: 60, sc: MINS, prog: [0, 3, -2, -5], q: [0, 1, 1, 1], drum: 'drive', pad: 1, arp: 0, rhy: 'rush', sec: 'I Oa Pa Ob Pb Xc Oc Pc Od Pd E' },
  { id: 's8', name: '편집실 야근', opp: 'ed', stage: 'studio', bpm: 126, root: 65, sc: MINS, prog: [0, -4, 3, -2], q: [0, 1, 1, 1], drum: 'basic', pad: 1, arp: 1, rhy: 'pop', sec: 'I Oa Pa Ob Pb Oc Pc Xd Od Pd E' },
  { id: 's9', name: '축제 리허설', opp: 'dc', stage: 'hall', bpm: 145, root: 66, sc: MAJ, prog: [0, 5, -3, 7], q: [1, 1, 0, 1], drum: 'synco', pad: 1, arp: 1, rhy: 'funk', sec: 'I Oa Pa Ob Pb Xc Oc Pc Od Pd Xa E' },
];
// 자유 플레이 순서 = 난이도 순(22:21 하율) — 어려움 기준 내 화살표 수 ÷ 곡 길이로 줄 세움, 보스는 맨 끝. 별 1~5 = 그 사이 비율. 스토리는 SONGS 0·1·2
let FREE = null, STARS = null;
function rankSongs() {
  if (FREE) return; const d = SONGS.map((S, i) => { const B = buildSong(S, 2); return [i, B.notes.filter(n => n.who === 1).length / (B.beats * B.spb)]; });
  const nb = d.filter(([i]) => !SONGS[i].boss), lo = Math.min(...nb.map(x => x[1])), hi = Math.max(...nb.map(x => x[1]));
  FREE = nb.sort((a, b) => a[1] - b[1]).map(x => x[0]).concat(d.filter(([i]) => SONGS[i].boss).map(x => x[0]));
  STARS = {}; for (const [i, v] of d) STARS[i] = SONGS[i].boss ? 6 : 1 + Math.round(4 * (v - lo) / (hi - lo || 1));
}

// ── 채보 만들기 ──
// 노트 밀도 단계(2026-11-02 하율 "화살표를 더 많이"): 0 = 정박만 · 1 = 8분 솎기 · 2 = 쓴 그대로 · 3 = 빈 박에 8분 채우기 + 동시 누르기 · 4(보스 어려움) = 16분 붙이기 + 동시 누르기 많이
// 난이도 → 단계: 쉬움 0 · 보통 2 · 어려움 3, 보스 곡은 +1
const LVL = [0, 2, 3];
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = str => [...str].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
// 프레이즈 자동 작곡(새 곡): 마디마다 리듬 틀을 고르고 음 단계는 주로 한두 칸씩 움직임 → 단계 % 4가 화살표라 계단·지그재그가 자연스럽게 나옴
const RHY = {
  chill: ['x...x...x...x...', 'x.....x.x...x...', 'x...x.x.x.......', 'x.x.x...x...x...'],
  pop: ['x...x.x.x...x.x.', 'x.x.x.x.x...x...', 'x..x..x.x.x.x...', 'x.x...x.x.x.x...'],
  funk: ['x..x..x...x.x...', 'x.xx..x..x..x...', 'x..x.x..x..x.x..', 'x.x..x.x..x.x...'],
  rush: ['x.x.x.x.x.x.x.x.', 'xxx.x.x.xxx.x.x.', 'x.xxx.x.x.xxx.x.', 'x.x.xxx.x.x.xxx.'],
};
function compose(id, style) {
  const r = rng(seedOf(id)), out = [];
  for (let p = 0; p < 4; p++) {
    let d = 2 + Math.floor(r() * 4); const ns = [];
    for (let bar = 0; bar < 4; bar++) {
      const pat = RHY[style][Math.floor(r() * 4)];
      for (let st = 0; st < 16; st++) {
        if (pat[st] !== 'x') continue; const b = bar * 4 + st / 4;
        if (bar === 3 && st >= 8) { if (p % 2 === 0) { ns.push(b + ',' + d + ',2'); } else ns.push(b + ',' + d); break; }
        const big = r() < 0.15, step = (r() < 0.5 ? -1 : 1) * (big ? 3 : r() < 0.3 ? 2 : 1);
        d = Math.max(0, Math.min(9, d + step)); ns.push(b + ',' + d);
      }
    }
    out.push(ns.join(' '));
  }
  return out;
}
function densify(list, lvl, r) {
  if (lvl < 3) return list;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const n = list[i], nx = list[i + 1]; out.push(n);
    if (n.l > 0) continue;
    if (nx) {
      const gap = nx.beat - n.beat;
      if (gap >= 1 && gap <= 2) out.push({ beat: n.beat + 0.5, d: n.d + (nx.d >= n.d ? 1 : -1), l: 0, who: n.who });
      if (lvl >= 4 && gap === 0.5) out.push({ beat: n.beat + 0.25, d: n.d + (r() < 0.5 ? 1 : -1), l: 0, who: n.who });
      if (lvl >= 4 && gap >= 1) out.push({ beat: n.beat + 0.25, d: n.d - 1, l: 0, who: n.who });
    }
    if (n.beat % 1 === 0 && r() < (lvl >= 4 ? 0.45 : 0.2)) out.push({ beat: n.beat, d: n.d + 2, l: 0, who: n.who });   // 동시 누르기(화살표 2칸 차이)
  }
  return out.sort((a, b) => a.beat - b.beat || a.d - b.d);
}
function buildSong(S, diff) {
  const spb = 60 / S.bpm, raw = [], secs = []; let c = 0, lvl = Math.min(4, LVL[diff] + (S.boss ? 1 : 0));
  const ph = (S.ph || (S.ph = compose(S.id, S.rhy))).map(s => s.split(' ').map(t => t.split(',').map(Number)));
  for (const tok of S.sec.split(' ')) {
    const k = tok[0], p = ph[(tok.charCodeAt(1) || 97) - 97];
    if (k === 'I') { secs.push({ b0: c, b1: c + 8, who: 2 }); c += 8; continue; }
    if (k === 'E') { secs.push({ b0: c, b1: c + 4, who: 2 }); c += 4; continue; }
    if (k === 'O' || k === 'P') { const who = k === 'P' ? 1 : 0; for (const [b, d, l] of p) raw.push({ beat: c + b, d, l: l || 0, who }); secs.push({ b0: c, b1: c + 16, who }); }
    else for (const h of [0, 8]) {   // X: 선배 1마디 → 내가 같은 마디
      const bar = p.filter(n => n[0] >= h && n[0] < h + 4);
      for (const [b, d, l] of bar) { raw.push({ beat: c + b, d, l: Math.max(0, Math.min(l || 0, 3.5 - (b - h))), who: 0 }); raw.push({ beat: c + b + 4, d, l: Math.max(0, Math.min(l || 0, 3.5 - (b - h))), who: 1 }); }
      secs.push({ b0: c + h, b1: c + h + 4, who: 0 }, { b0: c + h + 4, b1: c + h + 8, who: 1 });
    }
    c += 16;
  }
  const lane = d => ((d % 4) + 4) % 4;
  const pitch = d => S.root + S.sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const out = [];
  for (const who of [0, 1]) {
    const list = raw.filter(n => n.who === who).sort((a, b) => a.beat - b.beat || a.d - b.d);
    let kept = []; let last = -9;
    for (const n of list) {   // 난이도: 어려움 = 전부 · 보통 = 16분 빼고 붙은 8분 하나 건너 · 쉬움 = 정박만(붙은 4분은 짝수 박만), 동시 누르기 없음
      const f = n.beat % 1;
      if (lvl === 1) { if (f === .25 || f === .75) continue; if (f === .5 && n.beat - last < 1 && n.beat !== last) continue; }
      if (lvl === 0) { if (f !== 0 || n.beat === last || (n.beat - last < 2 && n.beat % 2 !== 0)) continue; }
      kept.push(n); last = n.beat;
    }
    kept = densify(kept, lvl, rng(seedOf(S.id)));   // 상대·나 같은 씨앗 → 같은 노트(따라 부르기)
    const prev = [null, null, null, null];
    for (const n of kept) {
      const o = { who, lane: lane(n.d), t: n.beat * spb, d: n.l * spb, m: pitch(n.d), beat: n.beat }, p = prev[o.lane];
      if (p) { if (o.t <= p.t + 0.01) continue; if (p.d > 0 && p.t + p.d > o.t - 0.12) { p.d = Math.max(0, o.t - 0.12 - p.t); if (p.d < 0.2) p.d = 0; } }
      out.push(o); prev[o.lane] = o;
    }
  }
  out.sort((a, b) => a.t - b.t || a.lane - b.lane);
  return { notes: out, secs, beats: c, spb };
}

export function createRhythm(el, O = {}) {
  const svgP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
  const svgF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const svgM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
  el.innerHTML = `<div class="rb"><div class="rb-wrap"><canvas class="rb-cv"></canvas><div class="rb-ov" hidden></div>
    <button type="button" class="rb-ib rb-pz" hidden aria-label="일시정지">${svgP}</button><button type="button" class="rb-ib rb-fs" aria-label="전체 화면">${svgF}</button><button type="button" class="rb-ib rb-mn" hidden aria-label="메뉴로">${svgM}</button></div>
    <div class="rb-bar"></div></div>`;
  const wrap = el.querySelector('.rb-wrap'), cv = el.querySelector('.rb-cv'), cx = cv.getContext('2d'), ov = el.querySelector('.rb-ov');
  const mnb = el.querySelector('.rb-mn'), pz = el.querySelector('.rb-pz'), fsb = el.querySelector('.rb-fs'), reb = { hidden: true }, barT = el.querySelector('.rb-bar');
  let W = 0, H = 0, DPR = 1, alive = true, raf = 0, lastF = 0, touchUI = false, bgC = null, bgK = 0;
  const opt = Object.assign({ down: false, mid: false, ghost: true, hits: false, music: true }, store.get('rb_opt', {}) || {});
  if (!opt.g2) { opt.ghost = false; opt.g2 = 1; }   // 2026-11-02 하율 "잘못 누르면 점수 깎고 상대 게이지가 차야 막 안 누름" → 빈 누르기 기본 꺼짐(예전 저장값도 한 번 끔)
  if (!Array.isArray(opt.keys) || opt.keys.length !== 4) opt.keys = KEY_DEF.map(a => a.slice());
  let KEYS = {}, waitKey = null;
  function rebuildKeys() {
    KEYS = {}; opt.keys.forEach((a, l) => a.forEach(c => { if (c) KEYS[c] = l; }));
    barT.textContent = `키 ${opt.keys.map(a => a.filter(Boolean).map(keyName).join('/')).join(' · ')} · 터치는 화면을 세로 4칸으로 나눠 누르기 · Enter·Esc 멈춤`;
  }
  rebuildKeys();
  let off = +store.get('rb_off', 0) || 0, diff = +store.get('rb_diff', 1);
  if (!(diff >= 0 && diff <= 2)) diff = 1;
  const rec = store.get('rb_rec', {}) || {}, week = store.get('rb_week', {}) || {};

  /* ── 크기 ── */
  const isFs = () => (document.fullscreenElement || document.webkitFullscreenElement) === wrap;
  function fit() {
    let w, h;
    if (isFs()) { w = innerWidth; h = innerHeight; }
    else {
      w = Math.min(el.clientWidth || 360, 1600); const top = Math.max(8, wrap.getBoundingClientRect().top);
      h = Math.max(340, Math.min(900, (innerHeight - top - 128) * 0.85));   // 아래 안내 줄 + 사이트 공통 '다시 시작' 버튼 자리, 2026-11-02 22:00 하율 "더 줄여도" → 남은 높이의 85%
      if (w >= h * 1.05) { if (w / h > 1.75) w = h * 1.75; }   // 화면에 남은 높이를 다 씀(가로가 아주 넓을 때만 폭 줄임)
      else h = Math.min(h, w * 1.75);
    }
    DPR = Math.min(2, devicePixelRatio || 1); W = Math.round(w); H = Math.round(h);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    bgC = null;
  }
  fsb.onclick = () => {
    try {
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap)?.catch?.(() => {});
    } catch {}
  };
  const onFs = () => { requestAnimationFrame(() => requestAnimationFrame(fit)); setTimeout(fit, 350); setTimeout(fit, 900); };   // 전체 화면 해제 직후엔 크기가 아직 전체 화면 값 → 몇 번 다시 맞춤

  /* ── 소리(직접 합성) ── */
  let AC = null, NB = null, master = null, auto = 0, OUT = null;
  const dst = () => OUT || master;
  const useOut = (bus, fn) => { const o = OUT; OUT = bus; try { fn(); } finally { OUT = o; } };
  function initAudio() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume().catch(() => {});
  }
  function newMaster() {
    if (master) try { master.disconnect(); } catch {}
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
    master = AC.createGain(); master.gain.value = 0.75; master.connect(comp);
    auto = (AC.outputLatency || 0) + (AC.baseLatency || 0);
  }
  const env = (g, at, pk, dec) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(pk, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + dec); };
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function osc(type, f, at, pk, dec) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; env(g, at, pk, dec); o.connect(g).connect(dst()); o.start(at); o.stop(at + dec + 0.03); return o; }
  function noise(at, type, f, pk, dec) { const s = AC.createBufferSource(); s.buffer = NB; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = AC.createGain(); env(g, at, pk, dec); s.connect(fl).connect(g).connect(dst()); s.start(at, Math.random() * 0.5); s.stop(at + dec + 0.03); }
  const kick = at => { const o = osc('sine', 150, at, 0.95, 0.26); o.frequency.setValueAtTime(155, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.12); };
  const snare = (at, v = .55) => { noise(at, 'bandpass', 1900, v, 0.16); osc('triangle', 190, at, v * .45, 0.08); };
  const hat = (at, v) => noise(at, 'highpass', 7600, v, 0.04);
  const crash = at => noise(at, 'highpass', 4800, 0.28, 1.4);
  const beep = (at, f) => { osc('square', f, at, 0.16, 0.16); osc('sine', f / 2, at, 0.25, 0.2); };
  function bassN(at, m, dur) {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = mf(m); f.type = 'lowpass'; f.frequency.value = 480;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3, at + 0.01); g.gain.setValueAtTime(0.3, at + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(dst()); o.start(at); o.stop(at + dur + 0.02);
  }
  function pad(at, r, q, dur) {
    const f = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.06, at + 0.12); g.gain.setValueAtTime(0.06, at + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    f.connect(g).connect(dst());
    for (const s of [0, q ? 4 : 3, 7]) { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = mf(r + s); o.connect(f); o.start(at); o.stop(at + dur + 0.02); }
  }
  function pluck(at, m, dur) {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'square'; o.frequency.value = mf(m); f.type = 'lowpass'; f.frequency.setValueAtTime(2600, at); f.frequency.exponentialRampToValueAtTime(500, at + dur);
    env(g, at, 0.045, dur); o.connect(f).connect(g).connect(dst()); o.start(at); o.stop(at + dur + 0.03);
  }
  function voice(at, m, dur, wave, lp = 1800) {   // 노래하는 목소리: 살짝 아래에서 올라가는 음 + 비브라토
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain(), fr = mf(m);
    o.type = wave; o.frequency.setValueAtTime(fr * 0.94, at); o.frequency.linearRampToValueAtTime(fr, at + 0.04);
    lfo.frequency.value = 5.6; lg.gain.value = fr * 0.013; lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = lp;
    const len = Math.max(dur, 0.17), pk = wave === 'triangle' ? 0.34 : wave === 'square' ? 0.14 : 0.12;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(pk, at + 0.015); g.gain.setValueAtTime(pk * 0.8, at + len - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.07);
    o.connect(f).connect(g).connect(dst()); o.start(at); lfo.start(at); o.stop(at + len + 0.09); lfo.stop(at + len + 0.09); return g;
  }
  function missSnd() { if (!AC) return; const at = AC.currentTime; const o = osc('sawtooth', 160, at, 0.13, 0.2); o.frequency.exponentialRampToValueAtTime(70, at + 0.18); noise(at, 'lowpass', 600, 0.15, 0.1); }
  const hitSnd = () => { if (AC && opt.hits) osc('sine', 1800, AC.currentTime, 0.12, 0.05); };

  function arrange(S, B) {
    const ev = [], spb = B.spb, st = spb / 4, D = DRUMS[S.drum], bars = Math.ceil(B.beats / 4);
    for (let k = 0; k < 4; k++) ev.push({ t: (k - 4) * spb, f: at => beep(at, k === 3 ? 880 : 520) });
    for (let bar = 0; bar < bars; bar++) {
      const b0 = bar * 4 * spb, ci = bar % S.prog.length, r = S.root - 12 + S.prog[ci], q = S.q[ci];
      if (bar === bars - 1) { ev.push({ t: b0, f: at => { kick(at); crash(at); bassN(at, r - 12, spb * 3.5); pad(at, r, q, spb * 4); } }); continue; }
      const intro = bar < 2, fill = bar % 4 === 1 && bar > 2;
      if (bar >= 2 && bar % 4 === 2) ev.push({ t: b0, f: crash });
      for (let s = 0; s < 16; s++) {
        const t = b0 + s * st;
        if (D.k[s] === 'x' && (!intro || s % 8 === 0)) ev.push({ t, f: kick });
        if (fill && s >= 12) ev.push({ t, f: at => snare(at, 0.3 + 0.07 * (s - 12)) });
        else if (D.s[s] === 'x' && (!intro || bar === 1)) ev.push({ t, f: snare });
        if (D.h[s] === 'x') { const v = s % 4 === 0 ? 0.1 : 0.05; ev.push({ t, f: at => hat(at, v) }); }
        if (!intro && D.b[s] === 'x') { const m = r - 12 + (S.drum === 'drive' && s % 4 === 2 ? 12 : 0); ev.push({ t, f: at => bassN(at, m, st * 1.8) }); }
        if (S.arp && !intro && s % 2 === 0) { const m = r + 12 + [0, q ? 4 : 3, 7, 12][(s / 2) % 4]; ev.push({ t, f: at => pluck(at, m, st * 1.6) }); }
      }
      if (S.pad) ev.push({ t: b0, f: at => pad(at, r, q, spb * 4) });
    }
    const oc = CH[S.opp], pb = B.pbus;   // 내 목소리는 따로 버스 → 놓치면 끊기고 다음에 맞히면 다시(FNF 보컬 트랙처럼)
    for (const n of B.notes) {
      if (n.who === 0) ev.push({ t: n.t, f: at => voice(at, n.m + (oc.oct || 0), n.d, oc.wave, oc.lp) });
      else ev.push({ t: n.t, f: at => useOut(pb, () => voice(at, n.m, n.d, 'triangle', 3400)) });
    }
    return ev.sort((a, b) => a.t - b.t);
  }

  /* ── 배경 음악: 메뉴(밝게)·게임 오버(느리게) — 마디 단위로 미리 깔기 ── */
  const bgm = { kind: null, next: 0, bar: 0, bus: null };
  function setBgm(kind) {
    if (!AC || bgm.kind === kind) return;
    if (bgm.bus) { const b = bgm.bus; b.gain.setTargetAtTime(0.0001, AC.currentTime, 0.15); setTimeout(() => { try { b.disconnect(); } catch {} }, 900); }
    bgm.kind = kind; bgm.bus = null; if (!kind) return;
    const b = AC.createGain(); b.gain.value = 0.0001; b.gain.setTargetAtTime(kind === 'menu' ? 0.45 : 0.5, AC.currentTime, 0.5); b.connect(AC.destination);
    bgm.bus = b; bgm.next = AC.currentTime + 0.15; bgm.bar = 0;
  }
  function bgmTick() {
    if (!bgm.kind || !AC || AC.state !== 'running') return;
    while (bgm.next < AC.currentTime + 0.5) {
      const at = bgm.next, k = bgm.bar++;
      useOut(bgm.bus, () => {
        if (bgm.kind === 'menu') {   // 104BPM, C-Am-F-G
          const sp = 60 / 104, r = [48, 45, 41, 43][k % 4], q = k % 4 !== 1;
          pad(at, r + 12, q, sp * 4);
          for (let s = 0; s < 8; s++) { const t = at + s * sp / 2; if (s % 4 === 0) kick(t); if (s % 4 === 2 && k % 2) snare(t, 0.25); hat(t, s % 2 ? 0.03 : 0.05); }
          for (let s = 0; s < 8; s++) bassN(at + s * sp / 2, r - 12 + (s % 2 ? 12 : 0), sp * 0.4);
          const mel = [[0, 7], [1, 9], [1.5, 7], [2, 4], [3, 2], [3.5, 4]];
          if (k % 4 !== 3) for (const [b, d] of mel) pluck(at + b * sp, r + 12 + MAJ[(d + (k % 4) * 2) % 7], sp * 0.6);
          bgm.next += sp * 4;
        } else {   // 72BPM, Am-F-Dm-E 느린 화음 + 심장 박동
          const sp = 60 / 72, r = [57, 53, 50, 52][k % 4], q = k % 4 === 3;
          pad(at, r - 12, q, sp * 4); kick(at); kick(at + sp * 0.35);
          for (let s = 0; s < 4; s++) pluck(at + s * sp, r + [0, q ? 4 : 3, 7, 12][s], sp * 0.9);
          bgm.next += sp * 4;
        }
      });
    }
  }
  function jingle(good) {
    const at = AC.currentTime + 0.05, notes = good ? [60, 64, 67, 72, 76, 79, 84] : [64, 62, 60, 59, 55];
    useOut(null, () => notes.forEach((m, i) => { osc('square', mf(m), at + i * 0.09, 0.08, 0.25); osc('triangle', mf(m - 12), at + i * 0.09, 0.12, 0.3); }));
    if (good) noise(at + notes.length * 0.09, 'highpass', 4800, 0.2, 1.0);
  }

  /* ── 상태 ── */
  let state = 'title', G = null, story = null, M = null, menuStack = [];
  const cam = { x: 640, z: 0, hz: 0 };
  // 지금 스피커에서 나오는 소리의 시각(오디오 시계): getOutputTimestamp로 출력 지연까지 반영하고 performance.now로 프레임 사이를 부드럽게 이음
  // (AC.currentTime은 오디오 블록 단위로 뚝뚝 올라가고 출력 지연이 빠져 있어 화살표가 박자보다 앞서거나 떨림). 멈춤 중엔 멈춘 값 그대로, 뒤로 가지 않음
  let aLast = 0;
  function audioNow() {
    if (!AC) return 0;
    if (AC.state !== 'running') return aLast;
    let t = AC.currentTime - auto;
    try { const ts = AC.getOutputTimestamp?.(); if (ts && ts.contextTime > 0 && ts.performanceTime > 0) { const e = ts.contextTime + (performance.now() - ts.performanceTime) / 1000; if (Math.abs(e - t) < 0.5) t = e; } } catch {}
    if (t < aLast && aLast - t < 0.05) t = aLast;   // 미세한 되감김 방지
    return (aLast = t);
  }
  const songT = () => audioNow() - G.t0 - off / 1000;
  const accP = g => g.wN ? g.wSum / g.wN * 100 : 100;
  const rk = (s, d) => s.id + '_' + d;

  function loadSong(idx, d) {
    initAudio(); newMaster();
    const S = SONGS[idx], B = buildSong(S, d);
    B.pbus = AC.createGain(); B.pbus.connect(master);
    const PN = B.notes.filter(n => n.who === 1), ON = B.notes.filter(n => n.who === 0);
    for (const n of B.notes) { n.st = 0; n.vo = null; }
    G = {
      idx, S, d, spb: B.spb, secs: B.secs, end: B.beats * B.spb, PN, ON, byLane: [0, 1, 2, 3].map(l => PN.filter(n => n.lane === l)),
      EV: arrange(S, B), evI: 0, oI: 0, appr: 1.55 / (DIFFS[d].sp * (S.boss ? 1.15 : 1)), opp: CH[S.opp],
      hp: .5, score: 0, combo: 0, maxCombo: 0, cnt: [0, 0, 0, 0, 0], wSum: 0, wN: 0, pops: [], spl: [],
      pose: [{ l: -1, end: 0, miss: 0 }, { l: -1, end: 0, miss: 0 }], held: [0, 0, 0, 0], holdN: [null, null, null, null],
      conf: [-9, -9, -9, -9], oconf: [-9, -9, -9, -9], lastBar: -1, failed: false, firstP: PN.length ? PN[0].t : 0, pbus: B.pbus, fan: { m: 0, until: 0 }, add: null, conf2: [],
    };
    G.t0 = AC.currentTime + 0.35 + 4 * G.spb;
    state = 'play'; closeMenu(); pz.hidden = false; reb.hidden = false; mnb.hidden = false; cam.x = 640; setBgm(null); bgC = null;
  }
  function judgeHit(n, i, T) {
    const R = RATE[i]; G.cnt[i]++; G.score += R.sc; G.wSum += R.w; G.wN++; G.combo++; if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    G.pbus.gain.setTargetAtTime(1, AC.currentTime, 0.004);
    if (G.combo % 50 === 0) G.fan = { m: 1, until: T + 1.3 };
    G.hp = Math.min(1, G.hp + R.hp); G.conf[n.lane] = T; G.pose[1] = { l: n.lane, end: T + Math.max(n.d, 0.35), miss: 0 };
    G.pops.push({ i, t: performance.now(), vy: -170, y: 0, c: G.combo }); if (G.pops.length > 4) G.pops.shift();
    if (i === 0) G.spl.push({ l: n.lane, t: performance.now() });
    hitSnd();
  }
  function judgeMiss(T, lane, wrong) {
    if (G.combo >= 10) G.fan = { m: 2, until: T + 1.5 };
    G.pbus.gain.setTargetAtTime(0, AC.currentTime, 0.006);
    G.cnt[4]++; G.score -= 10; G.wN++; G.combo = 0; G.hp -= DIFFS[G.d].miss;
    G.pose[1] = { l: lane, end: T + 0.4, miss: T + 0.4 }; missSnd();
    G.pops.push({ i: wrong ? 5 : 4, t: performance.now(), vy: -120, y: 0, c: 0 }); if (G.pops.length > 4) G.pops.shift();
    if (G.hp <= 0) { G.hp = 0; gameOver(); }
  }
  function down(l) {
    if (state !== 'play') return; G.held[l] = 1; const T = songT();
    let best = null; for (const n of G.byLane[l]) { if (n.st !== 0) continue; if (n.t - T > 0.166) break; if (Math.abs(T - n.t) <= 0.166) { best = n; break; } }
    if (!best) { if (!opt.ghost && T > -0.2) judgeMiss(T, l, true); return; }   // 헛누름 = 놓침과 같은 벌점(점수 −10·체력 깎임·콤보 끊김)
    const ms = Math.abs(T - best.t) * 1000; let i = 0; while (ms > RATE[i].ms) i++;
    judgeHit(best, i, T); if (state !== 'play') return;
    if (best.d > 0) { best.st = 1; G.holdN[l] = best; } else best.st = 2;
  }
  function up(l) {
    if (!G) return; G.held[l] = 0; const n = G.holdN[l]; if (!n) return; G.holdN[l] = null; if (state !== 'play') return; const T = songT();
    if (T >= n.t + n.d - 0.15) { n.st = 2; G.wSum += 1; G.wN++; G.score += 50; }
    else { n.st = 3; judgeMiss(T, l); }
  }
  function update(T, dt) {
    const now = AC.currentTime;
    while (G.evI < G.EV.length && G.t0 + G.EV[G.evI].t < now + 0.25) { const e = G.EV[G.evI++], at = G.t0 + e.t; if (at >= now - 0.03) e.f(Math.max(at, now)); }
    while (G.oI < G.ON.length && T >= G.ON[G.oI].t) { const n = G.ON[G.oI++]; if (G.S.boss) G.hp = Math.max(0.05, G.hp - 0.008); n.st = n.d > 0 ? 1 : 2; G.oconf[n.lane] = T + n.d; G.pose[0] = { l: n.lane, end: n.t + Math.max(n.d, G.spb * 0.9), miss: 0 }; }
    for (const n of G.ON) { if (n.t > T) break; if (n.st === 1 && T >= n.t + n.d) n.st = 2; }
    for (const n of G.PN) {
      if (n.t - T > 0.2) break;
      if (n.st === 0 && T - n.t > 0.166) { n.st = 3; judgeMiss(T, n.lane); if (n.d > 0) G.wN++; if (state !== 'play') return; }
    }
    for (let l = 0; l < 4; l++) { const n = G.holdN[l]; if (!n) continue; G.score += 120 * dt; G.hp = Math.min(1, G.hp + 0.04 * dt); G.conf[l] = T; if (T >= n.t + n.d) { n.st = 2; G.holdN[l] = null; G.wSum += 1; G.wN++; G.score += 50; } }
    const bar = Math.floor(T / G.spb / 4); if (bar !== G.lastBar && T >= 0) { G.lastBar = bar; if (bar >= 2) { cam.z = 0.03; cam.hz = 0.03; } }
    if (T > G.end + 0.6) finish();
  }

  /* ── 메뉴(칸 안 DOM) ── */
  function showMenu(build, keepSel) { const sel = keepSel && M ? M.sel : 0; M = { build, sel }; paintMenu(); }
  function pushMenu(build) { if (M) menuStack.push(M); showMenu(build); }
  function popMenu() { M = menuStack.pop() || null; if (M) paintMenu(); else closeMenu(); }
  function closeMenu() { M = null; menuStack = []; ov.hidden = true; ov.innerHTML = ''; }
  function paintMenu() {
    const m = M.build(); M.cfg = m; if (M.sel >= m.items.length) M.sel = 0;
    let h = `<div class="rb-m${m.cls ? ' ' + m.cls : ''}">`;
    if (m.logo) h += '<b class="rb-logo">방송실<br>리듬 배틀</b><p class="rb-ms">쉬는 시간, 방송실에서 한 판!</p>';
    if (m.title) h += `<b class="rb-mt">${m.title}</b>`;
    if (m.sub) h += `<p class="rb-ms">${m.sub}</p>`;
    if (m.extra) h += m.extra;
    if (m.diff) h += `<div class="rb-df"><button type="button" class="rb-da" data-d="-1" aria-label="쉽게">◀</button><b class="rb-dn d${diff}">${DIFFS[diff].n}</b><button type="button" class="rb-da" data-d="1" aria-label="어렵게">▶</button></div>`;
    h += '<div class="rb-mi">' + m.items.map((it, i) => `<button type="button" class="rb-it${i === M.sel ? ' on' : ''}" data-i="${i}"><span>${it.lbl}</span>${it.sub ? `<small>${it.sub}</small>` : ''}</button>`).join('') + '</div>';
    if (m.foot) h += `<p class="rb-mf">${m.foot}</p>`;
    ov.innerHTML = h + '</div>'; ov.hidden = false; pz.hidden = true;
    ov.querySelector('.rb-it.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  function menuGo(i) { const it = M?.cfg?.items[i]; if (!it) return; M.sel = i; document.activeElement?.blur?.(); initAudio(); it.go(); }
  function setDiff(dd) { diff = (diff + dd + 3) % 3; store.set('rb_diff', diff); paintMenu(); }
  ov.addEventListener('click', e => {
    const d = e.target.closest('[data-d]'); if (d) { setDiff(+d.dataset.d); return; }
    const b = e.target.closest('.rb-it'); if (b) menuGo(+b.dataset.i);
  });
  ov.addEventListener('pointerdown', e => { if (e.target.closest('.rb-tap')) { e.preventDefault(); calTap(); } });
  const fmt = n => Math.max(0, Math.round(n)).toLocaleString('ko-KR');
  const bestTxt = (S, d) => { const r = rec[rk(S, d)]; return r ? `최고 ${fmt(r.s)}점 · ${r.a.toFixed(2)}%${r.fc ? ' · 풀 콤보' : ''}` : '아직 기록 없음'; };

  const mTitle = () => ({ logo: 1, items: [
    { lbl: '스토리 모드', sub: '영상고의 하루 · 3곡 연속', go: () => pushMenu(mStory) },
    { lbl: '자유 플레이', sub: '곡 하나 골라서', go: () => pushMenu(mFree) },
    { lbl: '설정', sub: '스크롤 방향·박자 보정 등', go: () => pushMenu(mOpt) },
  ], foot: '↑↓ 고르기 · Enter 선택 · Esc 뒤로' });
  const mStory = () => ({ title: '영상고의 하루', sub: '방송실 → 급식실 → 대강당 보스전 MR.LEE, 3곡 연속!', diff: 1,
    extra: `<ol class="rb-wk">${SONGS.slice(0, 3).map(s => `<li><b>${s.name}</b><small>${CH[s.opp].name} · ${STAGE_N[s.stage]}</small></li>`).join('')}</ol><p class="rb-ms">${week[diff] ? '이 난이도 최고 ' + fmt(week[diff]) + '점' : '아직 완주 기록 없음'}</p>`,
    items: [{ lbl: '시작', go: () => { story = { i: 0, d: diff, score: 0, wSum: 0, wN: 0, miss: 0 }; loadSong(0, diff); } }, { lbl: '뒤로', go: popMenu }], back: popMenu });
  const mFree = () => ({ title: '자유 플레이', diff: 1, cls: 'free',
    items: (rankSongs(), FREE).map(i => [SONGS[i], i]).map(([s, i]) => ({ lbl: (s.boss ? '[보스] ' : '') + s.name + ` <em class="rb-st">${s.boss ? '★★★★★+' : '★'.repeat(STARS[i]) + '☆'.repeat(5 - STARS[i])}</em>`, sub: `${CH[s.opp].name} · ${STAGE_N[s.stage]} · BPM ${s.bpm} · ${bestTxt(s, diff)}`, go: () => { story = null; loadSong(i, diff); } })).concat([{ lbl: '뒤로', go: popMenu }]), back: popMenu });
  const onOff = v => v ? '<em>켬</em>' : '끔';
  const setOpt = k => { opt[k] = !opt[k]; store.set('rb_opt', opt); paintMenu(); };
  const mOpt = () => ({ title: '설정', items: [
    { lbl: '아래로 스크롤 ' + onOff(opt.down), sub: '화살표가 위에서 내려와요', go: () => setOpt('down') },
    { lbl: '가운데 보기 ' + onOff(opt.mid), sub: '내 화살표 줄만 가운데에(세로 화면은 항상)', go: () => setOpt('mid') },
    { lbl: '빈 누르기 허용 ' + onOff(opt.ghost), sub: '켜면 화살표 없을 때 눌러도 벌점 없음(기본 꺼짐)', go: () => setOpt('ghost') },
    { lbl: '타격음 ' + onOff(opt.hits), sub: '맞힐 때마다 딸깍', go: () => setOpt('hits') },
    { lbl: '메뉴 음악 ' + onOff(opt.music), sub: '첫 화면·게임 오버 배경 음악', go: () => setOpt('music') },
    { lbl: '키 바꾸기', sub: opt.keys.map((a, l) => ARW[l] + ' ' + a.filter(Boolean).map(keyName).join('/')).join('  '), go: () => pushMenu(mKeys) },
    ...(state === 'pause' ? [] : [{ lbl: `박자 보정 (${off > 0 ? '+' : ''}${off}ms)`, sub: '소리와 화살표가 어긋날 때 · 블루투스 이어폰은 꼭', go: openCal }]),
    { lbl: '뒤로', go: popMenu },
  ], back: popMenu });
  const mKeys = () => ({ title: '키 바꾸기', sub: waitKey ? '바꿀 키를 누르세요 · Esc 취소' : '칸을 고르고 새 키를 누르세요 · 같은 키는 한 곳에만', cls: 'keys',
    items: [0, 1, 2, 3].flatMap(l => [0, 1].map(k => ({ lbl: `${ARW[l]} ${k ? '보조' : '기본'} : <em>${waitKey && waitKey.l === l && waitKey.k === k ? '…입력 대기' : keyName(opt.keys[l][k])}</em>`, go: () => { waitKey = { l, k }; paintMenu(); } })))
      .concat([{ lbl: '기본값으로', sub: 'D F J K / ← ↓ ↑ →', go: () => { opt.keys = KEY_DEF.map(a => a.slice()); store.set('rb_opt', opt); rebuildKeys(); paintMenu(); } }, { lbl: '뒤로', go: popMenu }]), back: popMenu });
  function setKey(code) {
    const { l, k } = waitKey; waitKey = null;
    if (KEY_BAN.has(code)) { paintMenu(); return; }
    opt.keys.forEach(a => { for (let i = 0; i < 2; i++) if (a[i] === code) a[i] = ''; });
    opt.keys[l][k] = code; store.set('rb_opt', opt); rebuildKeys(); paintMenu();
  }
  const quitTxt = () => story ? '주간 그만두기' : '곡 고르기';
  const toSelect = () => { const s = story; story = null; G = null; state = 'title'; pz.hidden = true; reb.hidden = true; mnb.hidden = true; bgC = null; if (AC) { AC.resume(); newMaster(); } menuStack = []; M = null; showMenu(mTitle); if (s) pushMenu(mStory); else pushMenu(mFree); };
  const mPause = () => ({ title: '잠깐 멈춤', sub: G.S.name + ' · ' + DIFFS[G.d].n, items: [
    { lbl: '계속하기', go: resume }, { lbl: '처음부터', go: restart }, { lbl: '설정', go: () => pushMenu(mOpt) }, { lbl: quitTxt(), go: toSelect },
  ], back: resume });
  const mOver = () => ({ title: '체력이 바닥났어요', sub: G.S.name + ' · ' + DIFFS[G.d].n + ' · ' + CH[G.S.opp].name + '에게 졌어요', cls: 'over', items: [{ lbl: '다시 하기', go: restart }, { lbl: quitTxt(), go: toSelect }] });
  function restart() { if (!G) return; if (G.add && story) { story.score -= G.add.score; story.wSum -= G.add.wSum; story.wN -= G.add.wN; story.miss -= G.add.miss; } loadSong(G.idx, G.d); }

  function pause() {
    if (state !== 'play') return; state = 'pause'; for (let l = 0; l < 4; l++) { const n = G.holdN[l]; if (n) { n.st = 2; G.holdN[l] = null; } } G.held.fill(0); ptr.clear(); AC.suspend(); showMenu(mPause);
  }
  function resume() { if (state !== 'pause') return; closeMenu(); AC.resume().then(() => { if (state === 'pause') { state = 'play'; pz.hidden = false; } }); }
  function gameOver() {
    state = 'over'; G.failed = true; pz.hidden = true; for (let l = 0; l < 4; l++) G.holdN[l] = null;
    const now = AC.currentTime; master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0.0001, now, 0.08);
    G.fan = { m: 2, until: 1e9 }; useOut(null, () => { const o = osc('sawtooth', 220, now, 0.2, 0.6); o.frequency.exponentialRampToValueAtTime(55, now + 0.6); });
    setTimeout(() => { if (state === 'over' && alive) showMenu(mOver); }, 900);
  }
  function grade(a, miss, allSick) {
    if (!miss && allSick) return ['완벽', 'g5']; if (a >= 95) return ['훌륭', 'g4']; if (a >= 85) return ['좋음', 'g3']; if (a >= 70) return ['보통', 'g2']; return ['아쉬움', 'g1'];
  }
  function finish() {
    if (state !== 'play') return; state = 'result'; pz.hidden = true;
    master.gain.setTargetAtTime(0.0001, AC.currentTime + 1.2, 0.4);
    const g = G, a = accP(g), miss = g.cnt[4], allSick = !miss && g.cnt[1] + g.cnt[2] + g.cnt[3] === 0, [gn, gc] = grade(a, miss, allSick);
    const key = rk(g.S, g.d), old = rec[key]; let newB = false;
    if (!old || g.score > old.s) { rec[key] = { s: Math.round(g.score), a: Math.max(a, old?.a || 0), fc: !miss || !!old?.fc }; newB = true; }
    else { old.a = Math.max(old.a, a); old.fc = old.fc || !miss; }
    store.set('rb_rec', rec);
    if (story) { story.score += g.score; story.wSum += g.wSum; story.wN += g.wN; story.miss += miss; g.add = { score: g.score, wSum: g.wSum, wN: g.wN, miss }; }
    const good = gc >= 'g3', T = songT(); g.fan = { m: good ? 1 : 2, until: 1e9 }; g.pose[1] = good ? { l: 2, end: 1e9, miss: 0 } : { l: 1, end: 0, miss: 1e9 };
    g.resAt = performance.now(); g.conf2 = gc >= 'g4' ? confetti() : []; void T;
    const tag = allSick ? '올 퍼펙트' : !miss ? '풀 콤보' : '';
    const extra = `<div class="rb-res">${['완벽', '좋아', '아쉬워', '별로', '놓침'].map((n, i) => `<span class="j${i}"><b>${n}</b><i data-n="${g.cnt[i]}">0</i></span>`).join('')}</div>
      <p class="rb-sc"><i data-n="${Math.round(g.score)}">0</i>점${newB ? ' <em>최고 기록!</em>' : ''}</p><p class="rb-ms rb-late">정확도 ${a.toFixed(2)}% · 최대 콤보 ${g.maxCombo}</p>
      <div class="rb-gr ${gc}">${gn}</div>${tag ? `<p class="rb-tag">${tag}</p>` : ''}`;
    let items;
    if (story && story.i < 2) items = [{ lbl: '다음 곡 ▶', sub: SONGS[story.i + 1].name, go: () => { story.i++; loadSong(story.i, story.d); } }, { lbl: '이 곡 다시', go: () => { story.score -= g.score; story.wSum -= g.wSum; story.wN -= g.wN; story.miss -= miss; loadSong(g.idx, g.d); } }, { lbl: '주간 그만두기', go: toSelect }];
    else if (story) items = [{ lbl: '주간 결과 보기', go: weekDone }];
    else items = [{ lbl: '다시 하기', go: restart }, { lbl: '곡 고르기', go: toSelect }];
    setTimeout(() => {
      if (state !== 'result' || !alive) return;
      showMenu(() => ({ title: g.S.name, sub: DIFFS[g.d].n, cls: 'res', extra, items })); countUp();
      setTimeout(() => { if (state === 'result' && alive) jingle(good); }, 1250);
    }, 700);
  }
  function countUp() {   // 결과 숫자 차르륵(한 번만 — 다시 그리면 바로 최종값)
    const els = [...ov.querySelectorAll('i[data-n]')], t0 = performance.now();
    const step = () => { const a = Math.min(1, (performance.now() - t0) / 1100); els.forEach((e, i) => { const d = Math.min(1, Math.max(0, a * 1.6 - i * 0.12)); e.textContent = fmt(+e.dataset.n * (1 - Math.pow(1 - d, 3))); }); if (a < 1 && alive && state === 'result') requestAnimationFrame(step); else els.forEach(e => { e.textContent = fmt(+e.dataset.n); }); };
    requestAnimationFrame(step);
  }
  function confetti() { const c = []; for (let i = 0; i < 90; i++) c.push({ x: Math.random(), y: -Math.random() * 0.4, vx: (Math.random() - .5) * 0.15, vy: 0.25 + Math.random() * 0.35, r: Math.random() * 6, c: COL[i % 4] }); return c; }
  function weekDone() {
    const s = story, a = s.wN ? s.wSum / s.wN * 100 : 100, nb = !week[s.d] || s.score > week[s.d];
    if (nb) { week[s.d] = Math.round(s.score); store.set('rb_week', week); }
    const extra = `<p class="rb-sc">${fmt(s.score)}점${nb ? ' <em>최고 기록!</em>' : ''}</p><p class="rb-ms">${DIFFS[s.d].n} · 평균 정확도 ${a.toFixed(2)}% · 놓침 ${s.miss}</p>`;
    story = null; G = null; state = 'title'; reb.hidden = true; mnb.hidden = true; bgC = null; jingle(true);
    showMenu(() => ({ title: '영상고의 하루 완주!', cls: 'res', extra, items: [{ lbl: '처음 화면', go: () => { menuStack = []; showMenu(mTitle); } }] }));
  }

  /* ── 박자 보정 ── */
  const cal = { c0: 0, taps: [], v: null };
  function openCal() {
    initAudio(); newMaster(); state = 'calib'; cal.c0 = AC.currentTime + 0.8; cal.taps = []; cal.v = null;
    for (let i = 0; i < 24; i++) beep(cal.c0 + i * 0.5, i % 4 === 0 ? 880 : 620);
    pushMenu(() => ({ title: '박자 보정', sub: "'삑' 소리에 맞춰 노란 원을 8번 이상 (키보드는 스페이스)", extra: '<div class="rb-tap">삑!</div><p class="rb-ms rb-ci"></p>',
      items: [{ lbl: '저장하고 돌아가기', go: calDone }, { lbl: '다시 측정', go: () => { popMenu(); openCal(); } }], back: calDone }));
    calInfo();
  }
  function calTap() {
    if (state !== 'calib') return; const now = audioNow(), k = Math.round((now - cal.c0) / 0.5); if (k < 0 || k > 23) return;
    cal.taps.push(now - (cal.c0 + k * 0.5)); const c = ov.querySelector('.rb-tap'); c?.classList.add('hit'); setTimeout(() => c?.classList.remove('hit'), 90); calInfo();
  }
  function calInfo() {
    const n = cal.taps.length; if (n >= 4) { const s = cal.taps.slice(-8).sort((a, b) => a - b); cal.v = Math.round(s[s.length >> 1] * 1000); }
    const e = ov.querySelector('.rb-ci'); if (e) e.textContent = n < 4 ? `소리에 맞춰 눌러 주세요 (${n}/8)` : `측정값 ${cal.v > 0 ? '+' : ''}${cal.v}ms (${Math.min(n, 8)}/8)`;
  }
  function calDone() { if (cal.v !== null && cal.taps.length >= 8) { off = Math.max(-300, Math.min(400, cal.v)); store.set('rb_off', off); } newMaster(); state = 'title'; popMenu(); }

  /* ── 입력 ── */
  const ptr = new Map();
  const pDown = e => {
    if (state !== 'play') return; e.preventDefault(); if (e.pointerType === 'touch') touchUI = true;
    const r = cv.getBoundingClientRect(), l = Math.max(0, Math.min(3, Math.floor((e.clientX - r.left) / (r.width / 4)))); ptr.set(e.pointerId, l); down(l);
  };
  const pEnd = e => { const l = ptr.get(e.pointerId); if (l === undefined) return; ptr.delete(e.pointerId); for (const v of ptr.values()) if (v === l) return; up(l); };
  const NAV = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Enter: 1, Space: 1, Escape: 1, Backspace: 1, KeyW: 1, KeyS: 1 };
  const kDown = e => {
    if (!alive || !el.isConnected) return; const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (waitKey) { e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') { waitKey = null; paintMenu(); } else setKey(e.code); return; }
    if (e.code === 'KeyR' && !KEYS.KeyR && G && (state === 'play' || state === 'over' || state === 'result') && !e.repeat) { e.preventDefault(); e.stopPropagation(); initAudio(); restart(); return; }   // 사이트 공통 R = 이 곡 처음부터
    if (state === 'play') {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyP') { e.preventDefault(); e.stopPropagation(); pause(); return; }
      const l = KEYS[e.code]; if (l === undefined) return; e.preventDefault(); e.stopPropagation(); if (!e.repeat) down(l); return;
    }
    if (state === 'calib' && e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) calTap(); return; }
    if (!M || !NAV[e.code]) return;
    initAudio();
    const m = M.cfg; if ((e.code === 'Escape' || e.code === 'Backspace') && !m.back) return;   // 첫 화면 Esc는 사이트(나가기)에 넘김
    e.preventDefault(); e.stopPropagation(); if (e.repeat && (e.code === 'Enter' || e.code === 'Space')) return;
    const n = m.items.length;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { M.sel = (M.sel - 1 + n) % n; paintMenu(); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { M.sel = (M.sel + 1) % n; paintMenu(); }
    else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && m.diff) setDiff(e.code === 'ArrowLeft' ? -1 : 1);
    else if (e.code === 'Enter' || e.code === 'Space') menuGo(M.sel);
    else if (e.code === 'Escape' || e.code === 'Backspace') m.back();
  };
  const kUp = e => { const l = KEYS[e.code]; if (l !== undefined && state === 'play') up(l); };
  const vis = () => { if (document.hidden) pause(); };
  const blur = () => pause();
  cv.addEventListener('pointerdown', pDown); cv.addEventListener('pointerup', pEnd); cv.addEventListener('pointercancel', pEnd);
  pz.onclick = pause;
  mnb.onclick = () => { mnb.blur(); initAudio(); story = null; G = null; state = 'title'; pz.hidden = true; mnb.hidden = true; bgC = null; if (AC) { AC.resume(); newMaster(); } menuStack = []; M = null; showMenu(mTitle); };   // 22:21 하율 "메뉴로 바로 나가는 버튼"
  wrap.addEventListener('pointerdown', () => initAudio());   // 첫 터치에 소리 깨우기(메뉴 음악)
  document.addEventListener('keydown', kDown, true); document.addEventListener('keyup', kUp, true);
  document.addEventListener('visibilitychange', vis); addEventListener('blur', blur); addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

  /* ── 그리기 도구 ── */
  function rr(x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else cx.rect(x, y, w, h); }
  function inkFill(fill, w = 5) { cx.lineJoin = 'round'; cx.lineCap = 'round'; if (fill) { cx.fillStyle = fill; cx.fill(); } cx.strokeStyle = INK; cx.lineWidth = w; cx.stroke(); }
  function lim(x1, y1, x2, y2, w, c) { cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.strokeStyle = INK; cx.lineWidth = w + 9; cx.stroke(); cx.strokeStyle = c; cx.lineWidth = w; cx.stroke(); }
  function dot(x, y, r, c, w = 4) { cx.beginPath(); cx.arc(x, y, r, 0, 7); inkFill(c, w); }
  function arrow(x, y, s, l, fill, alpha = 1, outline = true) {
    cx.save(); cx.globalAlpha = alpha; cx.translate(x, y); cx.rotate(ROT[l]); cx.beginPath();
    // 2026-11-02 하율 "화살표 더 둥글게": 꼭짓점마다 arcTo로 둥글린 통통한 화살표
    const P = [[0, -s], [s * 0.95, -s * 0.02], [s * 0.44, -s * 0.02], [s * 0.44, s * 0.88], [-s * 0.44, s * 0.88], [-s * 0.44, -s * 0.02], [-s * 0.95, -s * 0.02]], RD = [s * 0.11, s * 0.08, s * 0.05, s * 0.09, s * 0.09, s * 0.05, s * 0.08];   // 22:02 하율 "너무 동글동글" → 모서리만 살짝
    cx.moveTo((P[6][0] + P[0][0]) / 2, (P[6][1] + P[0][1]) / 2);
    for (let i = 0; i < 7; i++) { const a = P[i], b = P[(i + 1) % 7]; cx.arcTo(a[0], a[1], b[0], b[1], RD[i]); }
    cx.closePath();
    cx.lineJoin = 'round'; const w = Math.max(2, s * 0.13);
    if (outline) { cx.strokeStyle = '#fff'; cx.lineWidth = w * 2.5; cx.stroke(); }
    cx.strokeStyle = INK; cx.lineWidth = w; cx.stroke(); cx.fillStyle = fill; cx.fill();
    if (outline) { cx.beginPath(); cx.moveTo(-s * 0.48, -s * 0.22); cx.quadraticCurveTo(-s * 0.3, -s * 0.5, -s * 0.05, -s * 0.66); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = w * 0.9; cx.stroke(); }
    cx.restore();
  }
  function txt(t, x, y, size, fill, al = 'center') {
    cx.font = size + 'px ' + FONT; cx.textAlign = al; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
    cx.strokeStyle = INK; cx.lineWidth = Math.max(3, size * 0.2); cx.strokeText(t, x, y); cx.fillStyle = fill; cx.fillText(t, x, y); cx.textBaseline = 'alphabetic';
  }

  /* ── 캐릭터(머리 = 체력 아이콘과 공용) ── */
  function head(c, pal, face, lx, ly, mood) {
    if (c.hs === 'bob') { rr(-78, -60, 156, 112, 46); inkFill(pal.hair); }
    cx.beginPath(); if (c.jaw && cx.roundRect) cx.roundRect(-70, -66, 140, 146, [66, 66, 26, 26]); else cx.arc(0, 0, 66, 0, 7); inkFill(pal.skin);
    if (c.hs === 'curly') {   // 곱슬머리: 동그란 털 뭉치 여러 개(바깥 윤곽만 잉크 — 선을 먼저 다 긋고 위에 칠함)
      const bl = []; for (let i = 0; i <= 6; i++) { const a = Math.PI + i * Math.PI / 6; bl.push([Math.cos(a) * 52, Math.sin(a) * 52 - 18, 30]); }   // 22:21 하율 "너무 뽀글" → 큰 뭉치 몇 개만(살짝 곱슬)
      bl.push([-18, -70, 32], [20, -72, 32]);
      cx.strokeStyle = INK; cx.lineWidth = 9; for (const [x, y, r] of bl) { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.stroke(); }
      cx.fillStyle = pal.hair; for (const [x, y, r] of bl) { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
      cx.beginPath(); cx.arc(0, -8, 62, Math.PI, Math.PI * 2); cx.fill();
      cx.strokeStyle = 'rgba(255,255,255,.13)'; cx.lineWidth = 3; cx.beginPath(); cx.arc(-14, -64, 16, Math.PI * 1.1, Math.PI * 1.7); cx.stroke(); cx.beginPath(); cx.arc(30, -60, 14, Math.PI * 1.1, Math.PI * 1.7); cx.stroke();
    }
    cx.beginPath();
    if (c.hs === 'curly') { /* 위에서 그림 */ }
    else if (c.hs === 'flat') { if (cx.roundRect) cx.roundRect(-72, -96, 144, 66, [18, 18, 6, 6]); else cx.rect(-72, -96, 144, 66); }
    else if (c.hs === 'spike') {
      cx.moveTo(-67, -2); for (let i = 1; i < 8; i++) { const a = Math.PI + i * Math.PI / 8, r = i % 2 ? 90 : 62; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 4); }
      cx.lineTo(67, -2); cx.lineTo(50, -18); cx.quadraticCurveTo(0, -36, -50, -18); cx.closePath();
    } else if (c.hs !== 'curly') { const a0 = Math.PI * 1.04, a1 = Math.PI * 1.96; cx.arc(0, -2, 69, a0, a1); cx.quadraticCurveTo(face * 14, -42, Math.cos(a0) * 69, Math.sin(a0) * 69 - 2); cx.closePath(); }
    if (c.hs !== 'curly') inkFill(pal.hair);
    const ex = face * 12 + lx, ey = 2 + ly;
    if (mood === 3) { cx.strokeStyle = INK; cx.lineWidth = 5; for (const s of [-1, 1]) { const x = ex + s * 22; cx.beginPath(); cx.moveTo(x - 7, ey - 7); cx.lineTo(x + 7, ey + 7); cx.moveTo(x + 7, ey - 7); cx.lineTo(x - 7, ey + 7); cx.stroke(); } }
    else for (const s of [-1, 1]) { cx.beginPath(); cx.ellipse(ex + s * 22, ey, 7.5, mood === 2 ? 5 : 10, 0, 0, 7); cx.fillStyle = INK; cx.fill(); cx.beginPath(); cx.arc(ex + s * 22 + 2.5, ey - 3.5, 2.6, 0, 7); cx.fillStyle = '#fff'; cx.fill(); }
    if (c.acc === 'shades' && mood !== 3) {   // 선글라스: 눈 대신 검은 알 + 반짝
      for (const s2 of [-1, 1]) { rr(ex + s2 * 27 - 25, ey - 16, 50, 30, 10); inkFill('#15151f', 4.5); cx.beginPath(); cx.moveTo(ex + s2 * 27 - 14, ey - 8); cx.lineTo(ex + s2 * 27 - 4, ey - 8); cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 4; cx.stroke(); }
      cx.beginPath(); cx.moveTo(ex - 4, ey - 6); cx.lineTo(ex + 4, ey - 6); cx.strokeStyle = INK; cx.lineWidth = 5; cx.stroke();
    }
    if (c.acc === 'glasses') { for (const s of [-1, 1]) { rr(ex + s * 22 - 18, ey - 14, 36, 28, 9); cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = 4.5; cx.stroke(); } cx.beginPath(); cx.moveTo(ex - 4, ey - 3); cx.lineTo(ex + 4, ey - 3); cx.stroke(); }
    cx.fillStyle = 'rgba(255,120,140,.35)'; for (const s of [-1, 1]) { cx.beginPath(); cx.ellipse(ex + s * 38, ey + 22, 10, 6, 0, 0, 7); cx.fill(); }
    const mx = ex * 0.8, my = (c.jaw ? 42 : 32) + ly * 0.5;
    cx.strokeStyle = INK; cx.lineWidth = 4.5;
    if (mood === 1) { cx.beginPath(); cx.ellipse(mx, my, 14, 12, 0, 0, 7); inkFill('#7a1f35', 4.5); cx.beginPath(); cx.ellipse(mx, my + 6, 7, 4, 0, 0, 7); cx.fillStyle = '#ff8fa3'; cx.fill(); }
    else if (mood === 2) { cx.beginPath(); cx.ellipse(mx, my + 2, 6, 7, 0, 0, 7); inkFill('#7a1f35', 4); cx.beginPath(); cx.moveTo(-face * 62, -24); cx.quadraticCurveTo(-face * 70, -6, -face * 62, -2); cx.quadraticCurveTo(-face * 54, -6, -face * 62, -24); inkFill('#9fd8ff', 3); }
    else if (mood === 3) { cx.beginPath(); cx.moveTo(mx - 10, my + 2); cx.lineTo(mx + 10, my + 2); cx.stroke(); }
    else { cx.beginPath(); cx.arc(mx, my - 6, 12, 0.2 * Math.PI, 0.8 * Math.PI); cx.stroke(); }
    if (c.acc === 'cap') {
      cx.beginPath(); cx.arc(0, -8, 70, Math.PI * 1.03, Math.PI * 1.97); cx.closePath(); inkFill(pal.capC);
      cx.beginPath(); cx.ellipse(face * 62, -14, 42, 11, 0, 0, 7); inkFill(pal.capC); dot(0, -76, 6, pal.capC, 3.5);
    } else if (c.acc === 'band') {
      rr(-70, -42, 140, 20, 9); inkFill(pal.capC, 4); rr(face * 56 - 8, -46, 18, 28, 6); inkFill('#ffffff', 3);
    } else if (c.acc === 'beret') {
      cx.save(); cx.rotate(-face * 0.18); cx.beginPath(); cx.ellipse(-face * 6, -58, 74, 28, 0, 0, 7); inkFill(pal.capC, 4.5); dot(-face * 6, -88, 7, pal.capC, 3.5); cx.restore();
    } else if (c.acc === 'chef') {
      rr(-54, -138, 108, 86, 40); inkFill('#ffffff', 4.5); rr(-66, -66, 132, 26, 12); inkFill('#f2f4fa', 4.5);
    } else if (c.acc === 'headset') {
      cx.beginPath(); cx.arc(0, -4, 77, Math.PI * 1.08, Math.PI * 1.92); cx.strokeStyle = INK; cx.lineWidth = 15; cx.stroke(); cx.strokeStyle = '#4a4e6e'; cx.lineWidth = 8; cx.stroke();
      for (const s of [-1, 1]) { rr(s * 72 - 12, -24, 24, 46, 10); inkFill('#4a4e6e', 4); }
      dot(face * 72, -2, 5, '#ff5d72', 2.5);
    }
  }
  function drawChar(c, x, fy, face, p, T, bop, dead) {
    const sing = !dead && p.l >= 0 && T < p.end, miss = !dead && p.miss > 0 && T < p.miss, l = sing || miss ? p.l : -1;
    const pal = miss || dead ? GREY : c;
    const lx = l === 0 ? -18 : l === 3 ? 18 : 0, ly = l === 1 ? 12 : l === 2 ? -14 : 0;
    const sq = dead ? 0.93 : 1 - bop * 0.04 + (l === 2 ? 0.04 : l === 1 ? -0.04 : 0);
    cx.save(); cx.translate(x, fy);
    cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(0, 2, 100, 17, 0, 0, 7); cx.fill();
    const tl = c.tall || 0;   // 큰 키: 다리를 길게 하고 윗몸 전체를 그만큼 올림
    lim(-26, -100 - tl, -30, -16, 30, pal.pants); lim(26, -100 - tl, 30, -16, 30, pal.pants);
    for (const s of [-1, 1]) { rr(s * 30 - 28, -24, 56, 24, 12); inkFill(c.chain ? '#e8e8f0' : '#f3f3f7', 4); }
    cx.scale(1, sq); cx.translate(lx * 0.6, ly * 0.5 - tl);
    const tx = c.torso || 0;   // 긴 몸통: 아래 몸통 + 벨트를 먼저 그리고 윗몸 전체를 tx만큼 올림
    if (tx) cx.translate(0, -tx);   // 22:21 하율 "몸통이 왜 2개" → 몸통은 아래에서 한 덩어리로 그림
    const bs = [-face * 50, -188];
    const hb = dead ? [-face * 84, -96] : l === 0 ? [-150, -225] : l === 3 ? [150, -225] : l === 2 ? [-face * 55, -345] : l === 1 ? [-face * 105, -112] : [-face * 72, -108 + bop * 5];
    lim(bs[0], bs[1], hb[0], hb[1], 24, pal.body2); dot(hb[0], hb[1], 13, pal.skin);
    rr(-64, -212, 128, 128 + tx, 42); inkFill(pal.body);
    if (tx) { rr(-60, -104 + tx, 120, 20, 8); inkFill(pal.body2, 4); dot(0, -94 + tx, 8, pal === GREY ? '#b8c0e0' : '#ffd23a', 3); }
    if (!tx) { rr(-58, -110, 116, 20, 10); cx.fillStyle = pal.body2; cx.fill(); }
    if (c.apron) { rr(-46, -192, 92, 108, 18); inkFill(pal === GREY ? '#c9d0ea' : '#ffffff', 4); rr(-24, -140, 48, 26, 8); inkFill(pal === GREY ? '#b8c0e0' : '#e8f6ef', 3); }
    if (c.chain) { cx.beginPath(); cx.moveTo(-40, -206); cx.quadraticCurveTo(0, -130, 40, -206); cx.strokeStyle = INK; cx.lineWidth = 11; cx.stroke(); cx.strokeStyle = pal === GREY ? '#b8c0e0' : '#ffd23a'; cx.lineWidth = 6; cx.stroke(); dot(0, -160, 12, pal === GREY ? '#b8c0e0' : '#ffd23a', 4); }
    else { cx.save(); cx.translate(face * 26, -168); cx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 14; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } cx.closePath(); inkFill('#ffd84a', 3); cx.restore(); }
    cx.save(); cx.translate(lx * 0.4, -276 + ly * 0.3); head(c, pal, face, lx * 0.5, ly * 0.4, dead ? 3 : miss ? 2 : sing ? 1 : 0); cx.restore();
    const fsh = [face * 50, -188], hf = dead ? [face * 84, -96] : sing ? [face * 52 + lx * 0.4, -236] : [face * 72, -150];
    lim(fsh[0], fsh[1], hf[0], hf[1], 24, pal.body);
    cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(hf[0], hf[1]); cx.lineTo(hf[0] - face * 6, hf[1] - 30); cx.strokeStyle = INK; cx.lineWidth = 14; cx.stroke(); cx.strokeStyle = '#6a6f8e'; cx.lineWidth = 7; cx.stroke();
    dot(hf[0] - face * 7, hf[1] - 36, 12, '#555a72', 4); dot(hf[0], hf[1], 13, pal.skin);
    cx.restore();
  }

  /* ── 방송실 배경(한 번 그려 캐시) ── */
  const BX = -260, BY = -360, BW = 1800, BH = 1360;
  const STAGE_N = { studio: '방송실', cafe: '급식실', hall: '대강당 무대', class: '노을 진 교실', gym: '체육관', roof: '밤 옥상' };
  const STAGE_C = { studio: ['#141a3e', '#2a2240'], cafe: ['#b9d8c4', '#5d6a7e'], hall: ['#2a0a14', '#0c0a12'], class: ['#f0d6b4', '#6e4a2e'], gym: ['#d8c7a6', '#a8763e'], roof: ['#0a0f2c', '#4a5a52'] };
  function buildBg(k, st) {
    if (st === 'cafe') return buildCafe(k);
    if (st === 'hall') return buildHall(k);
    if (st === 'class') return buildClass(k);
    if (st === 'gym') return buildGym(k);
    if (st === 'roof') return buildRoof(k);
    const c = document.createElement('canvas'); c.width = Math.ceil(BW * k); c.height = Math.ceil(BH * k);
    const g = c.getContext('2d'), sv = cx; g.scale(k, k); g.translate(-BX, -BY);
    const gr = g.createLinearGradient(0, -360, 0, 560); gr.addColorStop(0, '#141a3e'); gr.addColorStop(1, '#27306a'); g.fillStyle = gr; g.fillRect(BX, BY, BW, 920);
    for (let y = 40; y < 520; y += 64) for (let x = 40; x < 1240; x += 64) {   // 흡음재
      if (x > 440 && x < 840 && y < 330) continue;
      g.fillStyle = '#262f66'; g.fillRect(x, y, 60, 60);
      g.fillStyle = '#2f3a7a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60, y); g.lineTo(x + 30, y + 30); g.closePath(); g.fill();
      g.fillStyle = '#1f2758'; g.beginPath(); g.moveTo(x, y + 60); g.lineTo(x + 60, y + 60); g.lineTo(x + 30, y + 30); g.closePath(); g.fill();
    }
    g.fillStyle = '#10142c'; g.fillRect(450, 92, 380, 228);   // 조정실 창
    const wg = g.createLinearGradient(0, 100, 0, 312); wg.addColorStop(0, '#2f6f8f'); wg.addColorStop(1, '#173a55'); g.fillStyle = wg; g.fillRect(462, 104, 356, 204);
    g.fillStyle = '#0f1a2c'; g.fillRect(462, 250, 356, 58);
    const lights = ['#ff5d72', '#3ed27a', '#ffd84a', '#3fc4f2'];
    for (let i = 0; i < 28; i++) { g.fillStyle = lights[i % 4]; g.fillRect(478 + i * 12, 262 + (i % 3) * 12, 6, 4); }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(480, 104); g.lineTo(560, 104); g.lineTo(500, 248); g.lineTo(462, 248); g.closePath(); g.fill();
    g.fillStyle = '#3a3256'; g.fillRect(BX, 540, BW, 20);   // 걸레받이
    const fg = g.createLinearGradient(0, 560, 0, 1000); fg.addColorStop(0, '#463a63'); fg.addColorStop(1, '#2a2240'); g.fillStyle = fg; g.fillRect(BX, 560, BW, BH);
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2; for (let x = -200; x < 1600; x += 90) { g.beginPath(); g.moveTo(x, 560); g.lineTo(640 + (x - 640) * 1.8, 1000); g.stroke(); }
    g.fillStyle = 'rgba(160,140,255,.12)'; g.beginPath(); g.ellipse(640, 640, 560, 70, 0, 0, 7); g.fill();
    void sv; return c;
  }
  function bgCanvas(k) { const c = document.createElement('canvas'); c.width = Math.ceil(BW * k); c.height = Math.ceil(BH * k); const g = c.getContext('2d'); g.scale(k, k); g.translate(-BX, -BY); return [c, g]; }
  function buildCafe(k) {   // 급식실: 연두 타일 벽·배식대·메뉴판·회색 바둑판 바닥
    const [c, g] = bgCanvas(k);
    g.fillStyle = '#e4f1e8'; g.fillRect(BX, BY, BW, 920);
    g.fillStyle = '#cfe6d6'; for (let y = 300; y < 560; y += 32) for (let x = BX + ((y / 32) % 2) * 20; x < BX + BW; x += 40) g.fillRect(x, y, 38, 30);
    g.fillStyle = '#9cc7ab'; g.fillRect(BX, 292, BW, 10);
    for (const x of [-120, 1180]) { g.fillStyle = '#8ab0c8'; g.fillRect(x, 40, 220, 200); g.fillStyle = '#cfe9ff'; g.fillRect(x + 10, 50, 200, 180); g.fillStyle = '#ffffff'; g.fillRect(x + 105, 50, 10, 180); g.fillRect(x + 10, 135, 200, 10); }
    g.fillStyle = '#2f5a45'; g.fillRect(420, 30, 440, 200); g.fillStyle = '#3c7258'; g.fillRect(432, 42, 416, 176);   // 메뉴판
    g.fillStyle = '#fff'; g.font = '34px ' + FONT; g.textAlign = 'center'; g.fillText('오늘의 급식', 640, 92);
    g.font = '24px ' + FONT; g.fillStyle = '#e8ffe8'; ['카레라이스 · 계란국', '돈가스 · 깍두기', '우유 · 요구르트'].forEach((t, i) => g.fillText(t, 640, 136 + i * 34));
    g.fillStyle = '#9aa6b8'; g.fillRect(BX, 410, BW, 130); g.fillStyle = '#c4ccd8'; g.fillRect(BX, 400, BW, 18); g.fillStyle = '#7d889c'; g.fillRect(BX, 530, BW, 12);   // 배식대
    for (let x = 60; x < 1260; x += 150) { g.fillStyle = '#dfe5ee'; g.fillRect(x, 360, 110, 46); g.fillStyle = '#b4bccb'; g.fillRect(x, 360, 110, 8); g.fillStyle = ['#f0b04a', '#e8573f', '#f7f0d0', '#7ac36a'][(x / 150 | 0) % 4]; g.fillRect(x + 8, 368, 94, 14); }
    g.fillStyle = '#7a8496'; g.fillRect(BX, 560, BW, BH);
    for (let y = 560; y < 1000; y += 60) for (let x = BX; x < BX + BW; x += 60) { if (((x - BX) / 60 + (y - 560) / 60) % 2 < 1) { g.fillStyle = '#6a7486'; g.fillRect(x, y, 60, 60); } }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(640, 640, 560, 70, 0, 0, 7); g.fill();
    return c;
  }
  function buildClass(k) {   // 노을 진 교실: 창밖 노을·칠판·나무 바닥
    const [c, g] = bgCanvas(k);
    g.fillStyle = '#f0d6b4'; g.fillRect(BX, BY, BW, 920);
    g.fillStyle = '#c99b6e'; g.fillRect(BX, 440, BW, 110);   // 허리 판넬
    for (const x of [-230, 1110]) {
      const sk = g.createLinearGradient(0, 30, 0, 380); sk.addColorStop(0, '#ff8a5c'); sk.addColorStop(0.6, '#ffb36b'); sk.addColorStop(1, '#ffd9a0');
      g.fillStyle = '#8a5a3a'; g.fillRect(x, 20, 400, 380); g.fillStyle = sk; g.fillRect(x + 12, 32, 376, 356);
      g.fillStyle = 'rgba(255,240,200,.9)'; g.beginPath(); g.arc(x + 200, 300, 46, 0, 7); g.fill();
      g.fillStyle = '#6a4a5a'; for (let i = 0; i < 6; i++) g.fillRect(x + 12 + i * 64, 330 - (i % 3) * 30, 50, 60 + (i % 3) * 30);
      g.fillStyle = '#8a5a3a'; g.fillRect(x + 194, 32, 12, 356); g.fillRect(x + 12, 200, 376, 10);
    }
    g.fillStyle = '#6b4a2e'; g.fillRect(400, 40, 480, 270); g.fillStyle = '#2f5a45'; g.fillRect(412, 52, 456, 246);   // 칠판
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '40px ' + FONT; g.textAlign = 'center'; g.fillText('종례 5분 전', 640, 130);
    g.font = '24px ' + FONT; g.fillText('내일 준비물: 노트북 · 충전기', 640, 190); g.fillText('청소 당번: 1분단', 640, 230);
    g.fillStyle = '#e8c48a'; g.fillRect(420, 300, 440, 10);
    for (let x = 240; x < 1100; x += 210) { g.fillStyle = '#b07a48'; g.fillRect(x, 470, 150, 22); g.fillStyle = '#7a5434'; g.fillRect(x + 10, 492, 12, 56); g.fillRect(x + 128, 492, 12, 56); }
    const fg = g.createLinearGradient(0, 560, 0, 1000); fg.addColorStop(0, '#a8744a'); fg.addColorStop(1, '#6e4a2e'); g.fillStyle = fg; g.fillRect(BX, 560, BW, BH);
    g.strokeStyle = 'rgba(60,30,10,.25)'; g.lineWidth = 3; for (let y = 580; y < 1000; y += 34) { g.beginPath(); g.moveTo(BX, y); g.lineTo(BX + BW, y); g.stroke(); }
    g.fillStyle = 'rgba(255,170,90,.18)'; g.fillRect(BX, BY, BW, BH);
    g.fillStyle = 'rgba(255,220,160,.2)'; g.beginPath(); g.ellipse(640, 640, 560, 70, 0, 0, 7); g.fill();
    return c;
  }
  function buildGym(k) {   // 체육관: 나무 바닥 선·농구 골대·관람석·높은 창
    const [c, g] = bgCanvas(k);
    g.fillStyle = '#d8c7a6'; g.fillRect(BX, BY, BW, 920);
    g.fillStyle = '#b9a580'; for (let x = BX; x < BX + BW; x += 120) g.fillRect(x, -360, 8, 900);
    for (let x = -140; x < 1460; x += 220) { g.fillStyle = '#8fb5d8'; g.fillRect(x, -300, 160, 120); g.fillStyle = '#d6ecff'; g.fillRect(x + 8, -292, 144, 104); }
    g.fillStyle = '#5a6a8a'; for (let i = 0; i < 4; i++) g.fillRect(BX, 300 + i * 60, BW, 34);   // 관람석
    g.fillStyle = '#4a5878'; for (let i = 0; i < 4; i++) g.fillRect(BX, 334 + i * 60, BW, 26);
    g.fillStyle = '#ffffff'; g.fillRect(560, 40, 160, 110); g.strokeStyle = '#e8573f'; g.lineWidth = 6; g.strokeRect(600, 70, 80, 60);   // 골대
    g.strokeStyle = '#ff7a2f'; g.lineWidth = 7; g.beginPath(); g.ellipse(640, 160, 34, 8, 0, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(610 + i * 12, 162); g.lineTo(620 + i * 8, 210); g.stroke(); }
    const fg = g.createLinearGradient(0, 560, 0, 1000); fg.addColorStop(0, '#d9a76a'); fg.addColorStop(1, '#a8763e'); g.fillStyle = fg; g.fillRect(BX, 548, BW, BH);
    g.strokeStyle = 'rgba(90,50,20,.18)'; g.lineWidth = 2; for (let y = 560; y < 1000; y += 24) { g.beginPath(); g.moveTo(BX, y); g.lineTo(BX + BW, y); g.stroke(); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.ellipse(640, 700, 260, 60, 0, 0, 7); g.stroke(); g.strokeStyle = '#2f6bff'; g.beginPath(); g.moveTo(BX, 640); g.lineTo(BX + BW, 640); g.stroke();
    return c;
  }
  function buildRoof(k) {   // 밤 옥상: 별·도시 불빛·철망·물탱크
    const [c, g] = bgCanvas(k);
    const sk = g.createLinearGradient(0, -360, 0, 560); sk.addColorStop(0, '#0a0f2c'); sk.addColorStop(1, '#2a2a5e'); g.fillStyle = sk; g.fillRect(BX, BY, BW, 920);
    const r = rng(7); g.fillStyle = '#fff'; for (let i = 0; i < 120; i++) g.fillRect(BX + r() * BW, -360 + r() * 600, r() < 0.2 ? 3 : 2, r() < 0.2 ? 3 : 2);
    g.fillStyle = '#fff8d6'; g.beginPath(); g.arc(1040, -150, 60, 0, 7); g.fill(); g.fillStyle = '#2a2f5e'; g.beginPath(); g.arc(1062, -166, 54, 0, 7); g.fill();
    for (let x = BX; x < BX + BW; x += 70) { const h = 120 + r() * 220; g.fillStyle = '#161a3a'; g.fillRect(x, 470 - h, 64, h + 90); g.fillStyle = '#ffd86a'; for (let y = 480 - h; y < 540; y += 22) for (let wx = x + 8; wx < x + 58; wx += 16) if (r() < 0.35) g.fillRect(wx, y, 8, 10); }
    g.fillStyle = '#6a7090'; g.fillRect(1180, 260, 160, 160); g.fillStyle = '#8a90b0'; g.fillRect(1170, 250, 180, 20);   // 물탱크
    g.strokeStyle = 'rgba(200,210,240,.35)'; g.lineWidth = 2; for (let x = BX; x < BX + BW; x += 26) { g.beginPath(); g.moveTo(x, 420); g.lineTo(x + 26, 548); g.moveTo(x + 26, 420); g.lineTo(x, 548); g.stroke(); }
    g.fillStyle = '#8a90b0'; g.fillRect(BX, 414, BW, 8);
    g.fillStyle = '#4a5a52'; g.fillRect(BX, 548, BW, BH); g.strokeStyle = 'rgba(255,255,255,.06)'; for (let x = BX; x < BX + BW; x += 80) { g.beginPath(); g.moveTo(x, 548); g.lineTo(x, 1000); g.stroke(); }
    g.fillStyle = 'rgba(180,200,255,.12)'; g.beginPath(); g.ellipse(640, 640, 560, 70, 0, 0, 7); g.fill();
    return c;
  }
  function buildHall(k) {   // 대강당 무대: 빨간 막·현수막·나무 무대 바닥·앞쪽 관객 머리
    const [c, g] = bgCanvas(k);
    g.fillStyle = '#2a0a14'; g.fillRect(BX, BY, BW, 920);
    for (let x = BX; x < BX + BW; x += 60) { const gr = g.createLinearGradient(x, 0, x + 60, 0); gr.addColorStop(0, '#5a0f22'); gr.addColorStop(0.5, '#9a1c38'); gr.addColorStop(1, '#4a0c1c'); g.fillStyle = gr; g.fillRect(x, -360, 60, 920); }
    g.fillStyle = '#6a1226'; g.fillRect(BX, -360, BW, 140); g.fillStyle = '#b8243f';
    for (let x = BX; x < BX + BW; x += 80) { g.beginPath(); g.arc(x + 40, -220, 40, 0, Math.PI); g.fill(); }
    g.fillStyle = '#e8b84a'; g.fillRect(BX, -226, BW, 8);
    g.fillStyle = '#14141c'; g.fillRect(350, 0, 580, 110); g.fillStyle = '#ffd23a'; g.fillRect(358, 8, 564, 94);   // 현수막
    g.fillStyle = '#14141c'; g.font = '50px ' + FONT; g.textAlign = 'center'; g.fillText('영상고 랩 배틀', 640, 72);
    const fg = g.createLinearGradient(0, 560, 0, 1000); fg.addColorStop(0, '#9a6a3e'); fg.addColorStop(1, '#5a3a22'); g.fillStyle = fg; g.fillRect(BX, 548, BW, 360);
    g.strokeStyle = 'rgba(40,20,5,.3)'; g.lineWidth = 3; for (let y = 570; y < 900; y += 30) { g.beginPath(); g.moveTo(BX, y); g.lineTo(BX + BW, y); g.stroke(); }
    g.fillStyle = '#2a1a10'; g.fillRect(BX, 900, BW, 24); g.fillStyle = '#0c0a12'; g.fillRect(BX, 924, BW, BH);
    for (let x = BX + 20; x < BX + BW; x += 70) { const y = 960 + ((x / 70) % 2) * 18; g.fillStyle = '#16131f'; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); g.fillRect(x - 46, y + 20, 92, 80); }
    g.fillStyle = 'rgba(255,220,150,.12)'; g.beginPath(); g.ellipse(640, 650, 560, 70, 0, 0, 7); g.fill();
    return c;
  }
  function fan(x, y, bop, mood, T) {   // 스피커 위에 앉은 친구: 박자마다 끄덕, 콤보 50마다 환호, 콤보 끊기면 시무룩
    const c = CH.fr, cheer = mood === 1, sad = mood === 2, sw = Math.sin(T * 6) * (cheer ? 12 : 5);
    cx.save(); cx.translate(x, y); cx.scale(0.62, 0.62);
    lim(-28, -6, -34 + sw, 78, 26, c.pants); lim(28, -6, 34 - sw, 78, 26, c.pants);
    for (const s of [-1, 1]) { rr(s * 34 - 24 + (s < 0 ? sw : -sw), 70, 48, 22, 11); inkFill('#f3f3f7', 4); }
    cx.translate(0, (sad ? 8 : 0) + bop * 6);
    const hs = cheer ? [[-104, -240 + Math.sin(T * 14) * 12], [104, -240 - Math.sin(T * 14) * 12]] : sad ? [[-50, -40], [50, -40]] : [[-62, -12], [62, -12]];
    for (const [i, h] of hs.entries()) { const sx = i ? 52 : -52; lim(sx, -96, h[0], h[1], 22, c.body2); dot(h[0], h[1], 12, c.skin); }
    rr(-60, -128, 120, 124, 40); inkFill(c.body);
    cx.save(); cx.translate(0, -190 - bop * 4); cx.rotate(sad ? 0.08 : Math.sin(T * 3.3) * 0.05); head(c, c, 0, 0, sad ? 8 : 0, cheer ? 1 : sad ? 2 : 0); cx.restore();
    cx.restore();
  }
  function speaker(x, fy, pulse) {
    rr(x - 88, fy - 262, 176, 262, 18); inkFill('#20223a', 6);
    for (const [y, r] of [[fy - 200, 40], [fy - 92, 54]]) { const rr2 = r * (1 + pulse * 0.07); dot(x, y, rr2, '#3a3d5c', 5); dot(x, y, rr2 * 0.62, '#14162a', 3); dot(x, y, rr2 * 0.2, '#5a5e80', 3); }
    dot(x + 66, fy - 248, 5, pulse > 0.3 ? '#3ed27a' : '#1d5a36', 2);
  }

  /* ── 화면 그리기 ── */
  function layout() {
    const land = W >= H * 1.05, mid = opt.mid || !land;
    const lw = mid ? Math.min(W * 0.2, 112, H * 0.15) : Math.min(W * 0.105, 104, H * 0.15);
    return { land, mid, lw, pcx: mid ? W / 2 : W * 0.75, ocx: W * 0.25, ry: opt.down ? H - lw * 0.95 : lw * 0.9, dir: opt.down ? -1 : 1 };
  }
  function render(T, dt) {
    const L = layout(), playing = !!G && T !== null, spb = G ? G.spb : 0.6, now = performance.now();
    const bf = playing ? T / spb : now / 1000 / 0.6, beatPulse = Math.max(0, 1 - ((bf % 1) + 1) % 1 * 4);
    // 카메라: 부르는 사람 쪽으로
    let tx = 640;
    if (playing && T >= 0) { const b = T / spb, s = G.secs.find(q => b >= q.b0 && b < q.b1); if (s && s.who !== 2) tx = s.who === 0 ? 520 : 760; }
    if (!L.land) tx = Math.max(580, Math.min(700, tx));
    cam.x += (tx - cam.x) * Math.min(1, dt * 3); cam.z *= Math.exp(-dt * 5); cam.hz *= Math.exp(-dt * 6);
    const s = (L.land ? Math.max(W / 1280, H / 720) : W / 980) * (1 + cam.z);
    const st = G ? G.S.stage : 'studio', [cW, cF] = STAGE_C[st];
    const k = Math.min(1.5, Math.max(0.6, s * DPR)); if (!bgC || bgC.st !== st || Math.abs(k - bgK) > 0.25) { bgK = k; bgC = buildBg(k, st); bgC.st = st; }
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.fillStyle = '#1a2150'; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(W / 2, L.land ? H * 0.5 : H * 0.47); cx.scale(s, s); cx.translate(-cam.x, -380);
    cx.fillStyle = cW; cx.fillRect(BX - 3000, BY - 3000, BW + 6000, 3000); cx.fillRect(BX - 3000, BY, 3000, 920); cx.fillRect(BX + BW, BY, 3000, 920);
    cx.fillStyle = cF; cx.fillRect(BX - 3000, BY + BH - 2, BW + 6000, 3000); cx.fillRect(BX - 3000, 560, 3000, BH); cx.fillRect(BX + BW, 560, 3000, BH);
    cx.drawImage(bgC, BX, BY, BW, BH);
    const singing = playing && (T < G.pose[0].end || T < G.pose[1].end);
    if (st === 'studio') {
    rr(560, 30, 160, 46, 12); inkFill(singing ? '#e0293f' : '#4a2030', 5);   // ON AIR
    if (singing) { cx.save(); cx.globalAlpha = 0.25; cx.fillStyle = '#ff3a50'; cx.beginPath(); cx.ellipse(640, 53, 130, 50, 0, 0, 7); cx.fill(); cx.restore(); }
    cx.font = '30px ' + FONT; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = singing ? '#fff' : '#a07080'; cx.fillText('ON AIR', 640, 55); cx.textBaseline = 'alphabetic';
    for (const [x, who] of [[300, 0], [980, 1]]) {   // 조명
      const on = playing && T < G.pose[who].end; cx.fillStyle = `rgba(255,240,180,${on ? 0.1 : 0.035})`;
      cx.beginPath(); cx.moveTo(x - 30, -360); cx.lineTo(x + 30, -360); cx.lineTo(x + 170, 610); cx.lineTo(x - 170, 610); cx.closePath(); cx.fill();
    }
    } else if (st === 'cafe') {   // 국통 김
      const tm = now / 1000; cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 6; cx.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const x = 115 + i * 150, ph = tm * 1.4 + i; cx.globalAlpha = 0.25 + 0.25 * Math.sin(ph); cx.beginPath(); cx.moveTo(x, 355); cx.quadraticCurveTo(x + 14 * Math.sin(ph * 2), 320, x, 285 - 10 * Math.sin(ph)); cx.stroke(); }
      cx.globalAlpha = 1;
    } else if (st === 'class') {   // 노을 빛줄기
      cx.fillStyle = `rgba(255,190,110,${0.08 + beatPulse * 0.04})`; for (const x of [-30, 1310]) { cx.beginPath(); cx.moveTo(x - 160, 40); cx.lineTo(x + 160, 40); cx.lineTo(640 + (x - 640) * 0.2 + 220, 620); cx.lineTo(640 + (x - 640) * 0.2 - 220, 620); cx.closePath(); cx.fill(); }
    } else if (st === 'roof') {   // 반짝이는 별
      const tm = now / 1000; for (let i = 0; i < 14; i++) { const a = 0.4 + 0.6 * Math.abs(Math.sin(tm * 1.7 + i * 2.3)); cx.globalAlpha = a; txt('✦', -100 + i * 110, -260 + (i * 73) % 300, 18, '#fff8d6'); } cx.globalAlpha = 1;
    } else if (st === 'gym') {
      cx.fillStyle = `rgba(255,255,230,${0.05 + beatPulse * 0.05})`; cx.fillRect(BX, BY, BW, 560 - BY);
    } else {   // 대강당: 박자 따라 흔들리는 색 조명
      const tm = now / 1000; cx.globalCompositeOperation = 'lighter';
      [['255,80,140', -200, 1.1], ['80,160,255', 1480, 0.9], ['255,220,90', 640, 1.4]].forEach(([c, x0, sp], i) => {
        const a = Math.sin(tm * sp + i) * 0.5, tx = 640 + Math.sin(tm * sp * 0.7 + i * 2) * 420;
        cx.fillStyle = `rgba(${c},${0.1 + beatPulse * 0.08})`; cx.beginPath(); cx.moveTo(x0 - 30, -360); cx.lineTo(x0 + 30, -360); cx.lineTo(tx + 150 + a * 40, 640); cx.lineTo(tx - 150 + a * 40, 640); cx.closePath(); cx.fill();
      });
      cx.globalCompositeOperation = 'source-over';
    }
    speaker(640, 600, playing && T >= 0 ? beatPulse : 0);
    const bop = Math.pow(beatPulse, 2), dead = state === 'over';
    fan(640, 340, bop, G && (G.fan.until > (T ?? 0)) ? G.fan.m : 0, now / 1000);
    const tt = playing ? T : 0, opp = G ? G.opp : CH.sb;
    drawChar(opp, 300, 610, 1, G ? G.pose[0] : { l: -1, end: 0, miss: 0 }, tt, bop, false);
    drawChar(CH.me, 980, 610, -1, G ? G.pose[1] : { l: -1, end: 0, miss: 0 }, tt, bop, dead);
    cx.restore();
    if (G && G.conf2 && G.conf2.length) {
      for (const p of G.conf2) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6; if (p.y > 1.1) { p.y = -0.05; p.x = Math.random(); } cx.save(); cx.translate(p.x * W, p.y * H); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-5, -3, 10, 6); cx.restore(); }
    }
    if (!playing || state === 'over' || state === 'result') return;
    // HUD(마디마다 쿵)
    const hz = 1 + cam.hz; cx.save(); cx.translate(W / 2, H / 2); cx.scale(hz, hz); cx.translate(-W / 2, -H / 2);
    const spd = (H * 0.82) / G.appr, lw = L.lw;
    const strum = (ccx, who) => {
      for (let l = 0; l < 4; l++) {
        const x = ccx + (l - 1.5) * lw;
        if (who === 1) { const c = T - G.conf[l] < 0.12 || G.holdN[l]; arrow(x, L.ry, lw * 0.4 * (G.held[l] && !c ? 0.88 : c ? 1.06 : 1), l, c ? COL[l] : G.held[l] ? '#6a73b0' : '#3a4170', 1); }
        else { const c = T < G.oconf[l] + 0.12; arrow(x, L.ry, lw * 0.4 * (c ? 1.05 : 1), l, c ? COL[l] : '#3a4170', 1); }
      }
      const list = who ? G.PN : G.ON;
      for (const n of list) {
        const dtn = n.t - T; if (dtn > G.appr + 0.2) break; if (n.st === 2) continue;
        if (n.st === 3 && -(dtn + n.d) > 0.4) continue;
        const x = ccx + (n.lane - 1.5) * lw, yh = n.st === 1 ? L.ry : L.ry + L.dir * dtn * spd, al = n.st === 3 ? 0.3 : 1;
        if (n.d > 0) { const ye = L.ry + L.dir * (dtn + n.d) * spd; const y0 = Math.min(yh, ye), y1 = Math.max(yh, ye); if (y1 - y0 > 2) { cx.globalAlpha = al * 0.85; rr(x - lw * 0.12, y0, lw * 0.24, y1 - y0, lw * 0.12); inkFill(COL[n.lane], 3); cx.globalAlpha = 1; } }
        if (n.st !== 1) arrow(x, yh, lw * 0.4, n.lane, COL[n.lane], al);
      }
    };
    if (!L.mid) strum(L.ocx, 0);
    strum(L.pcx, 1);
    for (let i = G.spl.length - 1; i >= 0; i--) {   // 완벽 물보라
      const sp = G.spl[i], a = (now - sp.t) / 320; if (a >= 1) { G.spl.splice(i, 1); continue; }
      const x = L.pcx + (sp.l - 1.5) * lw; cx.globalAlpha = 1 - a; cx.strokeStyle = COL[sp.l]; cx.lineWidth = 5 * (1 - a) + 1;
      for (let j = 0; j < 8; j++) { const an = j * Math.PI / 4 + sp.l, r0 = lw * (0.35 + a * 0.5), r1 = r0 + lw * 0.18 * (1 - a); cx.beginPath(); cx.moveTo(x + Math.cos(an) * r0, L.ry + Math.sin(an) * r0); cx.lineTo(x + Math.cos(an) * r1, L.ry + Math.sin(an) * r1); cx.stroke(); }
      cx.globalAlpha = 1;
    }
    // 판정·콤보
    const px = L.mid ? (L.land ? L.pcx - lw * 3.3 : L.pcx) : W / 2, py = L.mid && !L.land ? H * 0.55 : H * 0.42;
    for (const p of G.pops) {
      const a = (now - p.t) / 1000; if (a > 0.8) continue; p.y = p.vy * a + 380 * a * a;
      cx.globalAlpha = a < 0.45 ? 1 : 1 - (a - 0.45) / 0.35;
      txt(p.i < 4 ? RATE[p.i].n : p.i === 5 ? '헛누름' : '놓침', px, py + p.y, Math.min(46, lw * 0.5), p.i < 4 ? RATE[p.i].c : '#ff6b7a');
      if (p.c >= 5) txt(String(p.c), px, py + p.y + lw * 0.48, Math.min(34, lw * 0.36), '#fff');
      cx.globalAlpha = 1;
    }
    // 카운트다운·안내
    const beat = T / spb;
    if (beat >= -4 && beat < 0) { const i = Math.floor(beat + 4), a = (beat + 4) % 1; cx.globalAlpha = 1 - a * 0.7; txt(['3', '2', '1', '가자!'][i], W / 2, H * 0.45, Math.min(90, H * 0.14) * (1 + (1 - a) * 0.15), i === 3 ? '#ffd84a' : '#fff'); cx.globalAlpha = 1; }
    if (story && story.i === 0 && G.d === 0 || (!story && rec[rk(G.S, G.d)] === undefined && G.idx === 0)) {
      if (T >= 0 && T < G.firstP - spb * 0.5) txt('선배가 부른 화살표를 보고, 내 차례에 똑같이!', W / 2, opt.down ? H * 0.2 : H * 0.8 - 40, Math.min(22, W * 0.04), '#ffd84a');
    }
    // 체력 바 + 아이콘
    const bw = Math.min(W * (L.land ? 0.48 : 0.8), 600), bx = (W - bw) / 2, by = opt.down ? 46 : H - 58, split = bx + bw * (1 - G.hp);
    rr(bx - 4, by - 4, bw + 8, 22, 11); cx.fillStyle = INK; cx.fill();
    cx.fillStyle = G.opp.body; cx.fillRect(bx, by, Math.max(0, split - bx), 14); cx.fillStyle = CH.me.body; cx.fillRect(split, by, bx + bw - split, 14);
    const ib = 1 + Math.pow(beatPulse, 3) * 0.15, ic = (c, x, mood, face) => { cx.save(); cx.translate(x, by + 7); cx.scale(0.36 * ib, 0.36 * ib); head(c, mood === 2 ? Object.assign({}, c, { skin: '#e6d0d8' }) : c, face, 0, 0, mood); cx.restore(); };
    ic(G.opp, split - 26, G.hp > 0.8 ? 2 : 0, 1); ic(CH.me, split + 26, G.hp < 0.2 ? 2 : 0, -1);
    const a = accP(G), [gn] = grade(a, G.cnt[4], !G.cnt[4] && !G.cnt[1] && !G.cnt[2] && !G.cnt[3]);
    txt(`점수 ${fmt(G.score)}  ·  놓침 ${G.cnt[4]}  ·  ${G.wN ? a.toFixed(2) + '% (' + gn + ')' : '-'}`, W / 2, opt.down ? by + 36 : by - 22, Math.min(18, W * 0.032), '#fff');
    txt(G.S.name + ' · ' + DIFFS[G.d].n, opt.down ? 60 : 22, opt.down ? 24 : H - 16, 14, 'rgba(255,255,255,.75)', 'left');
    cx.restore();
    if (touchUI) {   // 터치 칸 표시(FNF 모바일 히트박스처럼)
      for (let l = 0; l < 4; l++) { const x = l * W / 4; cx.fillStyle = G.held[l] ? COL[l] + '30' : 'rgba(255,255,255,.025)'; cx.fillRect(x + 1, 0, W / 4 - 2, H); cx.fillStyle = COL[l] + (G.held[l] ? 'cc' : '55'); cx.fillRect(x + 6, opt.down ? 0 : H - 5, W / 4 - 12, 5); }
    }
  }
  function frame(ts) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, lastF ? (ts - lastF) / 1000 : 0.016); lastF = ts;
    let T = null;
    if (G && AC) { T = songT(); if (state === 'play') { update(T, dt); if (G) T = songT(); } }
    render(G ? T : null, dt);
    if (AC) {
      const want = !opt.music ? null : state === 'over' && M ? 'over' : state === 'title' ? 'menu' : state === 'result' && G && G.resAt && performance.now() - G.resAt > 3200 ? 'menu' : null;
      if (want !== bgm.kind) setBgm(want); bgmTick();
    }
  }

  return {
    start() { fit(); showMenu(mTitle); raf = requestAnimationFrame(frame); },
    restart() { if (!G) return false; initAudio(); restart(); return true; },   // 사이트 공통 '다시 시작' 버튼 → 지금 곡 처음부터(곡이 없으면 false → 사이트가 게임을 새로 엶)
    get _g() { return { G, state, AC, songT: () => G && AC ? songT() : null }; },   // 검사용
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', kDown, true); document.removeEventListener('keyup', kUp, true);
      document.removeEventListener('visibilitychange', vis); removeEventListener('blur', blur); removeEventListener('resize', fit);
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
      if (isFs()) try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
      if (AC) AC.close().catch(() => {});
      O.onQuit?.();
    },
  };
}
export const __test = { SONGS, buildSong };
