# SVMHS GROUND — 코드 지도

서울영상고 학생용 급식·시간표·학사일정·D-day 사이트. **Cloudflare Pages**로 배포된다 (`main`에 push → 자동 배포 → https://svmhs-ground.pages.dev).
빌드 과정 없음(`wrangler.jsonc`의 `pages_build_output_dir`): `public/`이 그대로 배포되고, `functions/`는 Pages Functions(서버 코드)가 된다.

## 파일
| 경로 | 역할 |
|---|---|
| `public/index.html` | 화면 뼈대 전부 (아이콘 스프라이트 · 헤더/탭 · 5개 view · 모달 3개). 인라인 스크립트·`style=""` 금지(CSP) |
| `public/css/style.css` | 스타일. 맨 위 목차 참고. 색은 `:root` 토큰만 바꾸면 라이트/다크 같이 바뀜 |
| `public/js/theme.js` | 첫 화면 깜빡임 방지용 테마 적용 (일반 스크립트, `<head>`에서 먼저 실행) |
| `public/js/app.js` | 화면 로직. `/* ===== 섹션 ===== */` 단위: 급식 · 시간표 · 학사일정 · D-day · 모달 · 공유 · 반 설정 · 안내 · 테마 · 시작 |
| `public/js/neis.js` | 나이스 API 호출 + 브라우저 캐시(3시간). `getMeals / getTimetable / getSchedule` |
| `public/js/util.js` | 날짜·`esc()`·`store`(localStorage, 키 앞 `sg_`)·토스트 |
| `public/js/qr.js` | QR 코드 SVG 생성기 (외부 라이브러리 없음) |
| `functions/api/[[path]].js` | `/api/config`, `/api/neis/<서비스>` 프록시. 허용 서비스·파라미터 화이트리스트, 숫자만 통과 |
| `public/_headers` | 보안 헤더(CSP 등) · 이미지 캐시 |
| `public/manifest.webmanifest`, `public/icons/` | 홈 화면에 추가(PWA) 정보 |
| `public/og-image.jpg` | 카톡 등 링크 미리보기 이미지 (1200×630) |
| `public/404.html`, `robots.txt`, `sitemap.xml` | 기타 |

## 규칙
- 나이스 응답·사용자 입력을 `innerHTML`에 넣을 땐 **반드시 `esc()`**.
- 외부 스크립트/스타일을 새로 쓰면 `public/_headers`의 CSP에 도메인 추가해야 동작한다.
- 새 나이스 서비스나 파라미터를 쓰려면 `functions/api/[[path]].js`의 `SERVICES`에 먼저 추가.
- 학교 코드(B10 / 7010795)는 서버(`SCHOOL`)에 고정. 반 개수는 `app.js`의 `MAX_CLASS`.

## 인증키 (NEIS_KEY)
없어도 동작하지만 요청당 5건 제한 → 시간표 5교시까지만 보임. 넣으려면
Cloudflare 대시보드 → Workers & Pages → `svmhs-ground` → 설정 → 변수 및 비밀 → **Production에 비밀(Secret) `NEIS_KEY`** 추가 후 재배포.
키는 절대 코드에 넣지 않는다.

## 로컬 실행
```bash
npx wrangler@4 pages dev --port 8788
```
→ http://localhost:8788 (functions 포함). 키 테스트는 `.dev.vars`에 `NEIS_KEY=...` (git 제외됨).
