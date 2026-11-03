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

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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

// 가입(쿠키 받기)
const sig = await fetch(base + '/api/s/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: 'perf_pad1', name: '패드검사', pw: 'zq8!kd02xa', grade: 2, cls: 3, club: '' }) });
const ck = (sig.headers.get('set-cookie') || '').match(/^([^=]+)=([^;]*)/);

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: false,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
if (ck) await ctx.addCookies([{ name: ck[1], value: ck[2], url: base }]);
await ctx.route(/cdn\.jsdelivr\.net|cloudflareinsights|accounts\.google/, r => r.fulfill({ status: 200, body: '' }));
await ctx.addInitScript(([PRE, MEM]) => {
  window.__mem = MEM;
  window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true }); } catch {}
  if (!PRE) try { localStorage.setItem('sg_in', '1'); } catch {}
  Object.defineProperty(navigator, 'deviceMemory', { get: () => +(window.__mem || 4) });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
}, [!!process.env.PRE, +(process.env.MEM || 4)]);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

const fps = ms => page.evaluate(ms => new Promise(r => { let n = 0, worst = 0, last = performance.now(); const t0 = last;
  const f = t => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else r({ fps: Math.round(n * 1000 / (t - t0)), worst: Math.round(worst) }); }; requestAnimationFrame(f); }), ms);
const lt = () => page.evaluate(() => { const a = window.__lt; window.__lt = []; return { n: a.length, sum: Math.round(a.reduce((x, y) => x + y, 0)), max: Math.round(Math.max(0, ...a)) }; });

await cdp.send('Performance.enable');
if (process.env.PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
const trace = [];
if (process.env.TRACE) { cdp.on('Tracing.dataCollected', d => trace.push(...d.value)); await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack', transferMode: 'ReportEvents' }); }
const t0 = Date.now();
await page.goto(base + '/', { waitUntil: 'load' });
const tLoad = Date.now() - t0;
await page.waitForFunction(() => !document.documentElement.classList.contains('pre') && document.querySelector('#bigTime')?.textContent.trim(), null, { timeout: 60000 }).catch(() => {});
const tHome = Date.now() - t0;
await page.waitForTimeout(3000);
const ltLoad = await lt();
if (process.env.TRACE) {
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
  const agg = new Map(); for (const e of trace) if (e.ph === 'X' && e.dur) agg.set(e.name, (agg.get(e.name) || 0) + e.dur / 1000);
  console.log('추적(이름별 합, 겹침 포함):', [...agg].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · '));
  const big = trace.filter(e => e.ph === 'X' && e.name === 'RunTask' && e.dur > 100000).map(e => { const kids = trace.filter(k => k.ph === 'X' && k.tid === e.tid && k.ts >= e.ts && k.ts < e.ts + e.dur && k.name !== 'RunTask' && k.dur > 15000); return Math.round(e.dur / 1000) + 'ms: ' + kids.slice(0, 6).map(k => `${k.name}${k.args?.data?.url ? '(' + k.args.data.url.split('/').pop() + ')' : k.args?.data?.functionName ? '(' + k.args.data.functionName + ')' : ''} ${Math.round(k.dur / 1000)}`).join(', '); });
  console.log(big.join('\n'));
  const fz = new Map(); for (const e of trace) if (e.ph === 'X' && (e.name === 'UpdateLayoutTree' || e.name === 'Layout') && e.dur > 2000) { const st = e.args?.beginData?.stackTrace; const k = e.name + ' ← ' + (st ? st.slice(0, 2).map(f => `${f.functionName || '익명'}@${f.url.split('/').pop()}:${f.lineNumber + 1}`).join(' < ') : '(렌더링)'); const v = fz.get(k) || [0, 0]; v[0] += e.dur / 1000; v[1]++; fz.set(k, v); }
  console.log('강제 계산:\n' + [...fz].sort((a, b) => b[1][0] - a[1][0]).slice(0, 22).map(([k, v]) => `  ${Math.round(v[0])}ms ×${v[1]} ${k}`).join('\n'));
}
const pm = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
console.log(`로딩 3초 포함 — 스크립트 ${Math.round(pm.ScriptDuration * 1000)}ms · 스타일 계산 ${Math.round(pm.RecalcStyleDuration * 1000)}ms(${pm.RecalcStyleCount}번) · 배치 ${Math.round(pm.LayoutDuration * 1000)}ms(${pm.LayoutCount}번) · 작업 ${Math.round(pm.TaskDuration * 1000)}ms`);
if (process.env.PROF) {
  const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(익명)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, +process.env.PROF || 25).map(([k, v]) => `  ${Math.round(v)}ms ${k}`).join('\n'));
}
const mem = await page.evaluate(() => ({ dom: document.getElementsByTagName('*').length, heap: Math.round((performance.memory?.usedJSHeapSize || 0) / 1e6), anim: document.getAnimations().filter(a => a.playState === 'running').length }));
if (process.env.ANIM) console.log(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => { const t = a.effect?.target; const r = t?.getBoundingClientRect?.(); return `${a.animationName || a.constructor.name}@${t?.tagName}.${(t?.className?.baseVal ?? t?.className ?? '').toString().slice(0, 30)}${t?.id ? '#' + t.id : ''} ${r ? Math.round(r.width) + 'x' + Math.round(r.height) + (r.bottom < 0 || r.top > innerHeight ? ' 화면밖' : '') : ''} ∞${a.effect?.getTiming?.().iterations === Infinity ? 'Y' : 'N'}`; }).join('\n')));
if (process.env.DOMX) console.log(await page.evaluate(() => { const all = [...document.body.querySelectorAll('*')]; const vis = all.filter(e => e.getClientRects().length); const top = [...document.body.children].map(c => [c.id || c.className?.toString?.().slice(0, 25) || c.tagName, c.querySelectorAll('*').length, [...c.querySelectorAll('*')].filter(e => e.getClientRects().length).length]).sort((a, b) => b[2] - a[2]).slice(0, 12); const v = document.querySelector('main, .view.on, #home'); return `보이는 요소 ${vis.length}/${all.length}\n` + top.map(t => `  ${t[0]}: ${t[2]}/${t[1]}`).join('\n'); }));
const idle = await fps(3000); const ltIdle = await lt();
await page.mouse.move(640, 400);
await page.keyboard.press('Escape').catch(() => {}); await page.evaluate(() => document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')));
if (process.env.SPROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 300 }); await cdp.send('Profiler.start'); await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' }); cdp.on('Tracing.dataCollected', d => trace.push(...d.value)); trace.length = 0; }
const sc = page.evaluate(async () => { for (let i = 0; i < 40; i++) { window.scrollBy(0, 60); await new Promise(r => requestAnimationFrame(r)); } for (let i = 0; i < 40; i++) { window.scrollBy(0, -60); await new Promise(r => requestAnimationFrame(r)); } });
const scr = await fps(2500); await sc;
if (process.env.SPROF) {
  const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(익명)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000); });
  console.log('스크롤 중 JS:', [...self].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${Math.round(v)}ms ${k}`).join(' · '));
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
  const agg = new Map(); for (const e of trace) if (e.ph === 'X' && e.dur) agg.set(e.name, (agg.get(e.name) || 0) + e.dur / 1000);
  console.log('스크롤 중 추적:', [...agg].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · '));
} const ltScr = await lt();
console.log(`가벼운 모드 ${await page.evaluate(() => document.documentElement.classList.contains('lite') ? '켜짐' : '꺼짐')} (MEM=${process.env.MEM || 4})`);
console.log(`CPU ${CPU}x | 로드 ${tLoad}ms · 홈 표시 ${tHome}ms | 로딩 긴 작업 ${ltLoad.n}개 합 ${ltLoad.sum}ms 최대 ${ltLoad.max}ms`);
console.log(`DOM ${mem.dom}개 · JS 힙 ${mem.heap}MB · 도는 애니메이션 ${mem.anim}개`);
console.log(`가만히 ${idle.fps}fps(최악 ${idle.worst}ms) 긴 작업 ${ltIdle.sum}ms | 스크롤 ${scr.fps}fps(최악 ${scr.worst}ms) 긴 작업 ${ltScr.sum}ms`);
if (process.env.CLICK) { await page.evaluate(s => document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')), 0); await page.evaluate(q => document.querySelector(q)?.click(), process.env.CLICK); await page.waitForTimeout(800); if (process.env.SCROLLTO) await page.evaluate(q => document.querySelector(q)?.scrollIntoView(), process.env.SCROLLTO); await page.waitForTimeout(300); }
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
if (errs.length) console.log('오류:', errs.slice(0, 5));
await browser.close(); srv.close();
