// SVMHS GROUND — 출석 보상 목록 (서버 lib/attend.js와 화면 attend.js·social.js가 같이 씀 → 한 곳만 고치면 됨)
// by: 'best' = 최고 연속 기록 / 'total' = 누적 출석일. 한 번 닿으면 영구 해금(기록이 끊겨도 유지).
// kind: sticker 스티커 · avatar 프로필 사진 · color 프로필 배경(전용 색) · title 칭호(프로필 이름 아래 · 순위에 표시)
// 스티커·프로필 사진은 이모지가 아니라 직접 그린 그림('r:이름' → public/js/att-art.js의 ART)
export const REWARDS = [
  { by: 'best', d: 3, kind: 'sticker', v: 'r:sprout' },
  { by: 'best', d: 5, kind: 'title', v: '불씨' },
  { by: 'best', d: 7, kind: 'sticker', v: 'r:medal' },
  { by: 'best', d: 7, kind: 'title', v: '일주일 개근' },
  { by: 'best', d: 10, kind: 'avatar', v: 'r:lion' },
  { by: 'best', d: 14, kind: 'color', v: 'xflame' },
  { by: 'best', d: 20, kind: 'sticker', v: 'r:gem' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:dragon' },
  { by: 'best', d: 30, kind: 'title', v: '한 달의 불꽃' },
  { by: 'best', d: 40, kind: 'color', v: 'xsunset' },
  { by: 'best', d: 50, kind: 'sticker', v: 'r:trophy' },
  { by: 'best', d: 75, kind: 'color', v: 'xaurora' },
  { by: 'best', d: 100, kind: 'avatar', v: 'r:star' },
  { by: 'best', d: 100, kind: 'title', v: '백일의 전설' },
  { by: 'best', d: 150, kind: 'sticker', v: 'r:volcano' },
  { by: 'best', d: 200, kind: 'color', v: 'xgalaxy' },
  { by: 'best', d: 365, kind: 'avatar', v: 'r:firework' },
  { by: 'best', d: 365, kind: 'title', v: '꺼지지 않는 불꽃' },
  { by: 'total', d: 5, kind: 'sticker', v: 'r:pencil' },
  { by: 'total', d: 15, kind: 'avatar', v: 'r:owl' },
  { by: 'total', d: 30, kind: 'title', v: '단골손님' },
  { by: 'total', d: 50, kind: 'color', v: 'xgold' },
  { by: 'total', d: 80, kind: 'sticker', v: 'r:badge' },
  { by: 'total', d: 120, kind: 'avatar', v: 'r:whale' },
  { by: 'total', d: 200, kind: 'title', v: '그라운드 지킴이' },
];
export const KIND = { sticker: '스티커', avatar: '프로필 사진', color: '배경 색', title: '칭호' };
export const COLOR_NAME = { xflame: '불꽃', xsunset: '노을', xaurora: '오로라', xgalaxy: '은하수', xgold: '금빛' };
export const ATT_COLORS = REWARDS.filter(r => r.kind === 'color').map(r => r.v);
// 축하를 크게 하는 날 (보상이 없어도)
export const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365];
export const rwOn = (r, best, total) => (r.by === 'total' ? total : best) >= r.d;
export const unlockedOf = (best, total, kind) => REWARDS.filter(r => r.kind === kind && rwOn(r, best || 0, total || 0)).map(r => r.v);
export const rwName = r => r.kind === 'color' ? `‘${COLOR_NAME[r.v]}’` : r.kind === 'title' ? `‘${r.v}’` : r.v;
