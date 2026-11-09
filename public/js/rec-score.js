// SVMHS GROUND — 기록실 전용 게임 기록(2026-11-09 하율 "기록실 없는 게임들 다 추가"): 복도의 심판·체육 창고 정리!·지각 직전!·영상고 랩 배틀
// 티어·뽑기권·주간 미션·업적·숙련도와 상관없이 기록실·순위표·프로필 기록에만. 서버(functions/api/s)와 화면(social.js)이 같이 씀.
// 서버엔 다른 게임처럼 '작을수록 1등'으로 저장: 복도의 심판 = 승리 시간(ms) · 나머지 = MAX - 점수
export const BALL_MAX = 1e7;     // 체육 창고 정리!: BALL_MAX - 점수
export const CROSS_MAX = 1e6;    // 지각 직전!: CROSS_MAX - 칸
export const RHY_MAX = 1e7;      // 영상고 랩 배틀: RHY_MAX - 주간(스토리 3곡) 완주 점수
export const JUDGE_MIN = 180000; // 복도의 심판: 처음부터 이긴 시간 하한(3분) — 이보다 빠르면 보류(공격 순서가 정해져 있어 사람이 낼 수 없는 시간)
export const BALL_PER_DROP = 22; // 공 하나 떨어뜨릴 때 최대로 얻을 수 있는 점수(야구공만 계속 떨어뜨려 끝까지 합쳐도 약 21.3점)
export const BALL_COOL_MS = 500; // 연속 투하 간격(ball.js COOL)
export const CROSS_HOP_MS = 120; // 한 칸 뛰는 시간(cross.js HOP)
