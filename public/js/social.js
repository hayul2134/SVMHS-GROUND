// SVMHS GROUND — 소셜: 계정 · 프로필 꾸미기 · 팔로우 · DM · 미니게임 랭킹 (서버: functions/api/s/[[path]].js)
import { $, $$, esc, toast, store } from './util.js';

/* ===== 서버와 같게 유지하는 목록 ===== */
const AVATARS = ['😎','🐶','🐱','🐰','🦊','🐻','🐼','🐸','🐥','🐧','🦄','🐯','🐨','🐹','👽','🤖','👻','🎃','🌝','🍀','🔥','⚡','🌈','🎬','🎥','🎧','🎮','🏀','⚽','🎸','🍓','🍩','🧋','🍕','💜','⭐'];
const COLORS = ['sky','blue','mint','lime','yellow','peach','pink','violet','ink'];
const STICKERS = ['⭐','✨','💖','💙','🔥','🎬','🎥','📸','🎧','🎮','🍀','🌈','☁️','🌙','🍓','🧋','🐾','👑','💯','🎀','🫧','🪐','🦋','🌷','🍒','🎵','⚡','🌊'];
const MAX_STICKERS = 6;
const ADMIN_HANDLE = 'hayuldeveloper';   // 서버 lib/db.js와 같게 (버튼 표시용, 실제 권한은 서버가 검사)
const GAMES = {
  reaction: { name: '반응속도', em: '⚡', desc: '초록색으로 바뀌는 순간 탭! 5번 평균', fmt: v => v + 'ms' },
  num25: { name: '1 to 25', em: '🔢', desc: '1부터 25까지 순서대로 빠르게 누르기', fmt: v => (v / 1000).toFixed(2) + '초' },
  cut: { name: '컷 타이밍', em: '🎬', desc: '플레이헤드가 컷 지점에 오면 CUT! 5번 오차 합', fmt: v => '오차 ' + v + 'ms' },
};

/* ===== 상태 ===== */
const S = { enabled: null, needCode: false, me: null, counts: null, unread: 0 };
let ctx;   // app.js에서 받은 go · openModal · closeModal · getClass
let dmTimer = 0, dmDelay = 3000, pollTimer = 0, openThread = '', threadIn = '';   // threadIn: 'page'(#dm 화면) | 'panel'(떠 있는 메시지 창)

/* ===== 서버 호출 ===== */
async function call(path, body) {
  const opt = body === undefined ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
  let r, j = {};
  try { r = await fetch('/api/s/' + path, opt); } catch { throw new Error('인터넷 연결을 확인해 주세요'); }
  try { j = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401 && S.me) { S.me = null; paintBadges(); }
    const e = new Error(j.error || '잠시 후 다시 시도해 주세요'); e.status = r.status; throw e;
  }
  return j;
}
const fail = e => toast(e.message || '문제가 생겼어요');

/* ===== 작은 조각들 ===== */
// 개발자 계정은 이모지 대신 사이트 로고 + 무지개 링 아바타 (어디서나 같게)
const av = (u, cls = '') => u?.handle === ADMIN_HANDLE ? `<span class="av avdev ${cls}"><img src="/logo-mark.svg?v=4" alt="">${u.online ? '<i class="dot" title="접속 중"></i>' : ''}</span>` : `<span class="av c-${esc(COLORS.includes(u.color) ? u.color : 'sky')} ${cls}">${esc(u.avatar || '😎')}${u.online ? '<i class="dot" title="접속 중"></i>' : ''}</span>`;
const isDev = u => u?.handle === ADMIN_HANDLE;
const devTag = u => isDev(u) ? '<span class="devb" title="SVMHS GROUND 개발자">🛠 개발자</span>' : '';   // 이름 옆 작은 배지
// 개발자 계정은 닉네임·아이디 대신 '개발자' · '@developer'로 표시 (링크는 실제 아이디 그대로)
const nameOf = u => isDev(u) ? '개발자' : u.name;
const handleOf = u => isDev(u) ? 'developer' : u.handle;
const classTxt = u => isDev(u) ? '' : u.grade && u.cls ? `${u.grade}학년 ${u.cls}반` : '';
const ago = t => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전'; if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`;
};
const hm = t => { const d = new Date(t), h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; };
const personRow = (u, right = '') => `<li class="person"><a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}">${av(u)}<span class="pi"><b>${esc(nameOf(u))}${devTag(u)}</b><small>@${esc(handleOf(u))}${u.mood ? ' · ' + esc(u.mood) : ''}</small></span></a>${right}</li>`;
const followBtn = u => u.isMe ? '' : `<button class="fbtn ${u.following ? 'on' : ''}" data-follow="${esc(u.handle)}" data-on="${u.following ? 0 : 1}">${u.following ? '팔로잉' : '팔로우'}</button>`;
const needLogin = (msg) => `<div class="card soc-gate"><p class="gate-em">🔐</p><p><b>${msg}</b></p><p class="muted small">아이디만 있으면 1분이면 가입해요</p><button class="btn" data-go="me">로그인 / 가입하기</button></div>`;
const offCard = () => `<div class="card soc-gate"><p class="gate-em">🛠️</p><p><b>소셜 기능을 준비하고 있어요</b></p><p class="muted small">곧 열려요! 조금만 기다려 주세요</p></div>`;

function sheet(html) { $('#socSheet').innerHTML = html; ctx.openModal('#mSoc'); }
const closeSheet = () => ctx.closeModal($('#mSoc'));

/* ===== 헤더 배지 · 주기적 확인 ===== */
function paintBadges() {
  const n = S.me ? S.unread : 0;
  $$('[data-badge="dm"]').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
  const dev = S.me?.handle === ADMIN_HANDLE;
  $('#btnOut').hidden = !S.me;   // 로그인돼 있을 때만 메뉴 맨 아래 빨간 로그아웃
  $('#btnAdmin').hidden = !dev;   // 관리자 계정일 때만 메뉴에 표시 (권한은 서버가 검사)
  ['#btnClass', '#btnShare', '#btnReport'].forEach(id => { $(id).hidden = dev; });   // 개발자 계정엔 설정·QR·신고 필요 없음
  $('#btnMe .mi').innerHTML = S.me ? av({ ...S.me, online: false }, 'tiny') : '<svg viewBox="0 0 24 24"><use href="#i-user"/></svg>';
}
async function refreshMe() {
  try {
    const r = await call('me');
    S.me = r.me; S.unread = r.unread || 0; S.counts = r.counts || null; S.meErr = false;
  } catch (e) { S.me = null; S.meErr = !e.status || e.status >= 500; }   // meErr: 연결·서버 문제(로그아웃 상태라고 단정 못 함)
  paintBadges();
  if (!panelOpen()) loadRecent();
}
function startPoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.hidden || !S.me || openThread) return;
    try { const r = await call('poll'); const more = r.unread > S.unread; S.unread = r.unread; paintBadges();
    if (more) { if (panelOpen()) renderDm('', $('#dmPBox'), true); else { if (!location.hash.startsWith('#dm')) toast('💬 새 메시지가 왔어요'); loadRecent(); } } } catch {}
  }, 25000);
}

/* ===== 로그인 · 가입 ===== */
function authHtml(mode = 'login') {
  const c = ctx.getClass?.() || null;
  const grades = [1, 2, 3].map(g => `<option value="${g}" ${c && +c.g === g ? 'selected' : ''}>${g}학년</option>`).join('');
  const classes = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${c && +c.c === i + 1 ? 'selected' : ''}>${i + 1}반</option>`).join('');
  return `<div class="card authcard">
    <div class="segs" role="tablist"><button data-auth="login" class="${mode === 'login' ? 'on' : ''}">로그인</button><button data-auth="signup" class="${mode === 'signup' ? 'on' : ''}">회원가입</button></div>
    <form class="sform" id="authForm" data-mode="${mode}" autocomplete="on">
      <label>아이디<input name="handle" required minlength="3" maxlength="16" pattern="[a-zA-Z0-9_.]{3,16}" autocapitalize="off" autocomplete="username" placeholder="영어 소문자·숫자 3~16자">${mode === 'signup' ? '<small class="hint">🔑 로그인할 때 쓰는 이름이에요. 나중에 바꿀 수 없어요.</small>' : ''}</label>
      ${mode === 'signup' ? `<label>이름 (닉네임)<input name="name" required maxlength="12" placeholder="친구들에게 보일 이름"><small class="hint">👀 친구들 화면에 보이는 이름이에요. 언제든 바꿀 수 있어요.</small></label>` : ''}
      <label>비밀번호<input name="pw" type="password" required minlength="6" maxlength="64" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="6자 이상"></label>
      ${mode === 'signup' ? `
        <div class="two"><label>학년<select name="grade">${grades}</select></label><label>반<select name="cls">${classes}</select></label></div>
        ${S.needCode ? '<label>가입 코드<input name="code" required maxlength="40" placeholder="친구에게 받은 코드"></label>' : ''}
        <p class="note">⚠️ 이메일이 없어서 비밀번호를 잊으면 찾을 수 없어요. 다른 사이트와 다른 비밀번호를 써 주세요.</p>` : ''}
      <p class="ferr" role="alert" hidden></p>
      <button class="btn big" type="submit">${mode === 'signup' ? '가입하고 시작하기' : '로그인'}</button>
    </form>
  </div>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-auth]'); if (!t) return;
  (t.closest('#introAuth') || $('#meBox')).innerHTML = authHtml(t.dataset.auth);   // 소개 화면 안의 폼이면 그 자리에서 바꿈
});
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id !== 'authForm') return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f)), mode = f.dataset.mode;
  d.handle = (d.handle || '').trim().toLowerCase();
  const btn = f.querySelector('[type=submit]'); btn.disabled = true;
  try {
    await call(mode, d);
    await refreshMe();
    toast(mode === 'signup' ? `환영해요, ${S.me.name}! 🎉 프로필을 꾸며 보세요` : `${S.me.name}, 반가워요!`);
    ctx.authed?.(S.me, true, mode);   // 소개 화면이면 닫힘
    renderMe();
    if (mode === 'signup') setTimeout(openEdit, 500);
  } catch (err) { authErr(f, err, mode); btn.disabled = false; }
});
// 로그인·가입 실패: 토스트 대신 폼 안에 빨간 경고 + 틀린 칸 빨간 테두리 (다시 입력하면 사라짐)
function authErr(f, err, mode) {
  const msg = err.message || '문제가 생겼어요', box = f.querySelector('.ferr');
  const hit = mode === 'login' && err.status === 401 ? ['handle', 'pw']
    : /아이디/.test(msg) ? ['handle'] : /비밀번호/.test(msg) ? ['pw'] : /코드/.test(msg) ? ['code'] : [];
  f.querySelectorAll('.bad').forEach(x => x.classList.remove('bad'));
  hit.forEach(n => f.elements[n]?.classList.add('bad'));
  box.textContent = '⚠️ ' + msg; box.hidden = false;
  f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  const pw = f.elements.pw;
  if (hit.includes('pw') && pw) { pw.value = ''; pw.focus(); } else f.elements[hit[0]]?.focus();
}
document.addEventListener('input', e => {
  const f = e.target.closest?.('#authForm'); if (!f) return;
  e.target.classList.remove('bad');
  if (!f.querySelector('.bad')) f.querySelector('.ferr').hidden = true;
});

/* ===== 프로필 카드 ===== */
const STK_POS = ['s1', 's2', 's3', 's4', 's5', 's6'];
function profileHtml(d) {
  const u = d.user, self = d.me;
  const chips = (isDev(u) ? '<span class="chip dev">🛠 SVMHS GROUND 개발자</span>' : '') + [classTxt(u), u.club && '🎬 ' + u.club].filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('');
  const crowns = (d.crowns || []).map(g => `<span class="crown">👑 ${esc(GAMES[g]?.name || g)} 1등</span>`).join('');
  const r = d.rel || {};
  const mutual = r.following && r.followsMe;
  const actions = self
    ? isDev(u) ? `<a class="btn" href="/admin/#monitor">🛠 관리자 페이지</a><button class="btn ghost" data-act-s="logout">로그아웃</button>`   // 개발자: 꾸미기·계정 설정 없음
      : `<button class="btn" data-act-s="edit">✏️ 프로필 꾸미기</button><button class="btn ghost" data-act-s="settings" aria-label="계정 설정">⚙️</button>`
    : r.blocked ? `<button class="btn ghost" data-block="${esc(u.handle)}" data-on="0">차단 풀기</button>`
    : `<button class="btn ${r.following ? 'ghost' : ''}" data-follow="${esc(u.handle)}" data-on="${r.following ? 0 : 1}">${r.following ? '팔로잉 ✓' : r.followsMe ? '맞팔로우 하기' : '팔로우'}</button>
       <button class="btn ${mutual ? 'lime' : 'ghost'}" data-dm="${esc(u.handle)}" ${mutual ? '' : 'data-locked="1"'}>💬 DM</button>
       <button class="btn ghost" data-act-s="more" data-h="${esc(u.handle)}" aria-label="더보기">⋯</button>`;
  const bests = Object.entries(GAMES).map(([k, g]) => `<li><span>${g.em}</span><small>${g.name}</small><b>${d.bests?.[k] != null ? esc(g.fmt(d.bests[k])) : '-'}</b></li>`).join('');
  return `<article class="pcard c-${esc(u.color)}${isDev(u) ? ' dev' : ''}">
    <div class="pban" aria-hidden="true">${(u.stickers || []).slice(0, MAX_STICKERS).map((s, i) => `<i class="stk ${STK_POS[i]}">${esc(s)}</i>`).join('')}</div>
    <div class="pbody">
      ${av(u, 'big')}
      ${u.mood ? `<p class="pmood"><span>${esc(u.mood)}</span></p>` : ''}
      <h2 class="pname">${esc(nameOf(u))}</h2>
      <p class="phandle">@${esc(handleOf(u))}${u.online && !self ? ' · <b class="onl">접속 중</b>' : ''}${!self && r.followsMe ? ' · <span class="fm">나를 팔로우함</span>' : ''}</p>
      ${isDev(u) ? '<button class="pdev" type="button" data-fb>💡 궁금한 점·원하는 기능은 헤더의 💡 의견으로 보내 주세요!</button>' : ''}
      ${chips ? `<p class="pchips">${chips}</p>` : ''}
      ${crowns ? `<p class="pcrowns">${crowns}</p>` : ''}
      ${u.insta ? `<a class="pinsta" href="https://www.instagram.com/${encodeURIComponent(u.insta)}/" target="_blank" rel="noopener noreferrer" aria-label="인스타그램 @${esc(u.insta)} 열기 (새 창)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/></svg>@${esc(u.insta)}<span aria-hidden="true">↗</span></a>` : ''}
      ${isDev(u) ? '' : u.bio ? `<p class="pbio">${esc(u.bio)}</p>` : self ? '<p class="pbio muted">아직 소개가 없어요. 프로필 꾸미기에서 적어 보세요!</p>' : ''}
      ${isDev(u) ? '' : `<div class="pstats"><button data-people="followers" data-h="${esc(u.handle)}"><b>${d.counts.followers}</b>팔로워</button><button data-people="following" data-h="${esc(u.handle)}"><b>${d.counts.following}</b>팔로잉</button></div>
      `}<div class="pact">${actions}</div>
      ${isDev(u) ? '' : `<ul class="pbest" aria-label="게임 최고 기록">${bests}</ul>`}
    </div>
  </article>`;
}

/* ===== 내 프로필 화면 (#me) ===== */
async function renderMe() {
  const box = $('#meBox');
  if (S.enabled === false) { box.innerHTML = offCard(); return; }
  if (!S.me) { box.innerHTML = authHtml('login'); return; }
  box.innerHTML = '<div class="card"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
  try {
    const d = await call('user/' + encodeURIComponent(S.me.handle));
    box.innerHTML = profileHtml(d) + `
      <section class="card findcard">
        <div class="ct"><h2>👋 친구 찾기</h2></div>
        <form class="form" id="findForm" autocomplete="off" role="search"><input id="findQ" placeholder="아이디나 이름으로 검색" maxlength="16" aria-label="친구 검색"><button class="btn">검색</button></form>
        <p class="note" id="findNote">최근에 들어온 친구들</p>
        <ul class="plist" id="findList"><li class="skel"></li></ul>
      </section>`;
    findPeople('');
  } catch (e) { box.innerHTML = `<div class="card"><p class="empty">${esc(e.message)}</p></div>`; }
}
async function findPeople(q) {
  const list = $('#findList'); if (!list) return;
  try {
    const r = await call('search?q=' + encodeURIComponent(q));
    $('#findNote').textContent = q ? `'${q}' 검색 결과` : '최근에 들어온 친구들';
    list.innerHTML = r.users.length ? r.users.map(u => personRow(u, followBtn(u))).join('') : '<li class="empty">아무도 없어요. 친구에게 사이트를 공유해 보세요!</li>';
  } catch (e) { list.innerHTML = `<li class="empty">${esc(e.message)}</li>`; }
}
document.addEventListener('submit', e => { if (e.target.id === 'findForm') { e.preventDefault(); findPeople($('#findQ').value.trim()); } });

/* ===== 남의 프로필 (#u/아이디) ===== */
async function renderUser(handle) {
  const box = $('#uBox');
  if (S.enabled === false) { box.innerHTML = offCard(); return; }
  if (!S.me) { box.innerHTML = needLogin('친구 프로필을 보려면 로그인해 주세요'); return; }
  if (!handle || handle === S.me.handle) { ctx.go('me'); return; }
  box.innerHTML = '<div class="card"><div class="skel"></div><div class="skel"></div></div>';
  try { box.innerHTML = profileHtml(await call('user/' + encodeURIComponent(handle))); }
  catch (e) { box.innerHTML = `<div class="card soc-gate"><p class="gate-em">🤔</p><p><b>${esc(e.message)}</b></p><button class="btn ghost" data-go="me">돌아가기</button></div>`; }
}
const rerender = () => { const h = location.hash.slice(1); if (h.startsWith('u/')) renderUser(decodeURIComponent(h.slice(2))); else if (h === 'me') renderMe(); };

/* ===== 팔로우 · 차단 · 신고 · 목록 ===== */
document.addEventListener('click', async e => {
  const f = e.target.closest('[data-follow]');
  if (f) {
    f.disabled = true;
    try {
      const on = f.dataset.on === '1';
      const r = await call('follow', { handle: f.dataset.follow, on });
      if (f.classList.contains('fbtn')) { f.classList.toggle('on', on); f.dataset.on = on ? 0 : 1; f.textContent = on ? '팔로잉' : '팔로우'; f.disabled = false; }
      else rerender();
      if (on && r.rel.followsMe) toast('🤝 맞팔 완료! 이제 DM할 수 있어요');
      refreshMe();
    } catch (err) { fail(err); f.disabled = false; }
    return;
  }
  const b = e.target.closest('[data-block]');
  if (b) {
    const on = b.dataset.on === '1';
    if (on && !confirm(`@${b.dataset.block} 님을 차단할까요?\n서로 팔로우가 끊기고, DM을 주고받을 수 없어요.`)) return;
    try { await call('block', { handle: b.dataset.block, on }); toast(on ? '차단했어요' : '차단을 풀었어요'); closeSheet(); rerender(); } catch (err) { fail(err); }
    return;
  }
  const rp = e.target.closest('[data-report]');
  if (rp) {
    const reason = prompt('신고 이유를 적어 주세요 (예: 욕설, 괴롭힘)');
    if (reason == null) return;
    try { await call('report', { handle: rp.dataset.report, msg: rp.dataset.msg ? +rp.dataset.msg : undefined, reason }); toast('신고했어요. 고마워요'); closeSheet(); } catch (err) { fail(err); }
    return;
  }
  const p = e.target.closest('[data-people]');
  if (p) {
    const kind = p.dataset.people, title = { followers: '팔로워', following: '팔로잉', friends: '친구' }[kind];
    sheet(`<h3>${title}</h3><ul class="plist" id="pplList"><li class="skel"></li></ul><div class="row"><button class="btn ghost" data-close>닫기</button></div>`);
    try {
      const r = await call(`people?kind=${kind}&who=${encodeURIComponent(p.dataset.h)}`);
      $('#pplList').innerHTML = r.users.length ? r.users.map(u => personRow(u, followBtn(u))).join('') : '<li class="empty">아직 없어요</li>';
    } catch (err) { $('#pplList').innerHTML = `<li class="empty">${esc(err.message)}</li>`; }
    return;
  }
  if (e.target.closest('#socSheet [data-u]')) closeSheet();
  const dm = e.target.closest('[data-dm]');
  if (dm) {
    if (dm.dataset.locked) { toast('서로 팔로우하면 DM할 수 있어요'); return; }
    openPanel(dm.dataset.dm); return;
  }
  const a = e.target.closest('[data-act-s]');
  if (a) ({ edit: openEdit, settings: openSettings, more: () => openMore(a.dataset.h), logout: doLogout })[a.dataset.actS]?.();
});
/* 상단 메뉴 '신고': 아이디와 이유를 적어서 보냄 (로그인 필요) */
function openReport() {
  if (!S.enabled) { toast('아직 준비 중이에요'); return; }
  if (!S.me) { toast('로그인하면 신고할 수 있어요'); ctx.go('me'); return; }
  sheet(`<h3>🚨 신고하기</h3><p class="note">불편한 사람의 아이디와 이유를 적어 주세요. 관리자가 확인해요.</p>
    <form class="sform" id="rpForm" autocomplete="off">
      <label>아이디<input name="handle" required maxlength="16" pattern="[a-zA-Z0-9_.]{3,16}" autocapitalize="off" placeholder="신고할 사람의 아이디"></label>
      <label>이유<input name="reason" required maxlength="200" placeholder="예: 욕설, 괴롭힘"></label>
      <div class="row"><button class="btn ghost" type="button" data-close>닫기</button><button class="btn">신고 보내기</button></div>
    </form>`);
  $('#rpForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), handle = String(f.get('handle')).trim().replace(/^@/, '');
    try { await call('report', { handle, reason: String(f.get('reason')).trim() }); toast('신고했어요. 고마워요'); closeSheet(); } catch (err) { fail(err); }
  };
}
function openMore(h) {
  sheet(`<h3>@${esc(h)}</h3><div class="col">
    <button class="btn ghost" data-report="${esc(h)}">🚨 신고하기</button>
    <button class="btn ghost danger" data-block="${esc(h)}" data-on="1">🚫 차단하기</button>
    <button class="btn ghost" data-close>닫기</button></div>`);
}

/* ===== 프로필 꾸미기 ===== */
function openEdit() {
  const u = S.me; if (!u) return;
  const picked = new Set(u.stickers || []);
  sheet(`<h3>프로필 꾸미기</h3>
    <form class="sform" id="editForm" autocomplete="off">
      <div class="preview c-${esc(u.color)}" id="edPrev">${av({ ...u, online: false }, 'big')}</div>
      <label>이름 (닉네임)<input name="name" maxlength="12" required value="${esc(u.name)}"><small class="hint">친구들에게 보이는 이름이에요. 로그인은 아이디 @${esc(u.handle)}로 해요.</small></label>
      <label>상태 메시지<input name="mood" maxlength="24" placeholder="예: 시험 끝나면 놀자🔥" value="${esc(u.mood)}"></label>
      <label>소개<textarea name="bio" maxlength="80" rows="3" placeholder="나를 한 줄로 소개해 보세요">${esc(u.bio)}</textarea></label>
      ${isDev(u) ? '<input type="hidden" name="grade" value="0"><input type="hidden" name="cls" value="0"><p class="hint">🛠 개발자 계정은 학년·반이 표시되지 않아요.</p>' : `<div class="two"><label>학년<select name="grade"><option value="0">비공개</option>${[1, 2, 3].map(g => `<option value="${g}" ${u.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label>
        <label>반<select name="cls"><option value="0">비공개</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${u.cls === i + 1 ? 'selected' : ''}>${i + 1}반</option>`).join('')}</select></label></div>`}
      <label>인스타 아이디 (선택)<input name="insta" maxlength="60" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="예: svmhs_ground (@ 없이)" value="${esc(u.insta || '')}"><small class="hint">적으면 프로필에 버튼이 생기고, 누르면 내 인스타로 가요. 비워 두면 안 보여요.</small></label>
      <label>동아리<input name="club" maxlength="16" placeholder="예: 영상제작부" value="${esc(u.club)}"></label>
      <p class="lbl">프로필 사진</p>
      <div class="pick" id="pAv">${AVATARS.map(a => `<button type="button" data-v="${a}" class="${a === u.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
      <p class="lbl">배경 색</p>
      <div class="pick sw" id="pCo">${COLORS.map(c => `<button type="button" data-v="${c}" class="c-${c} ${c === u.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>
      <p class="lbl">스티커 <small id="stkN">${picked.size}/${MAX_STICKERS}</small></p>
      <div class="pick" id="pSt">${STICKERS.map(s => `<button type="button" data-v="${s}" class="${picked.has(s) ? 'on' : ''}">${s}</button>`).join('')}</div>
      <div class="row"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" data-close>취소</button></div>
    </form>`);
  const sel = { avatar: u.avatar, color: u.color };
  const prev = () => { $('#edPrev').className = 'preview c-' + sel.color; $('#edPrev').innerHTML = av({ avatar: sel.avatar, color: sel.color }, 'big'); };
  $('#pAv').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#pAv .on').forEach(x => x.classList.remove('on')); b.classList.add('on'); sel.avatar = b.dataset.v; prev(); };
  $('#pCo').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#pCo .on').forEach(x => x.classList.remove('on')); b.classList.add('on'); sel.color = b.dataset.v; prev(); };
  $('#pSt').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (picked.has(b.dataset.v)) picked.delete(b.dataset.v);
    else if (picked.size >= MAX_STICKERS) { toast(`스티커는 ${MAX_STICKERS}개까지!`); return; }
    else picked.add(b.dataset.v);
    b.classList.toggle('on', picked.has(b.dataset.v)); $('#stkN').textContent = `${picked.size}/${MAX_STICKERS}`;
  };
  $('#editForm').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      await call('me', { ...d, grade: +d.grade, cls: +d.cls, avatar: sel.avatar, color: sel.color, stickers: [...picked] });
      await refreshMe(); closeSheet(); renderMe(); toast('프로필을 저장했어요 ✨');
    } catch (err) { fail(err); }
  };
}

/* ===== 계정 설정 ===== */
async function doLogout() { try { await call('logout', {}); } catch {} S.me = null; S.unread = 0; paintBadges(); closeSheet(); renderMe(); ctx.authed?.(null); toast('로그아웃했어요'); }
function openSettings() {
  sheet(`<h3>계정 설정</h3>
    <form class="sform" id="pwForm"><p class="lbl">비밀번호 바꾸기</p>
      <input name="old" type="password" placeholder="지금 비밀번호" required autocomplete="current-password">
      <input name="pw" type="password" placeholder="새 비밀번호 (6자 이상)" minlength="6" maxlength="64" required autocomplete="new-password">
      <button class="btn ghost" type="submit">비밀번호 바꾸기</button></form>
    <p class="lbl">차단한 사람</p><ul class="plist" id="blkList"><li class="skel"></li></ul>
    <div class="col">${S.me?.handle === ADMIN_HANDLE ? '<a class="btn" href="/admin/">🛠 관리자 페이지</a>' : ''}<button class="btn ghost" id="btnLogout">로그아웃</button><button class="btn ghost danger" id="btnWithdraw">탈퇴하기</button><button class="btn ghost" data-close>닫기</button></div>`);
  call('blocked').then(r => {
    $('#blkList').innerHTML = r.users.length ? r.users.map(u => personRow(u, `<button class="fbtn" data-block="${esc(u.handle)}" data-on="0">풀기</button>`)).join('') : '<li class="empty">없어요</li>';
  }).catch(() => { $('#blkList').innerHTML = ''; });
  $('#pwForm').onsubmit = async e => {
    e.preventDefault();
    try { await call('password', Object.fromEntries(new FormData(e.target))); toast('비밀번호를 바꿨어요'); e.target.reset(); } catch (err) { fail(err); }
  };
  $('#btnLogout').onclick = doLogout;
  $('#btnWithdraw').onclick = async () => {
    const pw = prompt('정말 탈퇴할까요? 프로필·팔로우·DM·게임 기록이 모두 지워지고 되돌릴 수 없어요.\n계속하려면 비밀번호를 입력하세요.');
    if (!pw) return;
    try { await call('withdraw', { pw }); S.me = null; paintBadges(); closeSheet(); renderMe(); ctx.authed?.(null); toast('탈퇴했어요. 그동안 고마웠어요'); } catch (err) { fail(err); }
  };
}

/* ===== DM (#dm · #dm/아이디) ===== */
function stopThread() { clearTimeout(dmTimer); openThread = ''; threadIn = ''; }
// 링크: #dm 화면은 주소 이동, 메시지 창 안에서는 창 안에서만 바꿈
const toThread = (h, panel) => panel ? `href="#" data-pdm="${esc(h)}"` : `href="#dm/${esc(h)}"`;
const toList = panel => panel ? 'href="#" data-pdm=""' : 'href="#dm"';
async function renderDm(handle, box = $('#dmBox'), panel = false) {
  stopThread();
  if (S.enabled === false) { box.innerHTML = offCard(); return; }
  if (!S.me) { box.innerHTML = needLogin('DM을 하려면 로그인해 주세요'); return; }
  if (handle) return renderThread(handle, box, panel);
  if (!box.querySelector('.dmcard')) box.innerHTML = '<div class="card"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
  try {
    const r = await call('inbox');
    paintRecent(r.threads);
    if (openThread) return;
    const threads = r.threads.map(t => `<li class="thread ${t.unread ? 'new' : ''}"><a ${toThread(t.user.handle, panel)}>${av(t.user)}
      <span class="pi"><b>${esc(t.user.name)}</b><small>${t.mine ? '나: ' : ''}${esc(t.last)}</small></span>
      <span class="tm">${ago(t.at)}${t.unread ? `<i class="nb">${t.unread}</i>` : ''}</span></a></li>`).join('');
    const friends = r.friends.map(u => `<a class="fchip" ${toThread(u.handle, panel)}>${av(u)}<small>${esc(u.name)}</small></a>`).join('');
    box.innerHTML = `<div class="card dmcard">
      ${friends ? `<p class="lbl">친구에게 먼저 말 걸기</p><div class="frow">${friends}</div>` : ''}
      <ul class="plist">${threads || '<li class="empty">아직 주고받은 메시지가 없어요</li>'}</ul>
      <p class="note">💡 서로 팔로우한 친구끼리 DM할 수 있어요. 불편한 메시지는 프로필의 ⋯에서 차단·신고해 주세요.</p>
    </div>`;
  } catch (e) { box.innerHTML = `<div class="card"><p class="empty">${esc(e.message)}</p></div>`; }
}

/* ===== 떠 있는 메시지 창 (컴퓨터) · 둥근 버튼 (폰) ===== */
const panelOpen = () => !!$('#dmPanel') && !$('#dmPanel').hidden;
const wide = () => matchMedia('(min-width:900px)').matches;
function paintRecent(threads = []) {
  const el = $('#dmAvs'); if (!el) return;
  el.innerHTML = S.me ? threads.slice(0, 3).map(t => av(t.user)).join('') : '';
}
async function loadRecent() {
  if (!S.me) { paintRecent(); return; }
  try { paintRecent((await call('inbox')).threads); } catch {}
}
function openPanel(handle = '') {
  if (!wide()) { ctx.go(handle ? 'dm/' + encodeURIComponent(handle) : 'dm'); return; }
  $('#dmPanel').hidden = false; $('#dmDock').classList.add('open'); $('#dmPill').setAttribute('aria-expanded', 'true');
  renderDm(handle, $('#dmPBox'), true);
}
function closePanel() {
  if (!panelOpen()) return;
  if (threadIn === 'panel') stopThread();
  $('#dmPanel').hidden = true; $('#dmDock').classList.remove('open'); $('#dmPill').setAttribute('aria-expanded', 'false');
  $('#dmPBox').innerHTML = '';
  loadRecent();
}
function setupDock() {
  const dock = $('#dmDock'); if (!dock) return;
  dock.hidden = !S.enabled;
  $('#dmPill').onclick = () => openPanel();
  $('#dmPClose').onclick = () => { closePanel(); $('#dmPill').focus(); };
  dock.addEventListener('click', e => {
    const t = e.target.closest('[data-pdm]');
    if (t) { e.preventDefault(); renderDm(t.dataset.pdm, $('#dmPBox'), true); return; }
    if (e.target.closest('[data-go]')) closePanel();   // '크게 보기'·'로그인' 등 다른 화면으로 가면 창은 닫음
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen() && !document.querySelector('.modal.open')) closePanel(); });
  matchMedia('(min-width:900px)').addEventListener?.('change', m => { if (!m.matches) closePanel(); });
}

function bubbleHtml(m, next, readUpTo) {
  const gap = !next || next.mine !== m.mine || next.at - m.at > 300e3;
  return `<li class="msg ${m.mine ? 'me' : 'you'} ${m.del ? 'del' : ''}" data-id="${m.id}">
    <span class="bb">${m.del ? '삭제된 메시지' : esc(m.body)}</span>
    ${gap ? `<small class="mt">${m.mine && m.id <= readUpTo ? '읽음 · ' : ''}${hm(m.at)}</small>` : ''}</li>`;
}
async function renderThread(handle, box, panel) {
  const q = sel => box.querySelector(sel);
  openThread = handle; threadIn = panel ? 'panel' : 'page';
  box.innerHTML = '<div class="card"><div class="skel"></div><div class="skel"></div></div>';
  let msgs = [], readUpTo = 0, d;
  try { d = await call('dm/' + encodeURIComponent(handle)); }
  catch (e) { box.innerHTML = `<div class="card soc-gate"><p class="gate-em">🤔</p><p><b>${esc(e.message)}</b></p><a class="btn ghost" ${toList(panel)}>DM 목록</a></div>`; openThread = ''; threadIn = ''; return; }
  if (openThread !== handle) return;
  msgs = d.messages; readUpTo = d.readUpTo;
  box.innerHTML = `<div class="card chat">
    <div class="chead"><a ${toList(panel)} class="back" aria-label="DM 목록">‹</a><a href="#u/${esc(d.user.handle)}" class="who">${av(d.user)}<span class="pi"><b>${esc(d.user.name)}</b><small>${d.user.online ? '접속 중' : '@' + esc(d.user.handle)}</small></span></a></div>
    <ol class="msgs" id="msgs" aria-live="polite">${msgs.length >= 40 ? '<li class="older"><button id="olderBtn">이전 메시지 보기</button></li>' : ''}</ol>
    ${d.canSend ? `<form class="compose" id="dmForm" autocomplete="off"><textarea id="dmIn" rows="1" maxlength="500" placeholder="메시지 보내기…" aria-label="메시지"></textarea><button class="btn" aria-label="보내기">➤</button></form>`
      : `<p class="note locked">${d.rel.blocked ? '차단한 사람이에요' : '서로 팔로우하면 메시지를 보낼 수 있어요'}</p>`}
  </div>`;
  const list = q('#msgs');
  const paint = (keepScroll) => {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const older = list.querySelector('.older')?.outerHTML || '';
    list.innerHTML = older + (msgs.length ? msgs.map((m, i) => bubbleHtml(m, msgs[i + 1], readUpTo)).join('') : `<li class="empty hello">👋 ${esc(d.user.name)}에게 첫 메시지를 보내 보세요</li>`);
    if (!keepScroll || atBottom) list.scrollTop = list.scrollHeight;
  };
  paint();
  q('#olderBtn')?.addEventListener('click', async ev => {
    try {
      const r = await call(`dm/${encodeURIComponent(handle)}?before=${msgs[0].id}`);
      const h0 = list.scrollHeight;
      msgs = [...r.messages, ...msgs];
      if (r.messages.length < 40) list.querySelector('.older')?.remove();
      paint(true); list.scrollTop = list.scrollHeight - h0;
    } catch (err) { fail(err); }
  });
  list.onclick = async e => {
    const li = e.target.closest('.msg'); if (!li || li.classList.contains('del')) return;
    const id = +li.dataset.id;
    if (li.classList.contains('me')) {
      if (!confirm('이 메시지를 보내기 취소할까요?')) return;
      try { await call('unsend', { id }); const m = msgs.find(x => x.id === id); if (m) { m.del = true; m.body = ''; } paint(true); } catch (err) { fail(err); }
    } else {
      sheet(`<h3>메시지</h3><p class="quote">${esc(li.textContent.trim())}</p><div class="col"><button class="btn ghost" data-report="${esc(handle)}" data-msg="${id}">🚨 이 메시지 신고</button><button class="btn ghost" data-close>닫기</button></div>`);
    }
  };
  const form = q('#dmForm');
  if (form) {
    const inp = q('#dmIn');
    const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; };
    inp.addEventListener('input', grow);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.onsubmit = async e => {
      e.preventDefault();
      const text = inp.value.trim(); if (!text) return;
      inp.value = ''; grow();
      try { const r = await call('dm/' + encodeURIComponent(handle), { body: text }); if (!msgs.some(m => m.id === r.message.id)) msgs.push(r.message); paint(); dmDelay = 3000; }
      catch (err) { fail(err); inp.value = text; }
      inp.focus();
    };
  }
  // 새 메시지 확인 (화면을 보고 있을 때만). 대화가 오가면 3초, 조용하면 점점 늘려 최대 15초 (서버 요청 줄이기)
  const tick = async () => {
    if (openThread !== handle) return;
    if (!document.hidden) {
      try {
        const last = msgs[msgs.length - 1]?.id || 0;
        const r = await call(`dm/${encodeURIComponent(handle)}?after=${last}`);
        if (openThread !== handle) return;
        const fresh = r.messages.filter(m => !msgs.some(x => x.id === m.id));
        if (fresh.length || r.readUpTo !== readUpTo) { msgs.push(...fresh); readUpTo = r.readUpTo; paint(true); }
        dmDelay = fresh.length ? 3000 : Math.min(15000, Math.round(dmDelay * 1.4));
        S.unread = Math.max(0, S.unread - fresh.filter(m => !m.mine).length); paintBadges();
      } catch {}
    }
    dmTimer = setTimeout(tick, dmDelay);
  };
  dmDelay = 3000;
  dmTimer = setTimeout(tick, dmDelay);
  refreshMe();
}

/* ===== 미니게임 (#game) ===== */
async function renderGame() {
  const box = $('#gameBox');
  let info = null;
  if (S.me) { try { info = (await call('games')).games; } catch {} }
  box.innerHTML = `<div class="ggrid">${Object.entries(GAMES).map(([k, g], i) => {
    const x = info?.[k];
    return `<article class="card gcard g-${k}">
      <p class="gem">${g.em}</p><h3>${g.name}</h3><p class="gdesc">${g.desc}</p>
      ${x ? `<div class="gstat"><span>내 최고 기록<b>${x.best != null ? esc(g.fmt(x.best)) : '-'}</b></span><span>내 순위<b>${x.rank != null ? x.rank + '위' : '-'}</b></span></div>
        <p class="gtop">${x.top ? `👑 1등 <a href="#u/${esc(x.top.handle)}">${esc(x.top.avatar)} ${esc(x.top.name)}</a> ${esc(g.fmt(x.top.value))}` : '👑 1등 자리가 비어 있어요!'}</p>` : ''}
      <div class="gbtns"><button class="btn big" data-play="${k}">▶ 플레이</button><button class="btn ghost" data-rank="${k}">🏆 랭킹</button></div>
    </article>`;
  }).join('')}</div>
  ${S.me ? '' : '<p class="note center">로그인하면 기록이 랭킹에 올라가고 반 대항전에 참여해요!</p>'}`;
}

async function openRank(game, scope = 'all') {
  if (S.enabled === false) { toast('랭킹을 준비하고 있어요'); return; }
  if (!S.me) { toast('랭킹은 로그인하면 볼 수 있어요'); ctx.go('me'); return; }
  const g = GAMES[game];
  const tabs = [['all', '전체'], ['friends', '친구'], ['class', '반 대항전']].map(([k, t]) => `<button data-rank="${game}" data-scope="${k}" class="${k === scope ? 'on' : ''}">${t}</button>`).join('');
  sheet(`<h3>${g.em} ${g.name} 랭킹</h3><div class="segs">${tabs}</div><ol class="rank" id="rankList"><li class="skel"></li><li class="skel"></li></ol>
    <p class="note" id="rankNote"></p><div class="row"><button class="btn" data-play="${game}">▶ 도전하기</button><button class="btn ghost" data-close>닫기</button></div>`);
  try {
    const r = await call(`rank?game=${game}&scope=${scope}`);
    const medal = i => ['🥇', '🥈', '🥉'][i] || i + 1;
    if (scope === 'class') {
      $('#rankList').innerHTML = r.list.length ? r.list.map((c, i) => `<li class="${r.mine && r.mine.grade === c.grade && r.mine.cls === c.cls ? 'me' : ''}"><span class="rk">${medal(i)}</span><span class="pi"><b>${c.grade}학년 ${c.cls}반</b><small>${c.players}명 참가</small></span><b class="rv">${esc(g.fmt(c.value))}</b></li>`).join('')
        : '<li class="empty">아직 아무 반도 기록이 없어요</li>';
      $('#rankNote').textContent = '반마다 최고 기록 상위 3명의 평균이에요. 프로필에 학년·반을 적어야 반 점수에 들어가요.';
    } else {
      $('#rankList').innerHTML = r.list.length ? r.list.map((u, i) => `<li class="${u.isMe ? 'me' : ''}"><span class="rk">${medal(i)}</span><a href="#u/${esc(u.handle)}" data-u="1">${av(u)}<span class="pi"><b>${esc(nameOf(u))}${devTag(u)}</b><small>${esc(classTxt(u) || '@' + handleOf(u))}</small></span></a><b class="rv">${esc(g.fmt(u.value))}</b></li>`).join('')
        : '<li class="empty">아직 기록이 없어요. 첫 1등을 노려 보세요!</li>';
      $('#rankNote').textContent = r.mine && !r.list.some(x => x.isMe) ? `내 순위: ${r.mine}위 (${g.fmt(r.myValue)})` : '각자 최고 기록으로 순위를 매겨요';
    }
  } catch (e) { $('#rankList').innerHTML = `<li class="empty">${esc(e.message)}</li>`; }
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-fb]')) { openFeedback(); return; }   // 개발자 프로필의 의견 안내 → 의견 보내기 창
  const r = e.target.closest('[data-rank]'); if (r) { openRank(r.dataset.rank, r.dataset.scope); return; }
  const p = e.target.closest('[data-play]'); if (p) { closeSheet(); play(p.dataset.play); }
});

/* ----- 게임 화면 ----- */
let quitGame = null;
function stage(title, html) {
  const el = $('#gamePlay');
  el.innerHTML = `<div class="ptop"><b>${title}</b><button class="iconbtn" id="pQuit" data-tip="그만하기" data-tip-end aria-label="그만하기">✕</button></div><div class="parea" id="parea">${html}</div>`;
  el.hidden = false; document.body.classList.add('playing');
  $('#pQuit').onclick = endPlay;
  return $('#parea');
}
function endPlay() { quitGame?.(); quitGame = null; $('#gamePlay').hidden = true; $('#gamePlay').innerHTML = ''; document.body.classList.remove('playing'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#gamePlay').hidden) endPlay(); });

let ticket = null;   // 서버 시작 티켓 (기록 저장 때 같이 보냄, 한 판에 한 번)
function play(game) {
  ticket = S.me ? call('start', { game }).then(r => r.ticket).catch(() => '') : null;
  ({ reaction: playReaction, num25: playNum25, cut: playCut })[game]?.();
}

async function finish(game, value, detail = '') {
  const g = GAMES[game], area = $('#parea'); if (!area) return;
  area.innerHTML = `<div class="result"><p class="gem">${g.em}</p><p class="rlbl">${g.name} 결과</p><p class="rval">${esc(g.fmt(value))}</p>${detail}<p class="rmsg" id="rMsg">${S.me ? '기록 저장 중…' : '로그인하면 랭킹에 올라가요!'}</p>
    <div class="row"><button class="btn big" id="again">다시 하기</button><button class="btn ghost" data-rank="${game}" id="toRank">🏆 랭킹</button></div></div>`;
  $('#again').onclick = () => play(game);
  $('#toRank').addEventListener('click', endPlay);
  if (!S.me) return;
  try {
    const r = await call('score', { game, value, ticket: await ticket });
    ticket = null;
    $('#rMsg').innerHTML = (r.newBest ? '🎉 <b>최고 기록 경신!</b> ' : `내 최고 ${esc(g.fmt(r.best))} · `) + `전체 <b>${r.rank}위</b>` + (r.rank === 1 ? ' 👑' : '');
    if ($('#v-game').classList.contains('on')) renderGame();
  } catch (e) { if ($('#rMsg')) $('#rMsg').textContent = e.message; }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* 1) 반응속도: 5번 평균 */
function playReaction() {
  const area = stage('⚡ 반응속도', `<button class="rx idle" id="rx"><b>준비되면 탭!</b><small>초록색으로 바뀌면 최대한 빨리 누르세요</small></button><ol class="rxlog" id="rxlog"></ol>`);
  const pad = $('#rx'), log = $('#rxlog');
  const times = []; let state = 'idle', t0 = 0, timer = 0, alive = true;
  quitGame = () => { alive = false; clearTimeout(timer); };
  const arm = () => {
    state = 'wait'; pad.className = 'rx wait'; pad.innerHTML = `<b>기다려…</b><small>${times.length + 1} / 5</small>`;
    timer = setTimeout(() => { if (!alive) return; state = 'go'; pad.className = 'rx go'; pad.innerHTML = '<b>지금!</b>'; t0 = performance.now(); }, 1000 + Math.random() * 2500);
  };
  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (state === 'idle' || state === 'shown') return arm();
    if (state === 'wait') { clearTimeout(timer); state = 'shown'; pad.className = 'rx early'; pad.innerHTML = '<b>앗, 너무 빨라요!</b><small>탭해서 이번 판 다시</small>'; return; }
    if (state === 'go') {
      const ms = Math.round(performance.now() - t0);
      times.push(ms); log.insertAdjacentHTML('beforeend', `<li>${ms}ms</li>`);
      if (times.length >= 5) {
        state = 'done';
        const avg = Math.max(100, Math.round(times.reduce((a, b) => a + b, 0) / times.length));
        setTimeout(() => alive && finish('reaction', Math.min(avg, 1500), `<p class="rdet">${times.map(t => t + 'ms').join(' · ')}</p>`), 500);
        pad.className = 'rx done'; pad.innerHTML = `<b>${ms}ms</b>`;
      } else { state = 'shown'; pad.className = 'rx shown'; pad.innerHTML = `<b>${ms}ms</b><small>탭해서 다음 (${times.length + 1} / 5)</small>`; }
    }
  });
}

/* 2) 1 to 25: 틀리면 +1초 */
function playNum25() {
  const nums = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - .5);
  const area = stage('🔢 1 to 25', `<div class="n25top"><span>다음 <b id="nNext">1</b></span><span id="nTime">0.00초</span></div>
    <div class="n25" id="n25">${nums.map(n => `<button data-n="${n}">${n}</button>`).join('')}</div><p class="note center">틀리게 누르면 +1초</p>`);
  let next = 1, t0 = 0, pen = 0, raf = 0, alive = true;
  quitGame = () => { alive = false; cancelAnimationFrame(raf); };
  const tick = () => { if (!alive) return; $('#nTime').textContent = ((performance.now() - t0 + pen) / 1000).toFixed(2) + '초'; raf = requestAnimationFrame(tick); };
  $('#n25').addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    e.preventDefault();
    if (+b.dataset.n === next) {
      if (next === 1) { t0 = performance.now(); tick(); }
      b.disabled = true; b.classList.add('ok'); next++;
      $('#nNext').textContent = next > 25 ? '끝!' : next;
      if (next > 25) { cancelAnimationFrame(raf); const ms = Math.round(performance.now() - t0 + pen); setTimeout(() => alive && finish('num25', Math.max(2500, Math.min(ms, 600000))), 300); }
    } else if (next > 1) { pen += 1000; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); }
  });
}

/* 3) 컷 타이밍: 움직이는 플레이헤드를 컷 지점에서 멈추기 (5번, 점점 빨라짐) */
function playCut() {
  const area = stage('🎬 컷 타이밍', `<p class="cutinfo"><span id="cRound">1 / 5</span> · 누적 오차 <b id="cSum">0ms</b></p>
    <div class="tl" id="tl"><div class="tl-ruler"></div><i class="tl-mark" id="cMark"></i><i class="tl-head" id="cHead"></i></div>
    <p class="cutmsg" id="cMsg">빨간 컷 지점에 플레이헤드가 오면 CUT!</p>
    <button class="btn big cutbtn" id="cBtn">✂ CUT</button>`);
  const DUR = [2400, 2100, 1800, 1550, 1300];   // 끝까지 가는 시간(ms)
  let round = 0, sum = 0, raf = 0, t0 = 0, target = 0, running = false, alive = true;
  const errs = [];
  quitGame = () => { alive = false; cancelAnimationFrame(raf); };
  const head = $('#cHead'), mark = $('#cMark'), btn = $('#cBtn');
  const start = async () => {
    const dur = DUR[round];
    target = dur * (.35 + Math.random() * .5);          // 컷 지점 (시간)
    mark.style.left = (target / dur * 100) + '%';
    head.style.left = '0%'; $('#cRound').textContent = `${round + 1} / 5`;
    await wait(500); if (!alive) return;
    running = true; t0 = performance.now();
    const step = now => {
      if (!running || !alive) return;
      const t = now - t0;
      head.style.left = Math.min(100, t / dur * 100) + '%';
      if (t >= dur) return stop(dur);   // 끝까지 가면 놓친 것
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const stop = (tAt, early) => {
    if (!running) return; running = false; cancelAnimationFrame(raf);
    const e = Math.min(1000, Math.round(Math.abs(tAt - target)));
    errs.push(e); sum += e; $('#cSum').textContent = sum + 'ms';
    $('#cMsg').innerHTML = e <= 15 ? `<b class="perfect">PERFECT! ${e}ms</b>` : e <= 50 ? `<b class="great">GREAT ${e}ms</b>` : e <= 120 ? `<b>GOOD ${e}ms</b>` : `<b class="miss">${e >= 1000 ? 'MISS' : e + 'ms'}</b>`;
    round++;
    if (round >= 5) { btn.disabled = true; setTimeout(() => alive && finish('cut', Math.min(sum, 6000), `<p class="rdet">${errs.map(x => x + 'ms').join(' · ')}</p>`), 700); }
    else setTimeout(() => alive && start(), 650);
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); if (running) stop(performance.now() - t0); });
  start();
}

/* ===== 시작 ===== */
export async function init(c) {
  ctx = c;
  c.RENDER.me = renderMe; c.RENDER.u = renderUser; c.RENDER.dm = renderDm; c.RENDER.game = renderGame;
  c.report = openReport;
  c.authForm = authHtml;   // 소개 화면의 로그인/가입 폼
  c.onLeave = v => {
    document.body.dataset.view = v;
    if (v === 'dm') closePanel(); else if (threadIn === 'page') stopThread();
  };
  try { const r = await call('config'); S.enabled = r.enabled !== false; S.needCode = !!r.needCode; } catch { S.enabled = false; }
  document.body.dataset.view = location.hash.slice(1).split('/')[0] || 'home';
  setupDock();
  if (S.enabled) await refreshMe(); else paintBadges();
  if (!S.meErr) c.authed?.(S.me, S.enabled);   // 로그인 전이면 소개 화면 유지, 로그인돼 있으면 닫음 (연결 문제면 지금 상태 그대로)
  startPoll();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) refreshMe(); });
  $('#btnFeedback').onclick = openFeedback;
  $('#btnOut').onclick = doLogout;
  $('#btnNotices').onclick = openNotices;
  checkNotices();
}

/* ===== 헤더: 💡 의견 보내기 · 📢 공지 모아 보기 ===== */
const pad2 = n => String(n).padStart(2, '0');
const dt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const NT_IC = { warn: '⚠️', fun: '🎉', info: '📢' };
let ntList = null;
// 업데이트 소식(패치노트): public/patchnotes.json — 개발자가 확인한 주간 패치노트가 쌓임 (최신이 맨 앞)
let ptList = null;
async function checkNotices() {   // 새 공지·새 업데이트 소식이 있으면 📢 버튼에 빨간 점 (본 것: sg_notice_seen · sg_patch_seen)
  const [n, p] = await Promise.all([
    fetch('/api/notices').then(r => r.json()).then(j => j.list || []).catch(() => []),
    fetch('/patchnotes.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).then(j => Array.isArray(j) ? j : []).catch(() => []),
  ]);
  ntList = n; ptList = p;
  $('#ntDot').hidden = !((ntList.length && store.get('notice_seen') !== ntList[0].id) || (ptList.length && store.get('patch_seen') !== ptList[0].id));
}
async function openNotices() {
  sheet('<h3>📢 공지</h3><ul class="ntlist"><li class="skel"></li><li class="skel"></li></ul>');
  if (!ntList || !ptList) await checkNotices();
  if (ntList.length) { store.set('notice_seen', ntList[0].id); store.set('notice_x', null); }   // 다 봤음 + 닫았던 띠 공지도 다시 보이게
  if (ptList.length) store.set('patch_seen', ptList[0].id);
  $('#ntDot').hidden = true;
  const patches = ptList.slice(0, 12).map((x, i) => `<li class="${i ? '' : 'live'}"><span class="nt-ic">🛠</span><div><p>${esc(x.title || '업데이트')}</p>
      <ul class="ptitems">${(x.items || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul><small>${esc(x.date || '')}${i ? '' : ' · <b>최신</b>'}</small></div></li>`).join('');
  $('#socSheet').innerHTML = `<h3>📢 공지</h3>${ntList.length ? `<ul class="ntlist">${ntList.map(n => `<li class="${n.live ? 'live' : ''}">
      <span class="nt-ic">${NT_IC[n.tone] || '📢'}</span><div><p>${n.link ? `<a href="${esc(n.link)}" data-close>${esc(n.text)}</a>` : esc(n.text)}</p>
      <small>${dt(n.at)}${n.live ? ' · <b>지금 공지</b>' : ''}</small></div></li>`).join('')}</ul>` : '<p class="empty">아직 공지가 없어요</p>'}
    ${patches ? `<h3 class="sp">🛠 업데이트 소식</h3><ul class="ntlist">${patches}</ul>` : ''}
    <div class="row"><button class="btn ghost" data-close>닫기</button></div>`;
}
const FB_KIND = [['idea', '💡 이런 기능 있으면 좋겠어요'], ['bug', '🐞 이상하거나 안 돼요'], ['etc', '💬 그 밖의 말']];
function openFeedback() {
  if (!S.me) { toast('의견은 로그인하면 보낼 수 있어요'); ctx.go('me'); return; }
  sheet(`<h3>💡 의견 보내기</h3><p class="note">개발자에게 바로 전달돼요. 사이트를 더 좋게 만드는 데 써요!</p>
    <form class="sform" id="fbForm">
      <div class="segs fbk">${FB_KIND.map(([k, t], i) => `<label><input type="radio" name="kind" value="${k}" ${i ? '' : 'checked'}><span>${t}</span></label>`).join('')}</div>
      <textarea name="body" maxlength="500" rows="5" required placeholder="예: 시간표에 교실 이름도 나왔으면 좋겠어요"></textarea>
      <p class="note">보낸 사람 아이디(@${esc(S.me.handle)})가 개발자에게 보여요. 욕설·저격 글은 보내지 말아 주세요.</p>
      <div class="row"><button class="btn" type="submit">보내기</button><button class="btn ghost" type="button" data-close>닫기</button></div>
    </form>`);
  $('#fbForm').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, b = f.querySelector('[type=submit]'); b.disabled = true;
    try { await call('feedback', { kind: f.kind.value, body: f.body.value }); closeSheet(); toast('고마워요! 개발자에게 전달됐어요 🙌'); }
    catch (x) { toast(x.message); b.disabled = false; }
  };
}
