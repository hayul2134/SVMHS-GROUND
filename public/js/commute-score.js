// SVMHS GROUND — 등교하기! 규칙(2026-11-02 하율 "지하철 노선도로 타자연습하는 게임, 이름은 등교하기!")
// 화면(commute.js)과 서버(functions/api/s)가 같이 씀 — 노선·타수 계산을 바꾸면 둘 다 바뀜.
// 한 판 = 노선 하나(ROUTES)를 타고 학교 앞 신정역(5호선)까지. 다음 역 이름을 치면 열차가 한 역 감.
// 기록 = 평균 타수(한글 두벌식 자판을 누른 횟수 / 분). 서버엔 '작을수록 좋음'으로 100타에 걸린 ms(v = 합 ms × 100 / 타)를 저장.
// 판 기록(rounds) = [노선 번호, 역1 ms, 역2 ms, …, 오타 수] — 서버가 노선으로 타 수를 다시 세서 v를 다시 계산함.
//   ⚠ ROUTES는 순서·내용을 바꾸지 말 것(예전 판 기록의 노선 번호가 달라짐) — 새 노선은 끝에 추가
export const LINES = {
  1: ['1호선', '#0052A4'], 2: ['2호선', '#00A84D'], 5: ['5호선', '#996CAC'], 6: ['6호선', '#CD7C2F'], 9: ['9호선', '#BDB092'],
};
export const GOAL = '신정';   // 서울영상고 앞 역(5호선)
// 노선 = [[호선, [첫 역(출발 또는 갈아타는 역), …]], …] — 다음 구간의 첫 역은 앞 구간의 마지막 역(갈아타는 역)
export const ROUTES = [
  [[2, ['봉천', '신림', '신대방', '구로디지털단지', '대림', '신도림', '문래', '영등포구청']], [5, ['영등포구청', '양평', '오목교', '목동', '신정']]],
  [[2, ['아현', '이대', '신촌', '홍대입구', '합정', '당산', '영등포구청']], [5, ['영등포구청', '양평', '오목교', '목동', '신정']]],
  [[9, ['신목동', '선유도', '당산', '국회의사당', '여의도']], [5, ['여의도', '신길', '영등포시장', '영등포구청', '양평', '오목교', '목동', '신정']]],
  [[9, ['양천향교', '마곡나루', '신방화', '공항시장', '김포공항']], [5, ['김포공항', '송정', '마곡', '발산', '우장산', '화곡', '까치산', '신정']]],
  [[6, ['대흥', '공덕']], [5, ['공덕', '마포', '여의나루', '여의도', '신길', '영등포시장', '영등포구청', '양평', '오목교', '목동', '신정']]],
  [[1, ['남영', '용산', '노량진', '대방', '신길']], [5, ['신길', '영등포시장', '영등포구청', '양평', '오목교', '목동', '신정']]],
  [[2, ['신대방', '구로디지털단지', '대림', '신도림']], [2, ['신도림', '도림천', '양천구청', '신정네거리', '까치산']], [5, ['까치산', '신정']]],
  [[5, ['방화', '개화산', '김포공항', '송정', '마곡', '발산', '우장산', '화곡', '까치산', '신정']]],
  [[5, ['애오개', '공덕', '마포', '여의나루', '여의도', '신길', '영등포시장', '영등포구청', '양평', '오목교', '목동', '신정']]],
  [[9, ['흑석', '노들', '노량진', '샛강', '여의도']], [5, ['여의도', '신길', '영등포시장', '영등포구청', '양평', '오목교', '목동', '신정']]],
];
// 출발역 마음대로(2026-11-03 하율 "등교하기!에서 출발 지점을 마음대로 설정"): ROUTES 구간들로 지하철 그물(NET)을 만들고
// 아무 역에서나 신정까지 가장 빠른 길(역 하나 1 · 갈아타기 +3)을 ROUTES와 같은 모양으로 만듦. 화면 전용(기록은 이 기기에만).
//   같은 호선이 이어 나오는 구간(2호선 신도림 → 까치산)은 신정지선 = 다른 줄('2b')로 봄
const NET = (() => {
  const g = {}, add = (a, b, k) => (g[a] ||= []).push([b, k]);
  ROUTES.forEach(R => R.forEach(([l, st], k) => {
    const key = k && R[k - 1][0] === l ? l + 'b' : String(l);
    for (let i = 1; i < st.length; i++) { add(st[i - 1], st[i], key); add(st[i], st[i - 1], key); }
  }));
  return g;
})();
// 출발역 고르기 화면(2026-11-03 2차 하율 "보기도 좋고 고르기도 좋게"): 호선 탭 → 실제 노선 순서대로 역 줄. [호선, [[줄 이름, [역…]]…]]
//   새 역을 넣으면 ROUTES(길) · commute-map LL(좌표) · 여기(순서) 세 곳 — NET에 없는 역은 자동으로 빠짐
const ORDER = {
  1: [['', ['남영', '용산', '노량진', '대방', '신길']]],
  2: [['', ['아현', '이대', '신촌', '홍대입구', '합정', '당산', '영등포구청', '문래', '신도림', '대림', '구로디지털단지', '신대방', '신림', '봉천']], ['신정지선', ['신도림', '도림천', '양천구청', '신정네거리', '까치산']]],
  5: [['', ['방화', '개화산', '김포공항', '송정', '마곡', '발산', '우장산', '화곡', '까치산', '신정', '목동', '오목교', '양평', '영등포구청', '영등포시장', '신길', '여의도', '여의나루', '마포', '공덕', '애오개']]],
  6: [['', ['대흥', '공덕']]],
  9: [['', ['김포공항', '공항시장', '신방화', '마곡나루', '양천향교', '신목동', '선유도', '당산', '국회의사당', '여의도', '샛강', '노량진', '노들', '흑석']]],
};
export const PICK = Object.entries(ORDER).map(([l, G]) => [+l, G.map(([t, a]) => [t, a.filter(n => NET[n])])]);
export const linesAt = n => [...new Set((NET[n] || []).map(([, k]) => parseInt(k)))];   // 그 역을 지나는 호선(갈아타는 역 표시용)
export function routeFrom(from) {
  if (!NET[from] || from === GOAL) return null;
  const seen = new Set(), Q = [[0, from, '', null]];
  let end = null;
  while (Q.length) {
    Q.sort((a, b) => a[0] - b[0]);
    const cur = Q.shift(), [c, n, k] = cur, id = n + '|' + k;
    if (seen.has(id)) continue; seen.add(id);
    if (n === GOAL) { end = cur; break; }
    for (const [m, mk] of NET[n]) if (!seen.has(m + '|' + mk)) Q.push([c + 1 + (k && k !== mk ? 3 : 0), m, mk, cur]);
  }
  if (!end) return null;
  const path = []; for (let x = end; x; x = x[3]) path.unshift(x);
  const R = [];
  for (let i = 1; i < path.length; i++) {
    const k = path[i][2], last = R[R.length - 1];
    if (last && last.k === k) last.st.push(path[i][1]); else R.push({ k, st: [path[i - 1][1], path[i][1]] });
  }
  return R.map(s => [parseInt(s.k), s.st]);
}
// 노선 펼치기: [{ n: 역 이름, l: 호선, x: 갈아타는 역이면 다음 호선 }] — 0번은 출발역(치지 않음)
export const stopsOf = ri => stopsOfRoute(ROUTES[ri]);
export function stopsOfRoute(R) {
  if (!R) return null;
  const out = [];
  R.forEach(([l, st], k) => st.forEach((n, i) => {
    if (k && !i) { out[out.length - 1].x = l; return; }   // 갈아타는 역은 한 번만
    out.push({ n, l });
  }));
  return out;
}
// 한 글자를 치는 데 누르는 자판 수(두벌식): 초성 1(된소리는 Shift 1) · 중성 1(ㅘㅙㅚㅝㅞㅟㅢ 2) · 받침 0/1(겹받침 2) · 그 밖의 글자 1
const J2 = new Set([9, 10, 11, 14, 15, 16, 19]), T2 = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]);
export function keysOf(s) {
  let k = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) { k += 1; continue; }
    const j = Math.floor(c % 588 / 28), t = c % 28;
    k += 1 + (J2.has(j) ? 2 : 1) + (!t ? 0 : T2.has(t) ? 2 : 1);
  }
  return k;
}
export const MIN_KEY_MS = 20;   // 1타에 0.02초(3,000타)보다 빠르면 사람 손으로는 어려움
export const tpmOf = v => v > 0 ? Math.round(6e6 / v) : 0;   // 저장값 → 타수
// 판 기록으로 다시 계산 → { v, keys, ms, miss } 또는 { err }
export function scoreOf(r) {
  if (!Array.isArray(r) || r.length < 3) return { err: '판 기록이 비어 있어요' };
  const st = stopsOf(r[0]);
  if (!st) return { err: '없는 노선이에요' };
  const n = st.length - 1, ms = r.slice(1, 1 + n), miss = r[1 + n];
  if (r.length !== n + 2) return { err: `역 ${n}개의 시간이 와야 하는데 ${r.length - 2}개가 왔어요` };
  if (!(miss >= 0 && miss <= 9999)) return { err: '오타 수가 이상해요' };
  let keys = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const t = ms[i], k = keysOf(st[i + 1].n);
    if (!(t >= 0 && t <= 600e3)) return { err: `${i + 1}번째 역(${st[i + 1].n}) 시간이 범위를 벗어났어요` };
    if (t < Math.max(100, k * MIN_KEY_MS)) return { err: `${st[i + 1].n}(${k}타)을 ${t}ms 만에 쳤어요 — 1초에 50타보다 빨라요`, fast: true, i };
    keys += k; sum += t;
  }
  return { v: Math.max(1, Math.round(sum * 100 / keys)), keys, ms: sum, miss };
}
