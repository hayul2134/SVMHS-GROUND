// 급식 메뉴 이름 → 식판 칸에 놓을 '진짜 음식 같은' 그림(SVG 문자열)
// 2025.03~2026.10 서울영상고 급식 메뉴 855종(나이스)을 분류해 만든 규칙. 같은 이름은 항상 같은 모양(이름으로 시드).
// 그라디언트·필터 없이 도형만 겹쳐 그림 → id 충돌 없음, 태블릿에서도 가볍게.

const seedOf = s => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) {
  let a = seed || 1;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const f = n => Math.round(n * 10) / 10;

/* ---------- 그리기 도구 ---------- */
class Pen {
  constructor(w, h, seed) { this.w = w; this.h = h; this.r = rng(seed); this.o = []; }
  R(a, b) { return a + (b - a) * this.r(); }
  pick(a) { return a[Math.floor(this.r() * a.length)]; }
  // 음식이 담기는 영역(칸 가장자리는 조금 비움) 안의 임의 점
  pt(k = 1) {
    const a = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * k;
    return [this.w / 2 + Math.cos(a) * d * this.w * .4, this.h / 2 + Math.sin(a) * d * this.h * .37];
  }
  // 울퉁불퉁한 덩어리 경로
  blob(cx, cy, rx, ry, jit = .18, n = 9, rot = 0) {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * Math.PI * 2 + this.R(-.2, .2), k = 1 + this.R(-jit, jit);
      p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let s = m(p[n - 1], p[0]), d = `M${f(s[0])} ${f(s[1])}`;
    for (let i = 0; i < n; i++) { const q = m(p[i], p[(i + 1) % n]); d += `Q${f(p[i][0])} ${f(p[i][1])} ${f(q[0])} ${f(q[1])}`; }
    return d + 'Z';
  }
  add(s) { this.o.push(s); return this; }
  path(d, fill, extra = '') { return this.add(`<path d="${d}" fill="${fill}"${extra}/>`); }
  // 그림자 + 몸통 + 윤기
  lump(cx, cy, rx, ry, col, { sh = .5, hi = .4, jit = .2, n = 9, light = '#fff' } = {}) {
    const rot = this.R(0, 6.28);
    if (sh) this.path(this.blob(cx + rx * .12, cy + ry * .22, rx, ry, jit, n, rot), '#000', ` opacity="${sh * .32}"`);
    this.path(this.blob(cx, cy, rx, ry, jit, n, rot), col);
    if (hi) this.path(this.blob(cx - rx * .28, cy - ry * .3, rx * .38, ry * .26, .25, 7), light, ` opacity="${hi * .55}"`);
    return this;
  }
  // 칸 전체가 국물/소스로 찬 모양
  liquid(col, rim, sheen = .22) {
    const { w, h } = this;
    this.add(`<rect x="-2" y="-2" width="${w + 4}" height="${h + 4}" fill="${col}"/>`);
    this.add(`<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="none" stroke="${rim}" stroke-width="7" opacity=".45"/>`);
    this.add(`<ellipse cx="${f(w * .34)}" cy="${f(h * .28)}" rx="${f(w * .26)}" ry="${f(h * .12)}" fill="#fff" opacity="${sheen}" transform="rotate(-12 ${f(w * .34)} ${f(h * .28)})"/>`);
    return this;
  }
  // 밑에 깔리는 넓은 더미(밥·나물 등)
  bed(col, dark, k = 1) {
    const { w, h } = this, rot = this.R(0, 6);
    this.path(this.blob(w / 2 + 2, h / 2 + 3, w * .44 * k, h * .41 * k, .1, 12, rot), '#000', ' opacity=".14"');
    this.path(this.blob(w / 2, h / 2, w * .44 * k, h * .41 * k, .1, 12, rot), col);
    if (dark) this.path(this.blob(w / 2 + w * .1, h / 2 + h * .12, w * .3 * k, h * .25 * k, .2, 9), dark, ' opacity=".35"');
    return this;
  }
  grains(pal, n, rx = 2.6, ry = 1.4, k = 1) {
    for (let i = 0; i < n; i++) {
      const [x, y] = this.pt(k), a = f(this.R(0, 180));
      this.add(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${rx}" ry="${ry}" fill="${this.pick(pal)}" transform="rotate(${a} ${f(x)} ${f(y)})"/>`);
    }
    return this;
  }
  dots(pal, n, r0, r1, k = 1, op = 1) {
    for (let i = 0; i < n; i++) { const [x, y] = this.pt(k); this.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(this.R(r0, r1))}" fill="${this.pick(pal)}"${op < 1 ? ` opacity="${op}"` : ''}/>`); }
    return this;
  }
  strands(pal, n, len, wd, k = 1, op = 1) {
    for (let i = 0; i < n; i++) {
      const [x, y] = this.pt(k), a = this.R(0, 6.28), L = len * this.R(.6, 1.2), b = a + this.R(-.9, .9);
      const x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L, cx = x + Math.cos(b) * L * .6, cy = y + Math.sin(b) * L * .6;
      this.add(`<path d="M${f(x)} ${f(y)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}" stroke="${this.pick(pal)}" stroke-width="${f(wd * this.R(.75, 1.25))}" stroke-linecap="round" fill="none"${op < 1 ? ` opacity="${op}"` : ''}/>`);
    }
    return this;
  }
  rects(pal, n, s, k = 1, rr = 1.5, sh = true) {
    for (let i = 0; i < n; i++) {
      const [x, y] = this.pt(k), a = f(this.R(-35, 35)), z = s * this.R(.8, 1.2), c = this.pick(pal);
      const t = `transform="rotate(${a} ${f(x)} ${f(y)})"`;
      if (sh) this.add(`<rect x="${f(x - z / 2 + 1)}" y="${f(y - z / 2 + 1.6)}" width="${f(z)}" height="${f(z)}" rx="${rr}" fill="#000" opacity=".16" ${t}/>`);
      this.add(`<rect x="${f(x - z / 2)}" y="${f(y - z / 2)}" width="${f(z)}" height="${f(z)}" rx="${rr}" fill="${c}" ${t}/>`);
      this.add(`<rect x="${f(x - z / 2 + z * .15)}" y="${f(y - z / 2 + z * .12)}" width="${f(z * .45)}" height="${f(z * .22)}" rx="1" fill="#fff" opacity=".35" ${t}/>`);
    }
    return this;
  }
  // 깨·파 등 고명
  sesame(n = 10, k = .9) { for (let i = 0; i < n; i++) { const [x, y] = this.pt(k); this.add(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="1.1" ry=".6" fill="#f8f0d8" transform="rotate(${f(this.R(0, 180))} ${f(x)} ${f(y)})"/>`); } return this; }
  scallion(n = 6, k = .85) { for (let i = 0; i < n; i++) { const [x, y] = this.pt(k); this.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(this.R(1.4, 2.2))}" fill="none" stroke="${this.pick(['#5fa83a', '#7cc04a', '#4c8f2c'])}" stroke-width="1.1"/>`); } return this; }
  flakes(n = 14, k = .9) { return this.dots(['#b3231a', '#cf3a22', '#8f1c14'], n, .5, 1, k); }
  svg() { return `<svg class="food" viewBox="0 0 ${this.w} ${this.h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${this.o.join('')}</svg>`; }
}

/* ---------- 재료 팔레트 ---------- */
const WHITE_RICE = ['#fbfaf4', '#f3efe3', '#ebe5d4', '#fffdf8'];
const RICE_MIX = [
  [/흑미/, ['#7b4b70', '#5e3757', '#8e5b80', '#efe4ea', '#e6d6df']],
  [/잡곡|혼합|오곡|찰보리|귀리/, [...WHITE_RICE, '#6b3a5b', '#c9a66b', '#8b6a44', '#b58f5a']],
  [/보리/, [...WHITE_RICE, '#e3d3ad', '#d8c494', '#cdb582']],
  [/현미/, ['#ead7aa', '#dfc78f', '#f1e4c4', '#d4b97c']],
  [/기장|차조|조밥|좁쌀/, [...WHITE_RICE, '#e9c84a', '#f0d55e']],
  [/수수/, [...WHITE_RICE, '#a4583e', '#b8694b']],
  [/퀴노아|렌틸/, [...WHITE_RICE, '#c79a6a', '#b0443b', '#e3c493']],
];
const SOUP = {   // 국물 색, 테두리
  red: ['#cf4b2a', '#8f2a16'], miyeok: ['#8a6c3c', '#5a4320'], doen: ['#b88a4e', '#7a5428'],
  milk: ['#eee6d4', '#c7b897'], clear: ['#e8cf8d', '#b89a52'], perilla: ['#d9c5a0', '#a8916a'],
  cream: ['#f2e2b6', '#c9b07a'], mush: ['#cdb595', '#9a7f5c'], pumpkin: ['#f0b84a', '#c98a1e'], jjajang: ['#3e2a1c', '#21150c'],
};

/* ---------- 종류별 그림 ---------- */
const DRAW = {
  rice(p, n) {
    const extra = (RICE_MIX.find(([re]) => re.test(n)) || [, WHITE_RICE])[1];
    p.bed("#f4f0e4", "#d9d0bb").grains(extra, 115, 2.6, 1.4);
    if (/검은콩|서리태|콩밥/.test(n)) for (let i = 0; i < 9; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 3.6, 2.6, '#1d1a1f', { sh: .4, hi: .6, n: 7 }); }
    if (/완두/.test(n)) for (let i = 0; i < 10; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 2.6, 2.6, '#79b443', { sh: .3, hi: .5, n: 7 }); }
    if (/옥수수/.test(n)) p.rects(['#f2c53d', '#f6d65a'], 16, 3.4, .85, 1.2);
  },
  mixRice(p, n) {   // 볶음밥·비빔밥·김밥류
    const base = /김치|고추장|비빔/.test(n) ? ['#d77a4a', '#e09060', '#c86a3c', '#f0d7b8'] : /카레/.test(n) ? ['#e2b44a', '#eac46a'] : ['#e9cf98', '#f1dcae', '#dcbf84', '#f6ead0'];
    p.bed(base[0]).grains(base, 140, 2.6, 1.4);
    if (/비빔|나물/.test(n)) { p.strands(['#3f7d2a', '#5d9a36'], 10, 10, 1.8, .7); p.strands(['#e07a2e'], 6, 9, 1.6, .7); p.strands(['#f0e6c0'], 6, 9, 1.6, .7); p.lump(p.w / 2, p.h / 2, 10, 9, '#fbf6ea', { hi: .3 }).lump(p.w / 2 + 2, p.h / 2 - 1, 4.4, 4, '#f3b51f', { sh: 0 }); return; }
    p.rects(['#e8752e', '#7cb648', '#f2d04a', '#e79a8e'], 16, 3.6, .85, 1);
    if (/김자반|김가루|주먹밥/.test(n)) p.rects(['#1f2a1d', '#2c3a26'], 18, 2.6, .85, .5, false);
    if (/참치/.test(n)) p.dots(['#d9b48a', '#c99e70'], 12, 1.5, 2.6, .7);
    if (/계란|오므/.test(n)) p.rects(['#f6d252', '#fbe28a'], 10, 3.8, .8, 1.4);
  },
  sauceRice(p, n) {   // 카레라이스·짜장밥·덮밥
    const [col, dk, veg] = /짜장/.test(n) ? ['#3b281b', '#22160d', ['#7a5a3a', '#4f8f35', '#e6d7b8']]
      : /카레|커리/.test(n) ? ['#d79a2b', '#a96c12', ['#f2d79c', '#e5762c', '#8a5130']]
      : /마파/.test(n) ? ['#b9452a', '#7a2a16', ['#f6f0dd', '#5a9a37', '#8a5130']]
      : /제육|고추장|김치|닭갈비/.test(n) ? ['#bf4a26', '#7d2a14', ['#9a3a1c', '#f0e2c6', '#5a9a37']]
      : /참치마요|치킨마요|스팸마요/.test(n) ? ['#f2ead2', '#cfc29b', ['#c99e70', '#1f2a1d', '#d77a4a']]
      : ['#7a4426', '#4b2814', ['#8a4f2c', '#f0e2c6', '#5a9a37']];
    p.bed('#f4f0e4', '#d9d0bb').grains(WHITE_RICE, 90, 2.6, 1.4);
    const { w, h } = p;
    p.path(p.blob(w * .58, h * .54, w * .34, h * .3, .14, 11), '#000', ' opacity=".18"');
    p.path(p.blob(w * .56, h * .5, w * .34, h * .3, .14, 11), col);
    p.path(p.blob(w * .5, h * .42, w * .14, h * .08, .2, 8), '#fff', ' opacity=".22"');
    for (let i = 0; i < 9; i++) { const a = p.R(0, 6.28), d = p.R(0, .8), x = w * .56 + Math.cos(a) * d * w * .3, y = h * .5 + Math.sin(a) * d * h * .26; p.add(`<rect x="${f(x - 2.2)}" y="${f(y - 2.2)}" width="4.4" height="4.4" rx="1.4" fill="${p.pick(veg)}" transform="rotate(${f(p.R(-30, 30))} ${f(x)} ${f(y)})"/>`); }
    if (/마요/.test(n)) p.strands(['#fffbe9'], 5, 18, 1.6, .7);
    if (/(김|김가루)/.test(n)) p.rects(['#1f2a1d'], 10, 2.4, .6, .4, false);
    p.add(`<path d="${p.blob(w * .56, h * .5, w * .34, h * .3, .14, 11)}" fill="none" stroke="${dk}" stroke-width="1.2" opacity=".35"/>`);
  },
  soup(p, n) {
    const kind = /나가사키/.test(n) ? 'milk' : /미역/.test(n) ? 'miyeok' : /짜장/.test(n) ? 'jjajang' : /크림|스프|수프|양송이/.test(n) ? (/양송이|버섯/.test(n) ? 'mush' : 'cream')
      : /단호박|호박죽/.test(n) ? 'pumpkin'
      : /김치|육개장|닭개장|부대|매콤|얼큰|짬뽕|순두부찌개|고추장|매운|마라|짜글|감자탕|동태|해장|칼칼|국밥$|장터|빨간|탄탄|닭볶음탕|탄두리|쌀국수(?!.*맑)/.test(n) && !/맑은/.test(n) ? 'red'
      : /된장|청국장|아욱|시래기|근대|냉이|토장/.test(n) ? 'doen'
      : /들깨|순대국|감자국/.test(n) ? 'perilla'
      : /곰탕|설렁|사골|떡국|만두국|갈비탕|삼계|백숙|닭곰|뼈|도가니|우거지|국밥|나가사키/.test(n) ? 'milk' : 'clear';
    const [col, rim] = SOUP[kind];
    p.liquid(col, rim, kind === 'jjajang' ? .12 : .22);
    if (kind === 'red') p.dots(['#f08a3a', '#e8702a', '#f5a04a'], 14, .8, 2.2, 1, .7);
    if (kind === 'clear' || kind === 'milk') p.dots(['#f6dd8e'], 8, .8, 1.8, 1, .6);
    const has = re => re.test(n);
    if (has(/미역/)) p.strands(['#2c4a26', '#365a2d', '#24401f'], 14, 16, 3.4, .95, .92);
    if (has(/콩나물/)) for (let i = 0; i < 12; i++) { p.strands(['#f5efcf'], 1, 14, 1.3, .9); const s = p.o[p.o.length - 1].match(/M([\d.-]+) ([\d.-]+)/); p.add(`<ellipse cx="${s[1]}" cy="${s[2]}" rx="2.2" ry="1.6" fill="#f1d25a"/>`); }
    if (has(/계란|달걀|에그/)) p.strands(['#f6d25a', '#fbe9a8', '#f9f1d8'], 9, 14, 2.6, .85, .95);
    if (has(/두부|순두부/)) has(/순두부/) ? p.dots(['#fbf7ec', '#f2ead6'], 7, 4, 7, .7) : p.rects(['#fbf7ec', '#f4eedd'], 6, 7, .8, 1.2);
    if (has(/무국|무채|뭇국|어묵무|북어채무|오징어무/)) p.rects(['#f3eedb', '#ece4c8'], 8, 6, .85, 1, false);
    if (has(/어묵/)) p.rects(['#d9a35f', '#e6b878', '#c98f4c'], 7, 8, .85, 2);
    if (has(/떡국|조랭이|떡$|떡만두/)) for (let i = 0; i < 9; i++) { const [x, y] = p.pt(.8); p.lump(x, y, has(/조랭이/) ? 3.2 : 6.5, has(/조랭이/) ? 3.2 : 4, '#fbf8f0', { sh: .3, hi: .6, n: 8 }); }
    if (has(/만두|교자/)) for (let i = 0; i < 4; i++) { const [x, y] = p.pt(.6); p.lump(x, y, 9, 6, '#f6eedc', { sh: .4, hi: .5, n: 10 }); }
    if (has(/수제비|옹심이|국수|면|우동|쌀국수|짬뽕|탄탄/)) p.strands(has(/쌀국수/) ? ['#f8f4ea'] : has(/수제비/) ? ['#efe5cf'] : ['#f3e3b0', '#ead39a'], has(/수제비|옹심이/) ? 8 : 18, has(/수제비|옹심이/) ? 8 : 26, has(/수제비|옹심이/) ? 6 : 2, .9);
    if (has(/쇠고기|소고기|돼지|돈육|고기|닭|오리|갈비|양지|사골|곰탕|국밥|장터|육개장|햄|소시지|부대|감자탕|뼈|순대/)) for (let i = 0; i < 7; i++) { const [x, y] = p.pt(.8); p.lump(x, y, p.R(3, 5.5), p.R(2.4, 4), p.pick(has(/햄|소시지|부대/) ? ['#d9786a', '#c9533e'] : ['#7a4a30', '#8d5a3a', '#6a3d26']), { sh: .3, hi: .3, n: 7 }); }
    if (has(/부대/)) p.strands(['#f0d17a'], 8, 20, 1.6, .8);
    if (has(/김치/)) p.dots(['#d8532e', '#e8784a', '#f0c49a'], 10, 2.4, 4.2, .85);
    if (has(/감자|단호박|호박/) && kind !== 'pumpkin') p.rects(has(/호박/) && !has(/감자/) ? ['#9cc35a', '#f2c25a'] : ['#f2deaa', '#ead09a'], 8, 6, .8, 1.6);
    if (has(/버섯|팽이|느타리|새송이/)) p.strands(['#efe5d0', '#d8c7a6'], 10, 10, 2.4, .85);
    if (has(/시래기|아욱|시금치|근대|얼갈이|배추|우거지|쑥|냉이|부추|열무/)) p.strands(['#4f7d2c', '#3f6a24', '#6a9a3e', '#7f8a3c'], 16, 14, 3, .9, .95);
    if (has(/육개장|닭개장/)) p.strands(['#7a4a30', '#5f3a24', '#3f6a24'], 16, 14, 2, .9);
    if (has(/오징어|주꾸미|쭈꾸미|해물|새우|홍합|조개|바지락/)) for (let i = 0; i < 6; i++) { const [x, y] = p.pt(.8); p.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(p.R(3, 4.5))}" fill="none" stroke="#f6eadf" stroke-width="2.2"/>`); }
    if (has(/북어|황태|동태|생선|매운탕|명태/)) for (let i = 0; i < 6; i++) { const [x, y] = p.pt(.8); p.lump(x, y, p.R(4, 6), p.R(3, 4), '#f1e6cf', { sh: .3, hi: .5, n: 8 }); }
    if (has(/곰탕|국밥|떡국|만두국|갈비탕/) || kind === 'clear' || kind === 'doen' || kind === 'red') p.scallion(has(/곰탕|국밥|떡국/) ? 12 : 6);
    if (has(/떡국/)) p.strands(['#1f2a1d'], 8, 6, 1.4, .6);
    if (kind === 'cream' || kind === 'mush' || kind === 'pumpkin') { p.dots(['#fff8e6'], 4, 2, 4, .6, .6); p.dots(['#6a9a3e', '#3f6a24'], 8, .6, 1, .6); }
    if (kind === 'perilla') p.dots(['#b9a07a', '#a88d64'], 40, .4, .9, 1);
  },
  porridge(p, n) {
    const col = /호박/.test(n) ? ['#efb54a', '#c98a1e'] : /전복|녹두|들깨|우엉|쇠고기|닭|영양|새우/.test(n) ? ['#eadfc6', '#c2b08c'] : /김치/.test(n) ? ['#e0a07a', '#b06a42'] : /아욱|시금치|미역/.test(n) ? ['#cfcaa0', '#9a9468'] : ['#f1ebdc', '#c9bea0'];
    p.liquid(col[0], col[1], .25);
    p.grains(['#fbf8ef', '#f4eedd', col[0]], 70, 2.6, 1.6, 1);
    if (/쇠고기|닭|소고기/.test(n)) p.rects(['#7a4a30', '#8d5a3a'], 8, 3.4, .8, 1);
    if (/새우/.test(n)) p.dots(['#f29a7a', '#e98a68'], 7, 2.2, 3.2, .8);
    if (/아욱|시금치|미역|채소|야채/.test(n)) p.strands(['#4f7d2c', '#3f6a24'], 10, 10, 2.2, .85);
    if (/김치/.test(n)) p.dots(['#d8532e', '#c84422'], 10, 2, 3.4, .85);
    p.dots(['#e07a2e', '#79b443'], 8, 1, 1.6, .8).sesame(8);
  },
  noodle(p, n) {
    const sauce = /크림|까르보|알프레도|뇨끼/.test(n) ? ['#f1e3bd', '#d7c08a'] : /짜장/.test(n) ? ['#3b281b', '#22160d'] : /토마토|미트|볼로|나폴리/.test(n) ? ['#c8452c', '#8f2a16']
      : /쫄면|비빔|매콤|떡볶이|고추장|막국수/.test(n) ? ['#d0502b', '#952f16'] : /잡채|간장/.test(n) ? ['#9a6a3c', '#6a4422'] : /모밀|소바/.test(n) ? ['#7a5a3a', '#4a3420'] : ['#e8d29a', '#c3a865'];
    const nood = /잡채|당면/.test(n) ? ['#a9814f', '#8f6a3c', '#bd9662'] : /모밀|메밀|소바|냉면/.test(n) ? ['#9b8670', '#8a7560', '#a8927a'] : /쫄면/.test(n) ? ['#f2e2bf', '#e9d2a2'] : /짜장|우동|칼국수/.test(n) ? ['#f4e6c4', '#ecd8aa'] : ['#f2d892', '#e9c978', '#f6e2a8'];
    p.bed(sauce[0], sauce[1]).strands(nood, /뇨끼/.test(n) ? 0 : 46, 30, 2.3, .95);
    if (/뇨끼/.test(n)) for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 4.4, 3.2, '#f4e2b0', { sh: .3, hi: .5, n: 7 }); }
    if (/푸실리|마카로니|펜네/.test(n)) for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 5, 2.6, '#f2d27a', { sh: .3, hi: .4, n: 8 }); }
    p.path(p.blob(p.w / 2, p.h / 2, p.w * .2, p.h * .14, .3, 8), sauce[0], ' opacity=".55"');
    if (/잡채/.test(n)) { p.strands(['#e6762c', '#4f8f35', '#7a4a30', '#f6e7c8'], 16, 10, 2.4, .85); p.sesame(14); }
    else if (/쫄면|비빔|막국수/.test(n)) { p.strands(['#7cb648', '#f6f2e2', '#e6762c'], 12, 10, 2, .7); p.lump(p.w / 2, p.h / 2, 7, 6, '#fbf6ea', { hi: .3 }).lump(p.w / 2 + 1, p.h / 2, 3.2, 3, '#f3b51f', { sh: 0 }); p.sesame(10); }
    else if (/짜장/.test(n)) { p.rects(['#f2e2bf', '#4f8f35', '#7a5a3a'], 10, 4, .7, 1.2); p.strands(['#7cb648'], 6, 8, 1.4, .5); }
    else if (/크림|까르보/.test(n)) { p.rects(['#e8b07a', '#c9886a'], 8, 4, .7, 1); p.dots(['#3f6a24'], 10, .5, .9, .8); }
    else if (/토마토|미트/.test(n)) { p.dots(['#7a3a24', '#8a4a2c'], 12, 1.6, 2.6, .7); p.dots(['#3f6a24'], 8, .6, 1, .8); }
    else if (/탄탄|라멘|라면/.test(n)) { p.lump(p.w * .35, p.h * .4, 8, 6, '#f6eedc', { hi: .3 }); p.scallion(8); }
    else p.dots(['#e6762c', '#7cb648'], 10, 1.4, 2.4, .7);
  },
  kimchi(p, n) {
    if (/깍두기|석박지|섞박지|무김치/.test(n)) { p.rects(['#e2673a', '#d9562c', '#ec7f4e', '#e8714a'], 18, 9, .9, 2); p.flakes(18); p.strands(['#5fa83a'], 4, 8, 1.4, .7); return; }
    if (/오이/.test(n)) { for (let i = 0; i < 9; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 7, 5.5, '#4f8f35', { hi: .4, n: 10 }); p.lump(x - 1, y - .5, 5, 3.8, '#c8d98a', { sh: 0, hi: 0, n: 8 }); p.dots(['#d9562c'], 2, 1, 1.8, .2); } p.flakes(20); p.strands(['#5fa83a', '#e2673a'], 8, 8, 1.4, .8); return; }
    if (/총각|알타리/.test(n)) { for (let i = 0; i < 5; i++) { const [x, y] = p.pt(.7); p.lump(x, y, 9, 6, '#de6a3c', { hi: .4 }); } p.strands(['#3f6a24', '#4f7d2c', '#b0452a'], 14, 16, 2.6, .95); p.flakes(14); return; }
    if (/열무|파김치|부추/.test(n)) { p.bed('#c95a34').strands(['#4f7d2c', '#5e8f34', '#7ba84a', '#c8462a'], 34, 20, 2.6, .95); p.flakes(16); return; }
    const dark = /볶음김치|묵은지/.test(n);
    p.bed(dark ? '#a8361e' : '#d4502c');
    for (let i = 0; i < 13; i++) {
      const [x, y] = p.pt(.85), rx = p.R(7, 11), ry = p.R(5, 8);
      p.lump(x, y, rx, ry, dark ? p.pick(['#9c2e18', '#b23c20', '#8a2814']) : p.pick(['#d64c2a', '#e05a32', '#cc4524']), { hi: dark ? .7 : .35, n: 8 });
      p.path(p.blob(x + p.R(-2, 2), y + p.R(-2, 2), rx * .55, ry * .28, .2, 7, p.R(0, 3)), dark ? '#d9774a' : '#f2c49a', ' opacity=".8"');
    }
    p.flakes(26).strands(['#5fa83a'], 4, 7, 1.2, .7);
    if (dark) p.sesame(14);
  },
  greens(p, n) {   // 나물·무침
    const col = /콩나물|숙주/.test(n) ? 'sprout' : /무생채|무채|무말랭이|무침무|도라지/.test(n) ? (/무말랭이/.test(n) ? 'dried' : /도라지/.test(n) ? 'white' : 'radish')
      : /고사리|토란대|궁채|고구마줄기/.test(n) ? 'brown' : /가지/.test(n) ? 'eggplant' : /진미채|오징어채|명엽채|쥐포/.test(n) ? 'jinmi' : /미역줄기|파래|톳|꼬시래기|다시마/.test(n) ? 'sea' : 'green';
    const spicy = /고추장|매콤|양념|초무침|초회|겉절이|빨간|생채/.test(n);
    if (col === 'sprout') { p.bed(spicy ? '#d8693c' : '#efe2b8'); for (let i = 0; i < 34; i++) { p.strands([spicy ? '#f2c79c' : '#f6efcf'], 1, 16, 1.5, .95); const s = p.o[p.o.length - 1].match(/M([\d.-]+) ([\d.-]+)/); p.add(`<ellipse cx="${s[1]}" cy="${s[2]}" rx="2" ry="1.5" fill="${spicy ? '#e8a25a' : '#efcf5a'}"/>`); } if (/파채|부추/.test(n)) p.strands(['#5fa83a', '#7cc04a'], 10, 14, 1.6, .8); }
    else if (col === 'radish') { p.bed('#e05a32').strands(['#e8673c', '#f08050', '#f7d4bc', '#d9502c'], 60, 18, 1.8, .95); }
    else if (col === 'dried') p.bed('#b84a24').strands(['#c9562c', '#b04220', '#d86a3c', '#f0c49a'], 40, 12, 3.2, .95);
    else if (col === 'white') p.bed('#f1ead6').strands(['#f6f0de', '#ece2c6', '#e2d6b2'], 46, 16, 2.6, .95);
    else if (col === 'brown') p.bed('#6a4a2a').strands(['#6f4b2b', '#7f5a35', '#5a3c22', '#8a6a3c'], 44, 20, 2.4, .95);
    else if (col === 'eggplant') { p.bed('#5a3a3a'); for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(8, 12), p.R(3, 4.5), p.pick(['#5a2f4a', '#6a3a55', '#7a5a4a']), { hi: .6, n: 8 }); } }
    else if (col === 'jinmi') p.bed('#b0482a').strands(['#c25530', '#d06a40', '#a9401f', '#e89a6a'], 44, 14, 2.6, .95);
    else if (col === 'sea') p.bed('#2f4a26').strands(['#2f5a26', '#3f6f2c', '#24401f', '#4a7a33'], 48, 16, 2.4, .95);
    else {
      const leafy = /겉절이|상추|쌈채|얼갈이|알배기|부추|참나물|청경채|쑥갓|깻잎/.test(n) && !/나물$/.test(n);
      if (/브로컬리|브로콜리/.test(n)) { p.bed('#3f6a24'); for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.8); p.lump(x, y, p.R(6, 9), p.R(5, 7), p.pick(['#3f7a2a', '#4f8f35', '#356a22']), { hi: .3, n: 11, jit: .3 }); p.dots(['#2c5a1c', '#5fa03a'], 6, .6, 1.2, .1); } }
      else if (/오이/.test(n)) for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 6, 6, '#4f8f35', { hi: .3, n: 12, jit: .05 }); p.lump(x - .4, y - .4, 4.8, 4.8, '#d8e6a8', { sh: 0, hi: 0, n: 12, jit: .05 }); }
      else if (leafy) for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.8); p.lump(x, y, p.R(9, 14), p.R(6, 9), p.pick(['#6aa83f', '#7cbc4c', '#5a9a34', '#8fc85a']), { hi: .45, n: 10, jit: .3 }); }
      else p.bed('#3f6a24').strands(['#3f7a2a', '#4f8f35', '#2f6a22', '#5a9a3a'], 52, 18, 2.6, .95);
      if (/묵|두부/.test(n)) p.rects(/도토리/.test(n) ? ['#7a5236', '#8a6040'] : ['#f2ecd8', '#ebe2c6'], 9, 8, .8, 1.2);
    }
    if (spicy && col !== 'radish' && col !== 'jinmi' && col !== 'dried') p.flakes(18);
    p.sesame(12);
  },
  salad(p, n) {
    if (/코울슬로|양배추샐러드/.test(n)) { p.bed('#f1ecd2').strands(['#eef2d4', '#e4ecc2', '#f6f2e2'], 46, 12, 2, .95).strands(['#e8822e', '#b8436a'], 12, 9, 1.6, .85); return; }
    if (/마카로니|감자샐러드|에그샐러드|메추리알샐러드|단호박샐러드|고구마샐러드|크래미샐러드|맛살샐러드/.test(n)) { p.bed('#f4ecd0'); for (let i = 0; i < 16; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(4, 6.5), p.R(3, 4.5), p.pick(/마카로니/.test(n) ? ['#f2d27a', '#eec866'] : /단호박|고구마/.test(n) ? ['#f0b84a', '#e9a63a'] : ['#f6edd2', '#efe2bc']), { hi: .5, n: 8 }); } if (/크래미|맛살/.test(n)) p.strands(['#e05a4a', '#fbf4ea'], 14, 8, 2.2, .8); if (/메추리알|에그/.test(n)) for (let i = 0; i < 5; i++) { const [x, y] = p.pt(.7); p.lump(x, y, 5, 4, '#fbf7ec', { hi: .3 }).lump(x, y, 2.2, 2, '#f2c43a', { sh: 0, hi: 0 }); } p.dots(['#7cb648', '#e8822e'], 10, .8, 1.4, .8); return; }
    if (/과일|열대|황도|꽃맛살|만다린|망고|후르츠/.test(n)) { p.bed('#f6efd8'); p.rects(['#f2c43a', '#f08a2e', '#e8473f', '#8fbf3a', '#f6e7a0', '#f2a07a'], 22, 6, .85, 1.4); p.strands(['#fffbe9'], 4, 16, 2, .6); return; }
    if (/카프레제|토마토/.test(n)) { for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.8); p.lump(x, y, 5.4, 5.4, '#d83a2c', { hi: .7, n: 10, jit: .06 }); } for (let i = 0; i < 6; i++) { const [x, y] = p.pt(.8); p.lump(x, y, 5, 4.4, '#fbf8ef', { hi: .3 }); } p.strands(['#3f7a2a'], 6, 6, 2.4, .8); return; }
    for (let i = 0; i < 18; i++) { const [x, y] = p.pt(.9); p.lump(x, y, p.R(8, 12), p.R(5, 8), p.pick(['#7cbc4c', '#9ccc65', '#5a9a34', '#b7d97a', '#6a2a4a']), { hi: .45, n: 10, jit: .3 }); }
    p.strands(['#f2f6e6', '#e8f0d2'], 8, 10, 1.6, .8);
    if (/타코|콘|옥수수/.test(n)) p.rects(['#f2c53d'], 14, 3, .8, 1);
    if (/시저/.test(n)) { p.rects(['#e2b26a', '#d49a50'], 8, 5, .7, 1); p.dots(['#f6f0dc'], 16, .6, 1.2, .8); }
    if (/치킨|닭|텐더/.test(n)) for (let i = 0; i < 4; i++) { const [x, y] = p.pt(.6); p.lump(x, y, 8, 4, '#c98a3a', { hi: .4 }); }
    if (/리코타|치즈/.test(n)) for (let i = 0; i < 4; i++) { const [x, y] = p.pt(.6); p.lump(x, y, 5, 4, '#fbf8ef', { hi: .3 }); }
    p.dots(['#d83a2c', '#e8822e', '#f2c53d'], 7, 2, 3.2, .8);
    // 드레싱
    const dr = /딸기|요거트|요구르트/.test(n) ? '#f6c9d0' : /블루베리|베리/.test(n) ? '#9a6ab8' : /키위/.test(n) ? '#b8d86a' : /참깨|사우전|마요|시저|랜치/.test(n) ? '#f3e6c4' : /오리엔탈|간장|발사믹/.test(n) ? '#6a4024' : '#f6eccc';
    p.strands([dr], 6, 22, 2.2, .7, .9);
  },
  redMeat(p, n) {   // 빨간 양념 볶음
    const isTteok = /떡볶이|떡꼬치/.test(n), isSquid = /오징어|주꾸미|쭈꾸미|낙지/.test(n);
    p.bed('#b0391c', '#7a2412');
    if (isTteok) for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(8, 11), 3.4, p.pick(['#e2683e', '#d65a32']), { hi: .6, n: 8, jit: .08, light: '#ffd9c0' }); }
    else if (isSquid) for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(6, 10), p.R(3, 5), p.pick(['#d24e2a', '#e0683e', '#c4401f']), { hi: .6, n: 8 }); p.add(`<circle cx="${f(x)}" cy="${f(y)}" r="2.2" fill="none" stroke="#f6d6c0" stroke-width="1" opacity=".7"/>`); }
    else for (let i = 0; i < 16; i++) { const [x, y] = p.pt(.88); p.lump(x, y, p.R(6, 10), p.R(4, 7), p.pick(['#b8401f', '#c75327', '#a23418', '#c4482a']), { hi: .65, n: 9, light: '#ffcfb0' }); }
    if (/어묵|오뎅/.test(n) && isTteok) p.rects(['#e2a868'], 6, 7, .8, 1.5);
    if (/닭갈비|볶음|제육|두루치기|불고기|순대/.test(n)) { p.strands(['#f3e6d0', '#ece0c2'], 10, 10, 2.2, .85); p.lump(p.R(20, 60), p.R(20, 60), 7, 4, '#a8cf6a', { hi: .4 }); }
    if (/치즈/.test(n)) p.strands(['#f8e7a0', '#fbf0c8'], 8, 18, 3, .7);
    if (/마라/.test(n)) p.dots(['#6a2a14', '#3f1a0c'], 12, .8, 1.4, .85);
    p.scallion(7).sesame(14);
  },
  brownMeat(p, n) {   // 간장·갈비·불고기·조림
    const stripy = /불고기|대패|샤브|주물럭|잡채|볶음/.test(n) && !/갈비찜|찜닭/.test(n);
    const pal = /오리|훈제/.test(n) ? ['#c9786a', '#b5675a', '#d98a7a'] : /데리야끼|간장|찜닭|조림|장조림|갈비/.test(n) ? ['#6b3b1f', '#7d4626', '#5a2f18', '#8a5230'] : ['#7a4428', '#8b5232', '#6a3a22'];
    p.bed('#5a3018', '#3a1e0e');
    if (stripy) p.strands(pal, 30, 16, 5.2, .9);
    else for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(7, 11), p.R(5, 8), p.pick(pal), { hi: .7, n: 9, light: '#ffe2c4' }); }
    if (/찜닭|닭볶음탕|갈비찜/.test(n)) { p.rects(['#f2d79c', '#e8762c'], 7, 7, .8, 2); p.strands(['#7a5030', '#8a5a36'], 12, 20, 1.5, .8, .8); }
    if (/불고기|대패|오리/.test(n)) { p.strands(['#f3e6d0', '#e9dcc0'], 10, 12, 2.2, .85); p.strands(['#e8762c'], 5, 9, 1.8, .8); }
    if (/버섯|팽이/.test(n)) p.strands(['#f2ead6', '#e2d6b8'], 14, 12, 1.4, .85);
    if (/깻잎/.test(n)) p.strands(['#3f6a24'], 8, 10, 3, .8);
    if (/우엉/.test(n)) p.strands(['#4a2a16'], 20, 14, 2, .9);
    p.scallion(6).sesame(14);
  },
  patty(p, n) {   // 떡갈비·함박·동그랑땡·미트볼·너비아니
    const gold = /동그랑땡|전$|완자전/.test(n), ball = /볼|완자|미트볼|메추리알/.test(n);
    const cnt = ball ? 9 : gold ? 6 : 3, s = ball ? 6 : gold ? 10 : 16;
    p.bed(gold ? '#e0b45a' : '#5a3018', gold ? null : '#3a1e0e', .9);
    for (let i = 0; i < cnt; i++) { const [x, y] = cnt < 4 ? [p.w * (.3 + i * .22), p.h * (.42 + (i % 2) * .16)] : p.pt(.75); p.lump(x, y, s, s * (ball ? 1 : .78), gold ? p.pick(['#e8b65a', '#dca448']) : p.pick(['#6a3a20', '#7a4428', '#5e321a']), { hi: .7, n: 12, jit: .08, light: gold ? '#fff2c8' : '#ffd9b8' }); if (gold) p.dots(['#d8532e', '#5fa83a', '#7a4428'], 4, .8, 1.4, .1); }
    if (/소스|함박|미트볼|크림/.test(n)) p.strands([/크림/.test(n) ? '#f1e3bd' : '#5a2a14'], 6, 18, 3, .6, .8);
    p.sesame(gold ? 0 : 10);
  },
  sliced(p, n) {   // 수육·보쌈·훈제오리·햄·소시지·맛살·어묵
    if (/소시지|비엔나|후랑크|프랑크/.test(n)) { p.bed('#c25a3a', null, .85); for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(7, 10), 3.6, p.pick(['#c9533e', '#d66a50', '#b8452e']), { hi: .7, n: 8, jit: .06, light: '#ffd0c0' }); } p.dots(['#3f6a24', '#e8c03a'], 10, 1.4, 2.4, .7); p.strands(['#e89a40'], 4, 10, 1.6, .7); return; }
    if (/어묵|오뎅|가마보꼬/.test(n)) { p.bed('#c88a46'); for (let i = 0; i < 16; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(8, 12), 3.4, p.pick(['#d9a35f', '#e6b878', '#c98f4c']), { hi: .6, n: 8, jit: .06 }); } if (/매콤|고추장|떡볶이/.test(n)) p.flakes(14); p.strands(['#5fa83a', '#e8762c'], 6, 8, 1.4, .7).sesame(10); return; }
    if (/맛살|크래미|게맛살/.test(n)) { for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 10, 3, '#fbf4ea', { hi: .3, n: 8, jit: .05 }); p.lump(x, y - 1.2, 9, 1.4, '#e05a4a', { sh: 0, hi: 0, n: 8, jit: .05 }); } return; }
    if (/햄|스팸|베이컨/.test(n)) { p.rects(['#e8a092', '#de8c7e', '#efb0a2'], 12, 11, .85, 1.5); if (/구이|전/.test(n)) p.dots(['#b8743a'], 10, 1, 2, .8, .5); if (/케찹|케첩/.test(n)) p.strands(['#c8261b'], 4, 18, 2.4, .6); return; }
    const pal = /오리/.test(n) ? ['#d98a7a', '#c9786a'] : /순대/.test(n) ? ['#3a2a2a', '#4a3434'] : ['#f1d7c8', '#ead0bd'];
    for (let i = 0; i < 9; i++) { const x = p.w * (.2 + (i % 5) * .15), y = p.h * (.32 + Math.floor(i / 5) * .34) + p.R(-3, 3); p.lump(x, y, 11, 8, pal[i % 2], { hi: .4, n: 10, jit: .1 }); p.lump(x, y - 5, 10, 2.4, /오리|순대/.test(n) ? '#f3e2cf' : '#8a5232', { sh: 0, hi: 0, n: 8, jit: .05 }); }
    if (/수육|보쌈/.test(n)) p.strands(['#d8532e', '#f0c49a'], 10, 10, 2.4, .6);
  },
  fried(p, n) {
    const gold = ['#c98a3a', '#d49a48', '#be7d30', '#dca452'];
    if (/까스|가스|커틀릿|카츠/.test(n)) {
      const { w, h } = p, cx = w / 2, cy = h / 2;
      p.lump(cx, cy, w * .4, h * .34, '#c98a3a', { hi: .4, n: 14, jit: .08, light: '#ffe6b0' });
      p.dots(['#e2b260', '#a96e26', '#f0c878'], 60, .6, 1.4, .82);
      for (let i = -3; i <= 3; i++) p.add(`<path d="M${f(cx + i * w * .1)} ${f(cy - h * .3)}L${f(cx + i * w * .1 + 4)} ${f(cy + h * .3)}" stroke="#7a4a1a" stroke-width="1.1" opacity=".55"/>`);
      p.strands([/탈탈|타르|생선|오징어/.test(n) ? '#f6f0d8' : '#5a2e12'], 4, w * .5, 3.2, .5, .9);
      return;
    }
    if (/새우튀김|새우까스|통새우/.test(n)) { for (let i = 0; i < 4; i++) { const x = p.w * (.25 + i * .17), y = p.h * .5 + p.R(-6, 6); p.lump(x, y, 6, 14, p.pick(gold), { hi: .5, n: 9 }); p.add(`<path d="M${f(x - 3)} ${f(y - 14)}L${f(x)} ${f(y - 20)}L${f(x + 3)} ${f(y - 14)}Z" fill="#e05a32"/>`); } p.dots(['#e2b260', '#a96e26'], 40, .5, 1.2, .9); p.lump(p.w * .8, p.h * .75, 7, 5, '#f6f0d8', { hi: .3 }); return; }
    if (/감자튀김|후라이|크링클|웨지|츄러스|맛탕|고구마스틱/.test(n)) { p.bed('#e2b05a', null, .85); for (let i = 0; i < 26; i++) { const [x, y] = p.pt(.85), a = p.R(0, 180), L = /츄러스/.test(n) ? 22 : 15; p.add(`<rect x="${f(x - L / 2)}" y="${f(y - 2)}" width="${L}" height="${/츄러스/.test(n) ? 5 : 4}" rx="1.5" fill="${p.pick(/고구마/.test(n) ? ['#e8a03a', '#d98a2a'] : ['#f0c25a', '#e6b048', '#f5d070'])}" transform="rotate(${f(a)} ${f(x)} ${f(y)})"/>`); } if (/오지|치즈/.test(n)) p.strands(['#f6d25a', '#f8e09a'], 8, 20, 3.4, .7); if (/맛탕/.test(n)) p.sesame(16); if (/츄러스/.test(n)) p.dots(['#fbf4e2'], 30, .5, .9, .9); return; }
    if (/만두|교자|춘권|짜조|스프링롤/.test(n)) { for (let i = 0; i < 6; i++) { const [x, y] = p.pt(.7); p.lump(x, y, /춘권|짜조|롤/.test(n) ? 13 : 10, /춘권|짜조|롤/.test(n) ? 5 : 6.5, p.pick(gold), { hi: .55, n: 10, light: '#fff0c0' }); } p.dots(['#a96e26'], 20, .5, 1, .85); return; }
    if (/핫도그/.test(n)) { for (let i = 0; i < 3; i++) { const x = p.w * (.3 + i * .2), y = p.h * .48; p.add(`<rect x="${f(x - 1)}" y="${f(y + 10)}" width="2.4" height="16" fill="#e6d2a6"/>`); p.lump(x, y, 7, 16, '#d49a48', { hi: .5, n: 10, jit: .06 }); } p.strands(['#c8261b', '#f2c53d'], 4, 20, 1.8, .5); return; }
    if (/해쉬|해시/.test(n)) { for (let i = 0; i < 3; i++) p.lump(p.w * (.28 + i * .22), p.h * .5, 12, 16, '#d9a34a', { hi: .5, n: 12, jit: .06 }); p.dots(['#f0c878', '#a96e26'], 50, .5, 1.1, .9); return; }
    // 너겟·치킨·강정·탕수육·튀김 일반
    const glaze = /강정|양념|매콤|칠리|핫|탕수|깐풍|유린|허니|데리|크림|버터갈릭/.test(n);
    const gpal = /탕수|맛동산|유린/.test(n) ? gold : /허니|버터/.test(n) ? ['#d6973a', '#e3a84a', '#c98a30'] : glaze ? ['#b5461f', '#c4532a', '#a23c1a'] : gold;
    if (/탕수/.test(n)) p.bed('#d9a050', null, .9);
    for (let i = 0; i < 13; i++) { const [x, y] = p.pt(.86); p.lump(x, y, p.R(7, 10), p.R(5.5, 8), p.pick(gpal), { hi: glaze ? .8 : .4, n: 11, jit: .26, light: '#fff0c8' }); }
    if (!glaze || /탕수/.test(n)) p.dots(['#e2b260', '#a96e26', '#f0c878'], 50, .5, 1.2, .9);
    if (/탕수|맛동산/.test(n)) { p.path(p.blob(p.w * .55, p.h * .5, p.w * .26, p.h * .2, .3, 9), '#f2a24a', ' opacity=".45"'); p.rects(['#e8762c', '#7cb648', '#f6e7c8'], 8, 4, .7, 1); }
    if (/칠리|타르|소스|케찹/.test(n)) p.lump(p.w * .78, p.h * .72, 7, 5.5, /타르/.test(n) ? '#f6f0d8' : '#d23a22', { hi: .5 });
    if (/강정|양념|허니/.test(n)) p.sesame(16);
    if (/채소튀김|야채튀김|모듬/.test(n)) p.strands(['#e8762c', '#4f8f35'], 6, 6, 1.6, .7);
  },
  fish(p, n) {
    const salmon = /연어/.test(n), { w, h } = p;
    p.lump(w * .5, h * .5, w * .38, h * .3, salmon ? '#e9876a' : '#e5c28a', { hi: .45, n: 12, jit: .08 });
    if (!salmon) p.path(p.blob(w * .5, h * .34, w * .34, h * .1, .1, 10), '#8a8a86', ' opacity=".55"');
    for (let i = -2; i <= 2; i++) p.add(`<path d="M${f(w * .5 + i * w * .12 - 4)} ${f(h * .3)}L${f(w * .5 + i * w * .12 + 4)} ${f(h * .7)}" stroke="${salmon ? '#b5503a' : '#8a5a2a'}" stroke-width="2.2" opacity=".45" stroke-linecap="round"/>`);
    if (salmon) p.strands(['#fbe6dc'], 8, 16, 1.2, .6);
    if (/튀김|까스|가라아게/.test(n)) p.dots(['#e2b260', '#a96e26'], 40, .5, 1.2, .8);
    if (/타르|소스|마요/.test(n)) p.lump(w * .76, h * .7, 9, 6, '#f6f0d8', { hi: .3 }).dots(['#5fa83a'], 4, .6, 1, .2);
    if (/조림|양념|간장/.test(n)) p.path(p.blob(w * .5, h * .5, w * .34, h * .24, .3, 9), '#8a3a1a', ' opacity=".5"');
    p.scallion(4, .5);
  },
  egg(p, n) {
    const { w, h } = p;
    if (/후라이|프라이|계란구이|에그/.test(n) && !/찜|스크램블|말이/.test(n)) { for (let i = 0; i < 2; i++) { const x = w * (.32 + i * .36), y = h * .5; p.lump(x, y, w * .2, h * .3, '#fbf8ef', { hi: .3, n: 11, jit: .16 }); p.lump(x - 1, y - 1, 6.5, 6.5, '#f2b51f', { sh: .3, hi: .7, n: 12, jit: .04 }); } p.dots(['#3a2a1a'], 6, .4, .7, .7); return; }
    if (/찜/.test(n)) { p.liquid('#f6d66a', '#d4a628', .3); p.path(p.blob(w / 2, h / 2, w * .3, h * .28, .3, 10), '#fbe48a', ' opacity=".6"'); p.scallion(10, .8); if (/삼색|당근/.test(n)) p.rects(['#e8762c'], 8, 2.4, .7, .6, false); p.dots(['#f2c43a'], 20, .8, 1.6, .9, .6); return; }
    // 스크램블·오믈렛·말이
    if (/말이|오믈렛/.test(n)) for (let i = 0; i < 5; i++) { const x = w * (.2 + i * .15), y = h * .5 + p.R(-3, 3); p.lump(x, y, 7, 14, '#f4cf55', { hi: .5, n: 10, jit: .05 }); p.add(`<path d="M${f(x)} ${f(y - 10)}Q${f(x + 4)} ${f(y)} ${f(x)} ${f(y + 10)}" stroke="#e6b23a" stroke-width="1.4" fill="none"/>`); }
    else for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(6, 9), p.R(5, 7), p.pick(['#f6d35a', '#f2c84a', '#fbe08a']), { hi: .5, n: 10, jit: .3 }); }
    if (/토마토/.test(n)) p.rects(['#d8392a'], 8, 5, .8, 1.2);
    if (/햄/.test(n)) p.rects(['#e8a092'], 8, 4, .8, 1);
    if (/치즈|체다/.test(n)) p.strands(['#f2a82a'], 4, 14, 3, .6);
    p.scallion(5, .7);
  },
  braisedEgg(p, n) {   // 장조림·메추리알
    const quail = /메추리/.test(n);
    p.bed('#5a3018', '#3a1e0e', .9);
    for (let i = 0; i < (quail ? 14 : 6); i++) { const [x, y] = p.pt(.8), s = quail ? 4.2 : 8; p.lump(x, y, s, s * .82, '#9a6232', { hi: .7, n: 11, jit: .05, light: '#ffe0b8' }); if (!quail && i % 2) p.lump(x, y, s * .45, s * .42, '#e9b23a', { sh: 0, hi: .2, n: 10, jit: .05 }); }
    if (/돈육|쇠고기|고기|장조림/.test(n) && !quail) p.strands(['#6b3b1f', '#7d4626'], 14, 12, 3, .85);
    if (/곤약/.test(n)) p.rects(['#7a6a5a', '#6a5a4a'], 8, 6, .8, 1.5);
    if (/꽈리|고추/.test(n)) for (let i = 0; i < 5; i++) { const [x, y] = p.pt(.8); p.lump(x, y, 9, 3.2, '#4f8f35', { hi: .6 }); }
    p.sesame(10);
  },
  tofu(p, n) {
    const soft = /연두부|순두부/.test(n), sauce = /조림|마파|고추장|양념/.test(n);
    if (sauce) p.bed(/마파|고추장|매콤/.test(n) ? '#b9452a' : '#7a4426', null, .95);
    if (soft) { p.lump(p.w / 2, p.h / 2, p.w * .32, p.h * .3, '#fbf8ef', { hi: .5, n: 12, jit: .1 }); }
    else for (let i = 0; i < 8; i++) { const x = p.w * (.24 + (i % 4) * .17), y = p.h * (.36 + Math.floor(i / 4) * .28) + p.R(-2, 2); p.add(`<rect x="${f(x - 7 + 1)}" y="${f(y - 6 + 1.6)}" width="14" height="12" rx="2" fill="#000" opacity=".15"/><rect x="${f(x - 7)}" y="${f(y - 6)}" width="14" height="12" rx="2" fill="${sauce ? '#e6c08a' : /구이|부침/.test(n) ? '#e8c47a' : '#f7f2e2'}"/><rect x="${f(x - 5)}" y="${f(y - 4.5)}" width="6" height="2.4" rx="1" fill="#fff" opacity=".5"/>`); }
    if (/부추|양념장|간장|숙회/.test(n) || soft) { p.lump(p.w / 2 + 2, p.h / 2 - 2, 9, 5, '#6a3a1e', { sh: 0, hi: .5 }); p.strands(['#5fa83a', '#4c8f2c'], 10, 8, 1.6, .5); p.flakes(10, .5); }
    if (/김치/.test(n)) p.dots(['#d8532e', '#c44422'], 14, 2.4, 4, .8);
    if (/쑥갓|무침/.test(n)) p.strands(['#3f7a2a', '#5a9a3a'], 20, 12, 2.2, .9);
    p.scallion(5).sesame(8);
  },
  jelly(p, n) {   // 도토리묵·청포묵
    const dot = /도토리/.test(n);
    if (/채소|무침|양념/.test(n)) p.strands(['#7cbc4c', '#5a9a34', '#f3efe0', '#e8762c'], 24, 12, 2.4, .9);
    p.rects(dot ? ['#6f4a30', '#7d5638', '#634026'] : ['#f2eedc', '#ebe5cf', '#f6f2e6'], 14, 9, .85, 1.4);
    if (/김가루|김/.test(n)) p.rects(['#1f2a1d', '#2c3a26'], 16, 2.6, .8, .4, false);
    p.flakes(dot ? 10 : 0).sesame(12);
  },
  laver(p, n) {   // 구이김·김자반
    if (/자반|가루|볶음/.test(n)) { p.bed('#1f2a1d'); p.rects(['#1f2a1d', '#2c3a26', '#34442c'], 50, 3.4, .9, .5, false); p.sesame(30); return; }
    for (let i = 0; i < 4; i++) { const x = p.w * .5 + (i - 1.5) * 4, y = p.h * .5 + (i - 1.5) * 3; p.add(`<rect x="${f(x - p.w * .3)}" y="${f(y - p.h * .26)}" width="${f(p.w * .6)}" height="${f(p.h * .52)}" rx="2" fill="#000" opacity=".12" transform="translate(1.5 2)"/><rect x="${f(x - p.w * .3)}" y="${f(y - p.h * .26)}" width="${f(p.w * .6)}" height="${f(p.h * .52)}" rx="2" fill="${i % 2 ? '#22301f' : '#1a2618'}"/>`); }
    p.dots(['#4a5a3a', '#0f160e'], 40, .4, .9, .9).dots(['#fff'], 6, .4, .8, .7, .25);
  },
  anchovy(p, n) {
    p.bed('#b89a64');
    for (let i = 0; i < 40; i++) { const [x, y] = p.pt(.9), a = p.R(0, 6.28), L = p.R(5, 8); p.add(`<path d="M${f(x)} ${f(y)}q${f(Math.cos(a) * L * .5 + 1.5)} ${f(Math.sin(a) * L * .5 - 1.5)} ${f(Math.cos(a) * L)} ${f(Math.sin(a) * L)}" stroke="${p.pick(['#c9b48a', '#d8c69c', '#b59c6a', '#e2d3b0'])}" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="${f(x)}" cy="${f(y)}" r=".5" fill="#2a2a2a"/>`); }
    if (/견과|아몬드|땅콩|호두/.test(n)) for (let i = 0; i < 7; i++) { const [x, y] = p.pt(.8); p.lump(x, y, 3.6, 2.6, '#b07a42', { hi: .5, n: 8 }); }
    if (/고추|꽈리|매콤/.test(n)) p.strands(['#4f8f35', '#c8261b'], 6, 7, 2, .8);
    p.sesame(16);
  },
  pancake(p, n) {   // 전·부침·오꼬노미야끼
    const col = /김치|장떡|고추장/.test(n) ? ['#e0884a', '#d6773a'] : /감자/.test(n) ? ['#ecc96a', '#e2bc58'] : /깻잎/.test(n) ? ['#d9b05a', '#3f6a24'] : ['#e2b04f', '#d8a240'];
    for (let i = 0; i < 4; i++) { const x = p.w * (.28 + (i % 2) * .42), y = p.h * (.32 + Math.floor(i / 2) * .36); p.lump(x, y, p.w * .21, p.h * .18, col[i % 2 && !/깻잎/.test(n) ? 1 : 0], { hi: .4, n: 12, jit: .1, light: '#fff3c8' }); }
    p.dots(/김치/.test(n) ? ['#c8462a', '#a8361e'] : ['#5fa83a', '#e8762c', '#c98a3a'], 30, .8, 1.8, .9);
    p.dots(['#9a6020'], 30, .5, 1.3, .9, .5);
    if (/오꼬노미/.test(n)) { p.strands(['#5a2e12'], 5, 30, 2.4, .8); p.strands(['#fbf6e6'], 5, 30, 1.4, .8); p.dots(['#e6b0a0', '#c98a70'], 20, .8, 1.6, .7); }
  },
  dumpling(p, n) {
    for (let i = 0; i < 6; i++) { const x = p.w * (.22 + (i % 3) * .28), y = p.h * (.34 + Math.floor(i / 3) * .34); p.lump(x, y, 11, 7.5, '#f6eedc', { hi: .55, n: 10, jit: .06 }); for (let k = -2; k <= 2; k++) p.add(`<path d="M${f(x + k * 3)} ${f(y - 6)}l${f(k * .4)} 3.4" stroke="#d9cdb0" stroke-width="1"/>`); }
    if (/김치/.test(n)) p.dots(['#e8784a'], 6, 1.4, 2.2, .6, .5);
    p.lump(p.w * .78, p.h * .78, 6, 4.4, '#5a2e12', { hi: .5 });
  },
  tteok(p, n) {   // 떡·꿀떡·경단
    const pal = /초코|흑임자/.test(n) ? ['#5a3a2a', '#3a2a22'] : /쑥|수리취/.test(n) ? ['#7a9a4a', '#6a8a3e'] : ['#f6b8c8', '#bfe0a8', '#fbf6ea', '#f8e2a0'];
    for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.82); p.lump(x, y, 6, 5.4, p.pick(pal), { hi: .7, n: 11, jit: .05, light: '#fff' }); }
    if (/콩고물|인절미/.test(n)) p.dots(['#e8c47a', '#dcb466'], 60, .5, 1.1, .95);
    p.sesame(/꿀떡/.test(n) ? 0 : 8);
  },
  fruit(p, n) {
    const { w, h } = p;
    const circ = (x, y, r, col, rim, op = {}) => p.lump(x, y, r, r, col, { n: 14, jit: .03, ...op }) && rim && p.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r - .6)}" fill="none" stroke="${rim}" stroke-width="1.4" opacity=".6"/>`);
    if (/수박/.test(n)) { for (let i = 0; i < 3; i++) { const x = w * (.24 + i * .26), y = h * .5, s = Math.min(w * .14, 18); p.add(`<path d="M${f(x - s)} ${f(y + s * .9)}L${f(x)} ${f(y - s * 1.2)}L${f(x + s)} ${f(y + s * .9)}Z" fill="#000" opacity=".14" transform="translate(1.4 2)"/><path d="M${f(x - s)} ${f(y + s * .9)}L${f(x)} ${f(y - s * 1.2)}L${f(x + s)} ${f(y + s * .9)}Z" fill="#e8473f"/><rect x="${f(x - s)}" y="${f(y + s * .7)}" width="${f(s * 2)}" height="${f(s * .26)}" fill="#e9f1c9"/><rect x="${f(x - s)}" y="${f(y + s * .9)}" width="${f(s * 2)}" height="${f(s * .22)}" fill="#3f8f3a"/>`); for (let k = 0; k < 4; k++) p.add(`<ellipse cx="${f(x + p.R(-s * .4, s * .4))}" cy="${f(y + p.R(-s * .3, s * .4))}" rx=".9" ry="1.4" fill="#1a1a1a"/>`); } return; }
    if (/귤|오렌지|한라봉|천혜향|레드향|감귤|만다린/.test(n)) { for (let i = 0; i < 3; i++) { const x = w * (.27 + i * .23), y = h * (.5 + (i % 2 ? -.08 : .1)), r = Math.min(w * .13, h * .28); circ(x, y, r, '#f39a1f', null, { hi: .6, light: '#ffe2b0' }); p.add(`<circle cx="${f(x + 1)}" cy="${f(y - r * .1)}" r="1.4" fill="#b86a10" opacity=".6"/>`); } p.lump(w * .3, h * .3, 4, 2, '#3f8f3a', { sh: 0, hi: .3 }); return; }
    if (/사과|배$|배\(|아삭배/.test(n)) { const skin = /배/.test(n) ? '#c9a24a' : '#c8322b', meat = /배/.test(n) ? '#f8f0d6' : '#f7ecd2'; for (let i = 0; i < 5; i++) { const x = w * (.18 + i * .16), y = h * .5 + p.R(-4, 4); p.lump(x, y, 6, 16, meat, { hi: .4, n: 10, jit: .05 }); p.add(`<path d="M${f(x + 4)} ${f(y - 14)}Q${f(x + 9)} ${f(y)} ${f(x + 4)} ${f(y + 14)}" stroke="${skin}" stroke-width="3" fill="none" stroke-linecap="round"/>`); p.add(`<ellipse cx="${f(x - 1)}" cy="${f(y)}" rx="1" ry="2" fill="#6a3a1a"/>`); } return; }
    if (/바나나/.test(n)) { for (let i = 0; i < 2; i++) { const y = h * (.38 + i * .26); p.add(`<path d="M${f(w * .14)} ${f(y)}Q${f(w * .5)} ${f(y + h * .26)} ${f(w * .86)} ${f(y - 4)}Q${f(w * .5)} ${f(y + h * .1)} ${f(w * .14)} ${f(y)}Z" fill="#000" opacity=".12" transform="translate(1.5 2)"/><path d="M${f(w * .14)} ${f(y)}Q${f(w * .5)} ${f(y + h * .26)} ${f(w * .86)} ${f(y - 4)}Q${f(w * .5)} ${f(y + h * .1)} ${f(w * .14)} ${f(y)}Z" fill="#f3d34a"/><circle cx="${f(w * .14)}" cy="${f(y)}" r="2" fill="#5a3a1a"/><path d="M${f(w * .2)} ${f(y + 3)}Q${f(w * .5)} ${f(y + h * .16)} ${f(w * .8)} ${f(y)}" stroke="#d8b030" stroke-width="1" fill="none"/>`); } return; }
    if (/키위|골드키위/.test(n)) { const gold = /골드/.test(n); for (let i = 0; i < 4; i++) { const x = w * (.26 + (i % 2) * .48), y = h * (.32 + Math.floor(i / 2) * .36), r = Math.min(w * .17, h * .2); circ(x, y, r, '#8a6a3a', null, { hi: 0 }); circ(x, y, r * .86, gold ? '#e9c93a' : '#8fbf3a', null, { sh: 0, hi: .3 }); circ(x, y, r * .3, '#f6f2d8', null, { sh: 0, hi: 0 }); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; p.add(`<ellipse cx="${f(x + Math.cos(a) * r * .45)}" cy="${f(y + Math.sin(a) * r * .45)}" rx=".6" ry="1.2" fill="#1a1a1a" transform="rotate(${f(a * 57.3 + 90)} ${f(x + Math.cos(a) * r * .45)} ${f(y + Math.sin(a) * r * .45)})"/>`); } } return; }
    if (/파인애플/.test(n)) { for (let i = 0; i < 8; i++) { const [x, y] = p.pt(.8); p.lump(x, y, 9, 6, p.pick(['#f5d04b', '#f2c43a']), { hi: .5, n: 6, jit: .06 }); p.add(`<path d="M${f(x - 5)} ${f(y)}h10" stroke="#e2ae2a" stroke-width=".8"/>`); } return; }
    if (/멜론|참외/.test(n)) { const mel = /멜론/.test(n); for (let i = 0; i < 4; i++) { const x = w * (.2 + i * .2), y = h * .5; p.lump(x, y, 6.5, 18, mel ? '#cfe8a0' : '#f8f0c8', { hi: .4, n: 10, jit: .05 }); p.add(`<path d="M${f(x + 5)} ${f(y - 16)}Q${f(x + 10)} ${f(y)} ${f(x + 5)} ${f(y + 16)}" stroke="${mel ? '#8aa86a' : '#f2c62a'}" stroke-width="3" fill="none" stroke-linecap="round"/>`); } return; }
    if (/포도|머스캣|머스켓|청포도|거봉/.test(n)) { const g = /샤인|머스|청/.test(n) ? ['#a8d06a', '#9cc35a', '#b8da7a'] : ['#5e3570', '#6a3d7c', '#4e2a60']; for (let i = 0; i < 16; i++) { const [x, y] = p.pt(.7); p.lump(x, y, 5.6, 5.6, p.pick(g), { hi: .8, n: 12, jit: .03, light: '#fff' }); } p.strands(['#7a5a3a'], 3, 14, 1.2, .3); return; }
    if (/토마토/.test(n)) { for (let i = 0; i < 11; i++) { const [x, y] = p.pt(.78); p.lump(x, y, /대추/.test(n) ? 5 : 6, /대추/.test(n) ? 6.5 : 6, '#d8392a', { hi: .8, n: 12, jit: .04, light: '#ffe0d8' }); p.add(`<path d="M${f(x - 1.5)} ${f(y - 5)}l1.5 1.4l1.5 -1.4" stroke="#3f7a2a" stroke-width="1.2" fill="none"/>`); } if (/꿀|치즈/.test(n)) p.dots(['#fbf6e0'], 10, 1, 2, .7); return; }
    if (/딸기/.test(n)) { for (let i = 0; i < 8; i++) { const [x, y] = p.pt(.75); p.lump(x, y, 7, 8, '#d8283a', { hi: .7, n: 10, jit: .08 }); for (let k = 0; k < 4; k++) p.add(`<circle cx="${f(x + p.R(-4, 4))}" cy="${f(y + p.R(-4, 5))}" r=".6" fill="#f6e2a0"/>`); p.add(`<path d="M${f(x - 4)} ${f(y - 7)}l4 2.4l4 -2.4" stroke="#3f8f3a" stroke-width="1.8" fill="none"/>`); } return; }
    if (/복숭아|황도|천도/.test(n)) { for (let i = 0; i < 6; i++) { const [x, y] = p.pt(.75); p.lump(x, y, 11, 6, '#f6b55a', { hi: .6, n: 9 }); p.add(`<path d="M${f(x - 9)} ${f(y + 3)}q9 4 18 0" stroke="#e86a4a" stroke-width="2" fill="none" opacity=".7"/>`); } return; }
    if (/자두|블루베리|용과/.test(n)) { const c = /용과/.test(n) ? '#d83a7a' : /블루/.test(n) ? '#3a3a7a' : '#7a2a4a'; for (let i = 0; i < (/블루/.test(n) ? 20 : 4); i++) { const [x, y] = p.pt(.65); circ(x, y, /블루/.test(n) ? 4 : 11, c, null, { hi: .7 }); } return; }
    if (/망고/.test(n)) { p.rects(['#f6b42a', '#f2a21a', '#f8c64a'], 16, 9, .82, 1.6); return; }
    p.rects(['#e8473f', '#f39a1f', '#f3d34a', '#8fbf3a', '#f6efd8'], 16, 8, .8, 1.6);
  },
  bread(p, n) {   // 빵·파이·케이크·도넛·샌드위치·피자
    const { w, h } = p;
    if (/도넛|도너츠/.test(n)) { for (let i = 0; i < 2; i++) { const x = w * (.3 + i * .4), y = h * .5, r = Math.min(w * .19, h * .36); p.add(`<circle cx="${f(x + 1.5)}" cy="${f(y + 2)}" r="${f(r)}" fill="#000" opacity=".14"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#d49a4a"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * .9)}" fill="${/초코/.test(n) ? '#5a3424' : /딸기|핑크/.test(n) ? '#f2a6b8' : '#f6e6c8'}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * .32)}" fill="#c9b9a0"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * .26)}" fill="#dfd4c0"/>`); p.dots(['#fff', '#f2a6b8', '#7ab8e8'], 6, .6, 1, .3, .8); } return; }
    if (/피자/.test(n)) { for (let i = 0; i < 2; i++) { const x = w * (.32 + i * .36), y = h * .5, s = Math.min(w * .2, 24); p.add(`<path d="M${f(x - s)} ${f(y - s * .8)}L${f(x + s)} ${f(y - s * .8)}L${f(x)} ${f(y + s)}Z" fill="#000" opacity=".14" transform="translate(1.5 2)"/><path d="M${f(x - s)} ${f(y - s * .8)}L${f(x + s)} ${f(y - s * .8)}L${f(x)} ${f(y + s)}Z" fill="#f2c45a"/><rect x="${f(x - s)}" y="${f(y - s * .9)}" width="${f(s * 2)}" height="${f(s * .26)}" rx="3" fill="#c98a3a"/>`); for (let k = 0; k < 3; k++) p.add(`<circle cx="${f(x + p.R(-s * .35, s * .35))}" cy="${f(y + p.R(-s * .3, s * .2))}" r="${f(s * .14)}" fill="#b8322a"/>`); } return; }
    if (/샌드위치|토스트|버거|햄버거/.test(n)) { for (let i = 0; i < 2; i++) { const x = w * (.3 + i * .38), y = h * .5, s = Math.min(w * .19, h * .36); p.add(`<path d="M${f(x - s)} ${f(y + s)}L${f(x + s)} ${f(y + s)}L${f(x - s)} ${f(y - s)}Z" fill="#000" opacity=".14" transform="translate(1.5 2)"/><path d="M${f(x - s)} ${f(y + s)}L${f(x + s)} ${f(y + s)}L${f(x - s)} ${f(y - s)}Z" fill="#e8c890"/><path d="M${f(x - s)} ${f(y + s)}L${f(x + s)} ${f(y + s)}" stroke="#7cb648" stroke-width="3"/><path d="M${f(x - s + 3)} ${f(y + s - 3)}L${f(x + s - 6)} ${f(y + s - 3)}" stroke="#f2c43a" stroke-width="2.4"/><path d="M${f(x - s)} ${f(y + s)}L${f(x + s)} ${f(y + s)}L${f(x - s)} ${f(y - s)}Z" fill="none" stroke="#c9944a" stroke-width="2"/>`); } return; }
    if (/케이크|티라미수|롤케/.test(n)) { const x = w * .5, y = h * .5, s = Math.min(w * .3, h * .42); p.add(`<path d="M${f(x - s)} ${f(y + s * .5)}L${f(x + s)} ${f(y + s * .5)}L${f(x + s * .2)} ${f(y - s * .6)}Z" fill="#000" opacity=".14" transform="translate(1.5 2)"/><path d="M${f(x - s)} ${f(y + s * .5)}L${f(x + s)} ${f(y + s * .5)}L${f(x + s * .2)} ${f(y - s * .6)}Z" fill="${/초코|티라/.test(n) ? '#6a4030' : '#f6ead0'}"/><path d="M${f(x - s * .6)} ${f(y + s * .1)}L${f(x + s * .7)} ${f(y + s * .1)}" stroke="${/딸기/.test(n) ? '#e8667a' : '#fbf6ea'}" stroke-width="3"/>`); p.lump(x + s * .2, y - s * .5, 4, 4, /딸기/.test(n) ? '#d8283a' : '#fbf6ea', { hi: .6 }); return; }
    if (/마카롱/.test(n)) { for (let i = 0; i < 3; i++) { const x = w * (.26 + i * .24), y = h * .5, c = ['#f2a6b8', '#bfe0a8', '#f8e2a0'][i]; p.lump(x, y, 9, 9, c, { hi: .5, n: 14, jit: .03 }); p.add(`<circle cx="${f(x)}" cy="${f(y)}" r="9.5" fill="none" stroke="#fbf6ea" stroke-width="1.6" opacity=".9"/>`); } return; }
    // 파이·타르트·데니쉬·머핀·쿠키·베이글 등
    const pie = /파이|타르트|데니쉬|크로와상|페스츄리/.test(n);
    const cnt = /쿠키|마들렌|미니|츄러스|스틱/.test(n) ? 5 : 2;
    for (let i = 0; i < cnt; i++) {
      const [x, y] = cnt === 2 ? [w * (.3 + i * .4), h * .5] : p.pt(.7), r = cnt === 2 ? Math.min(w * .18, h * .34) : 9;
      p.lump(x, y, r, r * .86, /초코/.test(n) ? '#6a4030' : pie ? '#d99a48' : /베이글/.test(n) ? '#c98a40' : '#e0b06a', { hi: .55, n: 12, jit: .08, light: '#fff0c8' });
      if (pie) for (let k = -1; k <= 1; k++) p.add(`<path d="M${f(x - r * .7)} ${f(y + k * r * .35)}L${f(x + r * .7)} ${f(y + k * r * .35)}" stroke="#b8732a" stroke-width="1.6" opacity=".7"/>`);
      if (/에그/.test(n)) p.lump(x, y, r * .62, r * .55, '#f4c84a', { sh: 0, hi: .5 });
      if (/딸기|베리|체리/.test(n)) p.lump(x, y, r * .5, r * .45, '#c8283a', { sh: 0, hi: .6 });
      if (/초코칩|쿠키/.test(n)) p.dots(['#3a2418'], 4, .8, 1.4, .25);
      if (/크림치즈|리코타/.test(n)) p.lump(x + r * .6, y + r * .3, r * .35, r * .28, '#fbf8ef', { hi: .3 });
    }
    if (/슈가|설탕|츄러스|글레이즈|꽈배기/.test(n)) p.dots(['#fbf6e8'], 30, .4, .8, .9);
  },
  cup(p, n) {   // 요거트·푸딩·젤리 (컵에 담긴 디저트)
    const { w, h } = p, x = w / 2, y = h / 2, s = Math.min(w, h) * .32;
    const top = /초코/.test(n) ? '#6a4030' : /딸기|복숭아|용과/.test(n) ? '#f6b8c4' : /망고|오렌지/.test(n) ? '#f6c25a' : /블루/.test(n) ? '#8a7ab8' : /젤리/.test(n) ? '#f2a0a8' : '#fbf8ef';
    p.add(`<circle cx="${f(x + 1.5)}" cy="${f(y + 2)}" r="${f(s)}" fill="#000" opacity=".15"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="#ffffff"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s * .84)}" fill="${top}"/><ellipse cx="${f(x - s * .3)}" cy="${f(y - s * .35)}" rx="${f(s * .3)}" ry="${f(s * .14)}" fill="#fff" opacity=".45"/>`);
    if (/그래놀라|크래놀라|그릭/.test(n)) p.dots(['#c98a40', '#a86a2a', '#d8283a'], 14, .8, 1.8, .45);
  },
  cereal(p, n) {   // 시리얼+우유
    p.liquid('#fbf8f0', '#d8d0bf', .3);
    const pal = /초코|첵스|오레오|코코/.test(n) ? ['#5a3424', '#6a4030', '#3a2418'] : /후르츠|링/.test(n) ? ['#f26a5a', '#f6c23a', '#7cc04a', '#7ab8e8', '#c86ad0'] : ['#e8b450', '#f0c460', '#d8a040'];
    const ring = /후르츠|링|오레오즈|치리오/.test(n);
    for (let i = 0; i < 30; i++) { const [x, y] = p.pt(.95), c = p.pick(pal); ring ? p.add(`<circle cx="${f(x)}" cy="${f(y)}" r="3.4" fill="none" stroke="${c}" stroke-width="2.4"/>`) : /첵스|볼/.test(n) ? p.lump(x, y, 3.4, 3.4, c, { sh: .3, hi: .5, n: 6 }) : p.lump(x, y, p.R(4, 6), p.R(3, 4.4), c, { sh: .3, hi: .5, n: 7, jit: .3 }); }
    if (/아몬드/.test(n)) p.dots(['#f2e6c8'], 10, 1, 1.6, .8);
  },
  pickle(p, n) {   // 단무지·장아찌·피클
    const col = /단무지/.test(n) ? ['#f2d33b', '#f6e06a'] : /깻잎/.test(n) ? ['#2f4a22', '#3a5a2a'] : /무/.test(n) ? ['#d9a65a', '#e2b46a'] : ['#b8c86a', '#a8bc5a'];
    for (let i = 0; i < 10; i++) { const [x, y] = p.pt(.8); p.lump(x, y, 9, /깻잎/.test(n) ? 9 : 4.4, p.pick(col), { hi: .5, n: 10, jit: .05 }); }
    if (/무침|양념/.test(n)) p.flakes(14).sesame(10);
  },
  wrap(p, n) {   // 상추쌈·양배추쌈·무쌈 (+쌈장)
    const pal = /양배추/.test(n) ? ['#d8e8b0', '#c8dc98', '#e4f0c4'] : /무쌈/.test(n) ? ['#f6f2e6', '#ecf0d8'] : ['#6aa83f', '#7cbc4c', '#5a9a34', '#8fc85a'];
    for (let i = 0; i < 7; i++) { const [x, y] = p.pt(.6); p.lump(x, y, p.R(14, 18), p.R(10, 13), p.pick(pal), { hi: .4, n: 12, jit: .28 }); p.add(`<path d="M${f(x - 10)} ${f(y)}Q${f(x)} ${f(y - 4)} ${f(x + 10)} ${f(y + 2)}" stroke="#fff" stroke-width="1" fill="none" opacity=".5"/>`); }
    if (/쌈장|양념장/.test(n)) p.lump(p.w * .76, p.h * .74, 8, 6, '#8a4a22', { hi: .4 }).sesame(4, .2);
  },
  sauce(p, n) {   // 소스·양념장 단독
    const c = /초장|고추장|칠리|케찹/.test(n) ? '#c8261b' : /마요|타르|요거트|드레싱/.test(n) ? '#f6f0d8' : '#6a3a1e';
    p.add(`<circle cx="${f(p.w / 2 + 1.5)}" cy="${f(p.h / 2 + 2)}" r="${f(Math.min(p.w, p.h) * .3)}" fill="#000" opacity=".15"/><circle cx="${f(p.w / 2)}" cy="${f(p.h / 2)}" r="${f(Math.min(p.w, p.h) * .3)}" fill="#fff"/>`);
    p.lump(p.w / 2, p.h / 2, Math.min(p.w, p.h) * .24, Math.min(p.w, p.h) * .22, c, { sh: 0, hi: .5, n: 12, jit: .05 });
  },
  veg(p, n) {   // 채소 볶음·조림(고기 없는 반찬)
    const spec = [
      [/감자채|감자볶음|베이컨감자/, ['#f2dca0', '#ead08a', '#f6e6b8'], 'str'], [/감자조림|알감자/, ['#e2b860', '#d8a848', '#c9963a'], 'cube'],
      [/버섯/, ['#d8c7a6', '#c8b48e', '#efe5d0'], 'str'], [/애호박|호박/, ['#9cc35a', '#b8d47a', '#f2e6b0'], 'moon'],
      [/연근/, ['#9a6a3a', '#8a5a2a'], 'lotus'], [/우엉/, ['#5a3420', '#6a4028'], 'str'], [/콩자반|검은콩|서리태|콩조림/, ['#1d1a1f', '#2a2228'], 'bean'],
      [/마늘쫑|줄기|꽈리/, ['#5a9a3a', '#4f8f35', '#6aa846'], 'stick'], [/고구마/, ['#f0b84a', '#e8a63a', '#b8325a'], 'cube'],
      [/당근/, ['#e8762c', '#f08a3a'], 'str'], [/양배추|배추/, ['#e4ecc4', '#d0e0a8'], 'leaf'], [/숙주/, ['#f6efcf'], 'str'],
    ].find(([re]) => re.test(n)) || [, ['#9a6a3c', '#7cb648', '#e8762c', '#f2e2bf'], 'mix'];
    const [, pal, kind] = spec;
    p.bed(pal[0] + '', null, .92);
    if (kind === 'str') p.strands(pal, 48, 16, 2.6, .95);
    else if (kind === 'cube') p.rects(pal, 16, 8, .88, 2);
    else if (kind === 'bean') for (let i = 0; i < 40; i++) { const [x, y] = p.pt(.9); p.lump(x, y, 3.4, 2.6, p.pick(pal), { sh: .3, hi: .9, n: 7, light: '#fff' }); }
    else if (kind === 'stick') p.strands(pal, 28, 14, 3.2, .95);
    else if (kind === 'lotus') for (let i = 0; i < 7; i++) { const [x, y] = p.pt(.75); p.lump(x, y, 11, 10, p.pick(pal), { hi: .7, n: 12, jit: .05 }); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; p.add(`<circle cx="${f(x + Math.cos(a) * 5.5)}" cy="${f(y + Math.sin(a) * 5)}" r="1.7" fill="#3a2010"/>`); } }
    else if (kind === 'moon') for (let i = 0; i < 14; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 7, 4.4, '#f2ecc0', { hi: .3, n: 10 }); p.add(`<path d="M${f(x - 6)} ${f(y + 3)}q6 3.6 12 0" stroke="#5a9a3a" stroke-width="2" fill="none"/>`); }
    else if (kind === 'leaf') for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.85); p.lump(x, y, 9, 6, p.pick(pal), { hi: .4, n: 10, jit: .3 }); }
    else p.rects(pal, 18, 6, .88, 1.6);
    if (/새우/.test(n)) for (let i = 0; i < 6; i++) { const [x, y] = p.pt(.8); p.add(`<path d="M${f(x - 3)} ${f(y)}a3.4 3.4 0 1 1 6 0" stroke="#f08a6a" stroke-width="2.8" fill="none" stroke-linecap="round"/>`); }
    if (/베이컨|햄/.test(n)) p.rects(['#d98a7a'], 8, 4, .8, 1);
    if (/카레/.test(n)) p.dots(['#d9a020'], 30, .6, 1.2, .9);
    if (/매콤|고추장/.test(n)) p.flakes(16);
    p.sesame(12);
  },
  misc(p, n) { p.bed('#b98a54', '#8a5a2a'); for (let i = 0; i < 12; i++) { const [x, y] = p.pt(.85); p.lump(x, y, p.R(6, 9), p.R(4.5, 7), p.pick(['#a8703c', '#c08850', '#8f5a2c', '#7cb648']), { hi: .5, n: 9 }); } p.sesame(10); },
};

/* ---------- 이름 → 종류 ---------- */
const RULES = [
  [/(드레싱|소스)$/, 'sauce'],
  [/피자|버거|샌드위치/, 'bread'],
  [/시리얼|콘푸|첵스|오레오즈|후르츠링|그래놀라|크래놀라|아몬드후레이크|초코볼/, 'cereal'],
  [/요거트|요구르트|요플레|푸딩|젤리|엔요|그릭/, 'cup'],
  [/죽$|죽\(/, 'porridge'],
  [/(볶음밥|비빔밥|김밥|주먹밥|오므라이스|필라프|리조또)/, 'mixRice'],
  [/참치마요$|(덮밥|카레라이스|라이스|짜장밥|커리|카레$|하이라이스|마파두부밥)/, 'sauceRice'],
  [/밥$|밥\(/, 'rice'],
  [/(국|탕|찌개|수프|스프|전골|짬뽕|개장|짜글이|국밥|청국장)$|국\(|탕\(/, 'soup'],
  [/떡볶이|떡꼬치|누들떡/, 'redMeat'],
  [/면$|국수|우동|파스타|스파게티|뇨끼|짜장면|쫄면|막국수|냉면|모밀|소바|잡채|탄탄|쌀국수|푸실리|라면|라멘|마카로니(?!샐러드)/, 'noodle'],
  [/수박|귤|오렌지|한라봉|천혜향|레드향|사과$|배$|바나나|키위|파인애플|멜론|참외|포도|머스캣|머스켓|토마토$|방울토마토|딸기$|휘핑딸기|복숭아$|황도$|자두$|망고$|용과|블루베리$|과일$/, 'fruit'],
  [/샐러드|코울슬로|카프레제/, 'salad'],
  [/김치(?!.*(찌개|국|볶음밥|전|만두|우동|덮밥|죽|어묵|볶음$|찜))|깍두기|석박지|섞박지|총각|열무김치|파김치|오이소박이|볶음김치/, 'kimchi'],
  [/구이김|김구이|김자반|김가루|^김$|돌김|파래김/, 'laver'],
  [/멸치/, 'anchovy'],
  [/쌈$|쌈\+|상추쌈|양배추쌈|무쌈/, 'wrap'],
  [/단무지|장아찌|피클|깻잎지|오이지(?!무침)/, 'pickle'],
  [/메추리알|장조림|계란장/, 'braisedEgg'],
  [/계란|달걀|에그(?!타르트)|오믈렛|스크램블/, 'egg'],
  [/도토리묵|청포묵|묵채|묵무침|묵국|탕평채/, 'jelly'],
  [/두부/, 'tofu'],
  [/나물|무침|겉절이|생채|초회|숙회|무말랭이|진미채|명엽채|오징어채|쥐포|미역줄기/, 'greens'],
  [/까스|가스$|커틀릿|카츠|튀김|강정|탕수|너겟|텐더|치킨(?!마요)|크로켓|고로케|춘권|짜조|핫도그|츄러스|맛탕|해쉬|해시|후라이|크링클|가라아게|윙|봉|닭강정|지파이|모짜치즈볼|새우볼/, 'fried'],
  [/생선|고등어|삼치|연어|가자미|동태|임연수|조기|코다리|꽁치|갈치|명태|열기/, 'fish'],
  [/전$|부침|오꼬노미|빈대떡|동그랑땡전|장떡/, 'pancake'],
  [/떡갈비|함박|동그랑땡|미트볼|완자|너비아니|스테이크|패티/, 'patty'],
  [/만두/, 'dumpling'],
  [/수육|보쌈|족발|훈제오리|오리훈제|소시지|비엔나|후랑크|햄|스팸|베이컨|맛살|크래미|어묵|오뎅|가마보꼬|순대(?!볶음)/, 'sliced'],
  [/제육|닭갈비|고추장|두루치기|매콤|오징어볶음|주꾸미|쭈꾸미|낙지|순대볶음|마라|양념치킨|부대볶음|불닭|닭볶음탕/, 'redMeat'],
  [/불고기|갈비|찜닭|데리야끼|간장|주물럭|샤브|대패|오리|돈육|돼지|쇠고기|소고기|닭|목살|삼겹|고기/, 'brownMeat'],
  [/떡|경단|인절미|송편/, 'tteok'],
  [/빵|파이|케이크|머핀|와플|토스트|도넛|도너츠|쿠키|타르트|마카롱|베이글|데니쉬|크로플|크로와상|샌드위치|피자|버거|스콘|브라우니|마들렌|꽈배기|롤케/, 'bread'],
  [/볶음|조림|구이|찜/, 'veg'],
  [/소스|양념장|쌈장|초장|드레싱/, 'sauce'],
];
export const foodKind = n => (RULES.find(([re]) => re.test(n)) || [, 'misc'])[1];

/** 메뉴 이름 → SVG. shape: 'n'(위 칸) | 'half'(위 가운데 반쪽) | 'big'(밥·국 칸) | 'seg'(한 칸에 여러 개일 때 한 줄) */
const SIZE = { n: [100, 120], half: [170, 100], big: [160, 100], seg: [200, 80] };
const memo = new Map();
export function foodSvg(name, shape = 'n') {
  const key = shape + '|' + name;
  if (memo.has(key)) return memo.get(key);
  const [w, h] = SIZE[shape] || SIZE.n, n = String(name).split('+')[0] || name;
  const p = new Pen(w, h, seedOf(name));
  try { DRAW[foodKind(n)](p, String(name)); } catch { p.o = []; DRAW.misc(p, String(name)); }
  const s = p.svg();
  memo.set(key, s);
  return s;
}

/* ---------- 음료 (식판 옆에 따로) ---------- */
export const isDrink = n => !/\+/.test(n) && !/드레싱|스파게티|푸딩|아이스|도넛|핫도그|젤리|그릭|요플레|생크림요거트|우유생크림/.test(n)
  && /(우유|주스|쥬스|에이드|라떼|식혜|수정과|쿨피스|미숫가루|두유|요구르트(\(.*\))?|요구르트제로|야쿠르트|티|코코|스무디|쉐이크|셰이크|음료|워터|소다)$/.test(n);

const DRINK_COL = [
  [/초코|코코아|모카/, '#6a4030'], [/딸기|딸바|체리|크랜|베리/, '#f29aac'], [/바나나/, '#f6e08a'], [/멜론/, '#bfe39a'], [/커피|라떼|밀크티|미숫가루|달밤/, '#c9a07a'],
  [/오렌지|한라봉|감귤|귤|망고|파인애플|트로피컬|살구|패션|천혜향/, '#f6a62a'], [/포도(?!.*청)|퍼플|블루베리|오미자|자두|플럼|용과/, '#7a3a7a'],
  [/청포도|청사과|키위|샤인|머스캣|청귤|매실|깔라만시|라임/, '#b8d86a'], [/레몬/, '#f6e05a'], [/자몽|복숭아|피치|리치/, '#f6a49a'],
  [/수박/, '#f2687a'], [/사과|애플/, '#f2d88a'], [/식혜|수정과/, '#e8d6a8'], [/쿨피스|요구르트|야쿠르트|우유|두유/, '#fbf8f0'],
];
const drinkCol = n => /블루레몬|블루/.test(n) ? '#5ab0e8' : (DRINK_COL.find(([re]) => re.test(n)) || [, '#f6c25a'])[1];

/** 음료 그림: 우유 → 종이팩, 요구르트 → 작은 병, 나머지 → 투명 컵 + 빨대 */
export function drinkSvg(name) {
  const c = drinkCol(name);
  if (/우유|두유|쿨피스/.test(name) && !/라떼|생크림/.test(name)) {
    const band = /초코/.test(name) ? '#6a4030' : /딸기|딸바/.test(name) ? '#e8667a' : /바나나/.test(name) ? '#e8c43a' : /멜론/.test(name) ? '#7cb648' : /쿨피스/.test(name) ? '#e8762c' : '#3a7ad8';
    return `<svg class="drk" viewBox="0 0 60 90" aria-hidden="true" focusable="false"><ellipse cx="31" cy="86" rx="22" ry="3.4" fill="#000" opacity=".16"/>`
      + `<path d="M10 30L18 12H44L52 30Z" fill="#eef2f6"/><path d="M18 12H44V7H18Z" fill="#dfe6ee"/><path d="M31 12L23 30H39Z" fill="#d6dee8"/>`
      + `<rect x="10" y="30" width="42" height="54" rx="2" fill="#fff"/><rect x="10" y="30" width="42" height="54" rx="2" fill="none" stroke="#c9d3df" stroke-width="1.4"/>`
      + `<rect x="10" y="46" width="42" height="20" fill="${band}"/><circle cx="31" cy="56" r="7" fill="#fff" opacity=".9"/><circle cx="31" cy="56" r="4" fill="${c}"/>`
      + `<rect x="13" y="32" width="5" height="48" fill="#fff" opacity=".6"/></svg>`;
  }
  if (/요구르트|야쿠르트/.test(name)) {
    return `<svg class="drk" viewBox="0 0 60 90" aria-hidden="true" focusable="false"><ellipse cx="30" cy="86" rx="16" ry="3" fill="#000" opacity=".16"/>`
      + `<path d="M19 22Q19 14 24 12H36Q41 14 41 22L42 44Q36 50 42 58L41 80Q40 84 30 84Q20 84 19 80L18 58Q24 50 18 44Z" fill="#fff6f0" stroke="#e8c8b8" stroke-width="1.2"/>`
      + `<rect x="21" y="8" width="18" height="6" rx="2" fill="#e8462a"/><rect x="21" y="60" width="18" height="12" rx="2" fill="#e8462a" opacity=".85"/><rect x="22" y="20" width="3" height="56" fill="#fff" opacity=".7"/></svg>`;
  }
  const ade = /에이드|소다|워터/.test(name), latte = /라떼|미숫가루|밀크티|식혜/.test(name);
  return `<svg class="drk" viewBox="0 0 60 90" aria-hidden="true" focusable="false"><ellipse cx="30" cy="86" rx="20" ry="3.4" fill="#000" opacity=".16"/>`
    + `<path d="M36 2L33 30" stroke="${ade ? '#e8462a' : '#3a7ad8'}" stroke-width="3.4" stroke-linecap="round"/>`
    + `<path d="M11 18H49L45 82Q44 85 41 85H19Q16 85 15 82Z" fill="#eaf2f8" opacity=".75"/>`
    + `<path d="M12.4 30H47.6L45 82Q44 85 41 85H19Q16 85 15 82Z" fill="${c}"/>`
    + (latte ? `<path d="M12.4 30H47.6L46.8 44Q30 50 13.3 44Z" fill="#fff" opacity=".45"/>` : '')
    + (ade ? `<rect x="17" y="34" width="11" height="10" rx="2" fill="#fff" opacity=".55" transform="rotate(-12 22 39)"/><rect x="30" y="40" width="11" height="10" rx="2" fill="#fff" opacity=".5" transform="rotate(14 35 45)"/><circle cx="24" cy="66" r="1.6" fill="#fff" opacity=".7"/><circle cx="36" cy="72" r="1.2" fill="#fff" opacity=".7"/><circle cx="30" cy="58" r="1" fill="#fff" opacity=".7"/>` : '')
    + `<path d="M36 2L33.6 30" stroke="${ade ? '#e8462a' : '#3a7ad8'}" stroke-width="3.4" stroke-linecap="round" opacity=".55"/>`
    + `<path d="M11 18H49" stroke="#c9d3df" stroke-width="2.4" stroke-linecap="round"/><path d="M15 22L19 80" stroke="#fff" stroke-width="2.4" opacity=".7" stroke-linecap="round"/>`
    + `<path d="M11 18H49L45 82Q44 85 41 85H19Q16 85 15 82Z" fill="none" stroke="#b9c6d4" stroke-width="1.2"/></svg>`;
}
