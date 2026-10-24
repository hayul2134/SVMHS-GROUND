// SVMHS GROUND — 출석 보상 목록 (서버 lib/attend.js와 화면 attend.js·social.js가 같이 씀 → 한 곳만 고치면 됨)
// by: 'best' = 최고 연속 기록 / 'total' = 누적 출석일. 한 번 닿으면 영구 해금(기록이 끊겨도 유지).
// kind: sticker 스티커 · avatar 프로필 사진 · color 프로필 배경(전용 색) · title 칭호(프로필 이름 아래 · 순위에 표시)
//       perk 혜택(꾸미기가 아니라 실제로 쓸모 있는 것): deco2·deco3 = 첫 화면 시계 스티커 칸 +1, shield3 = 출석 방패 최대 3개
// 스티커·프로필 사진은 이모지가 아니라 직접 그린 그림('r:이름' → public/js/att-art.js의 ART)
// 2026-10-24 하율 피드백으로 전면 교체(2차: "고등학생 대상이니 유행 따라가지 말고 그냥 예쁜 걸로" → 얼굴 달린 물건·아기 캐릭터 빼고, 프사는 하늘·달·바다 풍경)("사자·용·화산·부엉이는 안 좋아할 것 같다, 은하수 배경 같은 게 좋다"):
// 레퍼런스 = 10대 폰꾸·다꾸 트렌드(Y2K 반짝이·홀로그램, 키치한 캐릭터 굿즈, 우주 사진) + 듀오링고 연속 기록(마일스톤마다 확실한 보상, 3·7·30·100·365 같은 큰 날은 더 귀하게)
// 보상 간격을 촘촘히(초반 3~30일 사이 매주 뭔가 받음) + 배경 3종 추가(솜사탕 하늘·벚꽃·홀로그램). 예전 그림 이름은 att-art.js RW_OLD로 새 그림에 연결
export const REWARDS = [
  { by: 'best', d: 3, kind: 'sticker', v: 'r:heart' },
  { by: 'best', d: 5, kind: 'title', v: '불씨' },
  { by: 'best', d: 7, kind: 'sticker', v: 'r:camera' },
  { by: 'best', d: 7, kind: 'title', v: '일주일 개근' },
  { by: 'best', d: 10, kind: 'avatar', v: 'r:sunset' },
  { by: 'best', d: 14, kind: 'color', v: 'xflame' },
  { by: 'best', d: 14, kind: 'perk', v: 'deco2' },
  { by: 'best', d: 20, kind: 'sticker', v: 'r:cherry' },
  { by: 'best', d: 25, kind: 'color', v: 'xsky' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:moonnight' },
  { by: 'best', d: 30, kind: 'title', v: '한 달의 불꽃' },
  { by: 'best', d: 30, kind: 'perk', v: 'shield3' },
  { by: 'best', d: 40, kind: 'color', v: 'xsunset' },
  { by: 'best', d: 50, kind: 'sticker', v: 'r:planet' },
  { by: 'best', d: 60, kind: 'color', v: 'xsakura' },
  { by: 'best', d: 75, kind: 'color', v: 'xaurora' },
  { by: 'best', d: 100, kind: 'avatar', v: 'r:auroramt' },
  { by: 'best', d: 100, kind: 'title', v: '백일의 전설' },
  { by: 'best', d: 120, kind: 'sticker', v: 'r:shootstar' },
  { by: 'best', d: 150, kind: 'sticker', v: 'r:butterfly' },
  { by: 'best', d: 200, kind: 'color', v: 'xgalaxy' },
  { by: 'best', d: 250, kind: 'color', v: 'xholo' },
  { by: 'best', d: 365, kind: 'avatar', v: 'r:starcat' },
  { by: 'best', d: 365, kind: 'title', v: '꺼지지 않는 불꽃' },
  { by: 'total', d: 5, kind: 'sticker', v: 'r:moon' },
  { by: 'total', d: 10, kind: 'sticker', v: 'r:disco' },
  { by: 'total', d: 15, kind: 'avatar', v: 'r:sakuratree' },
  { by: 'total', d: 30, kind: 'title', v: '단골손님' },
  { by: 'total', d: 30, kind: 'perk', v: 'deco3' },
  { by: 'total', d: 50, kind: 'color', v: 'xgold' },
  { by: 'total', d: 80, kind: 'sticker', v: 'r:headphone' },
  { by: 'total', d: 120, kind: 'avatar', v: 'r:jellyfish' },
  { by: 'total', d: 200, kind: 'title', v: '그라운드 지킴이' },
];
// 예전 보상 이름 → 새 이름 (서버 저장값·검사에서 씀 — 그림 쪽 att-art.js RW_OLD와 같음)
export const RW_OLD = { sprout: 'heart', medal: 'camera', gem: 'cherry', trophy: 'planet', volcano: 'butterfly', pencil: 'moon', badge: 'headphone', lion: 'sunset', dragon: 'moonnight', star: 'auroramt', firework: 'starcat', owl: 'sakuratree', whale: 'jellyfish',
  // 2026-10-24 두 번째 교체("고등학생 대상, 그냥 예쁜 걸로"): 캐릭터 프사 → 풍경 프사, 딸기우유·붕어빵 → 달·미러볼
  strawcat: 'sunset', astrodog: 'moonnight', crownbunny: 'auroramt', galaxycat: 'starcat', jellybear: 'sakuratree', milk: 'moon', bungeo: 'disco' };
export const rwNorm = v => typeof v === 'string' && v.startsWith('r:') && RW_OLD[v.slice(2)] ? 'r:' + RW_OLD[v.slice(2)] : v;
export const KIND = { sticker: '스티커', avatar: '프로필 사진', color: '배경 색', title: '칭호', perk: '혜택' };
export const PERK_NAME = { deco2: '시계 스티커 칸 +1', deco3: '시계 스티커 칸 +1', shield3: '출석 방패 최대 3개' };
// 출석 보상 스티커의 쓰임새: 대표 스티커(이름 옆) · 첫 화면 시계 스티커 · 댓글·DM 스티커 (모두 받은 보상 스티커만)
export const STK_MSG = /^::(r:[a-z0-9]+)$/;   // 예전 이름(r:medal 등)도 통과 → rwNorm으로 새 이름   // 스티커만 보내는 댓글·DM 본문
export const perkOn = (v, best, total) => REWARDS.some(r => r.kind === 'perk' && r.v === v && rwOn(r, best || 0, total || 0));
export const decoSlots = (best, total) => 1 + ['deco2', 'deco3'].filter(v => perkOn(v, best, total)).length;
export const shieldMaxOf = (best, total) => perkOn('shield3', best, total) ? 3 : 2;
export const COLOR_NAME = { xflame: '불꽃', xsky: '솜사탕 하늘', xsunset: '노을', xsakura: '벚꽃', xaurora: '오로라', xgalaxy: '은하수', xholo: '홀로그램', xgold: '금빛' };
export const ATT_COLORS = REWARDS.filter(r => r.kind === 'color').map(r => r.v);
// 축하를 크게 하는 날 (보상이 없어도)
export const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365];
export const rwOn = (r, best, total) => (r.by === 'total' ? total : best) >= r.d;
export const unlockedOf = (best, total, kind) => REWARDS.filter(r => r.kind === kind && rwOn(r, best || 0, total || 0)).map(r => r.v);
export const rwName = r => r.kind === 'color' ? `‘${COLOR_NAME[r.v]}’` : r.kind === 'title' ? `‘${r.v}’` : r.kind === 'perk' ? PERK_NAME[r.v] : r.v;
