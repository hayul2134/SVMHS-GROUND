// SVMHS GROUND — '기자재 정리!' (기자재실 정리 = 테트리스 방식 블록 쌓기, 2026-10-27 하율)
// 블록 7종을 촬영 장비로: I LED 조명 · O 카메라 · T 삼각대 · L C스탠드 · J 붐 마이크 · S 케이블 · Z 슬레이트.
// 한 블록 = 장비 하나의 그림(칸마다 따로 그리지 않음) → 쌓인 뒤에도 그림 조각이 그대로 남고, 줄이 지워지면 장비가 잘려 나감.
//   방법: 장비마다 기본 방향 그림을 N×N 상자 크기로 한 번 그리고 90°씩 돌린 4장을 미리 만든다(SRS 회전 = N×N 상자 회전과 같음).
//   쌓인 칸은 {장비, 방향, 상자 안 위치}를 기억해 그 그림의 해당 칸만 잘라서 그린다.
// 규칙: 10×20(+위 숨은 2줄) · 7개 묶음 무작위(7-bag) · SRS 회전·벽 차기 · 보관(hold) · 다음 3개 · 고스트 · 잠금 지연 0.5초(움직이면 최대 15번 연장)
// 점수는 gear-score.js(서버와 공용). 고정 타임스텝 1/60초. 논리 해상도: 한 칸 12px → 판 120×240, CSS로 정수 배 확대(또렷한 픽셀).
import { LINE_PTS, levelOf, SOFT_PT, HARD_PT } from './gear-score.js';

export const C = 12, COLS = 10, ROWS = 22, HID = 2, VIS = ROWS - HID;
export const BW = COLS * C, BH = VIS * C;
const STEP = 1 / 60, DAS = 10, ARR = 2, LOCK = 30, LOCK_MAX = 15, CLEAR_T = 16;   // 프레임 단위(60fps)
const OL = '#2a2846';

/* ===== 장비 7종 (SRS 기본 방향 칸, 상자 크기 N) ===== */
export const KIND = {
  I: { n: 'LED 조명', N: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], body: '#ffd25e' },   // 2026-10-27 하율: 붐 마이크는 원래 ㄱ자 모양 → LED와 자리 바꿈
  O: { n: '카메라', N: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], body: '#8fb8ff' },
  T: { n: '삼각대', N: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], body: '#ff8f5a' },
  L: { n: 'C스탠드', N: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], body: '#ff5a6e' },   // 2026-10-27 하율: LED 조명 → 확성기 → 감독 의자 → C스탠드
  J: { n: '붐 마이크', N: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], body: '#5fd0b5' },   // 짐벌 → 카메라 슬라이더 → 노트북 → LED 조명 → 붐 마이크
  S: { n: '케이블', N: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], body: '#9d8cff' },
  Z: { n: '슬레이트', N: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], body: '#2e2f45' },
};
export const ORDER = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
const rotCell = ([x, y], N, r) => { for (let i = 0; i < r; i++) [x, y] = [N - 1 - y, x]; return [x, y]; };
export const cellsOf = (k, r) => KIND[k].cells.map(c => rotCell(c, KIND[k].N, k === 'O' ? 0 : r));

// SRS 벽 차기 (y는 아래가 +). 키: '시작>끝'
const K3 = { '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]] };
const K4 = { '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]] };

/* ===== 그림 (픽셀) ===== */
// 장비 그림은 2배 해상도로 만들어 둠(가운데로 모으며 줄여도 세부가 안 뭉개지게, 2026-10-27) — 판도 2배로 그림
export const RES = 2;
function canvasR(S) { const [c, g] = canvasOf(S * RES, S * RES); g.scale(RES, RES); return [c, g]; }
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); };
// 장비 그림을 블록 가운데로 모으고 여백을 두는 변환(2026-10-27 하율 "블록 중앙에, 여백 있게"): 그림 좌표를 k배로 줄여 중심을 옮김. 점 단위로 다시 찍어 흐려지지 않음
let XF = null;
const rq = v => Math.round(v * RES) / RES;
const xf = (x, y) => XF ? [XF.tx + (x - XF.ax) * XF.k, XF.ty + (y - XF.ay) * XF.k] : [x, y];
function disc(g, cx, cy, r, col) { if (XF) { const [a, b] = xf(cx, cy), k = XF.k; g.fillStyle = col; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) g.fillRect(rq(a + x * k), rq(b + y * k), Math.max(1 / RES, rq(k)), Math.max(1 / RES, rq(k))); return; } g.fillStyle = col; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) g.fillRect(cx + x, cy + y, 1, 1); }
function box(g, x, y, w, h, col) {
  g.fillStyle = col;
  if (!XF) return g.fillRect(x, y, w, h);
  const [a, b] = xf(x, y), [c, d] = xf(x + w, y + h), X = rq(a), Y = rq(b);
  g.fillRect(X, Y, Math.max(1 / RES, rq(c) - X), Math.max(1 / RES, rq(d) - Y));
}
// 장비 몸통: 칸들을 한 덩어리로 — 테두리 선 없이 꽉 채움(아래 body 설명), 붙은 칸끼리는 이어짐,
// 바깥 모서리는 둥글게, 안쪽으로 꺾인 모서리도 선을 이어 줌, 위·왼쪽 밝게·아래·오른쪽 어둡게
const RIM = '#f7f9ff';
const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function body(g, cells, col) {
  // 2026-10-27 하율 "닿고 나서 채워지는 게 이상함 → 처음부터 딱 맞게": 테두리 선 없이 칸을 끝까지 꽉 채움.
  //   장비끼리 구분은 바깥 면 1px 밝은 선(위·왼쪽)·어두운 선(아래·오른쪽)으로만 → 붙여 쌓아도 틈이 안 생김
  const has = (x, y) => cells.some(c => c[0] === x && c[1] === y);
  col = mix(col, '#ffffff', .14);
  const hi = mix(col, '#ffffff', .55), lo = shade(col, .62);
  for (const [cx, cy] of cells) {
    const x = cx * C, y = cy * C, L = !has(cx - 1, cy), R = !has(cx + 1, cy), T = !has(cx, cy - 1), B = !has(cx, cy + 1);
    box(g, x, y, C, C, col);
    if (T) box(g, x, y, C, 1, hi); if (L) box(g, x, y, 1, C, hi);
    if (B) box(g, x, y + C - 1, C, 1, lo); if (R) box(g, x + C - 1, y, 1, C, lo);
    if (T && R) box(g, x + C - 1, y, 1, 1, col); if (B && L) box(g, x, y + C - 1, 1, 1, col);   // 밝은 선·어두운 선이 만나는 모서리는 중간색
    // 안쪽으로 꺾인 모서리: 대각선 칸이 비었으면 그 점을 밝게/어둡게 이어 줌
    if (!L && !T && !has(cx - 1, cy - 1)) box(g, x, y, 1, 1, hi);
    if (!R && !B && !has(cx + 1, cy + 1)) box(g, x + C - 1, y + C - 1, 1, 1, lo);
  }
}
// 2026-10-27 하율 "실제 물건 참고해서 알아볼 수 있게": 실물 생김새(실루엣)를 먼저 맞추고 세부를 얹음
const D1 = '#262a3d', D2 = '#3a3f55', D3 = '#535a78', MT = '#9aa3bd', MT2 = '#e6ebf7', GL = '#5ab8ff';
const line = (g, x0, y0, x1, y1, w, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) box(g, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w, col); };
const ART = {
  I(g) {   // LED 조명(긴 패널): 검은 테두리 안에 빛나는 LED 점 패널 + 위쪽 손잡이 고정쇠 + 오른쪽 조절 다이얼
    const y = C;
    box(g, 1, y + 2, 46, 8, D1); box(g, 2, y + 3, 44, 6, '#fff4cc');
    for (let yy = y + 4; yy < y + 8; yy += 2) for (let x = 3; x < 45; x += 2) box(g, x, yy, 1, 1, (x + yy) % 4 ? '#ffffff' : '#ffe27a');
    box(g, 2, y + 3, 44, 1, '#ffffff');
    box(g, 10, y + 1, 4, 1, D2); box(g, 34, y + 1, 4, 1, D2);   // 고정쇠
    box(g, 41, y + 10, 4, 1, D2); box(g, 3, y + 10, 6, 1, D3);   // 다이얼 · 전원선 단자
  },
  O(g) {   // 카메라(미러리스 정면): 왼쪽 손잡이·셔터 · 가운데 위 뷰파인더 혹 · 큰 렌즈(초점 링 무늬) · 빨간 점
    box(g, 2, 7, 21, 14, D1); box(g, 3, 8, 19, 1, D3);   // 몸통
    box(g, 8, 3, 9, 4, D1); box(g, 9, 4, 7, 1, D3); box(g, 10, 2, 5, 1, D2);   // 뷰파인더 혹 + 핫슈
    box(g, 2, 6, 6, 16, '#1b1e2d'); for (let y = 10; y < 20; y += 2) box(g, 3, y, 4, 1, '#30354a');   // 손잡이(가죽 무늬)
    box(g, 3, 5, 3, 1, MT); box(g, 19, 5, 3, 2, D2);   // 셔터 · 다이얼
    disc(g, 14, 14, 7, '#11131d'); disc(g, 14, 14, 6, D2);
    for (let a = 0; a < 16; a++) { const t = a / 16 * 6.283; box(g, Math.round(14 + Math.cos(t) * 6), Math.round(14 + Math.sin(t) * 6), 1, 1, a % 2 ? D3 : '#11131d'); }   // 초점 링 톱니
    disc(g, 14, 14, 4, '#1b2c5c'); disc(g, 14, 14, 3, '#2a4a8a'); disc(g, 14, 14, 1, GL);
    box(g, 12, 12, 2, 1, '#cfe9ff'); box(g, 12, 13, 1, 1, '#cfe9ff'); box(g, 16, 16, 1, 1, '#8fd0ff');   // 유리 반사
    box(g, 21, 8, 1, 1, '#ff3b4f');   // 빨간 점(로고)
  },
  T(g) {   // 삼각대: 위 칸 = 비디오 헤드(카메라 판) + 오른쪽 아래로 뻗은 팬 핸들, 아래 줄 = 세 다리(두 줄 관) + 다리 잠금 + 고무 발
    box(g, 13, 3, 10, 2, D3); box(g, 13, 3, 10, 1, MT);   // 카메라 판
    box(g, 15, 5, 6, 5, D1); box(g, 16, 6, 2, 3, D3);   // 헤드
    line(g, 21, 7, 33, 14, 1, D1); line(g, 21, 8, 33, 15, 1, D2); box(g, 32, 14, 2, 2, '#1b1e2d');   // 팬 핸들 + 고무 끝
    box(g, 15, 10, 6, 3, D2);   // 다리 모이는 곳
    line(g, 15, 13, 4, 22, 1, MT); line(g, 16, 13, 5, 22, 1, D2);   // 왼 다리
    line(g, 20, 13, 30, 22, 1, MT); line(g, 19, 13, 29, 22, 1, D2);   // 오른 다리
    box(g, 17, 13, 2, 9, D2); box(g, 17, 13, 1, 9, MT);   // 가운데 다리
    box(g, 8, 17, 2, 2, '#ffd25e'); box(g, 26, 17, 2, 2, '#ffd25e'); box(g, 17, 17, 2, 2, '#ffd25e');   // 다리 잠금
    box(g, 2, 22, 4, 1, '#1b1e2d'); box(g, 29, 22, 4, 1, '#1b1e2d'); box(g, 16, 22, 4, 1, '#1b1e2d');   // 발
  },
  L(g) {   // C스탠드: 오른쪽 = 크롬 기둥(잠금 손잡이) + 꼭대기 고보 헤드(둥근 클램프·T손잡이)와 짧은 암,
           //         아래 줄 = 높이가 서로 다른 세 다리(C스탠드 특유의 층진 다리) + 다리에 걸친 모래주머니
    g.translate(2, 0);   // 기둥·고보 헤드·다리 모이는 곳은 오른쪽 칸 한가운데(줄인 뒤 x=30)에 오게
    box(g, 28, 4, 3, 12, MT); box(g, 28, 4, 1, 12, MT2);   // 기둥
    box(g, 26, 9, 2, 3, D1); box(g, 25, 10, 1, 1, D1);   // 높이 잠금 손잡이
    disc(g, 29, 4, 3, D1); disc(g, 29, 4, 1, MT2); box(g, 32, 1, 3, 2, D1);   // 고보 헤드 + T손잡이
    box(g, 24, 3, 3, 2, MT); box(g, 24, 3, 3, 1, MT2);   // 그립 암(짧게)
    box(g, 26, 15, 7, 3, D1);   // 다리 모이는 곳(터틀 베이스)
    g.translate(-2, 0);
    line(g, 28, 16, 3, 22, 1, MT); line(g, 28, 17, 3, 23, 1, D2);   // 긴 다리(가장 높이 붙음)
    line(g, 29, 18, 13, 22, 1, MT);   // 중간 다리
    line(g, 34, 17, 35, 22, 1, MT);   // 짧은 다리
    box(g, 1, 22, 4, 1, D1); box(g, 11, 22, 3, 1, D1); box(g, 34, 22, 2, 1, D1);   // 발
    box(g, 9, 16, 9, 5, '#c98a3c'); box(g, 9, 16, 9, 1, '#e8b26a'); box(g, 13, 16, 1, 5, '#8a5a24');   // 모래주머니(두 덩이)
  },
  J(g) {   // 붐 마이크: 아래 줄 = 세 마디로 가늘어지는 은색 붐대(잠금 링) + 오른쪽 고무 손잡이,
           //         왼쪽 위 = 붐대 끝에서 세운 ㄷ자 충격 흡수 거치대 + 털 윈드실드(데드캣)
    box(g, 27, 16, 8, 6, D1); for (let i = 28; i < 35; i += 2) box(g, i, 16, 1, 6, D3);   // 손잡이
    box(g, 19, 17, 8, 4, MT); box(g, 19, 17, 8, 1, MT2);   // 1마디(굵음)
    box(g, 17, 16, 2, 6, D2);   // 잠금 링
    box(g, 10, 18, 7, 3, MT); box(g, 10, 18, 7, 1, MT2);   // 2마디
    box(g, 8, 17, 2, 5, D2);
    box(g, 4, 18, 4, 2, MT); box(g, 4, 18, 4, 1, MT2);   // 3마디(가늘음)
    g.translate(-2, 0);   // 위로 솟은 거치대·털은 왼쪽 칸 한가운데(줄인 뒤 x=6)에 오게
    box(g, 5, 11, 2, 7, D2);   // 꺾인 연결부
    box(g, 2, 10, 9, 1, D1); box(g, 2, 2, 1, 9, D1); box(g, 10, 2, 1, 9, D1);   // ㄷ자 거치대
    const F = '#8a8f9e', f1 = '#b7bccb', f2 = '#5f6575';   // 털: 들쭉날쭉한 가장자리
    box(g, 3, 1, 6, 9, F);
    for (const [a, b2] of [[2, 1], [9, 1], [3, 0], [6, 0], [8, 0], [1, 4], [10, 4], [1, 7], [10, 7]]) box(g, a, b2, 1, 1, F);
    for (const [a, b2] of [[4, 2], [7, 3], [5, 5], [8, 6], [4, 8], [6, 8]]) box(g, a, b2, 1, 1, f1);
    for (const [a, b2] of [[6, 2], [4, 4], [7, 5], [5, 7], [8, 8]]) box(g, a, b2, 1, 1, f2);
    g.translate(2, 0);
  },
  S(g) {   // 케이블(XLR): 왼쪽 아래 수 단자 → 굵은 검은 선이 S자로 → 오른쪽 위 암 단자, 가운데 찍찍이 묶음
    const path = [[6, 18], [10, 18], [14, 17], [17, 14], [18, 10], [20, 7], [24, 6], [30, 6]];
    for (let i = 0; i < path.length - 1; i++) { line(g, path[i][0], path[i][1] - 1, path[i + 1][0], path[i + 1][1] - 1, 3, '#16182a'); }
    for (let i = 0; i < path.length - 1; i++) line(g, path[i][0], path[i][1] - 1, path[i + 1][0], path[i + 1][1] - 1, 1, '#4a4f6a');   // 선 윤기
    box(g, 1, 15, 6, 6, MT); box(g, 1, 15, 6, 1, MT2); box(g, 0, 16, 1, 4, '#5b6585'); box(g, 5, 15, 1, 6, D2);   // 수 단자(XLR)
    box(g, 30, 3, 5, 6, MT); box(g, 30, 3, 5, 1, MT2); box(g, 31, 5, 1, 1, D1); box(g, 33, 5, 1, 1, D1); box(g, 32, 7, 1, 1, D1); box(g, 30, 3, 1, 6, D2);   // 암 단자(구멍 3개)
    box(g, 15, 13, 5, 3, '#ff8a3d'); box(g, 15, 13, 5, 1, '#ffb37a');   // 찍찍이
  },
  Z(g) {   // 슬레이트: 위 = 살짝 벌어진 흑백 딱딱이, 아래 = 칠판(흰 줄 칸 + SCENE·TAKE 글씨), 둘 사이 경첩
    for (let x = 1; x < 23; x++) for (let y = 3; y < 9; y++) { const yy = y + Math.round((23 - x) * -.08); if (((x - y * 1) >> 2) % 2 === 0) box(g, x, yy, 1, 1, '#f3f5fa'); }   // 위 딱딱이(사선 줄무늬)
    for (let x = 13; x < 35; x++) for (let y = 13; y < 16; y++) if (((x - y) >> 2) % 2 === 0) box(g, x, y, 1, 1, '#f3f5fa');   // 아래 딱딱이 줄무늬
    box(g, 11, 8, 3, 6, MT); box(g, 12, 9, 1, 4, D2);   // 경첩
    box(g, 13, 16, 22, 1, '#e8ecf7'); box(g, 13, 19, 22, 1, '#e8ecf7'); box(g, 23, 16, 1, 7, '#e8ecf7');   // 칸 줄
    box(g, 14, 17, 1, 2, '#e8ecf7'); box(g, 16, 17, 2, 1, '#e8ecf7'); box(g, 19, 18, 3, 1, '#e8ecf7');   // 글씨(SCENE)
    box(g, 25, 17, 3, 1, '#ffe27a'); box(g, 29, 17, 1, 2, '#ffe27a'); box(g, 31, 17, 2, 2, '#ffe27a');   // 숫자
    box(g, 14, 21, 6, 1, '#ffb1d9'); box(g, 25, 21, 7, 1, '#8fe8ff');   // 아래 칸 글씨
  },
};
// 그림 만들기: 몸통 → 세부 → 몸통 밖으로 나간 픽셀 지우기 → 90°씩 돌린 4장
function buildArt() {
  const out = {};
  for (const k of ORDER) {
    const { N, cells, body: col } = KIND[k], S = N * C, P = S * RES;
    const [c, g] = canvasR(S);
    body(g, cells, col);
    let [d, dg] = canvasR(S);
    ART[k](dg);
    // 그림이 실제로 차지한 범위를 재서 → 블록(칸들) 범위 가운데로 옮기고, 가장자리에서 여백 3px 이상 두게 줄임
    try {
      const px = dg.getImageData(0, 0, P, P).data; let x0 = P, y0 = P, x1 = -1, y1 = -1;
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) if (px[(y * P + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) {
        x0 /= RES; y0 /= RES; x1 = (x1 + 1) / RES; y1 = (y1 + 1) / RES;
        // 블록(칸들) 범위 한가운데를 기준으로 0.86배 — 그림은 이 변환 뒤에 칸 한가운데에 오도록 미리 맞춰 그림
        //   (2026-10-27 2차 하율 "꺾이는 부분이 중앙에 안 맞음": ㄴ·ㄱ자 기둥은 x=18±14, 아래 줄 가운데선 y=19, 솟은 칸 가운데 y=5에 그리면 줄인 뒤 칸 한가운데)
        const xs = cells.map(q => q[0]), ys = cells.map(q => q[1]);
        const cx0 = (Math.min(...xs) + Math.max(...xs) + 1) * C / 2, cy0 = (Math.min(...ys) + Math.max(...ys) + 1) * C / 2;
        XF = { k: .86, ax: cx0, ay: cy0, tx: cx0, ty: cy0 }; void x0; void y0; void x1; void y1;
        [d, dg] = canvasR(S); ART[k](dg);
      }
    } catch {} finally { XF = null; }
    // 세부 그림은 몸통 안쪽(가장자리 1px 안)에만
    const [m, mg] = canvasR(S);
    for (const [cx, cy] of cells) mg.fillRect(cx * C, cy * C, C, C);
    mg.globalCompositeOperation = 'destination-out';
    const has = (x, y) => cells.some(q => q[0] === x && q[1] === y);
    for (const [cx, cy] of cells) {
      if (!has(cx - 1, cy)) mg.fillRect(cx * C, cy * C, 1, C);
      if (!has(cx + 1, cy)) mg.fillRect(cx * C + C - 1, cy * C, 1, C);
      if (!has(cx, cy - 1)) mg.fillRect(cx * C, cy * C, C, 1);
      if (!has(cx, cy + 1)) mg.fillRect(cx * C, cy * C + C - 1, C, 1);
    }
    dg.globalCompositeOperation = 'destination-in'; dg.drawImage(m, 0, 0, S, S);
    g.drawImage(d, 0, 0, S, S);
    const rots = [c];
    for (let r = 1; r < 4; r++) {
      const [rc, rg] = canvasR(S);
      rg.translate(S, 0); rg.rotate(Math.PI / 2); rg.drawImage(rots[r - 1], 0, 0, S, S);
      rots.push(rc);
    }
    out[k] = rots;
  }
  return out;
}

/* ===== 게임 ===== */
function rng(seed) { const f = () => { f.s = (f.s + 0x6D2B79F5) | 0; let t = f.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.s = seed | 0; return f; }
// 떨어지는 속도: 한 칸 내려오는 데 걸리는 프레임(가이드라인 공식, 교실용으로 빠른 쪽은 1칸/2프레임에서 멈춤)
export const gravF = lv => Math.max(2, Math.round(60 * Math.pow(.8 - (lv - 1) * .007, lv - 1)));
export const CLEAR_NAME = ['', '정리!', '깔끔하게 정리!', '칼각 정리!', '기자재!'];   // 4줄 = 원작의 '테트리스' 자리 (2026-10-27 하율: 어이없어서 재밌게)

export function createGear(canvas, opt = {}) {
  const g = canvas.getContext('2d');
  let PX = RES;   // 판 한 칸(1단위)당 실제 픽셀 수 — 화면 크기에 맞춰 setScale로 바꿈(기기 픽셀과 1:1이라 흐리지 않음)
  canvas.width = BW * PX; canvas.height = BH * PX; g.imageSmoothingEnabled = false;
  const ART_IMG = buildArt();
  const st = {};
  let rand, raf = 0, last = 0, acc = 0, alive = true, sound = !!opt.sound, actx = null;
  const keys = { left: false, right: false, down: false };

  function reset(seed = (Math.random() * 1e9) | 0) {
    rand = rng(seed);
    Object.assign(st, {
      scene: 'ready', frames: 0, ms: 0, score: 0, lines: 0, level: 1, pieces: 0, b2b: false,
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      bag: [], queue: [], cur: null, hold: null, held: false,
      grav: 0, lock: 0, lockN: 0, das: 0, dasDir: 0, clearRows: [], clearT: 0, combo: 0, flash: 0, shake: 0, parts: [], pops: [], trails: [], rings: [], stop: 0, bump: 0, seed,
    });
    while (st.queue.length < 5) st.queue.push(nextKind());
  }
  function nextKind() { if (!st.bag.length) { st.bag = [...ORDER]; for (let i = 6; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [st.bag[i], st.bag[j]] = [st.bag[j], st.bag[i]]; } } return st.bag.pop(); }

  /* --- 소리 (기본 꺼짐 — 교실) --- */
  function beep(f1, f2, dur, type = 'square', vol = .04, delay = 0) {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), v = actx.createGain(), t = actx.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(v).connect(actx.destination); o.start(t); o.stop(t + dur + .02);
    } catch {}
  }

  // 깨지는 소리: 짧은 잡음(부서짐) + 낮은 '쿵' — 타격감 (2026-10-27 하율)
  let noiseBuf = null;
  function crunch(vol = .12, dur = .18, cut = 2400, delay = 0) {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * .4, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const src = actx.createBufferSource(), f = actx.createBiquadFilter(), v = actx.createGain(), t = actx.currentTime + delay;
      src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(200, t + dur);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f).connect(v).connect(actx.destination); src.start(t); src.stop(t + dur + .02);
    } catch {}
  }
  const thump = (vol = .09) => beep(120, 40, .16, 'sine', vol);
  /* 효과음 다양화 (2026-10-27 하율 "효과음 좀 다양하게") — 장비마다 놓는 소리가 다르고, 연속으로 깨면 음이 올라감. 게임 난수(rand)는 안 씀 */
  function hiss(vol, dur, from, to, type = 'bandpass', q = 1, delay = 0) {   // 걸러 낸 잡음: 셔터·슬레이트·쉭
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * .4, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const src = actx.createBufferSource(), f = actx.createBiquadFilter(), v = actx.createGain(), t = actx.currentTime + delay;
      src.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f).connect(v).connect(actx.destination); src.start(t, Math.random() * .2); src.stop(t + dur + .02);
    } catch {}
  }
  const clap = (vol = .14, delay = 0) => { hiss(vol, .05, 3800, 2000, 'highpass', .7, delay); beep(1900, 1200, .03, 'square', vol * .25, delay); };   // 슬레이트 '딱!'
  const PLACE = {   // 장비별로 놓는 소리 (모양 → 장비: KIND 참고)
    O() { hiss(.07, .025, 5200, 4000, 'highpass', .8); hiss(.06, .03, 4200, 3000, 'highpass', .8, .07); },          // 카메라: 셔터 '찰칵'
    Z() { clap(.1); },                                                                                              // 슬레이트: '딱'
    I() { beep(1200, 1180, .12, 'sine', .025); beep(60, 60, .12, 'sawtooth', .015); },                              // LED 조명: '지잉' 켜지는 소리
    T() { beep(880, 870, .09, 'triangle', .035); beep(1320, 1300, .06, 'triangle', .02, .01); },                  // 삼각대: 금속 '챙'
    L() { beep(620, 600, .08, 'square', .025); hiss(.05, .05, 2400, 1200, 'bandpass', 3); },                       // C스탠드: 쇠 '철컥'
    J() { beep(220, 160, .1, 'sine', .06); hiss(.03, .08, 900, 400); },                                            // 붐 마이크: 속 빈 '퐁'
    S() { hiss(.05, .12, 1400, 500, 'bandpass', .8); },                                                            // 케이블: '스르륵'
  };
  const fxAt = (cs, p) => { const xs = cs.map(c => (p.x + c[0]) * C + C / 2), ys = cs.map(c => (p.y + c[1] - HID) * C + C / 2); return [xs.reduce((a, b) => a + b) / xs.length, ys.reduce((a, b) => a + b) / ys.length]; };

  /* --- 판 --- */
  const fits = (k, r, x, y) => cellsOf(k, r).every(([cx, cy]) => { const bx = x + cx, by = y + cy; return bx >= 0 && bx < COLS && by < ROWS && (by < 0 || !st.board[by][bx]); });
  function spawn(k) {
    const x = k === 'O' ? 4 : 3, y = 0;
    st.cur = { k, r: 0, x, y };
    st.grav = 0; st.lock = 0; st.lockN = 0; st.lowY = y;
    if (!fits(k, 0, x, y)) return over();
    if (fits(k, 0, x, y + 1)) st.cur.y++;   // 숨은 줄에서 한 칸 내려와 보이게 시작(가이드라인)
  }
  function newPiece() { const k = st.queue.shift(); st.queue.push(nextKind()); spawn(k); st.held = false; opt.onQueue?.(); }
  function start() { if (st.scene !== 'ready') return; st.scene = 'play'; newPiece(); opt.onStart?.(); clap(.12); beep(880, 1320, .08, 'triangle', .03, .06); }   // 시작: '액션!' 슬레이트
  function move(dx) {
    const p = st.cur; if (!p || !fits(p.k, p.r, p.x + dx, p.y)) return false;
    p.x += dx; resetLock(); beep(330 + Math.random() * 20, 300, .03, 'square', .02); return true;
  }
  function rotate(dir) {
    const p = st.cur; if (!p) return false;
    if (p.k === 'O') { resetLock(); return true; }
    const to = (p.r + dir + 4) % 4, kicks = (p.k === 'I' ? K4 : K3)[p.r + '>' + to];
    for (const [dx, dy] of kicks) if (fits(p.k, to, p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; p.r = to; resetLock(); return true; }   // 돌릴 땐 효과음 없음 (2026-10-27 하율)
    return false;
  }
  function resetLock() { const p = st.cur; if (p && !fits(p.k, p.r, p.x, p.y + 1) && st.lockN < LOCK_MAX) { st.lock = 0; st.lockN++; } }
  // 더 낮은 줄에 처음 닿으면 고정 미루기 횟수를 다시 채움(가이드라인 — 높은 데서 돌리다 횟수를 다 쓰면 바닥에서 바로 굳던 문제)
  const lowCheck = () => { const p = st.cur; if (p && p.y > st.lowY) { st.lowY = p.y; st.lockN = 0; } };
  const grounded = () => { const p = st.cur; return p && !fits(p.k, p.r, p.x, p.y + 1); };
  function softStep() { const p = st.cur; if (p && fits(p.k, p.r, p.x, p.y + 1)) { p.y++; st.score += SOFT_PT; return true; } return false; }
  function hardDrop() {
    const p = st.cur; if (!p || st.scene !== 'play' || st.clearT) return;
    let n = 0; while (fits(p.k, p.r, p.x, p.y + 1)) { p.y++; n++; }
    st.score += n * HARD_PT; st.shake = Math.max(st.shake, 4); st.bump = 1;
    const cs = cellsOf(p.k, p.r);
    for (const [cx, cy] of cs) if (n) for (let i = 0; i < 3; i++) st.parts.push({ x: (p.x + cx) * C + rand() * C, y: (p.y + cy - HID) * C + C, vx: (rand() - .5) * 70, vy: -30 - rand() * 50, t: .4, c: '#e6ebf7' });
    // 내리꽂은 자취(위에서 떨어진 빛줄기)
    if (n > 1) for (const [cx, cy] of cs) st.trails.push({ x: (p.x + cx) * C, y0: (p.y + cy - n - HID) * C, y1: (p.y + cy - HID) * C, t: .18 });
    if (n) { const [fx, fy] = fxAt(cs, p); opt.onScore?.(n * HARD_PT, fx, fy, 0); }
    thump(.07); if (n > 2) hiss(.05, .12, 2600, 400, 'bandpass', .8);   // 내리꽂기 '쉭-쿵'
    lockPiece();
  }
  function hold() {
    if (st.scene !== 'play' || st.held || !st.cur || st.clearT) return;
    const k = st.cur.k;
    if (st.hold) { const h = st.hold; st.hold = k; spawn(h); } else { st.hold = k; newPiece(); }
    st.held = true; beep(440, 330, .06, 'triangle', .03); hiss(.04, .14, 800, 3000, 'bandpass', 1.5);   // 가방에 넣는 '지익'
    opt.onQueue?.();
  }
  function lockPiece() {
    const p = st.cur; if (!p) return;
    let above = true, out = false;
    for (const [cx, cy] of cellsOf(p.k, p.r)) {
      const bx = p.x + cx, by = p.y + cy;
      if (by >= 0) st.board[by][bx] = { k: p.k, r: p.k === 'O' ? 0 : p.r, sx: cx, sy: cy }; else out = true;
      if (by >= HID) above = false;
    }
    st.cur = null; st.pieces++;
    beep(150, 90, .07, 'triangle', .05); PLACE[p.k]?.();
    // 보이는 칸에 하나도 못 들어감 / 판 맨 위보다 더 위로 삐져나온 채 놓임(돌리기 킥으로 생길 수 있음 — 2026-10-27 검사에서 칸이 사라지던 버그) = 장비실 꽉 참
    if (above || out) return over();
    const full = []; for (let y = 0; y < ROWS; y++) if (st.board[y].every(Boolean)) full.push(y);
    if (full.length) {
      const n = full.length, tet = n === 4, lv = st.level;
      const pts = LINE_PTS[n] * lv * (tet && st.b2b ? 1.5 : 1);
      st.score += Math.round(pts); st.b2b = tet; st.lines += n; st.level = levelOf(st.lines);
      st.clearRows = full; st.clearT = CLEAR_T; st.flash = tet ? 1 : .6; st.shake = tet ? 10 : 4 + n; st.stop = tet ? 7 : 4;   // stop = 잠깐 멈칫(히트스톱)
      // 깨지기(2026-10-27 2차 하율 "깔끔한 느낌이 안 남"): 칸이 통째로 하얗게 번쩍 → 작아지며 사라짐, 가운데 → 바깥 순서로 차례차례. 흩날리는 조각은 없앰
      for (const y of full) for (let x = 0; x < COLS; x++) { const c = st.board[y][x]; st.pops.push({ k: c.k, r: c.r, sx: c.sx, sy: c.sy, x: x * C, y: (y - HID) * C, d: Math.abs(x - 4.5) * .016, t: 0 }); }
      st.rings.push({ y: ((full[0] + full[full.length - 1]) / 2 - HID) * C + C / 2, t: .45, n });
      crunch(tet ? .2 : .13, tet ? .32 : .2, tet ? 3200 : 2400); thump(tet ? .16 : .11);
      st.combo = (st.combo || 0) + 1; const up = Math.pow(2, Math.min(st.combo - 1, 8) / 12);   // 연속으로 깰수록 반음씩 올라감
      if (tet) { [523, 659, 784, 1047].forEach((f, i) => beep(f * up, f * up, .12, 'square', .045, .06 + i * .07)); crunch(.12, .25, 1800, .12); clap(.14, .4); }   // 4줄: 팡파레 + 슬레이트 '딱!'
      else [660, 784, 880].slice(0, n).forEach((f, i) => beep(f * up, f * up * 1.5, .1 + n * .02, 'square', .04, .04 + i * .06));   // 1·2·3줄: 줄 수만큼 음이 이어짐
      if (st.level > lv) [523, 784, 1047, 1568].forEach((f, i) => beep(f, f, .1, 'triangle', .04, .45 + i * .08));   // 레벨 업
      opt.onScore?.(Math.round(pts), BW / 2, ((full[0] + full[full.length - 1]) / 2 - HID) * C + C / 2, n);
      opt.onClear?.(n, CLEAR_NAME[n] + (tet && pts > LINE_PTS[4] * lv ? ' 연속!' : ''), Math.round(pts), st.level > lv);
    } else {
      st.combo = 0; newPiece();
      // 선반이 거의 찼으면(보이는 위 4줄 안에 장비) 경고음 — 소리로도 위험을 알림
      if (st.scene === 'play' && st.board.slice(HID, HID + 4).some(r => r.some(Boolean))) { beep(196, 185, .12, 'square', .03); beep(196, 185, .12, 'square', .03, .16); }
    }
  }
  function finishClear() {
    const rows = st.clearRows; st.clearRows = [];
    st.board = st.board.filter((_, y) => !rows.includes(y));
    while (st.board.length < ROWS) st.board.unshift(Array(COLS).fill(null));
    newPiece();
  }
  function over() { if (st.scene === 'over') return; st.scene = 'over'; st.cur = null; st.shake = 6; beep(300, 60, .5, 'sawtooth', .05); clap(.12, .55); /* 쿵 → 슬레이트 '컷!' → 내려가는 세 음 */ [392, 330, 262].forEach((f, i) => beep(f, f * .97, .18, 'triangle', .04, .7 + i * .2)); opt.onOver?.({ score: st.score, lines: st.lines, level: st.level, pieces: st.pieces, ms: Math.round(st.ms) }); }

  function update(dt) {
    if (st.stop > 0) { st.stop--; return; }   // 히트스톱: 깨지는 순간 몇 프레임 멈칫
    for (const q of st.parts) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; }
    st.parts = st.parts.filter(q => q.t > 0);
    for (const q of st.pops) q.t += dt; st.pops = st.pops.filter(q => q.t < q.d + .2);
    for (const q of st.trails) q.t -= dt; st.trails = st.trails.filter(q => q.t > 0);
    for (const q of st.rings) q.t -= dt; st.rings = st.rings.filter(q => q.t > 0);
    st.shake = Math.max(0, st.shake - dt * 30); st.flash = Math.max(0, st.flash - dt * 3); st.bump = Math.max(0, st.bump - dt * 8);
    if (st.scene !== 'play') return;
    st.frames++; st.ms += dt * 1000;
    if (st.clearT) { if (--st.clearT === 0) finishClear(); return; }
    const p = st.cur; if (!p) return;
    // 좌우 누르고 있으면: DAS 10프레임 뒤 ARR 2프레임마다
    const dir = keys.left && !keys.right ? -1 : keys.right && !keys.left ? 1 : 0;
    if (dir !== st.dasDir) { st.dasDir = dir; st.das = 0; }
    else if (dir) { st.das++; if (st.das >= DAS && (st.das - DAS) % ARR === 0) move(dir); }
    // 떨어짐
    const gf = keys.down ? Math.max(1, Math.floor(gravF(st.level) / 20)) : gravF(st.level);
    if (++st.grav >= gf) { st.grav = 0; if (keys.down ? softStep() : (fits(p.k, p.r, p.x, p.y + 1) && (p.y++, true))) st.lock = 0; }
    lowCheck();
    if (grounded()) { if (++st.lock >= LOCK) lockPiece(); }
  }

  /* --- 그리기 --- */
  const ghostY = p => { let y = p.y; while (fits(p.k, p.r, p.x, y + 1)) y++; return y; };
  function drawCellAt(c, px, py) { g.drawImage(ART_IMG[c.k][c.r], c.sx * C * RES, c.sy * C * RES, C * RES, C * RES, px, py, C, C); }
  function drawPiece(p, y, alpha = 1) {
    g.globalAlpha = alpha;
    const N = KIND[p.k].N, img = ART_IMG[p.k][p.k === 'O' ? 0 : p.r];
    for (const [cx, cy] of cellsOf(p.k, p.r)) { const by = y + cy - HID; if (by < 0) continue; g.drawImage(img, cx * C * RES, cy * C * RES, C * RES, C * RES, (p.x + cx) * C, by * C, C, C); }
    g.globalAlpha = 1; void N;
  }
  function draw() {
    g.setTransform(PX, 0, 0, PX, 0, 0); g.imageSmoothingEnabled = false;
    g.save();
    const sh = st.shake > 0 ? Math.round((rand() - .5) * st.shake) : 0, shx = st.shake > 3 ? Math.round((rand() - .5) * st.shake * .6) : 0;
    g.clearRect(0, 0, BW, BH);
    // 기자재실 선반 안쪽
    g.fillStyle = '#1d2238'; g.fillRect(0, 0, BW, BH);
    g.fillStyle = '#232945'; for (let x = 0; x < COLS; x++) for (let y = 0; y < VIS; y++) if ((x + y) % 2) g.fillRect(x * C, y * C, C, C);
    g.fillStyle = '#2c3354'; for (let y = 4; y < VIS; y += 5) g.fillRect(0, y * C - 1, BW, 1);   // 선반 줄
    g.translate(shx, sh + Math.round(st.bump * 2));
    const gone = st.clearT > 0;   // 지워지는 줄의 칸은 pops가 대신 그림
    for (let y = HID; y < ROWS; y++) { if (gone && st.clearRows.includes(y)) continue; for (let x = 0; x < COLS; x++) { const c = st.board[y][x]; if (c) drawCellAt(c, x * C, (y - HID) * C); } }
    if (st.clearT) {   // 지워지는 줄: 처음 2프레임 새하얗게 번쩍 → 빈 줄에 남은 빛이 가운데로 사라짐
      const k = st.clearT / CLEAR_T;
      for (const y of st.clearRows) {
        if (gone) { const w = Math.round(BW * k); g.fillStyle = `rgba(255,255,255,${k * .35})`; g.fillRect(BW / 2 - w / 2, (y - HID) * C + C / 2 - 1, w, 2); }   // 가운데 얇은 빛줄
      }
    }
    for (const r of st.rings) {   // 줄이 깨질 때 위아래로 퍼지는 충격파
      const k = 1 - r.t / .45, h = 4 + k * (24 + r.n * 10);
      g.fillStyle = `rgba(255,255,255,${(1 - k) * .55})`; g.fillRect(0, Math.round(r.y - h), BW, 2); g.fillRect(0, Math.round(r.y + h), BW, 2);
    }
    for (const q of st.trails) { g.fillStyle = `rgba(255,255,255,${q.t / .18 * .22})`; g.fillRect(q.x + 2, q.y0, C - 4, q.y1 - q.y0); }
    const p = st.cur;
    if (p && st.scene === 'play') {
      const gy = ghostY(p);
      if (gy !== p.y) {   // 고스트(놓일 자리): 예전처럼 칸만 — 테두리 없이 안쪽을 흰색으로 채워 밝게 (2026-10-27 하율)
        g.fillStyle = 'rgba(255,255,255,.42)';
        for (const [cx, cy] of cellsOf(p.k, p.r)) { const by = gy + cy - HID; if (by < 0) continue; g.fillRect((p.x + cx) * C + 1, by * C + 1, C - 2, C - 2); }
      }
      drawPiece(p, p.y);
    }
    for (const q of st.pops) {   // 깨지는 칸: 차례가 오면 하얗게 → 가운데로 줄어들며 사라짐
      const k = Math.max(0, (q.t - q.d) / .2), sz = Math.round(C * (1 - k * k));
      if (sz <= 0) continue;
      const o = (C - sz) / 2;
      if (k < .25) { drawCellAt(q, q.x, q.y); g.fillStyle = `rgba(255,255,255,${k === 0 ? .55 : .9})`; g.fillRect(q.x, q.y, C, C); }
      else { g.fillStyle = `rgba(255,255,255,${1 - k * .6})`; g.fillRect(q.x + o, q.y + o, sz, sz); }
    }
    for (const q of st.parts) { g.globalAlpha = Math.min(1, q.t * 2); g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }
    g.globalAlpha = 1;
    if (st.flash) { g.fillStyle = `rgba(255,255,255,${st.flash * .35})`; g.fillRect(0, 0, BW, BH); }
    g.restore();
  }
  // 작은 칸(보관·다음)에 장비 한 개 그리기: 기본 방향, 가운데 정렬
  function drawMini(cv, k, dim = false) {
    const mg = cv.getContext('2d'); mg.imageSmoothingEnabled = false;
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, cv.width, cv.height); if (!k) return;
    const f = cv.width / 52; mg.setTransform(f, 0, 0, f, 0, 0);   // 캔버스를 52×28 기준 좌표로(2배 캔버스면 2배로 선명하게)
    const cs = KIND[k].cells, xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * C, h = (Math.max(...ys) - Math.min(...ys) + 1) * C;
    mg.globalAlpha = dim ? .35 : 1;
    mg.drawImage(ART_IMG[k][0], Math.min(...xs) * C * RES, Math.min(...ys) * C * RES, w * RES, h * RES, Math.round((52 - w) / 2), Math.round((28 - h) / 2), w, h);
    mg.globalAlpha = 1;
  }

  /* --- 루프 --- */
  function frame(t) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = t; if (st.scene === 'play') pause(); return; }
    const dt = Math.min(.1, (t - (last || t)) / 1000); last = t;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
  }
  function pause() { if (st.scene !== 'play') return; st.scene = 'pause'; beep(660, 440, .08, 'triangle', .03); keys.left = keys.right = keys.down = false; opt.onPause?.(true); }
  function resume() { if (st.scene !== 'pause') return; st.scene = 'play'; last = 0; beep(440, 660, .08, 'triangle', .03); opt.onPause?.(false); }
  reset(opt.seed);
  raf = requestAnimationFrame(frame);

  return {
    st, reset, start, pause, resume, drawMini, hardDrop, hold,
    input(name, down) {
      if (st.scene === 'ready') { if (down) start(); return; }   // 아무 키나 누르면 시작(그 키로 블록을 움직이진 않음)
      if (st.scene === 'pause') { if (down) resume(); return; }
      if (st.scene !== 'play') return;
      if (name === 'left' || name === 'right') { keys[name] = down; if (down) { st.dasDir = name === 'left' ? -1 : 1; st.das = 0; if (!st.clearT) move(st.dasDir); } }
      else if (name === 'down') { keys.down = down; if (down && !st.clearT && softStep()) st.lock = 0; }
      else if (!down || st.clearT) return;
      else if (name === 'cw') rotate(1);
      else if (name === 'ccw') rotate(-1);
      else if (name === 'drop') hardDrop();
      else if (name === 'hold') hold();
    },
    setSound(v) { sound = v; },
    setScale(n) { n = Math.max(1, Math.round(n)); if (n === PX) return; PX = n; canvas.width = BW * PX; canvas.height = BH * PX; draw(); },
    destroy() { alive = false; cancelAnimationFrame(raf); try { actx?.close(); } catch {} },
    step(n = 1, quiet = false) { for (let i = 0; i < n; i++) update(STEP); if (!quiet) draw(); },   // 테스트용
    draw, art: ART_IMG,
  };
}
