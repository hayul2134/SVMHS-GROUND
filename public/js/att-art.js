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
// ===== 뽑기 스티커 (2026-10-24 하율: "뽑기 같은 기능도 있으면 좋겠어") =====
// 출석 보상과 겹치지 않는 '뽑기에서만 나오는' 학교생활 물건. 학과 색이 없는 것만 → 어느 과든 똑같이 반가움.
// 일반(필통·가방 속 물건) · 희귀(쉬는 시간·매점) · 전설(홀로그램 G · 졸업장). 같은 젤리 스티커 규칙(ART_GUIDE).
const GA = {
  /* 일반 */
  eraser:   // 지우개: 분홍 고무 + 파란 종이 띠 + 지우개 가루
    `<g transform="rotate(-16 24 25)">`
    + jelly('M10.4 16H37.6Q40.4 16 40.4 18.8V31.2Q40.4 34 37.6 34H10.4Q7.6 34 7.6 31.2V18.8Q7.6 16 10.4 16Z', 'gN', '#d9577e',
      `<path d="M20.6 16H37.6Q40.4 16 40.4 18.8V31.2Q40.4 34 37.6 34H20.6Z" fill="url(#gB)" stroke="${INK}" stroke-width="1.6"/>`
      + `<path d="M24.4 21.4H36.4M24.4 25.4H33M24.4 29.2H30.4" stroke="#fff" stroke-width="1.7" stroke-linecap="round" opacity=".9"/>`
      + shade('M7.6 28.6Q14 30.8 20.6 29.4V34H10.4Q7.6 34 7.6 31.2Z', '#e9799b', .7))
    + gloss('M11.2 20.4V26.6', 2.2, .85) + `</g>`
    + `<g fill="#ffb3c8" stroke="${INK}" stroke-width=".9"><circle cx="8.6" cy="41.6" r="1.5"/><circle cx="13" cy="43.4" r="1.1"/><circle cx="5.4" cy="38" r=".9"/></g>`
    + twinkle(41.4, 9.6, 2.8, '#fff3b0'),
  hilite:   // 형광펜: 그어 둔 형광 줄 + 비스듬한 펜
    `<path d="M5 41.4H30.6" stroke="#e4ff5c" stroke-width="7" stroke-linecap="round" opacity=".9"/><path d="M5 41.4H30.6" stroke="#c9ee2a" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>`
    + `<g transform="rotate(-42 25 24)">`
    + jelly('M3.6 21.2 9.4 19.4V28.6L3.6 26.8Z', 'gY', '#c9a400', '', { dx: .6, dy: 1, sw: 1.7 })
    + jelly('M9.4 18.4H33.4V29.6H9.4Q8 29.6 8 28.2V19.8Q8 18.4 9.4 18.4Z', 'gW', '#aebccb',
      `<path d="M13 18.4H29V29.6H13Z" fill="#e8ff7a"/><path d="M15.4 22.6H26.6" stroke="#9ab800" stroke-width="1.6" stroke-linecap="round"/><path d="M15.4 25.6H22" stroke="#9ab800" stroke-width="1.6" stroke-linecap="round"/>`)
    + jelly('M33.4 17.2H42Q44.6 17.2 44.6 19.8V28.2Q44.6 30.8 42 30.8H33.4Z', 'gG', '#3f9a3a', `<path d="M36.6 17.2V12.6H39.4V17.2" fill="url(#gG)" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`)
    + gloss('M11.4 21.2H30.6', 1.8, .8) + `</g>`
    + twinkle(41.6, 39.4, 2.6, '#fff3b0'),
  postit:   // 포스트잇: 노란 메모 + 접힌 모서리 + 손글씨 하트
    `<g transform="rotate(-6 24 24)">`
    + jelly('M7 7H41V32.4L32.4 41H7Z', 'gY', '#d98a10',
      shade('M41 26 41 32.4 32.4 41H22Q36 36 41 26Z', '#f6b62c', .65)
      + `<path d="M12.4 15.4H33.4M12.4 21.2H29" stroke="#c98a1a" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>`
      + `<path d="M18.6 33.4C14.6 30.6 12.6 28.4 13.4 26.4 14.2 24.6 16.6 24.6 18.6 26.8 20.6 24.6 23 24.6 23.8 26.4 24.6 28.4 22.6 30.6 18.6 33.4Z" fill="#f0646d" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`)
    + jelly('M41 32.4H35Q32.4 32.4 32.4 35V41Z', 'gL', '#d9771a', '', { dx: .5, dy: .8, sw: 1.8 })
    + `<rect x="15.4" y="2.6" width="17.2" height="6.4" rx="1" fill="#c6ebff" opacity=".85" stroke="${INK}" stroke-width="1.1" transform="rotate(3 24 5.8)"/>`
    + gloss('M10.6 12V28', 2.2, .7) + `</g>` + twinkle(43.2, 8.6, 2.6, '#c6ebff'),
  ruler:   // 자: 비치는 하늘색 플라스틱 + 눈금
    `<g transform="rotate(-34 24 24)">`
    + jelly('M3 17.4H45Q46.4 17.4 46.4 18.8V29.2Q46.4 30.6 45 30.6H3Q1.6 30.6 1.6 29.2V18.8Q1.6 17.4 3 17.4Z', 'gLg', '#2a7fc4',
      `<g stroke="${INK}" stroke-width="1.1" stroke-linecap="round">${[5, 9, 13, 17, 21, 25, 29, 33, 37, 41].map((x, i) => `<path d="M${x} 17.4V${i % 5 === 0 ? 24.4 : i % 5 === 2 ? 22.4 : 21}"/>`).join('')}</g>`
      + `<path d="M3.4 27.2H44.6" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".55"/><circle cx="41.4" cy="26" r="1.8" fill="#fff" stroke="${INK}" stroke-width="1.1"/>`)
    + gloss('M5 20.4H16', 1.8, .85) + `</g>` + twinkle(40.6, 39.6, 2.6, '#fff3b0'),
  tape:   // 마스킹테이프: 민트 땡땡이 롤 + 풀려 나온 끝(지그재그)
    jelly('M30.4 30.6 44 37.4 42.6 39 44.4 40.6 42.4 42 43.6 43.8 28 37Z', 'gM', '#2c9c7a', `<g fill="#fff" opacity=".9"><circle cx="35" cy="35.6" r="1.1"/><circle cx="40" cy="38.6" r="1"/></g>`, { dx: .6, dy: 1.2, sw: 1.7 })
    + jelly('M22.4 6A16.4 16.4 0 1 1 22.39 6Z', 'gM', '#2c9c7a',
      shade('M33.6 10.8A16.4 16.4 0 0 1 16.2 37.4 15.4 15.4 0 0 0 33.6 10.8Z', '#36b38c', .75)
      + `<g fill="#fff" opacity=".95">${[[13, 15], [21, 11.4], [30, 13.6], [33.6, 22], [31, 31], [22.6, 34.6], [13.6, 30.6], [10.4, 22.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5"/>`).join('')}</g>`
      + `<circle cx="22.4" cy="22.4" r="8" fill="#fff7ec" stroke="${INK}" stroke-width="2"/><circle cx="22.4" cy="22.4" r="5.6" fill="none" stroke="#e7d6bd" stroke-width="1.4"/>`)
    + gloss('M10.4 25.6Q9.6 16.4 16.6 11', 2.4) + twinkle(42.4, 8.4, 2.8, '#fff3b0'),
  earbud:   // 무선 이어폰 한 쌍
    [[-1, 13.6, 10], [1, 34.4, -10]].map(([s, x, r]) => `<g transform="rotate(${r} ${x} 24)">`
      + jelly(`M${x - 2.4} 22H${x + 2.4}V40.6Q${x + 2.4} 43.4 ${x} 43.4 ${x - 2.4} 43.4 ${x - 2.4} 40.6Z`, 'gW', '#aebccb', `<circle cx="${x}" cy="40.6" r="1.1" fill="#c3ced9"/>`, { dx: .8, dy: 1.4, sw: 1.8 })
      + jelly(`M${x} 7A8 8 0 1 1 ${x - .01} 7Z`, 'gW', '#aebccb', `<path d="M${x + s * 3.4} 11.2Q${x + s * 5.8} 15 ${x + s * 3.4} 18.8" fill="none" stroke="#7d8b9a" stroke-width="2.2" stroke-linecap="round"/><circle cx="${x - s * 1.4}" cy="9.8" r="1" fill="#c3ced9"/>`, { dx: .8, dy: 1.4, sw: 1.8 })
      + gloss(`M${x - 4.6} 16.4Q${x - 4.2} 11.4 ${x - .6} 10.2`, 1.8) + `</g>`).join('')
    + twinkle(24, 30, 2.8, '#c6ebff'),
  sharp:   // 샤프: 비치는 하늘색 몸통 + 고무 그립 + 은색 촉 + 클립 + 흰 지우개 꼭지
    `<g transform="rotate(-40 24 24)">`
    + `<path d="M.8 24H4" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
    + jelly('M3.6 24 9.6 21.2V26.8Z', 'gS', '#7d8b9a', '', { dx: .5, dy: .9, sw: 1.6 })
    + jelly('M9.6 20.6H17.6V27.4H9.6Z', 'gK2', '#0f1f33', `<path d="M11.6 21.4V26.6M13.6 21.4V26.6M15.6 21.4V26.6" stroke="#4a6488" stroke-width="1.1" stroke-linecap="round"/>`, { dx: .6, dy: 1, sw: 1.7 })
    + jelly('M17.6 20.4H38.4V27.6H17.6Z', 'gLg', '#2a7fc4', `<path d="M18.6 24H37.4" stroke="#173048" stroke-width=".9" opacity=".45"/>`, { dx: .6, dy: 1, sw: 1.8 })
    + jelly('M38.4 21H44.4Q46.8 21 46.8 24 46.8 27 44.4 27H38.4Z', 'gW', '#aebccb', '', { dx: .6, dy: 1, sw: 1.7 })
    + `<path d="M28.6 20.4V17.8H38.4V19.6" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/><path d="M28.6 20.4V17.8H38.4V19.6" fill="none" stroke="#dfe9f2" stroke-width="1.4" stroke-linejoin="round"/>`
    + gloss('M19.6 22.2H35.4', 1.6, .85) + `</g>`
    + twinkle(39.4, 38.6, 2.8, '#fff3b0') + twinkle(9, 9.4, 2.2, '#c6ebff'),
  correct:   // 수정테이프: 파란 케이스 + 창으로 보이는 흰 롤 + 촉 + 종이에 그어진 흰 줄
    `<path d="M3.6 43.2H24.6" stroke="${INK}" stroke-width="6.2" stroke-linecap="round"/><path d="M3.6 43.2H24.6" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`
    + `<g transform="rotate(-20 26 24)">`
    + jelly('M15.4 27.6 6 34.6Q4.6 35.8 5.8 37L7.2 38.2Q8.4 39.2 9.8 38.2L19.4 33Z', 'gW', '#aebccb', `<path d="M6.8 36.4 8.8 38" stroke="#fff" stroke-width="1.6"/>`, { dx: .6, dy: 1, sw: 1.7 })
    + jelly('M20.4 9.4H36.4Q44.6 9.4 44.6 17.6V27.4Q44.6 36 36.4 36H24.4Q14 36 14 25.6V15.8Q14 9.4 20.4 9.4Z', 'gB', '#2a7fc4',
      shade('M44.6 24V27.4Q44.6 36 36.4 36H24.4Q16.4 36 14.6 29.6 22 33.6 36 31.6 43 30.4 44.6 24Z', '#3a92d8', .8)
      + `<circle cx="30.2" cy="22.4" r="9" fill="#e9f6ff" stroke="${INK}" stroke-width="1.6"/><circle cx="30.2" cy="22.4" r="6.4" fill="#fff" stroke="#c3ced9" stroke-width="1.6"/><circle cx="30.2" cy="22.4" r="2.8" fill="url(#gY)" stroke="${INK}" stroke-width="1.1"/>`
      + `<path d="M24.4 17.6Q26.4 14.4 30 14" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`)
    + gloss('M17.4 26V17Q17.8 12.8 21.6 12.6', 2.2, .75) + `</g>`
    + twinkle(42.4, 41.4, 2.6, '#fff3b0'),
  // 2026-10-25 하율 "일반 더 늘려봐" — 8종 추가(필통·책상·급식에서 실제로 보는 물건)
  hbpencil:   // 연필: 노란 육각 몸통 + 나무 깎은 끝 + 흑연 + 은색 띠 + 분홍 지우개
    `<g transform="rotate(-40 24 24)">`
    + jelly('M3.4 24 10.6 19.6V28.4Z', 'gPa', '#c9a070', `<path d="M3.4 24 6.4 22.2V25.8Z" fill="${INK}"/>`, { dx: .6, dy: 1, sw: 1.7 })
    + jelly('M10.6 19.6H35V28.4H10.6Z', 'gY', '#d98a10', shade('M10.6 25.2H35V28.4H10.6Z', '#f0a21c', .75) + `<path d="M10.6 24H35" stroke="#e0a015" stroke-width="1.2"/>`, { dx: .6, dy: 1, sw: 1.8 })
    + jelly('M35 19.2H39.4V28.8H35Z', 'gS', '#7d8b9a', `<path d="M36.5 19.6V28.4M38 19.6V28.4" stroke="#9aa8b6" stroke-width="1"/>`, { dx: .6, dy: 1, sw: 1.7 })
    + jelly('M39.4 19.4H42.6Q45.4 19.4 45.4 22.2V25.8Q45.4 28.6 42.6 28.6H39.4Z', 'gN', '#d9577e', '', { dx: .6, dy: 1, sw: 1.7 })
    + gloss('M12.8 21.4H32.4', 1.6, .85) + `</g>`
    + twinkle(40.4, 38.6, 2.8, '#fff3b0') + twinkle(8.6, 9.6, 2.2, '#c6ebff'),
  glue:   // 딱풀: 노란 뚜껑 + 파란 몸통 + '풀' 라벨
    `<g transform="rotate(16 24 24)">`
    + jelly('M15.6 16H32.4V40.4Q32.4 43.4 29.4 43.4H18.6Q15.6 43.4 15.6 40.4Z', 'gB', '#2a7fc4',
      shade('M28.6 16H32.4V40.4Q32.4 43.4 29.4 43.4H27.4Q30 40 28.6 16Z', '#3a92d8', .8)
      + `<rect x="15.6" y="22.4" width="16.8" height="11.2" fill="#fff" stroke="${INK}" stroke-width="1.4"/><text x="24" y="31.6" text-anchor="middle" font-family="Jua,sans-serif" font-size="9" fill="#2a7fc4">풀</text>`
      + `<path d="M15.6 38.6H32.4" stroke="#2a7fc4" stroke-width="1.3"/>`)
    + jelly('M14.6 7.6Q14.6 4.6 17.6 4.6H30.4Q33.4 4.6 33.4 7.6V16.6H14.6Z', 'gY', '#d98a10', `<path d="M14.6 13.2H33.4" stroke="#d98a10" stroke-width="1.3" opacity=".8"/>`)
    + gloss('M18.2 18.6V20.6M18.2 35.6V37', 2, .8) + gloss('M17.6 7.6V10.6', 2) + `</g>`
    + twinkle(41, 10, 2.8, '#fff3b0') + twinkle(7.6, 38, 2.2, '#c6ebff'),
  calc:   // 계산기: 보라 몸통 + 연두 화면(100) + 버튼 9개(= 은 주황)
    `<g transform="rotate(-8 24 24)">`
    + jelly('M12.4 4.6H35.6Q39.4 4.6 39.4 8.4V39.6Q39.4 43.4 35.6 43.4H12.4Q8.6 43.4 8.6 39.6V8.4Q8.6 4.6 12.4 4.6Z', 'gV', '#5b45c9',
      shade('M39.4 30V39.6Q39.4 43.4 35.6 43.4H22Q34 40.4 39.4 30Z', '#7a62f0', .7)
      + `<rect x="12.8" y="8.6" width="22.4" height="9.4" rx="2" fill="#e2f9cf" stroke="${INK}" stroke-width="1.5"/><text x="33" y="16.2" text-anchor="end" font-family="Outfit,Jua,sans-serif" font-weight="800" font-size="7.4" fill="${INK}">100</text>`
      + [0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${n1(13.2 + c * 7.8)}" y="${n1(21.4 + r * 6.6)}" width="6" height="4.8" rx="1.6" fill="${r === 2 && c === 2 ? 'url(#gL)' : '#fff'}" stroke="${INK}" stroke-width="1.2"/>`).join('')).join(''))
    + gloss('M11.8 10.6V19.4', 1.8, .7) + `</g>`
    + twinkle(42.4, 8, 2.8, '#fff3b0') + twinkle(5.6, 40, 2.2, '#c6ebff'),
  scissors:   // 가위: 분홍·하늘 손잡이 고리 + 넓은 은색 날 + 노란 나사
    `<g transform="rotate(-38 24 24)">`
    + jelly('M20.4 21.4 46 15.2Q47.6 16.4 46.2 17.8L23.4 27.8Z', 'gS', '#7d8b9a', `<path d="M24.6 22.6 43.4 17.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>`, { dx: .6, dy: 1, sw: 1.8 })
    + jelly('M20.4 26.6 46 32.8Q47.6 31.6 46.2 30.2L23.4 20.2Z', 'gS', '#7d8b9a', '', { dx: .6, dy: 1, sw: 1.8 })
    + [[13.4, 'gR', '#f0646d'], [34.6, 'gB', '#4aaeef']].map(([y, g, c]) =>
      `<path d="M${y < 24 ? '13.6 19' : '13.6 29'} 22 24" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M${y < 24 ? '13.6 19' : '13.6 29'} 22 24" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`
      + `<circle cx="10.4" cy="${y + 1.4}" r="7" fill="none" stroke="${INK}" stroke-width="7.2"/><circle cx="9.4" cy="${y}" r="7" fill="none" stroke="${INK}" stroke-width="7.2"/><circle cx="9.4" cy="${y}" r="7" fill="none" stroke="url(#${g})" stroke-width="3.8"/>`
      + `<path d="M4.6 ${y - 2.4}Q6 ${y - 5.4} 9.4 ${y - 5.6}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".85"/>`).join('')
    + `<circle cx="22" cy="24" r="2.8" fill="url(#gY)" stroke="${INK}" stroke-width="1.5"/>` + `</g>`
    + twinkle(42.6, 38.4, 2.8, '#fff3b0') + twinkle(39.4, 6.6, 2.2, '#c6ebff'),
  milkbox:   // 급식 우유: 흰 종이팩 + 파란 지붕 + '우유' 띠 + 빨대
    `<g transform="rotate(6 24 24)">`
    + `<path d="M27.6 10.4 32.6 1.6" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M27.6 10.4 32.6 1.6" stroke="#ff8fb0" stroke-width="2.2" stroke-linecap="round"/>`
    + jelly('M12.4 17.6H35.6V41.4Q35.6 43.6 33.4 43.6H14.6Q12.4 43.6 12.4 41.4Z', 'gW', '#aebccb',
      shade('M31.4 17.6H35.6V41.4Q35.6 43.6 33.4 43.6H30.6Q32.6 40 31.4 17.6Z', '#dfe9f2', .9)
      + `<path d="M12.4 26H35.6V36.4H12.4Z" fill="url(#gLg)" stroke="${INK}" stroke-width="1.4"/><text x="24" y="34.2" text-anchor="middle" font-family="Jua,sans-serif" font-size="8.6" fill="#fff" stroke="${INK}" stroke-width="1.8" paint-order="stroke">우유</text>`)
    + jelly('M12.4 17.6 17.4 9.4H30.6L35.6 17.6Z', 'gB', '#2a7fc4', `<path d="M24 9.4 21.6 17.6" stroke="#2a7fc4" stroke-width="1.2"/>`)
    + jelly('M17.4 9.4V6.2H30.6V9.4Z', 'gB', '#2a7fc4', '', { dx: .5, dy: .9, sw: 1.7 })
    + gloss('M15 21V24M15 38.6V40.4', 2, .85) + `</g>`
    + twinkle(41.6, 9.4, 2.8, '#fff3b0') + twinkle(6.6, 38, 2.2, '#c6ebff'),
  slipper:   // 실내화 한 켤레: 흰 고무 바닥 + 파란 앞 띠(학교 실내화 그 모양)
    `<g transform="translate(3.4 4.6) rotate(-12 12 20)">`
      + jelly('M12 0C18 0 21 4.4 21 10.6V29.4Q21 40 12 40 3 40 3 29.4V10.6C3 4.4 6 0 12 0Z', 'gW', '#aebccb', `<path d="M12 3.8C15.8 3.8 17.4 7 17.4 11.4V29Q17.4 36.2 12 36.2 6.6 36.2 6.6 29V11.4C6.6 7 8.2 3.8 12 3.8Z" fill="#f6f9fc" stroke="#c3ced9" stroke-width="1.1"/>`, { dx: .8, dy: 1.4, sw: 1.9 })
      + jelly('M1.8 9.2Q12 3.6 22.2 9.2V18.4Q12 13.4 1.8 18.4Z', 'gB', '#2a7fc4', shade('M22.2 14.4V18.4Q12 13.4 1.8 18.4V16.4Q12 11 22.2 14.4Z', '#3a92d8', .8), { dx: .8, dy: 1.4, sw: 1.9 })
      + gloss('M6.4 22V30', 1.8, .8) + `</g>`
    + `<g transform="translate(21.6 2.6) rotate(10 12 20)">`
      + jelly('M12 0C18 0 21 4.4 21 10.6V29.4Q21 40 12 40 3 40 3 29.4V10.6C3 4.4 6 0 12 0Z', 'gW', '#aebccb', `<path d="M12 3.8C15.8 3.8 17.4 7 17.4 11.4V29Q17.4 36.2 12 36.2 6.6 36.2 6.6 29V11.4C6.6 7 8.2 3.8 12 3.8Z" fill="#f6f9fc" stroke="#c3ced9" stroke-width="1.1"/>`, { dx: .8, dy: 1.4, sw: 1.9 })
      + jelly('M1.8 9.2Q12 3.6 22.2 9.2V18.4Q12 13.4 1.8 18.4Z', 'gB', '#2a7fc4', shade('M22.2 14.4V18.4Q12 13.4 1.8 18.4V16.4Q12 11 22.2 14.4Z', '#3a92d8', .8), { dx: .8, dy: 1.4, sw: 1.9 })
      + gloss('M6.4 22V30', 1.8, .8) + `</g>`
    + twinkle(43.4, 40.6, 2.6, '#fff3b0') + twinkle(4.4, 41.4, 2.2, '#c6ebff'),
  bottle:   // 물병: 민트 텀블러 + 남색 뚜껑·고리 + 물 보이는 창
    `<g transform="rotate(10 24 24)">`
    + `<path d="M31 6.6H35Q38.2 6.6 38.2 9.8V10.6Q38.2 13.8 35 13.8H31.6" fill="none" stroke="${INK}" stroke-width="4.2"/><path d="M31 6.6H35Q38.2 6.6 38.2 9.8V10.6Q38.2 13.8 35 13.8H31.6" fill="none" stroke="#4a6488" stroke-width="1.8"/>`
    + jelly('M15.4 14.6H32.6V40.4Q32.6 43.6 29.4 43.6H18.6Q15.4 43.6 15.4 40.4Z', 'gM', '#2c9c7a',
      shade('M29 14.6H32.6V40.4Q32.6 43.6 29.4 43.6H27.8Q30.4 40 29 14.6Z', '#36b38c', .75)
      + `<path d="M19.4 21.6H28.6V38.4Q28.6 39.8 27.2 39.8H20.8Q19.4 39.8 19.4 38.4Z" fill="#effbff" stroke="${INK}" stroke-width="1.3"/><path d="M19.4 29.4Q24 27.6 28.6 29.4V38.4Q28.6 39.8 27.2 39.8H20.8Q19.4 39.8 19.4 38.4Z" fill="#8fd6ff"/><path d="M21 31.6V36.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`)
    + jelly('M16.4 7.4Q16.4 4.4 19.4 4.4H28.6Q31.6 4.4 31.6 7.4V14.6H16.4Z', 'gK2', '#0f1f33', `<path d="M16.4 11H31.6" stroke="#4a6488" stroke-width="1.2"/>`, { dx: .6, dy: 1, sw: 1.8 })
    + gloss('M17.8 17.4V20M17.8 34V38', 2, .8) + gloss('M18.8 6.8V8.8', 1.4, .6) + `</g>`
    + twinkle(42, 37.4, 2.8, '#fff3b0') + twinkle(7.4, 10, 2.2, '#c6ebff'),
  stapler:   // 스테이플러: 빨간 위 팔 + 남색 받침 + 튀어나온 철심
    `<g transform="rotate(-12 24 24)">`
    + jelly('M6 33.4H40.4Q43.4 33.4 43.4 36.4V37.6Q43.4 40.6 40.4 40.6H6Q4.4 40.6 4.4 39V35Q4.4 33.4 6 33.4Z', 'gK2', '#0f1f33', `<rect x="7" y="34.6" width="6.4" height="2" rx="1" fill="#8d9aa8"/>`, { dx: .6, dy: 1, sw: 1.8 })
    + jelly('M36.2 24H42.8V33.6H36.2Z', 'gK2', '#0f1f33', '', { dx: .6, dy: 1, sw: 1.7 })
    + jelly('M4.6 25.6Q4.6 17.4 12.6 17.4H39.4Q44.2 17.4 44.2 22.2V24.6Q44.2 28.4 40.4 28.4H7.4Q4.6 28.4 4.6 25.6Z', 'gR', '#c43c48',
      shade('M4.8 26.2Q22 27.8 44.2 24.6Q44.2 28.4 40.4 28.4H7.4Q4.8 28.4 4.8 26.2Z', '#d9505b', .8)
      + `<rect x="27.4" y="19.6" width="10.4" height="4.4" rx="2.2" fill="#fff" stroke="${INK}" stroke-width="1.2" opacity=".9"/>`)
    + `<path d="M15.4 9.6V6.4H25V9.6" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/><path d="M15.4 9.6V6.4H25V9.6" fill="none" stroke="#dfe9f2" stroke-width="1.6" stroke-linejoin="round"/>`
    + gloss('M9.6 20.6H24', 1.8, .85) + `</g>`
    + twinkle(41, 9, 2.8, '#fff3b0') + twinkle(5.6, 12.6, 2.2, '#c6ebff'),
  /* 희귀 — 움직이는 스티커 (움직임은 style.css '.art .an-*', 동작 줄이기 설정이면 멈춤) */
  plane:   // 종이비행기: 흰·하늘 날개 + 접힌 선 + 점선 꼬리(흘러감)
    `<path class="an-trail" d="M3.4 43.4Q9 36 17.4 35.6" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="2.6 3"/>`
    + `<g class="an-plane">`
    + jelly('M4.6 25.4 43.2 8.4 21.6 30.4Z', 'gW', '#aebccb', `<path d="M10 25.2 36.6 13" stroke="#dfe9f2" stroke-width="1.4" stroke-linecap="round"/>`, { dx: .8, dy: 1.4, sw: 1.9 })
    + jelly('M21.6 30.4 43.2 8.4 30.4 41.4Z', 'gB', '#2a7fc4', shade('M43.2 8.4 30.4 41.4 28.4 36Z', '#3a92d8', .8), { dx: .8, dy: 1.4, sw: 1.9 })
    + jelly('M21.6 30.4 25.4 36.6 23.4 30.4Z', 'gLg', '#2a7fc4', '', { dx: .4, dy: .7, sw: 1.4 })
    + gloss('M9.4 23.6 30.4 14.4', 1.8, .9) + `</g>`
    + twinkle(41.6, 39.4, 2.6, '#fff3b0'),
  test100:   // 100점 시험지: 줄 친 종이 + 빨간 100 + 그려지는 빨간 동그라미 + 하트 도장
    `<g transform="rotate(-7 24 24)">`
    + jelly('M9.4 4.6H33.4L40.4 11.6V42.4Q40.4 44 38.8 44H9.4Q7.8 44 7.8 42.4V6.2Q7.8 4.6 9.4 4.6Z', 'gW', '#aebccb',
      `<path d="M33.4 4.6V10Q33.4 11.6 35 11.6H40.4" fill="#dfe9f2" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`
      + `<path d="M12.4 31.4H35.6M12.4 35.8H35.6M12.4 40.2H28" stroke="#c6dcef" stroke-width="1.4" stroke-linecap="round"/><path d="M12.4 9.6H26" stroke="#8d9aa8" stroke-width="1.6" stroke-linecap="round"/>`
      + `<text x="23.6" y="25.4" text-anchor="middle" font-family="Outfit,Jua,sans-serif" font-weight="800" font-size="12.4" fill="#f0464f" textLength="20" lengthAdjust="spacingAndGlyphs">100</text>`
      + `<path class="an-ring" pathLength="100" d="M33.6 15.6C30.4 12.4 15.2 12.4 12.2 17.4 9.4 22.6 14.4 28.6 24 28.4 33.4 28.2 37.4 22.4 34.2 17.2 33 15.4 30 14.4 27.4 14.2" fill="none" stroke="#f0464f" stroke-width="2" stroke-linecap="round"/>`)
    + gloss('M10.8 8.6V20', 1.6, .7) + `</g>`
    + jelly(starD(39.4, 38.4, 6.2, 2.7), 'gY', '#d98a10', '', { dx: .6, dy: 1, sw: 1.6 }) + twinkle(6, 10.4, 2.6, '#c6ebff'),
  ball:   // 농구공: 통통 튀고, 바닥 그림자가 같이 줄었다 늘어남
    `<ellipse class="an-shadow" cx="24" cy="44.4" rx="11" ry="2" fill="${INK}" opacity=".22"/>`
    + `<g class="an-ball">`
    + jelly('M24 5.4A15.6 15.6 0 1 1 23.99 5.4Z', 'gP', '#c4602a',
      shade('M35 9.8A15.6 15.6 0 0 1 17.2 35.2 14.8 14.8 0 0 0 35 9.8Z', '#e5783a', .75)
      + `<g fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"><path d="M24 5.6V36.4M8.4 21H39.6"/><path d="M13.4 9.6Q20 21 13.4 32.4M34.6 9.6Q28 21 34.6 32.4"/></g>`)
    + gloss('M12.4 18Q13.4 11.4 19.4 8.8', 2.4) + `</g>`
    + twinkle(42.4, 7.4, 2.8, '#fff3b0') + twinkle(6, 12, 2.2, '#c6ebff'),
  memo:   // 쪽지: 접힌 분홍 쪽지가 살짝 흔들리고 하트가 퐁 올라옴
    `<g class="an-memo">`
    + jelly('M7.6 14.4H40.4Q42 14.4 42 16V40.4Q42 42 40.4 42H7.6Q6 42 6 40.4V16Q6 14.4 7.6 14.4Z', 'tPk', '#e98aa8',
      shade('M42 32V40.4Q42 42 40.4 42H22Q34 39 42 32Z', '#ffb0c8', .8)
      + `<path d="M12 33.4H30M12 37.4H24" stroke="#e98aa8" stroke-width="1.6" stroke-linecap="round"/>`)
    + jelly('M6 16 24 29 42 16V15.6Q42 14.4 40.6 14.4H7.4Q6 14.4 6 15.6Z', 'gN', '#d9577e', '', { dx: .5, dy: .9, sw: 1.8 })
    + `<path d="M24 28.4 13.4 20.8M24 28.4 34.6 20.8" stroke="#ffd9e4" stroke-width="1.2" stroke-linecap="round"/>`
    + gloss('M9.6 19V36', 1.8, .6) + `</g>`
    + `<g class="an-heart"><path d="M24 12.6C19.6 9.6 17.8 7.4 18.6 5.4 19.4 3.6 21.8 3.4 24 5.6 26.2 3.4 28.6 3.6 29.4 5.4 30.2 7.4 28.4 9.6 24 12.6Z" fill="#f0646d" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/></g>`
    + twinkle(42.6, 7.4, 2.6, '#fff3b0'),
  // 2026-10-25 하율 "희귀도 더 늘려도 좋을 듯" — 움직이는 스티커 4종 추가
  bread:   // 매점 빵: 따끈한 소보로에서 김이 모락모락(.an-stm 3줄이 엇갈려 올라감)
    [['an-stm', 17], ['an-stm an-stm2', 24], ['an-stm an-stm3', 31]].map(([c, x]) => `<g class="${c}"><path d="M${x} 15.6Q${x - 2.4} 12.4 ${x} 9.4 ${x + 2.4} 6.4 ${x} 3.4" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M${x} 15.6Q${x - 2.4} 12.4 ${x} 9.4 ${x + 2.4} 6.4 ${x} 3.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`).join('')
    + jelly('M6.4 31.4Q6.4 17.4 24 17.4 41.6 17.4 41.6 31.4 41.6 37.6 35.4 37.6H12.6Q6.4 37.6 6.4 31.4Z', 'gP', '#c4602a',
      shade('M41.6 29V31.4Q41.6 37.6 35.4 37.6H20Q34 35 41.6 29Z', '#e5783a', .75)
      + `<g fill="#ffe0a6" stroke="${INK}" stroke-width=".9">${[[14, 25.4], [20.4, 22], [27.6, 21.6], [33.6, 25], [18.4, 29.6], [25.6, 27.4], [31, 30.4], [12, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')}</g>`)
    + jelly('M8.4 35.4H39.6L36.8 44H11.2Z', 'gW', '#aebccb', `<path d="M14.6 35.4 15.6 44M21.2 35.4 21.6 44M27.8 35.4 27.4 44M34 35.4 33 44" stroke="#f0646d" stroke-width="1.8"/>`, { dx: .6, dy: 1, sw: 1.8 })
    + gloss('M11.6 26.6Q13.4 21.6 18.4 19.8', 2.2)
    + twinkle(43, 12.6, 2.8, '#fff3b0') + twinkle(5, 14, 2.2, '#c6ebff'),
  fan:   // 교실 선풍기: 날개 4장이 빙글빙글(.an-fan) — 4장이라 그림 범위의 가운데 = 축
    jelly('M21.8 30H26.2V40.4H21.8Z', 'gS', '#7d8b9a', '', { dx: .6, dy: 1, sw: 1.7 })
    + jelly('M13.4 40.6Q13.4 37.6 16.4 37.6H31.6Q34.6 37.6 34.6 40.6V41.6Q34.6 44.4 31.8 44.4H16.2Q13.4 44.4 13.4 41.6Z', 'gB', '#2a7fc4', '', { dx: .6, dy: 1, sw: 1.8 })
    + jelly('M24 4A15 15 0 1 1 23.99 4Z', 'gW', '#aebccb', `<circle cx="24" cy="19" r="12.6" fill="#eaf6ff" stroke="#c3ced9" stroke-width="1.2"/>`)
    + `<g class="an-fan">${[0, 90, 180, 270].map(a => `<path transform="rotate(${a} 24 19)" d="M24 19C21 15.4 20.8 9.4 24 7.6 27.4 9.4 27.2 15.4 24 19Z" fill="url(#gB)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`).join('')}</g>`
    + `<g stroke="${INK}" stroke-width=".8" opacity=".35" fill="none"><circle cx="24" cy="19" r="8.4"/><path d="M24 4.6V33.4M9.6 19H38.4M13.8 8.8 34.2 29.2M34.2 8.8 13.8 29.2"/></g>`
    + `<circle cx="24" cy="19" r="2.8" fill="url(#gY)" stroke="${INK}" stroke-width="1.4"/>`
    + gloss('M12.4 13.4Q14.6 8.4 19.6 6.6', 2.2, .9)
    + twinkle(42.4, 37.6, 2.8, '#fff3b0') + twinkle(41.6, 6.6, 2.2, '#c6ebff'),
  nap:   // 쉬는 시간 낮잠: 책 위에 엎드린 찹쌀떡 + Z가 퐁퐁(.an-z)
    jelly('M3.6 35Q13.8 31 24 35.4 34.2 31 44.4 35V42Q34.2 38 24 42.4 13.8 38 3.6 42Z', 'gW', '#aebccb',
      `<path d="M24 35.4V42.4" stroke="${INK}" stroke-width="1.3"/><path d="M7.4 37Q14.4 34.8 20.6 37.2M27.4 37.2Q33.6 34.8 40.6 37" fill="none" stroke="#c3ced9" stroke-width="1.2" stroke-linecap="round"/>`)
    + jelly('M23 14.6C32.6 14.6 37.4 20.6 37.4 27 37.4 32.6 32 35.4 23 35.4 14 35.4 8.6 32.6 8.6 27 8.6 20.6 13.4 14.6 23 14.6Z', 'cOd', '#d9b88a',
      `<path d="M14.6 26.4Q16.6 28.4 18.6 26.4M27.4 26.4Q29.4 28.4 31.4 26.4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`
      + `<ellipse cx="13.6" cy="30" rx="2.4" ry="1.4" fill="#ffb3c8" opacity=".85"/><ellipse cx="32.4" cy="30" rx="2.4" ry="1.4" fill="#ffb3c8" opacity=".85"/>`
      + `<path d="M21.4 30.4Q23 31.8 24.6 30.4" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`)
    + gloss('M12.2 22Q14.4 18 19 17', 2)
    + `<g class="an-z"><text x="36.6" y="15.4" font-family="Jua,sans-serif" font-size="10" fill="#fff" stroke="${INK}" stroke-width="2.4" paint-order="stroke">Z</text></g>`
    + `<g class="an-z an-z2"><text x="41.8" y="7.6" font-family="Jua,sans-serif" font-size="7.4" fill="#c6ebff" stroke="${INK}" stroke-width="2" paint-order="stroke">z</text></g>`
    + twinkle(5, 12, 2.2, '#fff3b0'),
  icecream:   // 아이스크림: 딸기 하드 + 초코 코팅, 아래로 녹아 똑 떨어짐(.an-drip)
    jelly('M21.6 32H26.4V42.4Q26.4 44.8 24 44.8 21.6 44.8 21.6 42.4Z', 'gPa', '#c9a070', '', { dx: .5, dy: .9, sw: 1.7 })
    + jelly('M14.6 10.6Q14.6 4.6 20.6 4.6H27.4Q33.4 4.6 33.4 10.6V31.4Q33.4 34.6 30.2 34.6H17.8Q14.6 34.6 14.6 31.4Z', 'gN', '#d9577e',
      `<path d="M14.6 10.6Q14.6 4.6 20.6 4.6H27.4Q33.4 4.6 33.4 10.6V15Q30 17.6 27.4 15.4 24.6 18.4 21.4 15.6 18 18 14.6 15.4Z" fill="url(#gK)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`
      + `<g stroke-width="1.6" stroke-linecap="round"><path d="M18.6 9.4 20 8.4" stroke="#ffe27a"/><path d="M24.4 7.6 25.6 9" stroke="#9ff0ff"/><path d="M29 10.6 30.4 9.8" stroke="#fff"/></g>`
      + shade('M29.6 14.6Q31.6 15.2 33.4 14V31.4Q33.4 34.6 30.2 34.6H28.6Q31 28 29.6 14.6Z', '#ff7aa2', .55))
    + `<g class="an-drip"><path d="M28.4 33.6Q28.4 37.4 30.2 39.4 32 37.4 32 33.6Z" fill="url(#gN)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/></g>`
    + gloss('M17.6 20V29', 2.2, .85)
    + twinkle(41.4, 10.6, 2.8, '#fff3b0') + twinkle(7, 36, 2.2, '#c6ebff'),
  /* 전설 — 효과 아이콘 (실제 효과는 style.css '뽑기 효과') */
  fxholo:   // 홀로그램 닉네임: 무지갯빛 이름표 + 반짝이
    jelly('M10.6 14.4H37.4Q45.2 14.4 45.2 22.2V25.8Q45.2 33.6 37.4 33.6H10.6Q2.8 33.6 2.8 25.8V22.2Q2.8 14.4 10.6 14.4Z', 'gH', '#7a62f0',
      `<path d="M8 33.6 20 14.4H26.4L14.4 33.6ZM24 33.6 36 14.4H39L27 33.6Z" fill="#fff" opacity=".35"/>`
      + `<text x="24" y="28.4" text-anchor="middle" font-family="Jua,sans-serif" font-size="12.4" fill="#fff" stroke="${INK}" stroke-width="1.8" paint-order="stroke">닉네임</text>`)
    + gloss('M8 19.4Q9.4 17 12.4 17', 1.8) + twinkle(43.4, 9.4, 3.4, '#ffe98a') + twinkle(5.4, 39.6, 2.8, '#ffb3e6') + twinkle(36, 41.4, 2.2, '#94d8ff'),
  fxstar:   // 별똥별 등장: 홀로 꼬리 + 큰 별
    `<path d="M4 44 25 23" stroke="${INK}" stroke-width="9.4" stroke-linecap="round"/><path d="M4 44 25 23" stroke="url(#gH)" stroke-width="6.6" stroke-linecap="round"/><path d="M6.4 41.6 22 26" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`
    + jelly(starD(31, 17, 14.4, 6.4, 5, -78), 'gY', '#d98a10')
    + `<circle cx="27.6" cy="18.4" r="1.4" fill="${INK}"/><circle cx="34.6" cy="19.8" r="1.4" fill="${INK}"/><path d="M29.6 22.6Q31.4 24 33 22.8" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`
    + gloss('M24.6 13.4 27.6 9.4', 2) + twinkle(10, 12, 3, '#fff3b0') + twinkle(42.6, 38.4, 2.6, '#c6ebff'),
  fxneon:   // 네온 시계: 어두운 판 + 분홍·하늘 네온 숫자
    jelly('M7.6 10H40.4Q44.6 10 44.6 14.2V33.8Q44.6 38 40.4 38H7.6Q3.4 38 3.4 33.8V14.2Q3.4 10 7.6 10Z', 'tGx', '#0e0c2e',
      `<g font-family="Outfit,Jua,sans-serif" font-weight="800" font-size="15" text-anchor="middle"><text x="24" y="29.2" fill="none" stroke="#ff4fd8" stroke-width="3.4" opacity=".45" textLength="31" lengthAdjust="spacingAndGlyphs">12:30</text><text x="24" y="29.2" fill="#fff" stroke="#ff7ae2" stroke-width=".8" textLength="31" lengthAdjust="spacingAndGlyphs">12:30</text></g>`
      + `<path d="M7.6 34.6H40.4" stroke="#6fe3ff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>`)
    + gloss('M7 15.4Q7.4 13.2 9.6 13.2', 1.6, .6) + twinkle(43.4, 6.6, 3, '#ff9de9') + twinkle(5.4, 42.4, 2.6, '#9ff0ff'),
  fxcrown:   // 떠 있는 왕관
    jelly('M6.4 17.4 15.4 25 24 10.4 32.6 25 41.6 17.4 38.4 37.4H9.6Z', 'gY', '#d98a10',
      shade('M41.6 17.4 38.4 37.4H29Q36.4 30 38.4 20.2Z', '#f0a21c', .8)
      + `<path d="M9.6 32.4H38.4" stroke="#d98a10" stroke-width="1.4" opacity=".8"/>`
      + `<circle cx="24" cy="27.4" r="3" fill="url(#gR)" stroke="${INK}" stroke-width="1.3"/><circle cx="15" cy="30.2" r="2" fill="url(#gB)" stroke="${INK}" stroke-width="1.1"/><circle cx="33" cy="30.2" r="2" fill="url(#gM)" stroke="${INK}" stroke-width="1.1"/>`)
    + `<g stroke="${INK}" stroke-width="1.4"><circle cx="6.4" cy="17.4" r="2.6" fill="url(#gY)"/><circle cx="24" cy="9.6" r="2.8" fill="url(#gY)"/><circle cx="41.6" cy="17.4" r="2.6" fill="url(#gY)"/></g>`
    + `<ellipse cx="24" cy="44" rx="12" ry="2" fill="${INK}" opacity=".16"/>`
    + gloss('M12.4 25.6 14 29.6', 2) + twinkle(43.6, 7, 2.8, '#fff3b0') + twinkle(4.6, 35, 2.4, '#c6ebff'),
  fxkey:   // 집 열쇠(히든 — 나 집에 갈래! 첫 10만 m)
    jelly('M15 12A10 10 0 1 0 24.6 25H34V30.6H37.4V27.6H40V31.2H43.6V19.4H24.6A10 10 0 0 0 15 12Z', 'gY', '#d98a10',
      shade('M24.6 23H43.6V25H24.6Z', '#f0a21c', .75)
      + `<path d="M15 16.4 20.6 21.4V27.6H9.4V21.4Z" fill="#fffbe8" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M13.6 27.6V24.2H16.4V27.6" fill="#f0646d" stroke="${INK}" stroke-width="1.1"/>`)
    + gloss('M8.4 19.4Q9.4 15.2 13.4 13.8', 2.2) + gloss('M27 21.2H32', 1.6, .7)
    + `<ellipse cx="25" cy="42" rx="14" ry="2" fill="${INK}" opacity=".16"/>`
    + twinkle(41.4, 10, 3, '#fff3b0') + twinkle(6, 38, 2.4, '#ffc9e4'),
  fxgold:   // 황금 닉네임(시크릿)
    jelly('M10.6 14.4H37.4Q45.2 14.4 45.2 22.2V25.8Q45.2 33.6 37.4 33.6H10.6Q2.8 33.6 2.8 25.8V22.2Q2.8 14.4 10.6 14.4Z', 'tGd', '#b8860b',
      `<path d="M8 33.6 20 14.4H26.4L14.4 33.6Z" fill="#fff" opacity=".45"/>`
      + `<text x="24" y="28.4" text-anchor="middle" font-family="Jua,sans-serif" font-size="12.4" fill="#ffd34a" stroke="${INK}" stroke-width="2" paint-order="stroke">닉네임</text>`)
    + jelly(starD(40.6, 10, 7, 3), 'gY', '#d98a10', '', { dx: .6, dy: 1, sw: 1.6 })
    + gloss('M8 19.4Q9.4 17 12.4 17', 1.8) + twinkle(5.4, 39.6, 3, '#fff3b0') + twinkle(36, 41.4, 2.4, '#ffe27a'),
};

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
  /* ----- 뽑기 스티커 ----- */
  ...GA,
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
  // 스티커 떼기: 귀퉁이가 말려 올라간 스티커(모두 떼기 버튼)
  peel: uj('M5.4 3H18.6Q21 3 21 5.4V13L13 21H5.4Q3 21 3 18.6V5.4Q3 3 5.4 3Z', 'gB', '#2a7fc4', `<path d="M8 8.6 9 10.6 11.2 10.9 9.6 12.4 10 14.6 8 13.5 6 14.6 6.4 12.4 4.8 10.9 7 10.6Z" fill="#fff" opacity=".9"/>`)
    + `<path d="M21 13 13 21Q12.4 15.6 14 14 15.6 12.4 21 13Z" fill="url(#gW)" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` + ug('M5.6 9.2V6.6Q5.6 5.6 6.6 5.6H9'),
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
const VB = {"scissors": "-6.5 -1.5 57.6 57.6", "slipper": "-1.1 -1.3 51.1 51.1", "hbpencil": "2.5 1.6 44.6 44.6", "glue": "-1.0 0.2 50.8 50.8", "calc": "-0.5 -0.2 50.9 50.9", "milkbox": "-1.4 -2.1 52.3 52.3", "bottle": "1.3 0.6 50.5 50.5", "stapler": "-1.4 -2.7 53.0 53.0", "bread": "1.4 0.8 46.8 46.8", "fan": "1.5 1.4 46.6 46.6", "nap": "0.1 -1.7 49.5 49.5", "icecream": "1.6 2.0 46.3 46.3", "plane": "0.8 3.0 45.8 45.8", "test100": "0.1 0.0 51.3 51.3", "ball": "1.9 2.8 46.2 46.2", "memo": "1.8 1.4 46.0 46.0", "fxholo": "0.2 0.8 49.2 49.2", "fxstar": "1.4 -0.6 48.1 48.1", "fxneon": "0.8 1.4 48.0 48.0", "fxcrown": "1.2 3.6 45.6 45.6", "fxkey": "1.4 -0.8 47.5 47.5", "fxgold": "0.2 -5.5 50.3 50.3", "sharp": "-0.4 -0.6 47.8 47.8", "correct": "-1.1 -2.4 54.0 54.0", "bell": "0.8 1.0 48.0 48.0", "clock": "2.7 2.0 45.0 45.0", "gseal": "-0.5 -1.2 49.2 49.2", "tray": "1.4 2.5 46.8 46.8", "nametag": "1.6 -1.0 46.4 46.4", "note": "3.0 3.4 44.0 44.0", "slate": "2.5 2.1 45.3 45.3", "palette": "2.0 2.7 45.6 45.6", "timeline": "1.4 0.2 46.8 46.8", "headset": "1.4 2.3 46.8 46.8", "light": "0.6 0.4 48.6 48.6", "cube": "-0.0 1.4 48.0 48.0", "eraser": "1.9 5.3 45.3 45.3", "hilite": "-1.1 -2.1 50.9 50.9", "postit": "-0.5 -2.3 50.3 50.3", "ruler": "-0.9 -1.6 52.6 52.6", "tape": "3.4 3.4 44.2 44.2", "earbud": "-0.5 1.0 49.8 49.8", "diploma": "-0.8 0.6 52.1 52.1"};
// 반짝이 별(네 갈래, 남색 선 + 금빛) — 반짝이 스티커 위에 겹침
const spk = (x, y, r, c) => `<path class="${c}" d="M${x} ${y - r}Q${x + r * .18} ${y - r * .18} ${x + r} ${y}Q${x + r * .18} ${y + r * .18} ${x} ${y + r}Q${x - r * .18} ${y + r * .18} ${x - r} ${y}Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z" fill="#fff6c8" stroke="#173048" stroke-width="1.5" stroke-linejoin="round"/>`;
const SHNX = spk(40, 8, 7, 'shx1') + spk(7, 18, 4.6, 'shx2') + spk(38, 40, 5, 'shx3');
/* ===== 스티커 흰 테두리·그림자·반짝이 금빛을 '필터' 대신 '그림'으로 (2026-10-25 렉 해결) =====
   전에는 CSS drop-shadow 4~6겹으로 흰 테두리를 만들었는데, 움직이는 스티커(희귀 an-*·반짝이 별)는 매 프레임 그 필터를 다시 그려
   뽑기 페이지가 120fps → 19fps로 떨어졌음(실제 측정). 그래서 같은 그림을 흰색·남색으로 '실루엣' 떠서 뒤에 깔아 둠:
   모양마다 선을 2r 더 굵게 칠하면 가장자리 밖으로 r만큼 테두리가 생김. 클래스(an-*)는 그대로라 움직임도 같이 따라감.
   쓰는 칸(출석·도감·프로필 스티커 등)에서만 CSS로 .olx를 보이게 함 — style.css '스티커 테두리'. */
const SIL_TAG = /<(path|circle|ellipse|rect|polygon|polyline|line|text|g)\b([^>]*?)(\/?)>/g;
const sil = (m, c, r = 1.6) => `<g fill="${c}" stroke="${c}" stroke-width="${2 * r}" stroke-linejoin="round" stroke-linecap="round">`
  + m.replace(/<clipPath[\s\S]*?<\/clipPath>/g, '').replace(/<(linear|radial)Gradient[\s\S]*?<\/\1Gradient>/g, '')
    .replace(SIL_TAG, (all, tag, at, sl) => {
      const op = /\sopacity="([\d.]+)"/.exec(at);
      if (sl && op && +op[1] < .5) return '';   // 옅은 그림자·바닥 그림자는 테두리에서 뺌
      at = at.replace(/\s(opacity|fill-opacity|stroke-opacity|filter)="[^"]*"/g, '')
        .replace(/\sfill="(?!none")[^"]*"/g, ` fill="${c}"`);
      const st = /\sstroke="([^"]*)"/.exec(at), sw = /\sstroke-width="([\d.]+)"/.exec(at);
      if (st) at = at.replace(/\sstroke="[^"]*"/, ` stroke="${c}"`);
      if (sw) at = at.replace(/\sstroke-width="[\d.]+"/, ` stroke-width="${n1((st && st[1] === 'none' ? 0 : +sw[1]) + 2 * r)}"`);
      else if (st && st[1] === 'none') at += ` stroke-width="${2 * r}"`;
      return `<${tag}${at}${sl}>`;
    }) + '</g>';
// 멈춘 버전(still): 움직임 클래스(an-*·shx)를 뺀 그림 — 한 화면에 수십 개 늘어놓는 곳(조각 상점)용, 금빛 빛은 늘 멈춘 그림으로(넓어서 다시 그리면 비쌈)
const still = v => v.replace(/\sclass="(an-|shx)[^"]*"/g, '');
const ANIM = v => /\sclass="(an-|shx)/.test(v);
const olSym = (k, v, vb) => `<symbol id="art-${k}-ol" overflow="visible" viewBox="${vb}"><g transform="translate(1.4 1.9)" opacity=".28">${sil(v, INK)}</g>${sil(v, '#fff')}</symbol>`
  + `<symbol id="art-${k}-gl" overflow="visible" viewBox="${vb}"><g opacity=".3">${sil(still(v), '#ffd34a', 4.4)}</g><g opacity=".55">${sil(still(v), '#ffd34a', 2.8)}</g></symbol>`
  + (ANIM(v) ? `<symbol id="art-${k}-st" overflow="visible" viewBox="${vb}">${still(v)}</symbol>` + olSym(k + '-st', still(v), vb).split('<symbol id="art-' + k + '-st-gl"')[0] : '');

/* ===== 스프라이트: 문서에 한 번만 (그라디언트 + 보상 그림 symbol) ===== */
let done = false;
export function ensureSprite() {
  if (done || typeof document === 'undefined' || !document.body) return;
  done = true;
  const box = document.createElement('div');
  box.className = 'att-sprite'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${DEFS}</defs>${Object.entries(ART).map(([k, v]) => { const vb = SCENES.has(k) ? '0 0 48 48' : VB[k] || '-3 -3 54 54'; return `<symbol id="art-${k}" overflow="visible" viewBox="${vb}">${v}</symbol>` + olSym(k, v, vb); }).join('')}<symbol id="art-shnx" overflow="visible" viewBox="0 0 48 48">${SHNX}</symbol><symbol id="art-shnx-st" overflow="visible" viewBox="0 0 48 48">${still(SHNX)}</symbol></svg>`;
  document.body.appendChild(box);
}
if (typeof document !== 'undefined') { if (document.body) ensureSprite(); else document.addEventListener('DOMContentLoaded', ensureSprite, { once: true }); }

/* ===== 내보내기 ===== */
// 2026-10-24 보상 그림 교체 전 이름 → 새 그림 (예전에 고른 프로필 사진·스티커·보낸 스티커 메시지가 그대로 새 그림으로 보이게)
const keyOf = v => { const k = String(v).slice(2).replace(/_s$/, ''); return RW_OLD[k] || k; };   // '_s' = 반짝이 버전(같은 그림 + 반짝임)
export const ART_KEYS = Object.keys(ART);
export const isArt = v => typeof v === 'string' && v.startsWith('r:') && !!ART[keyOf(v)];
// 반짝이 버전(값 끝 '_s', 조각 강화 2026-10-25): 금빛 테두리 빛 + 위에 반짝이 별 3개(#art-shnx, 하나씩 깜빡임 — style.css .shn)
// 화면 밖 스티커는 멈춘 그림으로 바꿔 둠(뽑기 페이지 IntersectionObserver) — <use> 복제본은 화면 밖이어도 매 프레임 스타일을 다시 계산해서
export const stillHref = h => { const m = /^#art-(.+?)(-ol)?$/.exec(h || ''); if (!m || /-(gl|st)$/.test(m[1]) || m[1].endsWith('-st')) return h; const id = m[1] === 'shnx' ? 'art-shnx-st' : `art-${m[1]}-st${m[2] || ''}`; return document.getElementById(id) ? '#' + id : h; };
// cls에 'still'이 있으면 움직임 없는 그림(한 화면에 많이 늘어놓는 곳 — 렉 방지, 2026-10-25)
export const artOf = (v, cls = '') => {
  if (!isArt(v)) return ''; ensureSprite();
  const sh = /_s$/.test(v), k = keyOf(v), st = /(^|\s)still(\s|$)/.test(cls), id = st && ANIM(ART[k]) ? k + '-st' : k;
  return `<svg class="art ${cls}${SCENES.has(k) ? ' sc' : ''}${sh ? ' shn' : ''}" aria-hidden="true">${sh ? `<use href="#art-${k}-gl" class="glx" width="100%" height="100%"/>` : ''}<use href="#art-${id}-ol" class="olx" width="100%" height="100%"/><use href="#art-${id}" width="100%" height="100%"/>${sh ? `<use href="#art-shnx${st ? '-st' : ''}" class="shnx" width="100%" height="100%"/>` : ''}</svg>`;
};
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
export const repTag = u => String(u?.rep || '').split(',').filter(isArt).map(v => `<i class="rep" data-tip="대표 스티커">${artOf(v, 'repa')}</i>`).join('')
  + (u?.nfx === 'r:fxholo' ? '<i class="nfx nfx-holo" hidden></i>' : u?.nfx === 'r:fxgold' ? '<i class="nfx nfx-gold" hidden></i>' : '');   // 뽑기 닉네임 효과: 부모 글자에 CSS :has로 효과
export const ui = (k, cls = '') => { ensureSprite(); return `<svg class="att-ic ${cls}" viewBox="-1 -1 26 26" aria-hidden="true">${UI[k]}</svg>`; };
