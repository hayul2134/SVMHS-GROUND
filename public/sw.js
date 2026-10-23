// SVMHS GROUND — 서비스 워커: 학교 와이파이가 끊겨도 마지막으로 본 화면·급식·시간표가 보이게
// 방식: 네트워크 먼저(최신 배포가 바로 보이게) → 3.5초 안에 응답이 없거나 실패하면 저장해 둔 것.
// 로그인·DM·게임·투표·관리자 요청은 건드리지 않는다(항상 네트워크).
const SHELL = 'sg-shell-v3', DATA = 'sg-data-v1';
const PRECACHE = ['/', '/css/style.css', '/js/theme.js', '/js/app.js', '/js/util.js', '/js/neis.js', '/js/food.js', '/js/qr.js', '/js/social.js', '/js/attend.js', '/js/att-art.js', '/js/att-rewards.js',
  '/manifest.webmanifest', '/logo.svg?v=4', '/icons/icon-192.png'];
const DATA_MAX = 80;   // 나이스 응답은 날짜마다 주소가 달라서 최근 것만 남김

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const isData = p => p.startsWith('/api/neis/') || p === '/api/config';
const isShell = (req, p) => req.mode === 'navigate' || /^\/(css|js|icons)\//.test(p) || /^\/(logo[\w-]*\.svg|manifest\.webmanifest)$/.test(p);

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/admin')) return;
  const data = isData(url.pathname);
  if (!data && !isShell(req, url.pathname)) return;
  e.respondWith(networkFirst(req, data ? DATA : SHELL, req.mode === 'navigate'));
});

async function networkFirst(req, name, nav) {
  const cache = await caches.open(name);
  const net = fetch(req).then(res => {
    if (res.ok) { cache.put(nav ? '/' : req, res.clone()).then(() => name === DATA && trim(cache)); }
    return res;
  });
  const timeout = new Promise(r => setTimeout(r, 3500));
  const first = await Promise.race([net.catch(() => null), timeout]);
  if (first) return first;
  const hit = await cache.match(nav ? '/' : req);
  return hit || net;   // 저장된 게 없으면 네트워크를 끝까지 기다림 (실패하면 브라우저 기본 오류)
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - DATA_MAX))) await cache.delete(k);
}
