// SVMHS GROUND — 출석 보상·출석 화면 그림 (전부 직접 그린 SVG, 이모지 안 씀)
// 규칙: tools/attend/ART_GUIDE.md (로고와 같은 '젤리 스티커' — 두께·세로 그라디언트·오른쪽 아래 그림자·왼쪽 위 광택·남색 선,
//       캐릭터는 CHARACTER_GUIDE: 찹쌀떡 얼굴·몸 색을 진하게 한 외곽선·세로 타원 눈·ω 입·볼터치)
// 그림은 문서에 한 번만 넣는 스프라이트(<symbol>)로 두고 <use>로 불러 씀 → 같은 그림이 여러 번 나와도 가벼움.
// 보상 값은 'r:이름'으로 저장되고, 사이트 어디서든 프로필 사진·스티커를 그릴 땐 emo(값)을 씀(옛 이모지 값은 글자 그대로).
import { STK_MSG, RW_OLD } from './att-rewards.js';
const INK = '#173048';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n1 = v => +v.toFixed(1);
const star = (cx, cy, R, r, n = 5, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (rot + i * 180 / n) * Math.PI / 180, d = i % 2 ? r : R;
  return `${n1(cx + Math.cos(a) * d)},${n1(cy + Math.sin(a) * d)}`;
}).join(' ');
const starD = (...a) => `M${star(...a).split(' ').join('L')}Z`;

/* ----- 색 (위 밝음 → 아래 진함) ----- */
const GR = {
  gY: ['#fff3b0', '#ffc83d'], gB: ['#c6ebff', '#4aaeef'], gR: ['#ffc9c9', '#f0646d'], gM: ['#cff8e8', '#47c9a0'], gV: ['#e2d8ff', '#8b76ff'],
  gP: ['#ffd3b3', '#ef8a50'], gG: ['#dcf8ad', '#62c552'], gK: ['#ecc3a0', '#b77d55'], gW: ['#ffffff', '#dfe9f2'], gL: ['#ffe27a', '#ff6a3a'],
  gS: ['#ffffff', '#c3ced9'], gN: ['#ffd9e4', '#ff8fb0'],
  cLi: ['#ffeeb6', '#ffc85e'], cMa: ['#ffc183', '#e98a3a'], cDr: ['#cdf6b8', '#6fd27a'], cSt: ['#fff6b8', '#ffc93c'], cOw: ['#e6c4a0', '#b88459'],
  cOd: ['#fff4e4', '#f2d6b6'], cWh: ['#c4e6ff', '#5aa2f2'], cWb: ['#ffffff', '#d7ecff'],
  sSu: ['#ffb2b8', '#ffd9a3'], sSun: ['#fffbe8', '#ffd27a'], sSea: ['#8fa6e6', '#4a5fb4'], sNt: ['#1d2457', '#5a4fa6'], sMn: ['#fffbe6', '#ffd97a'],
  sSk: ['#cfe8ff', '#fff0f6'], sAu: ['#0f1c3f', '#24456e'], sAr: ['#8ff0c8', '#7ab8ff'], sOc: ['#3b7fd0', '#0f2a5e'], sJf: ['#ffe3f4', '#ff9fd2'], sGx: ['#2a1f66', '#120f33'],
};
const DEFS = Object.entries(GR).map(([k, [a, b]]) => `<linearGradient id="${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')
  // 홀로그램(나비 날개): 분홍→하늘→보라→노랑 대각선 (gH2는 반대 방향)
  + '<linearGradient id="gH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3e6"/><stop offset=".35" stop-color="#94d8ff"/><stop offset=".7" stop-color="#b39cff"/><stop offset="1" stop-color="#ffe98a"/></linearGradient>'
  + '<linearGradient id="gH2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3e6"/><stop offset=".35" stop-color="#94d8ff"/><stop offset=".7" stop-color="#b39cff"/><stop offset="1" stop-color="#ffe98a"/></linearGradient>';

/* ----- 젤리 조각: 두께(오른쪽 아래로 민 진한 판) → 면(그라디언트) → 안쪽 그림자·무늬 → 외곽선(맨 위) ----- */
const jelly = (d, g, dark, inner = '', o = {}) => {
  const line = o.line || INK, sw = o.sw || 2.2, dx = o.dx ?? 1.6, dy = o.dy ?? 2.8;
  return (o.flat ? '' : `<path d="${d}" transform="translate(${dx} ${dy})" fill="${dark}" stroke="${line}" stroke-width="${sw}" stroke-linejoin="round"/>`)
    + `<path d="${d}" fill="url(#${g})"/>${inner}<path d="${d}" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
};
const gloss = (d, w = 2.6, op = .85) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
const shade = (d, c, op = 1) => `<path d="${d}" fill="${c}" opacity="${op}"/>`;
const twinkle = (x, y, s = 3, c = '#fff') => `<path d="M${x} ${n1(y - s)}Q${n1(x + s * .18)} ${n1(y - s * .18)} ${n1(x + s)} ${y}Q${n1(x + s * .18)} ${n1(y + s * .18)} ${x} ${n1(y + s)}Q${n1(x - s * .18)} ${n1(y + s * .18)} ${n1(x - s)} ${y}Q${n1(x - s * .18)} ${n1(y - s * .18)} ${x} ${n1(y - s)}Z" fill="${c}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" class="tw"/>`;   // 반짝이(.tw)는 가운데 맞춤 계산에서 뺌
// 캐릭터 얼굴 부품 (CHARACTER_GUIDE)
const EYE = '#3b2a2e';
const eye = (x, y, rx = 2.5, ry = 3.1) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${EYE}"/><circle cx="${n1(x + rx * .38)}" cy="${n1(y - ry * .42)}" r="${n1(rx * .36)}" fill="#fff" opacity=".9"/>`;
const eyes = (x1, x2, y, rx, ry) => eye(x1, y, rx, ry) + eye(x2, y, rx, ry);
const mouthW = (x, y, w = 2.2, c = EYE) => `<path d="M${n1(x - w)} ${y}q${n1(w / 2)} ${n1(w * .7)} ${w} 0q${n1(w / 2)} ${n1(w * .7)} ${w} 0" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const cheek = (x, y, rx = 3, ry = 1.8) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#ff8fa8" opacity=".5"/>`;
const blush = (x1, x2, y, rx, ry) => cheek(x1, y, rx, ry) + cheek(x2, y, rx, ry);
// 찹쌀떡 얼굴 (아래가 살짝 퍼진 둥근 모양)
const mochi = (cx, cy, w, h) => {
  const L = cx - w / 2, R = cx + w / 2, ym = cy + h * .1, yt = cy - h * .64, yb = cy + h * .52;
  return `M${n1(L)} ${n1(ym)}C${n1(L)} ${n1(yt)} ${n1(R)} ${n1(yt)} ${n1(R)} ${n1(ym)}C${n1(R + w * .02)} ${n1(yb)} ${n1(L - w * .02)} ${n1(yb)} ${n1(L)} ${n1(ym)}Z`;
};
// 가장자리가 동글동글한 갈기 (호 n개)
const scallop = (cx, cy, R, n, bump) => {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    d += i ? `A${bump} ${bump} 0 0 1 ${n1(x)} ${n1(y)}` : `M${n1(x)} ${n1(y)}`;
  }
  return d + 'Z';
};

// 풍경 프로필 사진: 원 안에 잘라 그림(clip) + 얇은 안쪽 테두리 빛
const scene = (k, body) => `<clipPath id="cl-${k}"><circle cx="24" cy="24" r="23.4"/></clipPath><g clip-path="url(#cl-${k})">${body}</g><circle cx="24" cy="24" r="22.9" fill="none" stroke="#fff" stroke-width="1.1" opacity=".35"/>`;
const twinkleS = (x, y, s) => `<path d="M${x} ${n1(y - s * 2)}Q${n1(x + s * .3)} ${n1(y - s * .3)} ${n1(x + s * 2)} ${y}Q${n1(x + s * .3)} ${n1(y + s * .3)} ${x} ${n1(y + s * 2)}Q${n1(x - s * .3)} ${n1(y + s * .3)} ${n1(x - s * 2)} ${y}Q${n1(x - s * .3)} ${n1(y - s * .3)} ${x} ${n1(y - s * 2)}Z" fill="#fff" opacity=".95"/>`;
export const SCENES = new Set(['sunset', 'moonnight', 'sakuratree', 'auroramt', 'jellyfish', 'starcat']);

/* ===== 보상 그림 (48×48) ===== */
const ART = {
  /* ----- 스티커 (2026-10-24 전면 교체: 10대가 실제로 모으는 '폰꾸·다꾸' 모티프 — Y2K 젤리 하트, 체리, 홀로그램 나비, 우주·별똥별, 딸기우유·붕어빵, 필름 카메라, 헤드폰) ----- */
  heart:
    jelly('M24 41.5C15.6 35.4 5.8 28.6 5.8 18.6 5.8 12.4 10.4 8 15.8 8 19.4 8 22.4 10 24 13.2 25.6 10 28.6 8 32.2 8 37.6 8 42.2 12.4 42.2 18.6 42.2 28.6 32.4 35.4 24 41.5Z', 'gN', '#d9577e',
      shade('M37.4 12.2C40.6 15 40.8 21.4 38 26.4 34.6 32.4 28.6 36.6 24 39.8 30.4 34.4 37.6 26.6 37.4 12.2Z', '#f26f98', .75)
      + `<path d="M24 34.4C19.4 31 14.6 27 14.6 21.6 14.6 18.6 16.8 16.4 19.4 16.4 21.4 16.4 23 17.6 24 19.4 25 17.6 26.6 16.4 28.6 16.4 31.2 16.4 33.4 18.6 33.4 21.6 33.4 27 28.6 31 24 34.4Z" fill="#ffe3ec" opacity=".55"/>`)
    + gloss('M10.4 19Q10.4 13.2 15.6 12', 3.2) + `<circle cx="11.4" cy="23.2" r="1.5" fill="#fff" opacity=".9"/>`
    + twinkle(41.5, 7.5, 3.6, '#fff3b0') + twinkle(6, 38, 2.6, '#c6ebff'),
  camera:
    jelly('M11 10.4H19.6Q21 10.4 21 11.8V14.4H9.6V11.8Q9.6 10.4 11 10.4Z', 'gW', '#aebccb', '', { dy: 1.4, dx: .8 })
    + jelly('M33 11.2H38Q39.2 11.2 39.2 12.4V14.4H31.8V12.4Q31.8 11.2 33 11.2Z', 'gR', '#c4424f', '', { dy: 1.4, dx: .8 })
    + jelly('M10 14H38Q42.4 14 42.4 18.4V36Q42.4 40.4 38 40.4H10Q5.6 40.4 5.6 36V18.4Q5.6 14 10 14Z', 'gM', '#2c9c7a',
      shade('M42.4 30V36Q42.4 40.4 38 40.4H10Q5.6 40.4 5.6 36V34.8Q22 37.4 42.4 30Z', '#3db892', .6)
      + `<path d="M5.6 31.4H42.4V34.6H5.6Z" fill="#ffb3c6"/><path d="M5.6 34.6H42.4V36.4H5.6Z" fill="#fff3b0"/>`
      + `<rect x="31.6" y="17.6" width="7" height="4.4" rx="1.4" fill="#fffbe0" stroke="${INK}" stroke-width="1.4"/>`)
    + jelly('M24.6 15.8A10.6 10.6 0 1 1 24.59 15.8Z', 'gS', '#7d8b9a', '', { dx: 1, dy: 1.8 })
    + `<circle cx="24.6" cy="26.4" r="6.8" fill="#2b3a5c" stroke="${INK}" stroke-width="1.6"/><circle cx="24.6" cy="26.4" r="3.6" fill="#4a5f8f"/>`
    + `<path d="M20.4 24.2A4.8 4.8 0 0 1 23.4 21.2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="27.8" cy="29.4" r="1.1" fill="#fff" opacity=".8"/>`
    + gloss('M9.4 21.6V19Q9.6 17.4 11.6 17.4H14.2', 2.4) + twinkle(43.6, 9.6, 3, '#fff3b0'),
  cherry:
    `<path d="M16 31Q18.6 17 28.2 8.6M32.4 29.6Q31.4 18.4 28.2 8.6" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M16 31Q18.6 17 28.2 8.6M32.4 29.6Q31.4 18.4 28.2 8.6" fill="none" stroke="#62c552" stroke-width="2" stroke-linecap="round"/>`
    + jelly('M28 8.8C29.6 4 35.6 2.6 41.4 4.4 39.4 9.8 33.4 12.2 28 8.8Z', 'gG', '#3f9a3a', `<path d="M29.4 8.4Q34.6 6.8 39.4 5.2" fill="none" stroke="#3f9a3a" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>`, { dx: .8, dy: 1.4 })
    + jelly('M16 24.6A9.4 9.4 0 1 1 15.99 24.6Z', 'gR', '#c4424f', shade('M23.6 30A8 8 0 0 1 12 41.4 9.4 9.4 0 0 0 23.6 30Z', '#e0545e', .8))
    + jelly('M32.4 22.8A9.4 9.4 0 1 1 32.39 22.8Z', 'gR', '#c4424f', shade('M40 28.2A8 8 0 0 1 28.4 39.6 9.4 9.4 0 0 0 40 28.2Z', '#e0545e', .8))
    + gloss('M10.2 32Q10.6 28 13.8 27', 2.6) + gloss('M26.6 30.2Q27 26.2 30.2 25.2', 2.6)
    + `<circle cx="11.2" cy="35" r="1.2" fill="#fff" opacity=".9"/><circle cx="27.6" cy="33.2" r="1.2" fill="#fff" opacity=".9"/>` + twinkle(8, 10, 3, '#fff3b0'),
  planet:
    `<g transform="rotate(-14 24 27)"><path d="M3.4 27A20.6 6.8 0 0 1 44.6 27" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M3.4 27A20.6 6.8 0 0 1 44.6 27" fill="none" stroke="#ffd98a" stroke-width="3" stroke-linecap="round"/></g>`
    + jelly('M24 11A13.2 13.2 0 1 1 23.99 11Z', 'gV', '#5d47d6',
      shade('M33.8 15.4A13.2 13.2 0 0 1 20 36.8 14 14 0 0 0 33.8 15.4Z', '#7a64f2', .75)
      + `<path d="M11.4 20.6Q24 17.4 36.6 21.2M11 27.6Q24 25.4 37 28.6" fill="none" stroke="#d8ccff" stroke-width="2.2" stroke-linecap="round" opacity=".75"/><path d="M13 32.6Q24 31.4 34.6 33.8" fill="none" stroke="#ffc6ec" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`)
    + `<g transform="rotate(-14 24 27)"><path d="M3.4 27A20.6 6.8 0 0 0 44.6 27" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M3.4 27A20.6 6.8 0 0 0 44.6 27" fill="none" stroke="#ffd98a" stroke-width="3" stroke-linecap="round"/><path d="M9 31.4Q14 33.2 20 33.8" fill="none" stroke="#fff6d6" stroke-width="1.4" stroke-linecap="round"/></g>`
    + gloss('M15.4 16.6Q18 13.6 21.6 13', 2.4) + twinkle(41, 8, 3.2, '#fff3b0') + twinkle(7, 41, 2.4, '#c6ebff'),
  shootstar:
    `<path d="M5 41.6 20.6 26M9.8 44 23.6 30.2M3 35.6 17.4 21.2" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`
    + `<path d="M5 41.6 20.6 26" stroke="#ffb3d1" stroke-width="3" stroke-linecap="round"/><path d="M9.8 44 23.6 30.2" stroke="#a9d8ff" stroke-width="3" stroke-linecap="round"/><path d="M3 35.6 17.4 21.2" stroke="#ffe08a" stroke-width="3" stroke-linecap="round"/>`
    + `<g transform="rotate(12 30 18)">` + jelly(starD(30, 18.5, 15, 7.4), 'gY', '#d98a10', shade('M37.4 19.4 44.2 14.2 38.6 22.6 40.6 31.6 30 26.2Z', '#f0a21c', .7)
      + `<polygon points="${star(30, 19.4, 6.6, 3.2)}" fill="#fff6c4" opacity=".75"/>`) + gloss('M21.4 15.2 25.2 15', 2.4) + `</g>`
    + twinkle(42.6, 36, 2.8, '#c6ebff') + twinkle(12, 8.6, 2.6, '#ffd3e0'),
  butterfly:
    jelly('M23 22.6C19.6 10.4 9.8 5.4 5.6 9.4 2 13 6 22.2 23 24.6Z', 'gH', '#8b76ff', `<circle cx="11.2" cy="13.4" r="2" fill="#fff" opacity=".85"/><circle cx="15.6" cy="18.6" r="1.2" fill="#fff" opacity=".75"/>`, { dx: 1, dy: 1.8 })
    + jelly('M25 22.6C28.4 10.4 38.2 5.4 42.4 9.4 46 13 42 22.2 25 24.6Z', 'gH2', '#8b76ff', `<circle cx="36.8" cy="13.4" r="2" fill="#fff" opacity=".85"/><circle cx="32.4" cy="18.6" r="1.2" fill="#fff" opacity=".75"/>`, { dx: 1, dy: 1.8 })
    + jelly('M23 26.4C14.6 26.4 8.8 31.4 10.6 36.8 12.6 42.2 20.2 38.6 23 28.4Z', 'gH2', '#8b76ff', `<circle cx="15" cy="34.4" r="1.4" fill="#fff" opacity=".8"/>`, { dx: 1, dy: 1.8 })
    + jelly('M25 26.4C33.4 26.4 39.2 31.4 37.4 36.8 35.4 42.2 27.8 38.6 25 28.4Z', 'gH', '#8b76ff', `<circle cx="33" cy="34.4" r="1.4" fill="#fff" opacity=".8"/>`, { dx: 1, dy: 1.8 })
    + `<path d="M22.6 14.4Q19.6 8 15.6 7.2M25.4 14.4Q28.4 8 32.4 7.2" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><circle cx="15.4" cy="7.2" r="1.6" fill="#ffc83d" stroke="${INK}" stroke-width="1.1"/><circle cx="32.6" cy="7.2" r="1.6" fill="#ffc83d" stroke="${INK}" stroke-width="1.1"/>`
    + jelly('M24 13.6Q26.4 13.6 26.4 17V35.6Q26.4 38.8 24 38.8 21.6 38.8 21.6 35.6V17Q21.6 13.6 24 13.6Z', 'gV', '#5d47d6', '', { dx: .6, dy: 1 })
    + gloss('M7.6 12.6Q8.8 10 11.4 9.8', 2.2) + twinkle(43.4, 26, 2.8, '#fff3b0') + twinkle(4.6, 27.6, 2.2, '#ffd3e0'),
  moon:
    jelly('M30.6 5.6A18.6 18.6 0 1 0 42.4 36.4 15.4 15.4 0 0 1 30.6 5.6Z', 'gY', '#d98a10',
      shade('M42.4 36.4A18.6 18.6 0 0 1 9.4 31.6 18 18 0 0 0 42.4 36.4Z', '#f0a21c', .8)
      + `<circle cx="14.6" cy="24" r="2.2" fill="#ffd96a" opacity=".8"/><circle cx="20.4" cy="33.4" r="1.6" fill="#ffd96a" opacity=".8"/><circle cx="17.6" cy="15.4" r="1.2" fill="#ffd96a" opacity=".8"/>`)
    + gloss('M10.4 20.6Q12.4 12.4 20 8.6', 2.8) + jelly(starD(37.6, 15.6, 5.6, 2.4), 'gY', '#d98a10', '', { dx: .6, dy: 1, sw: 1.8 })
    + twinkle(43, 6, 2.6, '#fff') + twinkle(31.4, 26.4, 2, '#fff3b0'),
  disco:
    `<path d="M24 1.6V7.4" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
    + jelly('M24 7.4A17.6 17.6 0 1 1 23.99 7.4Z', 'gS', '#7d8b9a',
      `<g fill="none" stroke="#8c99a8" stroke-width=".9" opacity=".9"><path d="M7 19.4Q24 15.4 41 19.4M6.4 25Q24 21.6 41.6 25M7 30.6Q24 27.8 41 30.6M9.4 36Q24 34 38.6 36M10.2 13.8Q24 10 37.8 13.8"/><path d="M24 7.4V42.6M16.4 9.2Q12.6 25 16.4 40.8M31.6 9.2Q35.4 25 31.6 40.8M10.4 13.6Q6.2 25 10.4 36.4M37.6 13.6Q41.8 25 37.6 36.4"/></g>`
      + `<path d="M16.4 13Q19.6 11.4 24 11.4V19.4Q19.6 19.4 16 20.4Z" fill="#ffffff" opacity=".9"/><path d="M24 19.4Q28.4 19.4 31.6 20.4L32.2 26Q28.4 25 24 25Z" fill="#c9e6ff" opacity=".9"/><path d="M16 26Q19.6 25 24 25V30.6Q19.6 30.6 16.2 31.4Z" fill="#ffd3ec" opacity=".85"/><path d="M31.8 31.4Q28.4 30.6 24 30.6V36Q28 36 30.8 36.6Z" fill="#fff3b0" opacity=".85"/><path d="M10.4 19.6 16 20.4 16 26 9.6 25.4Z" fill="#e3d8ff" opacity=".85"/>`
      + shade('M39.4 18A17.6 17.6 0 0 1 21 42.4 16.6 16.6 0 0 0 39.4 18Z', '#a3afbd', .55))
    + gloss('M11.2 17.6Q13.6 12.4 18.4 10.4', 2.6) + twinkle(43.2, 9.6, 3.4, '#fff') + twinkle(5, 40, 2.6, '#c6ebff') + twinkle(42, 41, 2.2, '#ffd3e0'),
  headphone:
    `<path d="M9.4 29V23.4A14.6 14.6 0 0 1 38.6 23.4V29" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M9.4 29V23.4A14.6 14.6 0 0 1 38.6 23.4V29" fill="none" stroke="url(#gV)" stroke-width="3.6" stroke-linecap="round"/>`
    + gloss('M12.4 18.4Q15.6 11.6 22 10.2', 1.8)
    + jelly('M7.6 25H13.4Q16 25 16 27.6V38.8Q16 41.4 13.4 41.4H8.8Q5.2 41.4 5.2 37.8V27.4Q5.2 25 7.6 25Z', 'gN', '#d9577e',
      `<path d="M10.6 30.6C9.4 29.4 7.8 30.2 8 31.6 8.2 33 10.6 34.8 10.6 34.8S13 33 13.2 31.6C13.4 30.2 11.8 29.4 10.6 30.6Z" fill="#fff" opacity=".9"/>`)
    + jelly('M40.4 25H34.6Q32 25 32 27.6V38.8Q32 41.4 34.6 41.4H39.2Q42.8 41.4 42.8 37.8V27.4Q42.8 25 40.4 25Z', 'gN', '#d9577e',
      `<path d="M37.4 30.6C36.2 29.4 34.6 30.2 34.8 31.6 35 33 37.4 34.8 37.4 34.8S39.8 33 40 31.6C40.2 30.2 38.6 29.4 37.4 30.6Z" fill="#fff" opacity=".9"/>`)
    + gloss('M7.8 28.6V31.6', 2) + gloss('M34.6 28.6V31.6', 2)
    + `<path d="M28.6 12.4V3.6Q31.6 4.4 33.4 7.6" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28.6 12.4V3.6Q31.6 4.4 33.4 7.6" fill="none" stroke="#ffc83d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    + jelly('M26.2 10.4A3 2.4 -20 1 1 26.19 10.4Z', 'gY', '#d98a10', '', { dx: .6, dy: 1, sw: 1.8 }) + twinkle(42.4, 10.4, 2.6, '#c6ebff'),

  /* ----- 프로필 사진: 감성 풍경 (2026-10-24 하율 "고등학생 대상, 그냥 예쁜 걸로" → 아기 같은 캐릭터 대신 고등학생이 실제로 프사로 쓰는 하늘·달·바다 풍경)
     둥근 프로필 칸을 꽉 채우는 원 안 그림(clip). 외곽선 없이 부드러운 그라디언트 + 은은한 빛 ----- */
  sunset: scene('sunset', `<rect width="48" height="48" fill="url(#sSu)"/><circle cx="24" cy="29" r="12" fill="#fff4cf" opacity=".35"/><circle cx="24" cy="29" r="7.6" fill="url(#sSun)"/>`
    + `<path d="M0 29H48V48H0Z" fill="url(#sSea)"/><g stroke="#ffe7b8" stroke-linecap="round" opacity=".85"><path d="M18 32.4H30" stroke-width="1.6"/><path d="M20 35.6H28" stroke-width="1.4"/><path d="M21.6 38.6H26.4" stroke-width="1.2"/><path d="M23 41.4H25" stroke-width="1"/></g>`
    + `<path d="M6 34H11M36 37H43M8 40.6H12" stroke="#c9d8ff" stroke-width="1" stroke-linecap="round" opacity=".6"/><path d="M33 14.4q1.4-1.4 2.8 0q1.4-1.4 2.8 0M28.4 10.4q1-1 2 0q1-1 2 0" fill="none" stroke="#9c5a6e" stroke-width="1" stroke-linecap="round" opacity=".7"/>`
    + `<path d="M2 20Q10 17.6 18 19.6M30 22.6Q38 20 47 22" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`),
  moonnight: scene('moonnight', `<rect width="48" height="48" fill="url(#sNt)"/>`
    + `<g fill="#fff">${[[8, 10, .7], [15, 6, .5], [38, 8, .8], [42, 16, .5], [6, 22, .5], [30, 4, .5], [20, 14, .4], [44, 26, .4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
    + `<circle cx="28" cy="19" r="11" fill="#fff1c2" opacity=".08"/><path d="M30.6 10.2A9 9 0 1 0 36.4 25.6 7.4 7.4 0 0 1 30.6 10.2Z" fill="url(#sMn)"/>`
    + `<path d="M-2 40Q4 33 11 36 15 30 22 34 28 31 33 35 39 32 44 36 50 35 50 40V50H-2Z" fill="#8f86d6" opacity=".7"/><path d="M-2 44Q6 39 13 42 19 38 26 42 33 39 39 42 45 40 50 43V50H-2Z" fill="#b8b0ef" opacity=".85"/>`
    + twinkleS(12, 28, 1.6) + twinkleS(40, 11, 1.4)),
  sakuratree: scene('sakuratree', `<rect width="48" height="48" fill="url(#sSk)"/><path d="M-2 40Q14 34 26 37 38 34 50 38V50H-2Z" fill="#bfe6b6"/><path d="M-2 44Q16 40 30 42 40 41 50 43V50H-2Z" fill="#a3d89c"/>`
    + `<path d="M23.2 40V29Q23 25 19.6 22.4M24.4 31Q26 26.6 30.6 24.4" fill="none" stroke="#8a5a4a" stroke-width="2.6" stroke-linecap="round"/>`
    + `<g fill="#ffb7cf">${[[15, 20, 6], [22, 15, 7], [30, 17, 6.4], [35, 23, 5], [12, 26, 4.4], [27, 23, 5.6], [19, 24, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
    + `<g fill="#ffd6e4">${[[20, 13, 3.6], [28, 14.4, 3], [14, 18, 3], [33, 20, 2.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
    + `<g fill="#fff" opacity=".9">${[[24, 12.4], [17, 17], [31, 16]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join('')}</g>`
    + `<g fill="#ff9dbd">${[[38, 31, 20], [9, 34, -30], [33, 38, 60], [41, 24, -10]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry=".8" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g>`),
  auroramt: scene('auroramt', `<rect width="48" height="48" fill="url(#sAu)"/>`
    + `<g fill="#fff">${[[7, 8, .6], [16, 4, .5], [36, 6, .7], [43, 13, .5], [27, 9, .4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
    + `<path d="M-2 26Q10 10 22 18 34 26 50 8V18Q36 34 22 26 10 20 -2 34Z" fill="url(#sAr)" opacity=".85"/><path d="M-2 30Q12 20 24 25 36 30 50 18V22Q36 34 24 30 12 26 -2 36Z" fill="#b39cff" opacity=".45"/>`
    + `<path d="M-2 50V38L9 29 15 34 24 24 33 33 39 28 50 37V50Z" fill="#3a4f86"/><path d="M24 24 20.4 28 22 28.6 24 27 26.4 29.4 28.4 28.4ZM9 29 6.6 31.2 8 31.6 9.6 30.6 11 31.6Z" fill="#eef4ff"/>`
    + `<path d="M-2 50V43L8 38 18 43 28 39 38 44 50 40V50Z" fill="#26386a"/>` + twinkleS(40, 21, 1.4)),
  jellyfish: scene('jellyfish', `<rect width="48" height="48" fill="url(#sOc)"/><path d="M14 -2 8 50M26 -2 24 50M38 -2 42 50" stroke="#bfe6ff" stroke-width="5" opacity=".12"/>`
    + `<circle cx="24" cy="20" r="13" fill="#ffc6ec" opacity=".18"/>`
    + `<path d="M17.6 27Q16 33 18.4 38 20 42 18.6 46M21.6 27.6Q21 34 23 39 24 43 22.6 47M26.4 27.6Q27 34 25 39 24 43 25.4 47M30.4 27Q32 33 29.6 38 28 42 29.4 46" fill="none" stroke="#ffd3ec" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>`
    + `<path d="M14.6 26.4Q14 14.6 24 13.6 34 14.6 33.4 26.4Q31 25 29 27 26.6 25.4 24 27 21.4 25.4 19 27 17 25 14.6 26.4Z" fill="url(#sJf)"/><path d="M17.6 20Q19 16 23 15.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8" fill="none"/>`
    + `<g fill="none" stroke="#e6f6ff" stroke-width=".8" opacity=".8"><circle cx="38" cy="34" r="1.6"/><circle cx="41" cy="27" r="1"/><circle cx="9" cy="16" r="1.3"/><circle cx="11" cy="10" r=".8"/></g>`),
  starcat: scene('starcat', `<rect width="48" height="48" fill="url(#sGx)"/><ellipse cx="14" cy="16" rx="16" ry="9" fill="#ff8fd8" opacity=".25" transform="rotate(-24 14 16)"/><ellipse cx="34" cy="34" rx="16" ry="8" fill="#7cc8ff" opacity=".22" transform="rotate(-24 34 34)"/>`
    + `<g fill="#fff">${[[6, 12, .6], [12, 30, .5], [20, 6, .7], [33, 10, .5], [42, 20, .6], [40, 40, .5], [8, 40, .6], [27, 22, .4], [16, 20, .4], [36, 28, .4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
    + `<path d="M4 6 16 14" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/><circle cx="16.4" cy="14.2" r="1.1" fill="#fff"/>`
    + `<circle cx="26" cy="30" r="13" fill="#fff1c2" opacity=".07"/><path d="M28.4 19A11.4 11.4 0 1 0 36.6 38.4 9.4 9.4 0 0 1 28.4 19Z" fill="url(#sMn)"/>`
    + `<g fill="#1b1640"><path d="M24.8 35.2Q23 30.8 25.4 28.2 24.6 25.6 25.4 23.4L27.2 25.2Q28.4 24.8 29.6 25.2L31.2 23.4Q32 25.8 31 28.2 33.4 30.8 31.8 35.2Z"/></g><path d="M31.4 34.6Q35.6 35 36 31.8 36.2 29.6 34.4 29" fill="none" stroke="#1b1640" stroke-width="1.5" stroke-linecap="round"/>`
    + twinkleS(40, 12, 1.8) + twinkleS(9, 26, 1.3)),
};

/* ===== 출석 화면 작은 그림 (24×24) — 같은 색·선, 크기가 작아서 두께는 얇게 ===== */
const uj = (d, g, dark, inner = '') => jelly(d, g, dark, inner, { dx: .8, dy: 1.4, sw: 1.7 });
const ug = d => gloss(d, 1.5, .85);
const UI = {
  gift: uj('M4 11H20V19.5Q20 21 18.5 21H5.5Q4 21 4 19.5Z', 'gR', '#c4424f', `<path d="M10.6 11H13.4V21H10.6Z" fill="url(#gY)"/>`)
    + uj('M3.4 7.6H20.6Q21.4 7.6 21.4 8.4V10.8Q21.4 11.6 20.6 11.6H3.4Q2.6 11.6 2.6 10.8V8.4Q2.6 7.6 3.4 7.6Z', 'gR', '#c4424f', `<path d="M10.6 7.6H13.4V11.6H10.6Z" fill="url(#gY)"/>`)
    + `<path d="M12 7.6C8.6 7.8 6.4 6.6 6.6 4.8 6.8 3 9.8 3.2 12 7.6ZM12 7.6C15.4 7.8 17.6 6.6 17.4 4.8 17.2 3 14.2 3.2 12 7.6Z" fill="url(#gY)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` + ug('M5.6 13.6V17'),
  cup: `<path d="M6.8 5.6H4.2Q3.8 10 8.4 11.2M17.2 5.6H19.8Q20.2 10 15.6 11.2" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M6.8 5.6H4.2Q3.8 10 8.4 11.2M17.2 5.6H19.8Q20.2 10 15.6 11.2" fill="none" stroke="#ffc83d" stroke-width="1.5" stroke-linecap="round"/>`
    + uj('M6 3.4H18V7.8Q18 14 12 14 6 14 6 7.8Z', 'gY', '#d98a10') + uj('M10.6 14H13.4L13.8 17H10.2Z', 'gY', '#d98a10') + uj('M7.4 17H16.6Q17.6 17 17.6 18V20Q17.6 21 16.6 21H7.4Q6.4 21 6.4 20V18Q6.4 17 7.4 17Z', 'gV', '#5d47d6') + ug('M8.4 6V8.2Q8.6 10.6 10 11.6'),
  sparkle: uj('M10 2.5C10.8 7.5 11.5 8.7 17 10 11.5 11.3 10.8 12.5 10 17.5 9.2 12.5 8.5 11.3 3 10 8.5 8.7 9.2 7.5 10 2.5Z', 'gY', '#d98a10')
    + uj('M18.5 13.6C18.9 16.1 19.3 16.6 22 17.2 19.3 17.8 18.9 18.3 18.5 20.8 18.1 18.3 17.7 17.8 15 17.2 17.7 16.6 18.1 16.1 18.5 13.6Z', 'gB', '#2a7fc4'),
  tag: uj('M3 12.4V4.6Q3 3 4.6 3H12.4L21 11.6Q22 12.6 21 13.6L13.6 21Q12.6 22 11.6 21Z', 'gB', '#2a7fc4', `<circle cx="7.8" cy="7.8" r="1.8" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`) + ug('M5.2 12V9.8'),
  lock: `<path d="M7.6 10.6V8.2A4.4 4.4 0 0 1 16.4 8.2V10.6" fill="none" stroke="${INK}" stroke-width="4"/><path d="M7.6 10.6V8.2A4.4 4.4 0 0 1 16.4 8.2V10.6" fill="none" stroke="#dfe7ee" stroke-width="1.8"/>`
    + uj('M6.4 10.4H17.6Q19 10.4 19 11.8V19Q19 20.4 17.6 20.4H6.4Q5 20.4 5 19V11.8Q5 10.4 6.4 10.4Z', 'gY', '#d98a10', `<circle cx="12" cy="14.6" r="1.5" fill="${INK}"/><path d="M12 15.4V17.6" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`) + ug('M7.4 12.6V15.2'),
  check: uj('M12 3A9 9 0 1 1 11.99 3Z', 'gG', '#3f9a3a') + `<path d="m7.8 12.3 2.8 2.8 5.6-5.8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` + ug('M5.6 9.6Q6.6 6.8 9.4 5.6'),
  party: uj('M3.5 20.5 8 7 17 16Z', 'gY', '#d98a10', `<path d="M5.4 14.8 9.2 18.6M6.9 10.4 13.6 17.1" stroke="#f0646d" stroke-width="1.8"/>`)
    + `<path d="M14 3.5Q15.6 6 13.4 8.2M19 9.4Q21 8.2 22 9.9M17.3 5.6 18.8 3.4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`
    + `<circle cx="20.2" cy="3.6" r="1.3" fill="url(#gB)" stroke="${INK}" stroke-width=".9"/><circle cx="21" cy="14" r="1.3" fill="url(#gR)" stroke="${INK}" stroke-width=".9"/><circle cx="10.8" cy="3" r="1.1" fill="url(#gG)" stroke="${INK}" stroke-width=".9"/>`,
  pw: uj('M5.4 4.5H18.6Q21 4.5 21 6.9V18.6Q21 21 18.6 21H5.4Q3 21 3 18.6V6.9Q3 4.5 5.4 4.5Z', 'gW', '#aebccb',
      `<path d="M3 6.9Q3 4.5 5.4 4.5H18.6Q21 4.5 21 6.9V9.6H3Z" fill="url(#gY)"/><path d="m8 14.8 2.8 2.8 5.4-5.4" fill="none" stroke="#ef8a50" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`)
    + `<path d="M8 2.6V6.4M16 2.6V6.4" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
};
// 순위 메달 1·2·3 (금·은·동)
const MD = [['gY', '#d98a10', '#a8650a'], ['gS', '#8d9aa8', '#5d6b7a'], ['gP', '#b5622c', '#8a451a']], MR = [['gB', '#2a7fc4'], ['gV', '#5d47d6'], ['gR', '#c4424f']];
export const medal = i => {
  if (i >= 3) return `${i + 1}`;
  ensureSprite();
  return `<svg class="att-ic md" viewBox="-1 -1 26 26" aria-label="${i + 1}위">${uj('M6.4 1.8H10.6L13 8.6H8.8Z', MR[i][0], MR[i][1])}${uj('M17.6 1.8H13.4L11 8.6H15.2Z', MR[i][0], MR[i][1])}${uj('M12 7.6A7.4 7.4 0 1 1 11.99 7.6Z', MD[i][0], MD[i][1])}<text x="12" y="18.4" text-anchor="middle" font-family="Outfit,sans-serif" font-weight="900" font-size="9" fill="${MD[i][2]}">${i + 1}</text>${ug('M7.4 13.4Q8 11 10 10.2')}</svg>`;
};

// 그림마다 실제 그려진 범위(반짝이 제외, 헤드리스 브라우저 getBBox로 잰 값)를 가운데에 둔 정사각 viewBox → 어느 칸에서도 정가운데·같은 크기
// 그림을 고치면 다시 잴 것: 그림 범위를 재서 (가로·세로 중 큰 값 + 5.2) 정사각형, 중심 = 범위 중심
const VB = {"heart": "3.2 4.5 43.2 43.2", "camera": "3.0 5.0 43.6 43.6", "cherry": "1.1 1.0 47.8 47.8", "planet": "-0.2 1.4 48.5 48.5", "shootstar": "0.4 -3.0 50.8 50.8", "butterfly": "1.8 0.6 45.4 45.4", "headphone": "1.9 1.0 45.8 45.8", "moon": "4.1 2.9 45.2 45.2", "disco": "0.3 -1.0 49.0 49.0"};
/* ===== 스프라이트: 문서에 한 번만 (그라디언트 + 보상 그림 symbol) ===== */
let done = false;
export function ensureSprite() {
  if (done || typeof document === 'undefined' || !document.body) return;
  done = true;
  const box = document.createElement('div');
  box.className = 'att-sprite'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${DEFS}</defs>${Object.entries(ART).map(([k, v]) => `<symbol id="art-${k}" viewBox="${SCENES.has(k) ? '0 0 48 48' : VB[k] || '-3 -3 54 54'}">${v}</symbol>`).join('')}</svg>`;
  document.body.appendChild(box);
}
if (typeof document !== 'undefined') { if (document.body) ensureSprite(); else document.addEventListener('DOMContentLoaded', ensureSprite, { once: true }); }

/* ===== 내보내기 ===== */
// 2026-10-24 보상 그림 교체 전 이름 → 새 그림 (예전에 고른 프로필 사진·스티커·보낸 스티커 메시지가 그대로 새 그림으로 보이게)
const keyOf = v => { const k = String(v).slice(2); return RW_OLD[k] || k; };
export const ART_KEYS = Object.keys(ART);
export const isArt = v => typeof v === 'string' && v.startsWith('r:') && !!ART[keyOf(v)];
export const artOf = (v, cls = '') => { if (!isArt(v)) return ''; ensureSprite(); return `<svg class="art ${cls}${SCENES.has(keyOf(v)) ? ' sc' : ''}" aria-hidden="true"><use href="#art-${keyOf(v)}" width="100%" height="100%"/></svg>`; };
// 프로필 사진·스티커 값 → 그림(직접 그린 것) 또는 글자(예전 이모지)
// 프로필 사진 캐릭터 16종 'k:이름' (2026-10-24, 동물 이모지 대신) — 테마 캐릭터 그림(style.css .sk-* 의 --art)을 얼굴만 잘라 씀
const KAV = { cat: '고양이', dog: '강아지', bear: '곰돌이', bunny: '토끼', frog: '개구리', chick: '병아리', hamster: '햄찌', penguin: '펭귄', fox: '여우', panda: '판다', dino: '공룡', ghost: '유령', slime: '슬라임', sheep: '양', whale: '고래', axolotl: '우파루파' };
export const KAV_KEYS = Object.keys(KAV).map(k => 'k:' + k);
export const kavName = v => KAV[String(v || '').slice(2)] || '';
const isKav = v => typeof v === 'string' && v.startsWith('k:') && !!KAV[v.slice(2)];
export const emo = (v, cls = '') => isArt(v) ? artOf(v, cls) : isKav(v) ? `<i class="kav sk-${v.slice(2)}${cls ? ' ' + cls : ''}" role="img" aria-label="${KAV[v.slice(2)]}" data-n="${KAV[v.slice(2)]}"></i>` : esc(v);
// 스티커만 보낸 댓글·DM('::r:이름') → 큰 스티커 그림, 아니면 ''
export const stkOf = t => { const m = STK_MSG.exec(String(t || '')); return m && isArt(m[1]) ? m[1] : ''; };
export const stkMsg = (t, cls = 'stkm') => { const v = stkOf(t); return v ? artOf(v, cls) : ''; };
// 이름 옆 대표 스티커
// 이름 옆 대표 스티커 (보통 1개, 개발자는 쉼표로 최대 3개)
export const repTag = u => String(u?.rep || '').split(',').filter(isArt).map(v => `<i class="rep" data-tip="대표 스티커">${artOf(v, 'repa')}</i>`).join('');
export const ui = (k, cls = '') => { ensureSprite(); return `<svg class="att-ic ${cls}" viewBox="-1 -1 26 26" aria-hidden="true">${UI[k]}</svg>`; };
