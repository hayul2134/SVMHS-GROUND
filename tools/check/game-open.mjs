// 게임 열기 검사(2026-11-01 하율 "패치할 때 이런 일 다시는 없게") — 게퍼 10 소리를 바꾸다 그리기·입력 코드가 통째로 지워져
// '게임을 여는 중에 문제가 생겼어요'가 뜬 사고 재발 방지. 문법 검사(node --check)는 통과했지만 실행하자마자 'down is not defined'.
// 실제 브라우저(Playwright Chromium)에서 게임 모듈을 하나씩 불러와 만들고 → 시작 → 화면 가운데를 드래그·키 입력 → 0.8초 돌려 보고
// 예외·페이지 오류가 하나라도 있으면 ❌(종료 코드 1). public/js 아래 클라이언트 파일을 고쳤으면 push 전에 반드시:
//   node --no-warnings tools/check/game-open.mjs
// 새 게임을 만들면 아래 GAMES에 한 줄 추가.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
let pw;
try { pw = await import('playwright'); } catch {
  const g = execSync('npm root -g').toString().trim();
  pw = await import(pathToFileURL(path.join(g, 'playwright/index.mjs')).href);
}

// 게임마다 여는 방법(브라우저 안에서 실행, el = 화면 크기 칸, cv = 그 안 캔버스)
const GAMES = {
  film: `const M = (await import('/js/film.js')).createFilm(el, O); M.start?.(); return M;`,
  n25: `const m = await import('/js/n25.js'); el.innerHTML = m.html(false); return m.run(el, O);`,
  cut: `const m = await import('/js/cut.js'); el.innerHTML = m.html(false); return m.run(el, O);`,
  stair: `const M = (await import('/js/stair.js')).createStair(cv, O); M?.start?.(); return M;`,
  runner: `const R = await import('/js/runner.js'); const M = R.createRunner(cv, R.randomChar(), new Proxy({ best: () => 0 }, { get: (t, k) => k in t ? t[k] : O[k] })); M?.start?.(); return M;`,
  blast: `const M = (await import('/js/blast.js')).createBlast(el, O); M?.start?.(); return M;`,
  chase: `const M = (await import('/js/chase.js')).createChase(el, O); M?.start?.(); return M;`,
  dance: `const M = (await import('/js/dance.js')).createDance(el, O); M?.start?.(); return M;`,
  gear: `const M = (await import('/js/gear.js')).createGear(cv, O); M?.start?.(); return M;`,
  color: `const M = (await import('/js/color.js')).createColor(el, O); M?.start?.(); return M;`,
  commute: `const M = (await import('/js/commute.js')).createCommute(el, O); M?.start?.(); return M;`,
  ball: `const M = (await import('/js/ball.js')).createBall(el, O); M?.start?.(); return M;`,
  judge: `const M = (await import('/js/judge.js')).createJudge(el, O); M?.start?.(); return M;`,
  rhythm: `const M = (await import('/js/rhythm.js')).createRhythm(el, O); M?.start?.(); return M;`,
  mine: `return (await import('/js/casual.js')).mount('mine', el);`,
  snake: `return (await import('/js/casual.js')).mount('snake', el);`,
  n2048: `return (await import('/js/casual.js')).mount('2048', el);`,
};

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/t.html') { s.writeHead(200, { 'content-type': 'text/html' }); s.end('<!doctype html><meta charset=utf-8><body></body>'); return; }
  const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(0);
const base = `http://localhost:${srv.address().port}`;
const browser = await pw.chromium.launch();
let bad = 0; const PERF = !!process.env.PERF, perf = [];
for (const [name, code] of Object.entries(GAMES)) {
  // PERF=1: 보급형 패드 흉내(배율 1.5 · CPU 4배 느리게)로 3초 동안 프레임 수도 잼 (LITE=1이면 가벼운 모드)
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: PERF ? 1.5 : 1 });
  if (PERF) { await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 }); if (process.env.LITE) await page.addInitScript(() => { addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('lite')); window.SG_DPR = Math.min(devicePixelRatio || 1, 1.25); }); }
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|404|net::/.test(m.text())) errs.push(m.text()); });
  await page.goto(base + '/t.html');
  const r = await page.evaluate(async code => {
    try {
      const el = document.createElement('div'); el.className = 'parea'; el.style.cssText = 'width:1000px;height:700px;position:relative';
      const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; el.append(cv); document.body.append(el);
      const noop = () => {};
      const O = new Proxy({ best: 0, sound: false, seed: async () => null, onOver: noop, onSound: noop, quick: false }, { get: (t, k) => k in t ? t[k] : (typeof k === 'string' && /^on[A-Z]/.test(k) ? noop : undefined) });
      const M = await new Function('el', 'cv', 'O', `return (async () => { ${code} })()`)(el, cv, O);
      window.__M = M; return 'ok';
    } catch (e) { return 'ERR ' + (e && e.stack || e); }
  }, code);
  if (r !== 'ok') errs.push(r);
  else {   // 입력 몇 번 + 잠깐 돌려 봄(그리기·입력 처리 코드가 실제로 실행되게)
    await page.mouse.move(500, 350); await page.mouse.down(); await page.mouse.move(620, 420, { steps: 5 }); await page.mouse.up();
    for (const k of ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter']) await page.keyboard.press(k).catch(() => {});
    await page.waitForTimeout(800);
    if (PERF) {
      const f = page.evaluate(() => new Promise(r => { let n = 0, slow = 0, last = performance.now(); const t0 = last; const k = t => { n++; if (t - last > 25) slow++; last = t; if (t - t0 < 3000) requestAnimationFrame(k); else r(`${Math.round(n * 1000 / (t - t0))}fps 느린 프레임 ${slow}`); }; requestAnimationFrame(k); }));
      for (let i = 0; i < 6; i++) { await page.keyboard.press(['ArrowLeft', 'ArrowRight', 'Space'][i % 3]).catch(() => {}); await page.mouse.click(500 + i * 20, 350).catch(() => {}); await page.waitForTimeout(400); }
      perf.push(name + ' ' + await f);
    }
    await page.evaluate(() => { try { window.__M?.destroy?.(); } catch (e) { throw e; } }).catch(e => errs.push('destroy: ' + e.message));
  }
  console.log((errs.length ? '❌ ' : '✅ ') + name + (errs.length ? '\n   ' + errs.slice(0, 3).join('\n   ') : ''));
  if (errs.length) bad++;
  await page.close();
}
await browser.close(); srv.close();
if (PERF) console.log(perf.join('\n'));
if (bad) { console.log(`\n❌ 게임 열기 검사 실패 ${bad}개 — push 금지`); process.exit(1); }
console.log('\n✅ 게임 열기 검사 통과 (' + Object.keys(GAMES).length + '개)');
