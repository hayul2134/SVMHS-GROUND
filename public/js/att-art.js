// SVMHS GROUND — 출석 보상·출석 화면 그림 (전부 직접 그린 SVG, 이모지 안 씀)
// 규칙: tools/attend/ART_GUIDE.md (로고와 같은 '젤리 스티커' — 두께·세로 그라디언트·오른쪽 아래 그림자·왼쪽 위 광택·남색 선,
//       캐릭터는 CHARACTER_GUIDE: 찹쌀떡 얼굴·몸 색을 진하게 한 외곽선·세로 타원 눈·ω 입·볼터치)
// 그림은 문서에 한 번만 넣는 스프라이트(<symbol>)로 두고 <use>로 불러 씀 → 같은 그림이 여러 번 나와도 가벼움.
// 보상 값은 'r:이름'으로 저장되고, 사이트 어디서든 프로필 사진·스티커를 그릴 땐 emo(값)을 씀(옛 이모지 값은 글자 그대로).
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
};
const DEFS = Object.entries(GR).map(([k, [a, b]]) => `<linearGradient id="${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('');

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
  /* ----- 스티커: 물건 (남색 선 + 두께 + 광택) ----- */
  sprout:
    `<path d="M24 29V19" stroke="${INK}" stroke-width="5.4" stroke-linecap="round"/><path d="M24 29V19" stroke="#56b04a" stroke-width="2.4" stroke-linecap="round"/>`
    + jelly('M24 20.5C22 13.5 15.5 10.5 8.5 12 9 18.8 15.2 22.6 24 20.5Z', 'gG', '#3f9a3a', shade('M24 20.5C19 21.5 13.5 19.5 10.6 16.2 15 18.2 19.6 19.2 24 20.5Z', '#4fae46', .55))
    + jelly('M24.5 18C25.5 10 32.5 5.2 40.5 6.4 40 14.4 33.4 19.2 24.5 18Z', 'gG', '#3f9a3a', shade('M24.5 18C30 18.6 35.5 16 38.6 11.4 34.6 14.8 29.6 16.8 24.5 18Z', '#4fae46', .55))
    + `<path d="M23 19.4Q16.5 16.2 11.4 13.4M25.6 16.6Q32 12 38 8" fill="none" stroke="#3f9a3a" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`
    + gloss('M29.4 10.2Q32.6 8.4 35.8 8.1', 2.2)
    + jelly('M15 32H33L31.2 41.6Q30.8 44 28.4 44H19.6Q17.2 44 16.8 41.6Z', 'gP', '#c45f2e', shade('M29.6 32H33L31.2 41.6Q30.8 44 28.4 44H27.2Z', '#e07440', .7))
    + jelly('M12.5 27.5H35.5Q37 27.5 37 29V31Q37 32.5 35.5 32.5H12.5Q11 32.5 11 31V29Q11 27.5 12.5 27.5Z', 'gP', '#c45f2e', shade('M11 30.4H37V31Q37 32.5 35.5 32.5H12.5Q11 32.5 11 31Z', '#e07440', .6))
    + gloss('M14 29.8H22', 1.8) + gloss('M19.6 35.4L19 39.6', 2),
  medal:
    jelly('M13.5 3H21.5L27 18H19Z', 'gB', '#2a7fc4', shade('M18 3H21.5L27 18H23.2Z', '#3a92d8', .7))
    + jelly('M34.5 3H26.5L21 18H29Z', 'gR', '#c4424f', shade('M30.6 3H34.5L29 18H25.4Z', '#e0545e', .7))
    + jelly('M24 19A12.5 12.5 0 1 1 23.99 19Z', 'gY', '#d98a10', shade('M33.6 23.6A12.5 12.5 0 0 1 17.4 41.6 12 12 0 0 0 33.6 23.6Z', '#f0a21c', .8)
      + `<circle cx="24" cy="31.5" r="8.4" fill="#ffe27a" stroke="#d98a10" stroke-width="1.6"/><polygon points="${star(24, 32, 5.8, 2.6)}" fill="#ffc83d" stroke="#c97a0a" stroke-width="1.3" stroke-linejoin="round"/>`)
    + gloss('M15.2 28A9.6 9.6 0 0 1 20.4 22.2', 2.6) + twinkle(37, 21, 3.2),
  gem:
    jelly('M13 9H35L43 19.5 24 42 5 19.5Z', 'gB', '#2a7fc4',
      `<path d="M13 9 18 19.5H5Z" fill="#d6f4ff"/><path d="M13 9H35L30 19.5H18Z" fill="#effbff"/><path d="M35 9 43 19.5H30Z" fill="#8fd6ff"/>`
      + `<path d="M5 19.5H18L24 42Z" fill="#a8e3ff"/><path d="M18 19.5H30L24 42Z" fill="#c9efff"/><path d="M30 19.5H43L24 42Z" fill="#4aaeef"/>`
      + `<path d="M5 19.5H43M13 9 18 19.5 24 42 30 19.5 35 9M18 19.5 24 9 30 19.5" fill="none" stroke="#2a7fc4" stroke-width="1.1" stroke-linejoin="round" opacity=".8"/>`)
    + gloss('M10.6 15.4 13.4 11.6', 2.4) + twinkle(20.5, 14.2, 2.4) + twinkle(41, 5.5, 3.4, '#ffe27a'),
  trophy:
    `<path d="M13.5 12H8.6Q7.6 21.4 17 23.4M34.5 12H39.4Q40.4 21.4 31 23.4" fill="none" stroke="${INK}" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="M13.5 12H8.6Q7.6 21.4 17 23.4M34.5 12H39.4Q40.4 21.4 31 23.4" fill="none" stroke="#ffc83d" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`
    + jelly('M21.4 27H26.6L27.6 33.5H20.4Z', 'gY', '#d98a10')
    + jelly('M12 8H36V15.5Q36 28.5 24 28.5 12 28.5 12 15.5Z', 'gY', '#d98a10', shade('M31.6 8H36V15.5Q36 28.5 24 28.5 31.4 25 31.6 8Z', '#f0a21c', .85)
      + `<polygon points="${star(23, 16.5, 5.4, 2.4)}" fill="#fff3b0" stroke="#c97a0a" stroke-width="1.3" stroke-linejoin="round"/>`)
    + jelly('M10.8 5.6H37.2Q38.6 5.6 38.6 7V8.4Q38.6 9.8 37.2 9.8H10.8Q9.4 9.8 9.4 8.4V7Q9.4 5.6 10.8 5.6Z', 'gY', '#d98a10', '', { dy: 1.6, dx: 1 })
    + jelly('M15.5 33H32.5Q35 33 35 35.5V40.5Q35 43 32.5 43H15.5Q13 43 13 40.5V35.5Q13 33 15.5 33Z', 'gV', '#5d47d6', shade('M13 39.6H35V40.5Q35 43 32.5 43H15.5Q13 43 13 40.5Z', '#6d58e6', .8)
      + `<rect x="18.5" y="35.6" width="11" height="3.6" rx="1.2" fill="#fff3b0" stroke="#5d47d6" stroke-width="1.1"/>`)
    + gloss('M15.6 12.4V16.2Q15.8 21.6 18.8 24.4', 2.6) + twinkle(40, 29, 3),
  volcano:
    jelly('M15.4 15.6A3.8 3.8 0 0 1 18.2 9.2 5.6 5.6 0 0 1 28.8 7.6 4.2 4.2 0 0 1 35 12.6 3.4 3.4 0 0 1 32.8 17H17.4A2.6 2.6 0 0 1 15.4 15.6Z', 'gW', '#aebccb', gloss('M19.6 10.6Q21.6 7.6 25 7.8', 2.2))
    + jelly('M4.5 43Q4 40.8 5.6 38.6L16.6 21Q17.6 19.4 19.6 19.4H28.4Q30.4 19.4 31.4 21L42.4 38.6Q44 40.8 43.5 43Z', 'gK', '#8a5636',
      shade('M31.4 21 42.4 38.6Q44 40.8 43.5 43H35.5Z', '#9a6a46', .8) + `<path d="M12 36.5 14.8 32M37.5 39 34.8 34.6" fill="none" stroke="#8a5636" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`)
    + jelly('M16.9 20.6Q17.9 19.4 19.6 19.4H28.4Q30.1 19.4 31.1 20.6L29.9 23.6Q29.1 25.6 27.7 24.4 27 28 25.4 28 23.9 28 23.8 25.1 22.6 26.6 21.4 25.4 20.5 24.4 20.6 22.9 18.8 23.8 17.6 22.4Z', 'gL', '#d9472a', '', { dy: 1.2, dx: .6 })
    + gloss('M19.4 21.4H25', 1.8) + gloss('M12.6 32.4 16.4 26.2', 2.4)
    + `<circle cx="10.5" cy="20" r="1.7" fill="#ff8a3d" stroke="${INK}" stroke-width="1.2"/><circle cx="38" cy="22" r="1.3" fill="#ffc83d" stroke="${INK}" stroke-width="1.1"/>`,
  pencil: `<g transform="rotate(-38 24 24)">`
    + jelly('M4.5 18.5H33L44.5 24 33 29.5H4.5Q2.5 29.5 2.5 27.5V20.5Q2.5 18.5 4.5 18.5Z', 'gY', '#c48a1c',
      `<path d="M9 18.5H33V22H9Z" fill="#fff3b0"/><path d="M9 26H33V29.5H9Z" fill="#f0a21c"/>`
      + `<path d="M4.5 18.5H9.5V29.5H4.5Q2.5 29.5 2.5 27.5V20.5Q2.5 18.5 4.5 18.5Z" fill="url(#gN)"/>`
      + `<path d="M8.5 18.5H13V29.5H8.5Z" fill="url(#gS)"/><path d="M10 18.5V29.5M11.6 18.5V29.5" stroke="#9aa7b4" stroke-width=".9"/>`
      + `<path d="M33 18.5 44.5 24 33 29.5Z" fill="#f8dcb4"/><path d="M33 26 44.5 24 33 29.5Z" fill="#e8c08e"/><path d="M40.4 22.1 44.5 24 40.4 25.9Z" fill="${INK}"/>`
      + `<path d="M8.5 18.5V29.5M13 18.5V29.5M33 18.5V29.5" stroke="${INK}" stroke-width="1.4"/>`)
    + gloss('M15.5 20.4H30', 2) + `</g>`,
  badge:
    jelly('M15 3H33V15.5L24 21.5 15 15.5Z', 'gB', '#2a7fc4',
      `<path d="M19.4 3H22.4V18.4L19.4 16.4ZM25.6 3H28.6V16.4L25.6 18.4Z" fill="#fff" opacity=".9"/>` + shade('M29.4 3H33V15.5L29.4 17.9Z', '#3a92d8', .7))
    + jelly(starD(24, 32.5, 13.5, 6.8), 'gY', '#d98a10', shade('M30.4 33 37.4 28.3 31.5 36.7 32.5 44.2 24 40.5Z', '#f0a21c', .7)
      + `<circle cx="24" cy="32.8" r="4.6" fill="#fff3b0" stroke="#c97a0a" stroke-width="1.4"/>`)
    + gloss('M17.4 28.4 20.6 28', 2.4) + twinkle(39, 21, 2.8),

  /* ----- 프로필 사진: 캐릭터 (CHARACTER_GUIDE — 외곽선은 몸 색을 진하게, 남색 금지) ----- */
  lion: jelly(scallop(24, 25.5, 17, 14, 4.2), 'cMa', '#c76a24', shade('M38 18A17 17 0 0 1 30 41 15 15 0 0 0 38 18Z', '#d9772c', .6), { line: '#b8611f', dx: 1, dy: 1.8 })
    + `<circle cx="14.6" cy="14.6" r="3.8" fill="url(#cLi)" stroke="#c98a30" stroke-width="2"/><circle cx="33.4" cy="14.6" r="3.8" fill="url(#cLi)" stroke="#c98a30" stroke-width="2"/>`
    + `<circle cx="14.6" cy="14.8" r="1.7" fill="#ffb2a0"/><circle cx="33.4" cy="14.8" r="1.7" fill="#ffb2a0"/>`
    + jelly(mochi(24, 27, 23, 22), 'cLi', '#e0a640', shade('M34.4 28C34.4 34 30 38.6 24 38.8 30.8 37 33.4 32.6 34.4 28Z', '#f2b84c', .7), { line: '#c98a30', flat: true })
    + eyes(19.3, 28.7, 28) + blush(15.6, 32.4, 32.3)
    + `<path d="M22.6 31.4H25.4Q25.6 31.4 25.4 31.7L24.2 33Q24 33.2 23.8 33L22.6 31.7Q22.4 31.4 22.6 31.4Z" fill="#a8604a" stroke="#a8604a" stroke-width=".8" stroke-linejoin="round"/>`
    + mouthW(24, 33.6, 1.9, '#a8604a') + gloss('M16 22.4Q17.8 19.6 21 18.8', 2.2, .7),
  dragon:
    `<path d="M15.6 15.4Q11.8 10.6 12.6 5.4 17.2 7.6 19.2 12.6" fill="#fff1c4" stroke="#c9a24a" stroke-width="2" stroke-linejoin="round"/><path d="M32.4 15.4Q36.2 10.6 35.4 5.4 30.8 7.6 28.8 12.6" fill="#fff1c4" stroke="#c9a24a" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M8.6 25.4 3.2 21.2 9.8 20.2ZM39.4 25.4 44.8 21.2 38.2 20.2Z" fill="#a8e897" stroke="#4f9e4a" stroke-width="2" stroke-linejoin="round"/>`
    + jelly(mochi(24, 27, 30, 28), 'cDr', '#4f9e4a', shade('M38.4 27C38.4 35.6 32 41.4 24 41.6 33.4 39 37 33.4 38.4 27Z', '#5cbf5f', .55)
      + `<path d="M17 33.4C17 30 20.4 29 24 29S31 30 31 33.4 27.4 38.4 24 38.4 17 36.8 17 33.4Z" fill="#e9fbd8"/>`, { line: '#4f9e4a', flat: true })
    + `<path d="M19.6 13.2 22 8.8 24 12.4 26 8.8 28.4 13.2" fill="#ffd36a" stroke="#d99a2a" stroke-width="1.8" stroke-linejoin="round"/>`
    + eyes(18.4, 29.6, 25.6, 2.7, 3.3) + blush(14.2, 33.8, 30.2)
    + `<circle cx="22.3" cy="31.4" r=".8" fill="#4f9e4a"/><circle cx="25.7" cy="31.4" r=".8" fill="#4f9e4a"/>` + mouthW(24, 34, 1.8, '#3b6e3a')
    + gloss('M13.6 20.6Q16 15.8 21 14.6', 2.4, .7),
  star:
    `<polygon points="${star(24, 26.5, 21, 11)}" fill="#e0a21c" stroke="#e0a21c" stroke-width="6" stroke-linejoin="round" transform="translate(1 1.8)"/>`
    + `<polygon points="${star(24, 26.5, 21, 11)}" fill="#d9930f" stroke="#d9930f" stroke-width="6" stroke-linejoin="round"/>`
    + `<polygon points="${star(24, 26.5, 21, 11)}" fill="url(#cSt)" stroke="url(#cSt)" stroke-width="2.6" stroke-linejoin="round"/>`
    + eyes(19.6, 28.4, 28.4, 2.3, 2.9) + blush(16.4, 31.6, 32.2, 2.6, 1.6) + mouthW(24, 32.4, 1.7)
    + gloss('M14.6 22.6 19.4 22.2M23.4 9.6 21.8 14', 2.4, .75) + twinkle(41.5, 8.5, 3.4, '#ffe27a') + twinkle(6.5, 41, 2.6, '#ffe27a'),
  firework: (() => {
    const C = [['gR', '#c4424f'], ['gY', '#d98a10'], ['gB', '#2a7fc4'], ['gG', '#3f9a3a'], ['gV', '#5d47d6'], ['gN', '#d9577e'], ['gP', '#c45f2e'], ['gM', '#2c9c7a']];
    const drop = 'M24 3.6C25.8 7.6 27 9.8 27 12.2 27 14.1 25.7 15.4 24 15.4S21 14.1 21 12.2C21 9.8 22.2 7.6 24 3.6Z';
    const rays = C.map(([g, dk], i) => `<g transform="rotate(${i * 45} 24 24)">${jelly(drop, g, dk, '', { dx: .8, dy: 1.4, sw: 1.8 })}</g>`).join('');
    const dots = C.map(([g], i) => { const a = (i * 45 + 22.5 - 90) * Math.PI / 180; return `<circle cx="${n1(24 + Math.cos(a) * 15.5)}" cy="${n1(24 + Math.sin(a) * 15.5)}" r="1.5" fill="url(#${g})" stroke="${INK}" stroke-width="1"/>`; }).join('');
    return rays + dots + jelly(starD(24, 24, 6.4, 3, 4, -90), 'gY', '#d98a10', '', { dx: .8, dy: 1.2, sw: 1.8 });
  })(),
  owl:
    `<path d="M12.6 13.4 10.4 5.2 18 9.6ZM35.4 13.4 37.6 5.2 30 9.6Z" fill="#c99a72" stroke="#8a5f3e" stroke-width="2" stroke-linejoin="round"/>`
    + jelly(mochi(24, 26, 31, 30), 'cOw', '#8a5f3e', shade('M38.8 26.5C38.8 35.6 32.6 41.6 24 41.8 33.6 39 37.6 33.4 38.8 26.5Z', '#a87650', .6), { line: '#8a5f3e', flat: true })
    + `<path d="M24 19.2C21 15.2 12.6 15.6 12.6 23 12.6 30.2 19.4 33.8 24 37 28.6 33.8 35.4 30.2 35.4 23 35.4 15.6 27 15.2 24 19.2Z" fill="url(#cOd)" stroke="#c99a72" stroke-width="1.6"/>`
    + `<circle cx="18.4" cy="24.4" r="5" fill="#fff" stroke="#c99a72" stroke-width="1.4"/><circle cx="29.6" cy="24.4" r="5" fill="#fff" stroke="#c99a72" stroke-width="1.4"/>`
    + eyes(18.8, 29.2, 25, 2.6, 3.2) + `<path d="M22.2 29.6H25.8L24 32.6Z" fill="#ffb03d" stroke="#d98a10" stroke-width="1.2" stroke-linejoin="round"/>` + blush(13.6, 34.4, 31.4, 2.4, 1.5)
    + gloss('M13.4 16.6Q16 12.4 21 11.6', 2.2, .7),
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
const VB = {"sprout": "2.4 3.6 45.8 45.8", "medal": "0.3 0.4 49.0 49.0", "gem": "2.4 4.5 44.8 44.8", "trophy": "1.3 3.0 45.4 45.4", "volcano": "1.5 1.8 46.6 46.6", "pencil": "1.1 0.9 48.1 48.1", "badge": "0.6 0.4 48.4 48.4", "lion": "2.4 4.3 44.2 44.2", "dragon": "0.6 0.1 46.8 46.8", "star": "1.4 2.3 46.2 46.2", "firework": "1.0 1.0 46.0 46.0", "owl": "3.1 2.6 41.8 41.8", "whale": "2.4 -0.1 45.5 45.5"};
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
export const ART_KEYS = Object.keys(ART);
export const isArt = v => typeof v === 'string' && v.startsWith('r:') && !!ART[v.slice(2)];
export const artOf = (v, cls = '') => { if (!isArt(v)) return ''; ensureSprite(); return `<svg class="art ${cls}" aria-hidden="true"><use href="#art-${v.slice(2)}" width="100%" height="100%"/></svg>`; };
// 프로필 사진·스티커 값 → 그림(직접 그린 것) 또는 글자(예전 이모지)
export const emo = (v, cls = '') => isArt(v) ? artOf(v, cls) : esc(v);
export const ui = (k, cls = '') => { ensureSprite(); return `<svg class="att-ic ${cls}" viewBox="-1 -1 26 26" aria-hidden="true">${UI[k]}</svg>`; };
