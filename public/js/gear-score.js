// '기자재 정리!'(장비 테트리스) 점수 규칙 — 화면(gear.js)과 서버(functions/api/s)가 같이 쓴다. 바꾸면 이미 쌓인 기록과 비교가 안 맞으니 신중히.
// 랭킹은 다른 게임처럼 '작을수록 1등' 구조라 서버엔 GEAR_MAX - 점수로 저장한다(집에 가고 싶어!와 같은 방식).
export const GEAR_MAX = 9999999;
export const LINE_PTS = [0, 100, 300, 500, 800];   // 한 번에 1·2·3·4줄 × 레벨 (4줄 연속이면 ×1.5)
export const LEVEL_LINES = 10, LEVEL_MAX = 20;
export const levelOf = lines => Math.min(LEVEL_MAX, 1 + Math.floor(lines / LEVEL_LINES));
export const SOFT_PT = 1, HARD_PT = 2;   // 소프트 드롭 한 칸 1점 · 하드 드롭 한 칸 2점
// 서버 검사용 상한: 줄 점수는 한 줄에 최대 300점(4줄 연속 800×1.5÷4) × 마지막 레벨, 드롭 점수는 한 개에 최대 22칸×2점
export const maxScore = (lines, pieces) => 300 * lines * levelOf(lines) + 44 * pieces;
