// SVMHS GROUND — 등교하기! 지도(2026-11-02 하율 "실제 지도 모양처럼, 건물·오브젝트 배치, 노선도를 잘 보이게 깔고 그 위를 지하철이 진짜 지나가는 느낌, 한 글자 칠 때마다 이동")
// 화면 전용(서버 안 씀). 역 위치 = 실제 위도·경도(대략) → 1km = K px. 배경(땅·길·건물·공원·한강·안양천)은 노선 둘레만 판마다 한 번 그려 캐시,
// 노선·역·열차는 매 프레임 벡터로 그림. createMap(stops) → { draw(c, W, H, p, cur, now, done), keyFrac }
import { LINES, ROUTES, stopsOf } from './commute-score.js';

const K = 210;   // 1km = 210px
// 역 위도·경도(대략, 노선 모양용) — 새 노선을 넣으면 여기도
const LL = {
  방화: [37.5775, 126.8128], 개화산: [37.5725, 126.8066], 김포공항: [37.5624, 126.8013], 송정: [37.5612, 126.8114], 마곡: [37.5602, 126.8254],
  발산: [37.5585, 126.8376], 우장산: [37.5487, 126.8364], 화곡: [37.5416, 126.8404], 까치산: [37.5317, 126.8466], 신정: [37.5250, 126.8562],
  목동: [37.5260, 126.8645], 오목교: [37.5245, 126.8751], 양평: [37.5254, 126.8860], 영등포구청: [37.5250, 126.8961], 영등포시장: [37.5226, 126.9050],
  신길: [37.5174, 126.9175], 여의도: [37.5216, 126.9243], 여의나루: [37.5271, 126.9328], 마포: [37.5394, 126.9459], 공덕: [37.5443, 126.9516], 애오개: [37.5535, 126.9567],
  봉천: [37.4823, 126.9418], 신림: [37.4842, 126.9297], 신대방: [37.4875, 126.9133], 구로디지털단지: [37.4852, 126.9015], 대림: [37.4930, 126.8950],
  신도림: [37.5088, 126.8912], 문래: [37.5180, 126.8946], 당산: [37.5343, 126.9024], 합정: [37.5496, 126.9139], 홍대입구: [37.5572, 126.9245],
  신촌: [37.5552, 126.9369], 이대: [37.5567, 126.9460], 아현: [37.5574, 126.9561],
  도림천: [37.5145, 126.8827], 양천구청: [37.5122, 126.8656], 신정네거리: [37.5200, 126.8530],
  양천향교: [37.5682, 126.8418], 마곡나루: [37.5670, 126.8273], 신방화: [37.5675, 126.8170], 공항시장: [37.5636, 126.8107],
  신목동: [37.5442, 126.8828], 선유도: [37.5378, 126.8935], 국회의사당: [37.5281, 126.9177], 샛강: [37.5172, 126.9288], 노량진: [37.5136, 126.9400],
  노들: [37.5128, 126.9530], 흑석: [37.5088, 126.9638], 대흥: [37.5477, 126.9423], 남영: [37.5410, 126.9714], 용산: [37.5299, 126.9648], 대방: [37.5133, 126.9264],
};
const P = ([la, lo]) => [(lo - 126.78) * 88.2 * K, (37.60 - la) * 111 * K];
const HAN = [[37.596, 126.77], [37.586, 126.80], [37.577, 126.83], [37.566, 126.86], [37.555, 126.885], [37.546, 126.903], [37.538, 126.918], [37.531, 126.936], [37.524, 126.951], [37.518, 126.962], [37.512, 126.975], [37.511, 127.0]].map(P);
const ANY = [[37.47, 126.884], [37.49, 126.886], [37.505, 126.883], [37.52, 126.881], [37.535, 126.885], [37.553, 126.888]].map(P);   // 안양천
const SAET = [[37.531, 126.903], [37.524, 126.913], [37.518, 126.927], [37.521, 126.939]].map(P);   // 샛강
const PARKS = [[37.5263, 126.9221, .55, '여의도공원'], [37.5434, 126.8994, .28, '선유도공원'], [37.5694, 126.8350, .5, '서울식물원'], [37.5300, 126.8760, .22, '파리공원'], [37.4920, 126.9190, .5, '보라매공원'], [37.5165, 126.8990, .18, '']]
  .map(([la, lo, r, n]) => [...P([la, lo]), r * K, n]);
const SCHOOL = P([37.5228, 126.8521]);   // 서울영상고(신정역 근처, 대략)
export const lineColor = l => LINES[l]?.[1] || '#888';

// 점과 꺾은선 사이 거리
function dSeg(x, y, L) {
  let m = 1e9;
  for (let i = 1; i < L.length; i++) {
    const [ax, ay] = L[i - 1], [bx, by] = L[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    m = Math.min(m, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return m;
}
const rnd = s => () => { s |= 0; s = s + 0x6d2b79f5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// Catmull-Rom으로 역 사이를 부드럽게 → 촘촘한 점 + 누적 길이, 역마다 점 번호
function smooth(pts) {
  const out = [], at = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    at.push(out.length);
    const n = Math.max(6, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  at.push(out.length); out.push(pts[pts.length - 1]);
  const S = [0]; for (let i = 1; i < out.length; i++) S.push(S[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out, S, at };
}

// 두벌식 자판 순서(겹모음·겹받침은 두 번) — 친 글자가 목표의 몇 타째까지 맞는지(조합 중인 글자도)
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CJ = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ', ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ' };
export function seqOf(s) {
  let o = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c <= 11171) o += CHO[Math.floor(c / 588)] + JUNG[Math.floor(c % 588 / 28)] + JONG[c % 28];
    else o += CJ[ch] || ch;
  }
  return o;
}
export function keyFrac(typed, target) {
  const a = seqOf(typed), b = seqOf(target); let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return b.length ? i / b.length : 0;
}

// 비스듬히 위에서 본 시점(fake 3D): 땅은 세로를 T배로 눌러 그리고(c.scale(1, T)), 건물·나무·학교는 높이만큼 위로 세워 그림(남쪽 벽 + 지붕).
// 화면 좌표 = [x, y × T]. 배경은 노선 둘레만 판마다 한 번 캔버스에 캐시 — 위로 솟는 높이만큼(HMAX) 위쪽 여백을 더 둠
export const T = .62, HMAX = 60;
function buildBg(box, all, lines) {
  const d = Math.min(2, window.SG_DPR || devicePixelRatio || 1), BW = box.w, BH = box.h * T + HMAX, sc = Math.min(d, Math.sqrt(12e6 / (BW * BH)));
  const cv = document.createElement('canvas'); cv.width = Math.round(BW * sc); cv.height = Math.round(BH * sc);
  const c = cv.getContext('2d'); c.scale(sc, sc); c.translate(-box.x, -box.y * T + HMAX);
  const water = (x, y, pad) => dSeg(x, y, HAN) < 70 + pad || dSeg(x, y, ANY) < 12 + pad || dSeg(x, y, SAET) < 10 + pad;
  const inPark = (x, y, pad) => PARKS.some(([px, py, r]) => Math.hypot(x - px, y - py) < r + pad);
  const onLine = (x, y, pad) => lines.some(L => dSeg(x, y, L) < pad);
  const G = 96, x0 = Math.floor(box.x / G) * G, y0 = Math.floor(box.y / G) * G;
  // ---- 땅(눌러 그림) ----
  c.save(); c.scale(1, T);
  c.fillStyle = '#efece3'; c.fillRect(box.x, box.y, box.w, box.h);
  for (let gx = x0; gx < box.x + box.w; gx += G) for (let gy = y0; gy < box.y + box.h; gy += G) {
    const r = rnd(gx * 7919 + gy * 104729);
    c.fillStyle = ['#ebe8de', '#e8e6df', '#eeebe2', '#e7e3d8'][Math.floor(r() * 4)]; c.fillRect(gx + 5, gy + 5, G - 10, G - 10);
  }
  const road = (big, w, col) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'butt';
    for (let gx = x0; gx < box.x + box.w; gx += G) { if (((gx / G) % 3 === 0) !== big) continue; c.beginPath(); c.moveTo(gx, box.y); c.lineTo(gx + 14, box.y + box.h); c.stroke(); }
    for (let gy = y0; gy < box.y + box.h; gy += G) { if (((gy / G) % 3 === 0) !== big) continue; c.beginPath(); c.moveTo(box.x, gy); c.lineTo(box.x + box.w, gy - 10); c.stroke(); }
  };
  road(false, 8, '#d6d1c4'); road(false, 6, '#fbf9f3'); road(true, 15, '#cdc6b6'); road(true, 13, '#fbf9f3');
  c.strokeStyle = '#f2cf6b'; c.lineWidth = 1.2; c.setLineDash([8, 8]);
  for (let gx = x0; gx < box.x + box.w; gx += G * 3) { c.beginPath(); c.moveTo(gx, box.y); c.lineTo(gx + 14, box.y + box.h); c.stroke(); }
  for (let gy = y0; gy < box.y + box.h; gy += G * 3) { c.beginPath(); c.moveTo(box.x, gy); c.lineTo(box.x + box.w, gy - 10); c.stroke(); }
  c.setLineDash([]);
  PARKS.forEach(([px, py, r]) => { c.fillStyle = '#cbe6ae'; c.strokeStyle = '#addb8c'; c.lineWidth = 3; c.beginPath(); c.ellipse(px, py, r, r * .78, -.3, 0, 7); c.fill(); c.stroke(); });
  { const [sx, sy] = SCHOOL; c.fillStyle = '#cfe8b4'; c.fillRect(sx - 34, sy + 4, 68, 40); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(sx - 26, sy + 10, 52, 28); }   // 운동장
  const river = (L, w, bank) => {
    c.lineJoin = c.lineCap = 'round';
    c.strokeStyle = '#c3e3a0'; c.lineWidth = w + bank; c.beginPath(); L.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    c.strokeStyle = '#7fc2ea'; c.lineWidth = w + 6; c.stroke();   // 물가 그늘(제방 높이)
    c.strokeStyle = '#8fcdf0'; c.lineWidth = w; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; c.setLineDash([10, 22]); c.stroke(); c.setLineDash([]);
  };
  river(ANY, 22, 14); river(SAET, 18, 12); river(HAN, 140, 40);
  c.restore();
  // ---- 세운 것들(뒤 → 앞 순서) ----
  const items = [];
  PARKS.forEach(([px, py, r]) => { if (px + r < box.x || px - r > box.x + box.w || py + r < box.y || py - r > box.y + box.h) return; const t = rnd(px * 31 + py); for (let k = 0; k < r * r / 150; k++) { const a = t() * 7, q = Math.sqrt(t()) * r * .85, x = px + Math.cos(a) * q, y = py + Math.sin(a) * q * .78; if (!onLine(x, y, 26)) items.push({ y, f: () => tree(c, x, y * T, 4 + t() * 3, t() < .5 ? '#7fbf5a' : '#97cf6f') }); } });
  for (let gx = x0; gx < box.x + box.w; gx += G) for (let gy = y0; gy < box.y + box.h; gy += G) {
    const r = rnd(gx * 131 + gy * 977 + 5), n = 1 + Math.floor(r() * 4), tower = r() < .2;
    for (let k = 0; k < n; k++) {
      const w = tower ? 18 + r() * 14 : 14 + r() * 26, h = tower ? 16 + r() * 12 : 10 + r() * 20;
      const x = gx + 10 + r() * (G - 20 - w), y = gy + 10 + r() * (G - 20 - h), cx = x + w / 2, cy = y + h / 2;
      const ht = tower ? 26 + r() * 30 : 7 + r() * 9, pal = tower ? ['#c7d7ee', '#b5cbe8', '#d3dbea'] : ['#f0dcc8', '#e3e7f1', '#f4e2d1', '#dcebdf', '#ece3f3', '#f6e8c9'];
      const col = pal[Math.floor(r() * pal.length)], win = r() < .6;
      if (water(cx, cy, 30) || inPark(cx, cy, 14) || onLine(cx, cy, 34 + Math.max(w, h) / 2)) continue;
      items.push({ y: y + h, f: () => box3(c, x, y, w, h, ht, col, tower, win) });
    }
  }
  items.push({ y: SCHOOL[1], f: () => school(c, ...SCHOOL) });
  items.sort((a, b) => a.y - b.y).forEach(it => it.f());
  // 땅 위 글자
  PARKS.forEach(([px, py, r, n]) => n && label(c, n, px, py * T + 4, 11, '#4f7d33'));
  const [hx, hy] = mid(HAN, box); label(c, '한강', hx, hy * T, 16, '#3f87b8');
  return { cv, sc, BW, BH };
}
// 상자 건물: 그림자 → 앞(남쪽) 벽 → 지붕
function box3(c, x, y, w, h, ht, col, tower, win) {
  const sy = y * T, sh = h * T, top = sy - ht;
  c.fillStyle = 'rgba(70,70,90,.14)'; c.beginPath(); c.moveTo(x + w, sy + sh); c.lineTo(x + w + ht * .55, sy + sh - ht * .25); c.lineTo(x + w + ht * .55, sy - ht * .25); c.lineTo(x + w, sy); c.fill();
  const wall = shade(col, -.14);
  c.fillStyle = wall; c.fillRect(x, top + sh, w, ht);
  c.fillStyle = col; c.fillRect(x, top, w, sh);
  c.strokeStyle = shade(col, -.32); c.lineWidth = 1; c.strokeRect(x + .5, top + .5, w - 1, sh + ht - 1); c.beginPath(); c.moveTo(x, top + sh + .5); c.lineTo(x + w, top + sh + .5); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)';
  if (tower) { for (let yy = top + sh + 4; yy < sy + sh - 4; yy += 6) for (let xx = x + 3; xx < x + w - 4; xx += 5) c.fillRect(xx, yy, 3, 3); }
  else if (win) { for (let xx = x + 3; xx < x + w - 5; xx += 7) c.fillRect(xx, top + sh + ht * .35, 4, Math.max(2, ht * .35)); }
  if (tower) { c.fillStyle = shade(col, -.2); c.fillRect(x + w * .3, top + sh * .3, w * .4, sh * .4); }
}
function tree(c, x, y, r, col) {
  c.fillStyle = 'rgba(60,80,40,.18)'; c.beginPath(); c.ellipse(x + 3, y + 1, r, r * .45, 0, 0, 7); c.fill();
  c.fillStyle = '#8a6a4a'; c.fillRect(x - 1, y - r * 1.2, 2, r * 1.2);
  c.fillStyle = col; c.beginPath(); c.arc(x, y - r * 1.6, r, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(x - r * .35, y - r * 1.95, r * .4, 0, 7); c.fill();
}
function school(c, sx, sy0) {
  const sy = sy0 * T;
  box3(c, sx - 28, sy0 - 14, 56, 16, 22, '#ffe7a3', false, false);
  c.fillStyle = '#8fd0f5'; for (let k = 0; k < 6; k++) { c.fillRect(sx - 24 + k * 8.5, sy - 14 * T - 22 + 16 * T + 4, 5, 5); c.fillRect(sx - 24 + k * 8.5, sy - 14 * T - 22 + 16 * T + 12, 5, 5); }
  const fx = sx, fy = sy - 14 * T - 22 + 4;
  c.strokeStyle = '#2a2846'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 24); c.stroke();
  c.fillStyle = '#ffcf3a'; c.beginPath(); c.moveTo(fx, fy - 24); c.lineTo(fx + 17, fy - 19); c.lineTo(fx, fy - 14); c.closePath(); c.fill(); c.stroke();
  label(c, '서울영상고', sx, sy + 34, 13, '#2a2846');
}
const mid = (L, box) => { const v = L.filter(([x, y]) => x > box.x + 60 && x < box.x + box.w - 60 && y > box.y + 30 && y < box.y + box.h - 30); const p = v[Math.floor(v.length / 2)] || [-1e4, -1e4]; return [p[0], p[1] + 5]; };
function shade(hex, a) { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v + (a < 0 ? v : 255 - v) * a))); return '#' + [n >> 16, n >> 8 & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join(''); }
const FF = () => getComputedStyle(document.body).fontFamily;
function label(c, t, x, y, sz, col, wt = 800) {
  c.font = `${wt} ${sz}px ${FF()}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 4; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y);
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

export function createMap(stops) {
  const pts = stops.map(s => P(LL[s.n] || [37.53, 126.88])), path = smooth(pts);
  const others = ROUTES.map((R, i) => [stopsOf(i), null]).map(([st]) => [st, smooth(st.map(s => P(LL[s.n] || [37.53, 126.88])))]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), M = 560;
  const box = { x: Math.min(...xs) - M, y: Math.min(...ys) - M, w: Math.max(...xs) - Math.min(...xs) + M * 2, h: Math.max(...ys) - Math.min(...ys) + M * 2 };
  let bg = null, cam = null;
  const S = (x, y) => [x, y * T];   // 땅 → 화면
  const at = s => {
    const L = path.S, n = L.length; s = Math.max(0, Math.min(L[n - 1], s));
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
    const a = path.pts[lo], b = path.pts[hi], t = L[hi] > L[lo] ? (s - L[lo]) / (L[hi] - L[lo]) : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  const sOf = p => { const i = Math.min(stops.length - 2, Math.floor(p)), f = p - i; return path.S[path.at[i]] + (path.S[path.at[i + 1]] - path.S[path.at[i]]) * f; };
  const segCol = i => lineColor(stops[i].x || stops[i].l);
  const seg = (c, o, i) => { c.beginPath(); for (let k = o.at[i]; k <= o.at[i + 1]; k++) { const [x, y] = o.pts[k]; k === o.at[i] ? c.moveTo(x, y * T) : c.lineTo(x, y * T); } };

  function draw(c, W, H, p, cur, now, done) {
    bg ||= buildBg(box, Object.values(LL).map(P), others.map(([, o]) => o.pts));
    const s = sOf(p), [tx, ty, ang] = at(s), [nx, ny] = pts[Math.min(stops.length - 1, cur)];
    let gx = tx + (nx - tx) * .35, gy = (ty + (ny - ty) * .35) * T - 10;
    gx = Math.max(box.x + W / 2, Math.min(box.x + box.w - W / 2, gx)); gy = Math.max(box.y * T - HMAX + H / 2, Math.min(box.y * T + box.h * T - H / 2, gy));
    if (!cam) cam = [gx, gy]; else { cam[0] += (gx - cam[0]) * .08; cam[1] += (gy - cam[1]) * .08; }
    c.save(); c.translate(Math.round(W / 2 - cam[0]), Math.round(H / 2 - cam[1]));
    c.drawImage(bg.cv, box.x, box.y * T - HMAX, bg.BW, bg.BH);
    c.lineCap = c.lineJoin = 'round';
    // 다른 노선(흐리게)
    c.globalAlpha = .3; others.forEach(([st, o]) => { for (let i = 0; i < st.length - 1; i++) { c.strokeStyle = lineColor(st[i].x || st[i].l); c.lineWidth = 5; seg(c, o, i); c.stroke(); } }); c.globalAlpha = 1;
    // 내 노선: 선로 둑(아래 두께) → 흰 테두리 → 호선 색 → 침목 무늬
    for (let i = 0; i < stops.length - 1; i++) { c.save(); c.translate(0, 4); c.strokeStyle = 'rgba(42,40,70,.35)'; c.lineWidth = 16; seg(c, path, i); c.stroke(); c.restore(); }
    for (let i = 0; i < stops.length - 1; i++) { c.strokeStyle = '#2a2846'; c.lineWidth = 16; seg(c, path, i); c.stroke(); }
    for (let i = 0; i < stops.length - 1; i++) { c.strokeStyle = '#fff'; c.lineWidth = 13; seg(c, path, i); c.stroke(); }
    for (let i = 0; i < stops.length - 1; i++) { seg(c, path, i); c.strokeStyle = segCol(i); c.lineWidth = 8; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.setLineDash([2, 5]); c.stroke(); c.setLineDash([]); }
    // 역 승강장(두께 있는 납작한 원) — 열차보다 뒤에 있는 역은 먼저, 앞에 있는 역은 열차 뒤에
    const stDraw = (st, i) => {
      const [x, y0] = pts[i], y = y0 * T, isX = !!st.x, isG = i === stops.length - 1, tgt = i === cur && !done, R = isX || isG ? 12 : 9;
      if (tgt) { const k = (now % 1200) / 1200; c.strokeStyle = `rgba(29,95,214,${.65 * (1 - k)})`; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 14 + k * 20, (14 + k * 20) * T, 0, 0, 7); c.stroke(); }
      c.fillStyle = '#9aa3b5'; c.beginPath(); c.ellipse(x, y + 3, R, R * T, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.strokeStyle = isX || isG ? '#2a2846' : segCol(Math.min(i, stops.length - 2)); c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, y, R, R * T, 0, 0, 7); c.fill(); c.stroke();
      if (isX) { c.strokeStyle = lineColor(st.x); c.lineWidth = 2.5; c.beginPath(); c.ellipse(x, y, R * .5, R * .5 * T, 0, 0, 7); c.stroke(); }
      if (isG) { c.fillStyle = lineColor(5); c.beginPath(); c.ellipse(x, y, 5, 5 * T, 0, 0, 7); c.fill(); }
    };
    stops.forEach((st, i) => { if (pts[i][1] <= ty) stDraw(st, i); });
    train(c, tx, ty, ang, segCol(Math.max(0, Math.min(stops.length - 2, Math.floor(p)))), now);
    stops.forEach((st, i) => { if (pts[i][1] > ty) stDraw(st, i); });
    // 역 이름(맨 위)
    stops.forEach((st, i) => {
      const [x, y] = pts[i], past = i < cur && !(done && i === stops.length - 1), tgt = i === cur && !done;
      c.globalAlpha = past ? .55 : 1;
      // 2026-11-02 하율 "아이콘 안 겹치게": 열차가 역 가까이 오면 이름을 열차 지붕 위로 올림(가까울수록 더, 부드럽게)
      const lift = Math.max(0, 1 - Math.hypot(x - tx, (y - ty) * T) / 70) * 30;
      label(c, st.n, x, y * T - 22 - lift, tgt ? 17 : 13, tgt ? '#1d5fd6' : '#2a2846', tgt ? 900 : 800);
    });
    c.globalAlpha = 1;
    c.restore();
  }
  return { draw };
}
// 열차 한 칸(흰 차체 + 호선 색 띠, 지붕 에어컨·판토그래프) — 땅 위 네모(길이·폭)를 화면으로 눌러 옮기고 높이만큼 세움
const TL = 64, TW = 19, TH = 16;
function train(c, x, y, a, col, now) {
  const d = [Math.cos(a), Math.sin(a)], q = [-Math.sin(a), Math.cos(a)];
  const G = (u, v) => [x + d[0] * u + q[0] * v, (y + d[1] * u + q[1] * v) * T];   // 땅 위 (앞뒤 u, 좌우 v) → 화면
  const up = ([X, Y], h) => [X, Y - h];
  const poly = (ps, fill, stroke) => { c.beginPath(); ps.forEach(([X, Y], i) => i ? c.lineTo(X, Y) : c.moveTo(X, Y)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.4; c.stroke(); } };
  const L2 = TL / 2, W2 = TW / 2, nose = 5;
  // 바닥 모양(앞쪽 모서리를 깎은 팔각) — 시계 방향
  const base = [[-L2, -W2], [L2 - nose, -W2], [L2, -W2 + nose], [L2, W2 - nose], [L2 - nose, W2], [-L2, W2], [-L2 - 1, W2 - 2], [-L2 - 1, -W2 + 2]];
  // 그림자
  c.save(); c.translate(6, 3); poly(base.map(([u, v]) => G(u * 1.02, v * 1.1)), 'rgba(30,30,60,.22)'); c.restore();
  // 옆면: 바깥 법선이 화면 아래(보는 사람 쪽)를 향하는 면만, 먼 것부터
  const faces = base.map((b, i) => { const e = base[(i + 1) % base.length], nx = (e[1] - b[1]), ny = -(e[0] - b[0]), wn = [d[0] * nx + q[0] * ny, d[1] * nx + q[1] * ny], l = Math.hypot(...wn) || 1; return { b, e, ny: wn[1] / l, nx: wn[0] / l, i }; })
    .filter(f => f.ny > .02).sort((f, g) => f.ny - g.ny);
  faces.forEach(f => {
    const A = G(...f.b), B = G(...f.e), lit = .9 + f.nx * -.06 + f.ny * .08, side = Math.abs(f.b[1]) === W2 && Math.abs(f.e[1]) === W2;
    poly([A, B, up(B, TH), up(A, TH)], shade('#ffffff', -Math.max(0, 1 - lit) * 1.2), '#2a2846');
    const P2 = (u, v) => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u - TH * v];
    poly([P2(0, .16), P2(1, .16), P2(1, .32), P2(0, .32)], col);   // 호선 색 띠
    if (side) { const n = 5; for (let k = 0; k < n; k++) { const u0 = .08 + k * .18, u1 = u0 + .11; poly([P2(u0, .45), P2(u1, .45), P2(u1, .82), P2(u0, .82)], '#2b3a55'); poly([P2(u0, .7), P2(u0 + .04, .82), P2(u0 + .02, .82)], 'rgba(255,255,255,.35)'); } }
    else if (f.b[0] === L2 && f.e[0] === L2) {   // 앞면: 큰 창 + 전조등
      poly([P2(.12, .45), P2(.88, .45), P2(.82, .86), P2(.18, .86)], '#2b3a55');
      const l1 = P2(.2, .22), l2 = P2(.8, .22); c.fillStyle = '#fff3a8'; c.beginPath(); c.arc(l1[0], l1[1], 1.8, 0, 7); c.arc(l2[0], l2[1], 1.8, 0, 7); c.fill();
    }
  });
  // 지붕: 흰 판 + 가장자리 호선 색 줄 + 가운데 회색 판 + 에어컨 2개 + 판토그래프
  const R = (u, v, h = TH) => up(G(u, v), h);
  poly(base.map(([u, v]) => R(u, v)), '#fbfcfe', '#2a2846');
  poly(base.map(([u, v]) => R(u * .94, v * .8)), null); c.strokeStyle = col; c.lineWidth = 1.6; c.stroke();
  poly([R(-L2 + 6, -W2 * .45), R(L2 - 9, -W2 * .45), R(L2 - 9, W2 * .45), R(-L2 + 6, W2 * .45)], '#e6ebf3');
  [-.22, .2].forEach(t => {
    const u = t * TL, h2 = TH + 3, bx = [[u - 5, -3.2], [u + 5, -3.2], [u + 5, 3.2], [u - 5, 3.2]];
    poly([R(u - 5, 3.2), R(u + 5, 3.2), R(u + 5, 3.2, h2), R(u - 5, 3.2, h2)], '#cfd6e3', '#2a2846');
    poly(bx.map(([uu, vv]) => R(uu, vv, h2)), '#eef2f8', '#2a2846');
    const g = R(u, 0, h2); c.fillStyle = '#9aa6bb'; c.beginPath(); c.ellipse(g[0], g[1], 2.6, 2.6 * T, 0, 0, 7); c.fill();
  });
  // 판토그래프(마름모 선)
  const p0 = R(-L2 + 10, 0), p1 = R(-L2 + 4, 0, TH + 7), p2 = R(-L2 + 16, 0, TH + 7);
  c.strokeStyle = '#2a2846'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.closePath(); c.stroke();
}
// 목표 이름의 앞 n타까지 친 모습 → [다 친 글자들, 치는 중인 글자(없으면 '')] — 화면에 보여 줄 글자는 IME가 아니라 이걸로 만듦
export function partial(target, n) {
  let out = '';
  for (const ch of target) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) { if (n <= 0) return [out, '']; out += ch; n--; continue; }
    const ci = Math.floor(c / 588), ji = Math.floor(c % 588 / 28), ti = c % 28, J = JUNG[ji], Tj = JONG[ti], len = 1 + J.length + Tj.length;
    if (n >= len) { out += ch; n -= len; continue; }
    if (n <= 0) return [out, ''];
    if (n === 1) return [out, CHO[ci]];
    const jn = Math.min(J.length, n - 1), j2 = JUNG.indexOf(J.slice(0, jn)), t2 = n - 1 - jn > 0 ? JONG.indexOf(Tj.slice(0, n - 1 - jn)) : 0;
    return [out, String.fromCharCode(0xac00 + ci * 588 + j2 * 28 + Math.max(0, t2))];
  }
  return [out, ''];
}
// 두벌식 자판(e.code → 자모). Shift는 쌍자음·ㅒㅖ
export const KEYMAP = { KeyQ: 'ㅂ', KeyW: 'ㅈ', KeyE: 'ㄷ', KeyR: 'ㄱ', KeyT: 'ㅅ', KeyY: 'ㅛ', KeyU: 'ㅕ', KeyI: 'ㅑ', KeyO: 'ㅐ', KeyP: 'ㅔ', KeyA: 'ㅁ', KeyS: 'ㄴ', KeyD: 'ㅇ', KeyF: 'ㄹ', KeyG: 'ㅎ', KeyH: 'ㅗ', KeyJ: 'ㅓ', KeyK: 'ㅏ', KeyL: 'ㅣ', KeyZ: 'ㅋ', KeyX: 'ㅌ', KeyC: 'ㅊ', KeyV: 'ㅍ', KeyB: 'ㅠ', KeyN: 'ㅜ', KeyM: 'ㅡ' };
export const KEYMAP_S = { KeyQ: 'ㅃ', KeyW: 'ㅉ', KeyE: 'ㄸ', KeyR: 'ㄲ', KeyT: 'ㅆ', KeyO: 'ㅒ', KeyP: 'ㅖ' };
