# 급식 음식 이미지 만들기 (무료)

Cloudflare Workers AI **무료 사용량**(하루 10,000 뉴런)으로 음식 사진을 만든다. 무료 플랜은 한도를 넘으면 멈출 뿐 요금이 나가지 않는다. 이 워커는 **배포하지 않고 로컬에서만** 돌린다.

```bash
cd tools/food-gen && npx wrangler@4 dev -c wrangler.toml --port 8799
```

다른 터미널에서 (프롬프트 끝에 아래 공통 꼬리를 붙인다):

```bash
curl -G --data-urlencode "p=<음식 설명> Overhead top-down close-up food photography, the food fills the entire frame edge to edge, no plate, no background visible. Soft natural daylight from the upper left, appetizing, realistic texture, high detail." http://localhost:8799/ -o 결과.jpg
```

- 기본 모델 FLUX.1 schnell. 밥처럼 잘 안 나오는 건 `--data-urlencode "m=@cf/leonardo/lucid-origin"`.
- 결과는 384×384 WebP(품질 76, 20~30KB)로 줄여 `public/food/<영문-이름>.webp`에 넣고, `public/js/food.js`의 `FOOD_IMG`에 `'메뉴이름': '영문-이름'` 한 줄 추가.
- 메뉴와 다른 재료가 나오면 쓰지 말고 다시 만든다(이름과 다른 음식이 보이면 안 됨).

## 카툰 그림 한꺼번에 (지금 쓰는 방식)
1. 생성 서버를 켠 상태에서 `node gen-cartoons.mjs <원본 저장 폴더>` → `cartoon-list.mjs`의 키를 순서대로 만듦(이미 있는 건 건너뜀). 하루 무료 한도(약 70장)에 걸리면 멈추니 다음 날(한국 9시 이후) 다시 실행.
2. 결과를 눈으로 확인 — 얼굴이 그려지거나 글자가 들어가거나 메뉴와 다르면 그 파일을 지우고 다시 실행.
3. `python3 to-webp.py <원본 폴더> ../../public/food/c` → 흰 배경을 투명하게 지우고 256px WebP로 저장.
4. `public/js/food.js`의 `CARTOON` 목록에 새 키 추가(폴더의 파일 이름들).
