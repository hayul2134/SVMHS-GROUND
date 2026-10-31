// 효과음 크기 자동 맞춤 — level.mjs로 재고, 기준에서 벗어난 소리의 볼륨 숫자를 게임 파일에서 직접 고친 뒤 다시 잼(최대 N번)
// 실행: node tools/sfx/tune.mjs [횟수=4] [게임…]   · 'manual'로 적힌 소리는 손으로 맞출 것
import { readFileSync, writeFileSync } from 'node:fs';
import { GAMES, run, TOL, P, part, grab } from './level.mjs';

const JS = new URL('../../public/js/', import.meta.url);
const C = (re, from) => P(re, { call: true, from });
// 볼륨을 받는 함수: [이름, 인자 기본값(볼륨 자리까지, null = 필수), 볼륨 자리]
const T4 = [null, null, null, "'square'", '.05'];
const H = {
  runner: [['beep', T4, 4], ['noise', [null, null, '1', '.05'], 3], ['seq', [null, '110', "'square'", '.045'], 3]],
  stair: [['beep', [null, '.06', "'square'", '.05'], 3]],
  gear: [['beep', [null, null, null, "'square'", '.04'], 4], ['crunch', ['.12'], 0], ['thump', ['.09'], 0], ['hiss', [null], 0], ['clap', ['.14'], 0]],
  n25: [['tone', [null, null, null, "'sine'", '.06'], 4]],
  cut: [['tone', [null, null, null, "'sine'", '.16'], 4]],
  film: [['tone', [null, null, "'square'", '.06'], 3], ['bell', [null, null, null, null], 3]],
  blast: [['tone', [null, null, "'square'", '.06'], 3], ['noise', [null, null], 1], ['blip', [null, null, '.09'], 2]],
  chase: [['tone', [null, null, "'square'", '0.06'], 3], ['noise', [null, '0.08'], 1], ['boom', [null, null, null], 2], ['glass', [null, null], 1], ['metal', [null], 0]],
  dance: [['tone', [null, null, "'square'", '0.06'], 3]],
};
H.mine = H.snake = H.t2048 = H.react = [['sfx.tone', [null, '.08', "'square'", '.05'], 3], ['sfx.noise', ['.2', '.08'], 1]];
// 고칠 자리(기본: 잴 때 쓴 실제 코드 · SFX./S. 소리는 그 항목 전체)
const m25 = /cz_snd_2048/;
const ADJ = {
  'runner/100m': [C(/beep\(780, 1180/, /hundred\(m\) \{/)], 'runner/1000m': [C(/seq\(\[\[784\]/, /hundred\(m\) \{/)],
  'stair/옥상': [P(/const tune = /)],
  'gear/1줄': 'manual', 'gear/2줄': 'manual', 'gear/3줄': 'manual', 'gear/4줄': 'manual',
  ...Object.fromEntries('OZITLJS'.split('').map(k => ['gear/놓기 ' + k, [{ prop: k }]])),
  'n25/맞음': [C(/tone\(hz\(i\), 0, \.16/)], 'n25/틀림': [C(/tone\(200, 0, \.22/)], 'n25/5의 배수': [C(/tone\(hz\(i\), 0, \.12/), C(/tone\(hz\(i\) \* 1\.5/)], 'n25/끝': [C(/\[0, 4, 7, 12\]\.forEach/)],
  'cut/퍼펙트': [C(/tone\(784, \.05/), C(/tone\(1046, \.12/)], 'cut/그레이트': [C(/tone\(659, \.05/)], 'cut/굿': [C(/tone\(523, \.05/)], 'cut/미스': [C(/tone\(180, \.03/)],
  'film/지움(2개)': [P(/function snip\(/)], 'film/지움(4개)': 'manual', 'film/지움(8개)': 'manual', 'film/10 됨': 'manual', 'film/째깍(3초)': 'manual', 'film/끝': 'manual',
  ...Object.fromEntries(['1줄', '2줄', '3줄 연속5', '4줄', '전체 송출'].map(k => ['blast/' + k, 'manual'])),   // 줄 수별 lk 표로 맞춤
  'chase/아슬 칼치기': [C(/tone\(b \* 2, 0\.22/), C(/noise\(0\.12, [^,]+, 6000/)], 'chase/벽 부숨': [C(/noise\(0\.3, [^,]+, 1400/), C(/\[0, 0\.05, 0\.11\]\.forEach/)],
  'chase/카운트': 'manual', 'chase/출발': 'manual', 'chase/엔진': 'manual', 'chase/엔진 부스터': 'manual', 'dance/카운트': 'manual', 'dance/시작': 'manual',
  't2048/합침 128↑': [C(/sfx\.tone\(660 \+ k/, m25)],
};
const OBJ = { gear: /const PLACE = \{/, runner: /const SFX = \{/, chase: /function makeSfx\(\)/, dance: /function makeSfx\(\)/ };

const fmt = v => { const r = String(+(+v.toPrecision(3)).toFixed(6)); return r.replace(/^0\./, '.'); };
function args(t, open) {   // t[open] = '(' → [인자들, 닫는 자리]
  const out = []; let d = 0, q = null, st = open + 1, i = open;
  for (; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) { if (!--d) { out.push(t.slice(st, i)); break; } }
    else if (c === ',' && d === 1) { out.push(t.slice(st, i)); st = i + 1; }
  }
  return [out.map(s => s.trim()).filter((s, k, a) => s || k < a.length - 1), i];
}
const scaleArg = (a, k) => {
  if (/^\.?\d[\d.]*$/.test(a)) return fmt(+a * k);
  const m = /^(.+?)\s*\?\s*(\.?\d[\d.]*)\s*:\s*(\.?\d[\d.]*)$/.exec(a);
  if (m) return `${m[1]} ? ${fmt(+m[2] * k)} : ${fmt(+m[3] * k)}`;
  const m2 = /^(.*\S)\s*\*\s*(\.?\d[\d.]*)$/.exec(a); if (m2 && !/[?:]/.test(m2[1])) return `${m2[1]} * ${fmt(+m2[2] * k)}`;
  return `(${a}) * ${fmt(k)}`;
};
function scaleRegion(t, helpers, k) {
  const names = helpers.map(h => h[0].replace('.', '\\.')).join('|'), re = new RegExp(`(?<![\\w.$])(${names})\\(`, 'g');
  const hits = []; let m; while ((m = re.exec(t))) hits.push([m.index, m[1], m.index + m[0].length - 1]);
  for (const [at, name, open] of hits.reverse()) {
    const [, def, vi] = helpers.find(h => h[0] === name), [a, close] = args(t, open);
    while (a.length <= vi) { const d = def[a.length]; if (d == null) throw new Error(`${name} 인자 부족`); a.push(d); }
    a[vi] = scaleArg(a[vi], k);
    t = t.slice(0, open + 1) + a.join(', ') + t.slice(close);
  }
  return t.replace(/(\bgain\.value = )(\.?\d[\d.]*)/g, (_, p, v) => p + fmt(+v * k));
}
function propText(file, g, name) {   // SFX.이름 / S.이름 항목 원문
  const t = readFileSync(new URL(file, JS), 'utf8'), o = OBJ[g].exec(t), body = t.slice(o.index);
  const m = new RegExp(`(?<![\\w.$])${name}(?:\\s*\\(|: )`).exec(body); if (!m) throw new Error('항목 못 찾음 ' + name);
  let d = 0, q = null, i = m.index;
  for (; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '/' && body[i + 1] === '/') { i = body.indexOf('\n', i) - 1; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) { if (--d < 0) break; }
    else if (c === ',' && !d) break;
  }
  return body.slice(m.index, i);
}
function apply(g, ev, k) {
  const G = GAMES[g], [name, parts] = ev, key = `${g}/${name}`; let adj = ADJ[key];
  if (adj === 'manual') return false;
  if (!adj) {
    if (typeof parts === 'string') { const m = /^(?:SFX|S)\.(\w+)\(/.exec(parts); if (!m) return false; adj = [{ prop: m[1] }]; }
    else adj = parts.filter(p => typeof p !== 'string');
  }
  const url = new URL(G.file, JS); let t = readFileSync(url, 'utf8');
  for (const p of adj) {
    const old = p.prop ? propText(G.file, g, p.prop) : part(G.file, p).replace(/;$/, p.call ? '' : ';');
    const at = p.from ? t.indexOf(old, p.from.exec(t).index) : t.indexOf(old);
    if (at < 0) throw new Error(`${key}: 원문 못 찾음`);
    t = t.slice(0, at) + scaleRegion(old, H[g], k) + t.slice(at + old.length);
    writeFileSync(url, t);
  }
  return true;
}

const [nArg, ...gs] = process.argv.slice(2), N = +nArg || 4;
for (let it = 0; it < N; it++) {
  const rows = await run(gs.length ? gs : undefined), bad = rows.filter(r => Math.abs(r.off) > TOL);
  console.log(`— ${it + 1}회차: 기준 밖 ${bad.length}개`);
  if (!bad.length) break;
  for (const r of bad) {
    const ev = GAMES[r.g].ev.find(e => e[0] === r.name), k = 10 ** (-r.off / 20);
    const done = apply(r.g, ev, k);
    console.log(`  ${done ? '고침' : '손으로'} ${r.g}/${r.name} ${r.off >= 0 ? '+' : ''}${r.off.toFixed(1)}dB → ×${fmt(k)}`);
  }
}
