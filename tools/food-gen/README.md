# 급식 음식 이미지 만들기 (무료)

Cloudflare Workers AI **무료 사용량**(하루 10,000 뉴런)으로 음식 사진을 만든다. 무료 플랜은 한도를 넘으면 멈출 뿐 요금이 나가지 않는다. 이 워커는 **배포하지 않고 로컬에서만** 돌린다.

```bash
cd tools/food-gen && npx wrangler@4 dev --port 8799
```

다른 터미널에서 (프롬프트 끝에 아래 공통 꼬리를 붙인다):

```bash
curl -G --data-urlencode "p=<음식 설명> Overhead top-down close-up food photography, the food fills the entire frame edge to edge, no plate, no background visible. Soft natural daylight from the upper left, appetizing, realistic texture, high detail." http://localhost:8799/ -o 결과.jpg
```

- 기본 모델 FLUX.1 schnell. 밥처럼 잘 안 나오는 건 `--data-urlencode "m=@cf/leonardo/lucid-origin"`.
- 결과는 384×384 WebP(품질 76, 20~30KB)로 줄여 `public/food/<영문-이름>.webp`에 넣고, `public/js/food.js`의 `FOOD_IMG`에 `'메뉴이름': '영문-이름'` 한 줄 추가.
- 메뉴와 다른 재료가 나오면 쓰지 말고 다시 만든다(이름과 다른 음식이 보이면 안 됨).
