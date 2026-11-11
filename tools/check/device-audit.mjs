// 기기별 화면·게임 점검(2026-11-12) — 폰·태블릿 9종(DEVS로 고르기) × 화면 10개 × 게임(GAMES)을 로그인한 학생으로 열고, 넘침·글자 잘림·작은 버튼·
// 판/버튼이 화면 밖·페이지 오류를 찍고 캡처를 OUT 폴더에 남긴다. 로컬 서버 = public/ + 진짜 서버 코드(node:sqlite로 D1 흉내), 공개 깃발은 실사이트 /api/s/patch.
//   node --no-warnings tools/check/device-audit.mjs                 (전부, 약 25분)
//   DEVS=폰SE,폰가로 GAMES=blast,dance node --no-warnings tools/check/device-audit.mjs
// '버튼이 화면 밖'은 스크롤 아래 '내 최고' 칸처럼 정상인 것도 섞여 있으니 캡처로 확인할 것.
// 보급형 패드 성능 측정(2026-11-03 하율 "삼성 보급형 패드에서도 돌아가게")
// 실행: node --no-warnings tools/check/perf-pad.mjs [화면…]   예) node tools/check/perf-pad.mjs home games
// 갤럭시 탭 A9+ 기준 흉내: 화면 1280×800 · 배율 1.5 · 터치 · CPU 4배 느리게(Helio G99/SD695급)
// 로컬 서버가 public/ 정적 파일 + /api/s/*(진짜 서버 코드, node:sqlite로 D1 흉내)를 돌리고, 나이스(/api/*)는 빈 응답.
// PRE=1 이면 처음 온 사람(소개 화면), 아니면 로그인해 둔 학생. 새 학생으로 가입 → 홈 첫 표시까지 걸린 시간, 긴 작업(50ms↑) 합, 홈에서 3초 동안 프레임 수, 스크롤 프레임을 잼.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = process.env.REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT = path.join(REPO, 'public');
const CPU = +(process.env.CPU || 4);
let pw;
try { pw = await import('playwright'); } catch {
  const g = execSync('npm root -g').toString().trim();
  pw = await import(pathToFileURL(path.join(g, 'playwright/index.mjs')).href);
}

const sq = new DatabaseSync(':memory:');
const norm = a => a.map(x => x === undefined ? null : typeof x === 'boolean' ? +x : x);
class Stmt {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.sql, norm(a)); }
  _p() { return sq.prepare(this.sql); }
  async first(col) { const r = this._p().get(...this.args); return r == null ? null : col ? r[col] : { ...r }; }
  async all() { return { results: this._p().all(...this.args).map(r => ({ ...r })), success: true, meta: {} }; }
  async run() { const i = this._p().run(...this.args); return { success: true, meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } }; }
  async raw() { return this._p().all(...this.args).map(r => Object.values(r)); }
}
const DB = {
  prepare: sql => new Stmt(sql),
  async batch(list) { const out = []; for (const s of list) out.push(/^\s*(SELECT|WITH)|RETURNING/i.test(s.sql) ? await s.all() : await s.run()); return out; },
  async exec(sql) { sq.exec(sql); return { count: 1 }; },
};
const api = await import(pathToFileURL(path.join(REPO, 'functions/api/s/[[path]].js')).href);

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer(async (q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/api/s/patch') { s.writeHead(200, { 'content-type': 'application/json' }); s.end(PATCHJ); return; }
  if (u.startsWith('/api/s/')) {
    const body = await new Promise(r => { let b = ''; q.on('data', c => b += c); q.on('end', () => r(b)); });
    const h = { ...q.headers, origin: 'https://svmhs-ground.pages.dev', 'cf-connecting-ip': '10.0.0.1' };
    const req = new Request('https://svmhs-ground.pages.dev' + q.url, { method: q.method, headers: h, body: /GET|HEAD/.test(q.method) ? undefined : body });
    try {
      const res = await api.onRequest({ request: req, env: { DB }, params: { path: u.slice(7).split('/') } });
      const hd = {}; res.headers.forEach((v, k) => { if (k !== 'set-cookie') hd[k] = v; });
      const sc = res.headers.get('set-cookie'); if (sc) hd['set-cookie'] = sc.replace(/;\s*Secure/i, '').replace(/;\s*Domain=[^;]+/i, '');
      s.writeHead(res.status, hd); s.end(Buffer.from(await res.arrayBuffer()));
    } catch (e) { s.writeHead(500); s.end(String(e)); }
    return;
  }
  if (u.startsWith('/api/')) { s.writeHead(200, { 'content-type': 'application/json' }); s.end('{}'); return; }
  let f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(0);
const base = `http://localhost:${srv.address().port}`;
// 실사이트에 공개된 게임 목록(공지 깃발) — 읽기 전용 GET. PATCH=파일 경로로 대신할 수 있음
const PATCHJ = process.env.PATCH ? fs.readFileSync(process.env.PATCH) : Buffer.from(await (await fetch('https://svmhs-ground.pages.dev/api/s/patch')).text());
const sig = await fetch(base + '/api/s/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: 'vp_audit1', name: '화면검사', pw: 'zq8!kd02xa', grade: 2, cls: 3, club: '' }) });
const ck = (sig.headers.get('set-cookie') || '').match(/^([^=]+)=([^;]*)/);
const OUT = process.env.OUT || fs.mkdtempSync('/tmp/svmhs-audit-'); console.log('캡처 폴더:', OUT);
const DEV = [
  ['폰SE', 375, 667, 2, true], ['폰S24', 360, 780, 3, true], ['아이폰15', 393, 852, 3, true], ['폰가로', 852, 393, 3, true],
  ['아이패드미니', 768, 1024, 2, true], ['아이패드', 820, 1180, 2, true], ['아이패드가로', 1180, 820, 2, true], ['갤탭A9가로', 1280, 800, 1.5, true], ['갤탭세로', 800, 1280, 1.5, true],
];
const only = process.env.DEVS ? process.env.DEVS.split(',') : null;
const VIEWS = ['home', 'meal', 'tt', 'cal', 'dday', 'game', 'me', 'hall', 'gacha', 'ending'];
const GAMES = (process.env.GAMES || 'home,reaction,num25,cut,stair,film,gear,blast,chase,dance,color,commute,ball,c_mine,c_snake,c_n2048').split(',');
const browser = await pw.chromium.launch();
// 화면 밖으로 삐져나간 보이는 요소(잘라 주는 부모가 없는 것)
const PROBE = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push(`가로 스크롤 생김 ${de.scrollWidth}>${vw}`);
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) { const r = p.getBoundingClientRect(); const er = el.getBoundingClientRect(); if (er.right > r.right + 1 || er.left < r.left - 1) return true; } } return false; };
  const name = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
  let n = 0;
  for (const e of document.body.querySelectorAll('*')) {
    if (n > 8) break;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0 || s.position === 'fixed' && r.right > vw + 50) continue;
    if ((r.right > vw + 2 || r.left < -2) && r.width < vw * 1.5 && !clipped(e) && e.closest('.on, .modal.open, header, .open')) {
      if (e.closest('[aria-hidden=true], .marquee, .mq, .intro, .tk, .ticker')) continue;
      out.push(`넘침 ${name(e)} L${Math.round(r.left)} R${Math.round(r.right)}`); n++;
    }
  }
  // 글자 잘림: 한 줄 고정 + 넘침 (말줄임 없는 것)
  let t = 0;
  for (const e of document.querySelectorAll('.view.on *, .modal.open *, #gamePlay *')) {
    if (t > 6) break;
    if (!e.firstChild || e.children.length > 2) continue;
    const s = getComputedStyle(e); if (s.overflow !== 'hidden' && s.overflowX !== 'hidden') continue;
    if (s.textOverflow === 'ellipsis') continue;
    if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 4 && /\S/.test(e.textContent) && e.textContent.length < 80) { out.push(`글자 잘림 ${name(e)} "${e.textContent.trim().slice(0, 20)}" ${e.scrollWidth}>${e.clientWidth}`); t++; }
  }
  // 작은 터치 대상
  let b = 0;
  for (const e of document.querySelectorAll('.on button, .modal.open button, header button')) {
    const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === 'hidden') continue;
    if ((r.width < 28 || r.height < 28) && b < 4) { out.push(`작은 버튼 ${name(e)} ${Math.round(r.width)}x${Math.round(r.height)} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 12)}"`); b++; }
  }
  return out;
};
const GPROBE = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const m = document.querySelector('#gamePlay:not([hidden])');
  if (!m) return ['게임 창 못 찾음'];
  const cvs = [...m.querySelectorAll('canvas')].filter(c => c.getBoundingClientRect().width > 50);
  for (const c of cvs) { const r = c.getBoundingClientRect(); if (r.bottom > vh + 2 || r.right > vw + 2 || r.left < -2 || r.top < -2) out.push(`판이 화면 밖 ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} (화면 ${vw}x${vh})`); }
  for (const e of m.querySelectorAll('button')) { const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === 'hidden') continue; if (r.bottom > vh + 2 || r.right > vw + 2 || r.left < -2) out.push(`버튼이 화면 밖 "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 12)}" ${Math.round(r.left)},${Math.round(r.top)}`); }
  const box = (cvs[0] || m.querySelector('.n25, .cut, [class*=board], [class*=grid]') || m).getBoundingClientRect();
  out.unshift(`판 ${Math.round(box.width)}x${Math.round(box.height)}`);
  return out;
};
for (const [dn, w, h, dpr, touch] of DEV) {
  if (only && !only.includes(dn)) continue;
  const mobile = w < 768 || h < 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: mobile,
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
  if (ck) await ctx.addCookies([{ name: ck[1], value: ck[2], url: base }]);
  await ctx.route(/cdn\.jsdelivr\.net|cloudflareinsights|accounts\.google/, r => r.fulfill({ status: 200, body: '' }));
  await ctx.addInitScript(() => { try { localStorage.setItem('sg_in', '1'); } catch {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' @' + (e.stack||'').split('\n')[1]?.trim()));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('pre') && document.querySelector('#bigTime')?.textContent.trim(), null, { timeout: 30000 }).catch(() => errs.push('홈 표시 안 됨'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')));
  console.log(`\n### ${dn} ${w}x${h}`);
  for (const v of VIEWS) {
    await page.evaluate(v => { location.hash = v; }, v); await page.waitForTimeout(900);
    const p = await page.evaluate(PROBE);
    await page.screenshot({ path: `${OUT}/${dn}_v_${v}.png`, fullPage: true });
    if (p.length) console.log(`  [화면 ${v}] ` + p.join(' | '));
  }
  // 메뉴 열기
  await page.evaluate(() => { location.hash = 'home'; }); await page.waitForTimeout(500);
  await page.click('#btnMenu').catch(() => {}); await page.waitForTimeout(500);
  const mp = await page.evaluate(PROBE); await page.screenshot({ path: `${OUT}/${dn}_menu.png` }); if (mp.length) console.log('  [메뉴] ' + mp.join(' | '));
  for (const g of GAMES) {
    const gp = await ctx.newPage(); const ge = []; gp.on('pageerror', e => ge.push(e.message + ' @' + (e.stack||'').split('\n')[1]?.trim()));
    await gp.goto(base + '/', { waitUntil: 'load' });
    await gp.waitForFunction(() => document.querySelector('#bigTime')?.textContent.trim(), null, { timeout: 30000 }).catch(() => {});
    await gp.waitForTimeout(800);
    await gp.evaluate(() => document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')));
    const ok = await gp.evaluate(g => { const b = [...document.querySelectorAll(`[data-play="${g}"]`)].find(x => x.offsetParent) || document.querySelector(`[data-play="${g}"]`); if (!b) return false; b.click(); return true; }, g);
    if (!ok) { console.log(`  [게임 ${g}] 버튼 없음`); await gp.close(); continue; }
    await gp.waitForTimeout(1800);
    await gp.screenshot({ path: `${OUT}/${dn}_g_${g}_0.png` });
    const r0 = await gp.evaluate(GPROBE);
    // 시작 + 플레이: 시작 버튼, 화면 톡, 스와이프, 키
    await gp.evaluate(() => { const m = document.querySelector('#gamePlay'); const b = m && [...m.querySelectorAll('button')].find(x => /시작|start|플레이|도전/i.test(x.textContent) && x.offsetParent); b?.click(); });
    await gp.waitForTimeout(700);
    for (let i = 0; i < 12; i++) {
      const x = w / 2 + (i % 3 - 1) * w * 0.15, y = h * (0.35 + (i % 4) * 0.1);
      await gp.touchscreen.tap(x, y).catch(() => {});
      if (i % 4 === 0) await gp.keyboard.press(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'Space'][i / 4 % 4]).catch(() => {});
      await gp.waitForTimeout(180);
    }
    await gp.mouse.move(w / 2, h / 2); await gp.mouse.down(); await gp.mouse.move(w / 2 + 60, h / 2 + 40, { steps: 6 }); await gp.mouse.up();
    await gp.waitForTimeout(600);
    await gp.screenshot({ path: `${OUT}/${dn}_g_${g}_1.png` });
    const r1 = await gp.evaluate(GPROBE);
    const sx = await gp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 ? `가로스크롤 ${document.documentElement.scrollWidth}` : '');
    console.log(`  [게임 ${g}] 처음: ${r0.join(' | ')} · 플레이 뒤: ${r1.slice(1).join(' | ') || '이상 없음'} ${sx}${ge.length ? ' · 오류: ' + ge.slice(0, 3).join(' / ') : ''}`);
    await gp.close();
  }
  if (errs.length) console.log('  오류: ' + errs.slice(0, 5).join(' / '));
  await ctx.close();
}
await browser.close(); srv.close();
