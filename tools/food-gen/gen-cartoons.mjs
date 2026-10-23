// 카툰 음식 그림 한꺼번에 만들기 (로컬 생성 서버 localhost:8799 필요 → README)
// node gen-cartoons.mjs <저장 폴더> [키...]   — 이미 있는 파일은 건너뜀. 무료 한도가 차면 멈춤(다음 날 다시 실행)
// MAX=40 node gen-cartoons.mjs ... → 요청을 40번까지만 보냄 (FLUX schnell 8단계 한 장 ≈ 96뉴런. 하루 무료 10,000 중 남겨 둘 몫이 있을 때)
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { LIST, STYLE } from './cartoon-list.mjs';

const out = process.argv[2];
if (!out) { console.error('저장 폴더를 적어 주세요'); process.exit(1); }
mkdirSync(out, { recursive: true });
const keys = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(LIST);
const todo = keys.filter(k => LIST[k] && !existsSync(`${out}/${k}.jpg`));
console.log(`만들 것 ${todo.length}개`);

let stop = false, sent = 0;
const MAX = +process.env.MAX || Infinity;
async function one(k) {
  if (sent >= MAX) { stop = true; return; }
  sent++;
  const u = new URL('http://localhost:8799/');
  u.searchParams.set('p', `${LIST[k]}. ${STYLE}`);
  const r = await fetch(u);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!r.ok) {
    const msg = buf.toString();
    const quota = /4006|daily free allocation/i.test(msg);   // 무료 한도 (오류 페이지가 HTML이라 전체에서 찾음)
    console.log(`✗ ${k}: ${quota ? '무료 한도 초과' : msg.replace(/<[^>]*>/g, ' ').trim().slice(0, 120)}`);
    if (quota) stop = true;
    return;
  }
  writeFileSync(`${out}/${k}.jpg`, buf);
  console.log(`✓ ${k}`);
}
for (let i = 0; i < todo.length && !stop; i += 3) await Promise.all(todo.slice(i, i + 3).map(one));
console.log(sent >= MAX ? `요청 ${MAX}번 상한에서 멈춤` : stop ? '무료 한도에 걸려 멈춤 — 내일 다시 실행' : '끝');
