// 게임 업적(2026-10-28 하율: "모든 게임에 업적 — 스팀처럼 어떤 업적을 달성했는지 볼 수 있게", 미리보기 깃발 'achv')
// 화면(social.js)과 서버(functions/api/s)가 같이 쓴다 — document 등 브라우저 전용 코드 금지.
// 저장: users.ach = JSON { 업적키: 달성 시각(ms) } (v42). 판정은 서버만(achEval) — 기록이 저장된 판(보류 제외)과 scores 표로.
// 종류: hi = 최고 기록이 목표 이상(멀리·높이) · lo = 최고 기록이 목표 이하(빠르게) · days = 서로 다른 날 플레이 · first = 첫 판
//       live = 방금 낸 한 판으로만 판정(지난 기록으로 소급 못 함) · all = 여러 게임에 걸친 것
// 히든(hid) = 달성 전엔 '???'. 게임 하나의 일반(히든 아닌) 업적을 다 모으면 그 게임 칭호(ACH_TITLE)
// 업적 추가: 아래 줄 추가(키는 절대 바꾸지 말 것 — 저장된 값). 새 게임은 ACH_GAMES에도.
import { HOME_MAX, GOAL } from './home-score.js';
import { GEAR_MAX } from './gear-score.js';
import { STAIR_MAX } from './stair-score.js';
import { FILM_MAX } from './film-score.js';
import { BLAST_MAX } from './blast-score.js';
import { SNAKE_MAX, N2_MAX } from './cz-score.js';

export const ACH_FF = 'achv';
export const ACH_GAMES = ['film', 'home', 'stair', 'cut', 'reaction', 'num25', 'gear', 'blast'];   // 게임 화면 순서와 같게(gearn 기록은 gear로 셈)
// 저장값(작을수록 좋음) → 화면 단위
export const nat = (g, v) => g === 'home' ? HOME_MAX - v : g === 'gear' || g === 'gearn' ? GEAR_MAX - v : g === 'stair' ? STAIR_MAX - v : g === 'film' ? FILM_MAX - v : g === 'blast' ? BLAST_MAX - v : g === 'snake' ? SNAKE_MAX - v : g === 'n2048' ? N2_MAX - v : v;

const A = (k, g, lv, n, d, x = {}) => ({ k, g, lv, n, d, ...x });
// lv: 1 브론즈 · 2 실버 · 3 골드 · 4 무지개(최상)
export const ACH = [
  // 공통
  A('a_try', 'all', 1, '맛보기 장인', '열려 있는 게임을 모두 한 판씩 해 보기', { t: 'all' }),
  A('a_days', 'all', 2, '쉬는 시간 단골', '서로 다른 10일 동안 게임하기', { t: 'alldays', v: 10 }),
  A('a_top3', 'all', 3, '명예의 전당', '아무 게임에서나 전체 순위 3등 안에 들기', { t: 'live' }),
  A('a_night', 'all', 2, '새벽 게이머', '새벽 2~5시에 기록 남기기', { t: 'live', hid: 1 }),
  // 2026-10-30 하율 "업적 수 늘리고, 이름은 위트있게, 특이한 조건은 ??? 로" — 공통 추가
  A('a_d30', 'all', 3, '쉬는 시간 개근상', '서로 다른 30일 동안 게임하기', { t: 'alldays', v: 30 }),
  A('a_d60', 'all', 4, '이 정도면 출석부', '서로 다른 60일 동안 게임하기', { t: 'alldays', v: 60 }),
  A('a_lunch', 'all', 2, '밥은 먹고 하는 거지?', '점심시간(12:10~13:00)에 기록 남기기', { t: 'live', hid: 1 }),
  A('a_mon', 'all', 2, '월요병 응급처치', '월요일 아침 8시 전에 기록 남기기', { t: 'live', hid: 1 }),
  A('a_fri', 'all', 1, '불금 예열 중', '금요일 오후 4시 넘어서 기록 남기기', { t: 'live', hid: 1 }),
  A('a_sun', 'all', 1, '주말에도 등교', '일요일에 기록 남기기', { t: 'live', hid: 1 }),
  A('a_cin', 'all', 3, '신데렐라', '밤 12시 정각(0시 0분)에 기록 남기기', { t: 'live', hid: 1 }),
  A('a_777', 'all', 3, '럭키 세븐', '기록이 7·77·777처럼 7로만 된 숫자로 끝나기', { t: 'live', hid: 1 }),
  A('a_arc', 'all', 3, '하루 종일 오락실', '하루에 열려 있는 게임을 전부 하기', { t: 'live', hid: 1 }),
  A('a_hw', 'all', 2, '트릭 오어 게임', '할로윈(10월 31일)에 기록 남기기', { t: 'live', hid: 1 }),
  // 집에 가고 싶어! (m)
  A('h_1', 'home', 1, '하교 시작', '첫 판 달리기', { t: 'first' }),
  A('h_2', 'home', 1, '교문 통과', '1,000m 달리기', { t: 'hi', v: 1000 }),
  A('h_3', 'home', 2, '버스 정류장', '5,000m 달리기', { t: 'hi', v: 5000 }),
  A('h_4', 'home', 3, '반은 왔다', '25,000m 달리기', { t: 'hi', v: 25000 }),
  A('h_5', 'home', 4, '현관문 앞', `${GOAL.toLocaleString('en-US')}m — 집에 도착하기`, { t: 'hi', v: GOAL }),
  A('h_6', 'home', 2, '매일매일 하교', '서로 다른 5일 동안 달리기', { t: 'days', v: 5 }),
  A('h_x', 'home', 1, '신발끈이…', '30m도 못 가고 넘어지기', { t: 'live', hid: 1 }),
  A('h_7', 'home', 2, '편의점 들렀다 가기', '10,000m 달리기', { t: 'hi', v: 10000 }),
  A('h_y', 'home', 3, '도어락 비번 까먹음', '집 1,000m 앞(49,000m 넘어서)에서 넘어지기', { t: 'live', hid: 1 }),
  A('h_z', 'home', 2, '100m 국가대표', '딱 100m에서 넘어지기', { t: 'live', hid: 1 }),
  // 필름 10 (컷, 2026-10-29)
  A('f_1', 'film', 1, '첫 컷', '첫 판 자르기', { t: 'first' }),
  A('f_2', 'film', 1, '컷 편집 입문', '한 판에 40컷 자르기', { t: 'hi', v: 40 }),
  A('f_3', 'film', 2, '러프컷 완성', '한 판에 70컷 자르기', { t: 'hi', v: 70 }),
  A('f_4', 'film', 3, '파인컷 완성', '한 판에 100컷 자르기', { t: 'hi', v: 100 }),
  A('f_5', 'film', 4, '파이널 컷', '한 판에 150컷 자르기 — 새 판까지 쉬지 않고', { t: 'hi', v: 150 }),
  A('f_6', 'film', 2, '매일 편집실', '서로 다른 5일 동안 자르기', { t: 'days', v: 5 }),
  A('f_x', 'film', 1, '가위가 무뎌', '10컷도 못 자르고 끝나기', { t: 'live', hid: 1 }),
  A('f_y', 'film', 2, '십진법의 수호자', '게퍼 10에서 딱 10컷만 자르기', { t: 'live', hid: 1 }),
  A('f_z', 'film', 2, '롱테이크 장인', '딱 1컷만 자르고 끝나기 — 컷은 최소한으로', { t: 'live', hid: 1 }),
  // 영상고 계단 오르기 (칸)
  A('s_1', 'stair', 1, '첫 계단', '첫 판 오르기', { t: 'first' }),
  A('s_2', 'stair', 1, '2층 도착', '100칸 오르기', { t: 'hi', v: 100 }),
  A('s_3', 'stair', 2, '4층 교실', '300칸 오르기', { t: 'hi', v: 300 }),
  A('s_4', 'stair', 3, '옥상 정복', '700칸 — 옥상까지 오르기', { t: 'hi', v: 700 }),
  A('s_5', 'stair', 4, '구름 위로', '1,100칸 오르기', { t: 'hi', v: 1100 }),
  A('s_6', 'stair', 2, '오늘도 계단', '서로 다른 5일 동안 오르기', { t: 'days', v: 5 }),
  A('s_x', 'stair', 1, '헛디딤', '세 칸도 못 오르고 떨어지기', { t: 'live', hid: 1 }),
  A('s_7', 'stair', 2, '숨이 턱 끝까지', '500칸 오르기', { t: 'hi', v: 500 }),
  A('s_y', 'stair', 2, '2층 문 앞에서 돌아섬', '딱 99칸에서 떨어지기', { t: 'live', hid: 1 }),
  A('s_z', 'stair', 3, '옥상 문이 잠겼다', '딱 699칸 — 옥상 한 칸 앞에서 떨어지기', { t: 'live', hid: 1 }),
  // 컷 타이밍(편집의 신) (오차 합 ms)
  A('c_1', 'cut', 1, '첫 컷', '첫 판 자르기', { t: 'first' }),
  A('c_2', 'cut', 1, '편집 입문', '오차 합 300ms 안으로', { t: 'lo', v: 300 }),
  A('c_3', 'cut', 2, '칼같은 컷', '오차 합 150ms 안으로', { t: 'lo', v: 150 }),
  A('c_4', 'cut', 3, '프레임 장인', '오차 합 70ms 안으로', { t: 'lo', v: 70 }),
  A('c_5', 'cut', 4, '0프레임', '한 번이라도 오차 0ms로 자르기', { t: 'live' }),
  A('c_6', 'cut', 2, '마감 지옥', '서로 다른 5일 동안 편집하기', { t: 'days', v: 5 }),
  A('c_x', 'cut', 1, '감으로 컷', '5번 모두 0.3초 넘게 빗나가기', { t: 'live', hid: 1 }),
  A('c_7', 'cut', 4, '프레임 단위 인간', '오차 합 40ms 안으로', { t: 'lo', v: 40, ch: 1 }),
  A('c_y', 'cut', 3, '데칼코마니', '5번 모두 똑같은 오차(ms)로 자르기', { t: 'live', hid: 1 }),
  A('c_z', 'cut', 2, '마지막에 손이 미끄러짐', '4번은 10ms 안, 1번은 0.3초 넘게 빗나가기', { t: 'live', hid: 1 }),
  // 반응속도 (평균 ms)
  A('r_1', 'reaction', 1, '준비 완료', '첫 판 하기', { t: 'first' }),
  A('r_2', 'reaction', 1, '눈치 빠름', '평균 300ms 안으로', { t: 'lo', v: 300 }),
  A('r_3', 'reaction', 2, '번개 손', '평균 250ms 안으로', { t: 'lo', v: 250 }),
  A('r_4', 'reaction', 3, '빛의 속도', '평균 200ms 안으로', { t: 'lo', v: 200 }),
  A('r_5', 'reaction', 2, '참을성 만렙', '부정출발 없이 5번 모두 0.3초 안에 누르기', { t: 'live' }),
  A('r_6', 'reaction', 2, '반사신경 훈련', '서로 다른 5일 동안 하기', { t: 'days', v: 5 }),
  A('r_x', 'reaction', 1, '잠깐 졸았어', '5번 모두 시간 초과', { t: 'live', hid: 1 }),
  A('r_7', 'reaction', 4, '총알 피하는 중', '평균 170ms 안으로', { t: 'lo', v: 170, ch: 1 }),
  A('r_y', 'reaction', 2, '복붙한 손가락', '한 판에 똑같은 ms가 두 번 나오기', { t: 'live', hid: 1 }),
  A('r_z', 'reaction', 1, '느긋한 오후', '5번 모두 0.6초~1.5초 사이로 누르기', { t: 'live', hid: 1 }),
  // 1 to 25 (ms)
  A('n_1', 'num25', 1, '1부터 시작', '첫 판 하기', { t: 'first' }),
  A('n_2', 'num25', 1, '숫자 찾기', '20초 안에 25까지', { t: 'lo', v: 20000 }),
  A('n_3', 'num25', 2, '눈이 빠름', '15초 안에 25까지', { t: 'lo', v: 15000 }),
  A('n_4', 'num25', 3, '숫자 사냥꾼', '10초 안에 25까지', { t: 'lo', v: 10000 }),
  A('n_5', 'num25', 2, '실수 제로', '한 번도 안 틀리고 25까지', { t: 'live' }),
  A('n_6', 'num25', 2, '매일 1부터', '서로 다른 5일 동안 하기', { t: 'days', v: 5 }),
  A('n_x', 'num25', 1, '천천히 꼼꼼히', '1분 넘게 걸려서 25까지', { t: 'live', hid: 1 }),
  A('n_7', 'num25', 4, '눈에 레이더 달림', '7초 안에 25까지', { t: 'lo', v: 7000, ch: 1 }),
  A('n_y', 'num25', 2, '숫자랑 안 친함', '한 판에 10번 넘게 틀리기', { t: 'live', hid: 1 }),
  A('n_z', 'num25', 2, '이름값 하는 중', '딱 25초대(25.0~25.9초)에 끝내기', { t: 'live', hid: 1 }),
  // 기자재 정리! (랭킹전 점수 · 일반 모드도 판·날짜·한 판 업적은 셈)
  A('g_1', 'gear', 1, '정리 시작', '첫 판 하기', { t: 'first' }),
  A('g_2', 'gear', 1, '선반 정리', '타임어택 3,000점', { t: 'hi', v: 3000 }),
  A('g_3', 'gear', 2, '장비 담당', '타임어택 10,000점', { t: 'hi', v: 10000 }),
  A('g_4', 'gear', 3, '기자재실 주인', '타임어택 25,000점', { t: 'hi', v: 25000 }),
  A('g_5', 'gear', 2, '말끔하게', '한 판에 20줄 지우기', { t: 'live' }),
  A('g_6', 'gear', 2, '반납 담당', '서로 다른 5일 동안 정리하기', { t: 'days', v: 5 }),
  A('g_x', 'gear', 1, '일단 쌓고 보자', '블록 20개 넘게 놓고 한 줄도 못 지우기', { t: 'live', hid: 1 }),
  A('g_7', 'gear', 4, '창고 대방출', '타임어택 50,000점', { t: 'hi', v: 50000, ch: 1 }),
  A('g_y', 'gear', 2, '딱 한 줄의 기적', '블록 30개 넘게 놓고 딱 한 줄만 지우기', { t: 'live', hid: 1 }),
  // LED 월 켜기! (점수, 2026-10-29 · 2026-10-30 카메라 가방 → LED 월 컨셉, 업적 이름도 변경) — 한 판 업적은 서버가 판을 다시 둬 본 결과(live.x: combo·wipe·n)로
  A('b_1', 'blast', 1, '첫 송출', '첫 판 하기', { t: 'first' }),
  A('b_2', 'blast', 1, 'LED 기사', '1,000점 넘게 정리하기', { t: 'hi', v: 1000 }),
  A('b_3', 'blast', 2, '송출 감독', '3,000점 넘게 정리하기', { t: 'hi', v: 3000 }),
  A('b_4', 'blast', 3, '풀 HD 마스터', '8,000점 넘게 정리하기', { t: 'hi', v: 8000 }),
  A('b_5', 'blast', 4, '전광판의 전설', '15,000점 넘게 정리하기', { t: 'hi', v: 15000 }),
  A('b_7', 'blast', 2, '연속 송출', '한 판에 15번 연속 정리하기', { t: 'live' }),
  A('b_6', 'blast', 2, '매일 점등', '서로 다른 5일 동안 정리하기', { t: 'days', v: 5 }),
  A('b_x', 'blast', 1, '검은 화면', '한 판에 벽을 싹 비우기', { t: 'live', hid: 1 }),
  A('b_8', 'blast', 3, '조명 감독 호출', '한 판에 25번 연속 정리하기', { t: 'live', ch: 1 }),
  A('b_y', 'blast', 2, '방송 사고', '패널 6번도 못 놓고 끝나기', { t: 'live', hid: 1 }),
];
export const ACH_BY = Object.fromEntries(ACH.map(a => [a.k, a]));
// 게임 하나의 일반 업적을 다 모으면 받는 칭호(프로필 꾸미기 칭호 목록)
export const ACH_TITLE = { film: '편집실 터줏대감', home: '하교의 달인', stair: '계단 정복자', cut: '컷의 장인', reaction: '반사신경 끝판왕', num25: '숫자 탐정', gear: '정리의 신', blast: '정리정돈 끝판왕' };
export const achOf = g => ACH.filter(a => a.g === g);
// ch = 도전 업적(최상위 기록) — 칭호 조건에서 뺌(2026-10-30, 칭호가 사실상 불가능해지지 않게)
export const titleDone = (g, own) => achOf(g).filter(a => !a.hid && !a.ch).every(a => own[a.k]);
export const achTitles = own => Object.keys(ACH_TITLE).filter(g => titleDone(g, own)).map(g => ACH_TITLE[g]);
export const ACH_TITLES = Object.values(ACH_TITLE);
export const parseAch = s => { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };

// 한 판 업적: r = 판 기록(서버 checkRounds를 통과한 형식), v = 저장값
function liveOk(k, g, v, r, x) {
  const n = (r || []).map(x => Math.round(+x));
  switch (k) {
    case 'h_x': return g === 'home' && nat(g, v) < 30;
    case 's_x': return g === 'stair' && nat(g, v) < 3;
    case 'f_x': return g === 'film' && nat(g, v) < 10;
    case 'c_5': return g === 'cut' && n.length === 5 && n.some(x => x === 0);
    case 'c_x': return g === 'cut' && n.length === 5 && n.every(x => x > 300);
    case 'r_5': { if (g !== 'reaction') return false; const f = n.length === 6 ? n[5] : 0, t = n.slice(0, 5); return f === 0 && t.length === 5 && t.every(x => x < 300); }
    case 'r_x': return g === 'reaction' && n.slice(0, 5).length === 5 && n.slice(0, 5).every(x => x >= 1500);
    case 'n_5': return g === 'num25' && n.length === 26 && n[25] === 0;
    case 'n_x': return g === 'num25' && v > 60000;
    case 'g_5': return (g === 'gear' || g === 'gearn') && n.length === 4 && n[1] >= 20;
    case 'g_x': return (g === 'gear' || g === 'gearn') && n.length === 4 && n[1] === 0 && n[2] > 20;
    case 'b_7': return g === 'blast' && !x?.err && (x?.combo || 0) >= 15;
    case 'b_x': return g === 'blast' && !x?.err && (x?.wipe || 0) >= 1;
    // 2026-10-30 추가
    case 'h_y': return g === 'home' && nat(g, v) >= GOAL - 1000 && nat(g, v) < GOAL;
    case 'h_z': return g === 'home' && nat(g, v) === 100;
    case 'f_y': return g === 'film' && nat(g, v) === 10;
    case 'f_z': return g === 'film' && nat(g, v) === 1;
    case 's_y': return g === 'stair' && nat(g, v) === 99;
    case 's_z': return g === 'stair' && nat(g, v) === 699;
    case 'c_y': return g === 'cut' && n.length === 5 && n[0] > 0 && n.every(x => x === n[0]);
    case 'c_z': { if (g !== 'cut' || n.length !== 5) return false; const s = [...n].sort((a, b) => a - b); return s.slice(0, 4).every(x => x <= 10) && s[4] > 300; }
    case 'r_y': { if (g !== 'reaction') return false; const t = n.slice(0, 5).filter(x => x > 0 && x < 1500); return t.length >= 2 && new Set(t).size < t.length; }
    case 'r_z': return g === 'reaction' && n.slice(0, 5).length === 5 && n.slice(0, 5).every(x => x >= 600 && x < 1500);
    case 'n_y': return g === 'num25' && n.length === 26 && n[25] >= 10;
    case 'n_z': return g === 'num25' && v >= 25000 && v < 26000;
    case 'g_y': return (g === 'gear' || g === 'gearn') && n.length === 4 && n[1] === 1 && n[2] >= 30;
    case 'b_8': return g === 'blast' && !x?.err && (x?.combo || 0) >= 25;
    case 'b_y': return g === 'blast' && !x?.err && (x?.n || 0) > 0 && x.n < 6;
  }
  return false;
}
const gOf = g => g === 'gearn' ? 'gear' : g;
// 공통 한 판 업적(2026-10-30): live = { hour, min, dow(0=일), md('MMDD'), game, v } · st.T = 오늘 한 게임 목록
const sevens = x => x > 0 && /^7+$/.test(String(x));
function allLive(k, l, st) {
  const tm = l.hour * 60 + l.min;
  switch (k) {
    case 'a_lunch': return l.dow >= 1 && l.dow <= 5 && tm >= 12 * 60 + 10 && tm < 13 * 60;
    case 'a_mon': return l.dow === 1 && l.hour >= 5 && l.hour < 8;
    case 'a_fri': return l.dow === 5 && l.hour >= 16;
    case 'a_sun': return l.dow === 0;
    case 'a_cin': return l.hour === 0 && l.min === 0;
    case 'a_777': { const v = nat(l.game, l.v); return sevens(Math.round(v)); }
    case 'a_arc': return (st.open || []).length > 1 && st.open.every(g => (st.T || []).includes(g));
    case 'a_hw': return l.md === '1031';
  }
  return false;
}

// 판정. st = { best: {게임: 화면 단위 최고(gear는 랭킹전만)}, days: {게임: 날 수}, D: 전체 게임한 날 수, open: [열려 있는 게임] }
// live = 방금 저장된 판 { game, v, r, rank, hour } 또는 null(소급). 돌려줌: 새로 달성한 키 목록
export function achCheck(own, st, live) {
  const got = [];
  for (const a of ACH) {
    if (own[a.k]) continue;
    let ok = false;
    const b = st.best[a.g], d = st.days[a.g] || 0;
    if (a.t === 'first') ok = d >= 1;
    else if (a.t === 'hi') ok = b != null && b >= a.v;
    else if (a.t === 'lo') ok = b != null && b <= a.v;
    else if (a.t === 'days') ok = d >= a.v;
    else if (a.t === 'alldays') ok = (st.D || 0) >= a.v;
    else if (a.t === 'all') ok = st.open.length > 0 && st.open.every(g => (st.days[g] || 0) >= 1);
    else if (a.t === 'live' && live) {
      if (a.k === 'a_top3') ok = live.rank != null && live.rank <= 3;
      else if (a.k === 'a_night') ok = live.hour >= 2 && live.hour < 5;
      else if (a.k.startsWith('a_') && live.dow != null) ok = allLive(a.k, live, st);
      else ok = a.g === gOf(live.game) && liveOk(a.k, live.game, live.v, live.r, live.x);
    }
    if (ok) got.push(a.k);
  }
  return got;
}
// 화면용 진행도 [지금, 목표] (없으면 null)
export function achProg(a, st) {
  if (!st) return null;
  const b = st.best?.[a.g], d = st.days?.[a.g] || 0;
  if (a.t === 'hi') return [Math.min(b || 0, a.v), a.v];
  if (a.t === 'days') return [Math.min(d, a.v), a.v];
  if (a.t === 'alldays') return [Math.min(st.D || 0, a.v), a.v];
  if (a.t === 'all') return [(st.open || []).filter(g => (st.days[g] || 0) >= 1).length, (st.open || []).length];
  return null;
}

/* ===== 게임 숙련도(2026-10-29 → 2026-10-30 하율 "업적이랑 숙련도를 살짝 분리, 롤 느낌으로" → "점수 구간 비례 + 첫 판 보너스" — 깃발 mastery, 업적 achv와 따로) =====
   롤 챔피언 숙련도처럼: 게임마다 판을 할수록 쌓이고 내려가지 않음. 업적·티어와 XP를 주고받지 않음. 모두 Lv.1부터(소급 없음).
   판 등급 = 이번 판 점수가 그 게임 전체 학생(최고 기록) 중 어디인지: 상위 10% S+ 40 · 25% S 32 · 50% A 24 · 75% B 17 · 그 밑 C 12 XP (참가 5명 미만이면 A)
   + 그 게임 그날 첫 판 보너스 30 XP. 1판 기준(mission.js playCounts)을 넘은 판만 · 등급 XP는 한 게임 하루 300까지(첫 판 보너스는 따로)
   Lv 1~50, 10레벨마다 단계(입문·숙련·베테랑·장인·마스터·레전드) · 숙련도 점수 = 해 본 게임 레벨 합(롤 숙련도 점수)
   저장: users.mst = { 게임: [XP, 마지막 판 날(YYYYMMDD), 그날 등급 XP, S 이상 횟수, 최근 등급] } — gearn은 gear로 */
export const MST_FF = 'mastery';
export const MST_GAMES = [...ACH_GAMES, 'mine', 'snake', 'n2048'];
export const MST_MAX = 50;
export const MST_GR = [['S+', 40, '전체 학생 중 상위 10%'], ['S', 32, '상위 25%'], ['A', 24, '상위 50%'], ['B', 17, '상위 75%'], ['C', 12, '그 밑']];
const GR_XP = Object.fromEntries(MST_GR.map(x => [x[0], x[1]]));
export const MST_XP = { dayCap: 300, first: 30, minN: 5 };
export const MST_BAND = [
  { from: 1, k: 'm0', n: '입문' }, { from: 10, k: 'm1', n: '숙련' }, { from: 20, k: 'm2', n: '베테랑' },
  { from: 30, k: 'm3', n: '장인' }, { from: 40, k: 'm4', n: '마스터' }, { from: 50, k: 'm5', n: '레전드' },
];
const mNeed = L => 40 + 12 * (L - 1);   // L → L+1에 필요한 XP (Lv10 ≈ 800 · Lv20 ≈ 2,800 · Lv30 ≈ 6,000 · Lv40 ≈ 10,300 · Lv50 ≈ 16,100)
export function mstLv(xp) {
  let L = 1, x = Math.max(0, Math.floor(xp || 0));
  while (L < MST_MAX && x >= mNeed(L)) { x -= mNeed(L); L++; }
  return { lv: L, cur: L < MST_MAX ? x : 0, need: L < MST_MAX ? mNeed(L) : 0 };
}
export const mstBand = lv => MST_BAND.filter(b => lv >= b.from).pop();
export const mstXp = (m, g) => Math.max(0, +(m?.[g]?.[0]) || 0);
// 판 등급: better = 이 판보다 최고 기록이 좋은 학생 수, n = 그 게임 학생 수(나 포함, 개발자 제외)
export function mstGrade(better, n) {
  if (!(n >= MST_XP.minN)) return 'A';
  const p = better / n;
  return p < 0.1 ? 'S+' : p < 0.25 ? 'S' : p < 0.5 ? 'A' : p < 0.75 ? 'B' : 'C';
}
// 판 하나로 얻는 XP(등급 XP + 첫 판 보너스)를 더한 새 값. add = { play: 1판으로 침, gr: 등급 } · day = 오늘(YYYYMMDD)
export function mstAdd(m, g, add, day) {
  if (!add.play) return m;
  g = g === 'gearn' ? 'gear' : g;
  const o = { ...m }, cur = Array.isArray(o[g]) ? [...o[g]] : [0, '', 0, 0, ''];
  const fb = cur[1] !== day ? MST_XP.first : 0;   // 그 게임 그날 첫 판 보너스
  if (fb) { cur[1] = day; cur[2] = 0; }
  const p = Math.max(0, Math.min(GR_XP[add.gr] || 12, MST_XP.dayCap - (+cur[2] || 0)));
  cur[0] = (+cur[0] || 0) + p + fb; cur[2] = (+cur[2] || 0) + p;
  cur[3] = (+cur[3] || 0) + (add.gr === 'S+' || add.gr === 'S' ? 1 : 0); cur[4] = add.gr || '';
  o[g] = cur;
  return o;
}
// 숙련도 점수(롤 숙련도 점수): 해 본 게임 레벨 합
export const mstScore = (m, gs = MST_GAMES) => gs.reduce((a, g) => a + (mstXp(m, g) > 0 ? mstLv(mstXp(m, g)).lv : 0), 0);
