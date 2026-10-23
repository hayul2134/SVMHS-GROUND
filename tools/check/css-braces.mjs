// 배포 전 점검: CSS 중괄호 짝 검사 (짝 없는 '}'가 있으면 그 뒤 @media 묶음이 통째로 무시됨 — 2026-10-24 휴대폰 첫 화면 깨짐 원인)
// 사용: node tools/check/css-braces.mjs
import fs from 'node:fs';
let bad = 0;
for (const f of ['public/css/style.css', 'public/admin/admin.css']) {
  if (!fs.existsSync(f)) continue;
  const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let d = 0, line = 1;
  for (const ch of css) {
    if (ch === '\n') line++;
    else if (ch === '{') d++;
    else if (ch === '}' && --d < 0) { console.log(`${f}:${line} 짝 없는 }`); d = 0; bad++; }
  }
  if (d) { console.log(`${f}: 닫히지 않은 { ${d}개`); bad++; }
}
console.log(bad ? `문제 ${bad}개` : 'CSS 중괄호 정상'); process.exit(bad ? 1 : 0);
