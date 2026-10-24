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
  { by: 'best', d: 7, kind: 'title', v: '타오르는 중' },
  { by: 'best', d: 10, kind: 'avatar', v: 'r:gblue' },
  { by: 'best', d: 14, kind: 'color', v: 'xflame' },
  { by: 'best', d: 14, kind: 'perk', v: 'deco2' },
  { by: 'best', d: 20, kind: 'sticker', v: 'r:clock' },
  { by: 'best', d: 25, kind: 'color', v: 'xsky' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:conblue', dept: 'con' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:medblue', dept: 'med' },
  { by: 'best', d: 30, kind: 'avatar', v: 'r:problue', dept: 'pro' },
  { by: 'best', d: 30, kind: 'title', v: '꺼지지 않는 불꽃' },
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
  slate: '슬레이트', palette: '팔레트', timeline: '타임라인', light: '조명', cube: '3D 큐브', headset: '헤드폰',
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
export const objName = v => { const k = String(v || '').replace(/^r:/, ''); return k.endsWith('_s') ? (OBJ_NAME[k.slice(0, -2)] ? '반짝이 ' + OBJ_NAME[k.slice(0, -2)] : '') : OBJ_NAME[k] || ''; };
export const rwNorm = v => typeof v === 'string' && v.startsWith('r:') && RW_OLD[v.slice(2)] ? 'r:' + RW_OLD[v.slice(2)] : v;
export const KIND = { sticker: '스티커', avatar: '프로필 사진', color: '배경 색', title: '칭호', perk: '혜택' };
export const PERK_NAME = { deco2: '시계 스티커 칸 +1', deco3: '시계 스티커 칸 +1', shield3: '출석 방패 최대 3개' };
// 출석 보상 스티커의 쓰임새: 대표 스티커(이름 옆) · 첫 화면 시계 스티커 · 댓글·DM 스티커 (모두 받은 보상 스티커만)
export const STK_MSG = /^::(r:[a-z0-9]+(?:_s)?)$/;   // 예전 이름(r:medal 등)도 통과 → rwNorm으로 새 이름   // 스티커만 보내는 댓글·DM 본문
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

/* ===== 뽑기 — 시즌 1 「쉬는 시간」 (2026-10-24 하율: "너무 메리트 없고 재미도 없어. 레퍼런스 찾아서 다시 기획") =====
   레퍼런스: 포켓몬빵 띠부씰(모두가 알아보는 희귀템) · 팝마트 블라인드박스(시리즈 + 도감에 '?'로만 보이는 시크릿) ·
   세트 수집 설계(빈칸을 먼저 보여 주고, 완성 보상은 사회적·기능적으로) · 디스코드 프로필 효과(남에게 보이는 움직임이 가치).
   → 등급이 오를수록 '할 수 있는 일'이 달라짐:
     일반 = 학생 물건 스티커 · 희귀 = 움직이는 스티커 · 전설 = 효과(닉네임·프로필 등장·시계·착용 소품) · 시크릿 = 황금 닉네임.
   시리즈를 다 모으면 칭호 GC_TITLE + 프로필 사진 홀로 테두리. 중복 스티커(일반·희귀)는 맞팔 친구에게 선물. 조각으로 없는 것 골라 받기(GC.pick) · 가진 스티커 반짝이 강화(GC.shine, 값 끝 '_s').
   뽑기권: 출석(등교일)마다 1장 + 연속 5일마다 1장 더 + 기념일(MILESTONES) 1장 더. 처음 3장 선물. 최대 99장. 돈으로 사는 것 없음. */
export const FX = { name: '닉네임 효과', prof: '프로필 등장 효과', clock: '시계 테마', masc: '착용 소품' };
export const GACHA = [
  // 일반 — 필통·가방·책상 위, 학생이 실제로 가진 물건
  { v: 'r:eraser', rar: 1 }, { v: 'r:hilite', rar: 1 }, { v: 'r:postit', rar: 1 }, { v: 'r:ruler', rar: 1 },
  { v: 'r:sharp', rar: 1 }, { v: 'r:correct', rar: 1 }, { v: 'r:tape', rar: 1 }, { v: 'r:earbud', rar: 1 },
  // 희귀 — 움직이는 스티커(학교생활 한 장면). 댓글·DM·프로필·시계 위에서 움직임
  { v: 'r:plane', rar: 2, d: '창밖으로 날아가는 종이비행기' }, { v: 'r:test100', rar: 2, d: '빨간 동그라미가 그려지는 100점' },
  { v: 'r:ball', rar: 2, d: '통통 튀는 농구공' }, { v: 'r:memo', rar: 2, d: '하트가 퐁 올라오는 비밀 편지' },
  // 전설 — 효과(스티커가 아님): 서비스 › 뽑기 '내 효과'에서 하나씩 켬
  { v: 'r:fxholo', rar: 3, fx: 'name', d: '랭킹·댓글·DM·프로필 어디서나 이름이 홀로그램으로 반짝여요' },
  { v: 'r:fxstar', rar: 3, fx: 'prof', d: '누가 내 프로필을 열면 별똥별이 쏟아져요' },
  { v: 'r:fxneon', rar: 3, fx: 'clock', d: '첫 화면 큰 시계가 네온사인으로 바뀌어요' },
  { v: 'r:fxcrown', rar: 3, fx: 'masc', d: '캐릭터 머리 위에 왕관이 떠요 — 캐릭터가 없으면 큰 시계·로고 위에, 프로필 사진엔 항상' },
  // 시크릿 — 도감엔 '?'로만 보임
  { v: 'r:fxgold', rar: 4, fx: 'name', d: '이름이 황금빛으로 빛나요' },
];
export const GACHA_OLD = [];   // 뽑기에서 빠진 스티커(가진 사람만 계속 씀) — 시즌 1 개편 때 비움(사용자가 하율뿐이라 정리)
export const GACHA_ALL = [...GACHA, ...GACHA_OLD];
export const GACHA_STK = GACHA_ALL.filter(g => !g.fx);   // 스티커로 쓰는 것(일반·희귀)
export const gcItem = v => GACHA_ALL.find(g => g.v === v);
Object.assign(OBJ_NAME, { eraser: '지우개', hilite: '형광펜', postit: '포스트잇', ruler: '자', tape: '마스킹테이프', earbud: '무선 이어폰', sharp: '샤프', correct: '수정테이프',
  plane: '종이비행기', test100: '100점 시험지', ball: '농구공', memo: '비밀 편지',
  fxholo: '홀로그램 닉네임', fxstar: '별똥별 등장', fxneon: '네온 시계', fxcrown: '떠 있는 왕관', fxgold: '황금 닉네임', fxkey: '집 열쇠' });
export const RAR = { 1: { n: '일반', p: 72 }, 2: { n: '희귀', p: 22 }, 3: { n: '전설', p: 5.5 }, 4: { n: '시크릿', p: .5 } };   // p: % (합 100)
// 조각(2026-10-25 하율: "조각 → 뽑기권은 메리트 없음, 조각으로 다른 걸") — 뽑기권으로는 못 바꿈.
//   pick: 아직 없는 것 골라 받기(등급별 조각) · shine: 가진 스티커(일반·희귀)를 반짝이 버전으로(다 모은 뒤에도 쓸 곳)
export const GC = { start: 3, max: 99, pityRare: 10, pityLeg: 50, shard: { 1: 1, 2: 3, 3: 10, 4: 30 }, pick: { 1: 8, 2: 20, 3: 60, 4: 100 }, shine: { 1: 30, 2: 60 }, bonusEvery: 5 };
// 반짝이 스티커: 값 끝에 '_s' (r:eraser → r:eraser_s). gc_own에도 같은 키로 기록. 어디서든 그 값으로 저장·검사·그림
export const SHN = '_s';
export const isShn = v => typeof v === 'string' && v.endsWith(SHN);
export const baseOf = v => isShn(v) ? v.slice(0, -SHN.length) : v;
// 게임 랭킹 라운드(2026-10-25 하율: "2주에 한 번 마감해서 새로 경쟁, 1~3등 뽑기권, 게임 랭커만"):
//   start(월요일 0시, KST)부터 14일씩. 라운드가 끝나면 게임마다 1~3등에게 tix[등수-1]장 — 서버 settleRounds가 한 번만 지급
// 2026-10-25 2차(하율): 주기를 둘로 — 1주(wdays) = 게임별 1~3등 뽑기권 · 2주(days) = 라운드 점수·티어. 큰 시즌(한 달)은 나중에
export const RK = { start: '2026-10-26', days: 14, wdays: 7, tix: [3, 2, 1] };
const dnum = ymd => Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) / 864e5;
const ymdOf = n => new Date(n * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
// 라운드 번호(시작 전이면 -1)와 그 라운드의 첫날·마지막 날(YYYYMMDD) — today도 YYYYMMDD(KST)
export const rkOf = today => { const s = dnum(RK.start.replace(/-/g, '')), n = Math.floor((dnum(today) - s) / RK.days); return { n, from: ymdOf(s + n * RK.days), to: ymdOf(s + n * RK.days + RK.days - 1) }; };
export const rkRange = n => { const s = dnum(RK.start.replace(/-/g, '')); return { n, from: ymdOf(s + n * RK.days), to: ymdOf(s + n * RK.days + RK.days - 1) }; };
// 뽑기권 주(1주) 번호·기간 — 라운드와 같은 시작일, 라운드 n = 주 2n·2n+1
export const wkOf = today => { const s = dnum(RK.start.replace(/-/g, '')), n = Math.floor((dnum(today) - s) / RK.wdays); return { n, from: ymdOf(s + n * RK.wdays), to: ymdOf(s + n * RK.wdays + RK.wdays - 1) }; };
export const wkRange = n => { const s = dnum(RK.start.replace(/-/g, '')); return { n, from: ymdOf(s + n * RK.wdays), to: ymdOf(s + n * RK.wdays + RK.wdays - 1) }; };
// 라운드 티어 (2026-10-25 하율: 순위로 점수 → 티어). 라운드(RK, 2주) 안에서 게임마다 순위 점수(참가자 전원이 받음: 1등 100 ~ 꼴찌 100/n),
// 4게임 합으로 줄 세워 백분위로 티어. 라운드가 끝나면 users.tier_last에 남기고 새로 시작.
// 2026-10-25 2차(하율): 롤 티어(아이언~챌린저)로. 챌린저 = 1등(참가 3명 이상) · 그랜드마스터 = 2·3등(6명 이상) · 나머지는 백분위
export const TIERS = [
  { k: 'challenger', n: '챌린저', lb: '1등' },
  { k: 'grandmaster', n: '그랜드마스터', lb: '2·3등' },
  { k: 'master', n: '마스터', top: .08, lb: '상위 8%' },
  { k: 'diamond', n: '다이아몬드', top: .16, lb: '상위 16%' },
  { k: 'emerald', n: '에메랄드', top: .28, lb: '상위 28%' },
  { k: 'platinum', n: '플래티넘', top: .42, lb: '상위 42%' },
  { k: 'gold', n: '골드', top: .58, lb: '상위 58%' },
  { k: 'silver', n: '실버', top: .74, lb: '상위 74%' },
  { k: 'bronze', n: '브론즈', top: .88, lb: '상위 88%' },
  { k: 'iron', n: '아이언', top: 1.01, lb: '그 외' },
];
export const tierOfK = k => TIERS.find(t => t.k === k) || null;
export const tierAt = (rank, n) => {
  if (rank === 1 && n >= 3) return TIERS[0];
  if (rank <= 3 && n >= 6) return TIERS[1];
  const p = (rank - 1) / Math.max(1, n);
  return TIERS.slice(2).find(t => p < t.top) || TIERS[TIERS.length - 1];
};
export const gamePts = (r, n) => Math.round(100 * (n - r + 1) / n);
export const GC_TITLE = '쉬는 시간 마스터';   // 시즌 1 시리즈를 다 모으면 받는 칭호
// 히든 보상(2026-10-25 하율): '나 집에 갈래!' 100,000m에 처음 도착한 단 한 사람 — 집 열쇠(착용 소품) + 칭호.
// 뽑기 목록(GACHA)·도감·개발자 '전부 해금'에 들어가지 않음(세상에 하나). 서버가 첫 도착 때 gc_own에 넣어 줌(settings 'home_first')
export const HIDDEN = [{ v: 'r:fxkey', fx: 'masc', d: '나 집에 갈래! 100,000m에 처음 도착한 단 한 사람' }];
// 칭호(2026-10-25 하율: 재밌게, '첫 번째'가 강조되게 — 그다음 도착한 사람은 그 '첫 번째' 부분만 뺀 칭호)
// 2026-10-25 하율: 첫 도착자 히든 칭호는 '눈물나는 한 걸음' — 화면에선 앞에 금빛 '최초' 도장(칭호 값에는 안 들어감)
export const HOME_FIRST = '최초';   // 강조 도장 글자
export const HOME_TITLE2 = '하교 성공';   // 10만 m 도착한 모두(첫 도착자 포함)
export const HOME_TITLE = '눈물나는 한 걸음';   // 첫 도착자 한 명만
export const HOME_MARK = 'h:home';   // gc_own에 넣는 '10만 m 도착' 표시(스티커·효과 아님)
export const isHidden = v => HIDDEN.some(h => h.v === v);
export const gcRar = v => gcItem(v)?.rar || 0;
// 가진 뽑기 스티커 목록(스티커만): own = {'r:eraser': 2, …} (나온 횟수)
export const gcHave = own => GACHA_STK.filter(g => own && own[g.v] > 0).flatMap(g => own[g.v + SHN] > 0 ? [g.v, g.v + SHN] : [g.v]);
export const gcDone = own => GACHA.every(g => own && own[g.v] > 0);
// 효과 값 검사: 그 칸(slot)의 효과인지
export const fxOk = (slot, v) => !!GACHA.find(g => g.v === v && g.fx === slot) || HIDDEN.some(g => g.v === v && g.fx === slot);
// 출석 하루에 받는 뽑기권: 1 + 연속 5일마다 1 + 기념일 1
export const gcEarn = cur => 1 + (cur % GC.bonusEvery === 0 ? 1 : 0) + (MILESTONES.includes(cur) ? 1 : 0);

// 네온 시계 색(2026-10-24 하율: "네온 색상도 바꿀 수 있게") — 실제 네온관 색. 값은 이 기기에 저장(localStorage sg_neon_c), html[data-neon]로 적용
export const NEON = [['pink', '핑크', '#ff3fb4'], ['red', '레드', '#ff3448'], ['orange', '오렌지', '#ff7a1f'], ['yellow', '옐로', '#ffd22e'], ['green', '그린', '#2fff7a'], ['ice', '아이스 블루', '#36e2ff'], ['blue', '블루', '#3f6bff'], ['purple', '퍼플', '#b14bff'], ['warm', '웜 화이트', '#ffe7b8']];
export const neonPick = cur => `<div class="neon-pick" role="radiogroup" aria-label="네온 색">${NEON.map(([k, n, c]) => `<button type="button" role="radio" aria-checked="${cur === k}" class="nc nc-${k}${cur === k ? ' on' : ''}" data-neon-c="${k}" data-tip="${n}" aria-label="${n}"></button>`).join('')}</div>`;
