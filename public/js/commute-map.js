// SVMHS GROUND — 등교하기! 지도(2026-11-02 하율 "실제 지도 모양처럼, 건물·오브젝트 배치, 노선도를 잘 보이게 깔고 그 위를 지하철이 진짜 지나가는 느낌, 한 글자 칠 때마다 이동")
// 화면 전용(서버 안 씀). 역 위치 = 실제 위도·경도(대략) → 1km = K px. 배경(땅·길·건물·공원·한강·안양천)은 노선 둘레만 판마다 한 번 그려 캐시,
// 노선·역·열차는 매 프레임 벡터로 그림. createMap(stops) → { draw(c, W, H, p, cur, now, done), keyFrac }
import { LINES, ROUTES, stopsOf } from './commute-score.js';

const K = 150;   // 1km = 150px
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

// 배경: 노선 둘레(+여백)만 그림
function buildBg(box, all) {
  const d = Math.min(2, devicePixelRatio || 1), sc = Math.min(d, Math.sqrt(12e6 / (box.w * box.h)));
  const cv = document.createElement('canvas'); cv.width = Math.round(box.w * sc); cv.height = Math.round(box.h * sc);
  const c = cv.getContext('2d'); c.scale(sc, sc); c.translate(-box.x, -box.y);
  const water = (x, y, pad) => dSeg(x, y, HAN) < 70 + pad || dSeg(x, y, ANY) < 12 + pad || dSeg(x, y, SAET) < 10 + pad;
  const inPark = (x, y, pad) => PARKS.some(([px, py, r]) => Math.hypot(x - px, y - py) < r + pad);
  c.fillStyle = '#f1eee6'; c.fillRect(box.x, box.y, box.w, box.h);
  // 동네 바닥(블록마다 살짝 다른 색)
  const G = 96, x0 = Math.floor(box.x / G) * G, y0 = Math.floor(box.y / G) * G;
  for (let gx = x0; gx < box.x + box.w; gx += G) for (let gy = y0; gy < box.y + box.h; gy += G) {
    const r = rnd(gx * 7919 + gy * 104729);
    c.fillStyle = ['#efebe2', '#ece9e3', '#f2efe7', '#ebe7dc'][Math.floor(r() * 4)]; c.fillRect(gx + 5, gy + 5, G - 10, G - 10);
  }
  // 길: 작은 길 → 큰 길(세 블록마다)
  const road = (big, w, col) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'butt';
    for (let gx = x0; gx < box.x + box.w; gx += G) { if (((gx / G) % 3 === 0) !== big) continue; c.beginPath(); c.moveTo(gx, box.y); c.lineTo(gx + 14, box.y + box.h); c.stroke(); }
    for (let gy = y0; gy < box.y + box.h; gy += G) { if (((gy / G) % 3 === 0) !== big) continue; c.beginPath(); c.moveTo(box.x, gy); c.lineTo(box.x + box.w, gy - 10); c.stroke(); }
  };
  road(false, 8, '#ddd8cc'); road(false, 6, '#fffdf8'); road(true, 15, '#d4cebf'); road(true, 13, '#fffdf8');
  // 큰 길 가운데 노란 줄
  c.strokeStyle = '#f2cf6b'; c.lineWidth = 1; c.setLineDash([8, 8]);
  for (let gx = x0; gx < box.x + box.w; gx += G * 3) { c.beginPath(); c.moveTo(gx, box.y); c.lineTo(gx + 14, box.y + box.h); c.stroke(); }
  for (let gy = y0; gy < box.y + box.h; gy += G * 3) { c.beginPath(); c.moveTo(box.x, gy); c.lineTo(box.x + box.w, gy - 10); c.stroke(); }
  c.setLineDash([]);
  // 공원
  PARKS.forEach(([px, py, r, n]) => {
    if (px + r < box.x || px - r > box.x + box.w || py + r < box.y || py - r > box.y + box.h) return;
    c.fillStyle = '#cfe8b4'; c.strokeStyle = '#b3d796'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(px, py, r, r * .78, -.3, 0, 7); c.fill(); c.stroke();
    const t = rnd(px * 31 + py); for (let k = 0; k < r * r / 160; k++) { const a = t() * 7, q = Math.sqrt(t()) * r * .85; c.fillStyle = t() < .5 ? '#8cc46a' : '#a6d27f'; c.beginPath(); c.arc(px + Math.cos(a) * q, py + Math.sin(a) * q * .78, 4 + t() * 4, 0, 7); c.fill(); }
    if (n) label(c, n, px, py + 4, 11, '#4f7d33');
  });
  // 건물: 블록마다 1~4채(물·공원·역 가까이는 비움)
  const near = (x, y) => all.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 22);
  for (let gx = x0; gx < box.x + box.w; gx += G) for (let gy = y0; gy < box.y + box.h; gy += G) {
    const r = rnd(gx * 131 + gy * 977 + 5), n = 1 + Math.floor(r() * 4), tower = r() < .18;
    for (let k = 0; k < n; k++) {
      const w = tower ? 18 + r() * 14 : 14 + r() * 26, h = tower ? 18 + r() * 14 : 10 + r() * 20;
      const x = gx + 10 + r() * (G - 20 - w), y = gy + 10 + r() * (G - 20 - h), cx = x + w / 2, cy = y + h / 2;
      if (water(cx, cy, 30) || inPark(cx, cy, 14) || near(cx, cy)) continue;
      const ht = tower ? 9 + r() * 8 : 3 + r() * 4, pal = tower ? ['#bcd0ea', '#a9c1e3', '#c9d3e6'] : ['#e9d6c4', '#dfe3ee', '#f0dccb', '#d9e6dc', '#e8e0f0', '#f3e3c3'];
      const col = pal[Math.floor(r() * pal.length)];
      c.fillStyle = 'rgba(60,60,80,.13)'; c.fillRect(x + ht * .7, y + ht, w, h);   // 그림자
      c.fillStyle = shade(col, -.12); c.fillRect(x, y + h - 2, w, ht);   // 벽
      c.fillStyle = col; c.fillRect(x, y - ht + ht, w, h - 2);
      c.strokeStyle = shade(col, -.25); c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 3);
      if (tower) { c.fillStyle = 'rgba(255,255,255,.55)'; for (let yy = y + 3; yy < y + h - 5; yy += 4) c.fillRect(x + 3, yy, w - 6, 1.5); }
      else if (r() < .5) { c.fillStyle = shade(col, -.2); c.fillRect(x + w * .3, y + h * .3, 4, 4); }
    }
  }
  // 학교
  { const [sx, sy] = SCHOOL;
    c.fillStyle = 'rgba(60,60,80,.15)'; c.fillRect(sx - 26 + 5, sy - 12 + 6, 52, 26);
    c.fillStyle = '#ffe9a8'; c.strokeStyle = '#2a2846'; c.lineWidth = 2; c.fillRect(sx - 26, sy - 12, 52, 26); c.strokeRect(sx - 26, sy - 12, 52, 26);
    c.fillStyle = '#8fd0f5'; for (let k = 0; k < 5; k++) c.fillRect(sx - 21 + k * 9, sy - 6, 6, 5), c.fillRect(sx - 21 + k * 9, sy + 3, 6, 5);
    c.fillStyle = '#cfe8b4'; c.fillRect(sx - 26, sy + 16, 52, 16); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.strokeRect(sx - 20, sy + 19, 40, 10);
    c.strokeStyle = '#2a2846'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy - 12); c.lineTo(sx, sy - 34); c.stroke();
    c.fillStyle = '#ffcf3a'; c.beginPath(); c.moveTo(sx, sy - 34); c.lineTo(sx + 18, sy - 29); c.lineTo(sx, sy - 24); c.closePath(); c.fill(); c.stroke();
    label(c, '서울영상고', sx, sy + 42, 13, '#2a2846'); }
  // 물: 둔치 → 물 → 반짝임
  const river = (L, w, bank) => {
    c.lineJoin = c.lineCap = 'round';
    c.strokeStyle = '#c8e6a4'; c.lineWidth = w + bank; c.beginPath(); L.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    c.strokeStyle = '#8fcdf0'; c.lineWidth = w; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; c.setLineDash([10, 22]); c.stroke(); c.setLineDash([]);
  };
  river(ANY, 22, 14); river(SAET, 18, 12); river(HAN, 140, 40);
  label(c, '한강', ...mid(HAN, box), 16, '#3f87b8');
  return { cv, sc };
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
  // 다른 노선(흐리게) — 지도 느낌
  const others = ROUTES.map((R, i) => stopsOf(i)).map(st => smooth(st.map(s => P(LL[s.n] || [37.53, 126.88]))));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), M = 520;
  const box = { x: Math.min(...xs) - M, y: Math.min(...ys) - M * .7, w: Math.max(...xs) - Math.min(...xs) + M * 2, h: Math.max(...ys) - Math.min(...ys) + M * 1.4 };
  const allSt = Object.values(LL).map(P);
  let bg = null, cam = null;
  // 경로 위 s(길이)의 점·방향
  const at = s => {
    const S = path.S, n = S.length; s = Math.max(0, Math.min(S[n - 1], s));
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const a = path.pts[lo], b = path.pts[hi], t = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  const sOf = p => { const i = Math.min(stops.length - 2, Math.floor(p)), f = p - i; return path.S[path.at[i]] + (path.S[path.at[i + 1]] - path.S[path.at[i]]) * f; };
  const segCol = i => lineColor(stops[i].x || stops[i].l);

  function draw(c, W, H, p, cur, now, done) {
    bg ||= buildBg(box, allSt);
    const s = sOf(p), [tx, ty] = at(s), [nx, ny] = pts[Math.min(stops.length - 1, cur)];
    // 카메라: 열차 + 다음 역 쪽으로 조금, 부드럽게 따라감(배경 밖은 안 보이게)
    let gx = tx + (nx - tx) * .35, gy = ty + (ny - ty) * .35;
    gx = Math.max(box.x + W / 2, Math.min(box.x + box.w - W / 2, gx)); gy = Math.max(box.y + H / 2, Math.min(box.y + box.h - H / 2, gy));
    if (!cam) cam = [gx, gy]; else { cam[0] += (gx - cam[0]) * .08; cam[1] += (gy - cam[1]) * .08; }
    c.save(); c.translate(Math.round(W / 2 - cam[0]), Math.round(H / 2 - cam[1]));
    c.drawImage(bg.cv, box.x, box.y, box.w, box.h);
    // 다른 노선(흐리게)
    c.lineCap = c.lineJoin = 'round'; c.globalAlpha = .28;
    others.forEach((o, ri) => { const st = stopsOf(ri); for (let i = 0; i < st.length - 1; i++) { c.strokeStyle = lineColor(st[i].x || st[i].l); c.lineWidth = 5; c.beginPath(); for (let k = o.at[i]; k <= o.at[i + 1]; k++) { const [x, y] = o.pts[k]; k === o.at[i] ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); } });
    c.globalAlpha = 1;
    // 내 노선: 흰 테두리 + 호선 색 + 지나온 구간은 진하게 칠한 선로 무늬
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < stops.length - 1; i++) {
      c.beginPath(); for (let k = path.at[i]; k <= path.at[i + 1]; k++) { const [x, y] = path.pts[k]; k === path.at[i] ? c.moveTo(x, y) : c.lineTo(x, y); }
      if (!pass) { c.strokeStyle = '#fff'; c.lineWidth = 15; c.stroke(); c.strokeStyle = 'rgba(42,40,70,.55)'; c.lineWidth = 17; c.globalCompositeOperation = 'destination-over'; c.stroke(); c.globalCompositeOperation = 'source-over'; }
      else { c.strokeStyle = segCol(i); c.lineWidth = 9; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.setLineDash([3, 6]); c.stroke(); c.setLineDash([]); }
    }
    // 역
    stops.forEach((st, i) => {
      const [x, y] = pts[i], past = i < cur && !(done && i === stops.length - 1), tgt = i === cur && !done, isX = !!st.x, isG = i === stops.length - 1;
      if (tgt) { const k = (now % 1200) / 1200; c.strokeStyle = `rgba(29,95,214,${.6 * (1 - k)})`; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 12 + k * 18, 0, 7); c.stroke(); }
      c.fillStyle = '#fff'; c.strokeStyle = isX || isG ? '#2a2846' : segCol(Math.min(i, stops.length - 2)); c.lineWidth = 3.5;
      c.beginPath(); c.arc(x, y, isX || isG ? 10 : 7, 0, 7); c.fill(); c.stroke();
      if (isX) { c.strokeStyle = lineColor(st.x); c.lineWidth = 3; c.beginPath(); c.arc(x, y, 5, 0, 7); c.stroke(); }
      if (isG) { c.fillStyle = lineColor(5); c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fill(); }
    });
    // 열차: 3칸이 선로를 따라 굽어 감 + 그림자 + 달릴 때 바람
    const L = stops[Math.max(0, Math.min(stops.length - 2, Math.floor(p)))], col = lineColor(L.x || L.l), CAR = 31, GAP = 3;
    for (let k = 2; k >= 0; k--) {
      const [x, y, a] = at(s - k * (CAR + GAP));
      c.save(); c.translate(x, y); c.rotate(a);
      c.fillStyle = 'rgba(30,30,50,.22)'; rr(c, -CAR / 2 + 3, -7.5 + 4, CAR, 15, 5); c.fill();
      c.fillStyle = col; c.strokeStyle = '#2a2846'; c.lineWidth = 1.8; rr(c, -CAR / 2, -7.5, CAR, 15, 5); c.fill(); c.stroke();
      c.fillStyle = '#f4fbff'; for (let w = 0; w < 4; w++) { rr(c, -CAR / 2 + 3.5 + w * 6.3, -4, 4.5, 8, 1.2); c.fill(); }
      if (!k) { c.fillStyle = '#2a2846'; rr(c, CAR / 2 - 4.5, -6, 3.5, 12, 1.2); c.fill(); c.fillStyle = '#ffe58a'; c.beginPath(); c.arc(CAR / 2 + 1, -3.5, 1.6, 0, 7); c.arc(CAR / 2 + 1, 3.5, 1.6, 0, 7); c.fill(); }
      c.restore();
    }
    // 역 이름은 열차 위에(가리지 않게)
    stops.forEach((st, i) => {
      const [x, y] = pts[i], past = i < cur && !(done && i === stops.length - 1), tgt = i === cur && !done;
      c.globalAlpha = past ? .55 : 1;
      label(c, st.n, x, y - 21, tgt ? 17 : 13, tgt ? '#1d5fd6' : '#2a2846', tgt ? 900 : 800);
    });
    c.globalAlpha = 1;
    c.restore();
    return [tx, ty];
  }
  return { draw };
}
