// SVMHS GROUND — 새 기능 미리보기 (2026-10-25 하율 결정)
// 새 기능은 main에 바로 올리되, 여기 PREVIEW에 이름이 있는 동안은 개발자 계정(developer)에서만 켜짐.
// 월요일 06:00 공지와 함께 이름을 빼면 모두에게 열림(tools/patchnotes/WEEKLY.md 'C').
// 서버(functions/api/s)도 이 파일을 import — document 등 브라우저 전용 코드는 넣지 말 것.
//   화면: 새 요소에 data-ff="이름" → 개발자가 아니면 CSS로 숨김(html:not(.dev-pv) [data-ff]).
//   JS: ffOn('이름', isDev) / 서버: ffOn('이름', isAdm(me))
// 형식: ['이름', '무엇인지 한 줄', '추가한 날짜']
export const PREVIEW_LIST = [
];
export const PREVIEW = new Set(PREVIEW_LIST.map(x => x[0]));
export const ffOn = (name, dev) => !PREVIEW.has(name) || !!dev;
