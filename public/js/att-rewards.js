// SVMHS GROUND — 출석 보상 목록 (서버 lib/attend.js와 화면 attend.js·social.js가 같이 씀 → 한 곳만 고치면 됨)
// by: 'best' = 최고 연속 기록 / 'total' = 누적 출석일. 한 번 닿으면 영구 해금(기록이 끊겨도 유지).
// kind: sticker 스티커 · avatar 프로필 사진 · color 프로필 배경(전용 색) · title 칭호(프로필 이름 아래 · 순위에 표시)
//       perk 혜택(꾸미기가 아니라 실제로 쓸모 있는 것): deco2·deco3 = 첫 화면 시계 스티커 칸 +1, shield3 = 출석 방패 최대 3개
// 스티커·프로필 사진은 이모지가 아니라 직접 그린 그림('r:이름' → public/js/att-art.js의 ART)
// 2026-10-24 4차(하율: "일반 학교 오브젝트 + 콘텐츠과·미디어과·프로듀스과 특성, 학과끼리 공평하게"):
// 학교 공통 물건(종·시계·명찰·급식판·노트·G 로고)은 하나씩, 학과 물건은 **세 과가 항상 같은 날 함께** 풀림 → "왜 우리 과는 늦게 주냐" 불만이 없게.
// 콘과=영상콘텐츠과(방송·영화: 슬레이트·조명·필름 카메라) · 미과=영상미디어과(애니·디자인·3D: 팔레트·3D 큐브·펜 태블릿) · 프과=영상프로듀스과(후반 작업: 편집 타임라인·헤드폰·컬러 휠 — 2026-10-24 하율 정정)
// 화면에는 과 이름을 쓰지 않고 물건 이름만 씀(OBJ_NAME) — "왜 과로 틀에 박냐"는 말이 안 나오게 (2026-10-24)
// 프로필 사진은 로고와 같은 씰 — 학과 씰은 30일(파랑)·100일(금빛)·365일(은하수) 등급만 다르고 세 과 모두 같은 날.
export const REWARDS = [
  { by: 'best', d: 3, kind: 'sticker', v: 'r:bell' },
  { by: 'best', d: 5, kind: 'title', v: '불씨' },
  { by: 'best', d: 7, kind: 'sticker', v: 'r:slate', dept: 'con' },
  { by: 'best', d: 7, kind: 'sticker', v: 'r:palette', dept: 'med' },
  { by: 'best', d: 7, kind: 'sticker', v: 'r:timeline', dept: 'pro' },
  { by: 'best', d: 7, kind: 'title', v: '일주일 개근' },
  { by: 'best', d: 10, kind: 'avatar', v: 'r:gblue' },
  { by: 'best', d: 14, kind: 'color', v: 'xflame' },
  { by: 'best', d: 14, kind: 'perk', v: 'deco2' },
  { by: 'best', d: 20, kind: 'sticker', v: 'r:clock' },
  { by: 'best', d: 25, kind: 'color', v: 'xsky' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:conblue', dept: 'con' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:medblue', dept: 'med' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:problue', dept: 'pro' },
  { by: 'best', d: 30, kind: 'title', v: '한 달의 불꽃' },
  { by: 'best', d: 30, kind: 'perk', v: 'shield3' },
  { by: 'best', d: 40, kind: 'color', v: 'xsunset' },
  { by: 'best', d: 50, kind: 'sticker', v: 'r:light', dept: 'con' },
  { by: 'best', d: 50, kind: 'sticker', v: 'r:cube', dept: 'med' },
  { by: 'best', d: 50, kind: 'sticker', v: 'r:headset', dept: 'pro' },
  { by: 'best', d: 60, kind: 'color', v: 'xsakura' },
  { by: 'best', d: 75, kind: 'color', v: 'xaurora' },
  { by: 'best', d: 90, kind: 'sticker', v: 'r:gseal' },
  { by: 'best', d: 100, kind: 'avatar', v: 'r:congold', dept: 'con' },
  { by: 'best', d: 100, kind: 'avatar', v: 'r:medgold', dept: 'med' },
  { by: 'best', d: 100, kind: 'avatar', v: 'r:progold', dept: 'pro' },
  { by: 'best', d: 100, kind: 'title', v: '백일의 전설' },
  { by: 'best', d: 200, kind: 'color', v: 'xgalaxy' },
  { by: 'best', d: 250, kind: 'color', v: 'xholo' },
  { by: 'best', d: 365, kind: 'avatar', v: 'r:congx', dept: 'con' },
  { by: 'best', d: 365, kind: 'avatar', v: 'r:medgx', dept: 'med' },
  { by: 'best', d: 365, kind: 'avatar', v: 'r:progx', dept: 'pro' },
  { by: 'best', d: 365, kind: 'title', v: '꺼지지 않는 불꽃' },
  { by: 'total', d: 5, kind: 'sticker', v: 'r:nametag' },
  { by: 'total', d: 10, kind: 'sticker', v: 'r:tray' },
  { by: 'total', d: 15, kind: 'avatar', v: 'r:gpink' },
  { by: 'total', d: 30, kind: 'title', v: '단골손님' },
  { by: 'total', d: 30, kind: 'perk', v: 'deco3' },
  { by: 'total', d: 50, kind: 'color', v: 'xgold' },
  { by: 'total', d: 80, kind: 'sticker', v: 'r:note' },
  { by: 'total', d: 120, kind: 'avatar', v: 'r:gnight' },
  { by: 'total', d: 200, kind: 'title', v: '그라운드 지킴이' },
];
export const DEPT = { con: '콘텐츠과', med: '미디어과', pro: '프로듀스과' };   // 내부 분류용(화면 표기 X)
// 스티커·프로필 사진의 화면 이름 = 물건 이름
export const OBJ_NAME = {
  bell: '학교 종', clock: '자명종', gseal: 'G 씰', nametag: '명찰', tray: '급식판', note: '노트',
  slate: '슬레이트', palette: '팔레트', timeline: '편집 타임라인', light: '촬영 조명', cube: '3D 큐브', headset: '헤드폰',
  gblue: '파란 G', gpink: '분홍 G', gnight: '밤하늘 G',
  conblue: '필름 카메라', medblue: '펜 태블릿', problue: '컬러 휠',
  congold: '금빛 필름 카메라', medgold: '금빛 펜 태블릿', progold: '금빛 컬러 휠',
  congx: '은하수 필름 카메라', medgx: '은하수 펜 태블릿', progx: '은하수 컬러 휠',
};
// 예전 보상 이름 → 지금 이름 (그림 교체가 여러 번 있었음 — 저장값·보낸 스티커가 그대로 보이게)
export const RW_OLD = {
  megaphone: 'timeline', chart: 'headset',
  sprout: 'bell', medal: 'slate', gem: 'clock', trophy: 'light', volcano: 'gseal', pencil: 'nametag', badge: 'note', lion: 'gblue', dragon: 'conblue', star: 'congold', firework: 'congx', owl: 'gpink', whale: 'gnight',
  heart: 'bell', camera: 'slate', cherry: 'clock', planet: 'light', shootstar: 'gseal', butterfly: 'gseal', milk: 'nametag', bungeo: 'tray', headphone: 'note', moon: 'nametag', disco: 'bell',
  strawcat: 'gblue', astrodog: 'conblue', crownbunny: 'congold', galaxycat: 'congx', jellybear: 'gpink',
  sunset: 'gblue', moonnight: 'conblue', auroramt: 'congold', starcat: 'congx', sakuratree: 'gpink', jellyfish: 'gnight',
  sealsky: 'gblue', sealsakura: 'gpink', sealnight: 'conblue', sealcrown: 'congold', sealsea: 'gnight', sealgalaxy: 'congx',
};
export const objName = v => OBJ_NAME[String(v || '').replace(/^r:/, '')] || '';
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
export const rwName = r => r.kind === 'color' ? `‘${COLOR_NAME[r.v]}’` : r.kind === 'title' ? `‘${r.v}’` : r.kind === 'perk' ? PERK_NAME[r.v] : objName(r.v) || r.v;

/* ===== 뽑기 (2026-10-24 하율: "뽑기 같은 기능도 있으면 좋겠어") =====
   출석 보상과 따로, 뽑기에서만 나오는 스티커(그림: att-art.js GA). 출석 보상 스티커와 똑같이 프로필·대표 스티커·시계·댓글·DM에 씀.
   뽑기권: 출석(등교일)마다 1장 + 연속 5일마다 1장 더 + 기념일(MILESTONES) 1장 더. 처음 3장 선물. 최대 99장.
   확률은 화면에 그대로 공개. 천장: 희귀 이상이 10번 연속 안 나오면 10번째는 희귀 확정, 전설은 50번째 확정. 5연뽑은 희귀 이상 1개 확정.
   이미 가진 스티커가 또 나오면 조각(일반 1 · 희귀 3 · 전설 10) → 조각 10개 = 뽑기권 1장. 돈으로 사는 것 없음(사이트 수익 없음). */
export const GACHA = [
  { v: 'r:eraser', rar: 1 }, { v: 'r:hilite', rar: 1 }, { v: 'r:postit', rar: 1 }, { v: 'r:ruler', rar: 1 },
  { v: 'r:tape', rar: 1 }, { v: 'r:sdcard', rar: 1 }, { v: 'r:banana', rar: 1 }, { v: 'r:earbud', rar: 1 },
  { v: 'r:popcorn', rar: 2 }, { v: 'r:ramen', rar: 2 }, { v: 'r:mic', rar: 2 }, { v: 'r:joypad', rar: 2 },
  { v: 'r:gholo', rar: 3 }, { v: 'r:diploma', rar: 3 },
];
Object.assign(OBJ_NAME, { eraser: '지우개', hilite: '형광펜', postit: '포스트잇', ruler: '자', tape: '마스킹테이프', sdcard: 'SD 카드', banana: '바나나우유', earbud: '무선 이어폰', popcorn: '팝콘', ramen: '컵라면', mic: '마이크', joypad: '게임패드', gholo: '홀로그램 G', diploma: '졸업장' });
export const RAR = { 1: { n: '일반', p: 75 }, 2: { n: '희귀', p: 21 }, 3: { n: '전설', p: 4 } };   // p: % (합 100)
export const GC = { start: 3, max: 99, pityRare: 10, pityLeg: 50, shard: { 1: 1, 2: 3, 3: 10 }, shardPerTix: 10, bonusEvery: 5 };
export const gcRar = v => GACHA.find(g => g.v === v)?.rar || 0;
// 가진 뽑기 스티커 목록: own = {'r:eraser': 2, …} (나온 횟수)
export const gcHave = own => GACHA.filter(g => own && own[g.v] > 0).map(g => g.v);
// 출석 하루에 받는 뽑기권: 1 + 연속 5일마다 1 + 기념일 1
export const gcEarn = cur => 1 + (cur % GC.bonusEvery === 0 ? 1 : 0) + (MILESTONES.includes(cur) ? 1 : 0);
