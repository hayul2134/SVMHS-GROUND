// SVMHS GROUND — '나 집에 갈래!' (공룡 게임 방식 픽셀 러너) + 캐릭터 꾸미기
// 화면 논리 해상도 320×104 픽셀을 정수 배로 키워 그린다(이미지 부드럽게 끄기 → 또렷한 픽셀).
// 점수는 home-score.js(서버와 공용): 살아남은 시간 → 거리(m). 고정 타임스텝 1/60초.
// 캐릭터는 문자 그림(템플릿)을 부위별 색으로 칠해 프레임마다 미리 그려 둔다(바꿀 때만 다시).
import { V0, VMAX, speedAt, scoreAt } from './home-score.js';
import { store } from './util.js';

export const W = 320, H = 104, GROUND = 92, PX = 26;   // 화면 크기 · 땅 높이(발바닥 y) · 캐릭터 x
const STEP = 1 / 60;

/* ===== 꾸미기 옵션 ===== */
const OL = '#2a2846';   // 외곽선 (사이트 남색 선과 같은 계열)
const SKIN = [['#ffe3cc', '밝은'], ['#f7caa1', '보통'], ['#dca274', '구릿빛'], ['#a26d47', '갈색']];
const HAIR_C = [['#2c2a3c', '검정'], ['#5f3d26', '갈색'], ['#9a5a34', '밤색'], ['#f1c453', '금발'], ['#ff9fc6', '분홍'], ['#6fa3ff', '파랑'], ['#c9cfdc', '은색'], ['#e4594d', '빨강']];
const CLOTH_C = [['#34407a', '남색'], ['#7cc4ff', '하늘'], ['#f3f5fa', '흰색'], ['#9aa3b5', '회색'], ['#3b3b49', '검정'], ['#ff6f6f', '빨강'], ['#ffd25e', '노랑'], ['#62d9b8', '민트'], ['#ffa9cf', '분홍'], ['#a98bff', '보라']];
const BAG_C = [['', '없음'], ['#ff8a5b', '주황'], ['#ffd25e', '노랑'], ['#62d9b8', '민트'], ['#7cc4ff', '하늘'], ['#ffa9cf', '분홍'], ['#3b3b49', '검정'], ['#a98bff', '보라']];
const SHOE_C = [['#f3f5fa', '흰색'], ['#3b3b49', '검정'], ['#ff6f6f', '빨강'], ['#7cc4ff', '하늘'], ['#ffd25e', '노랑']];
export const OPTS = [
  { k: 'skin', name: '피부', colors: SKIN },
  { k: 'hair', name: '머리 모양', list: [['short', '짧은 머리'], ['bowl', '바가지'], ['spike', '삐죽'], ['bob', '단발'], ['pony', '포니테일'], ['long', '긴 머리'], ['buzz', '빡빡이']] },
  { k: 'hc', name: '머리 색', colors: HAIR_C },
  { k: 'top', name: '상의', list: [['blazer', '교복'], ['hoodie', '후드티'], ['tee', '반팔 티'], ['track', '체육복']] },
  { k: 'tc', name: '상의 색', colors: CLOTH_C },
  { k: 'bot', name: '하의', list: [['pants', '바지'], ['skirt', '치마'], ['shorts', '반바지']] },
  { k: 'bc', name: '하의 색', colors: CLOTH_C },
  { k: 'shoe', name: '신발', colors: SHOE_C },
  { k: 'bag', name: '가방', colors: BAG_C },
  { k: 'hat', name: '머리 소품', list: [['', '없음'], ['cap', '모자'], ['beanie', '비니'], ['phones', '헤드폰'], ['ribbon', '리본'], ['band', '머리띠']] },
  { k: 'face', name: '얼굴', list: [['', '기본'], ['blush', '볼터치'], ['glasses', '안경'], ['shades', '선글라스'], ['band', '반창고']] },
];
export const DEFAULT = { v: 1, skin: 1, hair: 'short', hc: 0, top: 'blazer', tc: 0, bot: 'pants', bc: 0, shoe: 0, bag: 1, hat: '', face: '' };
export function loadChar() {
  const c = { ...DEFAULT, ...(store.get('home_char', null) || {}) };
  for (const o of OPTS) {   // 저장값 검사 (옛 값·잘못된 값은 기본으로)
    const n = (o.colors || o.list).length;
    if (o.colors ? !(Number.isInteger(c[o.k]) && c[o.k] >= 0 && c[o.k] < n) : !o.list.some(x => x[0] === c[o.k])) c[o.k] = DEFAULT[o.k];
  }
  return c;
}
export const saveChar = c => store.set('home_char', c);
export function randomChar(rand = Math.random) {
  const c = { v: 1 };
  for (const o of OPTS) { const n = (o.colors || o.list).length; const i = Math.floor(rand() * n); c[o.k] = o.colors ? i : o.list[i][0]; }
  if (c.tc === c.bc && rand() < .7) c.bc = (c.bc + 3) % CLOTH_C.length;
  return c;
}

/* ===== 색 도우미 ===== */
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (h, k) => toHex(hex(h).map(v => v * (1 - k)));   // 어둡게
const tint = (h, k) => toHex(hex(h).map(v => v + (255 - v) * k));   // 밝게
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

/* ===== 캐릭터 그림 (문자 템플릿) =====
   o 외곽선 · s 피부 S 피부 그늘 · e 눈 · r 볼(볼터치일 때만) · h 머리 H 머리 그늘
   t 상의 T 상의 그늘 · a 상의 포인트(넥타이·끈·지퍼) · c 깃 · b 하의(엉덩이) B 하의 그늘 · l 다리(바지면 하의, 아니면 피부)
   k 신발 K 신발 밑창 · p 가방 P 가방 그늘 O 가방 외곽선 · w 흰색 · x 소품 색 X 소품 그늘 · g 렌즈 */
// 머리 판 18×13: 얼굴은 (3,1)부터 12×10
const HEAD = [
  '',
  '......oooooo',
  '.....osssssso',
  '....osssssssso',
  '....osssssssso',
  '....ossssssesso',
  '....ossssssesso',
  '....osssssssrso',
  '....oSsssssssso',
  '.....oSSsssso',
  '......oooooo',
];
const HAIRS = {
  short: [
    '......oooooo',
    '.....ohhhhhho',
    '....ohhhhhhhho',
    '....ohHhhhhhhho',
    '....ohHhhho',
    '....ohHh',
    '....ohh',
    '....oh',
  ],
  bowl: [
    '.....ooooooo',
    '....ohhhhhhho',
    '...ohhhhhhhhho',
    '...ohHhhhhhhhho',
    '...ohHhhhhhhhhho',
    '...ohHhhhoooooo',
    '...ohHho',
    '...ohho',
    '....oo',
  ],
  spike: [
    '.....o.o.o.o',
    '....ohohohoho',
    '....ohhhhhhhho',
    '...ohhhhhhhhhho',
    '...oHhhhhhhhhho',
    '....ohHhhoh.o',
    '....ohHh',
    '....ohh',
    '....oh',
  ],
  bob: [
    '......oooooo',
    '.....ohhhhhho',
    '....ohhhhhhhho',
    '...ohHhhhhhhhho',
    '...ohHhhhhhoo',
    '...ohHhho',
    '...ohHhho',
    '...ohHhho',
    '...ohHhho',
    '...ohHHho',
    '....oooo',
  ],
  pony: [
    '......oooooo',
    '.....ohhhhhho',
    '...ooohhhhhhho',
    '..ohhohHhhhhhho',
    '.ohHhohHhhho',
    '.ohHhohHh',
    '..ohhohh',
    '..ohHho',
    '...oho',
    '...oo',
  ],
  long: [
    '......oooooo',
    '.....ohhhhhho',
    '....ohhhhhhhho',
    '...ohHhhhhhhhho',
    '...ohHhhhhho',
    '...ohHhhho',
    '...ohHhho',
    '...ohHhho',
    '...ohHhho',
    '...ohHhho',
    '...ohHhho',
    '...ohHHho',
    '....oooo',
  ],
  buzz: [
    '',
    '......oooooo',
    '.....oHhHhHho',
    '....oHhHhHhHho',
    '....ohHh',
    '....oH',
  ],
};
// 머리 소품 (머리 판 좌표, 머리카락 위에 덮음)
const HATS = {
  cap: [
    '.....ooooooo',
    '....oxxxxxxxo',
    '...oxxxxxxxwxo',
    '...oXxxxxxxxxooooo',
    '...oXXXXXXXXXxxxxo',
    '....ooooooooooooo',
  ],
  beanie: [
    '.........oo',
    '.....ooooxxo',
    '....oxxxxxxxo',
    '...oxxxxxxxxxo',
    '...oxXxXxXxXxo',
    '...owwwwwwwwwwo',
    '....oooooooooo',
  ],
  phones: [
    '......oooooo',
    '.....oxXXXXXo',
    '....ox......xo',
    '....o........',
    '...ooo',
    '..oxxo',
    '..oxxo',
    '..oXxo',
    '...oo',
  ],
  ribbon: [
    '.oo.oo',
    'oxxoxxo',
    'oxXxXxo',
    'oxxoxxo',
    '.oo.oo',
  ],
  band: [
    '',
    '......oooooo',
    '.....oxxxxxxo',
    '....oXo....ox',
    '....oo',
  ],
};
const FACES = {   // 얼굴 소품 (머리 판 좌표)
  glasses: ['', '', '', '', '', '...........ooooo', '.........oooggo', '............oo'],
  shades: ['', '', '', '', '', '.........oooooooo', '.........ooOOOOo', '...........oooo'],
  band: ['', '', '', '', '', '', '', '...........wXw'],
};
// 몸 프레임 (판 24×23, 머리 판 위치 hx·hy, 치마 자리 sx·sy). 맨 아랫줄(22)이 땅에 닿음
const BODY = {
  run1: { hx: 1, hy: 0, sx: 5, sy: 16, rows: [
    '', '', '', '', '', '', '', '', '', '', '',
    '..OOOOoccccco',
    '..Opppotttato',
    '..OpPpotttatooo',
    '..OpPpoTttattttso',
    '..OPPpoTTtatoooo',
    '..OOOOoTTTTTo',
    '......obbbbbo',
    '......obbobbo',
    '.....ollo.ollo',
    '....ollo...ollo',
    '...okkko...okkko',
    '...oKKo.....oKKKo',
  ] },
  run2: { hx: 1, hy: 1, sx: 5, sy: 17, rows: [
    '', '', '', '', '', '', '', '', '', '', '', '',
    '..OOOOoccccco',
    '..Opppotttato',
    '..OpPpotttato',
    '..OpPpoTttato',
    '..OPPposTtato',
    '..OOOOoTTTTTo',
    '......obbbbbo',
    '......obbbbbo',
    '.....okkollo',
    '.....oKKolllo',
    '.........ollo',
    '.........oKKKo',
  ] },
  jump: { hx: 1, hy: 0, sx: 5, sy: 16, rows: [
    '', '', '', '', '', '', '', '', '', '', '',
    '..OOOOoccccco',
    '..Opppotttatooo',
    '..OpPpotttattso',
    '..OpPpoTttatooo',
    '..OPPpoTTtato',
    '..OOOOoTTTTTo',
    '......obbbbbbo',
    '......obbbbllo',
    '.......oolloollo',
    '.........okkkokkko',
    '.........oKKKoKKKo',
    '',
  ] },
  duck1: { hx: 8, hy: 6, sx: 2, sy: 16, rows: [
    '', '', '', '', '', '', '', '', '',
    '...OOOOOO',
    '..OppppppO',
    '..OpPPpppO',
    '..OOOOOOOOooo',
    '.otttttttttcc',
    '.otttttttttcc',
    '.oTTTttttttss',
    '.oooooooooooo',
    '..obbbbbbbo',
    '..obbo.obbo',
    '..ollo..ollo',
    '.okkko..okkko',
    '.oKKKo..oKKKo',
    '',
  ] },
  duck2: { hx: 8, hy: 7, sx: 2, sy: 16, rows: [
    '', '', '', '', '', '', '', '', '', '',
    '...OOOOOO',
    '..OppppppO',
    '..OpPPpppO',
    '..OOOOOOOOooo',
    '.otttttttttcc',
    '.oTTTttttttss',
    '.oooooooooooo',
    '...obbbbbbo',
    '...obbobbo',
    '..okkkolloo',
    '..oKKKokkko',
    '.......oKKKo',
    '',
  ] },
};
BODY.dead = { ...BODY.run1, dead: true };
const SKIRT = ['.obbbbbo.', 'obbbbbbbo', 'oBBBBBBBo'];
export const SPR_W = 24, SPR_H = 23;
const FRAMES = ['run1', 'run2', 'jump', 'duck1', 'duck2', 'dead'];

function palette(c) {
  const skin = SKIN[c.skin][0], hair = HAIR_C[c.hc][0], top = CLOTH_C[c.tc][0], bot = CLOTH_C[c.bc][0], shoe = SHOE_C[c.shoe][0], bag = BAG_C[c.bag][0];
  const accent = { blazer: '#e45c5c', hoodie: '#f3f5fa', tee: tint(top, .35), track: '#f3f5fa' }[c.top];
  const collar = { blazer: '#f3f5fa', hoodie: shade(top, .22), tee: skin, track: '#f3f5fa' }[c.top];
  const acc = { cap: CLOTH_C[(c.tc + 5) % CLOTH_C.length][0], beanie: CLOTH_C[(c.bc + 6) % CLOTH_C.length][0], phones: '#5b6278', ribbon: '#ff6f9a', band: '#ffd25e' }[c.hat] || '#ff6f9a';
  return {
    o: OL, s: skin, S: shade(skin, .14), e: OL, r: c.face === 'blush' ? '#ff8f9a' : skin,
    h: hair, H: shade(hair, .25), t: top, T: shade(top, .18), a: accent, c: collar,
    b: bot, B: shade(bot, .2), l: c.bot === 'pants' ? bot : skin,
    k: shoe, K: shade(shoe, .35), p: bag || null, P: bag ? shade(bag, .2) : null, O: bag ? OL : null,
    w: '#ffffff', x: acc, X: shade(acc, .25), g: '#cfefff',
  };
}
const put = (g, col, x0, y0, rows, pal, raw) => {
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) {
    const ch = row[x]; if (ch === '.' || ch === ' ') continue;
    const v = raw ? raw[ch] : pal[ch]; if (!v) continue;
    const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= SPR_W || Y >= SPR_H) continue;
    g[Y * SPR_W + X] = v;
  } });
};
// 프레임 그림(색 배열) → 캔버스. 치마는 몸 위, 머리는 맨 위
export function buildSprites(c) {
  const pal = palette(c), out = {};
  for (const f of FRAMES) {
    const B = BODY[f], g = new Array(SPR_W * SPR_H).fill(null);
    if (c.hair === 'long' || c.hair === 'bob') {   // 긴 머리·단발은 몸 뒤로도 내려옴 → 몸보다 먼저(뒤에) 그림
      put(g, null, B.hx, B.hy, HAIRS[c.hair], pal);
    }
    put(g, null, 0, 0, B.rows, pal);
    if (c.bot === 'skirt') put(g, null, B.sx, B.sy, SKIRT, pal);
    const hx = B.hx, hy = B.hy;
    put(g, null, hx + 3 - 3, hy, HEAD, pal);
    if (c.hat !== 'beanie' || true) put(g, null, hx, hy, HAIRS[c.hair], pal);
    if (c.face && FACES[c.face]) put(g, null, hx, hy, FACES[c.face], { ...pal, O: '#1d1b2e' });
    if (c.hat && HATS[c.hat]) {
      const dx = c.hat === 'ribbon' ? 2 : 0, dy = c.hat === 'ribbon' ? 1 : 0;
      put(g, null, hx + dx, hy + dy, HATS[c.hat], pal);
    }
    if (B.dead) {   // 눈을 X로
      const ex = hx + 11, ey = hy + 4;
      [[ex - 1, ey], [ex + 1, ey], [ex, ey + 1], [ex - 1, ey + 2], [ex + 1, ey + 2]].forEach(([x, y]) => { g[y * SPR_W + x] = OL; });
      [[ex, ey], [ex, ey + 2], [ex - 1, ey + 1], [ex + 1, ey + 1]].forEach(([x, y]) => { if (g[y * SPR_W + x] === OL) g[y * SPR_W + x] = pal.s; });
    }
    const cv = document.createElement('canvas'); cv.width = SPR_W; cv.height = SPR_H;
    const cx = cv.getContext('2d');
    g.forEach((v, i) => { if (v) { cx.fillStyle = v; cx.fillRect(i % SPR_W, (i / SPR_W) | 0, 1, 1); } });
    out[f] = cv;
    out[f + '_rim'] = rimCanvas(cv);
  }
  return out;
}

/* ===== 장애물·배경 그림 ===== */
const OBS = {   // 땅 위 장애물: w·h·그림 (o 외곽선, 나머지는 표 아래 색)
  books: { rows: [
    '.oooooooooo.',
    '.orrrrrrrro.',
    '.oRRRRRRRRo.',
    'oooooooooooo',
    'obbbbbbbbbwo',
    'oBBBBBBBBBBo',
    '.oooooooooo.',
    '.oyyyyyyyyo.',
    '.oYYYYYYYYo.',
    '.oooooooooo.',
  ], col: { r: '#ff7a7a', R: '#d95252', b: '#6fb2ff', B: '#4a86d6', w: '#ffffff', y: '#ffd25e', Y: '#d9a93a' } },
  cone: { rows: [
    '....oo....',
    '...oyyo...',
    '...oyYo...',
    '..owwwwo..',
    '..owwwWo..',
    '..oyyyYo..',
    '.oyyyyyYo.',
    '.owwwwwWo.',
    '.owwwwwWo.',
    'oyyyyyyyYo',
    'oyyyyyyyYo',
    'oooooooooo',
    'oDDDDDDDDo',
    'oooooooooo',
  ], col: { y: '#ff8a3d', Y: '#d4632a', w: '#ffffff', W: '#d8dee8', D: '#3b3b49' } },
  bin: { rows: [
    '..oooooooo..',
    '.oggggggggo.',
    'oooooooooooo',
    'oGgggggggwGo',
    '.oGggggggGo.',
    '.oGgogogogo.',
    '.oGgogogoGo.',
    '.oGgogogoGo.',
    '.oGgogogoGo.',
    '.oGgggggggo.',
    '.oGgggggggo.',
    '.oGGggggGGo.',
    '.oGGGGGGGGo.',
    '..oooooooo..',
  ], col: { g: '#5ccf8f', G: '#3aa36c', w: '#d9ffe9' } },
  desk: { rows: [
    'oooooooooooooooooo',
    'owwwwwwwwwwwwwwwWo',
    'oyyyyyyyyyyyyyyyYo',
    'oooooooooooooooooo',
    '.oo.oddddddddo.oo.',
    '.oo.oDDDDDDDDo.oo.',
    '.oo.oooooooooo.oo.',
    '.oo............oo.',
    '.oo............oo.',
    '.oo............oo.',
    '.oo............oo.',
    'oooo..........oooo',
  ], col: { w: '#f6e3c4', W: '#d8bf98', y: '#d6a96a', Y: '#b6864b', d: '#9aa3b5', D: '#727b8e' } },
  sign: { rows: [   // 공사 중 표지판
    'oooooooooooooo',
    'oywywywywywywo',
    'oywywywywywywo',
    'oooooooooooooo',
    '..oo......oo..',
    '..oo......oo..',
    '..oo......oo..',
    '.oooo....oooo.',
  ], col: { y: '#ffd25e', w: '#3b3b49' } },
};
const FLY = {   // 날아오는 것 (2프레임)
  pigeon: { f: [[
    '.....oo......',
    '....owwo.....',
    'oo.owwwWo....',
    'oGooggggwoooo',
    '.oggggggggyyo',
    '..oGGggggoeo.',
    '...ooooooooo.',
  ], [
    '.............',
    '.............',
    'ooo..oooo....',
    'oGGooggggoooo',
    '.oggggggggyyo',
    '..oGGwwwgoeo.',
    '...oowWWoooo.',
    '.....oooo....',
  ]], col: { g: '#a9b3c9', G: '#7d879e', w: '#e3e8f2', W: '#b9c1d3', y: '#ffb347', e: '#2a2846' } },
  plane: { f: [[
    'oooo..........',
    'owwWoooo......',
    '.owwwwwwoooo..',
    '..oWWWWwwwwwoo',
    '...ooWWWWooo..',
    '.....ooo......',
  ], [
    '..............',
    'oooooooo......',
    'owwwwwwwoooo..',
    '.oWWWWwwwwwwoo',
    '..oooWWWWooo..',
    '.....ooo......',
  ]], col: { w: '#fff1a8', W: '#e6c35c' } },   // 노란 메모지 비행기 — 흰색은 밝은 하늘에 묻힘
};
function rowsCanvas(rows, col) {   // col.o 가 있으면 외곽선 색을 바꿈(배경용 — 진한 외곽선은 앞 물체에만)
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.') continue; g.fillStyle = ch === 'o' ? (col.o || OL) : col[ch] || '#f0f'; g.fillRect(x, y, 1, 1); } });
  return cv;
}
// 테두리 빛(림): 그림 모양을 1px 넓혀 밝은 색으로 칠한 판 → 그림 뒤에 깔면 어떤 배경에서도 물체가 떨어져 보임
function rimCanvas(src) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const cv = document.createElement('canvas'); cv.width = w + 2; cv.height = h + 2;
  const g = cv.getContext('2d'); g.fillStyle = '#ffffff';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) {
    g.fillRect(x, y + 1, 3, 1); g.fillRect(x + 1, y, 1, 3);   // 상하좌우 1px
  }
  return cv;
}
let ART = null;
function art() {
  if (ART) return ART;
  ART = { obs: {}, fly: {} };
  for (const [k, v] of Object.entries(OBS)) ART.obs[k] = rowsCanvas(v.rows, v.col);
  for (const [k, v] of Object.entries(FLY)) ART.fly[k] = v.f.map(r => rowsCanvas(r, v.col));
  ART.cloud = rowsCanvas([
    '.....oooo.......',
    '...oowwwwoo.....',
    '..owwwwwwwwoooo.',
    '.owwwwwwwwwwwwwo',
    'owwwwwwwwwwwwWWo',
    '.oWWWWWWWWWWWWo.',
    '..oooooooooooo..',
  ], { w: '#ffffff', W: '#e6eff9', o: '#c4d6ea' });
  for (const k of Object.keys(ART.obs)) ART.obs[k + '_rim'] = rimCanvas(ART.obs[k]);
  for (const k of Object.keys(ART.fly)) ART.fly[k + '_rim'] = ART.fly[k].map(rimCanvas);
  return ART;
}

/* ===== 픽셀 숫자 (3×5) ===== */
const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  H: '101101111101101', I: '111010010010111', m: '000000111111101', S: '111100111001111', V: '101101101101010', M: '101111111101101', ' ': '000000000000000',
};
function pxText(g, s, x, y, color, sc = 1) {
  g.fillStyle = color;
  for (const ch of String(s)) {
    const f = FONT[ch] || FONT[' '];
    for (let i = 0; i < 15; i++) if (f[i] === '1') g.fillRect(x + (i % 3) * sc, y + ((i / 3) | 0) * sc, sc, sc);
    x += 4 * sc;
  }
  return x;
}

/* ===== 하늘 색 (오후 → 노을 → 밤, 1200m마다 한 바퀴) ===== */
const SKY = [
  { top: '#8fd3ff', bot: '#dff3ff', far: '#b8d6ee', farW: '#d5e7f6', ground: '#e9e2d3', line: '#7a6f63', road: '#a8a196', sun: '#ffe066', night: 0 },
  { top: '#ff9a8b', bot: '#ffd8a8', far: '#d79a9f', farW: '#ffc9a0', ground: '#ead1c0', line: '#7a5f63', road: '#b39490', sun: '#ffb35c', night: .25 },
  { top: '#1f2552', bot: '#3d3f7a', far: '#2e3266', farW: '#ffd879', ground: '#5d6086', line: '#2a2846', road: '#4a4c70', sun: '#f6f1d9', night: 1 },
];
function skyAt(m) {
  const cyc = m % 1200, seg = cyc / 400, i = Math.floor(seg), f = seg - i;
  const tr = Math.max(0, (f - .85) / .15);   // 구간 끝 15%에서 다음 색으로 넘어감
  const a = SKY[i % 3], b = SKY[(i + 1) % 3], o = {};
  for (const k of Object.keys(a)) o[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * tr : mix(a[k], b[k], tr);
  return o;
}

/* ===== 결정적 난수 ===== */
function rng(seed) {   // f.s = 내부 상태 (테스트에서 저장·복원)
  const f = () => { let a = f.s | 0; a = a + 0x6D2B79F5 | 0; f.s = a; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.s = seed >>> 0; return f;
}

/* ===== 게임 =====
   만들기: createRunner(canvas, char, { onOver(score, ms), onScore }) → { start(), destroy(), input(name, down) }
   입력: 'jump'(누르는 동안 더 높이), 'duck' */
export function createRunner(canvas, char, opt = {}) {
  const g = canvas.getContext('2d');
  canvas.width = W; canvas.height = H; g.imageSmoothingEnabled = false;
  let spr = buildSprites(char);
  const A = art();
  const st = {};
  let rand, raf = 0, last = 0, acc = 0, alive = true, sound = !!opt.sound, actx = null;
  const keys = { jump: false, duck: false };

  function reset(seed = (Math.random() * 1e9) | 0) {
    rand = rng(seed);
    Object.assign(st, {
      scene: 'ready', frames: 0, ms: 0, score: 0, speed: V0, scroll: 0,
      y: 0, vy: 0, onGround: true, jumpHeld: 0, ducking: false, anim: 0,
      obs: [], nextGap: 120, burst: 0, rest: false, nid: 0, flash: 0, lastHundred: 0, shake: 0, dust: [], deadT: 0,
      clouds: [0, 1, 2].map(i => ({ x: 40 + i * 120 + rand() * 60, y: 8 + rand() * 22 })),
      stars: Array.from({ length: 28 }, () => ({ x: rand() * W, y: rand() * 46, p: rand() * 6 })),
      seed,
    });
  }
  reset(opt.seed);

  /* --- 소리 (첫 입력 뒤에 만듦, 기본 꺼짐 — 교실) --- */
  function beep(f1, f2, dur, type = 'square', vol = .05) {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), v = actx.createGain(), t = actx.currentTime;
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(v).connect(actx.destination); o.start(t); o.stop(t + dur + .02);
    } catch {}
  }

  /* --- 판 --- */
  const JUMP_V = 270, G_HOLD = 820, G_FALL = 1500, G_FAST = 3200, HOLD_MAX = .2;
  function jump() {
    if (st.scene === 'ready') { st.scene = 'play'; opt.onStart?.(); }
    if (st.scene !== 'play' || !st.onGround) return false;
    st.vy = -JUMP_V; st.onGround = false; st.jumpHeld = 0; st.ducking = false;
    beep(520, 880, .09); return true;
  }
  /* 간격 설계 (2026-10-25): 일정한 간격 대신 '리듬' — 보통 · 짧게 · 숨 돌리기 · 연타(2~3개 바짝) 를 섞어 긴장감을 준다.
     못 피하는 배치는 만들지 않는다: 모든 간격은 FAIR 이상.
     FAIR 근거(짧은 점프 기준): 고깔(14px)을 넘으려면 12px 이상 떠 있어야 하고, 그 높이 위에 있는 시간은 0.256초, 점프 전체 0.36초.
     → 앞 장애물을 가장 늦게 넘으면 착지(0.052초) + 다시 뛰어 12px까지(0.052초) = 0.104초면 두 번 넘을 수 있음(이론 최소).
     가장 일찍 넘은 경우(넘자마자 아직 떠 있음)도 착지 0.31초 + 다시 0.05초 = 0.36초.
     → 끝-끝 간격을 12px + 속도×0.40초 이상으로 둬서, 앞 장애물을 짧은 점프로 '어느 타이밍에 넘든' 다음 것을 넘을 수 있게 함.
       (길게 누른 큰 점프는 ↓로 빨리 내려올 수 있음) 2026-10-25 헤드리스 봇(모든 점프 시점을 되감아 시험)으로 30판 검증. */
  const FAIR_T = .40, FAIR_PX = 12;
  const fairGap = sp => FAIR_PX + sp * FAIR_T;
  function spawn() {
    const m = st.score, sp = st.speed, inBurst = st.burst > 0;
    let o;
    if (!inBurst && m > 220 && rand() < (m > 900 ? .3 : .2)) {   // 날아오는 것: 낮게(점프) · 머리 높이(숙이거나 점프) · 높게(그냥 지나감)
      const kind = rand() < .6 ? 'pigeon' : 'plane', spr0 = A.fly[kind][0];
      const lv = [GROUND - 4, GROUND - 19, GROUND - 32][Math.floor(rand() * 3)];
      const dx = kind === 'plane' ? 40 : 18;
      // 날아오는 건 땅보다 빨리 다가오므로, 도착 시각이 땅 장애물과 같도록 화면 밖 더 먼 곳에서 출발 (안 그러면 앞 장애물과 간격이 줄어듦)
      // 날아오는 것은 대처(점프·가만히·숙이기)가 달라 읽을 시간이 더 필요 → 앞뒤 간격을 넉넉히(속도×0.6초 + 20px 이상)
      const prev = st.obs[st.obs.length - 1], need = sp * .6 + 20;
      const gx = W + 4 + (prev && !prev.fly ? Math.max(0, need - (W + 4 - (prev.x + prev.w))) : 0);
      const x = PX + (gx - PX) * (sp + dx) / sp;
      o = { fly: kind, w: spr0.width, h: spr0.height, x, y: lv - spr0.height, dx };
    } else {
      const pool = m < 120 ? ['books', 'cone', 'books'] : ['books', 'cone', 'bin', 'desk', 'sign', 'cone'];
      const k = pool[Math.floor(rand() * pool.length)], img = A.obs[k];
      // 처음엔 하나씩, 빨라지면 2~3개 묶음 — 연타 중에는 묶음 없음(넓은 묶음 뒤 바짝 붙이면 큰 점프 착지가 늦어 위험)
      const n = !inBurst && (k === 'books' || k === 'cone') && sp > 190 ? 1 + Math.floor(rand() * (sp > 260 ? 3 : 2)) : 1;
      o = { k, n, w: img.width * n + (n - 1), h: img.height, x: W + 4, y: GROUND - img.height };
    }
    o.id = ++st.nid; st.obs.push(o);
    // 다음 간격 고르기
    const r = rand();
    let gap;
    if (st.burst > 0) {   // 연타 진행 중
      st.burst--;
      gap = sp * (FAIR_T + .03 + rand() * .1) + FAIR_PX;
      if (st.burst === 0) st.rest = true;
    } else if (st.rest) {   // 연타 직후엔 숨 돌리기
      st.rest = false;
      gap = sp * (1.4 + rand() * .6);
    } else {
      const pBurst = m < 150 ? 0 : Math.min(.3, .1 + m / 4000);
      const pShort = m < 60 ? 0 : .22, pBreath = .16;
      if (!o.fly && o.n === 1 && r < pBurst) {   // 연타 시작: 2개(초반) ~ 3개(500m 이후)
        st.burst = m > 500 && rand() < .45 ? 1 : 0;
        gap = sp * (FAIR_T + .03 + rand() * .1) + FAIR_PX;
        if (st.burst === 0) st.rest = true;
      } else if (r < pBurst + pShort) gap = sp * (.45 + rand() * .15) + FAIR_PX;   // 짧게
      else if (r < pBurst + pShort + pBreath) gap = sp * (1.7 + rand() * .8);      // 길게(숨 돌리기)
      else gap = sp * (.75 + rand() * .55);                                            // 보통
    }
    st.nextGap = Math.max(fairGap(sp), gap, o.fly ? sp * .6 + 20 : 0);
  }
  const box = () => st.ducking && st.onGround
    ? { x: PX + 3, y: GROUND - 14, w: 19, h: 13 }
    : { x: PX + 6, y: GROUND + st.y - 21, w: 9, h: 20 };
  function hits(o) {
    const b = box();
    const m = o.fly ? 2 : 1;   // 조금 너그럽게
    return b.x < o.x + o.w - m && b.x + b.w > o.x + m && b.y < o.y + o.h - m && b.y + b.h > o.y + m;
  }

  function update(dt) {
    st.anim += dt;
    for (const c of st.clouds) { c.x -= (st.scene === 'play' ? st.speed * .12 : 6) * dt; if (c.x < -20) { c.x = W + rand() * 80; c.y = 8 + rand() * 22; } }
    for (const d of st.dust) { d.x -= (st.speed * dt) * (st.scene === 'play' ? 1 : 0) + d.vx * dt; d.y += d.vy * dt; d.t -= dt; }
    st.dust = st.dust.filter(d => d.t > 0);
    if (st.shake > 0) st.shake -= dt;
    if (st.scene === 'dead') { st.deadT += dt; return; }
    if (st.scene !== 'play') { st.y = Math.sin(st.anim * 3) * 0; return; }

    st.frames++; st.ms = Math.round(st.frames * 50 / 3);
    st.speed = speedAt(st.ms / 1000);
    const s = scoreAt(st.ms);
    if (Math.floor(s / 100) > st.lastHundred) { st.lastHundred = Math.floor(s / 100); st.flash = 1; beep(780, 1180, .12, 'square', .04); }
    st.score = s;
    if (st.flash > 0) st.flash -= dt * .9;

    // 캐릭터
    if (!st.onGround) {
      if (keys.jump && st.vy < 0 && st.jumpHeld < HOLD_MAX) st.jumpHeld += dt;
      const gr = keys.duck ? G_FAST : (keys.jump && st.vy < 0 && st.jumpHeld < HOLD_MAX) ? G_HOLD : G_FALL;
      st.vy += gr * dt; st.y += st.vy * dt;
      if (st.y >= 0) {
        st.y = 0; st.vy = 0; st.onGround = true;
        for (let i = 0; i < 4; i++) st.dust.push({ x: PX + 6 + rand() * 10, y: GROUND - 1, vx: -10 + rand() * 30, vy: -8 - rand() * 10, t: .25 + rand() * .15 });
        if (keys.jump) jump();   // 누르고 있으면 바로 다시
      }
    } else st.ducking = keys.duck;
    if (st.onGround && !st.ducking && st.frames % 9 === 0 && rand() < .5) st.dust.push({ x: PX + 6, y: GROUND - 1, vx: 4, vy: -4, t: .18 });

    // 장애물
    const mv = st.speed * dt;
    st.scroll += mv;
    for (const o of st.obs) o.x -= mv + (o.dx || 0) * dt;
    st.obs = st.obs.filter(o => o.x + o.w > -10);
    const lastO = st.obs[st.obs.length - 1];
    if (!lastO || W - (lastO.x + lastO.w) > st.nextGap) spawn();
    for (const o of st.obs) if (hits(o)) return die();
  }
  function die() {
    st.scene = 'dead'; st.deadT = 0; st.shake = .25;
    beep(300, 70, .35, 'sawtooth', .06);
    opt.onOver?.(st.score, st.ms);
  }

  /* --- 그리기 --- */
  function draw() {
    const sk = skyAt(st.score);
    g.save();
    if (st.shake > 0) g.translate(Math.round((rand() - .5) * 4), Math.round((rand() - .5) * 3));
    // 하늘: 계단식 띠
    for (let i = 0; i < 8; i++) { g.fillStyle = mix(sk.top, sk.bot, i / 7); g.fillRect(-4, i * 12 - 4, W + 8, i === 7 ? H : 13); }   // 땅까지 덮어야 이전 프레임이 안 남음
    // 별
    if (sk.night > .3) {
      for (const s of st.stars) {
        const tw = Math.sin(st.anim * 2 + s.p) > -.2;
        if (!tw) continue;
        g.globalAlpha = Math.min(1, (sk.night - .3) * 1.6);
        g.fillStyle = '#fff6c9'; g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      g.globalAlpha = 1;
    }
    // 해·달: 오후엔 높이, 노을엔 낮게, 밤엔 달
    const seg = (st.score % 1200) / 400;
    if (sk.night > .5) {
      const mx = W - 74, my = 10;   // 초승달
      g.fillStyle = sk.sun;
      ['..####..', '.###....', '###.....', '###.....', '###.....', '###.....', '.###....', '..####..'].forEach((r, y) => { for (let x = 0; x < 8; x++) if (r[x] === '#') g.fillRect(mx + x, my + y, 1, 1); });
    } else {
      const sx = W - 78, sy = Math.round(9 + Math.min(seg, 2) * 13);
      g.fillStyle = mix(sk.sun, sk.top, .55); g.fillRect(sx - 1, sy + 2, 12, 6); g.fillRect(sx + 2, sy - 1, 6, 12);
      g.fillStyle = sk.sun; g.fillRect(sx, sy + 2, 10, 6); g.fillRect(sx + 2, sy, 6, 10); g.fillRect(sx + 1, sy + 1, 8, 8);
    }
    // 구름
    g.globalAlpha = sk.night > .5 ? .35 : .95;
    for (const c of st.clouds) g.drawImage(A.cloud, Math.round(c.x), Math.round(c.y));
    g.globalAlpha = 1;
    // 먼 건물 (아파트·빌딩)
    drawCity(sk, st.scroll * .12);
    drawTrees(sk, st.scroll * .45);
    // 가로등·학교도 배경 → 안개를 씌우기 전에 그림
    drawLamps(sk);
    drawSchool(sk);
    // 배경 안개(공기 원근): 배경을 하늘색 쪽으로 밀어 대비를 낮춤 → 진한 외곽선을 가진 장애물·캐릭터만 또렷하게 튀어나옴
    // 건물 높이 띠에만, 위로 갈수록 옅게 계단식(해·달·구름·별은 그대로, 경계선이 안 보이게)
    const hz = sk.night > .5 ? .38 : .42;
    g.fillStyle = sk.bot;
    [[52, .3], [40, .62], [28, 1]].forEach(([h, k], i, arr) => { g.globalAlpha = hz * k; g.fillRect(0, GROUND - h, W, h - (arr[i + 1]?.[0] ?? 0)); });
    g.globalAlpha = 1;
    // 땅: 보도블록 + 도로
    g.fillStyle = sk.ground; g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = sk.line; g.fillRect(0, GROUND, W, 1);
    g.fillStyle = mix(sk.ground, sk.line, .25);
    const off = Math.floor(st.scroll) % 16;
    for (let x = -off; x < W; x += 16) { g.fillRect(x, GROUND + 1, 1, 5); g.fillRect(x + 8, GROUND + 6, 1, 4); }
    g.fillRect(0, GROUND + 6, W, 1);
    g.fillStyle = sk.road; g.fillRect(0, GROUND + 10, W, H - GROUND - 10);
    g.fillStyle = mix(sk.road, '#ffffff', .55);
    const off2 = Math.floor(st.scroll * 1.0) % 40;
    for (let x = -off2; x < W; x += 40) g.fillRect(x, GROUND + 11, 14, 1);
    // 장애물
    // 장애물: 땅 그림자 → 밝은 테두리(림) → 그림. 림은 밤에 더 진하게(외곽선이 밤하늘과 같은 남색이라 묻힘)
    const rimA = .55 + sk.night * .35;
    for (const o of st.obs) {
      const X = Math.round(o.x), Y = Math.round(o.y);
      if (o.fly) {
        const fi = Math.floor(st.anim * (o.fly === 'plane' ? 4 : 8)) % 2, bob = o.fly === 'plane' ? Math.round(Math.sin(st.anim * 5) * 1) : 0;
        g.globalAlpha = .18; g.fillStyle = OL; g.fillRect(X + 2, GROUND, o.w - 4, 1);   // 땅에 비친 그림자 → 높이 가늠
        g.globalAlpha = rimA; g.drawImage(A.fly[o.fly + '_rim'][fi], X - 1, Y + bob - 1);
        g.globalAlpha = 1; g.drawImage(A.fly[o.fly][fi], X, Y + bob);
      } else {
        const img = A.obs[o.k], rim = A.obs[o.k + '_rim'];
        g.fillStyle = 'rgba(42,40,70,.28)'; g.fillRect(X - 1, GROUND, o.w + 2, 2);
        g.globalAlpha = rimA; for (let i = 0; i < o.n; i++) g.drawImage(rim, X + i * (img.width + 1) - 1, Y - 1);
        g.globalAlpha = 1; for (let i = 0; i < o.n; i++) g.drawImage(img, X + i * (img.width + 1), Y);
      }
    }
    // 흙먼지
    g.fillStyle = mix(sk.ground, sk.line, .4);
    for (const d of st.dust) g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    // 캐릭터 그림자 + 몸
    const air = -st.y;
    g.fillStyle = 'rgba(42,40,70,.22)';
    const shw = Math.max(4, 12 - Math.round(air / 6));
    g.fillRect(PX + 12 - (shw >> 1), GROUND, shw, 1);
    let f;
    if (st.scene === 'dead') f = 'dead';
    else if (!st.onGround) f = 'jump';
    else if (st.ducking) f = Math.floor(st.anim * 10) % 2 ? 'duck2' : 'duck1';
    else if (st.scene === 'play') f = Math.floor(st.anim * (8 + st.speed / 40)) % 2 ? 'run2' : 'run1';
    else f = Math.floor(st.anim * 2) % 2 ? 'run1' : 'run1';
    const cy = Math.round(GROUND - SPR_H + st.y + (st.scene === 'ready' && Math.floor(st.anim * 2) % 2 ? 1 : 0));
    g.globalAlpha = rimA; g.drawImage(spr[f + '_rim'], PX - 1, cy - 1); g.globalAlpha = 1;
    g.drawImage(spr[f], PX, cy);
    // 점수
    const hi = opt.best?.() || 0;
    let x = W - 4 - (('' + Math.max(hi, 0)).padStart(5, '0').length + 1 + 5 + 3) * 4;
    const fg = sk.night > .5 ? '#e9ecff' : '#2a2846';
    if (hi > 0) { x = pxText(g, 'HI', x - 4, 4, mix(fg, sk.top, .45)); x = pxText(g, ' ' + String(hi).padStart(5, '0'), x, 4, mix(fg, sk.top, .45)); }
    else x = W - 4 - 7 * 4;
    const blink = st.flash > 0 && Math.floor(st.flash * 8) % 2 === 0;
    if (!blink) { x = pxText(g, ' ' + String(st.flash > 0 ? st.lastHundred * 100 : st.score).padStart(5, '0'), x, 4, fg); pxText(g, 'm', x, 4, fg); }
    g.restore();
  }
  function drawCity(sk, sc) {   // 먼 아파트·빌딩 (160px 무늬 반복)
    const tile = 160, off = Math.floor(sc) % tile, col = mix(sk.far, sk.bot, .3);
    for (let t = -1; t < 3; t++) {
      const r = rng(97);
      let x = t * tile - off;
      while (x < t * tile - off + tile) {
        const w = 12 + Math.floor(r() * 16), h = 12 + Math.floor(r() * 30), top = GROUND - h;
        g.fillStyle = col; g.fillRect(x, top, w, h);
        if (r() < .35) g.fillRect(x + (w >> 1) - 1, top - 4, 2, 4);   // 옥상 안테나
        g.fillStyle = sk.night > .4 ? mix(sk.farW, col, .35) : mix(col, '#ffffff', .25);
        for (let wy = top + 3; wy < GROUND - 3; wy += 4)
          for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < (sk.night > .4 ? .3 : .3)) g.fillRect(wx, wy, 2, 2);
        x += w + 1 + Math.floor(r() * 7);
      }
    }
  }
  function drawTrees(sk, sc) {   // 가로수
    const gap = 74, off = Math.floor(sc) % gap;
    const leaf = mix('#8fcf99', sk.far, sk.night * .6 + .35), dark = shade(leaf, .12), trunk = mix('#9b6b4a', sk.far, sk.night * .5 + .35);
    for (let x = -off + 20; x < W + 12; x += gap) {
      g.fillStyle = trunk; g.fillRect(x + 4, GROUND - 7, 2, 7);
      g.fillStyle = leaf; g.fillRect(x + 1, GROUND - 18, 8, 10);
      g.fillStyle = dark; g.fillRect(x + 1, GROUND - 11, 8, 3); g.fillRect(x + 6, GROUND - 17, 3, 6);
      g.fillStyle = tint(leaf, .25); g.fillRect(x + 2, GROUND - 17, 2, 2);
    }
  }
  function drawLamps(sk) {
    const gap = 110, off = Math.floor(st.scroll * .8) % gap;
    for (let x = -off + 60; x < W + 10; x += gap) {
      if (sk.night > .5) { g.fillStyle = 'rgba(255,230,150,.16)'; g.fillRect(x - 9, GROUND - 26, 22, 26); g.fillRect(x - 5, GROUND - 30, 14, 4); }
      g.fillStyle = mix(sk.line, sk.far, .45); g.fillRect(x + 1, GROUND - 30, 2, 30); g.fillRect(x + 1, GROUND - 31, 7, 2);
      g.fillStyle = sk.night > .5 ? '#ffe58a' : '#e6ebf2'; g.fillRect(x + 6, GROUND - 29, 3, 2);
    }
  }
  function drawSchool(sk) {
    const x = Math.round(-6 - st.scroll * .8);
    if (x < -120) return;
    const y = GROUND - 44;
    g.fillStyle = mix('#e8eef8', sk.far, .3); g.fillRect(x, y, 70, 44);
    g.fillStyle = mix(sk.line, sk.far, .4); g.fillRect(x, y, 70, 1); g.fillRect(x + 69, y, 1, 44);
    g.fillStyle = mix('#8fc3ff', sk.top, .3);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) g.fillRect(x + 5 + c * 10, y + 14 + r * 9, 6, 5);
    g.fillStyle = '#3e6fd8'; g.fillRect(x + 14, y + 3, 40, 8);
    pxText(g, 'SVMHS', x + 16, y + 4, '#ffffff');
    // 교문 기둥
    g.fillStyle = mix(sk.line, sk.far, .4); g.fillRect(x + 76, GROUND - 18, 4, 18); g.fillRect(x + 100, GROUND - 18, 4, 18);
  }

  /* --- 루프 --- */
  function frame(t) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = t; return; }
    const dt = Math.min(.1, (t - (last || t)) / 1000); last = t;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
  }
  raf = requestAnimationFrame(frame);

  const api = {
    st, reset, jump,
    input(name, down) {
      if (name === 'jump') { if (down && !keys.jump) jump(); keys.jump = down; }
      if (name === 'duck') { keys.duck = down; if (down && st.scene === 'ready') { st.scene = 'play'; opt.onStart?.(); } }
    },
    setChar(c) { spr = buildSprites(c); },
    setSound(v) { sound = v; },
    destroy() { alive = false; cancelAnimationFrame(raf); try { actx?.close(); } catch {} },
    step(n = 1, quiet = false) { for (let i = 0; i < n; i++) update(STEP); if (!quiet) draw(); },   // 테스트용
    draw,
    snap: () => ({ st: structuredClone(st), r: rand.s, keys: { ...keys } }),   // 테스트용 저장·복원
    load(sn) { Object.assign(st, structuredClone(sn.st)); rand.s = sn.r; Object.assign(keys, sn.keys); },
  };
  return api;
}

/* ===== 캐릭터 미리보기 (꾸미기 화면용, 크게) ===== */
export function drawPreview(canvas, char, frame = 'run1') {
  const s = buildSprites(char), g = canvas.getContext('2d');
  canvas.width = SPR_W; canvas.height = SPR_H;
  g.clearRect(0, 0, SPR_W, SPR_H); g.drawImage(s[frame], 0, 0);
  return s;
}
export const optSwatch = (o, i) => o.colors[i][0];
