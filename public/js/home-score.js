// '나 집에 갈래!' 점수 규칙 — 화면(runner.js)과 서버(functions/api/s)가 같이 쓴다. 바꾸면 이미 쌓인 기록과 비교가 안 맞으니 주의
// 점수(m)는 살아남은 시간만으로 정해진다(공룡 게임과 같은 방식): 속도가 V0에서 ACC씩 빨라져 VMAX에서 멈추고, 달린 거리 / UNIT = m
// 랭킹은 다른 게임처럼 '작을수록 좋음'으로 저장하므로 서버에는 HOME_MAX - 점수를 넣는다
export const HOME_MAX = 1000000;
export const V0 = 150, ACC = 4, VMAX = 380, UNIT = 10;   // px/s · px/s² · px/s · px당 m
const T1 = (VMAX - V0) / ACC;
export const speedAt = t => Math.min(VMAX, V0 + ACC * t);
export function distAt(ms) {
  const t = ms / 1000;
  return t <= T1 ? V0 * t + ACC * t * t / 2 : V0 * T1 + ACC * T1 * T1 / 2 + VMAX * (t - T1);
}
// 2026-10-25 하율: 10만 m = 집 도착(골인). 그 이상은 없음 → 10만에서 멈춤 (최고 속도로 약 44분)
export const GOAL = 100000;
export const scoreAt = ms => Math.min(GOAL, Math.floor(distAt(ms) / UNIT + 1e-6));
