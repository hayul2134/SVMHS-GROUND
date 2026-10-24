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
  cSb: ['#ffb3bd', '#f4566e'], cCr: ['#fffaf0', '#ffe2bf'], cBr: ['#f2d2b0', '#c99060'], cBn: ['#ffffff', '#f6e6ef'], cGx: ['#5b4cc4', '#1e1d5c'], cGm: ['#ffc9d8', '#ff7ea3'], cBg: ['#ffe39a', '#e8a043'],
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
    `<g transform="rotate(-14 24 27)"><path d="M3.4 27A20.6 6.8 0 0 1 44.6 27" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M3.4 27A20.6 6.8 0 0 1 44.6 27" fill="none" stroke="#ffc83d" stroke-width="3" stroke-linecap="round"/></g>`
    + jelly('M24 11A13.2 13.2 0 1 1 23.99 11Z', 'gV', '#5d47d6',
      shade('M33.8 15.4A13.2 13.2 0 0 1 20 36.8 14 14 0 0 0 33.8 15.4Z', '#7a64f2', .75)
      + `<path d="M11.8 19.6Q24 16.8 36.4 20.2" fill="none" stroke="#c7b8ff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`
      + eyes(19.6, 28.4, 25, 1.9, 2.4) + blush(16.6, 31.4, 28.4, 2.2, 1.3) + mouthW(24, 28.2, 1.5))
    + `<g transform="rotate(-14 24 27)"><path d="M3.4 27A20.6 6.8 0 0 0 44.6 27" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M3.4 27A20.6 6.8 0 0 0 44.6 27" fill="none" stroke="#ffc83d" stroke-width="3" stroke-linecap="round"/><path d="M9 31.4Q14 33.2 20 33.8" fill="none" stroke="#fff3b0" stroke-width="1.4" stroke-linecap="round"/></g>`
    + gloss('M15.4 16.6Q18 13.6 21.6 13', 2.4) + twinkle(41, 8, 3.2, '#fff3b0') + twinkle(7, 41, 2.4, '#c6ebff'),
  shootstar:
    `<path d="M5 41.6 20.6 26M9.8 44 23.6 30.2M3 35.6 17.4 21.2" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`
    + `<path d="M5 41.6 20.6 26" stroke="#ff8fb0" stroke-width="3" stroke-linecap="round"/><path d="M9.8 44 23.6 30.2" stroke="#7cc8ff" stroke-width="3" stroke-linecap="round"/><path d="M3 35.6 17.4 21.2" stroke="#ffd36a" stroke-width="3" stroke-linecap="round"/>`
    + `<g transform="rotate(12 30 18)">` + jelly(starD(30, 18.5, 15, 7.4), 'gY', '#d98a10', shade('M37.4 19.4 44.2 14.2 38.6 22.6 40.6 31.6 30 26.2Z', '#f0a21c', .7)
      + eyes(26.4, 33.6, 20, 1.9, 2.4) + blush(23.6, 36.4, 23.2, 2, 1.2) + mouthW(30, 23.2, 1.4)) + gloss('M21.4 15.2 25.2 15', 2.4) + `</g>`
    + twinkle(42.6, 36, 2.8, '#c6ebff') + twinkle(12, 8.6, 2.6, '#ffd3e0'),
  butterfly:
    jelly('M23 22.6C19.6 10.4 9.8 5.4 5.6 9.4 2 13 6 22.2 23 24.6Z', 'gH', '#8b76ff', `<circle cx="11.2" cy="13.4" r="2" fill="#fff" opacity=".85"/><circle cx="15.6" cy="18.6" r="1.2" fill="#fff" opacity=".75"/>`, { dx: 1, dy: 1.8 })
    + jelly('M25 22.6C28.4 10.4 38.2 5.4 42.4 9.4 46 13 42 22.2 25 24.6Z', 'gH2', '#8b76ff', `<circle cx="36.8" cy="13.4" r="2" fill="#fff" opacity=".85"/><circle cx="32.4" cy="18.6" r="1.2" fill="#fff" opacity=".75"/>`, { dx: 1, dy: 1.8 })
    + jelly('M23 26.4C14.6 26.4 8.8 31.4 10.6 36.8 12.6 42.2 20.2 38.6 23 28.4Z', 'gH2', '#8b76ff', `<circle cx="15" cy="34.4" r="1.4" fill="#fff" opacity=".8"/>`, { dx: 1, dy: 1.8 })
    + jelly('M25 26.4C33.4 26.4 39.2 31.4 37.4 36.8 35.4 42.2 27.8 38.6 25 28.4Z', 'gH', '#8b76ff', `<circle cx="33" cy="34.4" r="1.4" fill="#fff" opacity=".8"/>`, { dx: 1, dy: 1.8 })
    + `<path d="M22.6 14.4Q19.6 8 15.6 7.2M25.4 14.4Q28.4 8 32.4 7.2" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><circle cx="15.4" cy="7.2" r="1.6" fill="#ffc83d" stroke="${INK}" stroke-width="1.1"/><circle cx="32.6" cy="7.2" r="1.6" fill="#ffc83d" stroke="${INK}" stroke-width="1.1"/>`
    + jelly('M24 13.6Q26.4 13.6 26.4 17V35.6Q26.4 38.8 24 38.8 21.6 38.8 21.6 35.6V17Q21.6 13.6 24 13.6Z', 'gV', '#5d47d6', '', { dx: .6, dy: 1 })
    + gloss('M7.6 12.6Q8.8 10 11.4 9.8', 2.2) + twinkle(43.4, 26, 2.8, '#fff3b0') + twinkle(4.6, 27.6, 2.2, '#ffd3e0'),
  milk:
    `<path d="M29.6 9.6 33.4 2.6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M29.6 9.6 33.4 2.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M30.6 7.8 32 5.2" stroke="#ff8fb0" stroke-width="2.4"/>`
    + jelly('M32 20 38.2 15.4V38.8Q38.2 40.2 37.2 41L32 45Z', 'gN', '#d9577e', shade('M32 20 38.2 15.4V38.8Q38.2 40.2 37.2 41L32 45Z', '#ff8fb0', .5), { dx: .8, dy: 1.4 })
    + jelly('M12.2 20 16.6 10.4H27.6L32 20Z', 'gW', '#c9b8c4', shade('M27.6 10.4 32 20H27.4Z', '#ffd9e4', .9), { dx: .8, dy: 1.4 })
    + jelly('M16.6 10.4V7.4H27.6V10.4Z', 'gW', '#c9b8c4', '', { dx: .6, dy: 1 })
    + jelly('M12.2 20H32V43Q32 45 30 45H14.2Q12.2 45 12.2 43Z', 'gN', '#d9577e',
      `<path d="M12.2 24.2H32V37H12.2Z" fill="#fff8fb"/>`
      + eyes(18.4, 25.8, 30.2, 1.9, 2.4) + blush(15.6, 28.6, 33.2, 2, 1.2) + mouthW(22.1, 33.2, 1.4)
      + `<path d="M23.6 39.4C21.8 39.4 21 40.8 21.4 42.2 21.8 43.6 23 44.4 23.6 44.4S25.4 43.6 25.8 42.2C26.2 40.8 25.4 39.4 23.6 39.4Z" fill="#ff6d8a" stroke="${INK}" stroke-width="1"/><path d="M22.4 39.6 23.6 38.4 24.8 39.6" fill="none" stroke="#3f9a3a" stroke-width="1.2" stroke-linecap="round"/>`)
    + gloss('M15.2 22.2V21.6', 2.2) + twinkle(8, 14, 2.8, '#fff3b0'),
  bungeo:
    jelly('M7 26C7 17.6 15.4 12 25.4 12 32.6 12 36.8 15.4 39 19.6L44 14.6Q46.6 22.2 44.6 29 46.6 32.6 44 37.6L39 32.4C36.8 36.8 32 40.4 25 40.4 14.6 40.4 7 34.6 7 26Z', 'cBg', '#b8742a',
      shade('M39 32.4C36.8 36.8 32 40.4 25 40.4 16 40.4 9.4 36 7.6 30.2 14 35.6 30 37.4 39 32.4Z', '#d0892f', .7)
      + `<path d="M21.6 21.8q2.6 2.8 5.2 0q2.6 2.8 5.2 0M19 28q2.6 2.8 5.2 0q2.6 2.8 5.2 0q2.6 2.8 5.2 0" fill="none" stroke="#b8742a" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>`
      + `<path d="M22 12.4Q25.6 8.6 30.6 9.8 30.4 12 29 13.2" fill="#f2b45a" stroke="#b8742a" stroke-width="1.6" stroke-linejoin="round"/>`
      + eye(14.6, 23.4, 2.4, 3) + cheek(12.8, 29, 2.6, 1.6) + mouthW(10.4, 30.2, 1.3, '#7a4a1e'), { line: '#9a5f22' })
    + gloss('M11.2 20.4Q14 15.6 19.6 14.4', 2.4) + twinkle(42.6, 7.6, 3, '#fff3b0') + `<path d="M28 4.6Q29.4 2.6 28 .8M32.6 5.2Q34 3.2 32.6 1.4" fill="none" stroke="#c9d2dc" stroke-width="1.4" stroke-linecap="round" class="tw"/>`,
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

  /* ----- 프로필 사진: 캐릭터 (CHARACTER_GUIDE — 외곽선은 몸 색을 진하게) 2026-10-24 교체: 딸기 모자 고양이·우주복 강아지·왕관 토끼·은하수 고양이·젤리곰 ----- */
  strawcat:
    `<path d="M9.6 15.4 9.4 4.6 18.2 9.8ZM38.4 15.4 38.6 4.6 29.8 9.8Z" fill="url(#cSb)" stroke="#d8435b" stroke-width="2.2" stroke-linejoin="round"/>`
    + jelly('M24 6.4C35.4 6.4 43.4 14.8 43.4 25.6 43.4 35 37.4 42.6 24 43.4 10.6 42.6 4.6 35 4.6 25.6 4.6 14.8 12.6 6.4 24 6.4Z', 'cSb', '#d8435b',
      `<g fill="#fff3b0">${[[11, 17], [16.6, 11.6], [31.4, 11.6], [37, 17], [8.4, 26.4], [39.6, 26.4], [9.8, 35.6], [38.2, 35.6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.1" ry="1.6"/>`).join('')}</g>`, { line: '#d8435b', flat: true })
    + jelly(starD(24, 6.6, 7.6, 3, 5, -90), 'gG', '#3f9a3a', '', { line: '#3f9a3a', flat: true, sw: 1.8 })
    + jelly(mochi(24, 29.6, 26, 20.4), 'cCr', '#e0a96a', shade('M35.6 30.4C35.4 35.6 30.8 39.4 24 39.6 31 37.8 34.2 34.4 35.6 30.4Z', '#f2c48c', .7), { line: '#d99a5a', flat: true })
    + eyes(19, 29, 30.6, 2.4, 3) + blush(15.2, 32.8, 34.2, 2.6, 1.5)
    + `<path d="M23 32.6H25Q25.3 32.6 25.1 32.9L24.2 33.8Q24 34 23.8 33.8L22.9 32.9Q22.7 32.6 23 32.6Z" fill="#ff8fa8"/>` + mouthW(24, 34.6, 1.6, '#a8604a')
    + gloss('M11.6 18.6Q14.6 12.6 21 11', 2.4, .75),
  astrodog:
    jelly('M8.6 41.2Q24 48 39.4 41.2V45.4Q24 51 8.6 45.4Z', 'gW', '#9fb0c2', '', { line: '#8fa3b8', dx: .8, dy: 1.2, sw: 1.8 })
    + `<path d="M12.6 17.6C6.4 18.8 6 30.4 10.4 33.8 13.6 31 15.4 23.4 12.6 17.6ZM35.4 17.6C41.6 18.8 42 30.4 37.6 33.8 34.4 31 32.6 23.4 35.4 17.6Z" fill="url(#cBr)" stroke="#b07a4e" stroke-width="2" stroke-linejoin="round"/>`
    + jelly(mochi(24, 28.4, 24, 20), 'cCr', '#e0a96a', `<path d="M27 18.6C31.6 18 35.2 21 35.4 25.6 32.4 26.4 28.4 24.4 27 18.6Z" fill="#e8c09a"/>`, { line: '#d99a5a', flat: true })
    + eyes(19.4, 28.6, 28.8, 2.3, 2.9) + blush(15.8, 32.2, 32.4, 2.3, 1.4)
    + `<ellipse cx="24" cy="31.6" rx="2" ry="1.4" fill="#5a3a2a"/>` + mouthW(24, 33.4, 1.5, '#5a3a2a')
    + `<path d="M24 5V1.6" stroke="#8fa3b8" stroke-width="2" stroke-linecap="round"/>` + jelly(starD(24, 1.8, 3.4, 1.5), 'gY', '#d98a10', '', { flat: true, sw: 1.2, line: '#c98a10' })
    + `<circle cx="24" cy="25.4" r="19.6" fill="#dff1ff" opacity=".16" stroke="#9cc4ea" stroke-width="2.4"/>`
    + `<path d="M10.4 20.4A15.6 15.6 0 0 1 20 10.4" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".9"/><circle cx="9.4" cy="25" r="1.4" fill="#fff" opacity=".9"/>`
    + twinkle(42.4, 8.4, 2.8, '#fff3b0'),
  crownbunny:
    `<path d="M15.6 22C11.4 12.4 11.6 2.6 16.2 2.6 20.8 2.6 21.2 12.4 20.2 22Z" fill="url(#cBn)" stroke="#d9a8c0" stroke-width="2.2" stroke-linejoin="round"/><path d="M32.4 22C36.6 12.4 36.4 2.6 31.8 2.6 27.2 2.6 26.8 12.4 27.8 22Z" fill="url(#cBn)" stroke="#d9a8c0" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<path d="M16.4 18.6C14.4 12 14.8 6.2 16.4 6.2 18 6.2 18.4 12 17.8 18.6Z" fill="#ffc2d4"/><path d="M31.6 18.6C33.6 12 33.2 6.2 31.6 6.2 30 6.2 29.6 12 30.2 18.6Z" fill="#ffc2d4"/>`
    + jelly(mochi(24, 31.4, 28, 21.4), 'cBn', '#d9a8c0', shade('M36.6 32.2C36.4 37.8 31.6 42 24 42.2 31.8 40.2 35.2 36.6 36.6 32.2Z', '#efd4e2', .8), { line: '#d9a8c0', flat: true })
    + `<g transform="rotate(-10 24 17)">` + jelly('M16.8 21.4 15.6 12.6 20.4 16.4 24 10.6 27.6 16.4 32.4 12.6 31.2 21.4Z', 'gY', '#d98a10',
      `<circle cx="24" cy="18" r="1.6" fill="#ff6d8a" stroke="#c97a0a" stroke-width=".9"/><circle cx="19.4" cy="19" r="1.1" fill="#7cc8ff" stroke="#c97a0a" stroke-width=".8"/><circle cx="28.6" cy="19" r="1.1" fill="#7cc8ff" stroke="#c97a0a" stroke-width=".8"/>`, { line: '#b8740a', dx: .8, dy: 1.4, sw: 1.8 })
      + `<circle cx="15.6" cy="12.4" r="1.2" fill="#fff3b0" stroke="#b8740a" stroke-width=".9"/><circle cx="24" cy="10.4" r="1.2" fill="#fff3b0" stroke="#b8740a" stroke-width=".9"/><circle cx="32.4" cy="12.4" r="1.2" fill="#fff3b0" stroke="#b8740a" stroke-width=".9"/></g>`
    + eyes(19.2, 28.8, 32.2, 2.4, 3) + blush(15.4, 32.6, 35.6, 2.6, 1.5)
    + `<path d="M23 34.2H25Q25.3 34.2 25.1 34.5L24.2 35.4Q24 35.6 23.8 35.4L22.9 34.5Q22.7 34.2 23 34.2Z" fill="#ff8fa8"/>` + mouthW(24, 36.2, 1.6, '#a8607a')
    + gloss('M12.2 29.4Q13.4 25.2 17 24', 2.2, .75) + twinkle(41.4, 9.4, 3, '#fff3b0') + twinkle(6.6, 10, 2.2, '#ffd3e0'),
  galaxycat:
    `<path d="M8.4 21 9 4.8 20.4 12.6ZM39.6 21 39 4.8 27.6 12.6Z" fill="url(#cGx)" stroke="#9d8bff" stroke-width="2.2" stroke-linejoin="round"/><path d="M11.4 16.4 11.6 9.4 16.6 12.8ZM36.6 16.4 36.4 9.4 31.4 12.8Z" fill="#ff9fd0" opacity=".85"/>`
    + jelly(mochi(24, 28, 34, 28), 'cGx', '#2a2370',
      `<ellipse cx="15.6" cy="22" rx="8" ry="5" fill="#ff8fd8" opacity=".32"/><ellipse cx="32.6" cy="34.6" rx="9" ry="5" fill="#7cc8ff" opacity=".3"/>`
      + `<g fill="#fff">${[[12.6, 25.6, .8], [33.4, 20.4, 1], [37.4, 28.2, .7], [28.4, 37.6, .8], [15.6, 36.4, .6], [21.4, 18.6, .6], [9.8, 31.4, .5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
      + `<path d="M24 16.6Q24.5 18.6 26.4 19.2 24.5 19.8 24 21.8 23.5 19.8 21.6 19.2 23.5 18.6 24 16.6Z" fill="#ffe27a"/>`, { line: '#9d8bff', flat: true })
    + `<ellipse cx="18.8" cy="28.4" rx="2.6" ry="3.2" fill="#fff8dc"/><ellipse cx="29.2" cy="28.4" rx="2.6" ry="3.2" fill="#fff8dc"/><circle cx="19.6" cy="27" r="1" fill="#7a64f2"/><circle cx="30" cy="27" r="1" fill="#7a64f2"/>`
    + blush(14.6, 33.4, 32.4, 2.6, 1.5).replace(/opacity="\.5"/g, 'opacity=".7"') + mouthW(24, 32.6, 1.6, '#fff8dc')
    + gloss('M10.4 22Q12.6 16.2 19 14.6', 2.2, .55) + twinkle(43.4, 26, 3, '#fff3b0') + twinkle(4.4, 34, 2.4, '#c6ebff') + twinkle(42, 41.6, 2, '#ffd3e0'),
  jellybear:
    `<circle cx="12.4" cy="13.2" r="6" fill="url(#cGm)" stroke="#e64d7a" stroke-width="2.2"/><circle cx="35.6" cy="13.2" r="6" fill="url(#cGm)" stroke="#e64d7a" stroke-width="2.2"/><circle cx="12.4" cy="13.4" r="2.6" fill="#ffe1ea" opacity=".7"/><circle cx="35.6" cy="13.4" r="2.6" fill="#ffe1ea" opacity=".7"/>`
    + jelly(mochi(24, 28, 33, 28), 'cGm', '#e64d7a',
      `<ellipse cx="22" cy="24" rx="11" ry="8" fill="#ffe1ea" opacity=".45"/>`
      + `<ellipse cx="24" cy="33.4" rx="6.6" ry="4.6" fill="#ffe1ea" opacity=".8"/>`, { line: '#e64d7a', flat: true })
    + eyes(17.6, 30.4, 27.6, 2.4, 3) + `<ellipse cx="24" cy="31.8" rx="2" ry="1.4" fill="#a8304f"/>` + mouthW(24, 34, 1.5, '#a8304f') + blush(12.8, 35.2, 31.6, 2.6, 1.5)
    + gloss('M11.6 22.4Q13.8 16.4 20.6 15', 3, .9) + `<circle cx="10.6" cy="27" r="1.4" fill="#fff" opacity=".9"/>` + gloss('M10.2 11.2Q11 9.4 12.8 9', 1.6, .9) + twinkle(43, 28, 2.6, '#fff3b0'),
  /* ----- 고래 (누적 120일, 유지) ----- */
  whale:
    `<path d="M22 13.4Q20.4 9.6 18 8.6M26 13.4Q27.6 9.6 30 8.6" fill="none" stroke="#5aa2f2" stroke-width="2.6" stroke-linecap="round"/><path d="M24 13V6.4" stroke="#5aa2f2" stroke-width="2.6" stroke-linecap="round"/>`
    + `<circle cx="17.6" cy="7.8" r="1.6" fill="#bfe3ff" stroke="#2f74c4" stroke-width="1"/><circle cx="30.4" cy="7.8" r="1.6" fill="#bfe3ff" stroke="#2f74c4" stroke-width="1"/><circle cx="24" cy="5.2" r="1.8" fill="#bfe3ff" stroke="#2f74c4" stroke-width="1"/>`
    + jelly('M5 29.5C5 20.5 13.4 15.2 23.5 15.2 33.6 15.2 40 20.6 40 27.2 41.8 26 43.4 23.2 43.6 20.6 46 23.4 46.2 29.6 42.4 32.6 39.8 38.8 32.4 42 23.5 42 12.6 42 5 37 5 29.5Z', 'cWh', '#2f74c4',
      `<path d="M6.2 33.2C9.4 38.6 15.6 41 23.5 41 30.8 41 36.4 38.6 39.4 34.4 32.6 36.2 15.6 36.4 6.2 33.2Z" fill="url(#cWb)"/>`, { line: '#2f74c4', flat: true })
    + eye(15.6, 27.6, 2.4, 3) + mouthW(20.6, 31.4, 1.7, '#2f5f9e') + cheek(11.6, 31.6, 2.6, 1.6)
    + gloss('M10.4 22.2Q14.4 17.8 21 17', 2.4, .7),
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
const VB = {"heart": "3.2 4.5 43.2 43.2", "camera": "3.0 5.0 43.6 43.6", "cherry": "1.1 1.0 47.8 47.8", "planet": "-0.2 1.4 48.5 48.5", "shootstar": "0.4 -3.0 50.8 50.8", "butterfly": "1.8 0.6 45.4 45.4", "milk": "0.4 -0.0 50.4 50.4", "bungeo": "4.4 3.7 45.3 45.3", "headphone": "1.9 1.0 45.8 45.8", "strawcat": "-0.8 -3.6 49.6 49.6", "astrodog": "-4.1 -4.2 56.2 56.2", "crownbunny": "1.6 -0.0 44.8 44.8", "galaxycat": "4.3 2.2 40.0 40.0", "jellybear": "3.8 3.2 40.4 40.4", "whale": "2.4 -0.1 45.5 45.5"};
/* ===== 스프라이트: 문서에 한 번만 (그라디언트 + 보상 그림 symbol) ===== */
let done = false;
export function ensureSprite() {
  if (done || typeof document === 'undefined' || !document.body) return;
  done = true;
  const box = document.createElement('div');
  box.className = 'att-sprite'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${DEFS}</defs>${Object.entries(ART).map(([k, v]) => `<symbol id="art-${k}" viewBox="${VB[k] || '-3 -3 54 54'}">${v}</symbol>`).join('')}</svg>`;
  document.body.appendChild(box);
}
if (typeof document !== 'undefined') { if (document.body) ensureSprite(); else document.addEventListener('DOMContentLoaded', ensureSprite, { once: true }); }

/* ===== 내보내기 ===== */
// 2026-10-24 보상 그림 교체 전 이름 → 새 그림 (예전에 고른 프로필 사진·스티커·보낸 스티커 메시지가 그대로 새 그림으로 보이게)
const keyOf = v => { const k = String(v).slice(2); return RW_OLD[k] || k; };
export const ART_KEYS = Object.keys(ART);
export const isArt = v => typeof v === 'string' && v.startsWith('r:') && !!ART[keyOf(v)];
export const artOf = (v, cls = '') => { if (!isArt(v)) return ''; ensureSprite(); return `<svg class="art ${cls}" aria-hidden="true"><use href="#art-${keyOf(v)}" width="100%" height="100%"/></svg>`; };
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
