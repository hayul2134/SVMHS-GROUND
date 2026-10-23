// SVMHS GROUND — 출석 체크 (듀오링고식 연속 출석) · 서버: lib/attend.js + functions/api/s/[[path]].js (att · attrank)
// 로그인한 채로 사이트를 열면 하루 한 번 자동 출석 → 첫 출석이면 축하 창, 헤더 🔥 → 출석 창
// 디자인 원칙 (듀오링고 연구에서 가져옴 — tools/attend/DESIGN.md)
//  1. 평소엔 짧고 가볍게, 기념일(MILESTONES·보상 해금)만 크게: 빛줄기 + 색종이 + 보상 카드가 차례로
//  2. 불꽃이 기록에 따라 '진화': 주황(1~6) → 붉은 주황(7~29) → 금빛(30~99) → 푸른 불꽃(100~)
//  3. 완벽한 연속(방패 안 씀) = 불꽃에 금빛 후광 · 이번 주 월~금 개근 = 요일 도장이 한 줄 띠로 이어짐
//  4. 이어진 날은 달력·이번 주에서 띠로 연결 → 끊기기 싫은 마음(연속의 시각화)
//  5. 다음 보상까지 남은 날을 늘 보여 줌 (목표가 분명하게)
import { $, esc, pad } from './util.js';
import { REWARDS, KIND, COLOR_NAME, rwOn, rwName } from './att-rewards.js';
export { REWARDS };
export const unlocked = (best, total, kind) => REWARDS.filter(r => r.kind === kind && rwOn(r, best || 0, total || 0)).map(r => r.v);
export const lockedOf = kind => REWARDS.filter(r => r.kind === kind);

let api;   // social.js에서 받음: call · sheet · closeSheet · av · nameOf · devTag · classTxt · atOf · openModal · closeModal · onBest
let st = null, checking = null, doneDay = '';
const kstDay = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const DOW = ['월', '화', '수', '목', '금', '토', '일'];
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----- 불꽃 그림 (직접 그림). tier: 0 주황 · 1 붉은 주황 · 2 금빛 · 3 푸른 불꽃 ----- */
export const tierOf = n => n >= 100 ? 3 : n >= 30 ? 2 : n >= 7 ? 1 : 0;
const FIRE = [
  ['#ffd25c', '#ff9d3c', '#ff6a3a', '#fff6c8', '#ffd36a'],
  ['#ffc24a', '#ff7a2e', '#f2452e', '#fff0b8', '#ffc552'],
  ['#fff1a6', '#ffcf3d', '#f59e0b', '#ffffff', '#fff1a6'],
  ['#c9f1ff', '#6fb8ff', '#6a5cff', '#ffffff', '#cdeaff'],
];
let fid = 0;
export function flame(cls = '', o = {}) {
  const i = ++fid, c = FIRE[o.tier || 0];
  return `<svg class="flm ${cls}${o.off ? ' off' : ''}" viewBox="0 0 48 56" aria-hidden="true">
    <defs><linearGradient id="fg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
    <linearGradient id="fi${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[3]}"/><stop offset="1" stop-color="${c[4]}"/></linearGradient></defs>
    <path class="fo" fill="url(#fg${i})" d="M24 2c1.4 6.6-2.6 10.2-5.8 13.8C15 19.3 11 23.6 11 30.5 11 42.4 17.2 53 24 53s13-10.6 13-22.5c0-5.4-2.4-9.4-5-12.6-.6 3-2 5.2-4.4 6.3C29 16.6 26.3 8 24 2z"/>
    <path class="fi" fill="url(#fi${i})" d="M24 26.5c-3.4 3-5.6 5.6-5.6 9.2 0 4.2 2.5 7.8 5.6 7.8s5.6-3.6 5.6-7.8c0-3.6-2.2-6.2-5.6-9.2z"/>
  </svg>`;
}
const shieldSvg = (cls = '') => `<svg class="shd ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 4.5 5.3v6.2c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10V5.3L12 2.5z"/><path class="tk" d="m8.6 12 2.4 2.4 4.6-4.8"/></svg>`;
// 큰 불꽃 + 숫자 (+ 완벽한 연속이면 후광)
const bigFire = (n, o = {}) => `<div class="att-fire ${o.sm ? 'sm' : ''} t${tierOf(n)}${o.pf ? ' pf' : ''}">${o.pf ? '<i class="halo" aria-hidden="true"></i>' : ''}${flame('big' + (o.ign ? ' ign' : ''), { tier: tierOf(n), off: !n })}<b class="att-num"${o.id ? ` id="${o.id}"` : ''}>${o.from ?? n}</b></div>`;
// 보상 그림 (스티커·사진은 이모지, 배경 색은 동그란 견본, 칭호는 이름표)
export const rwIcon = r => r.kind === 'color' ? `<i class="rw-sw c-${r.v}" aria-hidden="true"></i>` : r.kind === 'title' ? '<i class="rw-tag" aria-hidden="true">🏷️</i>' : `<span class="rw-e">${r.v}</span>`;

/* ----- 헤더 🔥 버튼 ----- */
function paintChip() {
  const b = $('#btnStreak'); if (!b) return;
  b.hidden = !st;
  if (!st) return;
  b.classList.toggle('lit', !!st.done && st.cur > 0);
  b.classList.remove('t0', 't1', 't2', 't3'); b.classList.add('t' + tierOf(st.cur));
  b.classList.toggle('pf', !!st.pf && st.cur >= 3);
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
      st = r; doneDay = r.today; paintChip(); api.onBest?.(r.best, r.total);
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

/* ----- 이번 주 도장 줄 ----- */
const CHEER = ['오늘도 출석 도장 꾹!', '불꽃이 점점 커지고 있어요', '꾸준함이 제일 멋져요', '오늘도 와 줘서 고마워요', '이 기세 그대로!', '쉬는 시간 잘 보내요', '내일도 불꽃 지키러 와요'];
const perfectWeek = r => { const k = Object.fromEntries((r.weekDays || []).map(x => [x.ymd, x.kind])); return r.week.slice(0, 5).every(y => k[y] === 1); };
function weekStrip(r, anim) {
  const kinds = Object.fromEntries((r.weekDays || []).map(x => [x.ymd, x.kind]));
  const pw = perfectWeek(r);
  return `<ol class="att-week${pw ? ' pw' : ''}" aria-label="이번 주 출석${pw ? ' — 월~금 개근' : ''}">${r.week.map((y, i) => {
    const k = kinds[y], prev = i ? kinds[r.week[i - 1]] : 0, isT = y === r.today, past = y < r.today, we = i >= 5;
    const cls = [k === 1 ? 'on' : k === 2 ? 'sh' : past && !we ? 'miss' : '', k && prev ? 'jl' : '', isT ? 'today' : '', we ? 'we' : '', isT && anim ? 'stamp' : ''].filter(Boolean).join(' ');
    return `<li class="${cls}"><span class="dw">${DOW[i]}</span><i class="wd">${k === 1 ? flame('fsm', { tier: tierOf(r.cur) }) : k === 2 ? shieldSvg('fsm') : ''}</i></li>`;
  }).join('')}</ol>`;
}

/* ----- 다음 보상: 연속·누적 중 가장 가까운 것 ----- */
function nextOf(r) {
  const cand = REWARDS.filter(x => !rwOn(x, r.best, r.total)).map(x => ({ ...x, left: x.by === 'total' ? x.d - r.total : x.d - r.cur, from: x.by === 'total' ? r.total : r.cur }));
  return cand.sort((a, b) => a.left - b.left || a.d - b.d)[0] || null;
}
function progressHtml(r) {
  const n = nextOf(r);
  if (!n) return '<p class="att-next done">🎉 모든 출석 보상을 모았어요!</p>';
  const lastD = Math.max(0, ...REWARDS.filter(x => x.by === n.by && x.d < n.d).map(x => x.d));
  const base = n.by === 'best' && r.cur < lastD ? 0 : lastD;
  const pct = Math.max(4, Math.min(100, Math.round((n.from - base) / (n.d - base) * 100)));
  return `<div class="att-next"><span class="rw-box">${rwIcon(n)}</span><div class="att-bar"><p><span><b>${n.by === 'total' ? `총 ${n.d}일 출석` : `${n.d}일 연속`}</b> · ${KIND[n.kind]}${n.kind === 'title' || n.kind === 'color' ? ` ${esc(rwName(n))}` : ''}</span><small>${n.left > 0 ? `${n.left}일 남았어요` : '오늘 받아요!'}</small></p><span class="track"><i data-p="${pct}"></i></span></div></div>`;
}

/* ----- 축하 창 (그날 첫 출석) — 평소엔 짧게, 기념일은 크게 ----- */
function celebrate(r) {
  const m = $('#mAtt'); if (!m) return;
  const big = !!r.milestone, first = r.total === 1, pw = perfectWeek(r) && r.week.indexOf(r.today) === 4;   // 금요일에 개근 완성
  const msg = first ? '첫 출석이에요! 등교하는 날마다 들러서 불꽃을 키워 보세요' : r.lost > 1 ? `아쉽게 ${r.lost}일 기록이 끊겼어요. 오늘부터 다시 키워요!` : CHEER[Math.floor(Math.random() * CHEER.length)];
  const notes = [
    pw ? '<p class="att-note pwk">🏆 <span><b>이번 주 개근!</b> 월~금 모두 출석했어요</span></p>' : '',
    r.used ? `<p class="att-note sh">${shieldSvg('ic')}<span>방패 <b>${r.used}개</b>가 빠진 날을 지켜 줬어요</span></p>` : '',
    r.gotShield ? `<p class="att-note sh got">${shieldSvg('ic')}<span>연속 ${r.cur}일! <b>출석 방패 +1</b> <small>(${r.shield}/${r.shieldMax})</small></span></p>` : '',
    r.pf && [7, 14, 30, 50, 100].includes(r.cur) ? '<p class="att-note pfn">✨ <span><b>완벽한 연속</b> — 방패 없이 여기까지 왔어요</span></p>' : '',
  ].join('');
  const gifts = (r.unlocked || []).map((x, i) => `<div class="att-gift k-${x.kind}" data-i="${i}"><span class="rw-box">${rwIcon(x)}</span><p><b>${x.by === 'total' ? `총 ${x.d}일 출석 보상` : `${x.d}일 연속 보상`}</b><small>새 ${KIND[x.kind]}${x.kind === 'title' || x.kind === 'color' ? ` ${esc(rwName(x))}` : ''} 해금!</small></p></div>`).join('');
  const kick = big ? `<p class="att-kick">${r.unlocked?.length ? '🎁 보상 도착!' : `🎉 ${r.cur}일 달성!`}</p>` : '';
  $('#attSheet').className = `sheet att-pop${big ? ' ms' : ''}`;
  $('#attSheet').innerHTML = `
    ${big ? '<div class="att-burst" aria-hidden="true"><i class="rays"></i></div>' : ''}
    <div class="att-hero">
      ${kick}
      ${bigFire(r.cur, { ign: true, pf: r.pf && r.cur >= 3, id: 'attNum', from: Math.max(0, r.cur - 1) })}
      <h3 id="attT"><span>${r.cur}</span>일 연속 출석!</h3>
      ${big && !first && !(r.lost > 1) ? '' : `<p class="att-msg">${esc(msg)}</p>`}
    </div>
    ${weekStrip(r, true)}
    ${notes}${gifts ? `<div class="att-gifts">${gifts}</div>` : ''}
    ${progressHtml(r)}
    <div class="row"><button class="btn big" type="button" data-close>${big ? '좋아요!' : '계속하기'}</button><button class="btn ghost" type="button" data-att-open>출석 기록</button></div>`;
  bars($('#attSheet')); api.openModal('#mAtt'); $('#attSheet').scrollTop = 0;   // 창을 열 때 맨 아래 버튼에 초점이 가며 내려간 것을 위로
  if (big) confetti($('#attSheet .att-burst'));
  // 숫자 올라가기: 어제 → 오늘
  const el = $('#attNum'), to = r.cur;
  if (reduce()) { el.textContent = to; return; }
  setTimeout(() => { el.classList.add('roll'); el.textContent = to; }, 650);
}
// 색종이: 위치·회전·색·늦게 시작은 CSSOM으로 (CSP가 style 속성을 막음)
const CONF = ['#ff8a3d', '#ffd36a', '#6fc6f4', '#8fe8cf', '#ffaad3', '#bba6ff'];
function confetti(box) {
  if (!box || reduce()) return;
  for (let i = 0; i < 34; i++) {
    const c = document.createElement('i'); c.className = 'cf' + (i % 3 ? '' : ' rd');
    const a = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 150;
    c.style.setProperty('--x', `${Math.cos(a) * dist}px`); c.style.setProperty('--y', `${Math.sin(a) * dist * .8 - 40}px`);
    c.style.setProperty('--r', `${Math.random() * 720 - 360}deg`); c.style.setProperty('--d', `${.25 + Math.random() * .35}s`);
    c.style.setProperty('--c', CONF[i % CONF.length]);
    box.appendChild(c);
  }
}

/* ----- 출석 창 (헤더 🔥) ----- */
export async function open(month) {
  const today = kstDay(), viewM = month || today.slice(0, 6);
  if (!month || !$('#attBox')) api.sheet(`<div class="att-sheet" id="attBox"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`);
  try {
    const r = await api.call('att?m=' + viewM);
    st = { ...st, ...r, weekDays: st?.weekDays }; paintChip();
    if (month && $('#attCal')) { $('#attCal').innerHTML = calHtml(r); return; }   // 달만 넘길 땐 달력만 다시
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
    const ymd = `${r.month}${pad(d)}`, k = kinds[ymd], col = (lead + d - 1) % 7, we = col >= 5;
    const jl = k && col > 0 && kinds[`${r.month}${pad(d - 1)}`];   // 같은 줄에서 전날과 이어지면 띠
    h += `<span class="${[k === 1 ? 'on' : k === 2 ? 'sh' : '', jl ? 'jl' : '', ymd === r.today ? 'today' : '', ymd > r.today ? 'fut' : '', we ? 'we' : ''].filter(Boolean).join(' ')}"${k ? ` data-tip="${k === 1 ? '출석' : '방패로 지킴'}"` : ''}>${k === 1 ? flame('cf') : k === 2 ? shieldSvg('cf') : ''}<em>${d}</em></span>`;
  }
  const cnt = r.days.filter(x => x.kind === 1).length;
  const prev = (() => { const t = new Date(y, mo - 2, 1); return `${t.getFullYear()}${pad(t.getMonth() + 1)}`; })();
  const next = (() => { const t = new Date(y, mo, 1); return `${t.getFullYear()}${pad(t.getMonth() + 1)}`; })();
  return `<div class="att-cal-h"><button type="button" class="pg" data-att-m="${prev}" aria-label="이전 달">‹</button><b>${y}년 ${mo}월 <small>· ${cnt}일 출석</small></b><button type="button" class="pg" data-att-m="${next}" aria-label="다음 달" ${next > r.today.slice(0, 6) ? 'disabled' : ''}>›</button></div>
    <div class="att-cal">${h}</div>`;
}
function rewardsHtml(r, by) {
  const list = REWARDS.filter(x => x.by === by), have = list.filter(x => rwOn(x, r.best, r.total)).length;
  return `<div class="att-rwh"><b>${by === 'best' ? '연속 기록 보상' : '누적 출석 보상'}</b><small>${by === 'best' ? `최고 ${r.best}일` : `총 ${r.total}일`} · ${have}/${list.length}개 받음</small></div>
    <ul class="att-rw">${list.map(x => {
      const on = rwOn(x, r.best, r.total);
      return `<li class="k-${x.kind}${on ? ' on' : ''}" data-tip="${esc(KIND[x.kind])}${x.kind === 'title' || x.kind === 'color' ? ' · ' + esc(rwName(x)) : ''}">${rwIcon(x)}${x.kind === 'title' ? `<span class="rw-t">${esc(x.v)}</span>` : x.kind === 'color' ? `<span class="rw-t">${esc(COLOR_NAME[x.v])}</span>` : ''}<b>${x.d}일</b><small>${on ? '받음 ✓' : KIND[x.kind]}</small>${on ? '' : '<i class="lk" aria-label="잠김">🔒</i>'}</li>`;
    }).join('')}</ul>`;
}
function sheetHtml(r) {
  const shields = Array.from({ length: r.shieldMax }, (_, i) => shieldSvg(i < r.shield ? 'on' : 'off')).join('');
  const state = !r.cur ? '오늘부터 다시 불꽃을 키워 봐요' : !r.done ? '오늘은 아직이에요' : r.pf && r.cur >= 3 ? '✨ 완벽한 연속 — 방패 없이 이어 가는 중' : '✅ 오늘 출석 완료';
  return `
    <div class="att-top">
      ${bigFire(r.cur, { sm: true, pf: r.pf && r.cur >= 3 })}
      <div class="att-tt">
        <h3>${r.cur ? `${r.cur}일 연속 출석` : '오늘부터 시작!'}</h3>
        <p class="muted small">${state}</p>
      </div>
    </div>
    <div class="att-stats">
      <div><b>${r.best}</b><small>최고 기록</small></div>
      <div><b>${r.total}</b><small>총 출석</small></div>
      <div class="shs" data-tip="연속 ${r.shieldEvery}일마다 1개 · 최대 ${r.shieldMax}개"><span>${shields}</span><small>출석 방패</small></div>
    </div>
    ${progressHtml(r)}
    <section class="att-sec" id="attCal">${calHtml(r)}</section>
    <section class="att-sec"><h4>출석 보상 <small>한 번 받으면 기록이 끊겨도 계속 쓸 수 있어요 · 프로필 꾸미기에서 골라요</small></h4>${rewardsHtml(r, 'best')}${rewardsHtml(r, 'total')}</section>
    <section class="att-sec"><h4>연속 출석 순위</h4>
      <div class="segs"><button type="button" data-att-rank="friends" class="on">친구</button><button type="button" data-att-rank="all">전체</button></div>
      <ol class="rank" id="attRank"><li class="skel"></li></ol></section>
    <details class="att-rule"><summary>출석 규칙</summary>
      <ul><li>로그인한 채로 사이트를 열면 하루 한 번 자동으로 출석돼요.</li>
      <li><b>등교하는 날(월~금)</b>을 빠지면 연속 기록이 끊겨요. 주말·공휴일·방학은 쉬어도 괜찮아요.</li>
      <li>주말·공휴일에 들러도 +1일이에요.</li>
      <li>연속 ${r.shieldEvery}일마다 <b>출석 방패</b>를 1개 받아요(최대 ${r.shieldMax}개). 빠진 등교일 하루를 방패가 자동으로 메워 줘요.</li>
      <li>방패를 한 번도 안 쓰고 이어 가면 <b>완벽한 연속</b> — 불꽃에 금빛 후광이 생겨요.</li>
      <li>불꽃은 7일·30일·100일에 색이 바뀌어요.</li>
      <li>보상은 최고 연속 기록·총 출석일 기준이라 한 번 받으면 사라지지 않아요.</li></ul></details>
    <div class="row"><button class="btn ghost" type="button" data-close>닫기</button></div>`;
}
async function loadRank(scope) {
  const list = $('#attRank'); if (!list) return;
  list.innerHTML = '<li class="skel"></li>';
  try {
    const r = await api.call('attrank?scope=' + scope);
    const medal = i => ['🥇', '🥈', '🥉'][i] || i + 1;
    list.innerHTML = r.list.length ? r.list.map((u, i) => `<li class="${u.isMe ? 'me' : ''}"><span class="rk">${medal(i)}</span><a href="#u/${esc(u.handle)}" data-u="1">${api.av(u)}<span class="pi"><b>${esc(api.nameOf(u))}${api.devTag(u)}</b><small>${u.title ? `🏷️ ${esc(u.title)}` : esc(api.classTxt(u) || api.atOf(u))}</small></span></a><b class="rv att-rv t${tierOf(u.value)}${u.pf && u.value >= 3 ? ' pf' : ''}">${flame('fsm', { tier: tierOf(u.value) })}${u.value}</b></li>`).join('')
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
