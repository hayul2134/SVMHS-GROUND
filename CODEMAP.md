# SVMHS GROUND — 코드 지도

서울영상고 학생용 급식·시간표·학사일정·D-day 사이트. **Cloudflare Pages**로 배포된다 (`main`에 push → 자동 배포 → https://svmhs-ground.pages.dev).
빌드 과정 없음(`wrangler.jsonc`의 `pages_build_output_dir`): `public/`이 그대로 배포되고, `functions/`는 Pages Functions(서버 코드)가 된다.

## 파일
| 경로 | 역할 |
|---|---|
| `public/index.html` | 화면 뼈대 전부 (바로가기는 게임·시간표·학사일정·D-day만 — 다른 버튼이 있는 건 넣지 않음) (아이콘 스프라이트 · 헤더/탭 · 5개 view · 모달 3개). 인라인 스크립트·`style=""` 금지(CSP) |
| `public/css/style.css` | 스타일. 맨 위 목차 참고. 색은 `:root` 토큰만 바꾸면 라이트/다크 같이 바뀜 |
| `public/js/theme.js` | 첫 화면 깜빡임 방지용 테마 적용 + 로그인 전이면 `html.prelogin`(소개 화면) 미리 붙임 (일반 스크립트, `<head>`에서 먼저 실행) |
| `public/js/app.js` | 화면 로직. 홈: 첫 화면(`#bigclock`)은 시계 + 왼쪽 `#sMeal`(오늘 급식) · 오른쪽 `#sTT`(오늘 시간표)만. 700px 이상에선 두 카드가 화면 가장자리 서랍(`.stow`): 탭으로 꺼내기(`.open`), 핀 버튼으로 꺼낸 자리에 고정(`.pin`, localStorage `side_meal`·`side_tt`), 첫 화면 아래로 스크롤하면 `html.tuck`으로 잠시 접힘. 오른쪽 시간표는 `ttTarget()` — 마지막 교시가 끝나면 다음 등교일(내일/○요일), 0시부터 그날. 시계 바로 아래 작은 상태 줄 `.s-info`(`#more`: 현재 시각·날짜·진행률 카드·오늘 일정 알림, 시계보다 작게). `#play`(밸런스 게임)는 `오늘 한눈에` 벤토(급식 4·일정 4·투표 4칸)로 이동. 1280px 이상은 3단, 700~1279px는 시계 위·카드 2단, 그 아래는 세로 · 아래 `#weekTT`(주간 시간표, `fillWeek` 공용). `/* ===== 섹션 ===== */` 단위: 급식 · 시간표 · 학사일정 · D-day · 모달 · 공유 · 반 설정 · 안내 · 테마 · 시작 |
| `public/js/food.js` | 급식 메뉴 이름 → 식판 칸 음식 그림(SVG). 2025.03~2026.10 메뉴 855종을 보고 만든 분류 규칙 `RULES`(위에서부터 먼저 맞는 것) → 종류별 그리기 `DRAW`. 이름으로 시드를 잡아 같은 메뉴는 항상 같은 모양. 음료(`isDrink`)는 식판에서 빼서 옆에 우유팩·컵(`drinkSvg`)으로 세움. 그림은 `app.js paintFood()`가 칸 크기를 잰 뒤 그 비율(`arBucket`)로 그려 넣고, 칸 크기가 바뀌면 ResizeObserver로 다시 그림. 공용 음영 그라디언트는 `.food-defs`에 한 번만 넣음. 6글자 이상 이름은 `nameLines()`가 단어 경계에서 2줄로 나눔. 새 메뉴가 엉뚱하게 그려지면 `RULES`에 정규식 한 줄 추가 |
| `public/food/c/*.webp`, `tools/food-gen/` | 식판 **카툰 음식 그림**(투명 배경 256px WebP, 약 16KB). 메뉴 이름 → 그림 키는 `food.js`의 `cartoonKey()`(규칙 `CK` → 없으면 종류별 `KIND_CK`), 실제로 있는 키는 `CARTOON`. 없는 키·실패는 기존 도형 그림. 칸 안에 잘리지 않게(contain) 담고 이름표는 아래(`.hasimg`). 새 그림 만들기: `tools/food-gen/README.md` (Workers AI 무료, 하루 한도 있음) |
| `public/js/neis.js` | 나이스 API 호출 + 브라우저 캐시(3시간). `getMeals / getTimetable / getSchedule` |
| `public/js/util.js` | 날짜·`esc()`·`store`(localStorage, 키 앞 `sg_`)·토스트 |
| `public/js/qr.js` | QR 코드 SVG 생성기 (외부 라이브러리 없음) |
| `public/js/social.js` | 소셜 화면 전부: 로그인/가입 · 프로필 꾸미기(아바타·색·스티커) · 친구 찾기/팔로우 · DM(새 메시지 확인 25초, 대화창 3~15초, 화면 숨기면 멈춤) · 미니게임 3종(반응속도·1 to 25·컷 타이밍) · 랭킹(전체/친구/반 대항전 — 모두 개인 최고 기록 기준, 하루 단위 랭킹 없음). `app.js`가 시작할 때 동적 import → `init(SOC)` |
| `functions/api/s/[[path]].js` | 소셜 API `/api/s/*` (D1 `DB`, 테이블 자동 생성). 쿠키 세션(HttpOnly, 30일·연장 없음) · PBKDF2 비밀번호 · 횟수 제한 · DM은 맞팔끼리만 · 차단/신고 · 게임 기록 범위 검사 |
| `functions/api/[[path]].js` | `/api/config`, `/api/neis/<서비스>` 프록시(허용 서비스·파라미터 화이트리스트, 숫자만 통과) · `/api/vote` 급식 인기투표 · `/api/balance` 오늘의 밸런스 게임(둘 다 D1 `DB`, 테이블 자동 생성) |
| `public/admin/` | **관리자 페이지** `/admin` (index.html · admin.css · admin.js). 대시보드 · 모니터링(지금 접속자·최근 활동·오늘 시간대별·투표·DB 줄 수·나이스 연결·서버 오류, 20초 자동 새로 고침) · 신고 처리 · 사용자 관리(정지·임시 비번·프로필 정리·삭제) · 게임 기록 · 공지 · 밸런스 질문 · 설정(가입 코드·가입/DM 켜고 끄기) · 관리 기록 |
| `functions/api/admin/[[path]].js` | 관리자 API `/api/admin/*`. 관리자 계정(`lib/db.js` `ADMIN_HANDLE` = hayuldeveloper)으로 사이트에 로그인 → 비밀번호 재확인(`/api/s/admin-pass`, 15분 8회 제한) → 12시간 세션(HttpOnly 쿠키, 경로 /api/admin). 관리자 계정이 지워지거나 정지되면 세션 무효. 모든 조치는 `admin_log`에 기록 |
| `lib/db.js`, `lib/balance.js` | functions 세 곳이 같이 쓰는 D1 테이블 정의(`setup`)·설정(`settings` 테이블)·횟수 제한(`limited`·`ipKey`: IP는 해시로만, 만료 줄 자동 삭제)·관리 기록용 `maskIp`·밸런스 기본 질문. **표 구조를 바꾸면 `SCHEMA_V`를 올릴 것**(평소엔 버전 확인 쿼리 1번만 실행). functions/ 밖이라 라우트가 아님 |
| `public/sw.js` | 서비스 워커(`app.js` 시작에서 등록). 화면 파일·`/api/neis`·`/api/config`를 네트워크 먼저(3.5초 넘으면 저장본) 방식으로 저장 → 와이파이가 끊겨도 마지막 화면·급식·시간표 보임. 로그인·DM·게임·투표·관리자는 건드리지 않음. 저장 목록을 크게 바꾸면 `SHELL`·`DATA` 이름의 v를 올릴 것 |
| `public/_headers` | 보안 헤더(CSP 등) · 이미지 캐시 |
| `public/manifest.webmanifest`, `public/icons/` | 홈 화면에 추가(PWA) 정보 |
| `public/og-image.jpg` | 카톡 등 링크 미리보기 이미지 (1200×630) |
| `public/404.html`, `robots.txt` | 기타 (검색 노출 차단: noindex) |

## 규칙
- 나이스 응답·사용자 입력을 `innerHTML`에 넣을 땐 **반드시 `esc()`**.
- 외부 스크립트/스타일을 새로 쓰면 `public/_headers`의 CSP에 도메인 추가해야 동작한다.
- 새 나이스 서비스나 파라미터를 쓰려면 `functions/api/[[path]].js`의 `SERVICES`에 먼저 추가.
- 종 시간(시정표)은 `app.js`의 `BELL` 배열. 월·화·수 7교시, 목·금 6교시. 학사일정 휴업일·공휴일은 자동으로 쉬는 날 처리. 시간표가 있으면 마지막 교시는 시간표 기준(요일 교체 대응). 기기 시계는 서버 Date 헤더로 보정(util `now()`). 실제 종소리가 시계보다 늦게 울리는 만큼 `BELL_LAG`(ms, 지금 850)로 카운트다운을 늦춤 — 종이 타이머보다 빠르면 음수, 느리면 더 크게.
- 학교 코드(B10 / 7010795)는 서버(`SCHOOL`)에 고정. 반 목록은 나이스 classInfo에서 받음(실패 시 `BASE_CLASS`=6).

## 인증키 (NEIS_KEY)
없어도 동작하지만 요청당 5건 제한 → 시간표 5교시까지만 보임. 넣으려면
Cloudflare 대시보드 → Workers & Pages → `svmhs-ground` → 설정 → 변수 및 비밀 → **Production에 비밀(Secret) `NEIS_KEY`** 추가 후 재배포.
키는 절대 코드에 넣지 않는다.

## 로컬 실행
```bash
npx wrangler@4 pages dev --port 8788
```
→ http://localhost:8788 (functions 포함). 키 테스트는 `.dev.vars`에 `NEIS_KEY=...` (git 제외됨).

## 급식 인기투표 (D1)
`wrangler.jsonc`의 `d1_databases`에 바인딩 이름 `DB`로 연결. 바인딩이 없으면 투표 UI만 숨겨지고 나머지는 정상 동작.
기기마다 localStorage의 무작위 ID(`sg_voter`)로 끼니당 한 표, 다시 누르면 취소. 투표는 오늘(한국 시간) 급식만, 메뉴에 있는 음식만 서버에서 허용.

## 급식 자동 전환
`mealSlot()`: 7시 50분 전 조식 → 5교시 시작(`BELL`의 5교시 start) 전 중식 → 그 뒤 석식. 첫 화면 작은 식판과 아래 '오늘 급식' 카드가 같이 따라감(카드 탭을 직접 누르면 다음 전환 때까지 그 끼니 유지). 그 끼니가 없는 날은 다음 끼니 → 중식 순으로 대신 표시.

## 오늘의 밸런스 게임 (D1)
질문 목록은 서버 `BALANCE` 배열(한국 날짜로 하루 한 개씩 돌아감). 기기 ID(`sg_voter`)당 하루 한 표, 다시 누르면 취소. 자유 입력은 일부러 없음(익명 저격 방지). DB 바인딩이 없으면 카드가 숨겨짐.

## 소개 화면 (로그인 전)
- `index.html`의 `#intro`(전체 화면 덮개, z-index 55). `html.prelogin`일 때만 보임. 내용: 첫 화면(로고·가입/로그인 버튼·둘러보기) → 할 수 있는 것 6개 → 시작 3단계.
- 흐름: `theme.js`가 `localStorage.sg_in`(로그인한 적 있는 기기)·`sessionStorage.sg_peek`(이번 창에서 '로그인 없이 둘러보기') 둘 다 없으면 `html.prelogin` 추가 → `social.js init`이 `/api/s/me` 확인 후 `SOC.authed(me, enabled)` → `app.js`가 로그인돼 있으면 닫고 `sg_in` 저장, 아니면 띄움. 연결 오류면 상태 유지.
- 가입/로그인 버튼은 `#introAuth` 안에 `authHtml()` 폼을 펼침 → 성공하면 소개가 닫히고 원래 보려던 화면(해시)이 보임. 로그아웃·탈퇴하면 다시 소개.
- 소셜이 꺼져 있거나(`DB` 없음) social.js를 못 불러오면 소개를 띄우지 않음. 반 설정 창은 소개가 닫힐 때 띄움.

## 소셜 (프로필 · DM · 게임)
- 헤더 오른쪽은 테마 버튼 `#btnTheme` + 목록 버튼 `#btnMenu`(☰↔✕). 누르면 `#hMenu.open` → `#hList`가 서랍(카드)처럼 펼쳐지고 각 줄은 아이콘+이름+설명: 위에서부터 프로필(`#btnMe`, 로그인하면 `.mi` 안이 아바타) · 설정(`#btnClass`, 반 설정) · QR(`#btnShare`) · 신고(`#btnReport` → `social.js openReport()`: 아이디·이유 입력, 로그인 필요). 항목 누르면 닫힘, 바깥 클릭·Esc로도 닫힘. 로직은 `app.js` `menu()`.
- DM은 헤더에 없음 → 오른쪽 아래 `#dmDock`. 900px 이상은 '메시지' 버튼(안 읽은 수 + 최근 대화 3명) → 떠 있는 창 `#dmPanel` 안에서 목록·대화(`renderDm(handle, box, panel)` 공용, 창 안 링크는 `data-pdm`). 900px 미만은 둥근 버튼 → `#dm` 화면. `#dm` 화면·게임 중엔 숨김(`body[data-view]`, `body.playing`).
- 화면: `#me`(내 프로필/로그인) · `#u/아이디`(남의 프로필) · `#dm`, `#dm/아이디` · `#game`. `go()`가 `/` 뒤를 인자로 넘김.
- 프로필 인스타 아이디(`users.insta`, 선택): 꾸미기에서 입력 → 서버가 @·인스타 주소를 떼고 아이디만 저장(영문·숫자·._ 30자 검사) → 프로필에 `.pinsta` 버튼(새 창으로 instagram.com/아이디). 인스타 API 연동은 개인 계정 불가라 링크 방식. 관리자 '프로필 정리'로 지울 수 있음.
- D1 바인딩 `DB`가 없으면 `/api/s/config`가 `{enabled:false}` → 화면에 '준비 중'만 보임.
- 선택: Pages 비밀 변수 `JOIN_CODE`를 넣으면 가입할 때 코드 필요(친구끼리만).
- 목록(AVATARS·COLORS·STICKERS)은 서버·`social.js` 둘 다 같게 유지. 게임 추가 시 서버 `GAMES`(허용 범위)와 `social.js`의 `GAMES` 둘 다 수정.
- 신고·정지·공지 등은 관리자 페이지 `/admin`에서 처리.

## 관리자 페이지 (/admin)
- 필요: D1 바인딩 `DB` + 사이트에 `hayuldeveloper` 계정. 그 계정의 계정 설정(⚙️)에만 '관리자 페이지' 버튼이 보임(`social.js`의 `ADMIN_HANDLE`, 서버와 같게). /admin에서 그 계정 비밀번호를 한 번 더 넣어야 들어감.
- DM은 **신고된 메시지와 앞뒤 5개만** 볼 수 있음(사생활 보호). 전체 DM 열람 기능은 일부러 없음.
- 정지(`bans`): 정지 즉시 세션 삭제 + 로그인 거부(사유·기간 표시). 소셜 `auth()`도 정지된 사람은 막음.
- 설정(`settings`): `join_code`(있으면 비밀 변수 JOIN_CODE보다 우선, ''이면 코드 없음) · `signup_open` · `dm_open` · `notice`(JSON).
- 공지: `/api/notice`(30초 캐시) → `app.js loadNotice()`가 `#notice` 띠로 표시. 학생이 닫으면 `sg_notice_x`에 그 공지 id 저장.
- 밸런스: `balance_custom`에 날짜별 질문 덮어쓰기. 오늘 질문을 바꾸면 오늘 표 초기화.

## 의견 · 공지 버튼 (헤더)
- 💡 의견(노란 알약, 좁은 화면은 아이콘만) → `social.js openFeedback()` → `POST /api/s/feedback`(로그인 필요, 1시간 6번) → `feedback` 표 → 관리자 '💡 의견' 탭에서 확인·메모·삭제. 탈퇴·계정 삭제 시 같이 지움.
- 📢 공지 → `openNotices()` → `GET /api/notices`(최근 20개, 30초 캐시). 관리자가 공지를 올리면 `notices` 표에도 기록(앞 공지는 끝난 것으로). 마지막으로 본 공지 id `sg_notice_seen`과 다르면 버튼에 빨간 점. 목록을 열면 닫았던 띠 공지도 다시 보임.

## 모니터링 (/admin → 📡 모니터링)
- API `GET /api/admin/monitor` 하나로 모아 받음. DM은 **개수만**(내용·누가 누구에게는 없음).
- 서버 오류: 세 API의 catch와 나이스 프록시 실패가 `lib/db.js logErr()` → `errs` 표(14일·500줄 보관). D1 한도 초과 오류는 기록하지 않음(쓸 수 없으니까).
- 'DB 저장' 상태는 `settings`의 `probe` 줄을 한 번 써 보고 판단(계정 전체 무료 한도는 숫자로 알 수 없음).

## 보안·개인정보 원칙
- IP는 원문 저장 금지: 횟수 제한은 `ipKey()`(해시), 관리 기록은 `maskIp()`. IP 기준 한도는 학교 와이파이(한 반이 IP 공유)를 고려해 넉넉히, 계정 보호는 아이디 기준.
- DM은 관리자도 전체 열람 불가. 메시지 신고는 신고자와 대상의 대화 속 대상 메시지만 허용(남의 대화 끌어오기 방지).
- 탈퇴·계정 삭제 시 계정·프로필·DM·게임 기록·본인이 한 신고 삭제(본인을 향한 신고는 남김). 저장 항목이 바뀌면 `index.html` 이용 안내의 개인정보 문단도 같이 고칠 것.
