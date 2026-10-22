# 주간 업데이트 소식(패치노트) 자동 게시 절차

매주 월요일 아침 예약 작업이 이 문서대로 지난주(월~일) 바뀐 점을 학생용 '🛠 업데이트 소식'으로 **바로 게시**합니다.
Claude Code·Claude 일반 대화 어디서 작업했든 모두 이 저장소 main에 커밋되므로, 커밋 기록이 유일한 근거입니다.

## 1. 기간과 id
- 기간: 실행일(한국 시간) 기준 **지난주 월요일 00:00 ~ 일요일 23:59**.
- id: 그 주의 ISO 주차 `YYYY-wWW` (예: 2026-10-19 ~ 10-25 → `2026-w43`).
- `public/patchnotes.json`에 같은 id가 이미 있으면 **아무것도 하지 않고 끝냄**(중복 게시 방지).
- date 표기: `10월 셋째 주 (10/19 ~ 10/25)` — 'N째 주'는 그 주 월요일이 그 달의 몇 번째 월요일인지.

## 2. 근거 모으기
```
git fetch -q --depth=1000 origin main && git reset -q --hard origin/main
git log --since="<월요일> 00:00 +0900" --until="<일요일> 23:59:59 +0900" --format='%ad %s%n%b' --date=format:'%m-%d %H:%M'
```
- 제목만으로 애매하면 `git show --stat <커밋>`으로 무엇이 바뀌었는지 확인합니다. 추측으로 쓰지 않습니다.
- `tools/patchnotes/draft-*.json`이 있으면 참고만 하고, 게시 후 삭제합니다.

## 3. 무엇을 넣고 뺄지
- **넣음**: 학생이 화면에서 느끼는 변화(새 기능, 바뀐 화면, 고친 불편, 체감되는 속도·안정성).
- **뺌**: 개발자(hayuldeveloper) 계정·관리자 페이지(/admin)·모니터링 전용 변경, `tools/`·문서(CLAUDE.md, CODEMAP.md)·캐시·배포 설정, 비밀 변수·한도 숫자·보안 구현 세부(악용 정보가 될 수 있음 — "보안을 더 튼튼하게 했어요" 정도로만).
- 같은 기능을 여러 번 고쳤으면 **최종 상태 하나만** 씁니다(중간에 만들었다 바꾼 것은 쓰지 않음).
- 학생이 볼 변화가 하나도 없으면 게시하지 않고 끝냅니다.

## 4. 문구 스타일
- 학생 친구에게 말하듯 친근한 '~요'체, 한 항목 1~2문장.
- 항목마다 맨 앞에 내용에 맞는 이모지 1개, 문장 중간·끝에 이모티콘(예: (๑˃ᴗ˂)ﻭ, ٩(ˊᗜˋ*)و, (｡•̀ᴗ-)✧, ^^)과 이모지를 **다양하게**(같은 것 반복 피하기).
- 어디서 쓰는지 알려 주기: "☰ 메뉴 → [테마]", "홈 급식판 ‹ › 버튼" 처럼.
- 항목 수 5~15개, 중요한(눈에 띄는) 것부터. 과장·사실 아닌 약속 금지.
- title 예: `✨ 이번 주 업데이트 소식 ✨ (๑˃ᴗ˂)ﻭ` — 매주 조금씩 다르게.

## 5. 게시
- `public/patchnotes.json`은 **최신이 맨 앞**인 배열. 새 항목 `{ "id", "date", "title", "items": [...] }`을 맨 앞에 넣고, 기존 항목은 그대로 둡니다.
- `python3 -c "import json;json.load(open('public/patchnotes.json'))"`로 JSON 확인.
- 커밋(작성자 `-c user.name=hayul2134 -c user.email=hayulbusiness@gmail.com`, 메시지 `업데이트 소식 YYYY-wWW 게시`) → `git pull -q --rebase origin main` → `git push -q origin HEAD:main`.
- 1~3분 뒤 WebFetch로 `https://svmhs-ground.pages.dev/patchnotes.json`에 새 id가 보이는지 확인(셸 curl은 프록시에 막힐 수 있음).
