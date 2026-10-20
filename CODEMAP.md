# SVMHS GROUND — 코드 지도

서울영상고 학생용 급식·시간표·학사일정·D-day 사이트. **Cloudflare Pages**로 배포된다 (`main`에 push → 자동 배포 → https://svmhs-ground.pages.dev).
빌드 과정 없음(`wrangler.jsonc`의 `pages_build_output_dir`): `public/`이 그대로 배포되고, `functions/`는 Pages Functions(서버 코드)가 된다.

## 파일
| 경로 | 역할 |
|---|---|
| `public/index.html` | 화면 뼈대 전부 (아이콘 스프라이트 · 헤더/탭 · 5개 view · 모달 3개). 인라인 스크립트·`style=""` 금지(CSP) |
| `public/css/style.css` | 스타일. 맨 위 목차 참고. 색은 `:root` 토큰만 바꾸면 라이트/다크 같이 바뀜 |
| `public/js/theme.js` | 첫 화면 깜빡임 방지용 테마 적용 (일반 스크립트, `<head>`에서 먼저 실행) |
| `public/js/app.js` | 화면 로직. 홈: 첫 화면(`#bigclock`)은 시계 + 왼쪽 `#sMeal`(지금 급식) · 오른쪽 `#sTT`(오늘 시간표)만. 그 아래 `#more`에 현재 시각·날짜·오늘 일정 알림·진행률 카드·`#play`(밸런스 게임). 1280px 이상은 3단, 700~1279px는 시계 위·카드 2단, 그 아래는 세로 · 아래 `#weekTT`(주간 시간표, `fillWeek` 공용). `/* ===== 섹션 ===== */` 단위: 급식 · 시간표 · 학사일정 · D-day · 모달 · 공유 · 반 설정 · 안내 · 테마 · 시작 |
| `public/js/neis.js` | 나이스 API 호출 + 브라우저 캐시(3시간). `getMeals / getTimetable / getSchedule` |
| `public/js/util.js` | 날짜·`esc()`·`store`(localStorage, 키 앞 `sg_`)·토스트 |
| `public/js/qr.js` | QR 코드 SVG 생성기 (외부 라이브러리 없음) |
| `public/js/social.js` | 소셜 화면 전부: 로그인/가입 · 프로필 꾸미기(아바타·색·스티커) · 친구 찾기/팔로우 · DM(3초 폴링) · 미니게임 3종(반응속도·1 to 25·컷 타이밍) · 랭킹(오늘/친구/반 대항전/역대). `app.js`가 시작할 때 동적 import → `init(SOC)` |
| `functions/api/s/[[path]].js` | 소셜 API `/api/s/*` (D1 `DB`, 테이블 자동 생성). 쿠키 세션(HttpOnly) · PBKDF2 비밀번호 · 횟수 제한 · DM은 맞팔끼리만 · 차단/신고 · 게임 기록 범위 검사 |
| `functions/api/[[path]].js` | `/api/config`, `/api/neis/<서비스>` 프록시(허용 서비스·파라미터 화이트리스트, 숫자만 통과) · `/api/vote` 급식 인기투표 · `/api/balance` 오늘의 밸런스 게임(둘 다 D1 `DB`, 테이블 자동 생성) |
| `public/_headers` | 보안 헤더(CSP 등) · 이미지 캐시 |
| `public/manifest.webmanifest`, `public/icons/` | 홈 화면에 추가(PWA) 정보 |
| `public/og-image.jpg` | 카톡 등 링크 미리보기 이미지 (1200×630) |
| `public/404.html`, `robots.txt` | 기타 (검색 노출 차단: noindex) |

## 규칙
- 나이스 응답·사용자 입력을 `innerHTML`에 넣을 땐 **반드시 `esc()`**.
- 외부 스크립트/스타일을 새로 쓰면 `public/_headers`의 CSP에 도메인 추가해야 동작한다.
- 새 나이스 서비스나 파라미터를 쓰려면 `functions/api/[[path]].js`의 `SERVICES`에 먼저 추가.
- 종 시간(시정표)은 `app.js`의 `BELL` 배열. 월·화·수 7교시, 목·금 6교시. 학사일정 휴업일·공휴일은 자동으로 쉬는 날 처리. 시간표가 있으면 마지막 교시는 시간표 기준(요일 교체 대응). 기기 시계는 서버 Date 헤더로 보정(util `now()`).
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

## 소셜 (프로필 · DM · 게임)
- 화면: `#me`(내 프로필/로그인) · `#u/아이디`(남의 프로필) · `#dm`, `#dm/아이디` · `#game`. `go()`가 `/` 뒤를 인자로 넘김.
- D1 바인딩 `DB`가 없으면 `/api/s/config`가 `{enabled:false}` → 화면에 '준비 중'만 보임.
- 선택: Pages 비밀 변수 `JOIN_CODE`를 넣으면 가입할 때 코드 필요(친구끼리만).
- 목록(AVATARS·COLORS·STICKERS)은 서버·`social.js` 둘 다 같게 유지. 게임 추가 시 서버 `GAMES`(허용 범위)와 `social.js`의 `GAMES` 둘 다 수정.
- 신고는 D1 `reports` 테이블에 쌓임(관리 화면 없음 → Cloudflare 대시보드 D1 콘솔에서 `SELECT * FROM reports`).
