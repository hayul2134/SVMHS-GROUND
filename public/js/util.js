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
export const empty = msg => `<p class="empty">${msg}</p>`;
let toastTimer;
export const toast = (msg, ms = 1800) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
};
