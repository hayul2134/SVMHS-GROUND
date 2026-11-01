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
// 판 기록 → { v: 저장값(놓친 합), acc: 판별 정확도 } 또는 { err }
export function scoreOf(r) {
  if (!Array.isArray(r) || r.length !== ROUNDS * 2) return { err: `${ROUNDS}판이 모두 기록되지 않았어요` };
  if (!r.every(okRgb)) return { err: '색 값이 이상해요' };
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
