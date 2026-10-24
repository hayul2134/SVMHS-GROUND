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
  gK2: ['#3a5478', '#15263d'], gPa: ['#fff6e6', '#f2d3a8'], gLg: ['#9fdcff', '#38a5ea'],
  tBl: ['#e3f4ff', '#9fd4f7'], tPk: ['#fff0f5', '#ffc3d6'], tNt: ['#2a3a7a', '#4d5fb0'], tGd: ['#fff6c8', '#ffd66a'], tGx: ['#3a2f86', '#18164a'],
};
const DEFS = Object.entries(GR).map(([k, [a, b]]) => `<linearGradient id="${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')
  // 홀로그램(나비 날개): 분홍→하늘→보라→노랑 대각선 (gH2는 반대 방향)
  + '<linearGradient id="gH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3e6"/><stop offset=".35" stop-color="#94d8ff"/><stop offset=".7" stop-color="#b39cff"/><stop offset="1" stop-color="#ffe98a"/></linearGradient>'
  + '<radialGradient id="wh-fade"><stop offset=".05" stop-color="#fff"/><stop offset=".75" stop-color="#fff" stop-opacity="0"/></radialGradient>'
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

// ===== 보상 그림 4차 (2026-10-24 하율: "일반 학교 오브젝트 + 콘텐츠과·미디어과·프로듀스과 특성, 학과끼리 공평하게") =====
// 학교 공통 물건은 하나씩, 학과 물건은 항상 세 과가 '같은 날 함께' 풀림(세트) → 어느 과가 먼저라는 불만이 없게.
// 콘과(영상콘텐츠과: 방송·영화 연출·촬영·편집·조명) / 미과(영상미디어과: 애니메이션·디자인·3D·캐릭터·색채) / 프과(영상프로듀스과: 후반 작업 — 편집·사운드·색보정, 2026-10-24 하율 정정)
const STARS = (pts, c = '#fff') => `<g fill="${c}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
// 학과 상징(48×48, 젤리 스티커) — 스티커로도 쓰고 씰(프로필 사진) 안에도 넣음
const EM = {
  /* 콘과 */
  slate:
    jelly('M7 19.6H41Q42.8 19.6 42.8 21.4V39.6Q42.8 42 40.4 42H9.4Q7 42 7 39.6Z', 'gK2', '#0f1f33',
      `<path d="M11.6 25.4H24M11.6 30.4H20M27.4 25.4H38M27.4 30.4H35M11.6 36H38" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".85"/><path d="M25.6 23.4V38.4" stroke="#fff" stroke-width="1" opacity=".5"/>`)
    + `<g transform="rotate(-13 8 18)">` + jelly('M7 12.6H41.6Q42.8 12.6 42.8 13.8V18.4H7Z', 'gW', '#aebccb',
      `<path d="M12 12.6 15.2 18.4H20.6L17.4 12.6ZM23 12.6 26.2 18.4H31.6L28.4 12.6ZM34 12.6 37.2 18.4H42.6V17.6L39.4 12.6Z" fill="#1d3550"/>`, { dx: .8, dy: 1.4 }) + `</g>`
    + `<circle cx="9" cy="19" r="2" fill="#ffc83d" stroke="${INK}" stroke-width="1.2"/>` + gloss('M10.6 23V30', 2, .5),
  light:
    `<path d="M24 30V42M24 42 15 46M24 42 33 46M24 42V46.4" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M24 30V42M24 42 15 46M24 42 33 46" stroke="#8d9aa8" stroke-width="1.6" stroke-linecap="round"/>`
    + `<path d="M32 9.6 46 3V25.4L32 19.6Z" fill="#fff3b0" opacity=".55"/>`
    + `<g transform="rotate(-12 21 15)">` + jelly('M8.6 8.4H28.4Q32 8.4 32 12V20Q32 23.6 28.4 23.6H8.6Q5 23.6 5 20V12Q5 8.4 8.6 8.4Z', 'gK2', '#0f1f33', `<path d="M9.6 11.6V20.4M13.6 11.6V20.4" stroke="#4a6488" stroke-width="1.4" stroke-linecap="round"/>`)
    + jelly('M30.4 7.6H34Q35.6 7.6 35.6 9.2V22.8Q35.6 24.4 34 24.4H30.4Z', 'gY', '#d98a10', `<ellipse cx="33" cy="16" rx="1.4" ry="5.4" fill="#fffbe0"/>`, { dx: .6, dy: 1 }) + `</g>`
    + `<path d="M17.8 24.4 24 30 30.2 24.4" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` + gloss('M9 12.6Q10.4 10.4 13.4 10.2', 2, .7) + twinkle(43.4, 34, 2.6, '#fff3b0'),
  filmcam:
    jelly('M15.6 4.6A6.6 6.6 0 1 1 15.59 4.6Z', 'gK2', '#0f1f33', STARS([[15.6, 8.4, 1.3], [12.4, 12.6, 1.3], [18.8, 12.6, 1.3]], '#7fa3cc'), { dx: .8, dy: 1.4 })
    + jelly('M29.6 2.8A7.6 7.6 0 1 1 29.59 2.8Z', 'gK2', '#0f1f33', STARS([[29.6, 7, 1.5], [26, 11.8, 1.5], [33.2, 11.8, 1.5]], '#7fa3cc'), { dx: .8, dy: 1.4 })
    + jelly('M36.4 25 45 20.4V37.6L36.4 33Z', 'gS', '#7d8b9a', '', { dx: .8, dy: 1.4 })
    + jelly('M7.4 19.4H34Q37.4 19.4 37.4 22.8V36.4Q37.4 39.8 34 39.8H7.4Q4 39.8 4 36.4V22.8Q4 19.4 7.4 19.4Z', 'gB', '#2a7fc4',
      shade('M37.4 30V36.4Q37.4 39.8 34 39.8H7.4Q4 39.8 4 36.4V35Q20 37 37.4 30Z', '#3a92d8', .7)
      + `<circle cx="11" cy="26" r="2" fill="#f0646d" stroke="${INK}" stroke-width="1"/><rect x="18" y="24" width="14" height="6" rx="1.6" fill="#173048" opacity=".85"/><path d="M19.8 27H29" stroke="#9fdcff" stroke-width="1.2" stroke-linecap="round"/>`)
    + gloss('M7.6 33V24.6Q7.8 22.8 9.6 22.8', 2.2) + `<path d="M12 39.8 9 46M29 39.8 32 46" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
  /* 미과 */
  palette:
    jelly('M24 6.6C35.4 6.6 43.4 13.4 43.4 22.2 43.4 28 38.8 30.2 34.8 29.6 31.4 29 29.6 31.6 30.8 34.8 32.2 38.6 29.4 41.6 24 41.6 13 41.6 4.6 33 4.6 24 4.6 14.4 13 6.6 24 6.6Z', 'gPa', '#c9935a',
      shade('M43.4 22.2C43.4 28 38.8 30.2 34.8 29.6 38.6 28.4 41.8 25.6 43.4 22.2Z', '#e0b07a', .8)
      + [['gR', '#c4424f', 13.4, 17.6], ['gY', '#d98a10', 21.4, 13], ['gB', '#2a7fc4', 30.4, 13.4], ['gG', '#3f9a3a', 36.6, 20.6], ['gN', '#d9577e', 12, 27.6]].map(([g, d, x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="url(#${g})" stroke="${d}" stroke-width="1.2"/><circle cx="${x - 1}" cy="${y - 1.1}" r="1" fill="#fff" opacity=".9"/>`).join(''))
    + `<g transform="rotate(38 30 33)"><rect x="27.6" y="18" width="4.8" height="22" rx="2.4" fill="#ffd36a" stroke="${INK}" stroke-width="1.6"/><path d="M27.6 21.6H32.4V25H27.6Z" fill="#c3ced9" stroke="${INK}" stroke-width="1.2"/><path d="M28 18.4Q30 9 32 18.4Z" fill="#7b5cff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/></g>`
    + gloss('M9.6 19.6Q11.6 13.4 17.6 10.6', 2.4),
  cube:
    `<path d="M24 5.6 41 15.4V34.6L24 44.4 7 34.6V15.4Z" transform="translate(1.4 2.4)" fill="#2f6aa8" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<path d="M24 5.6 41 15.4 24 25.2 7 15.4Z" fill="url(#gM)"/><path d="M7 15.4 24 25.2V44.4L7 34.6Z" fill="url(#gB)"/><path d="M41 15.4 24 25.2V44.4L41 34.6Z" fill="url(#gV)"/>`
    + `<path d="M24 5.6 41 15.4V34.6L24 44.4 7 34.6V15.4ZM7 15.4 24 25.2 41 15.4M24 25.2V44.4" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<path d="M15.5 10.5 32.5 20.3M32.5 10.5 15.5 20.3M15.5 20.3V39.5M32.5 20.3V39.5" stroke="#fff" stroke-width=".9" stroke-dasharray="1.6 1.8" opacity=".6"/>`
    + STARS([[24, 5.6, 1.6], [41, 15.4, 1.6], [7, 15.4, 1.6], [24, 25.2, 1.6]], '#ffc83d') + gloss('M10 19.6V27.6', 2.2, .7) + twinkle(43.4, 6.4, 2.8, '#fff3b0'),
  tablet:
    jelly('M7.6 10.4H40.4Q44 10.4 44 14V34Q44 37.6 40.4 37.6H7.6Q4 37.6 4 34V14Q4 10.4 7.6 10.4Z', 'gK2', '#0f1f33',
      `<rect x="9" y="14.6" width="30" height="18.8" rx="2" fill="url(#gW)"/><path d="M13 29Q16 18 21 24T29.6 20.4" fill="none" stroke="#7b5cff" stroke-width="2.2" stroke-linecap="round"/><circle cx="33.4" cy="19.4" r="2.6" fill="#ffc83d"/><path d="M41.6 18.6V29.4" stroke="#4a6488" stroke-width="1.6" stroke-linecap="round"/>`)
    + `<g transform="rotate(-40 34 30)"><rect x="31.8" y="19" width="4.4" height="24" rx="2.2" fill="url(#gN)" stroke="${INK}" stroke-width="1.6"/><path d="M31.8 40 34 46.4 36.2 40Z" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M33 22V30" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></g>`
    + gloss('M7.6 30V15.2Q7.8 13.6 9.6 13.6', 1.8, .5),
  /* 프과 */
  timeline:   // 편집 타임라인: 영상 클립 두 줄 + 오디오 파형 + 빨간 재생헤드
    jelly('M7.6 8H40.4Q44 8 44 11.6V36.4Q44 40 40.4 40H7.6Q4 40 4 36.4V11.6Q4 8 7.6 8Z', 'gK2', '#0f1f33',
      `<path d="M8 13.4H40" stroke="#4a6488" stroke-width="1" stroke-dasharray="1 2.4"/>`
      + jelly('M8.4 15.8H21.6V21.6H8.4Z', 'gB', '#2a7fc4', '', { dx: .4, dy: .8, sw: 1.3 }) + jelly('M23.4 15.8H39.6V21.6H23.4Z', 'gV', '#5d47d6', '', { dx: .4, dy: .8, sw: 1.3 })
      + jelly('M8.4 24.2H16.6V30H8.4Z', 'gN', '#d9577e', '', { dx: .4, dy: .8, sw: 1.3 }) + jelly('M18.4 24.2H34V30H18.4Z', 'gB', '#2a7fc4', '', { dx: .4, dy: .8, sw: 1.3 })
      + jelly('M8.4 32.4H39.6V36.4H8.4Z', 'gM', '#2c9c7a', `<path d="M10 34.4H12M12 33.2V35.6M14 32.9V35.9M16 33.6V35.2M18 32.8V36M20 33.4V35.4M22 33V35.8M24 33.8V35M26 32.9V35.9M28 33.4V35.4M30 33V35.8M32 33.6V35.2M34 33.1V35.7M36 33.5V35.3M38 34.4" stroke="#1d6b55" stroke-width="1" stroke-linecap="round"/>`, { dx: .4, dy: .8, sw: 1.3 }))
    + `<path d="M28.4 11.6V39.4" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M28.4 11.6V39.4" stroke="#f0646d" stroke-width="1.6" stroke-linecap="round"/>`
    + jelly('M24.6 4.4H32.2V8.6L28.4 12.2 24.6 8.6Z', 'gR', '#c4424f', '', { dx: .5, dy: .9, sw: 1.6 })
    + gloss('M7.6 33V12.8Q7.8 11.4 9.4 11.2', 1.6, .45) + twinkle(44.2, 5.4, 2.6, '#fff3b0'),
  headset:   // 사운드 믹싱 헤드폰
    `<path d="M8.6 28V22.4A15.4 15.4 0 0 1 39.4 22.4V28" fill="none" stroke="${INK}" stroke-width="7.2" stroke-linecap="round"/><path d="M8.6 28V22.4A15.4 15.4 0 0 1 39.4 22.4V28" fill="none" stroke="url(#gS)" stroke-width="3.6" stroke-linecap="round"/>`
    + `<path d="M13.4 13.6Q17.6 9.4 24 9" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>`
    + jelly('M7.6 25.4H12.6Q15 25.4 15 27.8V39.2Q15 41.6 12.6 41.6H7.6Q4 41.6 4 38V29Q4 25.4 7.6 25.4Z', 'gV', '#5d47d6', `<path d="M12.4 27.6V39.4" stroke="#b39cff" stroke-width="2.2" stroke-linecap="round"/>`)
    + jelly('M35.4 25.4H40.4Q44 25.4 44 29V38Q44 41.6 40.4 41.6H35.4Q33 41.6 33 39.2V27.8Q33 25.4 35.4 25.4Z', 'gV', '#5d47d6', `<path d="M35.6 27.6V39.4" stroke="#b39cff" stroke-width="2.2" stroke-linecap="round"/><circle cx="39.6" cy="33.4" r="2" fill="#f0646d" stroke="${INK}" stroke-width="1"/>`)
    + `<path d="M19 30.4V36.4M22.4 27.6V39.2M25.8 29.4V37.4M29.2 31.6V35.2" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" class="tw"/><path d="M19 30.4V36.4M22.4 27.6V39.2M25.8 29.4V37.4M29.2 31.6V35.2" stroke="#47c9a0" stroke-width="1.6" stroke-linecap="round" class="tw"/>`
    + gloss('M7 36V30.4Q7.2 28.4 9 28.2', 1.8, .7),
  wheel:   // 색보정 컬러 휠 (씰 안)
    `<circle cx="25.4" cy="26.6" r="17" fill="${INK}"/>`
    + [['#ff6a6a', 0], ['#ffc83d', 60], ['#7ee07a', 120], ['#4fd2e8', 180], ['#4a8cef', 240], ['#d86af0', 300]].map(([c, r]) => `<path d="M24 24 24 7A17 17 0 0 1 38.72 15.5Z" fill="${c}" transform="rotate(${r} 24 24)"/>`).join('')
    + `<circle cx="24" cy="24" r="17" fill="url(#wh-fade)"/><circle cx="24" cy="24" r="17" fill="none" stroke="${INK}" stroke-width="2.2"/>`
    + `<path d="M24 12V36M12 24H36" stroke="#fff" stroke-width=".9" opacity=".7"/><circle cx="28.6" cy="19.4" r="3.4" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="28.6" cy="19.4" r="1.1" fill="${INK}"/>`
    + gloss('M11.4 19.4Q13.4 12.8 19.6 10.2', 2.4, .75),
  /* G 로고 (학교 공통 씰 안) */
  glogo: `<g transform="translate(.4 .4) scale(.236)"><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" transform="translate(1.8 3.6)" fill="none" stroke="${INK}" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"/><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" fill="none" stroke="#1f73c4" stroke-width="29" stroke-linecap="round" stroke-linejoin="round" transform="translate(-.6 -1.2)"/><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" transform="translate(-3 -6)" fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" transform="translate(-3 -6)" fill="none" stroke="url(#gLg)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="M68 76Q78 60 98 58" transform="translate(-3 -6)" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"/></g>`,
};
// 씰(프로필 사진): 로고와 같은 흰 판 + 남색 테 + 딱딱한 그림자. 등급: blue(기본) · pink · night · gold · galaxy
const TIER = {
  blue: { bg: 'tBl', ring: INK, deco: `<g fill="#fff" opacity=".9"><ellipse cx="10" cy="14" rx="5" ry="2.4"/><ellipse cx="13" cy="12.8" rx="3" ry="2.4"/><ellipse cx="38" cy="36" rx="4.4" ry="2"/></g>` },
  pink: { bg: 'tPk', ring: INK, deco: `<g fill="#fff">${[[10, 13, 20], [38, 12, -30], [11, 36, 50], [38, 35, 10]].map(([x, y, r]) => `<path d="M${x} ${y - 1.8}Q${x + 1.6} ${y} ${x} ${y + 1.8}Q${x - 1.6} ${y} ${x} ${y - 1.8}Z" transform="rotate(${r} ${x} ${y})" opacity=".95"/>`).join('')}</g>` },
  night: { bg: 'tNt', ring: INK, deco: STARS([[10, 12, .7], [16, 8, .5], [8, 30, .5], [40, 30, .6], [37, 9, .5], [33, 40, .4]]) },
  gold: { bg: 'tGd', ring: '#ffc83d', deco: `<g fill="#fff" opacity=".85">${[[9, 14], [39, 15], [11, 35], [38, 35]].map(([x, y]) => `<path d="M${x} ${y - 2}L${x + .6} ${y - .6}${x + 2} ${y}${x + .6} ${y + .6}${x} ${y + 2}${x - .6} ${y + .6}${x - 2} ${y}${x - .6} ${y - .6}Z"/>`).join('')}</g>`, top: jelly(starD(24, 3.4, 4.6, 2), 'gY', '#d98a10', '', { dx: .5, dy: .9, sw: 1.4 }) },
  galaxy: { bg: 'tGx', ring: '#b39cff', deco: `<ellipse cx="14" cy="14" rx="14" ry="7" fill="#ff8fd8" opacity=".3" transform="rotate(-24 14 14)"/><ellipse cx="36" cy="34" rx="14" ry="6" fill="#7cc8ff" opacity=".28" transform="rotate(-24 36 34)"/>` + STARS([[9, 12, .6], [15, 7, .5], [36, 9, .7], [41, 18, .5], [7, 26, .5], [40, 32, .5], [12, 38, .5]]) + `<path d="M5 7 13 12" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>`, top: jelly(starD(24, 3.4, 4.6, 2), 'gV', '#5d47d6', '', { dx: .5, dy: .9, sw: 1.4 }) },
};
const seal = (k, em, tier) => { const t = TIER[tier];
  return `<circle cx="25.2" cy="26" r="22" fill="${INK}"/><circle cx="24" cy="24" r="22" fill="#fff" stroke="${INK}" stroke-width="2"/>`
    + `<clipPath id="cl-${k}"><circle cx="24" cy="24" r="18.4"/></clipPath><g clip-path="url(#cl-${k})"><rect width="48" height="48" fill="url(#${t.bg})"/>${t.deco}</g>`
    + `<circle cx="24" cy="24" r="18.4" fill="none" stroke="${t.ring}" stroke-width="${t.ring === INK ? 1.4 : 2.4}"/>`
    + `<g transform="translate(24 24.6) scale(${em === 'glogo' ? .8 : em === 'wheel' ? .7 : .58}) translate(-24 -24)">${EM[em]}</g>${t.top || ''}`
    + `<path d="M9.2 16.4A16 16 0 0 1 17 8.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`;
};
const SEALS = {
  gblue: ['glogo', 'blue'], gpink: ['glogo', 'pink'], gnight: ['glogo', 'night'],
  conblue: ['filmcam', 'blue'], medblue: ['tablet', 'blue'], problue: ['wheel', 'blue'],
  congold: ['filmcam', 'gold'], medgold: ['tablet', 'gold'], progold: ['wheel', 'gold'],
  congx: ['filmcam', 'galaxy'], medgx: ['tablet', 'galaxy'], progx: ['wheel', 'galaxy'],
};
export const SCENES = new Set(Object.keys(SEALS));

/* ===== 보상 그림 (48×48) ===== */
const ART = {
  /* ----- 학교 공통 스티커 ----- */
  bell: `<path d="M24 3.6V8" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M24 3.6V8" stroke="#ffc83d" stroke-width="1.8" stroke-linecap="round"/>`
    + jelly('M24 7.6C32.6 7.6 35.4 14.6 35.4 22.6V29.4L40 34.6Q41 36.2 39.2 36.2H8.8Q7 36.2 8 34.6L12.6 29.4V22.6C12.6 14.6 15.4 7.6 24 7.6Z', 'gY', '#d98a10',
      shade('M35.4 22.6V29.4L40 34.6Q41 36.2 39.2 36.2H30.6Q34.8 30 32.2 13.4 35.4 16.8 35.4 22.6Z', '#f0a21c', .8)
      + `<path d="M12.6 29.4H35.4" stroke="#d98a10" stroke-width="1.4" opacity=".7"/>`)
    + jelly('M24 36.2A4.6 4.6 0 0 1 24 45.4 4.6 4.6 0 0 1 24 36.2Z', 'gB', '#2a7fc4', '', { dx: .6, dy: 1, sw: 1.8 })
    + gloss('M16.4 26.6V21.4Q16.8 15 20.6 12.2', 2.8) + `<path d="M5.6 15.6Q3.4 19.6 5 24M42.4 15.6Q44.6 19.6 43 24" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" class="tw"/>`
    + twinkle(42, 6, 3, '#c6ebff'),
  clock: `<path d="M9.6 14.8A6.4 6.4 0 0 1 18.4 6.6M38.4 14.8A6.4 6.4 0 0 0 29.6 6.6" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M9.6 14.8A6.4 6.4 0 0 1 18.4 6.6M38.4 14.8A6.4 6.4 0 0 0 29.6 6.6" fill="none" stroke="#ffc83d" stroke-width="3.2" stroke-linecap="round"/>`
    + `<path d="M14.6 40.6 11.4 44.4M33.4 40.6 36.6 44.4" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`
    + jelly('M24 8.4A16.4 16.4 0 1 1 23.99 8.4Z', 'gB', '#2a7fc4', shade('M35.4 13.4A16.4 16.4 0 0 1 18.4 40.2 15.6 15.6 0 0 0 35.4 13.4Z', '#3a92d8', .8)
      + `<circle cx="24" cy="24.8" r="12" fill="#fffdf6" stroke="${INK}" stroke-width="1.6"/>`
      + `<g stroke="${INK}" stroke-width="1.4" stroke-linecap="round"><path d="M24 14.6V16.6M24 33V35M13.8 24.8H15.8M32.2 24.8H34.2"/></g>`
      + `<path d="M24 24.8V18.4M24 24.8 28.8 27.4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><circle cx="24" cy="24.8" r="1.6" fill="#f0646d" stroke="${INK}" stroke-width="1"/>`)
    + jelly('M21.4 4.6H26.6Q27.6 4.6 27.6 5.6V8.6H20.4V5.6Q20.4 4.6 21.4 4.6Z', 'gY', '#d98a10', '', { dx: .6, dy: 1, sw: 1.8 })
    + gloss('M11.6 20.6Q13 15.2 17.6 12.4', 2.6) + twinkle(43, 26, 2.8, '#fff3b0'),
  gseal: `<circle cx="25.2" cy="26.4" r="19" fill="${INK}"/><circle cx="24" cy="24" r="19" fill="#fff" stroke="${INK}" stroke-width="2"/>`
    + `<g transform="translate(.4 .4) scale(.236)"><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" transform="translate(1.8 3.6)" fill="none" stroke="${INK}" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"/><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" fill="none" stroke="#1f73c4" stroke-width="29" stroke-linecap="round" stroke-linejoin="round" transform="translate(-.6 -1.2)"/><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" transform="translate(-3 -6)" fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M131.1 68.9A44 44 0 1 0 143.7 105H110" transform="translate(-3 -6)" fill="none" stroke="url(#gLg)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="M68 76Q78 60 98 58" transform="translate(-3 -6)" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"/></g>`
    + `<rect x="3" y="4.6" width="17" height="6" rx="1" transform="rotate(-24 11.5 7.6)" fill="#ffe27a" opacity=".85" stroke="${INK}" stroke-width="1.1"/>`
    + jelly(starD(39.4, 9.6, 6, 2.6), 'gY', '#d98a10', '', { dx: .6, dy: 1, sw: 1.6 }) + twinkle(43.6, 36, 2.6, '#c6ebff'),
  tray:
    jelly('M8 9H40Q44 9 44 13V36Q44 40 40 40H8Q4 40 4 36V13Q4 9 8 9Z', 'gS', '#7d8b9a',
      `<rect x="8" y="12.6" width="14" height="11" rx="3" fill="#fff" stroke="#8d9aa8" stroke-width="1.2"/><rect x="26" y="12.6" width="14" height="11" rx="3" fill="#fff" stroke="#8d9aa8" stroke-width="1.2"/>`
      + `<rect x="8" y="26.4" width="9" height="10" rx="3" fill="#fff" stroke="#8d9aa8" stroke-width="1.2"/><rect x="19.4" y="26.4" width="9" height="10" rx="3" fill="#fff" stroke="#8d9aa8" stroke-width="1.2"/><rect x="30.8" y="26.4" width="9.2" height="10" rx="3" fill="#fff" stroke="#8d9aa8" stroke-width="1.2"/>`
      + `<ellipse cx="15" cy="18.6" rx="5.4" ry="3.6" fill="#fffdf6" stroke="#e3dccb" stroke-width="1"/><ellipse cx="33" cy="18.4" rx="5.6" ry="3.8" fill="url(#gP)"/><path d="M29.4 17.6Q33 15.6 36.6 17.6" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".7" fill="none"/>`
      + `<g fill="#f0646d"><circle cx="11" cy="31" r="1.6"/><circle cx="13.6" cy="32.6" r="1.4"/><circle cx="11.6" cy="34" r="1.2"/></g><g fill="#62c552"><ellipse cx="23.8" cy="30.6" rx="2.6" ry="1.4"/><ellipse cx="23.4" cy="33.4" rx="2.4" ry="1.3"/></g><circle cx="35.4" cy="31.4" r="3" fill="#ffc83d" stroke="#d98a10" stroke-width="1"/>`)
    + gloss('M7.6 33V14.6Q7.8 12.4 10 12.2', 1.6, .5) + twinkle(44.4, 6.4, 2.6, '#fff3b0'),
  nametag:
    `<path d="M24 3.4V9" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="3.6" r="2" fill="#ffc83d" stroke="${INK}" stroke-width="1.2"/>`
    + jelly('M8 9H40Q43.4 9 43.4 12.4V36.6Q43.4 40 40 40H8Q4.6 40 4.6 36.6V12.4Q4.6 9 8 9Z', 'gW', '#aebccb',
      `<path d="M4.6 12.4Q4.6 9 8 9H40Q43.4 9 43.4 12.4V17H4.6Z" fill="url(#gB)"/><text x="24" y="15.4" text-anchor="middle" font-family="Jua,sans-serif" font-size="5.2" fill="#fff">SVMHS</text>`
      + `<circle cx="13.6" cy="27.6" r="5.4" fill="url(#gLg)" stroke="${INK}" stroke-width="1.2"/><circle cx="13.6" cy="26" r="2" fill="#fff"/><path d="M10 31.4Q13.6 28.4 17.2 31.4" fill="#fff"/>`
      + `<path d="M22.4 24.6H37.6M22.4 29.4H34M22.4 34H30" stroke="#8d9aa8" stroke-width="2" stroke-linecap="round"/>`)
    + gloss('M8.6 21V35.4', 1.8, .4),
  note:
    jelly('M10 6H38Q41 6 41 9V39Q41 42 38 42H10Z', 'gB', '#2a7fc4', shade('M41 30V39Q41 42 38 42H10V38Q28 38 41 30Z', '#3a92d8', .7)
      + `<rect x="16" y="13" width="20" height="9" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.2"/><path d="M19 16.4H33M19 19H28" stroke="#8d9aa8" stroke-width="1.2" stroke-linecap="round"/>`
      + jelly(starD(32, 32, 4.6, 2), 'gY', '#d98a10', '', { dx: .4, dy: .8, sw: 1.3 }))
    + `<g fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round">${[10, 16, 22, 28, 34].map(y => `<path d="M7.4 ${y}H12.6"/>`).join('')}</g><g fill="none" stroke="#c3ced9" stroke-width=".9" stroke-linecap="round">${[10, 16, 22, 28, 34].map(y => `<path d="M8 ${y - .5}H12"/>`).join('')}</g>`
    + gloss('M15 26V36', 2, .55) + twinkle(44, 10, 2.6, '#fff3b0'),
  /* ----- 학과 스티커 (세 과가 같은 날 함께) ----- */
  slate: EM.slate, palette: EM.palette, timeline: EM.timeline,
  light: EM.light, cube: EM.cube, headset: EM.headset,
  /* ----- 프로필 사진: 씰 (학교 공통 G · 학과 상징 — 등급만 다르고 세 과 모두 같은 날) ----- */
  ...Object.fromEntries(Object.entries(SEALS).map(([k, [em, t]]) => [k, seal(k, em, t)])),
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
const VB = {"bell": "0.8 1.0 48.0 48.0", "clock": "2.7 2.0 45.0 45.0", "gseal": "-0.5 -1.2 49.2 49.2", "tray": "1.4 2.5 46.8 46.8", "nametag": "1.6 -1.0 46.4 46.4", "note": "3.0 3.4 44.0 44.0", "slate": "2.5 2.1 45.3 45.3", "palette": "2.0 2.7 45.6 45.6", "timeline": "1.4 0.2 46.8 46.8", "headset": "1.4 2.3 46.8 46.8", "light": "0.6 0.4 48.6 48.6", "cube": "-0.0 1.4 48.0 48.0"};
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
