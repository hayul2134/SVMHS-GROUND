// SVMHS GROUND — 색감의 신 규칙(2026-11-02 하율 "5초 동안 색 하나를 보여 준 다음 팔레트에서 골라 얼마나 가까운지 퍼센트로")
// 화면(color.js)과 서버(functions/api/s)가 같이 씀 — 점수 계산을 바꾸면 둘 다 바뀜.
// 판 5번. 판마다 정확도 0~100.0%(0.1% 단위 = 0~1000). 서버엔 '작을수록 좋음'으로 놓친 만큼(1000 - 정확도)의 합을 저장(0~5000).
// 판 기록(rounds) = [목표1, 고른 색1, 목표2, 고른 색2, …] — 색은 0xRRGGBB 정수. 서버가 이걸로 점수를 다시 계산함.
export const ROUNDS = 5, SHOW_MS = 5000, COLOR_MAX = ROUNDS * 1000;
// 색 차이 ΔE00(CIEDE2000)이 이만큼이면 0% — 사람 눈 기준 차이. ΔE 2 ≈ 겨우 알아봄(96%), 10 ≈ 확실히 다름(80%)
export const DE_ZERO = 50;

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function lab(rgb) {
  const r = lin(rgb >> 16 & 255), g = lin(rgb >> 8 & 255), b = lin(rgb & 255);
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const x = f((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047), y = f(r * 0.2126729 + g * 0.7151522 + b * 0.072175), z = f((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
export function de00(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1 = (deg(Math.atan2(b1, a1p)) + 360) % 360, h2 = (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dh / 2));
  const Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2; if (C1p * C2p) { hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2; }
  const T = 1 - 0.17 * Math.cos(rad(hm - 30)) + 0.24 * Math.cos(rad(2 * hm)) + 0.32 * Math.cos(rad(3 * hm + 6)) - 0.2 * Math.cos(rad(4 * hm - 63));
  const SL = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T;
  const RT = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(rad(60 * Math.exp(-(((hm - 275) / 25) ** 2))));
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
// 정확도(0~1000, 0.1% 단위)
export const accOf = (t, p) => Math.max(0, Math.min(1000, Math.round(1000 * (1 - de00(t, p) / DE_ZERO))));
export const okRgb = x => Number.isInteger(x) && x >= 0 && x <= 0xffffff;
// 판 기록 → { v: 저장값(놓친 합), acc: 판별 정확도 } 또는 { err, bad }
// seed(2026-11-02 디벨롭): 문제 색은 시작 티켓 씨앗으로 정해짐 → 서버가 같은 씨앗으로 다시 뽑아 정답 색이 맞는지 확인(정답 색을 화면이 마음대로 보내던 구멍 막음)
export function scoreOf(r, seed = null) {
  if (!Array.isArray(r) || r.length !== ROUNDS * 2) return { err: `${ROUNDS}판이 모두 기록되지 않았어요` };
  if (!r.every(okRgb)) return { err: '색 값이 이상해요' };
  if (seed != null) {
    const t = pickTargets(rng(seed)), bad = t.map((c, i) => c === r[i * 2] ? -1 : i).filter(i => i >= 0);
    if (bad.length) return { err: '문제 색이 이 판에서 나온 색과 달라요', bad };
  }
  const acc = []; for (let i = 0; i < ROUNDS; i++) acc.push(accOf(r[i * 2], r[i * 2 + 1]));
  return { v: acc.reduce((s, a) => s + 1000 - a, 0), acc };
}
// 저장값 → 평균 정확도 글자 '87.4%'
export const pctOf = v => ((COLOR_MAX - v) / ROUNDS / 10).toFixed(1) + '%';

// HSV(0~360, 0~1, 0~1) ↔ 0xRRGGBB
export function hsv2rgb(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return f(5) << 16 | f(3) << 8 | f(1);
}
export function rgb2hsv(c) {
  const r = (c >> 16 & 255) / 255, g = (c >> 8 & 255) / 255, b = (c & 255) / 255, mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx];
}
// 씨앗 → 0~1 난수(mulberry32) · 티켓(16자리 16진수) → 씨앗
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const seedOf = ticket => /^[0-9a-f]{16}/.test(ticket || '') ? (parseInt(ticket.slice(0, 8), 16) ^ parseInt(ticket.slice(8, 16), 16)) >>> 0 : null;

// 판 하나 되짚기(화면 전용): 팔레트(HSV) 기준으로 무엇을 얼마나 옮기면 되는지. 회색에 가까우면 색상은 안 따짐
const HUES = [[15, '빨강'], [40, '주황'], [65, '노랑'], [90, '연두'], [150, '초록'], [185, '청록'], [210, '하늘'], [245, '파랑'], [275, '남보라'], [300, '보라'], [330, '자주'], [345, '분홍'], [360, '빨강']];
export const hueName = h => HUES.find(([m]) => ((h % 360) + 360) % 360 < m)[1];
export function diffOf(t, p) {
  const [th, ts, tv] = rgb2hsv(t), [ph, ps, pv] = rgb2hsv(p);
  const dh = ts > 0.12 && ps > 0.08 ? ((th - ph + 540) % 360) - 180 : 0;   // 정답 - 내 색(°), +면 색상 막대 아래쪽(빨→노→초→파→보)
  return { th, ts, tv, ph, ps, pv, dh, ds: ts - ps, dv: tv - pv };
}
export function hintOf(t, p) {
  const d = diffOf(t, p), out = [];
  // 많이 다르면(45°↑) 정답 계열 이름, 조금이면 어느 쪽으로 몇 °
  if (Math.abs(d.dh) >= 45) out.push(['색상', `정답은 ${hueName(d.th)} 계열`]);
  else if (Math.abs(d.dh) >= 6) out.push(['색상', `${hueName(d.ph + Math.sign(d.dh) * 30)} 쪽으로 ${Math.round(Math.abs(d.dh))}°`]);
  if (Math.abs(d.ds) >= 0.06) out.push(['채도', d.ds > 0 ? `더 진하게 ${Math.round(d.ds * 100)}%` : `더 연하게 ${Math.round(-d.ds * 100)}%`]);
  if (Math.abs(d.dv) >= 0.06) out.push(['밝기', d.dv > 0 ? `더 밝게 ${Math.round(d.dv * 100)}%` : `더 어둡게 ${Math.round(-d.dv * 100)}%`]);
  return { d, out };
}
// 5판 경향: 매번 같은 쪽으로 틀렸는지(3판 이상 같은 방향 + 평균 6% 이상)
export function biasOf(r) {
  const ds = [], dv = [], dh = [];
  for (let i = 0; i < r.length; i += 2) { const d = diffOf(r[i], r[i + 1]); ds.push(d.ds); dv.push(d.dv); if (d.dh) dh.push(d.dh); }
  const lean = (a, th) => { const m = a.reduce((s, x) => s + x, 0) / (a.length || 1), same = a.filter(x => Math.sign(x) === Math.sign(m) && Math.abs(x) >= th / 2).length; return a.length >= 3 && Math.abs(m) >= th && same >= 3 ? m : 0; };
  const out = [], v = lean(dv, 0.06), s = lean(ds, 0.06);
  if (v) out.push(v > 0 ? `밝기를 평균 ${Math.round(v * 100)}% <b>어둡게</b> 기억하는 편이에요` : `밝기를 평균 ${Math.round(-v * 100)}% <b>밝게</b> 기억하는 편이에요`);
  if (s) out.push(s > 0 ? `채도를 평균 ${Math.round(s * 100)}% <b>연하게</b> 기억하는 편이에요` : `채도를 평균 ${Math.round(-s * 100)}% <b>진하게</b> 기억하는 편이에요`);
  return out;
}
export const hex = c => '#' + c.toString(16).padStart(6, '0');
// 문제 색: 너무 칙칙하거나 어두운 색은 빼고(채도 0.25~1, 밝기 0.35~1), 앞 판과 색상이 40° 넘게 다르게
export function pickTargets(rand = Math.random) {
  const out = []; let last = -999;
  while (out.length < ROUNDS) {
    const h = rand() * 360; if (Math.abs(((h - last + 540) % 360) - 180) < 40) continue;
    last = h; out.push(hsv2rgb(h, 0.25 + rand() * 0.75, 0.35 + rand() * 0.65));
  }
  return out;
}
