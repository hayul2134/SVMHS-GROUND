// SVMHS GROUND — 새 기능 미리보기 (2026-10-25 하율 결정)
// 새 기능은 main에 바로 올리되, 여기 PREVIEW에 이름이 있는 동안은 개발자 계정(developer)에서만 켜짐.
// 월요일 06:00 공지와 함께 이름을 빼면 모두에게 열림(tools/patchnotes/WEEKLY.md 'C').
// 서버(functions/api/s)도 이 파일을 import — document 등 브라우저 전용 코드는 넣지 말 것.
//   화면: 새 요소에 data-ff="이름" → 개발자가 아니면 CSS로 숨김(html:not(.dev-pv) [data-ff]).
//   JS: ffOn('이름', isDev) / 서버: ffOn('이름', isAdm(me))
// 형식: ['이름', '무엇인지 한 줄', '추가한 날짜']
export const PREVIEW_LIST = [
  ['tier-profile', '프로필 티어를 큰 명판(엠블럼·티어 이름·순위·점수)으로 더 잘 보이게', '2026-10-26'],
  ['tier-fancy', '티어 순위 버튼·티어 표시를 더 잘 보이고 화려하게(홈 랭킹 탭·랭킹 줄 배지·게임 티어 계단·TOP 10 버튼)', '2026-10-26'],
  ['rank-tier', '홈 전체 랭킹: 연속 출석·티어 두 탭만(게임별 탭 제거)', '2026-10-26'],
  ['story-share', '랭킹 스토리 공유 이미지(1080×1920, 캡처 대신 또렷하게)', '2026-10-26'],
];
export const PREVIEW = new Set(PREVIEW_LIST.map(x => x[0]));
// 게시된 패치 공지에 든 깃발은 자동으로 모두에게 열림(2026-10-26 하루 패치 — social.js가 /api/s/patch 게시본의 ff로 채움)
export const RELEASED = new Set();
export const ffOn = (name, dev) => !PREVIEW.has(name) || RELEASED.has(name) || !!dev;
