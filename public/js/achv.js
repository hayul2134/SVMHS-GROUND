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
import { CHASE_MAX } from './chase-score.js';
import { DANCE_MAX } from './dance-score.js';
import { SNAKE_MAX, N2_MAX } from './cz-score.js';
import { COLOR_MAX, accOf, rgb2hsv } from './color-score.js';

export const ACH_FF = 'achv';
export const ACH_GAMES = ['color', 'dance','chase', 'film', 'home', 'stair', 'cut', 'reaction', 'num25', 'gear', 'blast'];   // 게임 화면 순서와 같게(gearn 기록은 gear로 셈)
// 저장값(작을수록 좋음) → 화면 단위
export const nat = (g, v) => g === 'home' ? HOME_MAX - v : g === 'gear' || g === 'gearn' ? GEAR_MAX - v : g === 'stair' ? STAIR_MAX - v : g === 'film' ? FILM_MAX - v : g === 'blast' ? BLAST_MAX - v : g === 'chase' ? CHASE_MAX - v : g === 'dance' ? DANCE_MAX - v : g === 'snake' ? SNAKE_MAX - v : g === 'n2048' ? N2_MAX - v : g === 'color' ? Math.round((COLOR_MAX - v) / 5) : v;   // 색감의 신: 평균 정확도(0.1% 단위, 0~1000)

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
  A('f_2', 'film', 1, '컷 편집 입문', '한 판에 테이프 40개 자르기', { t: 'hi', v: 40 }),
  A('f_3', 'film', 2, '러프컷 완성', '한 판에 테이프 70개 자르기', { t: 'hi', v: 70 }),
  A('f_4', 'film', 3, '파인컷 완성', '한 판에 테이프 100개 자르기', { t: 'hi', v: 100 }),
  A('f_5', 'film', 4, '파이널 컷', '한 판에 테이프 150개 자르기 — 새 판까지 쉬지 않고', { t: 'hi', v: 150 }),
  A('f_6', 'film', 2, '매일 편집실', '서로 다른 5일 동안 자르기', { t: 'days', v: 5 }),
  A('f_x', 'film', 1, '가위가 무뎌', '테이프 10개도 못 자르고 끝나기', { t: 'live', hid: 1 }),
  A('f_y', 'film', 2, '십진법의 수호자', '게퍼 10에서 테이프 딱 10개만 자르기', { t: 'live', hid: 1 }),
  A('f_z', 'film', 2, '롱테이크 장인', '딱 한 번(테이프 2개)만 자르고 끝나기 — 컷은 최소한으로', { t: 'live', hid: 1 }),
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
  A('b_2', 'blast', 1, 'LED 기사', '10,000점 넘게 정리하기', { t: 'hi', v: 10000 }),
  A('b_3', 'blast', 2, '송출 감독', '30,000점 넘게 정리하기', { t: 'hi', v: 30000 }),
  A('b_4', 'blast', 3, '풀 HD 마스터', '80,000점 넘게 정리하기', { t: 'hi', v: 80000 }),
  A('b_5', 'blast', 4, '전광판의 전설', '150,000점 넘게 정리하기', { t: 'hi', v: 150000 }),
  A('b_7', 'blast', 2, '연속 송출', '한 판에 15번 연속 정리하기', { t: 'live' }),
  A('b_6', 'blast', 2, '매일 점등', '서로 다른 5일 동안 정리하기', { t: 'days', v: 5 }),
  A('b_x', 'blast', 1, '검은 화면', '한 판에 벽을 싹 비우기', { t: 'live', hid: 1 }),
  A('b_8', 'blast', 3, '조명 감독 호출', '한 판에 25번 연속 정리하기', { t: 'live', ch: 1 }),
  A('b_y', 'blast', 2, '방송 사고', '패널 6번도 못 놓고 끝나기', { t: 'live', hid: 1 }),
  // 카체이싱! (점수) — 2026-10-31. 키는 저장값이라 바꾸지 말 것
  A('ch_1', 'chase', 1, '시동 걸기', '첫 판 달리기', { t: 'first' }),
  A('ch_2', 'chase', 1, '리허설 통과', '3,000점 넘게 달리기', { t: 'hi', v: 3000 }),
  A('ch_3', 'chase', 2, '본 촬영 OK', '10,000점 넘게 달리기', { t: 'hi', v: 10000 }),
  A('ch_4', 'chase', 3, '스턴트 감독', '20,000점 넘게 달리기', { t: 'hi', v: 20000 }),
  A('ch_5', 'chase', 4, '할리우드 데뷔', '35,000점 넘게 달리기', { t: 'hi', v: 35000 }),
  A('ch_6', 'chase', 2, '매일 출근하는 스턴트맨', '서로 다른 5일 동안 달리기', { t: 'days', v: 5 }),
  A('ch_7', 'chase', 2, '아슬아슬 장인', '한 판에 아슬아슬 콤보 x10 만들기', { t: 'live' }),
  A('ch_8', 'chase', 3, '컷 없이 원테이크', '한 판에 아슬아슬 콤보 x15 만들기', { t: 'live', ch: 1 }),
  A('ch_x', 'chase', 1, '출발하자마자 컷!', '100m도 못 가고 부딪히기', { t: 'live', hid: 1 }),
  A('ch_y', 'chase', 2, '주유 경고등 무시', '기름이 떨어져서 멈추기', { t: 'live', hid: 1 }),
  A('ch_z', 'chase', 2, '도로 위 볼링', '한 판에 부스터로 차 30대 날려 버리기', { t: 'live', hid: 1 }),   // 2026-11-02 10 → 30(봇 판 절반이 16대 넘게 날림)
  // 2026-11-02 출시 전 추가(슬립스트림·점프대·연료 — 봇 42판 분포로 기준: 슬립 점수 중앙 1,484·90% 2,150 / 점프대 중앙 1·최대 4 / 연료통 90% 4 / 거리 90% 8,058m)
  A('ch_r', 'chase', 1, '스턴트 데뷔', '사다리차 점프대로 날아오르기', { t: 'live' }),
  A('ch_9', 'chase', 2, '바람 타는 법', '한 판에 슬립스트림으로 2,000점 더 얻기', { t: 'live' }),
  A('ch_f', 'chase', 2, '주유소 VIP', '한 판에 연료통 5개 먹기', { t: 'live' }),
  A('ch_m', 'chase', 3, '고속도로 완주', '한 판에 10,000m 넘게 달리기', { t: 'live' }),
  A('ch_r2', 'chase', 3, '하늘길 개통', '한 판에 점프대 4번 타기', { t: 'live', ch: 1 }),
  A('ch_w', 'chase', 1, '직진 본능', '차선을 한 번도 안 바꾸고 500m 넘게 달리기', { t: 'live', hid: 1 }),
  A('ch_v', 'chase', 2, '부스터 중독', '한 판에 부스터 8번 켜기', { t: 'live', hid: 1 }),
  // 선생님 몰래 춤추기 (점수) — 2026-10-31. 키는 저장값이라 바꾸지 말 것
  A('dc_1', 'dance', 1, '첫 스텝', '첫 판 춤추기', { t: 'first' }),
  A('dc_2', 'dance', 1, '뒷자리 댄서', '300점 넘게 춤추기', { t: 'hi', v: 300 }),   // 2026-11-02 23:24 하율 "업적이랑 숙련도 만들어서 넣어" → 사람 기록(개발자 최고 570점) 기준으로 다시 맞춤(전: 500·2,000·4,000·6,500)
  A('dc_3', 'dance', 2, '쉬는 시간 스타', '1,000점 넘게 춤추기', { t: 'hi', v: 1000 }),
  A('dc_4', 'dance', 3, '교실 아이돌', '2,000점 넘게 춤추기', { t: 'hi', v: 2000 }),
  A('dc_5', 'dance', 4, '전설의 수업 댄서', '3,500점 넘게 춤추기', { t: 'hi', v: 3500 }),
  A('dc_6', 'dance', 2, '매일 몰래 연습', '서로 다른 5일 동안 춤추기', { t: 'days', v: 5 }),
  A('dc_7', 'dance', 2, '피버 타임', '한 판에 배율 x4 만들기', { t: 'live' }),
  A('dc_8', 'dance', 3, '눈치 백단', '한 판에 세이프 8번', { t: 'live', ch: 1 }),
  A('dc_9', 'dance', 2, '종 칠 때까지', '한 판에 1분 넘게 버티기', { t: 'live' }),
  A('dc_a', 'dance', 3, '한 교시 통째로', '한 판에 2분 넘게 버티기', { t: 'live', ch: 1 }),
  A('dc_b', 'dance', 2, '쉬지 않는 몸', '한 판에 30초 넘게 춤추기(멈춘 시간 빼고)', { t: 'live' }),
  A('dc_x', 'dance', 1, '첫 수업부터 교무실', '시작 10초 안에 걸리기', { t: 'live', hid: 1 }),
  A('dc_y', 'dance', 2, '꿈나라 직행', '졸다가 걸리기', { t: 'live', hid: 1 }),
  A('dc_z', 'dance', 2, '번쩍 기상', '졸음이 거의 다 찼다가 춤추고 다시 깨기', { t: 'live', hid: 1 }),
  // 색감의 신(2026-11-02 23:25 하율 "업적이랑 숙련도 만들어서 넣어") — 기록 단위 = 평균 정확도(nat, 0.1%)
  A('co_1', 'color', 1, '첫 스포이트', '첫 판 색 맞히기', { t: 'first' }),
  A('co_2', 'color', 1, '팔레트 입문', '평균 70% 넘게 맞히기', { t: 'hi', v: 700 }),
  A('co_3', 'color', 2, '색보정 수습', '평균 85% 넘게 맞히기', { t: 'hi', v: 850 }),
  A('co_4', 'color', 3, '컬러리스트', '평균 90% 넘게 맞히기', { t: 'hi', v: 900 }),
  A('co_5', 'color', 4, '인간 스포이트', '평균 95% 넘게 맞히기', { t: 'hi', v: 950 }),
  A('co_6', 'color', 2, '매일 색 보는 눈', '서로 다른 5일 동안 색 맞히기', { t: 'days', v: 5 }),
  A('co_7', 'color', 2, '한 끗 차이', '한 판 5번 중 한 색이라도 98% 넘게 맞히기', { t: 'live' }),
  A('co_8', 'color', 3, '흔들림 없는 눈', '한 판 5번 모두 90% 넘게 맞히기', { t: 'live', ch: 1 }),
  A('co_x', 'color', 1, '보색 대마왕', '정답과 정반대 색 고르기', { t: 'live', hid: 1 }),
  A('co_y', 'color', 2, '흑백 영화 감독', '한 판 5번 모두 무채색(회색 계열) 고르기', { t: 'live', hid: 1 }),
  A('co_z', 'color', 2, '딱 80점', '평균 정확히 80.0% 맞히기', { t: 'live', hid: 1 }),
];
export const ACH_BY = Object.fromEntries(ACH.map(a => [a.k, a]));
// 게임 하나의 일반 업적을 다 모으면 받는 칭호(프로필 꾸미기 칭호 목록)
export const ACH_TITLE = { film: '편집실 터줏대감', home: '하교의 달인', stair: '계단 정복자', cut: '컷의 장인', reaction: '반사신경 끝판왕', num25: '숫자 탐정', gear: '정리의 신', blast: '정리정돈 끝판왕', chase: '카체이싱 스턴트맨', dance: '몰래 댄스왕', color: '걸어 다니는 팔레트' };
export const achOf = g => ACH.filter(a => a.g === g);
// ch = 도전 업적(최상위 기록) — 칭호 조건에서 뺌(2026-10-30, 칭호가 사실상 불가능해지지 않게)
export const titleDone = (g, own) => achOf(g).filter(a => !a.hid && !a.ch).every(a => own[a.k]);
export const achTitles = own => Object.keys(ACH_TITLE).filter(g => titleDone(g, own)).map(g => ACH_TITLE[g]);
export const ACH_TITLES = Object.values(ACH_TITLE);
export const parseAch = s => { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };

const cAcc = n => [0, 2, 4, 6, 8].map(i => accOf(n[i], n[i + 1]));   // 색감의 신 판별 정확도(0~1000)
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
    case 'f_z': return g === 'film' && nat(g, v) === 2;
    case 's_y': return g === 'stair' && nat(g, v) === 99;
    case 's_z': return g === 'stair' && nat(g, v) === 699;
    case 'c_y': return g === 'cut' && n.length === 5 && n[0] > 0 && n.every(x => x === n[0]);
    case 'c_z': { if (g !== 'cut' || n.length !== 5) return false; const s = [...n].sort((a, b) => a - b); return s.slice(0, 4).every(x => x <= 10) && s[4] > 300; }
    case 'r_y': { if (g !== 'reaction') return false; const t = n.slice(0, 5).filter(x => x > 0 && x < 1500); return t.length >= 2 && new Set(t).size < t.length; }
    case 'r_z': return g === 'reaction' && n.slice(0, 5).length === 5 && n.slice(0, 5).every(x => x >= 600 && x < 1500);
    case 'n_y': return g === 'num25' && n.length === 26 && n[25] >= 10;
    case 'n_z': return g === 'num25' && v >= 25000 && v < 26000;
    case 'g_y': return (g === 'gear' || g === 'gearn') && n.length === 4 && n[1] === 1 && n[2] >= 30;
    // 색감의 신: n = [목표, 고른 색]×5(0xRRGGBB) — 서버 checkRounds 통과한 판
    case 'co_7': return g === 'color' && n.length === 10 && cAcc(n).some(a => a >= 980);
    case 'co_8': return g === 'color' && n.length === 10 && cAcc(n).every(a => a >= 900);
    case 'co_x': return g === 'color' && n.length === 10 && [0, 2, 4, 6, 8].some(i => { const [th, ts] = rgb2hsv(n[i]), [ph, ps] = rgb2hsv(n[i + 1]); return ts > 0.3 && ps > 0.3 && Math.abs(((th - ph + 540) % 360) - 180) >= 160; });   // 색상 차이 160° 이상
    case 'co_y': return g === 'color' && n.length === 10 && [1, 3, 5, 7, 9].every(i => rgb2hsv(n[i])[1] < 0.08);
    case 'co_z': return g === 'color' && v === 1000;   // 놓친 합 1000(0.1% 단위) = 평균 80.0%
    case 'b_8': return g === 'blast' && !x?.err && (x?.combo || 0) >= 25;
    case 'b_y': return g === 'blast' && !x?.err && (x?.n || 0) > 0 && x.n < 6;
    case 'dc_7': return g === 'dance' && !x?.err && (x?.maxMult || 0) >= 4;
    case 'dc_8': return g === 'dance' && !x?.err && (x?.safes || 0) >= 8;
    case 'dc_9': return g === 'dance' && !x?.err && (x?.f || 0) >= 3600;
    case 'dc_a': return g === 'dance' && !x?.err && (x?.f || 0) >= 7200;
    case 'dc_b': return g === 'dance' && !x?.err && (x?.danceF || 0) >= 1800;
    case 'dc_x': return g === 'dance' && !x?.err && x?.firstCaught >= 0 && x.firstCaught < 600;
    case 'dc_y': return g === 'dance' && !x?.err && x?.why === 'sleep';
    case 'dc_z': return g === 'dance' && !x?.err && (x?.wakes || 0) >= 1;
    case 'ch_7': return g === 'chase' && !x?.err && (x?.maxCombo || 0) >= 10;
    case 'ch_8': return g === 'chase' && !x?.err && (x?.maxCombo || 0) >= 15;
    case 'ch_x': return g === 'chase' && !x?.err && x?.why !== 'fuel' && (x?.m ?? 999) < 100;
    case 'ch_y': return g === 'chase' && !x?.err && x?.why === 'fuel';
    case 'ch_z': return g === 'chase' && !x?.err && (x?.smash || 0) >= 30;
    case 'ch_r': return g === 'chase' && !x?.err && (x?.ramps || 0) >= 1;
    case 'ch_9': return g === 'chase' && !x?.err && (x?.slipPts || 0) >= 2000;
    case 'ch_f': return g === 'chase' && !x?.err && (x?.cans || 0) >= 5;
    case 'ch_m': return g === 'chase' && !x?.err && (x?.m || 0) >= 10000;
    case 'ch_r2': return g === 'chase' && !x?.err && (x?.ramps || 0) >= 4;
    case 'ch_w': return g === 'chase' && !x?.err && (x?.m || 0) >= 500 && n.slice(1).every(e => e % 8 === 4);
    case 'ch_v': return g === 'chase' && !x?.err && (x?.boosts || 0) >= 8;
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
   판 등급 = 게임마다 정한 점수 구간(MST_BANDS, 2026-10-30 하율 "그냥 점수에 따라서"): S+ 40 · S 32 · A 24 · B 17 · C 12 XP
   + 그 게임 그날 첫 판 보너스 30 XP. 숙련도 1판 기준(mstCounts)을 넘은 판만 · 등급 XP는 한 게임 하루 300(짧은 게임 150)까지(첫 판 보너스는 따로)
   Lv 1~50, 10레벨마다 단계(입문·숙련·베테랑·장인·마스터·레전드) · 숙련도 점수 = 해 본 게임 레벨 합(롤 숙련도 점수)
   저장: users.mst = { 게임: [XP, 마지막 판 날(YYYYMMDD), 그날 등급 XP, S 이상 횟수, 최근 등급] } — gearn은 gear로 */
export const MST_FF = 'mastery';
export const MST_GAMES = [...ACH_GAMES, 'mine', 'snake', 'n2048'];
export const MST_MAX = 50;
export const MST_GR = [['S+', 40], ['S', 32], ['A', 24], ['B', 17], ['C', 12]];
// 2026-10-30 하율 "등급은 그냥 점수에 따라서" — 다른 학생 기록과 비교하지 않고 게임마다 정한 점수 구간(화면 단위, nat)으로.
// 구간은 10/30 실제 학생 최고 기록 분포로 맞춤: S+ ≈ 최상위 몇 명의 최고 기록 · S ≈ 상위 25% 최고 기록 · A ≈ 중간 · B ≈ 하위 · 그 밑 C
// lo = 작을수록 좋음(ms) · u = 화면 단위 · s = 화면에 보일 때 나눌 값(ms → 초) · min = 숙련도 1판으로 치는 최소 기록(너무 짧은 판 제외)
export const MST_BANDS = {
  home: { b: [15000, 9000, 5000, 2500], u: 'm', min: 1500 },
  stair: { b: [900, 600, 300, 150], u: '칸', min: 30 },
  film: { b: [90, 70, 50, 30], u: '개', min: 10 },
  cut: { lo: 1, b: [40, 70, 120, 250], u: 'ms' },   // 2026-10-30 하율 "편집의 신은 더 널널하게" (25·40·70·150 → 40·70·120·250)
  reaction: { lo: 1, b: [190, 215, 245, 290], u: 'ms' },
  num25: { lo: 1, b: [8500, 11000, 14500, 20000], u: '초', s: 1000 },
  gear: { b: [30000, 15000, 8000, 4000], u: '점', min: 1000 },
  blast: { b: [60000, 35000, 20000, 10000], u: '점', min: 3000 },   // 2026-10-31 점수 ×10에 맞춰 ×10
  chase: { b: [25000, 15000, 8000, 3000], u: '점', min: 500 },
  dance: { b: [2500, 1500, 800, 300], u: '점', min: 50 },   // 2026-11-02 23:24 사람 기록 기준으로 낮춤(전: 5000·3000·1500·500, min 100)
  // 선생님 몰래 춤추기(2026-10-31, 반응 속도별 봇 시뮬레이션 기준 — 공개 뒤 실제 기록 분포로 다시 맞출 것)   // 카체이싱!(2026-10-31, 봇 시뮬레이션 기준 — 공개 뒤 실제 기록 분포로 다시 맞출 것)
  color: { b: [930, 880, 800, 650], u: '%', s: 10, min: 300 },   // 색감의 신(2026-11-02, 평균 정확도 0.1% 단위 — 오차 시뮬레이션 기준: 색상 5°·채도/밝기 5% ≈ 95%, 10°·10% ≈ 90%, 20°·15% ≈ 83%. 공개 뒤 실제 분포로 다시 맞출 것) · 30% 밑(아무 데나 누른 판)은 1판으로 안 침
  mine: { lo: 1, b: [60000, 90000, 150000, 240000], u: '초', s: 1000 },
  snake: { b: [60, 40, 25, 12], u: '개' },
  n2048: { b: [6000, 4000, 2500, 1200], u: '점' },
};
const MG = ['S+', 'S', 'A', 'B'];
export function mstGradeOf(game, v) {
  const g = game === 'gearn' ? 'gear' : game, B = MST_BANDS[g]; if (!B) return 'C';
  const x = nat(game, v);
  for (let i = 0; i < 4; i++) if (B.lo ? x <= B.b[i] : x >= B.b[i]) return MG[i];
  return 'C';
}
// 숙련도 1판으로 치는가(2026-10-30: 주간 미션 1판 기준(3분)은 학생 대부분이 못 넘어 숙련도가 안 오르던 문제 → 숙련도는 따로 낮은 기준)
export const mstCounts = (game, v) => { const B = MST_BANDS[game === 'gearn' ? 'gear' : game]; return !B?.min || nat(game, v) >= B.min; };
// 구간 글자(화면): ['15,000m 이상', …] — S+·S·A·B
export const mstBandTxt = g => { const B = MST_BANDS[g]; if (!B) return []; return B.b.map(x => `${(B.s ? x / B.s : x).toLocaleString('ko-KR')}${B.u} ${B.lo ? '안' : '이상'}`); };
// 짧은 게임(한 판 10~30초)은 하루 등급 XP 상한을 낮춤(2026-10-30 하율 "짧은 게임 하루 상한 낮추고") — 긴 게임과 하루 최대 성장이 비슷하게
export const MST_SHORT = ['reaction', 'num25', 'cut'];
export const mstCap = g => MST_SHORT.includes(g) ? MST_XP.dayCapShort : MST_XP.dayCap;
const GR_XP = Object.fromEntries(MST_GR.map(x => [x[0], x[1]]));
export const MST_XP = { dayCap: 300, dayCapShort: 150, first: 30 };
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

// 판 하나로 얻는 XP(등급 XP + 첫 판 보너스)를 더한 새 값. add = { play: 1판으로 침, gr: 등급 } · day = 오늘(YYYYMMDD)
export function mstAdd(m, g, add, day) {
  if (!add.play) return m;
  g = g === 'gearn' ? 'gear' : g;
  const o = { ...m }, cur = Array.isArray(o[g]) ? [...o[g]] : [0, '', 0, 0, ''];
  const fb = cur[1] !== day ? MST_XP.first : 0;   // 그 게임 그날 첫 판 보너스
  if (fb) { cur[1] = day; cur[2] = 0; }
  const p = Math.max(0, Math.min(GR_XP[add.gr] || 12, mstCap(g) - (+cur[2] || 0)));
  cur[0] = (+cur[0] || 0) + p + fb; cur[2] = (+cur[2] || 0) + p;
  cur[3] = (+cur[3] || 0) + (add.gr === 'S+' || add.gr === 'S' ? 1 : 0); cur[4] = add.gr || '';
  o[g] = cur;
  return o;
}
// 숙련도 점수(롤 숙련도 점수): 해 본 게임 레벨 합
export const mstScore = (m, gs = MST_GAMES) => gs.reduce((a, g) => a + (mstXp(m, g) > 0 ? mstLv(mstXp(m, g)).lv : 0), 0);
