// 공통 유틸: DOM · 날짜 · 저장소 · 토스트

export const $ = s => document.querySelector(s);
export const $$ = (s, r = document) => (r || document).querySelectorAll(s);   // r: 찾을 범위(없으면 문서 전체)

/* ----- 날짜 (나이스는 'YYYYMMDD' 문자열을 씀) ----- */
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
export const isYmd = s => typeof s === 'string' && /^\d{8}$/.test(s);
export const parseYmd = s => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/* 기기 시계가 틀려도 종 시간 카운트다운이 맞도록 서버 시각과의 차이(ms)를 보정 */
export const clock = { off: 0 };
export const now = () => new Date(Date.now() + clock.off);
export const today = () => { const n = now(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
export const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
export const diffDays = (a, b) => Math.round((a - b) / 86400000);
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const fmtDay = d => `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
export const ddayText = n => n === 0 ? 'D-DAY' : n > 0 ? 'D-' + n : 'D+' + (-n);

/* ----- HTML 이스케이프: innerHTML에 넣는 외부·사용자 문자열은 반드시 esc() ----- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

/* ----- localStorage (키 앞에 sg_ 붙임, 실패해도 조용히 넘어감) ----- */
const PREFIX = 'sg_';
export const store = {
  get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch {} },
  /** 이 사이트가 저장한 것 전부 지우기 */
  clearAll() { try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {} },
  /** 하루 지난 API 캐시(sg_c_*) 정리 */
  pruneCache(maxAge = 86400e3) {
    try {
      Object.keys(localStorage).forEach(k => {
        if (!k.startsWith(PREFIX + 'c_')) return;
        let v = null; try { v = JSON.parse(localStorage.getItem(k)); } catch {}
        if (!v || !(Date.now() - v.t < maxAge)) localStorage.removeItem(k);
      });
    } catch {}
  },
};

/* ----- 자리 비움(2026-10-25 출시 전 시뮬레이션): 5분 동안 아무 입력이 없으면 주기적 요청(DM 알림·친구·밸런스)을 쉼 →
   수업 중 화면만 켜 둔 기기들이 Cloudflare 무료 요청 한도(하루 10만)를 다 쓰지 않게. 다시 만지면 onWake로 바로 새로 받음 ----- */
let lastAct = Date.now();
const wakeFns = [];
export const IDLE_MS = 5 * 60e3;
export const idle = () => Date.now() - lastAct > IDLE_MS;
export const onWake = fn => { wakeFns.push(fn); };
if (typeof document !== 'undefined') {
  const act = () => { const was = idle(); lastAct = Date.now(); if (was) for (const f of wakeFns) { try { f(); } catch {} } };
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, act, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) act(); });
}

/* ----- UI 조각 ----- */
export const skel = n => '<div class="skel"></div>'.repeat(n);

/* ----- 로딩 뼈대 = 실제 오브젝트 모양 (2026-10-27 하율: "로딩이 걸리면 그 오브젝트를 본딴 모양으로 먼저") -----
   진짜 그리는 함수에 가짜 데이터를 넣어 만든 HTML을 ghost()에 통과시키면: 글자 → 둥근 막대(.skt), 그림·아이콘·사진 → 같은 자리 덩어리(.skm),
   카드·칸 테두리와 크기는 그대로. 맨 위 요소마다 .skz + inert(눌러지지도·포커스도 안 됨) + aria-hidden, id는 지움(진짜와 겹치지 않게).
   진짜 내용이 .skz/.skel 자리를 바꿔 넣으면 아래 '등장' 감시가 알아서 부드럽게 나타나게 함 */
const SKM = 'svg,img,canvas,video,.av,.mth,.fx,.si,.cdic,.mdl,.nt-ic,.ms-no,.bg-ic,.pi-logo,.clogo,.flm,.tier-ic';
function ghostMark(root) {
  for (const el of root.querySelectorAll('[id]')) el.removeAttribute('id');
  const walk = node => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        if (n.data.trim()) { const i = document.createElement('i'); i.className = 'skt'; i.textContent = n.data; n.replaceWith(i); }
      } else if (n.nodeType === 1) {
        if (n.matches(SKM)) { n.classList.add('skm'); if (n.tagName === 'IMG') n.removeAttribute('src'); }
        else if (!/^(TEXTAREA|INPUT|SELECT)$/.test(n.tagName)) walk(n);
      }
    }
  };
  walk(root);
  for (const n of root.children) { n.classList.add('skz'); n.setAttribute('aria-hidden', 'true'); n.inert = true; }
}
export const ghost = html => {
  const t = document.createElement('template'); t.innerHTML = html;
  ghostMark(t.content);
  const box = document.createElement('div'); box.append(t.content); return box.innerHTML;   // inert는 속성으로 남음
};
// 진짜 그리는 함수가 DOM에 바로 그리는 경우: 그린 뒤 그 자리를 뼈대로 바꿈
export const ghostIn = el => { if (el) ghostMark(el); return el; };
// 가짜 데이터로 그리다 실패하면(데이터 모양이 바뀌는 등) 예전 막대 뼈대로
export const ghostOr = (fn, n = 3) => { try { return ghost(fn()); } catch { return skel(n); } };

// 직접 부를 때: 새로 그린 요소들을 차례로 떠오르게 (움직임 줄이기면 아무것도 안 함)
export let riseIn = () => {};
/* ----- 등장 애니메이션 (2026-10-27) -----
   ① 로딩 뼈대(.skz/.skel)나 '불러오는 중' 자리를 진짜 내용이 바꿔 넣을 때 · 빈 칸이 처음 채워질 때 → 새 요소가 차례로 살짝 떠오름
   ② hidden 이던 요소가 나타날 때 → 살짝 커지며 나타남
   이미 자기 애니메이션이 도는 요소(뷰 전환·시트·쇼케이스 등)는 건드리지 않음. 움직임 줄이기면 없음 */
if (typeof document !== 'undefined' && typeof MutationObserver === 'function' && Element.prototype.animate) {
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const LOAD = '.skz,.skel,.ldt';
  const isLoad = n => n.nodeType === 1 && n.matches(LOAD);
  const hasLoad = n => n.nodeType === 1 && (n.matches(LOAD) || !!n.querySelector(LOAD));   // 뼈대를 품은 덩어리째 바뀌어도(공지 창 등)
  const blank = n => n.nodeType === 8 || (n.nodeType === 3 && !n.data.trim());
  const sig = ns => [...ns].map(n => n.textContent || '').join('').replace(/\s+/g, '');   // 글자로 비교(그림이 나중에 그려진 건 무시)
  const SKIP = '#intro,.gfx,.sh-stage,.gstage,.gplay,#hr,canvas,.ctm,.nsvg,#bigTime,#tip,.tip,.ptzoom,[data-noreveal]';
  const busy = el => {   // 자기·조상이 이미 움직이는 중이면 겹치지 않게
    for (let e = el, k = 0; e && e !== document.body && k < 8; e = e.parentElement, k++) {
      for (const a of e.getAnimations()) {   // 0.2초 넘게 더 움직일 등장류(투명도·위치) 애니메이션만 — 거의 끝난 것·배경색·무한 반복은 무시
        if (a.playState !== 'running' && a.playState !== 'pending') continue;
        const t = a.effect?.getComputedTiming?.(); if (!t || !isFinite(t.endTime)) continue;
        if (t.endTime - (a.currentTime || 0) < 200) continue;
        const kf = a.effect.getKeyframes?.() || [];
        if (a.transitionProperty ? /opacity|transform|translate|scale/.test(a.transitionProperty) : kf.some(k => 'opacity' in k || 'transform' in k || 'translate' in k || 'scale' in k)) return true;
      }
    }
    return false;
  };
  const shown = el => el.isConnected && !el.closest(SKIP) && el.getClientRects().length;   // closest 먼저(싸다) — getClientRects는 레이아웃을 강제함
  const rise = (els) => {
    let i = 0;
    for (const el of els) {
      if (!shown(el)) continue;
      el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 340, delay: Math.min(i++, 8) * 45, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
    }
  };
  // 사진 다 왔으면 .ok (CSS img:not(.ok)의 깜빡이는 자리 표시를 끔) — 캐시에서 바로 뜬 사진은 load 이벤트를 window에서 못 받는 경우가 있어서 직접 확인 (2026-10-28 공지 사진 계속 깜빡이던 버그)
  const imgOk = im => { if (im.classList.contains('ok')) return; if (im.complete) im.classList.add('ok'); else { const f = () => im.classList.add('ok'); im.addEventListener('load', f, { once: true }); im.addEventListener('error', f, { once: true }); } };
  const imgScan = n => { if (n.nodeType !== 1) return; if (n.tagName === 'IMG') imgOk(n); else n.querySelectorAll?.('img:not(.ok)').forEach(imgOk); };
  /* 최적화(2026-10-28): 변화를 바로 재지 않고 다음 그리기 직전(rAF)에 한꺼번에 판단.
     예전엔 DOM을 바꿀 때마다 그 자리에서 getClientRects·getAnimations로 레이아웃·스타일을 강제로 계산해서
     첫 화면을 그리는 동안 수십 번 다시 계산했음(느린 기기 4배 기준 약 1.2초). rAF는 같은 프레임 그리기 전에 돌아서 깜빡임 없음 */
  let pend = [], praf = 0;
  const mo = new MutationObserver(ms => {
    for (const m of ms) if (m.type === 'childList') m.addedNodes.forEach(imgScan);
    if (RM.matches || document.documentElement.classList.contains('prelogin')) return;
    pend.push(...ms); if (!praf) praf = requestAnimationFrame(judge);
  });
  const judge = () => {
    praf = 0; const ms = pend; pend = [];
    if (document.documentElement.classList.contains('prelogin')) return;
    for (const m of ms) {
      const tg = m.target;
      if (m.type === 'attributes') {
        if (m.oldValue === null || tg.hidden || !shown(tg) || busy(tg)) continue;
        tg.animate([{ opacity: 0, transform: 'translateY(6px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,1.3,.4,1)' });
        continue;
      }
      const add = [...m.addedNodes].filter(n => n.nodeType === 1 && !isLoad(n));
      if (!add.length) continue;
      const rm = [...m.removedNodes];
      const fromLoad = rm.some(hasLoad);
      const fromEmpty = rm.every(blank) && tg.childNodes.length === m.addedNodes.length && !m.previousSibling && !m.nextSibling;
      // data-swap 칸(급식 끼니·검색 결과·랭킹 탭 등): 내용이 실제로 바뀌었을 때만 (같은 내용 다시 그리기는 그대로)
      const swapped = !fromLoad && !fromEmpty && tg.hasAttribute('data-swap') && rm.some(n => n.nodeType === 1) && sig(rm) !== sig(m.addedNodes);
      if (!fromLoad && !fromEmpty && !swapped) continue;
      if (!shown(tg) || busy(tg)) continue;
      rise(add);
    }
  };
  riseIn = els => { if (!RM.matches) rise(els); };
  const go = () => { imgScan(document.body); mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true }); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
  // 사진이 늦게 오면 그 자리에 같은 모양 덩어리가 먼저 보이고, 다 오면 페이드 인 (CSS img:not(.ok))
  const ok = e => { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); };
  addEventListener('load', ok, true); addEventListener('error', ok, true);
}
export const empty = msg => `<p class="empty">${msg}</p>`;
let toastTimer;
export const toast = (msg, ms = 1800) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
};
