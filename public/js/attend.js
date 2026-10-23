// SVMHS GROUND — 출석 체크 (듀오링고식 연속 출석) · 서버: lib/attend.js + functions/api/s/[[path]].js (att · attrank)
// 로그인한 채로 사이트를 열면 하루 한 번 자동 출석 → 첫 출석이면 축하 창(불꽃 + 이번 주 도장 + 보상),
// 헤더 🔥 버튼 → 출석 창(달력 · 다음 보상 · 보상 목록 · 친구 연속 출석 순위 · 규칙)
import { $, esc, pad } from './util.js';

// lib/attend.js의 REWARDS와 같게 유지 (해금 판단은 서버가 함 — 여긴 표시용)
export const REWARDS = [
  { d: 3, kind: 'sticker', v: '🌱' },
  { d: 7, kind: 'sticker', v: '🏅' },
  { d: 10, kind: 'avatar', v: '🦁' },
  { d: 20, kind: 'sticker', v: '💎' },
  { d: 30, kind: 'avatar', v: '🐉' },
  { d: 50, kind: 'sticker', v: '🏆' },
  { d: 100, kind: 'avatar', v: '🌟' },
];
const KIND = { sticker: '스티커', avatar: '프로필 사진' };
export const unlocked = (best, kind) => REWARDS.filter(r => r.kind === kind && (best || 0) >= r.d).map(r => r.v);
export const lockedOf = kind => REWARDS.filter(r => r.kind === kind);

let api;   // social.js에서 받음: call · sheet · closeSheet · av · nameOf · devTag · classTxt · atOf · openModal · closeModal · onBest
let st = null, checking = null, doneDay = '';
const kstDay = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const DOW = ['월', '화', '수', '목', '금', '토', '일'];

/* ----- 불꽃 그림 (직접 그림, 그라디언트 id는 창마다 달라서 겹치지 않게) ----- */
let fid = 0;
export function flame(cls = '', off = false) {
  const i = ++fid;
  return `<svg class="flm ${cls}${off ? ' off' : ''}" viewBox="0 0 48 56" aria-hidden="true">
    <defs><linearGradient id="fg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd25c"/><stop offset=".55" stop-color="#ff9d3c"/><stop offset="1" stop-color="#ff5e3a"/></linearGradient>
    <linearGradient id="fi${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffd36a"/></linearGradient></defs>
    <path class="fo" fill="url(#fg${i})" d="M24 2c1.4 6.6-2.6 10.2-5.8 13.8C15 19.3 11 23.6 11 30.5 11 42.4 17.2 53 24 53s13-10.6 13-22.5c0-5.4-2.4-9.4-5-12.6-.6 3-2 5.2-4.4 6.3C29 16.6 26.3 8 24 2z"/>
    <path class="fi" fill="url(#fi${i})" d="M24 26.5c-3.4 3-5.6 5.6-5.6 9.2 0 4.2 2.5 7.8 5.6 7.8s5.6-3.6 5.6-7.8c0-3.6-2.2-6.2-5.6-9.2z"/>
  </svg>`;
}
const shieldSvg = (cls = '') => `<svg class="shd ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 4.5 5.3v6.2c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10V5.3L12 2.5z"/><path class="tk" d="m8.6 12 2.4 2.4 4.6-4.8"/></svg>`;

/* ----- 헤더 🔥 버튼 ----- */
function paintChip() {
  const b = $('#btnStreak'); if (!b) return;
  b.hidden = !st;
  if (!st) return;
  b.classList.toggle('lit', !!st.done && st.cur > 0);
  $('#stN').textContent = st.cur;
  const lbl = st.done ? `${st.cur}일 연속 출석 중` : '오늘 아직 출석 안 함';
  b.setAttribute('aria-label', lbl + ' — 출석 체크 열기'); b.dataset.tip = lbl;
}

/* ----- 오늘 출석 (자동) ----- */
export function sync(me) {
  if (!me) { st = null; doneDay = ''; paintChip(); return; }
  if (doneDay === kstDay() && st) { paintChip(); return; }
  check();
}
async function check() {
  if (checking) return checking;
  checking = (async () => {
    try {
      const r = await api.call('att', {});
      st = r; doneDay = r.today; paintChip(); api.onBest?.(r.best);
      if (r.new) whenFree(() => celebrate(r));
    } catch {}
    finally { checking = null; }
  })();
  return checking;
}
// 다른 창·소개 화면·게임이 떠 있으면 끝날 때까지 기다렸다가 보여 줌 (최대 3분)
function whenFree(fn, tries = 0) {
  const busy = document.documentElement.classList.contains('prelogin') || document.querySelector('.modal.open') || document.body.classList.contains('playing') || document.hidden;
  if (!busy) { fn(); return; }
  if (tries < 260) setTimeout(() => whenFree(fn, tries + 1), 700);
}

/* ----- 축하 창 (그날 첫 출석) ----- */
const CHEER = ['오늘도 출석 도장 꾹!', '불꽃이 점점 커지고 있어요', '꾸준함이 제일 멋져요', '오늘도 와 줘서 고마워요', '이 기세 그대로!', '쉬는 시간 잘 보내요'];
const nextReward = best => REWARDS.find(r => r.d > (best || 0));
function weekStrip(r, anim) {
  const kinds = Object.fromEntries((r.weekDays || []).map(x => [x.ymd, x.kind]));
  return `<ol class="att-week" aria-label="이번 주 출석">${r.week.map((y, i) => {
    const k = kinds[y], isT = y === r.today, past = y < r.today, we = i >= 5;
    const cls = [k === 1 ? 'on' : k === 2 ? 'sh' : past && !we ? 'miss' : '', isT ? 'today' : '', we ? 'we' : '', isT && anim ? 'stamp' : ''].filter(Boolean).join(' ');
    return `<li class="${cls}"><span class="dw">${DOW[i]}</span><i class="wd">${k === 1 ? flame('fsm') : k === 2 ? shieldSvg('fsm') : ''}</i></li>`;
  }).join('')}</ol>`;
}
function progressHtml(r) {
  const n = nextReward(r.best);
  if (!n) return '<p class="att-next done">🎉 모든 출석 보상을 모았어요!</p>';
  const prevD = [...REWARDS].reverse().find(x => x.d <= r.best)?.d || 0;
  const pct = Math.max(4, Math.min(100, Math.round((r.cur - prevD) / (n.d - prevD) * 100)));
  const left = n.d - r.cur;
  return `<div class="att-next"><span class="rw-em">${n.v}</span><div class="att-bar"><p><span><b>${n.d}일 연속</b> 보상 · ${KIND[n.kind]}</span><small>${left > 0 ? `${left}일 남았어요` : '오늘 받아요!'}</small></p><span class="track"><i data-p="${r.cur >= prevD ? pct : 4}"></i></span></div></div>`;
}
function celebrate(r) {
  const m = $('#mAtt'); if (!m) return;
  const first = r.total === 1, lostTxt = r.lost > 1 ? `<p class="att-note lost">아쉽게 <b>${r.lost}일</b> 기록이 끊겼어요. 오늘부터 다시 불꽃을 키워요!</p>` : '';
  const msg = first ? '첫 출석이에요! 등교하는 날마다 들러서 불꽃을 키워 보세요' : CHEER[Math.floor(Math.random() * CHEER.length)];
  const notes = [
    r.used ? `<p class="att-note sh">${shieldSvg('ic')}<span>방패 <b>${r.used}개</b>가 빠진 날을 지켜 줬어요</span></p>` : '',
    r.gotShield ? `<p class="att-note sh got">${shieldSvg('ic')}<span>한 주 개근! <b>출석 방패 +1</b> <small>(${r.shield}/${r.shieldMax})</small></span></p>` : '',
  ].join('');
  const gifts = (r.unlocked || []).map(x => `<div class="att-gift"><span class="rw-em">${x.v}</span><p><b>${x.d}일 연속 보상</b><small>새 ${KIND[x.kind]} 해금! 프로필 꾸미기에서 써 보세요</small></p></div>`).join('');
  $('#attSheet').innerHTML = `
    <div class="att-hero">
      <div class="att-fire">${flame('big ign')}<b class="att-num" id="attNum">${Math.max(0, r.cur - 1)}</b></div>
      <h3 id="attT"><span id="attNum2">${r.cur}</span>일 연속 출석!</h3>
      <p class="att-msg">${esc(msg)}</p>
    </div>
    ${weekStrip(r, true)}
    ${lostTxt}${notes}${gifts}
    ${progressHtml(r)}
    <div class="row"><button class="btn big" type="button" data-close>계속하기</button><button class="btn ghost" type="button" data-att-open>출석 기록</button></div>`;
  bars($('#attSheet')); api.openModal('#mAtt');
  // 숫자 올라가기: 어제 → 오늘
  const el = $('#attNum'), from = Math.max(0, r.cur - 1), to = r.cur;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  setTimeout(() => { el.classList.add('roll'); el.textContent = to; }, 650);
  if (from === to) el.textContent = to;
}

/* ----- 출석 창 (헤더 🔥) ----- */
let viewM = '';
export async function open(month) {
  const today = kstDay(); viewM = month || today.slice(0, 6);
  api.sheet(`<div class="att-sheet" id="attBox"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`);
  try {
    const r = await api.call('att?m=' + viewM);
    st = { ...st, ...r, weekDays: st?.weekDays }; paintChip();
    $('#attBox').innerHTML = sheetHtml(r); bars($('#attBox'));
    loadRank('friends');
  } catch (e) { $('#attBox').innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
function calHtml(r) {
  const y = +r.month.slice(0, 4), mo = +r.month.slice(4, 6), first = new Date(y, mo - 1, 1), n = new Date(y, mo, 0).getDate();
  const kinds = Object.fromEntries(r.days.map(x => [x.ymd, x.kind]));
  const lead = (first.getDay() + 6) % 7;   // 월요일 시작
  let h = DOW.map((d, i) => `<b class="ch${i >= 5 ? ' we' : ''}">${d}</b>`).join('') + '<i></i>'.repeat(lead);
  for (let d = 1; d <= n; d++) {
    const ymd = `${r.month}${pad(d)}`, k = kinds[ymd], we = (lead + d - 1) % 7 >= 5;
    h += `<span class="${[k === 1 ? 'on' : k === 2 ? 'sh' : '', ymd === r.today ? 'today' : '', ymd > r.today ? 'fut' : '', we ? 'we' : ''].filter(Boolean).join(' ')}"${k ? ` data-tip="${k === 1 ? '출석' : '방패로 지킴'}"` : ''}>${k === 1 ? flame('cf') : k === 2 ? shieldSvg('cf') : ''}<em>${d}</em></span>`;
  }
  const cnt = r.days.filter(x => x.kind === 1).length;
  const prev = (() => { const t = new Date(y, mo - 2, 1); return `${t.getFullYear()}${pad(t.getMonth() + 1)}`; })();
  const next = (() => { const t = new Date(y, mo, 1); return `${t.getFullYear()}${pad(t.getMonth() + 1)}`; })();
  return `<div class="att-cal-h"><button type="button" class="pg" data-att-m="${prev}" aria-label="이전 달">‹</button><b>${y}년 ${mo}월 <small>· ${cnt}일 출석</small></b><button type="button" class="pg" data-att-m="${next}" aria-label="다음 달" ${next > r.today.slice(0, 6) ? 'disabled' : ''}>›</button></div>
    <div class="att-cal">${h}</div>`;
}
function rewardsHtml(r) {
  return `<ul class="att-rw">${REWARDS.map(x => {
    const on = r.best >= x.d;
    return `<li class="${on ? 'on' : ''}"><span class="rw-em">${x.v}</span><b>${x.d}일</b><small>${on ? '받음 ✓' : KIND[x.kind]}</small>${on ? '' : '<i class="lk" aria-label="잠김">🔒</i>'}</li>`;
  }).join('')}</ul>`;
}
function sheetHtml(r) {
  const shields = Array.from({ length: r.shieldMax }, (_, i) => shieldSvg(i < r.shield ? 'on' : 'off')).join('');
  return `
    <div class="att-top">
      <div class="att-fire sm">${flame('big', !r.cur)}<b class="att-num">${r.cur}</b></div>
      <div class="att-tt">
        <h3>${r.cur ? `${r.cur}일 연속 출석` : '오늘부터 시작!'}</h3>
        <p class="muted small">${r.done ? '✅ 오늘 출석 완료' : '오늘은 아직이에요'}</p>
      </div>
    </div>
    <div class="att-stats">
      <div><b>${r.best}</b><small>최고 기록</small></div>
      <div><b>${r.total}</b><small>총 출석</small></div>
      <div class="shs" data-tip="연속 ${r.shieldEvery}일마다 1개 · 최대 ${r.shieldMax}개"><span>${shields}</span><small>출석 방패</small></div>
    </div>
    ${progressHtml(r)}
    <section class="att-sec">${calHtml(r)}</section>
    <section class="att-sec"><h4>출석 보상 <small>한 번 받으면 기록이 끊겨도 계속 쓸 수 있어요</small></h4>${rewardsHtml(r)}</section>
    <section class="att-sec"><h4>연속 출석 순위</h4>
      <div class="segs"><button type="button" data-att-rank="friends" class="on">친구</button><button type="button" data-att-rank="all">전체</button></div>
      <ol class="rank" id="attRank"><li class="skel"></li></ol></section>
    <details class="att-rule"><summary>출석 규칙</summary>
      <ul><li>로그인한 채로 사이트를 열면 하루 한 번 자동으로 출석돼요.</li>
      <li><b>등교하는 날(월~금)</b>을 빠지면 연속 기록이 끊겨요. 주말·공휴일·방학은 쉬어도 괜찮아요.</li>
      <li>주말·공휴일에 들러도 +1일이에요.</li>
      <li>연속 ${r.shieldEvery}일(한 주 개근)마다 <b>출석 방패</b>를 1개 받아요(최대 ${r.shieldMax}개). 빠진 등교일 하루를 방패가 자동으로 메워 줘요.</li>
      <li>보상은 최고 기록 기준이라 한 번 받으면 사라지지 않아요.</li></ul></details>
    <div class="row"><button class="btn ghost" type="button" data-close>닫기</button></div>`;
}
async function loadRank(scope) {
  const list = $('#attRank'); if (!list) return;
  list.innerHTML = '<li class="skel"></li>';
  try {
    const r = await api.call('attrank?scope=' + scope);
    const medal = i => ['🥇', '🥈', '🥉'][i] || i + 1;
    list.innerHTML = r.list.length ? r.list.map((u, i) => `<li class="${u.isMe ? 'me' : ''}"><span class="rk">${medal(i)}</span><a href="#u/${esc(u.handle)}" data-u="1">${api.av(u)}<span class="pi"><b>${esc(api.nameOf(u))}${api.devTag(u)}</b><small>${esc(api.classTxt(u) || api.atOf(u))}</small></span></a><b class="rv att-rv">${flame('fsm')}${u.value}</b></li>`).join('')
      : `<li class="empty">${scope === 'friends' ? '아직 불꽃을 키우는 친구가 없어요. 맞팔 친구에게 같이 하자고 해 보세요!' : '아직 기록이 없어요'}</li>`;
  } catch (e) { list.innerHTML = `<li class="empty">${esc(e.message)}</li>`; }
}

/* ----- 시작 ----- */
export function init(a) {
  api = a;
  $('#btnStreak')?.addEventListener('click', () => open());
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-att-m]'); if (m && !m.disabled) { open(m.dataset.attM); return; }
    const k = e.target.closest('[data-att-rank]');
    if (k) { k.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === k)); loadRank(k.dataset.attRank); return; }
    if (e.target.closest('[data-att-open]')) { api.closeModal($('#mAtt')); open(); return; }
    if (e.target.closest('#attRank [data-u]')) api.closeSheet();
  });
  // 자정이 지난 뒤 다시 보면 새로 출석
  document.addEventListener('visibilitychange', () => { if (!document.hidden && st && doneDay !== kstDay()) check(); });
  setInterval(() => { if (!document.hidden && st && doneDay !== kstDay()) check(); }, 60e3);
}
export const state = () => st;
// CSP가 style 속성을 막아서 진행 막대 길이는 CSSOM으로 넣음
const bars = root => root?.querySelectorAll('.track i[data-p]').forEach(i => i.style.setProperty('--p', i.dataset.p + '%'));
