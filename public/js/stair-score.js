// '영상고 계단 오르기' 규칙 — 화면(stair.js)과 서버(functions/api/s)가 같이 쓴다. 바꾸면 이미 쌓인 기록과 비교가 안 맞으니 신중히.
// 랭킹은 다른 게임처럼 '작을수록 1등' 구조라 서버엔 STAIR_MAX - 오른 계단 수로 저장한다(집에 가고 싶어!·기자재 정리!와 같은 방식).
export const STAIR_MAX = 9999999;
export const GAIN = 0.075;          // 한 칸 오를 때 차는 종 게이지(전체 = 1)
export const FLOOR = 25;            // 25칸마다 한 층
export const MIN_STEP_MS = 55;      // 사람이 한 칸 오르는 데 걸리는 최소 시간(1초에 18칸 넘게는 못 누름) — 서버 검사용
// 종 게이지가 1초에 줄어드는 양: 처음 0.13(1초에 약 1.7칸이면 버팀) → 칸이 늘수록 빨라져 350칸쯤부터 0.55(1초에 약 7.3칸)
export const drain = steps => 0.13 + Math.min(0.42, steps * 0.0012);
// 서버 검사용: steps칸을 오르며 버틸 수 있는 가장 긴 시간(ms). 게이지는 처음 1 + 칸마다 GAIN만 차고, 아무리 느려도 1초에 0.13씩은 줄어듦
export const maxMs = steps => Math.ceil((1 + steps * GAIN) / 0.13 * 1000) + 2000;
// 층 이름: 학교 1~5층 → 옥상 → 그 위는 높이(m) — 하늘(옥상 위 50~300m) · 구름 위(350~700m) · 우주(750m~)
export const zoneOf = f => f < 5 ? '학교' : f === 5 ? '옥상' : f < 12 ? '하늘' : f < 20 ? '구름 위' : '우주';
export const floorName = (f, short = false) => f <= 0 ? '1층' : f < 5 ? (f + 1) + '층' : f === 5 ? '옥상' : (short ? '' : zoneOf(f) + ' ') + (f - 5) * 50 + 'm';
