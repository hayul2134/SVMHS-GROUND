// 게임 효과음 크기 측정(2026-11-01 하율 "모든 게임 효과음 데시벨 통일, 튀는 거 없게")
// 각 게임 파일에서 소리 함수 원본을 그대로 잘라 와 OfflineAudioContext로 렌더 → 소리마다 최대 순간 라우드니스(LUFS-M, BS.1770 K-가중 400ms)와 피크를 잼.
// 실행: node tools/sfx/level.mjs [게임이름…]   (기준값 TARGET ±TOL 밖이면 ✗)
// 새 효과음을 넣으면 아래 GAMES의 ev에 한 줄 추가해 이 검사로 크기를 맞출 것.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // 전역 설치본도 찾게

export const TARGET = -38, TOL = 1.5, TICK = -43, BED = -46;   // 일반 소리 -38 LUFS(지금 소리들의 가운데쯤) · 자주 나는 짧은 틱(이동·드래그·째깍)은 -43 · 계속 깔리는 엔진은 -46
const JS = new URL('../../public/js/', import.meta.url);
export const src = f => readFileSync(new URL(f, JS), 'utf8');

// 문장 하나 잘라 오기: 시작 패턴부터 'function'이면 닫는 }까지, 아니면 깊이 0의 ;까지 (문자열·주석 건너뜀)
export function grab(text, re) {
  const m = re.exec(text); if (!m) throw new Error('못 찾음: ' + re);
  let i = m.index, d = 0, q = null, fn = /^(export\s+)?function\b/.test(text.slice(i)), seen = false;
  for (; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && n === '/') { i = text.indexOf('\n', i); continue; }
    if (c === '/' && n === '*') { i = text.indexOf('*/', i) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if ('([{'.includes(c)) { d++; seen = true; }
    else if (')]}'.includes(c)) { d--; if (fn && d === 0 && c === '}') return text.slice(m.index, i + 1).replace(/^export\s+/, ''); }
    else if (c === ';' && d === 0 && !fn) return text.slice(m.index, i + 1);
  }
  throw new Error('끝 못 찾음: ' + re);
}
const pick = (file, ...res) => { const t = src(file); return res.map(r => grab(t, r)).join('\n'); };
const sfxJs = () => pick('sfx.js', /function au\(\)/, /function makeSfx\(/);

// 게임 정의 — file: 소리가 있는 파일 · stub: 판 변수 · code: 소리 함수 원본 · ev: [이름, 부분들, 종류]
// 부분: 문자열 = 그대로 실행할 코드 · { re } = 그 파일에서 찾은 실제 코드(n: 이어지는 문장 수, call: 첫 함수 호출만, from: 이 패턴 뒤에서 찾기)
// 종류: 없음 = 일반 소리 · 'tick' = 자주 나는 짧은 틱 · 'bed' = 계속 깔리는 소리(엔진)
export const P = (re, o = {}) => ({ re, ...o });
export const GAMES = {
  runner: { file: 'runner.js', stub: 'let sound = true, actx = null; const opt = {};', code: () => pick('runner.js', /function beep\(f1/, /const fx = /, /function noise\(dur/, /const seq = /, /const SFX = \{/).replace('const fx = !!opt.sfx2;', 'const fx = true;'), ev: [
    ['점프', 'SFX.jump()'], ['높이 점프', 'SFX.boost()'], ['착지', 'SFX.land()', 'tick'], ['숙이기', 'SFX.duck()', 'tick'], ['급강하', 'SFX.dive()'], ['아슬아슬', 'SFX.close()'],
    ['비둘기', 'SFX.pigeon()'], ['종이비행기', 'SFX.plane()'], ['100m', 'SFX.hundred(100)'], ['1000m', 'SFX.hundred(1000)'], ['최고 기록', 'SFX.best()'],
    ['넘어짐', 'SFX.hit()'], ['집 도착', 'SFX.arrive()'], ['문', 'SFX.door()'],
    ['(옛)점프', [P(/beep\(520, 880/)]], ['(옛)100m', [P(/beep\(780, 1180/, { from: /SFX\.hundred\(m\) :/ })]], ['(옛)도착', [P(/beep\(523, 523/, { n: 3 })]], ['(옛)문', [P(/beep\(784, 523/, { from: /SFX\.door\(\) :/ })]], ['(옛)넘어짐', [P(/beep\(300, 70/, { from: /SFX\.hit\(\) :/ })]]] },
  stair: { file: 'stair.js', stub: 'let sound = true, ac = null; const st = { steps: 3 };', code: () => pick('stair.js', /function beep\(f, d/, /const tune = /), ev: [
    ['한 칸', [P(/beep\(392 \+/)], 'tick'], ['헛디딤', [P(/beep\(300, \.35/)]], ['옥상', 'tune()'], ['시간 끝', [P(/\[880, 660, 880, 660\]/)]], ['소리 켬', [P(/beep\(660, \.05/)]]] },
  gear: { file: 'gear.js', stub: 'let sound = true, actx = null, noiseBuf = null; const up = 1;', code: () => pick('gear.js', /function beep\(f1, f2, dur, type = 'square', vol = \.04/, /function crunch\(/, /const thump = /, /function hiss\(/, /const clap = /, /const PLACE = \{/), ev: [
    ['좌우 이동', [P(/beep\(330 \+ Math/)], 'tick'], ['내리꽂기', ['const n = 3;', P(/thump\([^)]*\); if \(n > 2\)/, { n: 2 })]], ['보관', [P(/beep\(440, 330/, { n: 2 })]],
    ...['O', 'Z', 'I', 'T', 'L', 'J', 'S'].map(k => ['놓기 ' + k, [`const p = { k: '${k}' };`, P(/beep\(150, 90/, { n: 2 })]]),
    ...[[1, 0], [2, 0], [3, 0], [4, 1]].map(([n, t]) => [n + '줄', [`const n = ${n}, tet = ${t};`, P(/const lk = /, { n: 3 }), P(/if \(tet\) \{ \[523/)]]),
    ['레벨 업', [P(/\[523, 784, 1047, 1568\]/)]], ['위험 경고', [P(/beep\(196, 185/, { n: 2 })]]] },
  n25: { file: 'n25.js', stub: 'let sound = true, actx = null; const SCALE = [0, 2, 4, 7, 9];', code: () => pick('n25.js', /const hz = /, /const ac = \(\) =>/, /const tone = /, /const sfx = /), ev: [
    ['맞음', "sfx('ok', 3)", 'tick'], ['틀림', "sfx('bad')"], ['5의 배수', "sfx('cp', 4)"], ['끝', "sfx('end')"]] },
  cut: { file: 'cut.js', stub: 'let sound = true, actx = null;', code: () => pick('cut.js', /const ac = \(\) =>/, /const tone = /, /const snip = /, /const sfx = /), ev: [
    ['퍼펙트', "sfx('perfect')"], ['그레이트', "sfx('great')"], ['굿', "sfx('good')"], ['미스', "sfx('miss')"]] },
  film: { file: 'film.js', stub: 'let sound = true, ac = null;', code: () => pick('film.js', /function au\(\)/, /function tone\(f, d/, /function bell\(/, /function snip\(/), ev: [
    ['합 바뀜', ['const ok = false, sum = 6;', P(/tone\(ok \? 990/)], 'tick'], ['10 됨', ['const ok = true, sum = 10;', P(/tone\(ok \? 990/)], 'tick'], ['합 틀림', [P(/tone\(180, \.09/)]], ['지움(2개)', 'snip(2)'], ['지움(4개)', 'snip(4)'], ['지움(8개)', 'snip(8)'],
    ['보너스', [P(/tone\(660, \.08/, { n: 2 })]], ['째깍', ['const s = 8;', P(/tone\(s <= 3/)], 'tick'], ['째깍(3초)', ['const s = 3;', P(/tone\(s <= 3/)], 'tick'],
    ['시작', [P(/tone\(523, \.08/, { n: 2 })]], ['끝(신기록)', ['const nb = 1;', P(/tone\(nb \? 784/, { n: 2 })]], ['끝', ['const nb = 0;', P(/tone\(nb \? 784/, { n: 2 })]]] },
  blast: { file: 'blast.js', stub: 'let sound = true, ac = null;', code: () => pick('blast.js', /let master = null;/, /function au\(\)/, /function tone\(f, d/, /function noise\(d, vol/, /function blip\(/, /function sndClear\(/), ev: [
    ['못 놓음', [P(/tone\(180, \.08/)]], ['집기', [P(/tone\(440, \.04/)], 'tick'], ['놓기', ['const s = [1, 2, 3, 4];', P(/tone\(170, \.12/, { n: 4 })]],
    ['1줄', 'sndClear(1, 1, false)'], ['2줄', 'sndClear(2, 1, false)'], ['3줄 연속5', 'sndClear(3, 5, false)'], ['4줄', 'sndClear(4, 2, false)'], ['전체 송출', 'sndClear(2, 3, true)'],
    ['같은 장면', [P(/for \(let j = 0; j < 10; j\+\+\) blip/)]], ['새 조각', [P(/tone\(660, \.05/)]], ['시작', [P(/tone\(523, \.08/, { n: 2 })]], ['끝', ['const nb = 0;', P(/tone\(nb \? 784/, { n: 2 })]]] },
  chase: { file: 'chase.js', stub: '', code: () => pick('chase.js', /function makeSfx\(\)/) + '\nconst S = makeSfx(); S.set(true);', ev: [
    ['칼치기', 'S.near(3, false)'], ['아슬 칼치기', 'S.near(3, true)'], ['콤보', 'S.combo(5)'], ['코인', 'S.coin()'], ['연료', 'S.fuel()'], ['상자', 'S.box()'],
    ['부스터', 'S.boost()'], ['부스터 끝', 'S.boostEnd()'], ['점프', 'S.jump()'], ['차선', 'S.lane()', 'tick'], ['착지', 'S.land()'], ['차 날림', 'S.smash(false)'], ['벽 부숨', 'S.smash(true)'],
    ['파편 쿵', 'S.thud(1)'], ['점프대', 'S.ramp()'], ['슬립스트림', 'S.slip()'], ['충돌', 'S.crash()'], ['카운트', 'S.beep(false)'], ['출발', 'S.beep(true)'], ['경고', 'S.warn()'], ['기름 없음', 'S.empty()'], ['멈춤', 'S.stop()'],
    ['엔진', 'S.engine(300, 0); setTimeout(() => S.engine(300, 0), 500)', 'bed'], ['엔진 부스터', 'S.engine(400, 1); setTimeout(() => S.engine(400, 1), 500)', 'bed']] },
  dance: { file: 'dance.js', stub: '', code: () => pick('dance.js', /function makeSfx\(\)/) + '\nconst S = makeSfx(); S.set(true);', ev: [
    ['카운트', 'S.beep(false)'], ['시작', 'S.beep(true)'], ['톡톡(흠…)', 'S.tap()'], ['휙(돌아봄)', 'S.whip()'], ['곁눈질', 'S.peek()'], ['세이프', 'S.safe()'], ['걸림', 'S.caught()'], ['배율', 'S.mult(4)'],
    ['쿵짝', 'S.beat(true, 0, 2)', 'tick']] },
};
const SFXJS = { stub: "const store = { get: () => true, set() {} }; let ac = null;", code: () => sfxJs() + "\nconst sfx = makeSfx('k');" };
const rx = /rx_snd/, mine = /cz_snd_mine/, snake = /cz_snd_snake/, t48 = /cz_snd_2048/, C = (re, from) => P(re, { call: true, from });
Object.assign(GAMES, {
  mine: { file: 'casual.js', ...SFXJS, ev: [
    ['깃발', [C(/sfx\.tone\(880, \.06/, mine)], 'tick'], ['깃발 뺌', [C(/sfx\.tone\(660, \.05/, mine)], 'tick'], ['한 번에 열기', [C(/sfx\.tone\(520, \.05/, mine)], 'tick'],
    ['열기', ['const k = 3;', C(/sfx\.tone\(560 \+/, mine)], 'tick'], ['많이 열림', [C(/sfx\.tone\(440, \.07/, mine), ';', C(/sfx\.tone\(990, \.08/, mine)]],
    ['지뢰', [P(/sfx\.noise\(\.5/, { n: 2, from: mine })]], ['성공', [P(/\[523, 659, 784, 1047\]/, { from: mine })]]] },
  snake: { file: 'casual.js', ...SFXJS, ev: [
    ['시작', [C(/sfx\.tone\(523, \.07/, snake)]], ['방향', [C(/sfx\.tone\(330, \.025/, snake)], 'tick'], ['먹음', ['const score = 10;', C(/sfx\.tone\(700 \+/, snake)]],
    ['부딪힘', [P(/sfx\.noise\(\.25/, { n: 3, from: snake })]], ['다 채움', [P(/\[523, 659, 784, 1047\]/, { from: snake })]]] },
  t2048: { file: 'casual.js', ...SFXJS, ev: [
    ['시작', [C(/sfx\.tone\(523, \.07/, t48)]], ['못 밂', [C(/sfx\.tone\(140/, t48)], 'tick'], ['합침', ['const k = 5;', C(/sfx\.tone\(300 \+ k/, t48)]],
    ['합침 128↑', ['const k = 7;', C(/sfx\.tone\(300 \+ k/, t48), ';', C(/sfx\.tone\(660 \+ k/, t48)]], ['밂', [C(/sfx\.tone\(220, \.04/, t48)], 'tick'],
    ['끝', [P(/\[392, 330, 262\]/, { from: t48 })]], ['2048!', [P(/\[523, 659, 784, 1047\]/, { from: t48 })]]] },
  react: { file: 'social.js', ...SFXJS, ev: [
    ['지금!', [C(/sfx\.tone\(1046, \.12/, rx)]], ['너무 빨리', [C(/sfx\.tone\(180, \.22/, rx)]], ['준비', [C(/sfx\.tone\(440, \.05, 'triangle'/, rx)], 'tick'], ['기록', ['const ms = 250;', C(/sfx\.tone\(ms < 200/, rx)]]] },
});
// 부분 → 실행할 코드
export function part(file, p) {
  if (typeof p === 'string') return p;
  let t = src(file), off = 0;
  if (p.from) { const m = p.from.exec(t); if (!m) throw new Error('못 찾음: ' + p.from); off = m.index; }
  t = t.slice(off);
  if (p.call) { const m = p.re.exec(t); if (!m) throw new Error('못 찾음: ' + p.re); let i = t.indexOf('(', m.index), d = 0; for (; i < t.length; i++) { if (t[i] === '(') d++; else if (t[i] === ')' && !--d) break; } return t.slice(m.index, i + 1) + ';'; }
  let pos = 0, start = -1, re = p.re;   // 원문 그대로(문장 사이 공백 포함) 돌려줌 — tune.mjs가 이 글을 찾아 고침
  for (let k = 0; k < (p.n || 1); k++) { const rest = t.slice(pos), s = grab(rest, re), at = pos + rest.indexOf(s); if (start < 0) start = at; pos = at + s.length; re = /\S/; }
  return t.slice(start, pos);
}

// 브라우저 쪽: 소리 하나 렌더 → LUFS-M 최대·피크
const PAGE = `
const SR = 48000; let T0 = 0;
class OC extends OfflineAudioContext { get currentTime() { return T0; } get state() { return 'running'; } resume() { return Promise.resolve(); } }
function kw(x) {   // BS.1770 K-가중(48kHz 계수)
  const f = (b, a) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  x = f([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
  return f([1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
}
window.measure1 = async (code, len) => {
  const ctx = new OC(2, Math.ceil(SR * len), SR); T0 = 0;
  const win = { AudioContext: function () { return ctx; } };
  const st = (f, ms) => { const s = T0; T0 += (ms || 0) / 1000; try { f(); } finally { T0 = s; } };
  new Function('window', 'setTimeout', code)(win, st);
  const b = await ctx.startRendering(), W = SR * .4, H = SR * .01;
  const ch = [0, 1].map(c => b.getChannelData(c)), k = ch.map(kw);
  let pk = 0; for (const c of ch) for (const v of c) pk = Math.max(pk, Math.abs(v));
  const cs = k.map(c => { const s = new Float64Array(c.length + 1); for (let i = 0; i < c.length; i++) s[i + 1] = s[i] + c[i] * c[i]; return s; });
  let mx = 0; for (let i = 0; i + W <= b.length; i += H) { let e = 0; for (const s of cs) e += (s[i + W] - s[i]) / W; mx = Math.max(mx, e); }
  return { mx, pk };
};
window.measure = async (code, len) => {   // 잡음은 할 때마다 달라서 5번 렌더해 평균(피크는 가장 큰 것)
  let e = 0, p = 0; for (let i = 0; i < 5; i++) { const r = await measure1(code, len); e += r.mx / 5; p = Math.max(p, r.pk); }
  return { lufs: e ? -0.691 + 10 * Math.log10(e) : -99, peak: p ? 20 * Math.log10(p) : -99 };
};`;

export async function run(names = Object.keys(GAMES)) {
  const br = await chromium.launch(), pg = await br.newPage();
  await pg.setContent('<html></html>'); await pg.addScriptTag({ content: PAGE });
  const out = [];
  for (const g of names) {
    const G = GAMES[g], code = G.stub + '\n' + G.code() + '\n';
    for (const [name, parts, kind] of G.ev) {
      const call = typeof parts === 'string' ? parts : '{' + parts.map(p => part(G.file, p)).join('\n') + '}';
      const r = await pg.evaluate(([c, len]) => window.measure(c, len), [code + call + ';', kind === 'bed' ? 1.2 : 3]);
      const tgt = kind === 'tick' ? TICK : kind === 'bed' ? BED : TARGET;
      out.push({ g, name, kind: kind || '', ...r, tgt, off: r.lufs - tgt });
    }
  }
  await br.close(); return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await run(process.argv.slice(2).length ? process.argv.slice(2) : undefined);
  let bad = 0;
  for (const r of rows) { const ok = Math.abs(r.off) <= TOL; if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${r.g.padEnd(7)} ${r.name.padEnd(12)} ${r.lufs.toFixed(1).padStart(6)} LUFS  피크 ${r.peak.toFixed(1).padStart(6)}  기준 ${r.tgt}  ${r.off >= 0 ? '+' : ''}${r.off.toFixed(1)}${r.kind ? '  (' + r.kind + ')' : ''}`); }
  console.log(bad ? `✗ ${bad}개가 기준 ±${TOL} 밖` : '✅ 모두 기준 안'); process.exitCode = bad ? 1 : 0;
}
