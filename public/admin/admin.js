// SVMHS GROUND 관리자 화면. 서버는 functions/api/admin/[[path]].js
// CSP 때문에 인라인 스크립트·style 속성은 못 씀 → 이벤트는 위임, 막대 높이는 CSSOM으로 지정.

const $ = s => document.querySelector(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const GAMES = {
  // sus: 사람이 내기 어려운 기록(이 값 이하) → 게임 기록 화면에 '의심' 표시
  reaction: { name: '반응속도', em: '⚡', fmt: v => v + 'ms', sus: 130 },
  num25: { name: '1 to 25', em: '🔢', fmt: v => (v / 1000).toFixed(2) + '초', sus: 4000 },
  cut: { name: '컷 타이밍', em: '🎬', fmt: v => '오차 ' + v + 'ms', sus: 25 },
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

const av = u => `<span class="av">${esc(u?.avatar || '❔')}</span>`;
const who = (u, sub) => u ? `<span class="who">${av(u)}<span><b>${esc(u.name)}${u.online ? '<i class="on-dot" title="접속 중"></i>' : ''}</b><small>@${esc(u.handle)}${sub ? ' · ' + sub : ''}</small></span></span>` : '<span class="sub">(탈퇴한 사용자)</span>';
const cls = u => u.grade && u.cls ? `${u.grade}-${u.cls}` : '';

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
      <p class="sub">사이트에서 <b>@${esc(st.admin)}</b> 계정으로 로그인한 상태에서만 들어올 수 있어요.</p>
      <input type="text" name="username" value="${esc(st.admin)}" autocomplete="username" hidden>
      <label class="f">@${esc(st.admin)} 비밀번호<input class="inp" type="password" name="pw" autocomplete="current-password" required autofocus></label>
      <p class="err" id="loginErr"></p>
      <button class="btn pri" type="submit">들어가기</button>
    </form>`;
  $('#loginF').addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.target.querySelector('button'); b.disabled = true; $('#loginErr').textContent = '';
    try {
      const res = await fetch('/api/s/admin-pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pw: e.target.pw.value }) });
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
async function refreshBadge() {
  try {
    const d = await call('dash');
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
      ${tile(c.openFeedback, '확인 안 한 의견', c.openFeedback ? 'hot' : 'c4', '#feedback')}
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
    <div class="grid g2">
      <section class="card"><h3>📈 최근 2주</h3>
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
        <h3 class="sp">🏫 반별 가입자</h3>
        <div class="pills">${d.classes.length ? d.classes.map(x => `<span class="pill">${x.grade}-${x.cls}<b>${x.n}</b></span>`).join('') : '<span class="sub">학년·반을 적은 사람이 아직 없어요</span>'}</div>
      </section>
    </div>`;
  document.querySelectorAll('#chart i').forEach(i => { i.style.height = (+i.dataset.h * 100) + '%'; });
  $('#reDash').onclick = () => route();
};

/* ===== 신고 ===== */
let repState = 'open', fbState = 'open';
/* ===== 의견 (학생 → 개발자) ===== */
const FBK = { idea: '💡 기능 제안', bug: '🐞 오류', etc: '💬 기타' };
VIEWS.feedback = async () => {
  const d = await call('feedback' + (fbState === 'done' ? '?state=done' : ''));
  $('#main').innerHTML = `<div class="vh"><h2>의견</h2><span class="sub">확인 안 한 ${d.open}건 · 전체 ${d.total}건</span>
      <div class="seg"><button type="button" data-fs="open" class="${fbState === 'open' ? 'on' : ''}">새 의견</button><button type="button" data-fs="done" class="${fbState === 'done' ? 'on' : ''}">확인함</button></div></div>
    ${d.list.length ? d.list.map(x => `<section class="card fb"><div class="fbh"><span class="tag">${FBK[x.kind] || x.kind}</span>${x.user ? who(x.user, cls(x.user)) : '<span class="sub">(탈퇴한 사용자)</span>'}<span class="sub">${when(x.at)}</span></div>
        <p class="fbb">${esc(x.body)}</p>${x.note ? `<p class="sub">📝 ${esc(x.note)}</p>` : ''}
        <div class="row">${x.done ? `<button class="btn sm" type="button" data-act="fbreopen" data-id="${x.id}">되돌리기</button>` : `<button class="btn sm ok" type="button" data-act="fbdone" data-id="${x.id}">✅ 확인함</button>`}
          ${x.user ? `<button class="btn sm" type="button" data-act="user" data-h="${esc(x.user.handle)}">👤 보낸 사람</button>` : ''}
          <button class="btn sm bad" type="button" data-act="fbdel" data-id="${x.id}">삭제</button></div></section>`).join('') : `<p class="empty">${fbState === 'open' ? '새 의견이 없어요' : '확인한 의견이 없어요'}</p>`}`;
};
/* ===== 모니터링 (20초마다 자동 새로 고침, 이 화면에 있을 때만) ===== */
let monTimer = 0;
const FEED = {
  signup: (u, x) => `${who(u)} <span class="sub">가입</span>`,
  score: (u, x) => { const [g, v] = String(x).split(':'); return `${who(u)} <span class="sub">${GAMES[g]?.em || '🎮'} ${esc(GAMES[g]?.name || g)} ${esc(GAMES[g] ? GAMES[g].fmt(+v) : v)}${GAMES[g] && +v <= GAMES[g].sus ? ' <b class="sus">의심</b>' : ''}</span>`; },
  follow: (u, x) => `${who(u)} <span class="sub">→ @${esc(x || '?')} 팔로우</span>`,
  report: (u, x) => `${who(u)} <span class="sub">→ @${esc(x || '?')} 신고</span>`,
};
const SRC = { s: '소셜', admin: '관리자', api: '투표·공지', neis: '나이스' };
VIEWS.monitor = async () => {
  clearTimeout(monTimer);
  const d = await call('monitor');
  if (cur !== 'monitor') return;
  const tile = (n, label, k = '') => `<div class="stat ${k}"><b>${n}</b><span>${label}</span></div>`;
  const hmax = Math.max(1, ...d.hours.dm, ...d.hours.score, ...d.hours.signup);
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
    <div class="grid g2">
      <section class="card"><h3>🟢 지금 접속 중</h3>
        ${d.online.length ? `<ul class="mlist">${d.online.map(u => `<li><a href="#users/${encodeURIComponent(u.handle)}">${who(u, cls(u))}</a><span class="sub">${when(u.seen)}</span></li>`).join('')}</ul>` : '<p class="empty">지금은 아무도 없어요</p>'}
      </section>
      <section class="card"><h3>⏱ 오늘 시간대별</h3>
        <div class="chart" id="hchart">${d.hours.dm.map((_, h) => `<div class="col${h === nowH ? ' nowh' : ''}" title="${h}시 · 가입 ${d.hours.signup[h]} · 게임 기록 ${d.hours.score[h]} · DM ${d.hours.dm[h]}"><i class="k1" data-h="${d.hours.signup[h] / hmax}"></i><i class="k2" data-h="${d.hours.score[h] / hmax}"></i><i class="k3" data-h="${d.hours.dm[h] / hmax}"></i></div>`).join('')}</div>
        <div class="xlab">${d.hours.dm.map((_, h) => `<span>${h % 3 ? '' : h}</span>`).join('')}</div>
        <p class="legend"><span><i class="k1"></i>가입</span><span><i class="k2"></i>게임 기록</span><span><i class="k3"></i>DM 수 (내용은 안 봄)</span><span>가장 큰 값 ${hmax}</span></p>
      </section>
    </div>
    <div class="grid g2">
      <section class="card"><h3>📰 최근 활동</h3>
        ${d.feed.length ? `<ul class="mlist">${d.feed.map(x => `<li><span>${FEED[x.k](x.user, x.x)}</span><span class="sub">${when(x.at)}</span></li>`).join('')}</ul>` : '<p class="empty">활동이 없어요</p>'}
      </section>
      <div>
        <section class="card"><h3>🍱 오늘 투표</h3>
          ${d.votes.meal.length ? `<ul class="mlist">${d.votes.meal.slice(0, 12).map(v => `<li><span><b>${esc(v.dish)}</b> <span class="sub">${meals[v.meal] || v.meal}</span></span><b class="num">${v.n}표</b></li>`).join('')}</ul>` : '<p class="empty">급식 투표가 아직 없어요</p>'}
          <p class="sub sp">밸런스 게임: A ${d.votes.balance.a || 0}표 · B ${d.votes.balance.b || 0}표 <a href="#balance">자세히 →</a></p>
        </section>
        <section class="card"><h3>🗄 DB 줄 수</h3>
          <ul class="mlist">${Object.entries({ users: '사용자', sessions: '로그인 세션', follows: '팔로우', blocks: '차단', messages: 'DM', scores: '게임 기록', reports: '신고', bans: '정지', meal_votes: '급식 투표', balance_votes: '밸런스 투표', admin_log: '관리 기록', rl: '횟수 제한(임시)', errs: '오류 기록' }).map(([k, l]) => `<li><span>${l} <code>${k}</code></span><b class="num">${t[k] ?? '-'}</b></li>`).join('')}</ul>
          <p class="sub sp">나이스: ${d.neis.ok ? `정상 (${d.neis.ms}ms, ${esc(d.neis.code)})` : `문제 있음 — ${esc(d.neis.code)}`}</p>
        </section>
      </div>
    </div>
    <section class="card"><h3>🧯 서버 오류 <span class="sub">최근 60개 · 14일 보관</span>${d.errors.length ? '<button class="btn sm bad" type="button" data-act="errclear">기록 비우기</button>' : ''}</h3>
      ${d.errors.length ? `<ul class="log">${d.errors.map(x => `<li><span class="t">${full(x.at)}</span><b>${esc(SRC[x.src] || x.src)} <code>${esc(x.route)}</code></b><span>${esc(x.msg)}</span></li>`).join('')}</ul>` : '<p class="empty">오류가 없어요 👍</p>'}
    </section>`;
  document.querySelectorAll('#hchart i').forEach(i => { i.style.height = (+i.dataset.h * 100) + '%'; });
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
        <div class="rh">${who(r.target, r.target ? `누적 신고 ${r.target.total}회` : '')}${r.target?.banned ? '<span class="tag ban">정지 중</span>' : ''}
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
  $('#uList').innerHTML = d.users.length ? `<table class="tbl"><thead><tr><th>사용자</th><th>반</th><th>최근 접속</th><th>가입</th><th class="r">신고</th></tr></thead><tbody>
    ${d.users.map(u => `<tr class="click" data-act="user" data-h="${esc(u.handle)}"><td>${who(u)}${u.banned ? '<span class="tag ban">정지</span>' : ''}</td><td>${cls(u) || '-'}</td><td>${when(u.seen)}</td><td>${when(u.created)}</td>
      <td class="r">${u.reps ? `<span class="tag rep">${u.reps}${u.openReps ? ` (대기 ${u.openReps})` : ''}</span>` : '-'}</td></tr>`).join('')}
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
    <div class="sec"><h4>🎮 게임 최고 기록</h4><div class="pills">${d.bests.length ? d.bests.map(b => `<span class="pill">${GAMES[b.game]?.em || ''} ${esc(GAMES[b.game]?.name || b.game)}<b>${esc(GAMES[b.game]?.fmt(b.best) ?? b.best)}</b> · ${b.days}일</span>`).join('') : '<span class="sub">기록 없음</span>'}</div></div>
    <div class="sec"><h4>🚨 받은 신고 ${d.reportsAgainst.length}건</h4>${d.reportsAgainst.length ? d.reportsAgainst.map(r => `<p class="sub">${when(r.at)} · @${esc(r.rh || '탈퇴')} · ${esc(r.reason)} ${r.done ? '' : '<span class="tag rep">대기</span>'}</p>`).join('') : '<p class="sub">없음</p>'}
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
    <div class="sec"><h4>🔑 계정</h4>
      <div class="row"><button class="btn sm" type="button" data-act="kick" data-h="${h}">모든 기기 로그아웃</button><button class="btn sm warn" type="button" data-act="resetpw" data-h="${h}">임시 비밀번호 발급</button></div>
      <div id="pwBox"></div>
      <div class="row"><input class="inp" id="delConfirm" placeholder="삭제하려면 아이디 ${h} 입력" autocomplete="off"><button class="btn sm bad" type="button" data-act="deluser" data-h="${h}">계정 삭제</button></div>
      <p class="sub">계정 삭제는 되돌릴 수 없어요. DM·팔로우·게임 기록이 모두 지워져요.</p></div>`;
}

/* ===== 게임 기록 ===== */
const SC = { game: 'reaction', day: kstYmd() };
VIEWS.scores = async () => {
  const d = await call(`scores?game=${SC.game}&day=${SC.day}`);
  const g = GAMES[d.game];
  const dayIso = `${d.day.slice(0, 4)}-${d.day.slice(4, 6)}-${d.day.slice(6)}`;
  $('#main').innerHTML = `
    <div class="vh"><h2>게임 기록</h2></div>
    <div class="bar">
      <div class="seg">${Object.entries(GAMES).map(([k, x]) => `<button type="button" data-game="${k}" class="${k === d.game ? 'on' : ''}">${x.em} ${x.name}</button>`).join('')}</div>
      <input class="inp" type="date" id="scDay" value="${dayIso}" max="${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}">
      <button class="btn sm bad" type="button" data-act="resetday" ${d.list.length ? '' : 'disabled'}>이 날 ${g.name} 랭킹 전부 지우기</button>
    </div>
    <p class="sub sp-b">이상하게 빠른 기록(핵·매크로 의심)은 지울 수 있어요. 지워도 그 사람은 다시 도전할 수 있어요. ${g.fmt(g.sus)} 이하는 <b class="sus">의심</b> 표시${d.list.some(x => x.best <= g.sus) ? ` — 이 날 ${d.list.filter(x => x.best <= g.sus).length}건` : ''}.</p>
    <section class="card"><div class="scroll">${d.list.length ? `<table class="tbl"><thead><tr><th>#</th><th>사용자</th><th>반</th><th class="r">기록</th><th>시각</th><th></th></tr></thead><tbody>
      ${d.list.map((x, i) => `<tr><td class="num">${i + 1}</td><td>${who(x)}</td><td>${cls(x) || '-'}</td><td class="r num">${x.best <= g.sus ? '<b class="sus">의심</b> ' : ''}${esc(g.fmt(x.best))}</td><td>${when(x.at)}</td>
        <td class="r"><button class="btn sm" type="button" data-act="delscore" data-h="${esc(x.handle)}">지우기</button></td></tr>`).join('')}
      </tbody></table>` : `<p class="empty">${ymdLabel(d.day)} ${g.name} 기록이 없어요</p>`}</div></section>`;
  $('#scDay').onchange = e => { if (e.target.value) { SC.day = e.target.value.replace(/-/g, ''); route(); } };
};

/* ===== 공지 ===== */
const TONES = { info: '📢 알림', warn: '⚠️ 주의', fun: '🎉 이벤트' };
VIEWS.notice = async () => {
  const { notice: n } = await call('notice');
  const live = n && n.text && !(n.until && n.until < Date.now());
  $('#main').innerHTML = `
    <div class="vh"><h2>공지</h2></div>
    <section class="card"><h3>지금 사이트에 보이는 공지</h3>
      ${live ? `<div class="nprev ${esc(n.tone)}"><span>${TONES[n.tone]?.split(' ')[0] || '📢'}</span><span>${esc(n.text)}</span></div>
        <p class="sub sp-t">${full(n.at)}에 올림 · ${n.until ? full(n.until) + '에 자동으로 내려감' : '직접 내릴 때까지 보임'}</p>
        <div class="row sp-t"><button class="btn sm bad" type="button" data-act="unnotice">공지 내리기</button></div>`
      : '<p class="sub">올라간 공지가 없어요.</p>'}
    </section>
    <section class="card"><h3>${live ? '새 공지로 바꾸기' : '공지 올리기'}</h3>
      <form id="nForm" class="grid">
        <label class="f">내용 <small>최대 120자 · 모든 화면 맨 위에 띠로 보여요. 학생이 닫으면 다음 공지 전까지 안 보여요.</small>
          <textarea class="inp" name="text" maxlength="120" required placeholder="예) 내일은 모의고사라 종 시간이 달라요!">${live ? esc(n.text) : ''}</textarea></label>
        <div class="grid g2">
          <label class="f">종류<select class="inp" name="tone">${Object.entries(TONES).map(([k, v]) => `<option value="${k}" ${live && n.tone === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="f">자동으로 내리기<select class="inp" name="hours"><option value="0">직접 내릴 때까지</option><option value="3">3시간 뒤</option><option value="12">12시간 뒤</option><option value="24" selected>하루 뒤</option><option value="72">3일 뒤</option><option value="168">일주일 뒤</option></select></label>
          <label class="f">누르면 이동 <small>선택</small><select class="inp" name="link"><option value="">이동 없음</option><option value="#meal">급식</option><option value="#tt">시간표</option><option value="#cal">학사일정</option><option value="#dday">D-day</option><option value="#game">미니게임</option><option value="#me">내 프로필</option><option value="#dm">DM</option></select></label>
        </div>
        <div><p class="sub">미리보기</p><div class="nprev" id="nPrev"><span>📢</span><span id="nPrevT">내용을 적어 보세요</span></div></div>
        <div class="row"><button class="btn pri" type="submit">올리기</button></div>
      </form>
    </section>`;
  const f = $('#nForm');
  const prev = () => { $('#nPrev').className = 'nprev ' + f.tone.value; $('#nPrev').firstElementChild.textContent = TONES[f.tone.value].split(' ')[0]; $('#nPrevT').textContent = f.text.value || '내용을 적어 보세요'; };
  if (live && n.link) f.link.value = n.link;
  f.addEventListener('input', prev); prev();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    try { await call('notice', { text: f.text.value, tone: f.tone.value, hours: +f.hours.value, link: f.link.value }); toast('공지를 올렸어요 (사이트엔 30초 안에 보여요)'); route(); } catch (x) { fail(x); }
  });
};

/* ===== 밸런스 게임 ===== */
VIEWS.balance = async () => {
  const d = await call('balance');
  const t = d.today, tot = t.a + t.b;
  $('#main').innerHTML = `
    <div class="vh"><h2>밸런스 게임</h2></div>
    <section class="card"><h3>오늘 투표</h3>
      <p><b>${esc(d.days[0].q)}</b></p>
      <p class="sub">${esc(d.days[0].a)} <b class="num">${t.a}</b>표 ${tot ? `(${Math.round(t.a / tot * 100)}%)` : ''} vs ${esc(d.days[0].b)} <b class="num">${t.b}</b>표 ${tot ? `(${Math.round(t.b / tot * 100)}%)` : ''}</p>
    </section>
    <section class="card"><h3>앞으로 2주 질문</h3>
      <p class="sub sp-b">기본 질문은 목록에서 자동으로 돌아가요. 날짜를 골라 원하는 질문으로 바꿀 수 있어요. <b>오늘 질문을 바꾸면 오늘 표는 초기화돼요.</b></p>
      ${d.days.map((x, i) => `<div class="bal" data-ymd="${x.ymd}">
        <div class="d">${ymdLabel(x.ymd)}<small>${i === 0 ? '오늘' : i === 1 ? '내일' : ''}</small></div>
        <div class="qq"><b>${esc(x.q)} ${x.custom ? '<span class="tag cus">직접 정함</span>' : ''}</b><span>${esc(x.a)} vs ${esc(x.b)}</span></div>
        <div class="row"><button class="btn sm" type="button" data-act="baledit">바꾸기</button>${x.custom ? '<button class="btn sm" type="button" data-act="baldel">기본으로</button>' : ''}</div>
      </div>`).join('')}
    </section>`;
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
        <li><i class="dot on"></i>관리자 계정 <code>@hayuldeveloper</code> — 사이트에 로그인 + 비밀번호 재확인, 12시간 유지. 비밀번호는 사이트 계정 설정에서 바꿈</li>
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
      case 'resetday':
        if (!confirm(`${ymdLabel(SC.day)} ${GAMES[SC.game].name} 랭킹을 전부 지울까요?`)) return;
        await call('resetday', { game: SC.game, day: SC.day }); toast('랭킹을 비웠어요'); return route();
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
          if (row.dataset.ymd === kstYmd() && !confirm('오늘 질문을 바꾸면 오늘 들어온 표가 초기화돼요. 바꿀까요?')) return;
          try { await call('balance', { ymd: row.dataset.ymd, q: f.q.value, a: f.a.value, b: f.b.value }); toast('저장했어요'); route(); } catch (x) { fail(x); }
        });
        return;
      }
      case 'balcancel': return el.closest('form').remove();
      case 'baldel': {
        const ymd = el.closest('.bal').dataset.ymd;
        if (ymd === kstYmd() && !confirm('오늘 질문을 기본으로 되돌리면 오늘 표가 초기화돼요. 계속할까요?')) return;
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
