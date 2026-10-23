# SVMHS GROUND — 코드 지도

서울영상고 학생용 급식·시간표·학사일정·D-day 사이트. **Cloudflare Pages**로 배포된다 (`main`에 push → 자동 배포 → https://svmhs-ground.pages.dev).
빌드 과정 없음(`wrangler.jsonc`의 `pages_build_output_dir`): `public/`이 그대로 배포되고, `functions/`는 Pages Functions(서버 코드)가 된다.

## 파일
| 경로 | 역할 |
|---|---|
| `public/index.html` | 화면 뼈대 전부 (바로가기는 게임·시간표·학사일정·D-day만 — 다른 버튼이 있는 건 넣지 않음) (아이콘 스프라이트 · 헤더/탭 · 5개 view · 모달 3개). 인라인 스크립트·`style=""` 금지(CSP) |
| `public/css/style.css` | 스타일. 맨 위 목차 참고. 색은 `:root` 토큰만 바꾸면 라이트/다크 같이 바뀜 |
| `public/js/theme.js` | 첫 화면 깜빡임 방지용 테마(`data-theme` 밝음/어두움 + `data-skin` 색깔·캐릭터 테마) 적용 + 로그인 전이면 `html.prelogin`(소개 화면) 미리 붙임 (일반 스크립트, `<head>`에서 먼저 실행) |
| `public/js/app.js` | 화면 로직. 홈: 첫 화면(`#bigclock`)은 시계 + 왼쪽 `#sMeal`(오늘 급식) · 오른쪽 `#sTT`(오늘 시간표)만. 700px 이상에선 두 카드가 화면 가장자리 서랍(`.stow`): 포스트잇 탭(`.s-tab`, 아이콘은 직접 그린 `#sj-tray`·`#sj-ttab`)으로 꺼내기(`.open`), 카드 안 `옆으로 넣기` 버튼(`.s-put`)으로 다시 넣기 — 꺼낸 상태는 넣을 때까지 유지·기억(localStorage `side_meal`·`side_tt`: open/closed), 첫 화면 아래로 스크롤하면 `html.tuck`으로 포스트잇까지 화면 옆으로 완전히 들어갔다가 위로 오면 원래 상태로 다시 나옴. 오른쪽 시간표는 `ttTarget()` — 마지막 교시가 끝나면 다음 등교일(내일/○요일), 0시부터 그날. 두 카드 머리의 ‹ ›로 다른 등교일을 넘겨 봄(`S.sMealDay`·`S.ttPick`, 다른 날일 때 라벨 누르면 오늘로, 3분 안 만지면 자동 복귀 `armReset`). 오늘을 보고 있을 때 라벨(⇄)을 누르면 하루↔한 주 보기 전환(`homeMode`, `S.mealWk`·`S.ttWk` = 그 주 월요일, localStorage `wk_meal`·`wk_tt`로 기억): 한 주 모드는 카드가 넓어지고(`.s-tt.wk`) ‹ ›가 주 단위, 급식은 `paintHeroWeek()` 월~금 다섯 줄(끼니 칩은 한 주 전체에 적용), 시간표는 `fillWeek` 작은 표, 급식 카드 끼니 칩 `#sMealSlots`. '전체' 버튼은 `#mAll` 모달(한 주 급식 텍스트 `getMealsRange` / 한 주 시간표 `fillWeek`, 주 넘기기, 주 라벨 누르면 `weekPick` 팝업 `#wPick`: 해 ‹ › · 12달 · 그 달의 주 목록 · 이번 주로 — 시간표 화면 `#tLbl`도 같은 팝업). 시계 바로 아래 한 장짜리 상태 띠 `.s-info`(`#more`: 현재 시각 · 날짜 · 수업 상태/진행률을 점선으로 나눈 칸으로, 시계보다 작게 — 시계 장식은 별 3개만). `#play`(밸런스 게임)는 시계 아래 `.s-info` 바로 밑 한 장짜리 티켓(`.bal-t`), 💬 댓글 버튼·질문을 누르면 `#mBal` 크게 보기(결과·댓글). 1280px 이상은 3단, 700~1279px는 시계 위·카드 2단, 그 아래는 세로 · 아래 `#weekTT`(주간 시간표, `fillWeek` 공용: 같은 과목 연속은 한 칸(rowspan, 점심 넘지 않음) + 'N시간' 칩, 4·5교시 사이 점심 줄, 교시 번호 옆 시작 시각, 지난 요일 흐리게. `markWeek(pi)`가 교시 바뀔 때 오늘 칸에 now·next·done 표시 + 카드 머리 `#hwNow` 상태 칩. 좁은 화면은 오늘 칸으로 자동 가로 스크롤, 교시 열 고정. 칸마다 과목 아이콘 `subjIcon()`(규칙 `SUBJ_IC`, 직접 그린 SVG 스티커 아이콘 = index.html 스프라이트 `#sj-*`, 새 과목이 기본 책(book)으로 나오면 정규식 한 줄 추가 — 서랍 시간표에도 씀)). '한눈에 보기'(`#board`, 첫 화면 바로 아래 — 아래 화살표 `#goDown`이 여기로, 제목(정가운데) 오른쪽 `#goSvc` '서비스 바로가기'와 화면 왼쪽 아래 고정 `#svcFab` '서비스'(서비스들이 보이면 `html.at-svc`로 숨김)는 그 아래 `#apps`(서비스들)로 스크롤)는 1000px 이상에서 시간표 8칸 + 오른쪽 급식·일정 4칸 한 화면 배치. 홈 '오늘 급식' 카드는 식판 대신 `mealListHtml()` 목록(작은 그림+이름, 누르면 투표). 자정이 지나면 `tickClock`이 `S.dayKey`로 감지해 시간표 표·급식·일정을 새 날짜로 다시 그림. `/* ===== 섹션 ===== */` 단위: 급식 · 시간표 · 학사일정 · D-day · 모달 · 공유 · 반 설정 · 안내 · 테마 · 시작 |
| `public/js/food.js` | 급식 메뉴 이름 → 식판 칸 음식 그림(SVG). 2025.03~2026.10 메뉴 855종을 보고 만든 분류 규칙 `RULES`(위에서부터 먼저 맞는 것) → 종류별 그리기 `DRAW`. 이름으로 시드를 잡아 같은 메뉴는 항상 같은 모양. 음료(`isDrink`)는 식판에서 빼서 옆에 우유팩·컵(`drinkSvg`)으로 세움. 그림은 `app.js paintFood()`가 칸 크기를 잰 뒤 그 비율(`arBucket`)로 그려 넣고, 칸 크기가 바뀌면 ResizeObserver로 다시 그림. 공용 음영 그라디언트는 `.food-defs`에 한 번만 넣음. 6글자 이상 이름은 `nameLines()`가 단어 경계에서 2줄로 나눔. 새 메뉴가 엉뚱하게 그려지면 `RULES`에 정규식 한 줄 추가 |
| `public/food/c/*.webp`, `tools/food-gen/` | 식판 **카툰 음식 그림**(투명 배경 256px WebP, 약 16KB). 메뉴 이름 → 그림 키는 `food.js`의 `cartoonKey()`(규칙 `CK` → 없으면 종류별 `KIND_CK`), 실제로 있는 키는 `CARTOON`. 없는 키·실패는 기존 도형 그림. 칸 안에 잘리지 않게(contain) 담고 이름표는 아래(`.hasimg`). 새 그림 만들기: `tools/food-gen/README.md` (Workers AI 무료, 하루 한도 있음) |
| `public/js/neis.js` | 나이스 API 호출 + 브라우저 캐시(3시간). `getMeals / getTimetable / getSchedule` |
| `public/js/util.js` | 날짜·`esc()`·`store`(localStorage, 키 앞 `sg_`)·토스트 |
| `public/js/qr.js` | QR 코드 SVG 생성기 (외부 라이브러리 없음) |
| `public/js/attend.js`, `public/js/att-rewards.js`, `lib/attend.js`, `tools/attend/DESIGN.md` | **출석 체크(듀오링고식 연속 출석)** — 고치기 전에 `tools/attend/DESIGN.md`(조사·디자인 원칙) 먼저. 로그인한 채로 열면 하루 한 번 자동 출석(`social.js refreshMe` → `ATT.sync` → `POST /api/s/att`, 두 탭 동시에도 `st_last` 조건으로 1번만). 축하 창 `#mAtt`: 평소엔 짧게(불꽃 숫자·이번 주 도장), 기념일(`MILESTONES`·보상 해금)엔 빛줄기·색종이·보상 카드. 불꽃 4단계 색(`tierOf`: 1/7/30/100일), 완벽한 연속(`users.st_pf`, 방패 안 씀) = 금빛 후광, 월~금 개근 = 금빛 띠, 이어진 날은 띠로 연결. 헤더 🔥 `#btnStreak` → 출석 창(통계 · 다음 보상 · 달력 `GET att?m=YYYYMM` · 연속/누적 보상 목록 · 순위 `GET attrank?scope=friends|all` · 규칙). 규칙: 등교일(월~금, 나이스 휴업일·공휴일 제외 — `school_off` 캐시, 못 읽은 달은 안 끊음)을 빠지면 끊김, 주말 +1, 연속 5일마다 방패(최대 2, 자동 사용, `attendance.kind=2`). 보상 목록은 `att-rewards.js` 한 곳(서버도 import): 연속(최고 기록)·누적(총 출석일) 두 갈래, 종류 스티커·프로필 사진·배경 색(`c-x*` 그라디언트, `--pg`)·칭호(`users.st_title`, 프로필 이름 아래·출석 순위). 서버 `POST me`가 해금 여부 검사. users 칸: `st_cur·st_best·st_last·st_total·st_shield·st_pf·st_title` |
| `public/js/social.js` | 소셜 화면 전부: 로그인/가입 · 프로필 꾸미기(아바타·색·스티커) · 친구 찾기/팔로우 · DM(새 메시지 확인 25초, 대화창 3~15초, 화면 숨기면 멈춤) · 미니게임 3종(반응속도·1 to 25·컷 타이밍) · 랭킹(전체/친구/반 대항전 — 모두 개인 최고 기록 기준, 하루 단위 랭킹 없음). `app.js`가 시작할 때 동적 import → `init(SOC)` |
| `functions/api/s/[[path]].js` | 소셜 API `/api/s/*` (D1 `DB`, 테이블 자동 생성). 쿠키 세션(HttpOnly, 30일·연장 없음) · PBKDF2 비밀번호 · 횟수 제한 · DM은 맞팔끼리만 · 차단/신고 · 게임 기록 범위 검사 |
| `functions/api/[[path]].js` | `/api/config`, `/api/neis/<서비스>` 프록시(허용 서비스·파라미터 화이트리스트, 숫자만 통과) · `/api/vote` 급식 인기투표 (D1 `DB`, 테이블 자동 생성). 밸런스 게임은 소셜 API `/api/s/bal`로 옮김 |
| `public/admin/` | **관리자 페이지** `/admin` (index.html · admin.css · admin.js). 대시보드 · 모니터링(지금 접속자·최근 활동·오늘 시간대별·투표·DB 줄 수·나이스 연결·서버 오류, 20초 자동 새로 고침) · 신고 처리 · 사용자 관리(정지·임시 비번·프로필 정리·삭제) · 게임 기록 · 공지 · 밸런스 질문 · 설정(가입 코드·가입/DM 켜고 끄기) · 관리 기록 |
| `functions/api/admin/[[path]].js` | 관리자 API `/api/admin/*`. 관리자 계정(`lib/db.js` `ADMIN_HANDLE` = developer)으로 사이트에 로그인 → 비밀번호 재확인(`/api/s/admin-pass`, 15분 8회 제한) → 12시간 세션(HttpOnly 쿠키, 경로 /api/admin). 관리자 계정이 지워지거나 정지되면 세션 무효. 모든 조치는 `admin_log`에 기록 |
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
- 일정(`lib/balance.js`): **월~금 하루 한 문제**(주말엔 새 질문 없음, 금요일 결과 유지). 한국 시간 **6시 공개** → 그날 **마지막 교시 끝 +10분 마감**. 마지막 교시는 나이스 학교 전체 시간표(`hisTimetable` ALL_TI_YMD)의 최대 교시(시험·단축 대응)를 `balance_days`에 하루 한 번 저장, 없으면 월~수 7·목금 6교시. 6시 전·주말엔 직전 평일 결과를 보여 줌.
- 질문: `BALANCE` 배열(평일만 번호를 매겨 순서대로, `START` = 2026-10-23 첫 질문). 관리자 페이지에서 날짜별 덮어쓰기(`balance_custom`). 질문 40자·선택지 20자 이내. 소재는 학생·선생님 누구나 공감할 일상만(학과 전용·학생 전용 소재 금지).
- API(`functions/api/s/[[path]].js`, 로그인 필요): `GET bal` 상태 · `POST bal` {pick,ymd} 투표/취소(마감 전만) · `POST balc` 댓글(100자, 욕설 필터, 진행 중엔 투표해야 가능, 5분 6개) · `POST balcdel` 내 댓글 삭제 · `POST balcrep` 신고(→ `reports`). 표는 `balance_votes`(voter = `u<uid>`, 계정당 한 표), 댓글은 `balance_comments`(배지는 현재 투표 기준).
- 공개 규칙: 진행 중엔 투표해야 결과·댓글이 보임, 마감 뒤엔 모두에게 결과 + 이긴 쪽 👑·WIN, 진 쪽 흐리게, 무승부 표시.

## 소개 화면 (로그인 전)
- `index.html`의 `#intro`(전체 화면 덮개, z-index 55). `html.prelogin`일 때만 보임. 내용(2026-10-23 개편): 첫 화면(왼쪽 제목·가입/로그인, 오른쪽 **실제로 움직이는 종 시계** `.in-clock`) → **둘러보기 쇼케이스 `#inShow`**(2026-10-23 · `app.js` '둘러보기 쇼케이스'): 화면 `.sh-stage`를 sticky로 붙이고 섹션 스크롤 진행도(0~1)로 연출. ① '로그인하면 바로 이 화면이에요!' 스티커가 가운데 크게 → ② 덮개 `.sh-cover`가 걷히고 `#intro.sh-see`(배경 투명)·`html.sh-real`(서비스·메시지 버튼·캐릭터도 보이게)로 **뒤에 미리 그려 둔 진짜 첫 화면**이 그대로 보임(로그인 전에도 `bootHome()`이 등장 애니메이션 없이 최종 모습으로 그려 두고, 로그인하는 순간 `pre→boot` 등장 애니메이션 재생) ③ 줄 서기: 진짜 급식판·시계 묶음·시간표를 `cloneGroup()`으로 같은 자리·같은 크기로 복제(`html.sh-hand`로 진짜는 숨김, 시계 복제는 1초마다 다시)해 한 줄로 이동, 서랍이 들어가 있으면(세로 화면) 직접 그린 카드가 포스트잇 자리에서 나옴, 밸런스·게임·DM·프로필·일정은 오른쪽에서 줄줄이 ④ 스크롤마다 다음 오브젝트가 가운데로 + 설명 `SH_INFO`·점·'건너뛰기'. 진행도는 속도 제한 스프링(`VMAX`, 한 장면 약 0.5초)으로 따라가서 확확 내려도 장면을 건너뛰지 않음(스크롤 스냅은 안 씀). 폰에선 스티커가 아래로 내려가며 사라짐. 움직임 줄이기 설정·스크립트 없음이면 카드 목록 → 전광판 `.in-tick` → 반응속도 맛보기 `#inRx`(기록 저장 안 함, 최고 기록 옆에 가입 버튼) → 시작 3단계 → 자주 묻는 것(`details`) → 마지막 카운트다운 + 가입 버튼.
- 소개 로직(`app.js` '소개' 섹션): `introTick()`이 홈과 같은 `bellInfo(bellNow())`로 1초마다 갱신(소개가 떠 있고 탭이 보일 때만). `.rv` 요소는 IntersectionObserver로 스크롤 등장(`#intro.rv-on`일 때만 숨김 → 스크립트 실패해도 내용은 보임). 설명용 이모지 대신 스프라이트 아이콘(`#sj-*`)을 씀.
- 흐름: `theme.js`가 `localStorage.sg_in`(로그인한 적 있는 기기)·`sessionStorage.sg_peek`(이번 창에서 '로그인 없이 둘러보기') 둘 다 없으면 `html.prelogin` 추가 → `social.js init`이 `/api/s/me` 확인 후 `SOC.authed(me, enabled)` → `app.js`가 로그인돼 있으면 닫고 `sg_in` 저장, 아니면 띄움. 연결 오류면 상태 유지.
- 가입/로그인 버튼 → 전체 화면 로그인 페이지 `#introAuth.authpage`(2026-10-23, `app.js authPage()`): 왼쪽 파란 보드(로고·말풍선·종 상태는 `apLive()`가 소개 시계 값을 1초마다 복사·기능 3개) · '소개로 돌아가기'는 화면 왼쪽 위 고정 + 오른쪽 폼(`#authSlot` ← `social.js authHtml()`). 열 때 `history.pushState`로 뒤로 가기 한 칸(뒤로 가기·Esc·'소개로 돌아가기'로 닫힘). 폼: 탭(알약이 미끄러짐, 적던 아이디·비번 유지) · `@` 아이디(치는 대로 소문자, 가입 시 형식 맞으면 ✓) · 비밀번호 보기 눈 · Caps Lock 안내 · 가입은 닉네임 글자 수·비밀번호 세기 막대·학년/반 칩(한 줄 `.apicks`, 반은 1~6반 `CLS_N`·서버도 1~6만 저장, `.apick`, `.pick`은 이모지 고르기와 이름 겹침 주의) · 서버 보내기 전 `checkForm()` 빨간 경고 · 보내는 중 점 3개 · 성공 시 '입장!' 도장 0.76초 후 닫힘. 세로가 낮은 데스크톱(≤900px·≤760px)은 미디어 쿼리로 압축해 한 화면에 들어오게 함(`justify-content:safe center`로 위가 잘리지 않음). 성공하면 소개가 닫히고 원래 보려던 화면(해시)이 보임. 로그아웃·탈퇴하면 다시 소개.
- 소셜이 꺼져 있거나(`DB` 없음) social.js를 못 불러오면 소개를 띄우지 않음. 반 설정 창은 소개가 닫힐 때 띄움.

## 테마 (밝음/어두움 + 색깔·캐릭터)
- 헤더 해·달 버튼 `#btnTheme`은 밝음/어두움만(`sg_theme`). 메뉴 '테마' `#btnSkin` → `#mSkin` 창에서 색깔 7종(기본 파랑·핑크·민트·라벤더·피치·레몬·모노)·캐릭터 16종(고양이·강아지·곰돌이·토끼·개구리·병아리·햄찌·펭귄·여우·판다·공룡·유령·슬라임·양·고래·우파루파, 모두 오리지널 그림)을 고르면 `html[data-skin]` + `sg_skin` 저장. 두 설정은 따로 조합됨.
- 스킨 색·마스코트 SVG는 `tools/skins/gen.py`가 `style.css` 맨 아래 '스킨' 구간을 생성(직접 고치지 말 것). 스킨 추가: gen.py `SKINS`·`mascots.py` + `app.js SKINS` 두 곳. 캐릭터 테마의 큰 마스코트는 `js/mascots.js`(gen.py 생성)를 `app.js syncMascot()`가 왼쪽 아래 `#mascot`에 인라인 SVG로 띄워 CSS로 움직임(.mb 통통·.me 깜빡·.ma 손 흔들기·.mt 꼬리·.ms 물줄기·.mk 반짝이). 내 캐릭터 그림이 있으면 마스코트 대신 그 그림이 배경 스티커로 가만히(theme.js는 영문 소문자 이름이면 통과). 마스코트 그림은 `tools/skins/mascots.py`(2등신 몸통·찹쌀떡 머리·공용 부품 `mochi()`·`eyes()`·`body()`), 그리는 규칙은 `tools/skins/CHARACTER_GUIDE.md`. 그림은 `--art` 한 번만(스티커와 고르기 버튼 공유), 무늬는 `<use>`로 재사용.
- 내 캐릭터: 테마 창 '그림 넣기'로 사용자가 가진 그림을 넣으면 브라우저에서 최대 320px로 줄여 `sg_myart`(스티커)·`sg_mypat`(옅은 무늬, 선택)에 저장 → 왼쪽 아래 `#mascot`에 정지 그림(`<img>`)으로 + `html` 인라인 `--pat`로 무늬(색깔 테마와 함께 적용). 서버 업로드 없음, 기기마다 따로. 첫 적용은 `theme.js`, 로직은 `app.js` '내 캐릭터'.
- 스티커 위 글자색은 `--onc` 토큰. 캐릭터 테마는 `--pat`(배경 무늬)만 body 배경. 왼쪽 아래 캐릭터는 고정 배경이 아니라 `#mascot` 요소(z-index:49 — 카드·띠보다 위, 창·소개·게임보다 아래, 클릭은 통과, 자기 층) — 고정 배경은 스크롤마다 전체를 다시 그려서 뺌. `--art`는 테마 고르기 버튼 미리보기용. 애니메이션 규칙은 `tools/skins/ANIMATION_GUIDE.md`(9초 한 사이클: 숨쉬기→예비동작→점프→착지→출렁임, 머리가 늦게 따라옴, 탭 안 볼 땐 `html.away`로 멈춤).

## 소셜 (프로필 · DM · 게임)
- 헤더 오른쪽은 테마 버튼 `#btnTheme` + 목록 버튼 `#btnMenu`(☰↔✕). 누르면 `#hMenu.open` → `#hList`가 서랍(카드)처럼 펼쳐지고 각 줄은 아이콘+이름+설명: 위에서부터 프로필(`#btnMe`, 로그인하면 `.mi` 안이 아바타) · 테마(`#btnSkin`) · 설정(`#btnClass`, 반 설정) · QR(`#btnShare`) · 신고(`#btnReport` → `social.js openReport()`: 아이디·이유 입력, 로그인 필요). 항목 누르면 닫힘, 바깥 클릭·Esc로도 닫힘. 로직은 `app.js` `menu()`.
- DM은 헤더에 없음 → 오른쪽 아래 `#dmDock`. 900px 이상은 '메시지' 버튼(안 읽은 수 + 최근 대화 3명) → 떠 있는 창 `#dmPanel` 안에서 목록·대화(`renderDm(handle, box, panel)` 공용, 창 안 링크는 `data-pdm`). 900px 미만은 둥근 버튼 → `#dm` 화면. `#dm` 화면·게임 중엔 숨김(`body[data-view]`, `body.playing`).
- 화면: `#me`(내 프로필/로그인) · `#u/아이디`(남의 프로필) · `#dm`, `#dm/아이디` · `#game`. `go()`가 `/` 뒤를 인자로 넘김.
- 프로필 인스타 아이디(`users.insta`, 선택): 꾸미기에서 입력 → 서버가 @·인스타 주소를 떼고 아이디만 저장(영문·숫자·._ 30자 검사) → 프로필에 `.pinsta` 버튼(새 창으로 instagram.com/아이디). 인스타 API 연동은 개인 계정 불가라 링크 방식. 관리자 '프로필 정리'로 지울 수 있음.
- D1 바인딩 `DB`가 없으면 `/api/s/config`가 `{enabled:false}` → 화면에 '준비 중'만 보임.
- 선택: Pages 비밀 변수 `JOIN_CODE`를 넣으면 가입할 때 코드 필요(친구끼리만).
- 목록(AVATARS·COLORS·STICKERS)은 서버·`social.js` 둘 다 같게 유지. 게임 추가 시 서버 `GAMES`(허용 범위)와 `social.js`의 `GAMES` 둘 다 수정.
- 신고·정지·공지 등은 관리자 페이지 `/admin`에서 처리.

## 관리자 페이지 (/admin)
- 필요: D1 바인딩 `DB` + 사이트에 `developer` 계정. 그 계정의 계정 설정(⚙️)에만 '관리자 페이지' 버튼이 보임(`social.js`의 `ADMIN_HANDLE`, 서버와 같게). /admin에서 그 계정 비밀번호를 한 번 더 넣어야 들어감.
- 학과별 테스트 계정: 개발자 프로필의 '🧪 학과별로 보기'(콘텐츠과 2-1·미디어과 2-3·프로듀스과 2-5) → `POST /api/s/dev-switch`. 계정(`test_con`·`test_mi`·`test_pro`, `users.is_test=1`, `lib/db.js` `TEST_ACCOUNTS`)은 처음 누를 때 생성, 비밀번호 없음. 개발자 세션은 `sg_d` 쿠키에 보관했다가 '개발자로 돌아가기'로 복구. 이 기기의 반 설정도 바꿨다가 되돌림(`sg_class_dev`). `test_` 아이디는 가입 불가, 친구 찾기·관리 화면 통계에서 빠짐.
- DM은 **신고된 메시지와 앞뒤 5개만** 볼 수 있음(사생활 보호). 전체 DM 열람 기능은 일부러 없음.
- 정지(`bans`): 정지 즉시 세션 삭제 + 로그인 거부(사유·기간 표시). 소셜 `auth()`도 정지된 사람은 막음.
- 설정(`settings`): `join_code`(있으면 비밀 변수 JOIN_CODE보다 우선, ''이면 코드 없음) · `signup_open` · `dm_open` · `notice`(JSON).
- 공지: `/api/notice`(30초 캐시) → `app.js loadNotice()`가 `#notice` 띠로 표시. 학생이 닫으면 `sg_notice_x`에 그 공지 id 저장. 공지에 '자세한 내용'(`body`, 최대 2000자)이 있으면 띠 끝에 '자세히 ›'가 붙고, 누르면 `SOC.openNotices(id)`로 공지 목록(넓은 창 `.sheet.wide`)이 열리며 그 공지 본문이 펼쳐짐. 공지 창 모양(`.ntlist .nt-t`/`.ntb`): 제목은 굵은 큰 글씨 한 줄(넘치면 …), 내용 2줄 미리보기 → '자세히 보기'로 펼침, 펼친 내용 아래 왼쪽 작은 '접기'. 업데이트 소식도 같은 모양. 지금 공지의 제목·내용만 날짜 그대로 고치기: `POST noticeedit`. 관리자 공지 화면에서 지난 공지 기록 삭제(`POST noticedel`, 지금 걸린 공지는 불가).
- 밸런스: `balance_custom`에 날짜별 질문 덮어쓰기(평일 10일 표시). 지금 질문을 바꾸면 그날 표·댓글 초기화. 지금 질문 댓글 목록·삭제(`balancecdel`).

## 의견 · 공지 버튼 (헤더)
- 💡 의견(노란 알약, 좁은 화면은 아이콘만) → `social.js openFeedback()` → `POST /api/s/feedback`(로그인 필요, 1시간 6번) → `feedback` 표 → 관리자 '💡 의견' 탭에서 확인·메모·삭제. 탈퇴·계정 삭제 시 같이 지움.
- 📢 공지 → `openNotices()` → `GET /api/notices`(최근 20개, 30초 캐시). 관리자가 공지를 올리면 `notices` 표에도 기록(앞 공지는 끝난 것으로). 마지막으로 본 공지 id `sg_notice_seen`과 다르면 버튼에 빨간 점. 목록을 열면 닫았던 띠 공지도 다시 보임.

## 구글 로그인 · DM 받는 범위 · 카톡
- 구글(선택 사항 — 기본은 아이디·비밀번호, 구글 버튼은 폼 아래 '원하면'): `wrangler.jsonc`의 `vars.GOOGLE_CLIENT_ID`(공개 값)가 있어야 버튼이 보임. 화면은 `social.js`의 `.gbtn[data-gintent]`(login·link·withdraw) 자리에 GIS 버튼을 그림 → `POST /api/s/google`(처음이면 `need:'signup'` → 아이디·닉네임 받고 가입, 비밀번호는 무작위) · `google-link`(연결/해제) · 탈퇴는 구글로 본인 확인 가능. 서버는 tokeninfo로 aud·iss·exp 확인, `users.google_sub`만 저장(이메일 X). CSP에 accounts.google.com, COOP는 `same-origin-allow-popups`.
- 아이디·비밀번호 찾기(2026-10-23): 로그인 폼 '아이디·비밀번호를 잊었어요'(`[data-forgot]`, 구글 켜졌을 때만) → 구글 버튼(`data-gintent="reset"`) → `POST /api/s/google-reset`: credential만 보내면 연결된 아이디 반환, `pw`도 보내면 새 비밀번호로 바꾸고 **그 계정 세션 전부 삭제** 후 이 기기만 로그인(구글 확인 후 IP당 1시간 60번, 계정당 1시간 5번 변경). 개발자(`developer`)·테스트 계정은 구글 연결·구글 로그인·구글 재설정 모두 서버에서 거부(`noGoogle`) — 구글이 털려도 관리자 권한이 넘어가지 않게. 구글로 처음 로그인한 기기에 '구글에서도 로그아웃' 안내 1회(`sg_gtip`).
- 모든 기기에서 로그아웃: 계정 설정 버튼 → `POST /api/s/logout-all`(이 기기 포함 세션 전부 삭제).
- 닉네임: 다른 사람과 같으면 가입·변경 불가(띄어쓰기·대소문자 무시, 테스트 계정 제외), '개발자·관리자·운영자·developer·admin' 등은 금지(`nameIssue`). 예전부터 겹쳐 있던 닉네임은 그대로 두고, 바꿀 때만 검사.
- DM 받는 범위: `users.dm_pref` 0 맞팔만(기본) · 1 나를 팔로우한 사람 · 2 누구나. 서버 `dmAllowed()`, 계정 설정에서 학생이 고름. 차단은 항상 막음.
- 카톡 안 브라우저로 열리면 `theme.js`가 `kakaotalk://web/openExternal`로 기본 브라우저로 넘김.

## 업데이트 소식 (주간 패치노트)
- `public/patchnotes.json`(최신이 맨 앞인 배열 `{id,date,title,items[]}`) → 📢 공지 창 아래 '🛠 업데이트 소식'. 새 id면 📢 버튼에 빨간 점(`sg_patch_seen`).
- 일요일 21시 예약 작업이 지난주 `git log`로 초안(`tools/patchnotes/draft-YYYY-wWW.json`)을 만들어 하율에게 컨펌 요청 → 승인(`approved: true`)된 초안만 월요일 6시 예약 작업이 위 파일 맨 앞에 넣어 배포. 절차는 `tools/patchnotes/WEEKLY.md`.

## 모니터링 (/admin → 📡 모니터링)
- API `GET /api/admin/monitor` 하나로 모아 받음. DM은 **개수만**(내용·누가 누구에게는 없음).
- 서버 오류: 세 API의 catch와 나이스 프록시 실패가 `lib/db.js logErr()` → `errs` 표(14일·500줄 보관). D1 한도 초과 오류는 기록하지 않음(쓸 수 없으니까).
- 'DB 저장' 상태는 `settings`의 `probe` 줄을 한 번 써 보고 판단(계정 전체 무료 한도는 숫자로 알 수 없음).

## 보안·개인정보 원칙
- IP는 원문 저장 금지: 횟수 제한은 `ipKey()`(해시), 관리 기록은 `maskIp()`. IP 기준 한도는 학교 와이파이(한 반이 IP 공유)를 고려해 넉넉히, 계정 보호는 아이디 기준.
- DM은 관리자도 전체 열람 불가. 메시지 신고는 신고자와 대상의 대화 속 대상 메시지만 허용(남의 대화 끌어오기 방지).
- 탈퇴·계정 삭제 시 계정·프로필·DM·게임 기록·본인이 한 신고 삭제(본인을 향한 신고는 남김). 저장 항목이 바뀌면 `index.html` 이용 안내의 개인정보 문단도 같이 고칠 것.
