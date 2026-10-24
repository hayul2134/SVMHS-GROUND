// 서울영상고 동아리 목록 + 로고 (2026-10-25 하율 제공). 로고는 public/clubs/<k>.webp (128px 정사각, 흰 바탕)
// 프로필 꾸미기에서 고르고(값 = 이름), 프로필 칩에 로고로 보임. 목록에 없는 예전 값은 글자만.
export const CLUBS = [
  ['anim', '애니메이션 제작소'], ['manhwa', '만화창작부'], ['adfocus', 'AD focus'], ['kino', '키노테크'], ['grid', '그리드'], ['extrude', 'EXTRUDE'],
  ['hong', '홍프레임'], ['artfilm', '서울영상 아트필름'], ['hypro', '하이프로 픽쳐스'], ['ludus', '루더스'], ['timeline', '타임라인'], ['ssuk', '쓱싹'],
  ['artgen', '미술 영재반'], ['icec', 'ICEC'], ['sinabro', '시나브로'], ['gonggan', '공간'], ['texas', '텍사스의 소떼들'], ['saim', 'S.AI.M'],
  ['rcy', 'RCY'], ['ytigers', 'Y-tigers'], ['ybs', 'YBS'], ['gogamdo', '고감도'], ['monorate', '모노레이트'],
];
// 가나다순(2026-10-25 하율) — 영어 이름은 읽는 소리로(ICEC 아이섹 · RCY 알씨와이 · AD focus 에이디 · YBS 와이비에스 · Y-tigers 와이타이거즈 · EXTRUDE 익스트루드 · S.AI.M 사임)
const READ = { icec: '아이섹', rcy: '알씨와이', adfocus: '에이디포커스', ybs: '와이비에스', ytigers: '와이타이거즈', extrude: '익스트루드', saim: '사임' };
CLUBS.sort((a, b) => (READ[a[0]] || a[1]).localeCompare(READ[b[0]] || b[1], 'ko'));
export const clubOf = name => CLUBS.find(c => c[1] === name) || null;
export const clubLogo = (name, cls = 'clogo') => { const c = clubOf(name); return c ? `<img class="${cls}" src="/clubs/${c[0]}.webp" alt="" loading="lazy" width="128" height="128">` : ''; };
