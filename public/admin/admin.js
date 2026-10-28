// SVMHS GROUND 관리자 화면. 서버는 functions/api/admin/[[path]].js
// CSP 때문에 인라인 스크립트·style 속성은 못 씀 → 이벤트는 위임, 막대 높이는 CSSOM으로 지정.

import { emo } from '/js/att-art.js';   // 출석 보상 프로필 사진(직접 그린 그림)
import { MASCOT } from '/js/mascots.js';   // 기본 프로필 캐릭터(k:이름) 그림 — 사이트 CSS 없이도 그림으로 보이게
const $ = s => document.querySelector(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const GAMES = {
  // sus: 사람이 내기 어려운 기록(이 값 이하) → 게임 기록 화면에 '의심' 표시
  // 순서는 사이트 게임 목록과 같게 (2026-10-25)
  home: { name: '집에 가고 싶어!', em: '🏠', fmt: v => (1000000 - v).toLocaleString('ko-KR') + 'm', sus: 1000000 - 30000 },   // 저장값 = 1000000 - 거리. 3만m(약 13분 무사고) 넘으면 의심
  gear: { name: '기자재 정리!', em: '🎥', fmt: v => (9999999 - v).toLocaleString('ko-KR') + '점', sus: 9999999 - 200000 },   // 저장값 = 9999999 - 점수. 20만 점 넘으면 의심
  gearn: { name: '기자재 정리! 일반', em: '🎥', fmt: v => (9999999 - v).toLocaleString('ko-KR') + '점', sus: 9999999 - 500000 },   // 일반 모드(시간 제한 없음, 순위만·티어 제외)
  stair: { name: '영상고 계단 오르기', em: '🪜', fmt: v => (9999999 - v).toLocaleString('ko-KR') + '칸', sus: 9999999 - 3000 },   // 저장값 = 9999999 - 오른 칸. 3천 칸 넘으면 의심
  reaction: { name: '반응속도', em: '⚡', fmt: v => v + 'ms', sus: 160 },
  num25: { name: '1 to 25', em: '🔢', fmt: v => (v / 1000).toFixed(2) + '초', sus: 7000 },
  cut: { name: '컷 타이밍', em: '🎬', fmt: v => '오차 ' + v + 'ms', sus: 20 },   // 2026-10-26 하율: 학생들이 잘해서 40 → 20 (한 판 평균 4ms 이하만 의심)
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const pad = n => String(n).padStart(2, '0');

/* ----- 날짜 표시 (한국 시간) ----- */
const kst = t => new Date(t + 9 * 3600e3);
const kstYmd = (t = Date.now()) => kst(t).toISOString().slice(0, 10).replace(/-/g, '');
const ymdLabel = y => { const d = new Date(Date.UTC(+y.slice(0, 4), +y.slice(4, 6) - 1, +y.slice(6, 8))); return `${+y.slice(4, 6)}/${+y.slice(6, 8)} (${DOW[d.getUTCDay()]})`; };
const when = t => {
  if (!t) return '-';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400 && kstYmd(t) === kstYmd()) return Math.floor(s / 3600) + '시간 전';
  const d = kst(t);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const full = t => { const d = kst(t); return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };

/* ----- 서버 호출 ----- */
async function call(path, body) {
  const res = await fetch('/api/admin/' + path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  let data = {}; try { data = await res.json(); } catch {}
  if (res.status === 401 && path !== 'login') { showGate(); throw new Error(data.error || '로그인이 필요해요'); }
  if (!res.ok) throw new Error(data.error || '오류 ' + res.status);
  return data;
}
let toastT;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); };
const fail = e => toast('⚠️ ' + (e.message || e));

// 프로필 사진: 캐릭터(k:이름)는 사이트처럼 얼굴 쪽을 확대한 그림, 출석 보상 그림(r:이름)은 SVG, 나머지는 글자
const avIn = v => { const m = /^k:([a-z]+)$/.exec(v || ''); return m && MASCOT[m[1]] ? MASCOT[m[1]].replace("viewBox='0 0 100 100'", "viewBox='10 -4 80 80' class='kv' aria-hidden='true'") : emo(v || '❔', 'ava'); };
const av = u => `<span class="av">${avIn(u?.avatar)}</span>`;
const who = (u, sub) => u ? `<span class="who">${av(u)}<span><b>${esc(u.name)}${u.online ? '<i class="on-dot" title="접속 중"></i>' : ''}</b><small>@${esc(u.handle)}${sub ? ' · ' + sub : ''}</small></span></span>` : '<span class="sub">(탈퇴한 사용자)</span>';
const cls = u => u.grade && u.cls ? `${u.grade}-${u.cls}` : '';

/* 한글 입력 상태로 친 비밀번호를 영문 자판 글자로 되돌림 (2026-10-27 하율: 관리자 비밀번호는 무조건 영어로)
   두벌식: 'ㅗ741…' → 'h741…', '가' → 'rk'. 완성형 글자는 초·중·종성으로 풀어서 바꿈 */
const KEY = { 'ㄱ':'r','ㄲ':'R','ㄴ':'s','ㄷ':'e','ㄸ':'E','ㄹ':'f','ㅁ':'a','ㅂ':'q','ㅃ':'Q','ㅅ':'t','ㅆ':'T','ㅇ':'d','ㅈ':'w','ㅉ':'W','ㅊ':'c','ㅋ':'z','ㅌ':'x','ㅍ':'v','ㅎ':'g',
  'ㅏ':'k','ㅐ':'o','ㅑ':'i','ㅒ':'O','ㅓ':'j','ㅔ':'p','ㅕ':'u','ㅖ':'P','ㅗ':'h','ㅛ':'y','ㅜ':'n','ㅠ':'b','ㅡ':'m','ㅣ':'l',
  'ㅘ':'hk','ㅙ':'ho','ㅚ':'hl','ㅝ':'nj','ㅞ':'np','ㅟ':'nl','ㅢ':'ml','ㄳ':'rt','ㄵ':'sw','ㄶ':'sg','ㄺ':'fr','ㄻ':'fa','ㄼ':'fq','ㄽ':'ft','ㄾ':'fx','ㄿ':'fv','ㅀ':'fg','ㅄ':'qt' };
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const hasKo = s => /[ㄱ-ㅣ가-힣]/.test(s);
const toEng = s => [...s].map(ch => {
  const c = ch.charCodeAt(0) - 0xAC00;
  if (c >= 0 && c < 11172) return KEY[CHO[Math.floor(c / 588)]] + KEY[JUNG[Math.floor(c % 588 / 28)]] + (JONG[c % 28] ? KEY[JONG[c % 28]] : '');
  return KEY[ch] ?? ch;
}).join('');

/* ===== 로그인 화면 ===== */
async function showGate() {
  $('#app').hidden = true; $('#gate').hidden = false;
  const box = $('#gateBody');
  let st;
  try { st = await (await fetch('/api/admin/status', { cache: 'no-store' })).json(); } catch { st = null; }
  if (st && st.authed) return start();
  if (!st || !st.db) {
    box.innerHTML = `<p class="sub">관리자 페이지를 쓰려면 Cloudflare에서 D1 데이터베이스(<code>wrangler.jsonc</code>의 바인딩 <code>DB</code>)를 연결해야 해요.</p>`;
    return;
  }
  // 관리자 계정으로 사이트에 로그인돼 있으면 비밀번호만 한 번 더 확인 → 12시간 관리자 세션
  box.innerHTML = `<form id="loginF" autocomplete="on">
      <p class="sub">사이트에서 <b>developer</b> 계정으로 로그인한 상태에서만 들어올 수 있어요.</p>
      <input type="text" name="username" value="${esc(st.admin)}" autocomplete="username" hidden>
      <label class="f">developer 비밀번호<input class="inp" type="password" name="pw" lang="en" inputmode="latin" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="current-password" required autofocus></label>
      <p class="sub" id="koNote" hidden>한글로 입력되고 있어요 — 영문 자판 글자로 바꿔서 보내요</p>
      <p class="err" id="loginErr"></p>
      <button class="btn pri" type="submit">들어가기</button>
    </form>`;
  const pwIn = $('#loginF').pw;
  // 한글이 들어오면 바로 영문 자판 글자로 바꿈(조합이 끝난 뒤) + 안내
  const fix = () => { if (hasKo(pwIn.value)) { pwIn.value = toEng(pwIn.value); $('#koNote').hidden = false; } };
  pwIn.addEventListener('compositionend', fix);
  pwIn.addEventListener('input', e => { if (!e.isComposing) fix(); });
  $('#loginF').addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.target.querySelector('button'); b.disabled = true; $('#loginErr').textContent = '';
    try {
      const res = await fetch('/api/s/admin-pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pw: toEng(e.target.pw.value) }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 401 && !/비밀번호/.test(d.error || '') ? '먼저 사이트에서 관리자 계정으로 로그인해 주세요' : d.error || '오류 ' + res.status);
      start();
    } catch (x) { $('#loginErr').textContent = x.message; b.disabled = false; }
  });
}

/* ===== 화면 전환 ===== */
const VIEWS = {};
let cur = '';
function route() {
  const [v, ...rest] = location.hash.slice(1).split('/');
  const name = VIEWS[v] ? v : 'dash';
  cur = name;
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === name));
  $('#main').innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  VIEWS[name](decodeURIComponent(rest.join('/'))).catch(e => { if (cur === name) $('#main').innerHTML = `<p class="empty">불러오지 못했어요: ${esc(e.message)}</p>`; });
}
let started = false;
function start() {
  $('#gate').hidden = true; $('#app').hidden = false;
  if (!started) { started = true; window.addEventListener('hashchange', route); refreshBadge(); setInterval(refreshBadge, 60e3); }
  route();
}
async function refreshBadge(full) {
  if (!full && document.hidden) return null;   // 안 보는 탭은 쉼 (D1 읽기 절약)
  try {
    const d = await call(full ? 'dash' : 'badges');
    const b = $('#repBadge'); b.hidden = !d.counts.openReports; b.textContent = d.counts.openReports;
    const f = $('#fbBadge'); f.hidden = !d.counts.openFeedback; f.textContent = d.counts.openFeedback;
    return d;
  } catch { return null; }
}

/* ===== 대시보드 ===== */
VIEWS.dash = async () => {
  const d = await call('dash');
  const c = d.counts, s = d.status;
  $('#repBadge').hidden = !c.openReports; $('#repBadge').textContent = c.openReports;
  const tile = (n, label, k = '', href = '') => `<${href ? `a href="${href}"` : 'div'} class="stat ${k}"><b>${n}</b><span>${label}</span></${href ? 'a' : 'div'}>`;
  const max = Math.max(1, ...d.days.flatMap(x => [x.signups, x.players, x.dms]));
  const chk = (on, label, href, mid) => `<li><i class="dot ${on ? 'on' : mid ? 'mid' : 'off'}"></i>${label}${href ? `<a href="${href}">바꾸기 →</a>` : ''}</li>`;
  $('#main').innerHTML = `
    <div class="vh"><h2>대시보드</h2><span class="sub">${full(Date.now())} 기준</span><button class="btn sm" id="reDash" type="button">새로 고침</button></div>
    <div class="stats">
      ${tile(c.openReports, '처리 안 한 신고', c.openReports ? 'hot' : 'c4', '#reports')}
      ${tile(c.openFeedback, '안 읽은 의견', c.openFeedback ? 'hot' : 'c4', '#feedback')}
      ${tile(c.heldScores || 0, '보류된 게임 기록', c.heldScores ? 'hot' : 'c4', '#scores')}
      ${tile(c.online, '지금 접속 중', 'c2', '#users')}
      ${tile(c.activeToday, '오늘 들어온 사람', 'c1')}
      ${tile(c.users, '전체 가입자', 'c1', '#users')}
      ${tile(c.newToday, '오늘 새로 가입', 'c2')}
      ${tile(c.dmsToday, '오늘 보낸 DM', 'c3')}
      ${tile(c.playsToday, '오늘 게임한 기록', 'c3', '#scores')}
      ${tile(c.mealVotes, '오늘 급식 투표', 'c4')}
      ${tile(c.balanceVotes, '오늘 밸런스 투표', 'c4', '#balance')}
      ${tile(c.banned, '이용 정지 중', c.banned ? 'c4' : 'c4', '#users/filter=banned')}
    </div>
    <div class="grid g3">
      <section class="card span2"><h3>📈 최근 2주</h3>
        <div class="chart" id="chart">${d.days.map(x => `<div class="col" title="${ymdLabel(x.ymd)} · 가입 ${x.signups} · 게임 ${x.players}명 · DM ${x.dms}"><i class="k1" data-h="${x.signups / max}"></i><i class="k2" data-h="${x.players / max}"></i><i class="k3" data-h="${x.dms / max}"></i></div>`).join('')}</div>
        <div class="xlab">${d.days.map((x, i) => `<span>${i % 2 ? '' : +x.ymd.slice(6)}</span>`).join('')}</div>
        <p class="legend"><span><i class="k1"></i>새 가입</span><span><i class="k2"></i>게임한 사람</span><span><i class="k3"></i>DM 수</span><span>가장 큰 값 ${max}</span></p>
      </section>
      <section class="card"><h3>🩺 사이트 상태</h3>
        <ul class="checks">
          ${chk(true, 'D1 데이터베이스 연결됨')}
          ${chk(s.dbWrite, s.dbWrite ? 'DB 저장 정상' : 'DB 저장 멈춤 — Cloudflare 계정 전체 무료 한도(하루 10만 행) 초과, 오전 9시에 풀림')}
          ${chk(s.neisKey, s.neisKey ? '나이스 인증키 있음 (시간표 전 교시)' : '나이스 인증키 없음 → 시간표 5교시까지만')}
          ${chk(s.signup, s.signup ? '새 가입 열림' : '새 가입 닫힘', '#settings')}
          ${chk(s.joinCode, s.joinCode ? '가입 코드 사용 중 (친구만 가입)' : '가입 코드 없음 → 주소만 알면 누구나 가입', '#settings', true)}
          ${chk(s.dm, s.dm ? 'DM 켜짐' : 'DM 꺼짐', '#settings')}
          ${chk(s.notice, s.notice ? '공지 올라가 있음' : '올린 공지 없음', '#notice', true)}
        </ul>
      </section>
    </div>
    <section class="card sp"><h3>🏫 반별 가입자</h3>
        <div class="pills">${d.classes.length ? d.classes.map(x => `<span class="pill">${x.grade}-${x.cls}<b>${x.n}</b></span>`).join('') : '<span class="sub">학년·반을 적은 사람이 아직 없어요</span>'}</div>
    </section>`;
  document.querySelectorAll('#chart i').forEach(i => { i.style.height = (+i.dataset.h * 100) + '%'; });
  $('#reDash').onclick = () => route();
};

/* ===== 신고 ===== */
let repState = 'open', fbState = 'open';
/* ===== 의견 (학생 → 개발자) ===== */
const FBK = { idea: '💡 기능 제안', bug: '🐞 오류', etc: '💬 기타' };
VIEWS.feedback = async () => {
  const d = await call('feedback' + (fbState === 'done' ? '?state=done' : ''));
  $('#main').innerHTML = `<div class="vh"><h2>의견</h2><span class="sub">안 읽은 ${d.unread}건 · 확인 안 한 ${d.open}건 · 전체 ${d.total}건</span>${fbState === 'open' && d.unread ? '<button class="btn sm" type="button" data-act="fbreadall">👀 모두 읽음</button>' : ''}
      <div class="seg"><button type="button" data-fs="open" class="${fbState === 'open' ? 'on' : ''}">새 의견</button><button type="button" data-fs="done" class="${fbState === 'done' ? 'on' : ''}">확인함</button></div></div>
    ${d.list.length ? d.list.map(x => `<section class="card fb${!x.done && !x.rd ? ' unread' : ''}"><div class="fbh">${!x.done && !x.rd ? '<span class="tag new">NEW</span>' : ''}<span class="tag">${FBK[x.kind] || x.kind}</span>${x.user ? who(x.user, cls(x.user)) : '<span class="sub">(탈퇴한 사용자)</span>'}<span class="sub">${when(x.at)}</span></div>
        <p class="fbb">${esc(x.body)}</p>${x.imgs ? `<div class="fbimgs">${Array.from({ length: x.imgs }, (_, i) => `<a href="/api/admin/fbimg/${x.id}/${i}" target="_blank" rel="noopener"><img src="/api/admin/fbimg/${x.id}/${i}" alt="첨부 사진 ${i + 1}" loading="lazy"></a>`).join('')}</div>` : ''}${x.note ? `<p class="sub">📝 ${esc(x.note)}</p>` : ''}
        <div class="row">${x.done ? `<button class="btn sm" type="button" data-act="fbreopen" data-id="${x.id}">되돌리기</button>` : `${x.rd ? `<button class="btn sm" type="button" data-act="fbunread" data-id="${x.id}">안 읽음으로</button>` : `<button class="btn sm" type="button" data-act="fbread" data-id="${x.id}">👀 읽음</button>`}<button class="btn sm ok" type="button" data-act="fbdone" data-id="${x.id}">✅ 확인함</button>`}
          ${x.user ? `<button class="btn sm" type="button" data-act="user" data-h="${esc(x.user.handle)}">👤 보낸 사람</button>` : ''}
          <button class="btn sm bad" type="button" data-act="fbdel" data-id="${x.id}">삭제</button></div></section>`).join('') : `<p class="empty">${fbState === 'open' ? '새 의견이 없어요' : '확인한 의견이 없어요'}</p>`}`;
};
/* ===== 모니터링 (20초마다 자동 새로 고침, 이 화면에 있을 때만) ===== */
let monTimer = 0, ccuRange = 'today';
const FEED = {
  signup: (u, x) => `${who(u)} <span class="sub">가입</span>`,
  score: (u, x) => { const [g, v] = String(x).split(':'); return `${who(u)} <span class="sub">${GAMES[g]?.em || '🎮'} ${esc(GAMES[g]?.name || g)} ${esc(GAMES[g] ? GAMES[g].fmt(+v) : v)}${GAMES[g] && +v <= GAMES[g].sus ? ' <b class="sus">의심</b>' : ''}</span>`; },
  follow: (u, x) => `${who(u)} <span class="sub">→ @${esc(x || '?')} 팔로우</span>`,
  report: (u, x) => `${who(u)} <span class="sub">→ @${esc(x || '?')} 신고</span>`,
};
const SRC = { s: '소셜', admin: '관리자', api: '투표·공지', neis: '나이스' };
/* 동접 선그래프 — 서버 ccu: 5분 칸마다 접속한 사람 수(개발자·테스트 제외). 7일은 1시간마다 최고값 */
const hm = t => { const d = new Date(t + 9 * 3600e3); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
const md = t => { const d = new Date(t + 9 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
let ccuSer = null;
function ccuSeries(c) {
  const wk = c.range === 'week', step = wk ? 3600e3 : c.step, map = new Map();
  for (const [t, n] of c.pts) { const k = Math.floor(t / step) * step; map.set(k, Math.max(map.get(k) || 0, n)); }
  const x0 = c.from, x1 = c.range === 'yday' ? c.to : wk ? c.from + 7 * 86400e3 : c.from + 86400e3;
  const start = c.first ? Math.max(c.from, Math.floor(c.first / step) * step) : Infinity, end = wk ? Math.min(c.to, Date.now()) : Math.min(c.to, Math.floor(Date.now() / step) * step - step);   // 아직 안 끝난 5분 칸은 덜 세어져서 뺌
  const pts = []; for (let t = start; t <= end; t += step) pts.push([t, map.get(t) || 0]);
  return { wk, step, x0, x1, pts };
}
function ccuCard(c, live) {
  const S = ccuSeries(c); ccuSer = S;
  const W = 1200, H = 210, L = 34, R = 12, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
  const max = Math.max(0, ...S.pts.map(p => p[1])), top = Math.max(4, Math.ceil(max * 1.15));
  const X = t => L + (t - S.x0) / (S.x1 - S.x0) * pw, Y = n => T + ph - n / top * ph;
  const tstep = top <= 8 ? 1 : top <= 20 ? 5 : top <= 50 ? 10 : 20;
  let g = '';
  for (let v = 0; v <= top; v += tstep) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="cg"/><text x="${L - 6}" y="${Y(v) + 4}" class="cy">${v}</text>`;
  const xt = S.wk ? 86400e3 : 3 * 3600e3;
  for (let t = S.x0; t <= S.x1; t += xt) g += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${T + ph}" class="cg v"/><text x="${X(t)}" y="${H - 6}" class="cx">${S.wk ? md(t) : (t === S.x1 ? '24시' : hm(t).slice(0, 2).replace(/^0/, '') + '시')}</text>`;
  const pk = S.pts.reduce((a, p) => (p[1] > a[1] ? p : a), [0, 0]);
  const last = S.pts[S.pts.length - 1];
  let line = '', area = '';
  if (S.pts.length) {
    line = S.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    area = `${line}L${X(last[0]).toFixed(1)},${T + ph}L${X(S.pts[0][0]).toFixed(1)},${T + ph}Z`;
  }
  const seg = [['today', '오늘'], ['yday', '어제'], ['week', '7일']].map(([k, l]) => `<button type="button" data-ccu="${k}" class="${k === c.range ? 'on' : ''}">${l}</button>`).join('');
  const sumTxt = !S.pts.length ? (c.first ? '이 기간엔 기록이 없어요' : '기록을 막 시작했어요 — 학생이 들어오면 5분마다 점이 찍혀요')
    : `${c.range === 'today' ? `지금 <b class="num">${live}</b>명 · ` : ''}최고 <b class="num">${pk[1]}</b>명 <span class="sub">(${S.wk ? md(pk[0]) + ' ' : ''}${hm(pk[0])}${S.wk ? '시대' : ''})</span>`;
  return `<section class="card ccu"><h3>📈 동시 접속 <span class="sub">${S.wk ? '1시간마다 가장 많았던 순간' : '5분마다 접속한 사람 수'}</span><div class="seg">${seg}</div></h3>
    <p class="ccs">${sumTxt}</p>
    <div class="ccw"><svg id="ccuSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="동시 접속 그래프">${g}
      ${area ? `<path d="${area}" class="ca"/><path d="${line}" class="cl"/>` : ''}
      ${pk[1] ? `<circle cx="${X(pk[0])}" cy="${Y(pk[1])}" r="5" class="cp"/>` : ''}
      ${c.range === 'today' && last ? `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="5" class="cn"/>` : ''}
      <line id="ccuV" class="cv" y1="${T}" y2="${T + ph}" x1="-9" x2="-9"/><circle id="ccuD" r="5" class="cd" cx="-9" cy="-9"/>
      <rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent" id="ccuHit"/></svg><div class="ctip" id="ccuTip" hidden></div></div>
    <p class="sub sp">개발자·테스트 계정은 빼고 셈${c.first ? ` · ${md(c.first)} ${hm(c.first)}부터 기록` : ''} · 그래프 위에 마우스를 올리면 그 시각 숫자가 보여요</p></section>`;
}
function ccuHover(c) {
  const svg = $('#ccuSvg'), hit = $('#ccuHit'), tip = $('#ccuTip'), S = ccuSer;
  if (!svg || !S || !S.pts.length) return;
  const W = 1200, H = 210, L = 34, R = 12, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
  const top = Math.max(4, Math.ceil(Math.max(...S.pts.map(p => p[1])) * 1.15));
  const move = e => {
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W;
    const t = S.x0 + (vx - L) / pw * (S.x1 - S.x0);
    let i = Math.round((t - S.pts[0][0]) / S.step); i = Math.max(0, Math.min(S.pts.length - 1, i));
    const [pt, n] = S.pts[i], x = L + (pt - S.x0) / (S.x1 - S.x0) * pw, y = T + ph - n / top * ph;
    $('#ccuV').setAttribute('x1', x); $('#ccuV').setAttribute('x2', x);
    $('#ccuD').setAttribute('cx', x); $('#ccuD').setAttribute('cy', y);
    tip.hidden = false;
    tip.innerHTML = `<b>${n}명</b> <span>${S.wk ? md(pt) + ' ' + hm(pt) + '~' + hm(pt + 3600e3) : hm(pt) + '~' + hm(pt + S.step)}</span>`;
    const px = x / W * r.width;
    tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, px - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(0, y / H * r.height - tip.offsetHeight - 12) + 'px';
  };
  const out = () => { tip.hidden = true; $('#ccuV').setAttribute('x1', -9); $('#ccuV').setAttribute('x2', -9); $('#ccuD').setAttribute('cx', -9); };
  hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move); hit.addEventListener('pointerleave', out);
}
VIEWS.monitor = async () => {
  clearTimeout(monTimer);
  const d = await call('monitor?ccu=' + ccuRange);
  if (cur !== 'monitor') return;
  const tile = (n, label, k = '') => `<div class="stat ${k}"><b>${n}</b><span>${label}</span></div>`;
  const nowH = (new Date(Date.now() + 9 * 3600e3)).getUTCHours();
  const meals = { 1: '조식', 2: '중식', 3: '석식' };
  const t = d.db.tables;
  $('#main').innerHTML = `
    <div class="vh"><h2>모니터링</h2><span class="sub">${full(d.at)} 기준 · 20초마다 새로 고침${d.deploy.sha ? ` · 배포 <code>${esc(d.deploy.sha)}</code>${d.deploy.branch ? ' (' + esc(d.deploy.branch) + ')' : ''}` : ' · 로컬 실행'}</span><button class="btn sm" type="button" data-act="monrefresh">지금 새로 고침</button></div>
    <div class="stats">
      ${tile(d.online.length, '지금 접속 중 (2분 안)', d.online.length ? 'c1' : '')}
      ${tile(d.activeHour, '최근 1시간 들어온 사람', 'c1')}
      ${tile(d.activeWeek, '최근 7일 들어온 사람', 'c1')}
      ${tile(d.activeMonth, '최근 30일 들어온 사람', 'c1')}
      ${tile(d.sessions, '로그인 유지 중인 기기', 'c2')}
      ${tile(d.errors24h, '최근 24시간 서버 오류', d.errors24h ? 'hot' : 'c3')}
      ${tile(d.db.write ? '정상' : '멈춤', 'DB 저장 (계정 무료 한도)', d.db.write ? 'c2' : 'hot')}
      ${tile(d.neis.ok ? d.neis.ms + 'ms' : '오류', '나이스 연결' + (d.neis.key ? '' : ' (인증키 없음)'), d.neis.ok ? 'c4' : 'hot')}
    </div>
    ${ccuCard(d.ccu, d.online.length)}
    <div class="grid g3">
      <section class="card"><h3>🟢 지금 접속 중 <span class="sub num">${d.online.length}</span></h3>
        ${d.online.length ? `<ul class="mlist">${d.online.map(u => `<li><a href="#users/${encodeURIComponent(u.handle)}">${who(u, cls(u))}</a><span class="sub">${when(u.seen)}</span></li>`).join('')}</ul>` : '<p class="empty">지금은 아무도 없어요</p>'}
      </section>
      <section class="card"><h3>📰 최근 활동 <span class="sub num">${d.feed.length}</span></h3>
        ${d.feed.length ? `<ul class="mlist">${d.feed.map(x => `<li><span>${FEED[x.k](x.user, x.x)}</span><span class="sub">${when(x.at)}</span></li>`).join('')}</ul>` : '<p class="empty">활동이 없어요</p>'}
      </section>
      <div class="stack wide">
      <section class="card"><h3>⏱ 오늘 시간대별</h3>
        ${(() => {
          const H = d.hours, tot = H.dm.map((_, h) => H.signup[h] + H.score[h] + H.dm[h]);
          const sum = a => a.reduce((x, y) => x + y, 0), tmax = Math.max(1, ...tot), peak = tot.indexOf(Math.max(...tot));
          const pct = n => (n / tmax * 100).toFixed(1) + '%';
          // 아래부터 가입(하늘) → 게임 기록(민트) → DM(노랑), 경계는 잉크 1px
          const grad = (a, b, n) => { const p1 = a / n * 100, p2 = (a + b) / n * 100, L = 'var(--ink)'; return `linear-gradient(to top, var(--sky) 0 ${p1}%, ${a && a < n ? `${L} ${p1}% calc(${p1}% + 1px), ` : ''}var(--lime) calc(${p1}% + ${a && a < n ? 1 : 0}px) ${p2}%, ${b && a + b < n ? `${L} ${p2}% calc(${p2}% + 1px), ` : ''}var(--yellow) calc(${p2}% + ${b && a + b < n ? 1 : 0}px) 100%)`; };
          return `<div class="hsum"><span><i class="k1"></i>가입 <b class="num">${sum(H.signup)}</b></span><span><i class="k2"></i>게임 기록 <b class="num">${sum(H.score)}</b></span><span><i class="k3"></i>DM <b class="num">${sum(H.dm)}</b></span><span class="pk">${tot[peak] ? `가장 바쁜 시간 <b>${peak}시</b> (${tot[peak]}건)` : '오늘 활동 없음'}</span></div>
        <div class="hc" id="hchart">${tot.map((n, h) => `<div class="col${h === nowH ? ' nowh' : ''}${h === peak && n ? ' pk' : ''}" title="${h}시 · 가입 ${H.signup[h]} · 게임 기록 ${H.score[h]} · DM ${H.dm[h]}">${n ? `<div class="bar" data-h="${pct(n)}" data-g="${grad(H.signup[h], H.score[h], n)}"><b>${n}</b></div>` : ''}</div>`).join('')}</div>
        <div class="xlab hx">${tot.map((_, h) => (h === nowH ? `<span class="now">지금</span>` : `<span>${h % 3 || Math.abs(h - nowH) < 2 ? '' : h + '시'}</span>`)).join('')}</div>
        <p class="sub sp">막대 위 숫자 = 그 시간 전체 건수 (색은 종류별 몫 · DM은 개수만, 내용은 안 봄)</p>`;
        })()}
      </section>
        <section class="card"><h3>🍱 오늘 투표</h3>
          ${d.votes.meal.length ? `<ul class="mlist">${d.votes.meal.slice(0, 12).map(v => `<li><span><b>${esc(v.dish)}</b> <span class="sub">${meals[v.meal] || v.meal}</span></span><b class="num">${v.n}표</b></li>`).join('')}</ul>` : '<p class="empty">급식 투표가 아직 없어요</p>'}
          <p class="sub sp">밸런스 게임: A ${d.votes.balance.a || 0}표 · B ${d.votes.balance.b || 0}표 <a href="#balance">자세히 →</a></p>
        </section>
      </div>
    </div>
    <section class="card"><h3>🗄 DB 줄 수</h3>
          <ul class="mlist cols">${Object.entries({ users: '사용자', sessions: '로그인 세션', follows: '팔로우', blocks: '차단', messages: 'DM', scores: '게임 기록', reports: '신고', bans: '정지', meal_votes: '급식 투표', balance_votes: '밸런스 투표', admin_log: '관리 기록', rl: '횟수 제한(임시)', errs: '오류 기록' }).map(([k, l]) => `<li><span>${l} <code>${k}</code></span><b class="num">${t[k] ?? '-'}</b></li>`).join('')}</ul>
          <p class="sub sp">나이스: ${d.neis.ok ? `정상 (${d.neis.ms}ms, ${esc(d.neis.code)})` : `문제 있음 — ${esc(d.neis.code)}`}</p>
    </section>
    <section class="card"><h3>🧯 서버 오류 <span class="sub">최근 60개 · 14일 보관</span>${d.errors.length ? '<button class="btn sm bad" type="button" data-act="errclear">기록 비우기</button>' : ''}</h3>
      ${d.errors.length ? `<ul class="log">${d.errors.map(x => `<li><span class="t">${full(x.at)}</span><b>${esc(SRC[x.src] || x.src)} <code>${esc(x.route)}</code></b><span>${esc(x.msg)}</span></li>`).join('')}</ul>` : '<p class="empty">오류가 없어요 👍</p>'}
    </section>`;
  // 관리자 페이지 CSP가 style="" 속성을 막음 → 높이·색은 JS로 넣음
  document.querySelectorAll('#hchart .bar').forEach(b => { b.style.height = b.dataset.h; b.style.background = b.dataset.g; });
  ccuHover(d.ccu);
  const tick = () => { if (cur !== 'monitor') return; if (document.hidden) monTimer = setTimeout(tick, 20e3); else VIEWS.monitor().catch(() => { monTimer = setTimeout(tick, 20e3); }); };
  monTimer = setTimeout(tick, 20e3);
};

VIEWS.reports = async () => {
  const d = await call('reports' + (repState === 'done' ? '?state=done' : ''));
  $('#main').innerHTML = `
    <div class="vh"><h2>신고</h2>
      <div class="seg"><button type="button" data-rs="open" class="${repState === 'open' ? 'on' : ''}">처리 대기</button><button type="button" data-rs="done" class="${repState === 'done' ? 'on' : ''}">처리 끝</button></div></div>
    <p class="sub sp-b">DM 내용은 신고된 메시지와 그 앞뒤 대화만 볼 수 있어요. 처리한 내용은 관리 기록에 남아요.</p>
    ${d.reports.length ? d.reports.map(r => `
      <article class="card rep" data-id="${r.id}">
        <div class="rh">${who(r.target, r.target ? (r.target.total ? `조치된 신고 ${r.target.total}회` : '조치된 신고 없음') : '')}${r.target?.banned ? '<span class="tag ban">정지 중</span>' : ''}
          <span class="arrow">←</span><span class="sub">신고: ${r.reporter ? '@' + esc(r.reporter.handle) : '(탈퇴)'} · ${when(r.at)}</span></div>
        <p class="why">${esc(r.reason)}</p>
        ${r.msg ? `<div class="ctx" id="ctx${r.id}"><button class="btn sm" type="button" data-act="ctx" data-id="${r.id}">💬 신고된 메시지 보기</button></div>` : '<p class="sub">프로필 신고 (메시지 없음)</p>'}
        ${r.done ? `<p class="sub">${r.done === 1 ? '✅ 처리함' : '➖ 넘김'}${r.note ? ' · ' + esc(r.note) : ''}</p>` : ''}
        <div class="acts">
          ${r.target ? `<button class="btn sm" type="button" data-act="user" data-h="${esc(r.target.handle)}">👤 사용자 관리</button>` : ''}
          ${r.done ? `<button class="btn sm" type="button" data-act="reopen" data-id="${r.id}">되돌리기</button>` : `
            <button class="btn sm ok" type="button" data-act="done" data-id="${r.id}">✅ 처리함</button>
            <button class="btn sm" type="button" data-act="skip" data-id="${r.id}">➖ 문제 없음</button>`}
        </div>
      </article>`).join('') : `<p class="card empty">${repState === 'open' ? '처리할 신고가 없어요 🎉' : '처리한 신고가 없어요'}</p>`}`;
};

async function loadCtx(id) {
  const box = $('#ctx' + id); if (!box) return;
  box.innerHTML = '<div class="skel"></div>';
  const d = await call('context/' + id);
  box.innerHTML = d.messages.length ? d.messages.map(m => `<div class="msg ${m.reported ? 'hit' : ''}">${av(m)}<div><b>${esc(m.name)}</b> <span class="sub">@${esc(m.handle)}</span>
    ${m.del ? '<p class="del">(삭제된 메시지)</p>' : `<p>${esc(m.body)}</p>`}</div><div><span class="t">${when(m.at)}</span>
    ${m.reported && !m.del ? `<br><button class="btn sm bad" type="button" data-act="delmsg" data-id="${m.id}" data-r="${id}">삭제</button>` : ''}</div></div>`).join('')
    : `<p class="sub">${d.gone ? '메시지가 이미 지워졌어요 (탈퇴 등)' : '볼 수 있는 메시지가 없어요'}</p>`;
}

/* ===== 사용자 ===== */
const US = { q: '', sort: 'recent', filter: '' };
VIEWS.users = async arg => {
  if (arg.startsWith('filter=')) { US.filter = arg.slice(7); history.replaceState(null, '', '#users'); }
  else if (arg) { setTimeout(() => openUser(arg)); }
  $('#main').innerHTML = `
    <div class="vh"><h2>사용자</h2><span class="sub" id="uCount"></span></div>
    <div class="bar">
      <input class="inp" id="uQ" type="search" placeholder="아이디·닉네임 검색" value="${esc(US.q)}">
      <select class="inp" id="uSort"><option value="recent">최근 접속 순</option><option value="new">최근 가입 순</option><option value="reports">신고 많은 순</option><option value="name">아이디 순</option></select>
      <select class="inp" id="uFilter"><option value="">전체</option><option value="reported">신고 받은 사람</option><option value="banned">정지된 사람</option></select>
    </div>
    <section class="card"><div class="scroll" id="uList"><div class="skel"></div></div></section>`;
  $('#uSort').value = US.sort; $('#uFilter').value = US.filter;
  let t;
  $('#uQ').addEventListener('input', e => { US.q = e.target.value; clearTimeout(t); t = setTimeout(loadUsers, 250); });
  $('#uSort').onchange = e => { US.sort = e.target.value; loadUsers(); };
  $('#uFilter').onchange = e => { US.filter = e.target.value; loadUsers(); };
  await loadUsers();
};
async function loadUsers() {
  const p = new URLSearchParams({ q: US.q, sort: US.sort, filter: US.filter });
  const d = await call('users?' + p);
  if (cur !== 'users') return;
  $('#uCount').textContent = `${d.users.length}명${d.users.length >= 300 ? '+' : ''}`;
  $('#uList').innerHTML = d.users.length ? `<table class="tbl"><thead><tr><th>사용자</th><th>반</th><th>최근 접속</th><th>가입</th><th class="r" title="조치한 신고만 셉니다">신고(조치)</th></tr></thead><tbody>
    ${d.users.map(u => `<tr class="click" data-act="user" data-h="${esc(u.handle)}"><td>${who(u)}${u.banned ? '<span class="tag ban">정지</span>' : ''}</td><td>${cls(u) || '-'}</td><td>${when(u.seen)}</td><td>${when(u.created)}</td>
      <td class="r">${u.reps || u.openReps ? `${u.reps ? `<span class="tag rep">${u.reps}</span>` : ''}${u.openReps ? `<span class="sub"> 대기 ${u.openReps}</span>` : ''}` : '-'}</td></tr>`).join('')}
    </tbody></table>` : '<p class="empty">해당하는 사용자가 없어요</p>';
}

async function openUser(handle) {
  openModal('사용자 관리', '<div class="skel"></div><div class="skel"></div>');
  let d;
  try { d = await call('user/' + encodeURIComponent(handle)); } catch (e) { $('#mBody').innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }
  const u = d.user, s = d.stats, h = esc(u.handle);
  $('#mTitle').textContent = '@' + u.handle;
  $('#mBody').innerHTML = `
    <div class="prof">${av(u)}<div><b>${esc(u.name)}</b> ${u.online ? '<span class="tag on">접속 중</span>' : ''}
      <p class="sub">${cls(u) ? cls(u) + '반 · ' : ''}${u.club ? esc(u.club) + ' · ' : ''}가입 ${full(u.created)} · 최근 ${when(u.seen)}</p>
      ${u.mood ? `<p>💭 ${esc(u.mood)}</p>` : ''}${u.bio ? `<p class="sub">${esc(u.bio)}</p>` : ''}${u.insta ? `<p class="sub">📷 instagram.com/${esc(u.insta)}</p>` : ''}
      <p class="sp-t"><a class="btn sm" href="/#u/${encodeURIComponent(u.handle)}">사이트에서 프로필 보기 →</a></p></div></div>
    ${d.ban ? `<p class="banbox">⛔ 이용 정지 중 · ${d.ban.until ? full(d.ban.until) + '까지' : '무기한'}${d.ban.reason ? ' · ' + esc(d.ban.reason) : ''}</p>` : ''}
    <div class="kv">
      <div><b>${s.followers}</b><span>팔로워</span></div><div><b>${s.following}</b><span>팔로잉</span></div><div><b>${s.blockedBy}</b><span>차단당함</span></div>
      <div><b>${s.sent}</b><span>보낸 DM (전체)</span></div><div><b>${s.sentToday}</b><span>보낸 DM (오늘)</span></div><div><b>${s.sessions}</b><span>로그인된 기기</span></div>
    </div>
    <div class="mgrid">
    <div class="sec"><h4>🎮 게임 최고 기록</h4><div class="pills">${d.bests.length ? d.bests.map(b => `<span class="pill">${GAMES[b.game]?.em || ''} ${esc(GAMES[b.game]?.name || b.game)}<b>${esc(GAMES[b.game]?.fmt(b.best) ?? b.best)}</b> · ${b.days}일</span>`).join('') : '<span class="sub">기록 없음</span>'}</div></div>
    <div class="sec"><h4>🚨 받은 신고 · 조치 ${d.reportsAgainst.filter(r => r.done === 1).length}회</h4>${d.reportsAgainst.length ? d.reportsAgainst.map(r => `<p class="sub">${when(r.at)} · @${esc(r.rh || '탈퇴')} · ${esc(r.reason)} ${r.done === 1 ? '<span class="tag rep">조치</span>' : r.done === 2 ? '<span class="sub">· 문제 없음</span>' : '<span class="tag">대기</span>'}</p>`).join('') : '<p class="sub">없음</p>'}
      ${d.reportsBy.length ? `<h4>📝 이 사람이 한 신고 ${d.reportsBy.length}건</h4>${d.reportsBy.map(r => `<p class="sub">${when(r.at)} → @${esc(r.th || '탈퇴')} · ${esc(r.reason)}</p>`).join('')}` : ''}</div>
    <div class="sec"><h4>⛔ 이용 정지</h4>
      ${d.ban ? `<div class="row"><button class="btn sm ok" type="button" data-act="unban" data-h="${h}">정지 풀기</button></div>` : `
      <div class="row"><select class="inp" id="banDays"><option value="1">1일</option><option value="3">3일</option><option value="7" selected>7일</option><option value="30">30일</option><option value="0">무기한</option></select>
        <input class="inp" id="banWhy" maxlength="60" placeholder="사유 (본인 로그인 화면에 보여요)"><button class="btn sm bad" type="button" data-act="ban" data-h="${h}">정지</button></div>
      <p class="sub">정지하면 바로 로그아웃되고, 기간 동안 로그인할 수 없어요.</p>`}
    </div>
    <div class="sec"><h4>🧹 프로필 정리 (부적절한 글 지우기)</h4>
      <div class="chk"><label><input type="checkbox" value="name">닉네임 → 아이디로</label><label><input type="checkbox" value="mood">상태 메시지</label><label><input type="checkbox" value="bio">소개</label><label><input type="checkbox" value="club">동아리</label><label><input type="checkbox" value="insta">인스타 아이디</label><label><input type="checkbox" value="stickers">스티커</label></div>
      <div class="row"><button class="btn sm warn" type="button" data-act="clear" data-h="${h}">고른 항목 지우기</button></div></div>
    <div class="sec full"><h4>🔑 계정</h4>
      <div class="row"><button class="btn sm" type="button" data-act="kick" data-h="${h}">모든 기기 로그아웃</button><button class="btn sm warn" type="button" data-act="resetpw" data-h="${h}">임시 비밀번호 발급</button></div>
      <div id="pwBox"></div>
      <div class="row"><input class="inp" id="delConfirm" placeholder="삭제하려면 아이디 ${h} 입력" autocomplete="off"><button class="btn sm bad" type="button" data-act="deluser" data-h="${h}">계정 삭제</button></div>
      <p class="sub">계정 삭제는 되돌릴 수 없어요. DM·팔로우·게임 기록이 모두 지워져요.</p></div>
    </div>`;
}

/* ===== 게임 기록 ===== */
const SC = { game: 'home', day: kstYmd() };
// 보류된 기록의 판 기록 보기 (2026-10-26)
const heldRounds = (game, raw) => {
  let r = []; try { r = JSON.parse(raw || '[]'); } catch {}
  if (!Array.isArray(r) || !r.length) return '-';
  if (game === 'reaction') return r.map(x => x + 'ms').join(' · ');
  if (game === 'cut') return r.map(x => x + 'ms').join(' · ') + ` (합 ${r.reduce((a, b) => a + b, 0)})`;
  if (game === 'home') return `${(+r[0]).toLocaleString('ko-KR')}m · ${((+r[1] || 0) / 1000).toFixed(1)}초`;
  if (game === 'gear' || game === 'gearn') return `${(+r[0]).toLocaleString('ko-KR')}점 · ${r[1]}줄 · 블록 ${r[2]}개 · ${((+r[3] || 0) / 1000).toFixed(0)}초`;
  if (game === 'stair') return `${(+r[0]).toLocaleString('ko-KR')}칸 · ${((+r[1] || 0) / 1000).toFixed(1)}초 · 방향 ${r[2]}번`;
  if (game === 'num25') return `마지막 탭 ${((+r[24] || 0) / 1000).toFixed(2)}초 · 벌점 ${((+r[25] || 0) / 1000)}초`;
  return esc(raw).slice(0, 80);
};
const heldCard = h => `<section class="card sp-b"><div class="vh"><h3>⏸ 보류된 기록 <span class="sub">${h.open}건 대기</span></h3><span class="sub">검사에 걸려 랭킹에 안 올라간 기록이에요. '반영'하면 그 날 기록으로 들어가요(그 사람 기록보다 좋을 때만).</span></div>
  <div class="scroll">${h.list.length ? `<table class="tbl"><thead><tr><th>사용자</th><th>게임</th><th class="r">기록</th><th>판 기록</th><th>걸린 이유</th><th class="r">지금 최고</th><th>시각</th><th></th></tr></thead><tbody>
  ${h.list.map(x => { const g = GAMES[x.game] || { name: x.game, fmt: v => v }; return `<tr><td>${who(x)}</td><td>${g.em || ''} ${esc(g.name)}</td><td class="r num">${esc(g.fmt(x.value))}</td><td>${heldRounds(x.game, x.rounds)}</td><td>${esc(x.reason)}</td><td class="r num">${x.best != null ? esc(g.fmt(x.best)) : '-'}</td><td>${when(x.at)}</td>
    <td class="r"><button class="btn sm" type="button" data-act="heldok" data-id="${x.id}">반영</button> <button class="btn sm bad" type="button" data-act="heldno" data-id="${x.id}">버리기</button></td></tr>`; }).join('')}
  </tbody></table>` : '<p class="empty">확인을 기다리는 기록이 없어요</p>'}</div></section>`;

VIEWS.scores = async () => {
  const [d, held] = await Promise.all([call(`scores?game=${SC.game}&day=${SC.day}`), call('held').catch(() => ({ list: [], open: 0 }))]);
  const g = GAMES[d.game];
  const all = d.day === 'all', dayIso = all ? '' : `${d.day.slice(0, 4)}-${d.day.slice(4, 6)}-${d.day.slice(6)}`;
  $('#main').innerHTML = `
    <div class="vh"><h2>게임 기록</h2></div>
    <div class="bar">
      <div class="seg">${Object.entries(GAMES).map(([k, x]) => `<button type="button" data-game="${k}" class="${k === d.game ? 'on' : ''}">${x.em} ${x.name}</button>`).join('')}</div>
      <input class="inp" type="date" id="scDay" value="${dayIso}" max="${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}">
      <button class="btn sm${all ? ' on' : ''}" type="button" data-act="scall">전체 기간 랭킹</button>
      ${all ? '' : `<button class="btn sm bad" type="button" data-act="resetday" ${d.list.length ? '' : 'disabled'}>이 날 ${g.name} 랭킹 전부 지우기</button>`}
    </div>
    ${held.list.length ? heldCard(held) : ''}
    <p class="sub sp-b">이상하게 빠른 기록(핵·매크로 의심)은 지울 수 있어요. 지워도 그 사람은 다시 도전할 수 있어요. ${g.fmt(g.sus)} 이하는 <b class="sus">의심</b> 표시${d.list.some(x => x.best <= g.sus) ? ` — 이 날 ${d.list.filter(x => x.best <= g.sus).length}건` : ''}.</p>
    <section class="card"><div class="scroll">${d.list.length ? `<table class="tbl"><thead><tr><th>#</th><th>사용자</th><th>반</th><th class="r">기록</th><th>시각</th><th></th></tr></thead><tbody>
      ${d.list.map((x, i) => `<tr><td class="num">${i + 1}</td><td>${who(x)}</td><td>${cls(x) || '-'}</td><td class="r num">${x.best <= g.sus ? '<b class="sus">의심</b> ' : ''}${esc(g.fmt(x.best))}</td><td>${when(x.at)}</td>
        <td class="r">${all ? '' : `<button class="btn sm" type="button" data-act="delscore" data-h="${esc(x.handle)}">지우기</button> `}<button class="btn sm bad" type="button" data-act="delscoreall" data-h="${esc(x.handle)}">이 게임 기록 전부</button></td></tr>`).join('')}
      </tbody></table>` : `<p class="empty">${all ? '' : ymdLabel(d.day) + ' '}${g.name} 기록이 없어요</p>`}</div></section>`;
  $('#scDay').onchange = e => { if (e.target.value) { SC.day = e.target.value.replace(/-/g, ''); route(); } };
};

/* ===== 공지 ===== */
const TONES = { info: '📢 알림', warn: '⚠️ 주의', fun: '🎉 이벤트' };
VIEWS.notice = async () => {
  const [{ notice: n }, { list: hist = [] }] = await Promise.all([call('notice'), call('notices').catch(() => ({ list: [] }))]);
  const live = n && n.text && !(n.until && n.until < Date.now());
  $('#main').innerHTML = `
    <div class="vh"><h2>공지</h2></div>
    <section class="card"><h3>지금 사이트에 보이는 공지</h3>
      ${live ? `<div class="nprev ${esc(n.tone)}"><span>${TONES[n.tone]?.split(' ')[0] || '📢'}</span><span>${esc(n.text)}</span></div>${n.body ? `<p class="sub sp-t">자세한 내용 ${[...n.body].length}자 있음 (띠를 누르면 보여요)</p>` : ''}
        <p class="sub sp-t">${full(n.at)}에 올림 · ${n.until ? full(n.until) + '에 자동으로 내려감' : '직접 내릴 때까지 보임'}</p>
        <div class="row sp-t"><button class="btn sm bad" type="button" data-act="unnotice">공지 내리기</button></div>`
      : '<p class="sub">올라간 공지가 없어요.</p>'}
    </section>
    <section class="card"><h3>${live ? '새 공지로 바꾸기' : '공지 올리기'}</h3>
      <form id="nForm" class="grid">
        <label class="f">제목 <small>최대 120자 · 짧게 쓸수록 좋아요(공지 창에선 굵은 큰 글씨, 2줄까지) · 모든 화면 맨 위에 띠로 보여요. 학생이 닫으면 다음 공지 전까지 안 보여요.</small>
          <textarea class="inp" name="text" maxlength="120" required placeholder="예) 내일은 모의고사라 종 시간이 달라요!">${live ? esc(n.text) : ''}</textarea></label>
        <label class="f">내용 <small>선택 · 최대 2000자 · 공지 창에서 제목 아래 2줄만 먼저 보이고 '자세히 보기'로 펼쳐요 · 적으면 띠 공지를 눌렀을 때 이 글이 펼쳐져요 (누르면 이동과 같이 쓰면 이동이 우선)</small>
          <textarea class="inp" name="body" maxlength="2000" rows="10" placeholder="줄바꿈 그대로 보여요">${live ? esc(n.body || '') : ''}</textarea></label>
        <div class="grid g2">
          <label class="f">종류<select class="inp" name="tone">${Object.entries(TONES).map(([k, v]) => `<option value="${k}" ${live && n.tone === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="f">자동으로 내리기<select class="inp" name="hours"><option value="0">직접 내릴 때까지</option><option value="3">3시간 뒤</option><option value="12">12시간 뒤</option><option value="24" selected>하루 뒤</option><option value="72">3일 뒤</option><option value="168">일주일 뒤</option></select></label>
          <label class="f">누르면 이동 <small>선택</small><select class="inp" name="link"><option value="">이동 없음</option><option value="#meal">급식</option><option value="#tt">시간표</option><option value="#cal">학사일정</option><option value="#dday">D-day</option><option value="#game">미니게임</option><option value="#me">내 프로필</option><option value="#dm">DM</option></select></label>
        </div>
        <div><p class="sub">미리보기</p><div class="nprev" id="nPrev"><span>📢</span><span id="nPrevT">내용을 적어 보세요</span></div></div>
        <div class="row"><button class="btn pri" type="submit">올리기</button>${live ? '<button class="btn" type="button" id="nEdit">지금 공지 고치기 (날짜 그대로)</button>' : ''}</div>
      </form>
    </section>
    <section class="card"><h3>공지 기록</h3><p class="sub">학생 화면 📢 목록에 보이는 지난 공지예요. 지우면 목록에서도 사라져요.</p>
      ${hist.length ? `<ul class="nhist sp-t">${hist.map(h => `<li><span class="sub num">${full(h.at)}</span><span class="nh-t">${esc(h.text)}</span>${live && h.id === n.id ? '<span class="tag on">지금 공지</span>' : `<button class="btn sm bad" type="button" data-act="noticedel" data-id="${esc(h.id)}">삭제</button>`}</li>`).join('')}</ul>` : '<p class="sub">기록이 없어요.</p>'}
    </section>`;
  const f = $('#nForm');
  const prev = () => { $('#nPrev').className = 'nprev ' + f.tone.value; $('#nPrev').firstElementChild.textContent = TONES[f.tone.value].split(' ')[0]; $('#nPrevT').textContent = f.text.value || '내용을 적어 보세요'; };
  if (live && n.link) f.link.value = n.link;
  f.addEventListener('input', prev); prev();
  if ($('#nEdit')) $('#nEdit').onclick = async () => {
    try { await call('noticeedit', { text: f.text.value, body: f.body.value }); toast('공지를 고쳤어요 (사이트엔 30초 안에 보여요)'); route(); } catch (x) { fail(x); }
  };
  f.addEventListener('submit', async e => {
    e.preventDefault();
    try { await call('notice', { text: f.text.value, body: f.body.value, tone: f.tone.value, hours: +f.hours.value, link: f.link.value }); toast('공지를 올렸어요 (사이트엔 30초 안에 보여요)'); route(); } catch (x) { fail(x); }
  });
};

/* ===== 밸런스 게임 ===== */
const d0ymd = () => document.querySelector('.bal')?.dataset.ymd || '';
VIEWS.balance = async () => {
  const d = await call('balance');
  const t = d.today, tot = t.a + t.b;
  $('#main').innerHTML = `
    <div class="vh"><h2>밸런스 게임</h2></div>
    <section class="card"><h3>지금 투표 <small class="sub">${ymdLabel(t.ymd)}</small></h3>
      <p><b>${esc(d.days[0].q)}</b></p>
      <div class="vs"><div><span class="sub">A · ${esc(d.days[0].a)}</span><br><b>${t.a}</b>표 <span class="sub">${tot ? Math.round(t.a / tot * 100) + '%' : ''}</span></div><div><span class="sub">B · ${esc(d.days[0].b)}</span><br><b>${t.b}</b>표 <span class="sub">${tot ? Math.round(t.b / tot * 100) + '%' : ''}</span></div></div>
      ${tot ? `<div class="vbar" id="vbar"><i data-w="${t.a / tot}"></i><i data-w="${t.b / tot}"></i></div>` : ''}
    </section>
    <section class="card"><h3>앞으로 10번의 질문 <small class="sub">남은 기본 질문 ${d.left ?? '-'}개${d.left != null && d.left < 30 ? ' · <b>곧 떨어져요 — lib/balance.js에 추가</b>' : ''}</small></h3>
      <p class="sub sp-b">일~금 하루 한 문제(토요일 쉼) · 0시 공개 · 밤 11시 50분 마감. 기본 질문은 한 번 나오면 다시 안 나와요(아직 안 정해진 날은 예상). <b>지금 질문을 바꾸면 그날 표·댓글은 초기화돼요.</b></p>
      ${d.days.map((x, i) => `<div class="bal" data-ymd="${x.ymd}">
        <div class="d">${ymdLabel(x.ymd)}<small>${i === 0 ? '지금' : ''}</small></div>
        <div class="qq"><b>${esc(x.q)} ${x.custom ? '<span class="tag cus">직접 정함</span>' : ''}</b><span>${esc(x.a)} vs ${esc(x.b)}</span></div>
        <div class="row"><button class="btn sm" type="button" data-act="baledit">바꾸기</button>${x.custom ? '<button class="btn sm" type="button" data-act="baldel">기본으로</button>' : ''}</div>
      </div>`).join('')}
    </section>
    <section class="card"><h3>지금 질문 댓글 <span class="sub num">${d.comments.length}</span></h3>
      ${d.comments.length ? `<ul class="mlist">${d.comments.map(c => `<li data-cid="${c.id}"><span><b>${esc(c.name)}</b> <small class="sub">@${esc(c.handle)}</small><br>${esc(c.body)}</span><button class="btn sm" type="button" data-act="balcdel">삭제</button></li>`).join('')}</ul>` : '<p class="sub">아직 댓글이 없어요</p>'}
    </section>`;
  document.querySelectorAll('#vbar i').forEach(i => { i.style.width = (+i.dataset.w * 100) + '%'; });
};

/* ===== 설정 ===== */
VIEWS.settings = async () => {
  const s = await call('settings');
  const codeNow = s.joinCode != null ? s.joinCode : s.envJoinCode ? '(Cloudflare 비밀 변수 JOIN_CODE 사용 중)' : '';
  $('#main').innerHTML = `
    <div class="vh"><h2>설정</h2></div>
    <section class="card"><h3>🔐 가입 코드</h3>
      <p class="sub sp-b">코드를 정하면 그 코드를 아는 친구만 가입할 수 있어요. 비워 두면 주소만 알면 누구나 가입해요. 이미 가입한 사람에겐 영향 없어요.</p>
      <p class="sub">지금: <b>${codeNow ? esc(codeNow) : '코드 없음 (누구나 가입)'}</b></p>
      <div class="row sp-t"><input class="inp" id="code" maxlength="40" placeholder="새 가입 코드" value="${esc(s.joinCode || '')}" autocomplete="off">
        <button class="btn sm pri" type="button" data-act="setcode">저장</button><button class="btn sm" type="button" data-act="nocode">코드 없애기</button></div>
    </section>
    <section class="card"><h3>🚦 기능 켜고 끄기</h3>
      <div class="tog"><div><b>새 가입</b><p>끄면 새로 가입할 수 없어요 (기존 사용자는 그대로 사용)</p></div><input class="sw" type="checkbox" id="swSignup" ${s.signup ? 'checked' : ''} aria-label="새 가입"></div>
      <div class="tog"><div><b>DM 보내기</b><p>문제가 생겼을 때 잠깐 끌 수 있어요. 끄면 새 메시지를 못 보내요 (읽기는 가능)</p></div><input class="sw" type="checkbox" id="swDm" ${s.dm ? 'checked' : ''} aria-label="DM"></div>
    </section>
    <section class="card"><h3>🧯 비상</h3>
      <div class="tog"><div><b>모든 사용자 로그아웃</b><p>계정이 털린 것 같을 때 등. 모두 다시 로그인해야 해요</p></div><button class="btn sm bad" type="button" data-act="logoutall">전체 로그아웃</button></div>
    </section>
    <section class="card"><h3>🔑 Cloudflare에서 바꾸는 것</h3>
      <ul class="checks">
        <li><i class="dot ${s.neisKey ? 'on' : 'off'}"></i>나이스 인증키 <code>NEIS_KEY</code> ${s.neisKey ? '있음' : '없음'}</li>
        <li><i class="dot on"></i>관리자 계정 <code>developer</code> — 사이트에 로그인 + 비밀번호 재확인, 12시간 유지. 비밀번호는 사이트 계정 설정에서 바꿈</li>
      </ul>
    </section>`;
  $('#swSignup').onchange = e => saveSet({ signup: e.target.checked }, e.target);
  $('#swDm').onchange = e => saveSet({ dm: e.target.checked }, e.target);
};
async function saveSet(body, el) {
  try { await call('settings', body); toast('저장했어요'); } catch (x) { fail(x); if (el) el.checked = !el.checked; }
}

/* ===== 관리 기록 ===== */
VIEWS.log = async () => {
  const d = await call('log');
  $('#main').innerHTML = `<div class="vh"><h2>관리 기록</h2><span class="sub">최근 200개</span></div>
    <input class="inp logf" id="logQ" type="search" placeholder="찾기 (예: 정지, @아이디, 로그인 실패)">
    <section class="card">${d.log.length ? `<ul class="log" id="logList">${d.log.map(x => `<li><span class="t">${full(x.at)}</span><b>${esc(x.action)}</b><span>${esc(x.detail)}</span></li>`).join('')}</ul>` : '<p class="empty">기록이 없어요</p>'}</section>`;
  // 검색: 입력한 글자가 들어 있는 줄만 보이게 (화면 안에서만 거름)
  $('#logQ').oninput = e => { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll('#logList li').forEach(li => { li.hidden = !!q && !li.textContent.toLowerCase().includes(q); }); };
};

/* ===== 모달 ===== */
function openModal(title, html) { $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target === $('#modal') || e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

/* ===== 버튼 처리 (위임) ===== */
document.addEventListener('click', async e => {
  const cc = e.target.closest('[data-ccu]');
  if (cc) { ccuRange = cc.dataset.ccu; return VIEWS.monitor().catch(() => {}); }
  const fs = e.target.closest('[data-fs]');
  if (fs) { fbState = fs.dataset.fs; return route(); }
  const rs = e.target.closest('[data-rs]');
  if (rs) { repState = rs.dataset.rs; return route(); }
  const gm = e.target.closest('[data-game]');
  if (gm) { SC.game = gm.dataset.game; return route(); }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, h = el.dataset.h, id = +el.dataset.id;
  if (act === 'monrefresh') return VIEWS.monitor().catch(() => {});
  if (act === 'fbdone' || act === 'fbreopen') { const note = act === 'fbdone' ? (prompt('메모 (선택: 반영함·다음에 등)', '') ?? null) : ''; if (note === null) return; await call('feedback', { id, done: act === 'fbdone' ? 1 : 0, note }); refreshBadge(); return route(); }
  if (act === 'fbread' || act === 'fbunread') { await call('feedback', { id, read: act === 'fbread' ? 1 : 0 }); refreshBadge(); return route(); }
  if (act === 'fbreadall') { await call('feedback', { readAll: true }); refreshBadge(); return route(); }
  if (act === 'fbdel') { if (!confirm('이 의견을 지울까요?')) return; await call('feedback', { id, del: true }); refreshBadge(); return route(); }
  if (act === 'errclear') { if (!confirm('서버 오류 기록을 모두 지울까요?')) return; await call('errclear', {}); return VIEWS.monitor(); }
  const again = () => (h && !$('#modal').hidden ? openUser(h) : null);
  try {
    switch (act) {
      case 'user': return openUser(h);
      case 'ctx': return loadCtx(id);
      case 'delmsg':
        if (!confirm('이 메시지를 삭제할까요? 양쪽 모두에게 "삭제된 메시지"로 보여요.')) return;
        await call('delmsg', { id }); toast('메시지를 지웠어요');
        return loadCtx(+el.dataset.r);
      case 'done': case 'skip': case 'reopen': {
        const note = act === 'reopen' ? '' : prompt(act === 'done' ? '어떻게 처리했는지 메모 (선택)' : '넘기는 이유 메모 (선택)', '') ?? null;
        if (note === null) return;
        await call('report', { id, done: act === 'done' ? 1 : act === 'skip' ? 2 : 0, note });
        toast('저장했어요'); refreshBadge(); return route();
      }
      case 'ban': {
        const days = +$('#banDays').value, reason = $('#banWhy').value;
        if (!confirm(`@${h}를 ${days ? days + '일' : '무기한'} 정지할까요?`)) return;
        await call('ban', { handle: h, days, reason }); toast('정지했어요'); again(); return cur === 'users' ? loadUsers() : cur === 'reports' ? route() : null;
      }
      case 'unban': await call('unban', { handle: h }); toast('정지를 풀었어요'); again(); return cur === 'users' ? loadUsers() : null;
      case 'kick': { const r = await call('kick', { handle: h }); toast(`${r.n}개 기기에서 로그아웃시켰어요`); return again(); }
      case 'resetpw': {
        if (!confirm(`@${h}의 비밀번호를 임시 비밀번호로 바꿀까요? 지금 로그인된 기기는 모두 로그아웃돼요.`)) return;
        const r = await call('resetpw', { handle: h });
        $('#pwBox').innerHTML = `<p class="sub">이 화면을 닫으면 다시 볼 수 없어요. 본인에게 직접 전달하고, 로그인 후 바로 비밀번호를 바꾸라고 알려 주세요.</p><p class="secret">${esc(r.pw)}</p>`;
        return;
      }
      case 'clear': {
        const fields = [...document.querySelectorAll('#mBody .chk input:checked')].map(x => x.value);
        if (!fields.length) return toast('지울 항목을 골라 주세요');
        await call('clearprofile', { handle: h, fields }); toast('지웠어요'); return again();
      }
      case 'deluser': {
        const c = $('#delConfirm').value.trim();
        if (c.toLowerCase() !== h) return toast('확인용 아이디를 정확히 입력해 주세요');
        if (!confirm(`@${h} 계정을 완전히 삭제할까요? 되돌릴 수 없어요.`)) return;
        await call('deluser', { handle: h, confirm: c }); toast('계정을 삭제했어요'); closeModal(); return cur === 'users' ? loadUsers() : route();
      }
      case 'delscore':
        if (!confirm(`@${h}의 ${GAMES[SC.game].name} ${ymdLabel(SC.day)} 기록을 지울까요?`)) return;
        await call('delscore', { handle: h, game: SC.game, day: SC.day }); toast('기록을 지웠어요'); return route();
      case 'delscoreall':
        if (!confirm(`@${h}의 ${GAMES[SC.game].name} 기록을 모든 날짜에서 지울까요? (랭킹에서 빠져요)`)) return;
        await call('delscore', { handle: h, game: SC.game, day: 'all' }); toast('기록을 모두 지웠어요'); return route();
      case 'heldok': case 'heldno': {
        const ok = act === 'heldok';
        if (!confirm(ok ? '이 기록을 랭킹에 반영할까요?' : '이 기록을 버릴까요? (랭킹에 안 올라가요)')) return;
        await call('held', { id: +el.dataset.id, ok }); toast(ok ? '기록을 반영했어요' : '기록을 버렸어요'); return route();
      }
      case 'scall': SC.day = SC.day === 'all' ? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '') : 'all'; return route();
      case 'resetday':
        if (!confirm(`${ymdLabel(SC.day)} ${GAMES[SC.game].name} 랭킹을 전부 지울까요?`)) return;
        await call('resetday', { game: SC.game, day: SC.day }); toast('랭킹을 비웠어요'); return route();
      case 'noticedel':
        if (!confirm('이 공지 기록을 지울까요?')) return;
        await call('noticedel', { id: el.dataset.id }); toast('공지 기록을 지웠어요'); return route();
      case 'unnotice':
        if (!confirm('공지를 내릴까요?')) return;
        await call('notice', { text: '' }); toast('공지를 내렸어요'); return route();
      case 'baledit': {
        const row = el.closest('.bal');
        if (row.querySelector('form')) return;
        const q = row.querySelector('.qq b').firstChild.textContent.trim(), [a, b] = row.querySelector('.qq span').textContent.split(' vs ');
        row.insertAdjacentHTML('beforeend', `<form><input class="inp" name="q" maxlength="40" required value="${esc(q)}" placeholder="질문"><input class="inp" name="a" maxlength="20" required value="${esc(a)}" placeholder="선택지 A">
          <input class="inp" name="b" maxlength="20" required value="${esc(b)}" placeholder="선택지 B"><button class="btn sm pri" type="submit">저장</button><button class="btn sm" type="button" data-act="balcancel">취소</button></form>`);
        const f = row.querySelector('form');
        f.q.focus();
        f.addEventListener('submit', async ev => {
          ev.preventDefault();
          if (row.dataset.ymd === d0ymd() && !confirm('지금 질문을 바꾸면 들어온 표·댓글이 초기화돼요. 바꿀까요?')) return;
          try { await call('balance', { ymd: row.dataset.ymd, q: f.q.value, a: f.a.value, b: f.b.value }); toast('저장했어요'); route(); } catch (x) { fail(x); }
        });
        return;
      }
      case 'balcdel': {
        if (!confirm('이 댓글을 지울까요?')) return;
        await call('balancecdel', { id: +el.closest('[data-cid]').dataset.cid }); toast('지웠어요'); return route();
      }
      case 'balcancel': return el.closest('form').remove();
      case 'baldel': {
        const ymd = el.closest('.bal').dataset.ymd;
        if (ymd === d0ymd() && !confirm('지금 질문을 기본으로 되돌리면 표·댓글이 초기화돼요. 계속할까요?')) return;
        await call('balancedel', { ymd }); toast('기본 질문으로 돌렸어요'); return route();
      }
      case 'setcode': {
        const v = $('#code').value.trim();
        if (!v) return toast('코드를 적어 주세요 (없애려면 "코드 없애기")');
        return saveSet({ joinCode: v }).then(route);
      }
      case 'nocode':
        if (!confirm('가입 코드를 없앨까요? 주소만 알면 누구나 가입할 수 있게 돼요.')) return;
        return saveSet({ joinCode: '' }).then(route);
      case 'logoutall':
        if (!confirm('모든 사용자를 로그아웃시킬까요?')) return;
        return saveSet({ logoutAll: true });
    }
  } catch (x) { fail(x); }
});

$('#btnLogout').addEventListener('click', async () => { try { await call('logout', {}); } catch {} showGate(); });

showGate();
