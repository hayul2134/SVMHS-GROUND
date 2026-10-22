// 오늘의 밸런스 게임 — 기본 질문 목록 + 일정(월~금 하루 한 문제, 6시 공개 · 마지막 교시 끝 +10분 마감)
// 관리자 페이지에서 날짜별로 덮어쓸 수 있음(balance_custom). 질문 40자 · 선택지 20자 이내(관리자 입력 한도와 같게).
// 원칙: 한쪽이 뻔히 좋은 문제는 넣지 않는다. 둘 다 아쉽거나 둘 다 탐나게 — 그리고 가끔은 말도 안 되게.
// 대상: 학생·선생님 누구나 공감할 일상 소재만. 학과(영상·편집·촬영) 전용 소재, 학생만 해당되는 소재(시험·과제·짝꿍 등)는 넣지 않는다.
export const BALANCE = [
  ['탕수육, 평생 한 가지로만', '부먹', '찍먹'],
  ['평생 받는 돈', '지금 당장 1억', '매달 50만 원 평생'],
  ['일하는 방식, 하나만 고른다면?', '주 4일, 대신 하루 10시간', '주 5일, 하루 8시간'],
  ['초능력 하나만', '하루 한 번 시간 정지 1분', '하루 세 번 10초 되감기'],
  ['평생 말투가 하나로 고정된다면?', '모두에게 존댓말만', '모두에게 반말만'],
  ['점심 vs 쉬는 시간', '점심 1시간 반, 쉬는 시간 5분', '점심 30분, 쉬는 시간 15분'],
  ['영화 볼 때 평생 하나만', '모든 영화 스포 당하고 보기', '모든 영화 마지막 10분 못 봄'],
  ['폰 배터리의 저주', '항상 1칸으로 시작', '충전기 줄이 10cm'],
  ['재채기할 때마다…', '\"건강하세요!\" 합창이 들림', '꽃가루가 흩날림'],
  ['잠의 운명', '4시간만 자도 쌩쌩', '10시간 자야 하는데 꿀잠 보장'],
  ['급식의 운명', '매일 맛있는데 양이 절반', '양은 2배, 맛은 그저 그럼'],
  ['공개된다면 덜 창피한 건?', '초등학생 때 일기장', '중학생 때 셀카 폴더'],
  ['하루 시작과 끝', '7시 시작 · 3시 끝', '9시 시작 · 5시 끝'],
  ['한 달 동안 입어야 한다면?', '한여름에 롱패딩', '한겨울에 반팔 반바지'],
  ['하루 동안 가진다면?', '투명인간 되기', '모두의 속마음 들리기'],
  ['내 인생이 영화라면 장르는?', '진지한 공포 영화', 'B급 막장 코미디'],
  ['단톡방에 하나 공개된다면?', '내 검색 기록 1주일 치', '내 사진첩 최근 50장'],
  ['10년 전으로', '기억 그대로 10년 전으로', '그냥 지금 10억 받기'],
  ['더 힘든 건?', '매일 새벽 5시 기상', '매일 새벽 2시 취침'],
  ['평생 콘텐츠 혜택', '영화관 평생 무료, 맨 앞줄만', 'OTT 평생 무료, 광고 5분'],
  ['학교에 하나만 생긴다면?', '24시간 여는 매점', '층마다 안마의자'],
  ['하루 하나씩 해야 한다면?', '아무 데서나 10초 춤추기', '아무 데서나 노래 한 소절'],
  ['여행을 고른다면?', '일본 2박 3일', '제주도 4박 5일'],
  ['동물이랑 대화할 수 있다면?', '고양이 말 알아듣기', '강아지 말 알아듣기'],
  ['머릿속 BGM', '매일 다른 노래가 하루 종일', '같은 노래 하나가 평생'],
  ['방학 vs 매일', '방학 2주 더, 매일 1시간 더', '방학 그대로, 매일 1시간 덜'],
  ['대중교통', '평생 무료, 대신 항상 서서', '항상 앉는데 요금 2배'],
  ['하루만 바꿔 본다면?', '선생님·학생 하루 바꾸기', '하루 동안 교장 선생님'],
  ['할 일이 생기면 나는?', '1주일 전에 끝내고 계속 불안', '마감 직전 폭주, 은근 잘함'],
  ['평생 한 날씨', '평생 여름 방학 날씨', '평생 첫눈 오는 날 날씨'],
  ['드라마 결말', '해피엔딩인데 뻔함', '새드엔딩인데 평생 기억남'],
  ['내 하루에 평생 붙는다면?', '웃음소리 효과음', '다큐 성우 내레이션'],
  ['짜장면 vs 짬뽕, 대신 조건부', '짜장면인데 면이 불어 있음', '짬뽕인데 너무 매움'],
  ['하루 일과', '매일 똑같은 하루', '매일 아침 랜덤 일정'],
  ['내가 한 일에 대한 반응', '칭찬만 하는 100명', '날카롭게 조언하는 1명'],
  ['자리 운명', '1년 내내 같은 옆자리(랜덤)', '옆자리가 매일 바뀜(랜덤)'],
  ['평생 하나만 없어도 된다면?', '돈 걱정', '시간 걱정'],
  ['겨울 vs 여름 간식', '평생 붕어빵 없는 겨울', '평생 빙수 없는 여름'],
  ['라면의 저주', '물 조절 늘 실패', '스프가 늘 반만 들어감'],
  ['하나만 포기한다면?', '에어컨 없는 여름', '난방 없는 겨울'],
  ['한 달 동안 없이 산다면?', '휴대폰 없이 한 달', '인터넷 없이 한 달'],
  ['목소리가 하나로 고정된다면?', '헬륨가스 목소리', '로봇 목소리'],
  ['엘리베이터의 저주', '항상 꽉 차서 못 탐', '항상 모든 층에 섬'],
  ['하루 여행을 간다면?', '과거로 하루', '미래로 하루'],
  ['절대 안 까먹는 능력', '사람 이름', '할 일 목록'],
  ['이사 간다면?', '1분 거리, 대신 집이 좁음', '1시간 거리, 대신 집이 넓음'],
  ['평생 식사', '같은 메뉴, 대신 엄청 맛있음', '매일 랜덤, 가끔 대실패'],
  ['하루 동안 될 수 있다면?', '우리 집 반려동물', '학교 앞 길고양이'],
  ['씻을 때의 저주', '평생 찬물 샤워', '평생 민트 없는 치약'],
  ['노래방의 저주', '음치인데 늘 100점', '노래 잘하는데 늘 0점'],
  ['단체 사진의 저주', '모든 사진에서 눈 감음', '모든 사진에서 흔들림'],
  ['수학여행 숙소', '좋은 숙소, 자유 시간 0', '허름한 숙소, 자유 시간 많음'],
  ['청소 당번', '매일 10분씩', '금요일에 1시간 몰아서'],
  ['비 오는 날의 저주', '우산을 늘 깜빡함', '우산을 늘 잃어버림'],
  ['평생 하나만 못 먹는다면?', '아침밥', '야식'],
  ['답장 습관이 고정된다면?', '모든 답장이 1시간 뒤', '모든 답장이 1초 만에 \"ㅇㅇ\"'],
  ['성격이 고정된다면?', '완전 I(내향)로 고정', '완전 E(외향)로 고정'],
  ['고백했더니…', '답장이 1년 뒤에 옴', '바로 답 오는데 단톡방 생중계'],
  ['급식 줄의 운명', '항상 1등, 대신 메뉴 랜덤', '항상 꼴등, 대신 메뉴 선택'],
  ['아이스크림, 평생 하나만', '민트초코', '그냥 초코'],
];

/* ----- 순서: 월~금만 번호를 매겨 주말에도 질문을 건너뛰지 않게 ----- */
const dayNo = ymd => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) / 86400e3);
const weekdayNo = ymd => { const k = dayNo(ymd) + 3; return Math.floor(k / 7) * 5 + Math.min(k % 7, 4); };   // 1970-01-01(목) 기준, 월=0
// 'YYYYMMDD' → 그날 기본 질문 [질문, A, B]
const START = 14824;   // 2026-10-23(금) = 첫 질문
export const defaultBalance = ymd => BALANCE[(((weekdayNo(ymd) - START) % BALANCE.length) + BALANCE.length) % BALANCE.length];

/* ----- 일정: 한국 시간 ----- */
const KST = 9 * 3600e3, HOUR = 3600e3;
export const OPEN_HOUR = 6;      // 6시 공개
export const GRACE_MIN = 10;     // 마지막 교시가 끝나고 10분 뒤 마감
// 교시별 끝나는 시각(분) — public/js/app.js의 BELL과 같게 유지
export const PERIOD_END = { 1: 550, 2: 610, 3: 670, 4: 730, 5: 830, 6: 890, 7: 950 };
const ymdOf = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const dowOf = ymd => new Date(dayNo(ymd) * 86400e3).getUTCDay();
// 시간표가 없을 때: 월·화·수 7교시, 목·금 6교시
export const defaultLast = ymd => dowOf(ymd) <= 3 ? 7 : 6;

// 지금 보여 줄 밸런스 날짜: 평일 6시 이후면 오늘, 아니면 가장 최근 평일(결과 공개 상태)
export function balDay(t = Date.now()) {
  const k = new Date(t + KST);
  let d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
  const wk = x => x.getUTCDay() % 6 !== 0;
  if (!(wk(d) && k.getUTCHours() >= OPEN_HOUR)) {
    let i = 0;
    do d = new Date(d.getTime() - 86400e3); while (!wk(d) && ++i < 7);
  }
  return ymdOf(d);
}
export const openAt = ymd => dayNo(ymd) * 86400e3 + OPEN_HOUR * HOUR - KST;
export const closeAt = (ymd, last) => dayNo(ymd) * 86400e3 + (PERIOD_END[last] + GRACE_MIN) * 60e3 - KST;
// 다음 질문이 열리는 때 (다음 평일 6시)
export function nextOpen(ymd) {
  let n = dayNo(ymd), i = 0;
  do n++; while (new Date(n * 86400e3).getUTCDay() % 6 === 0 && ++i < 7);
  return n * 86400e3 + OPEN_HOUR * HOUR - KST;
}

/* ----- 그날 마지막 교시: 나이스 학교 전체 시간표의 가장 늦은 교시 (시험·단축 수업 대응) -----
   결과는 balance_days 표에 하루 한 번 저장. 키가 없거나 시간표가 아직 없으면 요일 기본값(저장 안 함, 10분 뒤 다시 확인) */
const SCHOOL = 'ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010795';
const memo = new Map();
export async function lastPeriod(env, db, ymd) {
  const row = await db.prepare('SELECT last FROM balance_days WHERE ymd = ?1').bind(ymd).first();
  if (row) return row.last;
  const m = memo.get(ymd);
  if (m && m.until > Date.now()) return m.last;
  let last = 0;
  if (env.NEIS_KEY) {
    try {
      const r = await fetch(`https://open.neis.go.kr/hub/hisTimetable?Type=json&${SCHOOL}&ALL_TI_YMD=${ymd}&pIndex=1&pSize=1000&KEY=${env.NEIS_KEY}`, { signal: AbortSignal.timeout(5000) });
      const j = r.ok ? await r.json() : null;
      const rows = j?.hisTimetable?.[1]?.row || [];
      for (const x of rows) { const p = +x.PERIO || 0; if (p >= 1 && p <= 7 && p > last) last = p; }
    } catch {}
  }
  if (last) {
    await db.prepare('INSERT OR IGNORE INTO balance_days (ymd, last, at) VALUES (?1, ?2, ?3)').bind(ymd, last, Date.now()).run();
    return last;
  }
  last = defaultLast(ymd);
  memo.set(ymd, { last, until: Date.now() + 600e3 });
  return last;
}
