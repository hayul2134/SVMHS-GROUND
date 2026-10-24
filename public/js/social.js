// SVMHS GROUND — 소셜: 계정 · 프로필 꾸미기 · 팔로우 · DM · 미니게임 랭킹 (서버: functions/api/s/[[path]].js)
import { $, $$, esc, toast, store } from './util.js';
import * as ATT from './attend.js';
import * as GCH from './gacha.js';
import { ATT_COLORS, COLOR_NAME, rwOn, decoSlots, objName, GACHA, GACHA_OLD, RAR, FX, NEON, neonPick, GC_TITLE, gcDone } from './att-rewards.js';
import { emo, artOf, ui, stkOf, stkMsg, repTag, kavName } from './att-art.js';
import { HOME_MAX } from './home-score.js';

/* ===== 서버와 같게 유지하는 목록 ===== */
const AVATARS = ['k:cat','k:dog','k:bear','k:bunny','k:frog','k:chick','k:hamster','k:penguin','k:fox','k:panda','k:dino','k:ghost','k:slime','k:sheep','k:whale','k:axolotl'];   // 2026-10-24: 동물 이모지 → 직접 그린 캐릭터 16종(테마 캐릭터 얼굴). 예전 이모지 값은 lib/db.js v20에서 옮김
const COLORS = ['sky','blue','mint','lime','yellow','peach','pink','violet','ink'];
const ALL_COLORS = [...COLORS, ...ATT_COLORS];   // 출석 보상 전용 배경 색 포함
const STICKERS = ['⭐','✨','💖','💙','🔥','🎬','🎥','📸','🎧','🎮','🍀','🌈','☁️','🌙','🍓','🧋','🐾','👑','💯','🎀','🫧','🪐','🦋','🌷','🍒','🎵','⚡','🌊'];
// 마우스를 올리면 뜨는 이름표(data-tip)용 이름
const EMO_NAME = { '😎':'선글라스','🐶':'강아지','🐱':'고양이','🐰':'토끼','🦊':'여우','🐻':'곰','🐼':'판다','🐸':'개구리','🐥':'병아리','🐧':'펭귄','🦄':'유니콘','🐯':'호랑이','🐨':'코알라','🐹':'햄스터','👽':'외계인','🤖':'로봇','👻':'유령','🎃':'호박','🌝':'보름달','🍀':'네잎클로버','🔥':'불꽃','⚡':'번개','🌈':'무지개','🎬':'촬영 슬레이트','🎥':'영화 카메라','🎧':'헤드폰','🎮':'게임패드','🏀':'농구공','⚽':'축구공','🎸':'기타','🍓':'딸기','🍩':'도넛','🧋':'버블티','🍕':'피자','💜':'보라 하트','⭐':'별','✨':'반짝반짝','💖':'반짝 하트','💙':'파란 하트','📸':'사진기','☁️':'구름','🌙':'달','🐾':'발자국','👑':'왕관','💯':'백점','🎀':'리본','🫧':'비눗방울','🪐':'행성','🦋':'나비','🌷':'튤립','🍒':'체리','🎵':'음표','🌊':'파도' };
const COLOR_KO = { sky:'하늘색', blue:'파란색', mint:'민트색', lime:'연두색', yellow:'노란색', peach:'살구색', pink:'분홍색', violet:'보라색', ink:'남색' };
const MAX_STICKERS = 6;
const stkMax = u => isDev(u) ? 12 : MAX_STICKERS;   // 개발자는 치장 제한 없음(배너 자리 12개)
const ADMIN_HANDLE = 'developer';   // 서버 lib/db.js와 같게 (버튼 표시용, 실제 권한은 서버가 검사)
// 직접 그린 스티커 아이콘(index.html 스프라이트 #sj-*) — 이모지 대신 (2026-10-24)
const ic = (k, cls = '') => `<svg class="sic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${k}"/></svg>`;
const GAMES = {
  reaction: { name: '반응속도', ic: 'bolt', desc: '초록색으로 바뀌는 순간 탭! 5번 평균', fmt: v => v + 'ms' },
  num25: { name: '1 to 25', ic: 'n25', desc: '1부터 25까지 순서대로 빠르게 누르기', fmt: v => (v / 1000).toFixed(2) + '초' },
  cut: { name: '컷 타이밍', ic: 'clap', desc: '플레이헤드가 컷 지점에 오면 CUT! 5번 오차 합', fmt: v => '오차 ' + v + 'ms' },
  // 나 집에 갈래!: 멀리 갈수록 좋음 → 서버엔 HOME_MAX - 거리로 저장(다른 게임처럼 작을수록 1등)
  home: { name: '나 집에 갈래!', ic: 'home', desc: '하교 달리기! 장애물을 점프·숙이기로 피해 집까지 최대한 멀리. 캐릭터 꾸미기 가능', fmt: v => (HOME_MAX - v).toLocaleString('ko-KR') + 'm' },
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
const av = (u, cls = '') => u?.handle === ADMIN_HANDLE ? `<span class="av avdev ${cls}"><img src="/logo-mark.svg?v=4" alt="">${u.online ? '<i class="dot" data-tip="접속 중"></i>' : ''}</span>` : `<span class="av c-${esc(ALL_COLORS.includes(u.color) ? u.color : 'sky')} ${cls}">${emo(u.avatar || 'k:cat', 'ava')}${u.online ? '<i class="dot" data-tip="접속 중"></i>' : ''}</span>`;
const isDev = u => u?.handle === ADMIN_HANDLE;
// 뽑기 전설 '별똥별 등장': 프로필을 열 때 한 번 쏟아지는 별(위치·크기·시간을 조금씩 다르게)
const pfxStars = () => `<div class="pfx-star" aria-hidden="true">${'<i></i>'.repeat(14)}</div>`;   // 위치·크기·시간은 style.css nth-child (CSP: style 속성 금지)
const devTag = u => (isDev(u) ? '<span class="devb" data-tip="SVMHS GROUND 개발자">🛠 개발자</span>' : '') + repTag(u);   // 이름 옆 작은 배지 + 대표 스티커
// 개발자 계정은 닉네임 대신 '개발자'로 표시하고 아이디는 어디에도 띄우지 않음 (링크는 실제 아이디 그대로)
const nameOf = u => isDev(u) ? '개발자' : u.name;
const atOf = u => isDev(u) ? '' : '@' + u.handle;   // 화면에 보이는 아이디 (개발자는 빈칸)
const atH = h => h === ADMIN_HANDLE ? '개발자' : '@' + h;   // 아이디만 있을 때 (시트 제목·확인창)
const classTxt = u => isDev(u) ? '' : u.grade && u.cls ? `${u.grade}학년 ${u.cls}반` : '';
const ago = t => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전'; if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`;
};
const hm = t => { const d = new Date(t), h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; };
const personRow = (u, right = '') => `<li class="person"><a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}">${av(u)}<span class="pi"><b>${esc(nameOf(u))}${devTag(u)}</b><small>${esc([atOf(u), u.mood].filter(Boolean).join(' · '))}</small></span></a>${right}</li>`;
const followBtn = u => u.isMe ? '' : `<button class="fbtn ${u.following ? 'on' : ''}" data-follow="${esc(u.handle)}" data-on="${u.following ? 0 : 1}">${u.following ? '팔로잉' : '팔로우'}</button>`;
const needLogin = (msg) => `<div class="card soc-gate"><p class="gate-em">🔐</p><p><b>${msg}</b></p><p class="muted small">아이디만 있으면 1분이면 가입해요</p><button class="btn" data-go="me">로그인 / 가입하기</button></div>`;
const offCard = () => `<div class="card soc-gate"><p class="gate-em">🛠️</p><p><b>소셜 기능을 준비하고 있어요</b></p><p class="muted small">곧 열려요! 조금만 기다려 주세요</p></div>`;

function sheet(html) { $('#socSheet').classList.remove('wide', 'attw', 'edw'); $('#socSheet').innerHTML = html; ctx.openModal('#mSoc'); }
const closeSheet = () => ctx.closeModal($('#mSoc'));

/* ===== 헤더 배지 · 주기적 확인 ===== */
function paintBadges() {
  const n = S.me ? S.unread : 0;
  $$('[data-badge="dm"]').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
  const dev = S.me?.handle === ADMIN_HANDLE;
  if (!S.me) ATT.sync(null);   // 로그아웃: 🔥 버튼 숨김
  $('#btnOut').hidden = !S.me;   // 로그인돼 있을 때만 메뉴 맨 아래 빨간 로그아웃
  $('#btnEdit').hidden = !S.me;   // 메뉴 '프로필' 바로 아래 '꾸미기' (로그인했을 때만)
  $('#btnAdmin').hidden = !dev;   // 관리자 계정일 때만 메뉴에 표시 (권한은 서버가 검사)
  ['#btnClass', '#btnShare', '#btnReport'].forEach(id => { $(id).hidden = dev; });   // 개발자 계정엔 설정·QR·신고 필요 없음
  $('#btnMe .mi').innerHTML = S.me ? av({ ...S.me, online: false }, 'tiny') : '<svg viewBox="0 0 24 24"><use href="#i-user"/></svg>';
}
// 네온 시계 색: 이 기기에 저장 · 고르는 곳은 꾸미기 미리보기와 뽑기 '내 효과' 두 군데(같은 버튼 data-neon-c)
const neonC = () => { const v = store.get('neon_c', 'pink'); return NEON.some(x => x[0] === v) ? v : 'pink'; };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-neon-c]'); if (!b) return;
  store.set('neon_c', b.dataset.neonC); document.documentElement.dataset.neon = b.dataset.neonC;
  $$('[data-neon-c]').forEach(x => { const on = x.dataset.neonC === b.dataset.neonC; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
  document.documentElement.classList.remove('neon-on'); void document.documentElement.offsetWidth; document.documentElement.classList.add('neon-on');   // 색 바꾸면 켜지는 연출 한 번
});
// 내가 켠 뽑기 효과 중 내 화면에만 보이는 것: 시계 테마(html[data-ckfx]) · 마스코트 소품(html[data-mfx] → app.js가 캐릭터에 붙임)
function applyFx() {
  const fx = S.me?.gc?.fx || {}, h = document.documentElement;
  const ck = fx.clock === 'r:fxneon' ? 'neon' : '', mf = fx.masc === 'r:fxcrown' ? 'crown' : '';
  if (ck) h.dataset.ckfx = ck; else delete h.dataset.ckfx;
  h.dataset.neon = neonC();
  if ((h.dataset.mfx || '') !== mf) { if (mf) h.dataset.mfx = mf; else delete h.dataset.mfx; document.dispatchEvent(new Event('sg:mfx')); }
}
async function refreshMe() {
  try {
    const r = await call('me');
    S.me = r.me; S.unread = r.unread || 0; S.counts = r.counts || null; S.meErr = false;
  } catch (e) { S.me = null; S.meErr = !e.status || e.status >= 500; }   // meErr: 연결·서버 문제(로그아웃 상태라고 단정 못 함)
  paintBadges();
  applyFx();
  if (!S.meErr) { ATT.sync(S.me); ctx?.setDeco?.(S.me?.deco || []); }   // 하루 한 번 자동 출석 (첫 출석이면 축하 창) · 첫 화면 시계 스티커
  if (!panelOpen()) loadRecent();
}
function startPoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.hidden || !S.me || openThread) return;
    try { const r = await call('poll'); const more = r.unread > S.unread; S.unread = r.unread; paintBadges();
    if (more) { if (panelOpen()) renderDm('', $('#dmPBox'), true); else { if (!location.hash.startsWith('#dm')) toast('💬 새 메시지가 왔어요'); loadRecent(); } } } catch {}
  }, 60000);   // 60초마다 (학생 수가 많을 때 Cloudflare 무료 요청 수 아끼기, 대화창 안은 따로 3~15초)
}

/* ===== 로그인 · 가입 ===== */
// keep: 탭(로그인↔가입)을 바꿀 때 적던 아이디·비밀번호를 그대로 옮겨 줌
const CLS_N = 6;   // 서울영상고는 학년마다 6반까지
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="e-open" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle class="e-open" cx="12" cy="12" r="3"/><path class="e-shut" d="M3.5 9.5Q12 16.5 20.5 9.5M7 13.4 5.4 15.8M12 15.2v2.8M17 13.4l1.6 2.4"/></svg>';
function authHtml(mode = 'login', keep = {}) {
  const c = ctx.getClass?.() || null, up = mode === 'signup';
  const radio = (name, v, txt, on) => `<label class="pchip"><input type="radio" name="${name}" value="${v}" required ${on ? 'checked' : ''}><span>${txt}</span></label>`;
  const grades = [1, 2, 3].map(g => radio('grade', g, g + '학년', c && +c.g === g)).join('');
  const classes = Array.from({ length: CLS_N }, (_, i) => radio('cls', i + 1, i + 1, c && +c.c === i + 1)).join('');
  return `<div class="card authcard" data-mode="${mode}">
    <div class="segs" role="tablist" aria-label="로그인 또는 회원가입"><i class="segs-pill" aria-hidden="true"></i><button type="button" role="tab" aria-selected="${!up}" data-auth="login" class="${up ? '' : 'on'}">로그인</button><button type="button" role="tab" aria-selected="${up}" data-auth="signup" class="${up ? 'on' : ''}">회원가입</button></div>
    <div class="ah"><h2 class="ah-t">${up ? '처음 왔군요! ✨' : '다시 왔네요 👋'}</h2><p class="ah-s">${up ? '1분이면 끝나요 · 이메일·전화번호는 안 받아요' : '아이디와 비밀번호를 적어 주세요.'}</p></div>
    <form class="sform" id="authForm" data-mode="${mode}" autocomplete="on" novalidate>
      <div class="fgrp">${up ? '<p class="fgt"><b>1</b>로그인할 때 쓸 정보</p>' : ''}
      <label><span class="lrow">아이디${up ? '<small class="tag">🔒 나중에 못 바꿔요</small>' : ''}</span><span class="fld at"><span class="pre" aria-hidden="true">@</span><input name="handle" required minlength="3" maxlength="16" pattern="[a-z0-9_.]{3,16}" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="영어 소문자·숫자 3~16자" value="${esc(keep.handle || '')}"><i class="vok" aria-hidden="true">✓</i></span></label>
      <label><span class="lrow">비밀번호${up ? '<span class="pwm" data-lv="0" aria-live="polite"><i></i><i></i><i></i><em>6자 이상</em></span>' : ''}</span><span class="fld"><input name="pw" type="password" required minlength="6" maxlength="64" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="6자 이상" value="${esc(keep.pw || '')}"><button class="eye" type="button" data-eye aria-label="비밀번호 보기" aria-pressed="false">${EYE}</button></span>
        <small class="caps" hidden>⇪ Caps Lock이 켜져 있어요</small></label>
      </div>
      ${up ? `
      <div class="fgrp"><p class="fgt"><b>2</b>친구들에게 보일 정보</p>
        <label><span class="lrow">이름 (닉네임)<small class="cnt" data-cnt>0/20</small></span><input name="name" required maxlength="20" placeholder="언제든 바꿀 수 있어요"></label>
        <div class="apicks"><fieldset class="apick"><legend>학년</legend><div class="pchips g3">${grades}</div></fieldset>
        <fieldset class="apick"><legend>반</legend><div class="pchips g6">${classes}</div><p class="dephint" aria-hidden="true"><span>콘텐츠</span><span>미디어</span><span>프로듀스</span></p></fieldset></div>
        ${S.needCode ? '<label>가입 코드<input name="code" required maxlength="40" placeholder="친구에게 받은 코드"></label>' : ''}
      </div>
      <p class="note">가입 뒤 프로필의 계정 설정에서 구글을 연결하면 비밀번호를 잊어도 찾을 수 있어요</p>` : ''}
      <p class="ferr" role="alert" hidden></p>
      <button class="btn big sbtn" type="submit"><span class="sb-t">${up ? '가입하고 시작하기' : '로그인'}</span><span class="sb-w" aria-hidden="true"><i></i><i></i><i></i></span></button>
      ${!up && S.google ? '<button class="linkbtn" type="button" data-forgot>아이디·비밀번호를 잊었어요</button>' : ''}
      ${up ? '' : '<p class="aswap">아직 계정이 없나요? <button type="button" data-auth="signup">1분 만에 가입하기</button></p>'}
    </form>
    ${S.google ? `<div class="gbox alt"><p class="gor"><span>원하면 구글로도 ${up ? '가입' : '로그인'}할 수 있어요</span></p><div class="gbtn" data-gintent="login"></div></div>` : ''}
    <div class="astamp" aria-hidden="true"><b>입장!</b></div>
  </div>`;
}
const HANDLE_OK = /^[a-z0-9_.]{3,16}$/;
// 폼 안에서 막을 것: 빈 칸·형식 오류를 서버에 보내기 전에 빨간 경고로 (브라우저 기본 말풍선 대신)
function checkForm(f, mode) {
  const el = f.elements, h = el.handle.value.trim();
  if (!h) return ['아이디를 적어 주세요', 'handle'];
  if (mode === 'signup' && !HANDLE_OK.test(h)) return ['아이디는 영어 소문자·숫자·_·. 로 3~16자예요', 'handle'];
  if (!el.pw.value) return ['비밀번호를 적어 주세요', 'pw'];
  if (mode === 'signup' && el.pw.value.length < 6) return ['비밀번호는 6자 이상이에요', 'pw'];
  if (mode === 'signup' && !el.name.value.trim()) return ['친구들에게 보일 이름을 적어 주세요', 'name'];
  if (mode === 'signup' && !f.querySelector('[name=grade]:checked')) return ['학년을 골라 주세요', 'grade'];
  if (mode === 'signup' && !f.querySelector('[name=cls]:checked')) return ['반을 골라 주세요', 'cls'];
  if (el.code && !el.code.value.trim()) return ['가입 코드를 적어 주세요', 'code'];
  return null;
}
function pwLevel(v) {
  if (v.length < 6) return 0;
  return Math.min(3, 1 + (v.length >= 10) + (/\d/.test(v) && /[a-z]/i.test(v) && (/[^a-z0-9]/i.test(v) || /[A-Z]/.test(v) || v.length >= 12)));
}
// 충전 게이지: 칸마다 0~1로 채움. 한 글자씩 칠 때마다 다음 단계 쪽으로 조금씩 참
function pwFill(v) {
  const lv = pwLevel(v), n = v.length;
  if (lv === 3) return 3;
  const kinds = [/\d/, /[a-z]/i, /[^a-z0-9]|[A-Z]/].filter(r => r.test(v)).length;
  const frac = lv === 0 ? n / 6 : lv === 1 ? Math.min(.9, (n - 6) / 4 + .1) : Math.min(.9, .15 + kinds * .25 + Math.max(0, n - 10) * .1);
  return lv + frac;
}
const PW_TXT = ['6자 이상', '보통 · 숫자 섞기', '좋아요 👍', '튼튼해요 💪'];
document.addEventListener('click', e => {
  const t = e.target.closest('[data-auth]'); if (!t) return;
  const card = t.closest('.authcard'), f = card?.querySelector('#authForm');
  if (!card || t.dataset.auth === f?.dataset.mode) return;
  const keep = f ? { handle: f.elements.handle.value, pw: f.elements.pw.value } : {};
  const slot = card.parentElement;
  slot.innerHTML = authHtml(t.dataset.auth, keep);   // 소개 화면 페이지면 그 자리, 내 프로필 화면이면 #meBox 안에서 바꿈
  slot.firstElementChild.classList.add('swap');
  const nf = slot.querySelector('#authForm');
  nf.elements.pw.dispatchEvent(new Event('input', { bubbles: true }));
  [...nf.querySelectorAll('input:not([type=radio])')].find(x => !x.value)?.focus({ preventScroll: true });
});
// 비밀번호 보기 · Caps Lock 안내
document.addEventListener('click', e => {
  const b = e.target.closest('[data-eye]'); if (!b) return;
  const i = b.parentElement.querySelector('input'), on = i.type === 'password';
  i.type = on ? 'text' : 'password'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? '비밀번호 숨기기' : '비밀번호 보기');
  const end = i.value.length; i.focus(); try { i.setSelectionRange(end, end); } catch {}
});
['keydown', 'keyup'].forEach(ev => document.addEventListener(ev, e => {
  if (e.target.name !== 'pw' || !e.target.closest('#authForm') || !e.getModifierState) return;
  e.target.closest('label').querySelector('.caps').hidden = !e.getModifierState('CapsLock');
}));
document.addEventListener('focusout', e => { if (e.target.name === 'pw' && e.target.closest('#authForm')) e.target.closest('label').querySelector('.caps').hidden = true; });
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id !== 'authForm') return;
  e.preventDefault();
  const mode = f.dataset.mode, card = f.closest('.authcard');
  const bad = checkForm(f, mode);
  if (bad) return authErr(f, { message: bad[0], field: bad[1] }, mode);
  const d = Object.fromEntries(new FormData(f));
  d.handle = (d.handle || '').trim().toLowerCase();
  const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.classList.add('busy'); card.classList.add('busy');
  try {
    await call(mode, d);
    await refreshMe();
    if (card.closest('#introAuth')) { card.classList.add('ok'); await new Promise(r => setTimeout(r, 760)); }   // 소개 화면: '입장!' 도장 찍히고 닫힘
    ctx.authed?.(S.me, true, mode);   // 소개 화면이면 닫힘 (가입 때 고른 학년·반은 여기서 이 기기 반 설정으로 들어감)
    renderMe();
    // 가입 직후 창을 연달아 띄우지 않음(2026-10-24): 프로필 꾸미기 창은 자동으로 안 열고, 첫 출석 축하 창 하나만 뜸.
    // 환영 인사는 출석 창이 닫힌 뒤(또는 바로) 짧게
    const hi = () => toast(mode === 'signup' ? `환영해요, ${S.me.name}! 🎉` : `${S.me.name}, 반가워요!`);
    setTimeout(() => { const m = document.querySelector('.modal.open'); if (!m) return hi(); const ob = new MutationObserver(() => { if (!m.classList.contains('open')) { ob.disconnect(); setTimeout(hi, 250); } }); ob.observe(m, { attributes: true, attributeFilter: ['class'] }); }, 1200);
  } catch (err) { authErr(f, err, mode); btn.disabled = false; }
  finally { btn.classList.remove('busy'); card.classList.remove('busy'); }
});
// 로그인·가입 실패: 토스트 대신 폼 안에 빨간 경고 + 틀린 칸 빨간 테두리 (다시 입력하면 사라짐)
function authErr(f, err, mode) {
  const msg = err.message || '문제가 생겼어요', box = f.querySelector('.ferr');
  const hit = err.field ? [err.field] : mode === 'login' && err.status === 401 ? ['handle', 'pw']
    : /아이디/.test(msg) ? ['handle'] : /비밀번호/.test(msg) ? ['pw'] : /코드/.test(msg) ? ['code'] : [];
  f.querySelectorAll('.bad').forEach(x => x.classList.remove('bad'));
  hit.forEach(n => { const x = f.elements[n]; if (x instanceof RadioNodeList) x[0]?.closest('.apick')?.classList.add('bad'); else x?.classList.add('bad'); });
  box.textContent = '⚠️ ' + msg; box.hidden = false;
  f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  const pw = f.elements.pw;
  if (hit.includes('pw') && pw && err.status) { pw.value = ''; pw.dispatchEvent(new Event('input', { bubbles: true })); pw.focus(); }
  else { const x = f.elements[hit[0]]; (x instanceof RadioNodeList ? x[0] : x)?.focus(); }
}
document.addEventListener('input', e => {
  const f = e.target.closest?.('#authForm'); if (!f) return;
  const t = e.target, up = f.dataset.mode === 'signup';
  t.classList.remove('bad'); t.closest('.apick')?.classList.remove('bad');
  if (t.name === 'handle') {   // 아이디: 치는 대로 소문자, 띄어쓰기 없앰 (커서 위치 유지)
    const v = t.value.toLowerCase().replace(/\s+/g, '');
    if (v !== t.value) { const p = t.selectionStart - (t.value.length - v.length); t.value = v; try { t.setSelectionRange(p, p); } catch {} }
    t.closest('.fld').classList.toggle('valid', up && HANDLE_OK.test(v));
  }
  if (t.name === 'name') f.querySelector('[data-cnt]').textContent = `${[...t.value].length}/20`;
  if (t.name === 'pw' && up) { const m = f.querySelector('.pwm'), lv = t.value ? pwLevel(t.value) : 0; const fill = t.value ? pwFill(t.value) : 0; if (lv > +m.dataset.lv) { const seg = m.querySelectorAll('i')[lv - 1]; seg.classList.remove('pop'); void seg.offsetWidth; seg.classList.add('pop'); } m.querySelectorAll('i').forEach((x, k) => x.style.setProperty('--f', Math.max(0, Math.min(1, fill - k)).toFixed(3))); m.dataset.lv = lv; m.classList.toggle('short', !!t.value && !lv); m.querySelector('em').textContent = t.value && !lv ? `${6 - t.value.length}자 더` : PW_TXT[lv]; }
  if (!f.querySelector('.bad')) f.querySelector('.ferr').hidden = true;
});

/* ===== 프로필 카드 ===== */
const STK_POS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'];
function profileHtml(d) {
  const u = d.user, self = d.me;
  const chips = [classTxt(u), u.club && '🎬 ' + u.club].filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('');
  const sk = d.streak || {}, tier = ' t' + ATT.tierOf(sk.cur || 0);
  const streak = !(sk.cur || sk.best) ? '' : `<button type="button" class="pstreak${sk.cur ? tier : ' off'}${sk.pf && sk.cur >= 3 ? ' pf' : ''}" ${self ? 'data-att-open' : ''} data-tip="최고 ${ATT.fmtN(sk.best)}일 · 총 ${sk.total}일 출석${sk.pf && sk.cur >= 3 ? ' · 완벽한 연속' : ''}">${ATT.flame('fsm', { off: !sk.cur, tier: ATT.tierOf(sk.cur || 0) })}<b>${sk.cur >= 1e6 ? '무한 연속 출석' : sk.cur ? `${sk.cur}일 연속 출석` : '연속 출석 쉬는 중'}</b></button>`;
  const ttl = u.title ? `<p class="ptitle${isDev(u) ? ' dev' : ''}"><span>${ui('tag', 'ic')}${esc(u.title)}</span></p>` : '';
  const crowns = (d.crowns || []).map(g => `<span class="crown">${ic('crown')}${esc(GAMES[g]?.name || g)} 1등</span>`).join('');
  const r = d.rel || {};
  const mutual = r.following && r.followsMe;
  const actions = self
    ? isDev(u) ? `<a class="btn" href="/admin/#monitor">🛠 관리자 페이지</a><button class="btn lime" data-act-s="edit">${ic('pencil')}꾸미기</button><button class="btn ghost" data-act-s="logout">로그아웃</button>`   // 개발자: 꾸미기(제한 없음) · 계정 설정 없음
      : S.me?.sw ? ''   // 테스트 계정: 학과 바꾸기·개발자로 돌아가기만(아래 swBar)
      : `<button class="btn" data-act-s="edit">${ic('pencil')}프로필 꾸미기</button><button class="btn ghost icb" data-act-s="settings" aria-label="계정 설정" data-tip="계정 설정"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-gear"/></svg></button>`
    : r.blocked ? `<button class="btn ghost" data-block="${esc(u.handle)}" data-on="0">차단 풀기</button>`
    : `<button class="btn ${r.following ? 'ghost' : ''}" data-follow="${esc(u.handle)}" data-on="${r.following ? 0 : 1}">${r.following ? '팔로잉 ✓' : r.followsMe ? '맞팔로우 하기' : '팔로우'}</button>
       <button class="btn ${(d.canDm ?? mutual) ? 'lime' : 'ghost'}" data-dm="${esc(u.handle)}" ${(d.canDm ?? mutual) ? '' : 'data-locked="1"'}>💬 ${isDev(u) ? '개발자에게 DM' : 'DM'}</button>
       <button class="btn ghost" data-act-s="more" data-h="${esc(u.handle)}" aria-label="더보기">⋯</button>`;
  const bests = Object.entries(GAMES).map(([k, g]) => `<li><span>${ic(g.ic)}</span><small>${g.name}</small><b>${d.bests?.[k] != null ? esc(g.fmt(d.bests[k])) : '-'}</b></li>`).join('');
  return `<article class="pcard c-${esc(u.color)}${isDev(u) ? ' dev' : ''}${u.gcm ? ' gcm' : ''}${!isDev(u) && sk.cur >= 30 ? ' hot' : ''}">${u.pfx === 'r:fxstar' ? pfxStars() : ''}
    <div class="pban" aria-hidden="true">${(u.stickers || []).slice(0, stkMax(u)).map((s, i) => `<i class="stk ${STK_POS[i]}">${emo(s, 'stka')}</i>`).join('')}</div>
    <div class="pbody">
      <div class="phead">
        ${av(u, 'big')}
        <div class="pid">
          ${u.mood ? `<p class="pmood"><span>${esc(u.mood)}</span></p>` : ''}
          <h2 class="pname">${esc(nameOf(u))}${repTag(u)}</h2>${ttl}
          <p class="phandle">${[isDev(u) ? '🛠 SVMHS GROUND 개발자' : esc(atOf(u)), u.online && !self ? '<b class="onl">접속 중</b>' : '', !self && r.followsMe ? '<span class="fm">나를 팔로우함</span>' : ''].filter(Boolean).join(' · ')}</p>
        </div>
        ${actions ? `<div class="pact">${actions}</div>` : ''}
      </div>
      <div class="pcols${!isDev(u) && !u.bio && !crowns && !u.insta ? ' slim' : ''}">
        <div class="pmain">
          ${isDev(u) ? '<button class="pdev" type="button" data-fb>💬 궁금한 점·원하는 기능은 DM으로 편하게 보내 주세요! 팔로우 안 해도 돼요</button>' : ''}
          ${isDev(u) ? '' : u.bio ? `<p class="pbio">${esc(u.bio)}</p>` : self ? '<p class="pbio muted">아직 소개가 없어요. 프로필 꾸미기에서 적어 보세요!</p>' : ''}
          ${chips ? `<p class="pchips">${chips}</p>` : ''}
          ${crowns ? `<p class="pcrowns">${crowns}</p>` : ''}
          ${u.insta ? `<a class="pinsta" href="https://www.instagram.com/${encodeURIComponent(u.insta)}/" target="_blank" rel="noopener noreferrer" aria-label="인스타그램 @${esc(u.insta)} 열기 (새 창)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/></svg>@${esc(u.insta)}<span aria-hidden="true">↗</span></a>` : ''}
        </div>
        <aside class="pside">
          ${streak}
          <div class="pstats"><button data-people="followers" data-h="${esc(u.handle)}"><b>${d.counts.followers}</b>팔로워</button><button data-people="following" data-h="${esc(u.handle)}"><b>${d.counts.following}</b>팔로잉</button></div>
          ${isDev(u) ? '' : `<ul class="pbest" aria-label="게임 최고 기록">${bests}</ul>`}
        </aside>
      </div>
      ${self ? swBar() : ''}
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
    if (on && !confirm(`${atH(b.dataset.block)} 님을 차단할까요?\n서로 팔로우가 끊기고, DM을 주고받을 수 없어요.`)) return;
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
    if (dm.dataset.locked) { toast('이 친구의 DM 설정 때문에 지금은 보낼 수 없어요 (팔로우하면 열릴 수 있어요)'); return; }
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
  sheet(`<h3>${esc(atH(h))}</h3><div class="col">
    <button class="btn ghost" data-report="${esc(h)}">🚨 신고하기</button>
    <button class="btn ghost danger" data-block="${esc(h)}" data-on="1">🚫 차단하기</button>
    <button class="btn ghost" data-close>닫기</button></div>`);
}

/* ===== 프로필 꾸미기 ===== */
// 꾸미기 미리보기 그림 — 실제 프로필 카드(배너 스티커·사진·배경 색·이름 옆 대표 스티커·칭호)와 첫 화면 시계(시계 스티커)를 작게
// data-pv: 어떤 설정이 바꾸는 부분인지(av·co·st·rep·deco·name·title) → 바뀐 곳만 반짝
function pvHtml(u, st) {
  const dev = isDev(u), col = ALL_COLORS.includes(st.color) ? st.color : 'sky', fx = S.me?.gc?.fx || {};
  const t = new Date(), hm = `${t.getHours() % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')}`;
  const stk = st.stickers.slice(0, st.max).map((v, i) => `<i class="stk ${STK_POS[i]}">${emo(v, 'stka')}</i>`).join('');
  const dk = st.deco.map((v, i) => `<i class="pv-dk k${i + 1}">${artOf(v, 'pka')}</i>`).join('');
  // 켜 둔 뽑기 효과(전설·시크릿): 미리보기에도 그대로 + 무엇이 켜져 있는지 칩으로(끄는 곳 안내)
  const fxOn = Object.keys(FX).filter(k => fx[k]).map(k => `<span class="pv-fx" data-tip="${esc(FX[k])} · 서비스 › 뽑기 › 내 효과에서 켜고 꺼요">${artOf(fx[k], 'pka')}${esc(objName(fx[k]))}</span>`).join('');
  return `<div class="pv-top"><b>미리보기</b><small>${dev ? '고른 그대로예요 · 개발자 계정은 실제로 G 로고로 보여요' : '친구들에게 이렇게 보여요'}</small><button type="button" class="pv-clr" data-clr="all" data-tip="카드·대표·시계 스티커를 한 번에 떼요 · 저장해야 반영돼요">${ui('peel', 'ic')}스티커 전부 떼기</button><button type="button" class="pv-fold" data-pv-fold aria-label="미리보기 접기·펴기"><span class="o">접기</span><span class="c">펴기</span></button></div>
    <div class="pv-body">
      <div class="pv-card c-${esc(col)}" data-pv="co">
        <div class="pban" data-pv="st co">${stk || '<span class="pv-hint">카드 스티커가 여기 붙어요</span>'}</div>
        <div class="pv-id">
          <span class="av big c-${esc(col)}" data-pv="av co">${emo(st.avatar || 'k:cat', 'ava')}</span>
          <div class="pv-nm"><p class="pv-name" data-pv="name rep">${esc(dev ? '개발자' : st.name)}${repTag({ rep: st.rep, nfx: fx.name })}</p>${st.title ? `<p class="ptitle${dev ? ' dev' : ''}" data-pv="title"><span>${ui('tag', 'ic')}${esc(st.title)}</span></p>` : '<p class="pv-sub" data-pv="title">칭호 없음</p>'}</div>
        </div>
      </div>
      <div class="pv-clk${fx.clock === 'r:fxneon' ? ' neon' : ''}" data-pv="deco"><span class="pv-tm">${hm}</span><small>첫 화면 시계 · ${st.deco.length}/${st.slots}칸</small>${dk}</div>
    </div>
    ${fxOn ? `<div class="pv-fxs"><small>켜 둔 뽑기 효과</small>${fxOn}</div>` : ''}
    ${fx.clock === 'r:fxneon' ? `<div class="pv-neon"><small>네온 색</small>${neonPick(neonC())}</div>` : ''}`;
}
// 메뉴의 '꾸미기': 내 프로필로 가서 바로 꾸미기 창
document.getElementById('btnEdit')?.addEventListener('click', () => { if (!S.me) return; if (location.hash !== '#me') location.hash = 'me'; setTimeout(openEdit, 60); });
function openEdit() {
  const u = S.me; if (!u) return;
  const picked = new Set(u.stickers || []);
  const deco = [...(u.deco || [])], slots = isDev(u) ? 5 : decoSlots(u.attBest, u.attTotal);
  sheet(`<h3>프로필 꾸미기</h3>
    <form class="sform" id="editForm" autocomplete="off">
      <div class="pv${store.get('pv_fold', 0) ? ' fold' : ''}" id="edPrev" aria-live="polite"></div>
      <label>이름 (닉네임)<input name="name" maxlength="20" required value="${esc(u.name)}"><small class="hint">${isDev(u) ? '🛠 개발자 계정은 이름·아이디 대신 어디서나 \'개발자\'로 표시돼요.' : `친구들에게 보이는 이름이에요. 로그인은 아이디 @${esc(u.handle)}로 해요.`}</small></label>
      <label>상태 메시지<input name="mood" maxlength="24" placeholder="예: 시험 끝나면 놀자🔥" value="${esc(u.mood)}"></label>
      <label>소개<textarea name="bio" maxlength="80" rows="3" placeholder="나를 한 줄로 소개해 보세요">${esc(u.bio)}</textarea></label>
      ${isDev(u) ? '<input type="hidden" name="grade" value="0"><input type="hidden" name="cls" value="0"><p class="hint">🛠 개발자 계정은 학년·반이 표시되지 않아요.</p>' : `<div class="two"><label>학년<select name="grade"><option value="0">비공개</option>${[1, 2, 3].map(g => `<option value="${g}" ${u.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label>
        <label>반<select name="cls"><option value="0">비공개</option>${Array.from({ length: CLS_N }, (_, i) => `<option value="${i + 1}" ${u.cls === i + 1 ? 'selected' : ''}>${i + 1}반</option>`).join('')}</select></label></div>`}
      <label>인스타 아이디 (선택)<span class="fld at ig"><span class="pre" aria-hidden="true">@</span><input name="insta" maxlength="60" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="예: svmhs_ground" value="${esc(u.insta || '')}"></span><small class="hint">적으면 프로필에 버튼이 생기고, 누르면 내 인스타로 가요. 비워 두면 안 보여요.</small></label>
      <label>동아리<input name="club" maxlength="16" placeholder="예: 영상제작부" value="${esc(u.club)}"></label>
      <div class="pk-view" role="group" aria-label="꾸미기 목록 보기"><span>꾸미기 목록</span><div class="pk-seg">${[['all', '모두 보기'], ['own', '보유한 것만 보기']].map(([k, n]) => `<button type="button" data-view="${k}" class="${pkView() === k ? 'on' : ''}" aria-pressed="${pkView() === k}">${n}</button>`).join('')}</div></div>
      ${pkSec('프로필 사진', '내 프로필 · 친구 목록 · DM · 랭킹에 보이는 내 얼굴', '')}
      <div class="pick" id="pAv">${pkDiv('기본')}${AVATARS.map(a => `<button type="button" data-v="${a}" class="${a === u.avatar ? 'on' : ''}" data-tip="${kavName(a)}" aria-label="${kavName(a)}">${emo(a)}</button>`).join('')}${attDiv('avatar')}${attPicks('avatar', x => x === u.avatar)}</div></section>
      ${pkSec('배경 색', '프로필 사진 뒤 동그라미 · 프로필 카드 윗부분 색', '')}
      <div class="pick sw" id="pCo">${pkDiv('기본')}${COLORS.map(c => `<button type="button" data-v="${c}" class="c-${c} ${c === u.color ? 'on' : ''}" data-tip="${COLOR_KO[c] || c}" aria-label="${COLOR_KO[c] || c}"></button>`).join('')}${attDiv('color')}${attPicks('color', x => x === u.color)}</div></section>
      ${isDev(u) ? `<label>칭호 <small class="att-sm">개발자 전용 · 직접 쓰기</small><input name="title" maxlength="12" value="${esc(u.title || '')}" placeholder="예: 그라운드 주인"><small class="hint">개발자는 칭호를 마음대로 적을 수 있어요(12자). 무지개 칭호로 보여요.</small></label>` : `<label>칭호 <small class="att-sm">${ATT.flame('fsm', { tier: 1 })}출석 보상</small><select name="title">${titleOpts(u.title)}</select><small class="hint">프로필 이름 아래와 출석 순위에 보여요. 출석할수록 더 열려요.</small></label>`}
      ${pkSec('프로필 카드 스티커', '내 프로필 카드 윗부분(별 배경)에 붙어요 · 여러 개 고르기', `<b id="stkN">${picked.size}/${stkMax(u)}</b><button type="button" class="pk-clr" data-clr="st">모두 떼기</button>`)}
      <div class="pick" id="pSt">${pkDiv('기본')}${STICKERS.map(s => `<button type="button" data-v="${s}" class="${picked.has(s) ? 'on' : ''}" data-tip="${EMO_NAME[s] || s}" aria-label="${EMO_NAME[s] || s}">${s}</button>`).join('')}${attDiv('sticker')}${attPicks('sticker', x => picked.has(x))}</div></section>
      ${`${pkSec('대표 스티커', '이름 바로 옆에 작게 붙어요 · 댓글 · 랭킹 · DM · 친구 목록 어디서나', `<b>${isDev(u) ? '3개까지' : '1개'}</b><button type="button" class="pk-clr" data-clr="rep">떼기</button>`)}
      <div class="pick" id="pRep"><button type="button" data-v="" class="att-none ${u.rep ? '' : 'on'}" data-tip="대표 스티커 안 달기">없음</button>${attDiv('sticker')}${attPicks('sticker', x => String(u.rep || '').split(',').includes(x))}</div></section>
      ${pkSec('첫 화면 시계 스티커', '내 첫 화면 큰 시계 둘레에 붙어요 · 나만 보여요', '<b id="decoN"></b><button type="button" class="pk-clr" data-clr="deco">모두 떼기</button>')}
      <div class="pick" id="pDeco">${attDiv('sticker')}${attPicks('sticker', x => deco.includes(x))}</div>
      <small class="hint">칸은 연속 14일·총 30일 출석으로 하나씩 늘어나요.</small></section>`}
      <p class="hint att-hint">불꽃 칸 색이 칠해진 건 출석 보상이에요. 헤더의 불꽃 버튼에서 기록과 받는 방법을 볼 수 있어요.</p>
      <div class="row"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" data-close>취소</button></div>
    </form>`);
  pkApply();
  $('#editForm .pk-seg').onclick = e => { const b = e.target.closest('[data-view]'); if (!b) return; store.set('edit_view', b.dataset.view); pkApply(); };
  const sel = { avatar: u.avatar, color: u.color, rep: u.rep || '' };
  // 실시간 미리보기: 고르는 즉시 프로필 카드·이름 옆·시계에 어떻게 붙는지 보여 줌(바뀐 곳은 반짝)
  $('#socSheet').classList.add('edw');   // 꾸미기 창은 미리보기가 잘 보이게 넓게
  const F = $('#editForm');
  let clrSync = () => {};
  const prev = part => {
    const box = $('#edPrev'); if (!box) return;
    box.innerHTML = pvHtml(u, { ...sel, stickers: [...picked], deco, name: F.elements.name.value.trim() || u.name, title: F.elements.title?.value || '', max: stkMax(u), slots });
    if (part) part.split(' ').forEach(pt => box.querySelectorAll(`[data-pv~="${pt}"]`).forEach(x => { x.classList.remove('pv-hit'); void x.offsetWidth; x.classList.add('pv-hit'); }));
    clrSync();
  };
  prev();
  F.elements.name.addEventListener('input', () => prev('name'));
  F.elements.title?.addEventListener(F.elements.title.tagName === 'SELECT' ? 'change' : 'input', () => prev('title'));
  $('#edPrev').addEventListener('click', e => { if (e.target.closest('[data-clr]')) return clearStk('all'); if (!e.target.closest('[data-pv-fold]')) return; const f = !$('#edPrev').classList.contains('fold'); $('#edPrev').classList.toggle('fold', f); store.set('pv_fold', f ? 1 : 0); });
  $('#pAv').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.lock) { toast(lockMsg(b)); return; } $$('#pAv .on').forEach(x => x.classList.remove('on')); b.classList.add('on'); sel.avatar = b.dataset.v; prev('av'); };
  $('#pCo').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.lock) { toast(lockMsg(b)); return; } $$('#pCo .on').forEach(x => x.classList.remove('on')); b.classList.add('on'); sel.color = b.dataset.v; prev('co'); };
  $('#pSt').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lock) { toast(lockMsg(b)); return; }
    if (picked.has(b.dataset.v)) picked.delete(b.dataset.v);
    else if (picked.size >= stkMax(u)) { toast(`스티커는 ${stkMax(u)}개까지!`); return; }
    else picked.add(b.dataset.v);
    b.classList.toggle('on', picked.has(b.dataset.v)); $('#stkN').textContent = `${picked.size}/${stkMax(u)}`; prev('st');
  };
  // 대표 스티커(하나) · 시계 스티커(칸 수만큼, 고른 순서대로 왼쪽 위 → 오른쪽 아래 → 오른쪽 위)
  const lockTip = b => toast(lockMsg(b));
  const decoN = () => { const el = $('#decoN'); if (el) el.textContent = `${deco.length}/${slots}칸`; };
  decoN();
  // 대표 스티커: 보통 1개(누르면 바꿈), 개발자는 3개까지 골라 붙임
  const repMax = isDev(u) ? 3 : 1;
  if ($('#pRep')) $('#pRep').onclick = e => {
    const b = e.target.closest('button'); if (!b) return; if (b.dataset.lock) return lockTip(b);
    let cur = sel.rep ? sel.rep.split(',') : [];
    if (!b.dataset.v) cur = [];
    else if (cur.includes(b.dataset.v)) cur = cur.filter(x => x !== b.dataset.v);
    else if (repMax === 1) cur = [b.dataset.v];
    else if (cur.length >= repMax) { toast(`대표 스티커는 ${repMax}개까지!`); return; }
    else cur.push(b.dataset.v);
    sel.rep = cur.join(',');
    $$('#pRep button').forEach(x => x.classList.toggle('on', x.dataset.v ? cur.includes(x.dataset.v) : !cur.length)); prev('rep');
  };
  if ($('#pDeco')) $('#pDeco').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lock) return lockTip(b);
    const i = deco.indexOf(b.dataset.v);
    if (i >= 0) deco.splice(i, 1);
    else if (deco.length >= slots) { toast(slots < 3 ? `지금은 ${slots}칸까지! 연속 14일·총 30일 출석하면 칸이 늘어나요` : '시계 스티커는 3개까지!'); return; }
    else deco.push(b.dataset.v);
    b.classList.toggle('on', deco.includes(b.dataset.v)); decoN(); prev('deco');
  };
  // 스티커 한 번에 떼기 — 칸마다 '모두 떼기' + 미리보기 '스티커 전부 떼기'(카드·대표·시계). 저장 전까지는 취소로 되돌릴 수 있음
  clrSync = () => {
    const has = { st: picked.size > 0, rep: !!sel.rep, deco: deco.length > 0 };
    $$('#editForm .pk-clr').forEach(b => { b.disabled = !has[b.dataset.clr]; });
    const all = $('#edPrev .pv-clr'); if (all) all.disabled = !(has.st || has.rep || has.deco);
  };
  const clearStk = k => {
    const parts = [];
    if ((k === 'st' || k === 'all') && picked.size) { picked.clear(); $$('#pSt .on').forEach(x => x.classList.remove('on')); $('#stkN').textContent = `0/${stkMax(u)}`; parts.push('st'); }
    if ((k === 'rep' || k === 'all') && sel.rep) { sel.rep = ''; $$('#pRep button').forEach(x => x.classList.toggle('on', !x.dataset.v)); parts.push('rep'); }
    if ((k === 'deco' || k === 'all') && deco.length) { deco.length = 0; $$('#pDeco .on').forEach(x => x.classList.remove('on')); decoN(); parts.push('deco'); }
    if (!parts.length) return;
    prev(parts.join(' ')); toast(k === 'all' ? '스티커를 전부 뗐어요 · 저장하면 반영돼요' : '뗐어요 · 저장하면 반영돼요');
  };
  F.addEventListener('click', e => { const b = e.target.closest('.pk-clr'); if (b) clearStk(b.dataset.clr); });
  clrSync();
  // 인스타 아이디: 앞의 @는 칸에 붙은 고정 글자(.pre)라 지울 수 없음 — 직접 친 @·붙여 넣은 인스타 주소는 아이디만 남김
  const ig = $('#editForm [name=insta]');
  ig.oninput = () => {
    let v = ig.value.replace(/^\s+/, '');
    if (/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(v)) v = v.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '');
    v = v.replace(/^@+/, '');
    if (v !== ig.value) ig.value = v;
  };
  ig.oninput();
  $('#editForm').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      await call('me', { ...d, grade: +d.grade, cls: +d.cls, avatar: sel.avatar, color: sel.color, stickers: [...picked], rep: sel.rep, deco });
      await refreshMe(); ctx.adoptClass?.(S.me, true); closeSheet(); renderMe(); toast('프로필을 저장했어요 ✨');
    } catch (err) { fail(err); }
  };
}

// 출석 보상 칸: 해금된 건 고를 수 있고, 아직이면 흐리게 + 자물쇠(누르면 필요한 일수 안내)
const attHave = r => r.by === 'gacha' ? !!S.me?.gc?.own?.[r.v] : rwOn(r, S.me?.attBest || 0, S.me?.attTotal || 0);
// 스티커 = 출석 보상 스티커 + 뽑기 스티커(by 'gacha')
// 뽑기에서 빠진 스티커(GACHA_OLD)는 이미 가진 사람에게만 보임 — 더는 못 얻는 걸 잠금으로 보여 주지 않음(개발자도 '전부 보유'는 현재 뽑기 목록 기준)
const GC_ITEMS = [...GACHA, ...GACHA_OLD].filter(g => !g.fx).map(g => ({ ...g, by: 'gacha', kind: 'sticker' }));
const gcList = () => GC_ITEMS.filter(g => !GACHA_OLD.some(o => o.v === g.v) || S.me?.gc?.own?.[g.v]);
const rwList = kind => kind === 'sticker' ? [...ATT.lockedOf('sticker'), ...gcList()] : ATT.lockedOf(kind);
const lockMsg = b => b.dataset.by === 'gacha' ? '뽑기에서 나오는 스티커예요 — 서비스 › 뽑기에서 뽑아 보세요' : `${b.dataset.by === 'total' ? '총 출석' : '연속 출석'} ${b.dataset.lock}일을 달성하면 열려요 🔥`;
// 꾸미기 목록 보기: 모두 보기 / 보유한 것만 보기 (이 기기에 기억 edit_view)
const pkView = () => store.get('edit_view', 'all') === 'own' ? 'own' : 'all';
// 꾸미기 한 묶음(카드): 큰 제목 + '어디에 쓰여요' 한 줄 + 오른쪽 개수 — </section>은 부르는 쪽에서 닫음
const pkSec = (t, use, right) => `<section class="pk-sec"><div class="pk-hd"><p class="pk-t">${t}</p>${right ? `<span class="pk-n">${right}</span>` : ''}<p class="pk-use"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="9.6" r="2.4" fill="currentColor"/></svg>${use}</p></div>`;
const pkDiv = (t, extra = '') => `<p class="pk-div${extra}">${t}</p>`;
// 출석 보상 구분선: 받은 개수 / 전체 + '보유한 것만'일 때 받은 게 없으면 안내
function attDiv(kind) {
  const all = ATT.lockedOf(kind), n = all.filter(attHave).length;
  return pkDiv(`${ATT.flame('fsm', { tier: 1 })}출석 보상 <small>${n}/${all.length} 받음</small><span class="pk-none">아직 받은 보상이 없어요 · 출석하면 열려요</span>`, n ? '' : ' zero');
}
function pkApply() {
  const f = $('#editForm'); if (!f) return;
  const own = pkView() === 'own';
  f.classList.toggle('own-only', own);
  $$('#editForm .pk-seg [data-view]').forEach(b => { const on = b.dataset.view === pkView(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $$('#editForm select[name=title] option:disabled').forEach(o => { o.hidden = own; });
}
// 뽑기 스티커 구분선 (스티커 목록에서 출석 보상 뒤)
function gcDiv() {
  const L = gcList(), n = L.filter(attHave).length;
  return pkDiv(`뽑기 스티커 <small>${n}/${L.length} 뽑음</small><span class="pk-none">아직 뽑은 스티커가 없어요 · 서비스 › 뽑기</span>`, n ? '' : ' zero');
}
function attPicks(kind, isOn) {
  return rwList(kind).map(r => {
    const gc = r.by === 'gacha';
    const tip = gc ? `뽑기 ${RAR[r.rar].n} · ${objName(r.v)}` : `${r.by === 'total' ? '총 출석' : '연속 출석'} ${r.d}일 보상 · ${kind === 'color' ? COLOR_NAME[r.v] : objName(r.v)}`;
    const inner = kind === 'color' ? '' : artOf(r.v, 'pka');
    return (r === GC_ITEMS[0] ? gcDiv() : '') + (attHave(r)
      ? `<button type="button" data-v="${r.v}" class="att-pk${kind === 'color' ? ' c-' + r.v : ''} ${isOn(r.v) ? 'on' : ''}" data-tip="${tip}" aria-label="${tip}">${inner}</button>`
      : `<button type="button" class="att-pk lock${kind === 'color' ? ' c-' + r.v : ''}" data-lock="${gc ? 'g' : r.d}" data-by="${r.by}" data-tip="🔒 ${tip}" aria-label="${tip} (잠김)">${inner}<span class="pk-lk">${ui('lock')}</span><i>${gc ? '뽑기' : r.d}</i></button>`);
  }).join('');
}
// 스티커 고르기 작은 창 (DM·밸런스 댓글 공용) — 받은 출석 보상 스티커만. 고르면 onPick('r:이름')
function stkTray(btn, onPick) {
  const old = $('.stk-tray'); if (old) { const same = old._btn === btn; old.remove(); if (same) return; }
  if (!S.me) { toast('로그인하면 쓸 수 있어요'); return; }
  const have = rwList('sticker').filter(attHave), next = ATT.lockedOf('sticker').find(r => !attHave(r));
  const t = document.createElement('div');
  t.className = 'stk-tray'; t._btn = btn; t.setAttribute('role', 'dialog'); t.setAttribute('aria-label', '스티커 고르기');
  t.innerHTML = have.length
    ? `<div class="stk-grid">${have.map(r => `<button type="button" data-v="${r.v}" aria-label="스티커 보내기">${artOf(r.v, 'pka')}</button>`).join('')}</div>${next ? `<small>${next.by === 'total' ? '총' : '연속'} ${next.d}일 출석하면 하나 더!</small>` : ''}`
    : `<p>${ATT.flame('fsm', { tier: 1 })} 출석 보상으로 받은 스티커를 보낼 수 있어요.<br><b>${next.by === 'total' ? '총' : '연속'} ${next.d}일</b> 출석하면 첫 스티커!</p>`;
  btn.parentElement.append(t);
  const close = ev => { if (!t.isConnected) return off(); if (ev.type === 'keydown' ? ev.key === 'Escape' : !t.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) { t.remove(); off(); } };
  const off = () => { document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', close, true); };
  setTimeout(() => { document.addEventListener('pointerdown', close, true); document.addEventListener('keydown', close, true); });
  t.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; t.remove(); off(); onPick(b.dataset.v); };
}
function titleOpts(cur) {
  const have = ATT.lockedOf('title').filter(attHave), gcT = gcDone(S.me?.gc?.own);   // 뽑기 시리즈 완성 칭호
  return `<option value="">없음</option>${have.map(r => `<option value="${esc(r.v)}" ${r.v === cur ? 'selected' : ''}>${esc(r.v)}</option>`).join('')}${gcT ? `<option value="${esc(GC_TITLE)}" ${GC_TITLE === cur ? 'selected' : ''}>${esc(GC_TITLE)}</option>` : `<option disabled>🔒 ${esc(GC_TITLE)} (뽑기 시리즈 완성)</option>`}${ATT.lockedOf('title').filter(r => !attHave(r)).map(r => `<option disabled>🔒 ${esc(r.v)} (${r.by === 'total' ? '총' : '연속'} ${r.d}일)</option>`).join('')}`;
}

/* ===== 계정 설정 ===== */
/* ----- 개발자: 학과별 테스트 계정으로 바꿔 보기 (콘 1반 · 미 3반 · 프 5반, 2학년) ----- */
const SW = [['con', '콘텐츠과'], ['mi', '미디어과'], ['pro', '프로듀스과']];
const swBar = () => !S.me?.sw ? '' : `<div class="swbar"><p>🧪 학과별로 보기 ${S.me.sw === 'dev' ? '' : `<b>· 지금 ${esc(SW.find(x => x[0] === S.me.sw)?.[1] || '')} 테스트 계정</b>`}</p>
  <div class="swbtns">${SW.map(([k, n]) => `<button class="btn ${S.me.sw === k ? '' : 'ghost'}" type="button" data-sw="${k}" ${S.me.sw === k ? 'disabled' : ''}>${n}</button>`).join('')}</div>
  ${S.me.sw === 'dev' ? '' : '<button class="btn lime" type="button" data-sw="back">🛠 개발자로 돌아가기</button>'}</div>`;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-sw]'); if (!b) return;
  b.disabled = true;
  try {
    const fromDev = S.me?.sw === 'dev', r = await call('dev-switch', { to: b.dataset.sw });
    // 시간표가 그 반으로 보이게 이 기기의 반 설정도 바꿈 (개발자로 돌아가면 원래 반 설정으로)
    if (fromDev) store.set('class_dev', store.get('class', null));
    if (b.dataset.sw === 'back') { const c = store.get('class_dev', null); if (c) store.set('class', c); else localStorage.removeItem('sg_class'); }
    else store.set('class', { g: String(r.grade), c: String(r.cls) });
    location.assign('/');   // 첫 화면(시간표)에서 바로 확인
  } catch (x) { toast(x.message); b.disabled = false; }
});
async function doLogout() { try { await call('logout', {}); } catch {} S.me = null; S.unread = 0; paintBadges(); closeSheet(); renderMe(); ctx.authed?.(null); toast('로그아웃했어요'); }
function openSettings() {
  sheet(`<h3>계정 설정</h3>
    <form class="sform" id="pwForm"><p class="lbl">비밀번호 바꾸기</p>
      <input name="old" type="password" placeholder="지금 비밀번호" required autocomplete="current-password">
      <input name="pw" type="password" placeholder="새 비밀번호 (6자 이상)" minlength="6" maxlength="64" required autocomplete="new-password">
      <button class="btn ghost" type="submit">비밀번호 바꾸기</button></form>
    <p class="lbl">💬 DM 받는 범위</p>
    <div class="segs fbk" id="dmPref">${[['0', '서로 팔로우한 친구만'], ['1', '나를 팔로우한 사람'], ['2', '누구나']].map(([v, t]) => `<label><input type="radio" name="dmp" value="${v}" ${String(S.me?.dmPref || 0) === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
    ${S.google && !S.me?.sw ? `<p class="lbl">🔗 구글 계정</p>${S.me?.google ? '<p class="note">✅ 구글 계정이 연결돼 있어요. 비밀번호를 잊어도 구글로 로그인할 수 있어요.</p><form class="sform" id="gUnlinkForm"><input type="password" id="gPw" placeholder="지금 비밀번호 (본인 확인)" maxlength="64" autocomplete="current-password"><button class="btn ghost" type="submit">연결 해제</button></form>' : '<p class="note">연결해 두면 비밀번호를 잊어도 구글로 로그인할 수 있어요. 지금 비밀번호를 적고 구글 버튼을 눌러 주세요.</p><div class="sform"><input type="password" id="gPw" placeholder="지금 비밀번호 (본인 확인)" maxlength="64" autocomplete="current-password"></div><div class="gbtn" data-gintent="link"></div>'}` : ''}
    <p class="lbl">차단한 사람</p><ul class="plist" id="blkList"><li class="skel"></li></ul>
    <div class="col">${S.me?.handle === ADMIN_HANDLE ? '<a class="btn" href="/admin/">🛠 관리자 페이지</a>' : ''}<button class="btn ghost" id="btnLogout">로그아웃</button><button class="btn ghost" id="btnLogoutAll" title="학교 태블릿 등에 로그인을 두고 왔을 때">모든 기기에서 로그아웃</button><button class="btn ghost danger" id="btnWithdraw">탈퇴하기</button><button class="btn ghost" data-close>닫기</button></div>`);
  call('blocked').then(r => {
    $('#blkList').innerHTML = r.users.length ? r.users.map(u => personRow(u, `<button class="fbtn" data-block="${esc(u.handle)}" data-on="0">풀기</button>`)).join('') : '<li class="empty">없어요</li>';
  }).catch(() => { $('#blkList').innerHTML = ''; });
  $('#pwForm').onsubmit = async e => {
    e.preventDefault();
    try { await call('password', Object.fromEntries(new FormData(e.target))); toast('비밀번호를 바꿨어요'); e.target.reset(); } catch (err) { fail(err); }
  };
  $('#btnLogout').onclick = doLogout;
  $('#btnLogoutAll').onclick = async () => {
    if (!confirm('이 기기를 포함해 로그인된 모든 기기에서 로그아웃할까요?')) return;
    try { await call('logout-all', {}); } catch (x) { return toast(x.message); }
    S.me = null; S.unread = 0; paintBadges(); closeSheet(); renderMe(); ctx.authed?.(null); toast('모든 기기에서 로그아웃했어요');
  };
  $('#dmPref').onchange = async e => { try { const r = await call('dmpref', { pref: +e.target.value }); S.me.dmPref = r.dmPref; toast('DM 받는 범위를 바꿨어요'); } catch (x) { toast(x.message); } };
  if ($('#gUnlinkForm')) $('#gUnlinkForm').onsubmit = async e => { e.preventDefault(); if (!confirm('구글 계정 연결을 해제할까요? 그 뒤로는 아이디·비밀번호로만 로그인해요.')) return; try { await call('google-link', { off: true, pw: $('#gPw').value }); S.me.google = false; toast('연결을 해제했어요'); openSettings(); } catch (x) { toast(x.message); } };
  $('#btnWithdraw').onclick = async () => {
    if (S.me?.google && S.google && confirm('정말 탈퇴할까요? 프로필·팔로우·DM·게임 기록이 모두 지워지고 되돌릴 수 없어요.\n구글로 가입했다면 [확인] 후 구글 버튼으로 본인 확인을 해 주세요. (비밀번호로 하려면 [취소])')) {
      sheet('<h3>탈퇴 본인 확인</h3><p class="note">연결된 구글 계정으로 확인하면 바로 탈퇴돼요.</p><div class="gbtn" data-gintent="withdraw"></div><div class="row"><button class="btn ghost" data-close>취소</button></div>');
      return;
    }
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
      <span class="pi"><b>${esc(nameOf(t.user))}${repTag(t.user)}</b><small>${t.mine ? '나: ' : ''}${stkOf(t.last) ? '스티커를 보냈어요' : esc(t.last)}</small></span>
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
  const sk = !m.del && stkMsg(m.body);
  return `<li class="msg ${m.mine ? 'me' : 'you'} ${m.del ? 'del' : ''}${sk ? ' stk' : ''}" data-id="${m.id}">
    <span class="bb">${m.del ? '삭제된 메시지' : sk || esc(m.body)}</span>
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
    <div class="chead"><a ${toList(panel)} class="back" aria-label="DM 목록">‹</a><a href="#u/${esc(d.user.handle)}" class="who">${av(d.user)}<span class="pi"><b>${esc(nameOf(d.user))}${devTag(d.user)}</b><small>${d.user.online ? '접속 중' : esc(atOf(d.user))}</small></span></a></div>
    <ol class="msgs" id="msgs" aria-live="polite">${msgs.length >= 40 ? '<li class="older"><button id="olderBtn">이전 메시지 보기</button></li>' : ''}</ol>
    ${d.canSend ? `<form class="compose" id="dmForm" autocomplete="off"><button class="stk-btn" type="button" id="dmStk" aria-label="스티커 보내기" data-tip="스티커">${ui('sparkle', 'ic')}</button><textarea id="dmIn" rows="1" maxlength="500" placeholder="메시지 보내기…" aria-label="메시지"></textarea><button class="btn" aria-label="보내기">➤</button></form>`
      : `<p class="note locked">${d.rel.blocked ? '차단한 사람이에요' : '이 친구의 DM 설정 때문에 지금은 보낼 수 없어요'}</p>`}
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
    const send = async (text, keep) => {
      try { const r = await call('dm/' + encodeURIComponent(handle), { body: text }); if (!msgs.some(m => m.id === r.message.id)) msgs.push(r.message); paint(); dmDelay = 3000; }
      catch (err) { fail(err); if (keep) inp.value = text; }
    };
    form.onsubmit = async e => {
      e.preventDefault();
      const text = inp.value.trim(); if (!text) return;
      inp.value = ''; grow();
      await send(text, true);
      inp.focus();
    };
    q('#dmStk').onclick = e => stkTray(e.currentTarget, v => send('::' + v));
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
      <p class="gem">${ic(g.ic)}</p><h3>${g.name}</h3><p class="gdesc">${g.desc}</p>
      ${x ? `<div class="gstat"><span>내 최고 기록<b>${x.best != null ? esc(g.fmt(x.best)) : '-'}</b></span><span>내 순위<b>${x.rank != null ? x.rank + '위' : '-'}</b></span></div>
        <p class="gtop">${ic('crown')}${x.top ? `1등 <a href="#u/${esc(x.top.handle)}">${av(x.top, 'xs')} ${esc(x.top.name)}</a> ${esc(g.fmt(x.top.value))}` : '1등 자리가 비어 있어요!'}</p>` : ''}
      <div class="gbtns"><button class="btn big" data-play="${k}">${ic('play')}플레이</button><button class="btn ghost" data-rank="${k}">${ic('trophy')}랭킹</button></div>
    </article>`;
  }).join('')}</div>
  ${S.me ? '' : '<p class="note center">로그인하면 기록이 랭킹에 올라가고 반 대항전에 참여해요!</p>'}`;
}

async function openRank(game, scope = 'all') {
  if (S.enabled === false) { toast('랭킹을 준비하고 있어요'); return; }
  if (!S.me) { toast('랭킹은 로그인하면 볼 수 있어요'); ctx.go('me'); return; }
  const g = GAMES[game];
  const tabs = [['all', '전체'], ['friends', '친구'], ['class', '반 대항전']].map(([k, t]) => `<button data-rank="${game}" data-scope="${k}" class="${k === scope ? 'on' : ''}">${t}</button>`).join('');
  sheet(`<h3>${ic(g.ic)} ${g.name} 랭킹</h3><div class="segs">${tabs}</div><ol class="rank" id="rankList"><li class="skel"></li><li class="skel"></li></ol>
    <p class="note" id="rankNote"></p><div class="row"><button class="btn" data-play="${game}">${ic('play')}도전하기</button><button class="btn ghost" data-close>닫기</button></div>`);
  try {
    const r = await call(`rank?game=${game}&scope=${scope}`);
    const medal = i => i < 3 ? `<i class="mdl m${i + 1}">${i + 1}</i>` : i + 1;   // 1~3등 금·은·동 배지 (이모지 대신)
    if (scope === 'class') {
      $('#rankList').innerHTML = r.list.length ? r.list.map((c, i) => `<li class="${r.mine && r.mine.grade === c.grade && r.mine.cls === c.cls ? 'me' : ''}"><span class="rk">${medal(i)}</span><span class="pi"><b>${c.grade}학년 ${c.cls}반</b><small>${c.players}명 참가</small></span><b class="rv">${esc(g.fmt(c.value))}</b></li>`).join('')
        : '<li class="empty">아직 아무 반도 기록이 없어요</li>';
      $('#rankNote').textContent = '반마다 최고 기록 상위 3명의 평균이에요. 프로필에 학년·반을 적어야 반 점수에 들어가요.';
    } else {
      $('#rankList').innerHTML = r.list.length ? r.list.map((u, i) => `<li class="${u.isMe ? 'me' : ''}"><span class="rk">${medal(i)}</span><a href="#u/${esc(u.handle)}" data-u="1">${av(u)}<span class="pi"><b>${esc(nameOf(u))}${devTag(u)}</b><small>${esc(classTxt(u) || atOf(u))}</small></span></a><b class="rv">${esc(g.fmt(u.value))}</b></li>`).join('')
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
function stage(title, html, wide = false) {
  const el = $('#gamePlay');
  el.innerHTML = `<div class="ptop${wide ? ' wide' : ''}"><b>${title}</b><button class="iconbtn" id="pQuit" data-tip="그만하기" data-tip-end aria-label="그만하기">✕</button></div><div class="parea${wide ? ' wide' : ''}" id="parea">${html}</div>`;
  el.hidden = false; document.body.classList.add('playing');
  $('#pQuit').onclick = endPlay;
  return $('#parea');
}
function endPlay() { quitGame?.(); quitGame = null; $('#gamePlay').hidden = true; $('#gamePlay').innerHTML = ''; document.body.classList.remove('playing'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#gamePlay').hidden) endPlay(); });

let ticket = null;   // 서버 시작 티켓 (기록 저장 때 같이 보냄, 한 판에 한 번)
function play(game) {
  quitGame?.(); quitGame = null;
  ticket = S.me ? call('start', { game }).then(r => r.ticket).catch(() => '') : null;
  ({ reaction: playReaction, num25: playNum25, cut: playCut, home: playHome })[game]?.();
}

async function finish(game, value, detail = '', rounds = []) {   // rounds: 판마다의 기록 (서버가 다시 계산·검사)
  const g = GAMES[game], area = $('#parea'); if (!area) return;
  area.classList.remove('wide'); $('#gamePlay .ptop')?.classList.remove('wide');
  area.innerHTML = `<div class="result"><p class="gem">${ic(g.ic)}</p><p class="rlbl">${g.name} 결과</p><p class="rval">${esc(g.fmt(value))}</p>${detail}<p class="rmsg" id="rMsg">${S.me ? '기록 저장 중…' : '로그인하면 랭킹에 올라가요!'}</p>
    <div class="row"><button class="btn big" id="again">다시 하기</button><button class="btn ghost" data-rank="${game}" id="toRank">${ic('trophy')}랭킹</button></div></div>`;
  $('#again').onclick = () => play(game);
  $('#toRank').addEventListener('click', endPlay);
  if (game === 'home') {   // 공룡 게임처럼 스페이스·↑로 바로 다시
    const k = e => { if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') && !e.repeat && $('#again')) { e.preventDefault(); play(game); } };
    setTimeout(() => { if ($('#again')) { document.addEventListener('keydown', k); quitGame = () => document.removeEventListener('keydown', k); } }, 350);
  }
  if (!S.me) return;
  try {
    const r = await call('score', { game, value, rounds, ticket: await ticket });
    ticket = null;
    $('#rMsg').innerHTML = (r.newBest ? '<b>최고 기록 경신!</b> ' : `내 최고 ${esc(g.fmt(r.best))} · `) + `전체 <b>${r.rank}위</b>` + (r.rank === 1 ? ' ' + ic('crown') : '');
    if ($('#v-game').classList.contains('on')) renderGame();
  } catch (e) { if ($('#rMsg')) $('#rMsg').textContent = e.message; }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* 1) 반응속도: 5번 평균 */
function playReaction() {
  const area = stage(ic('bolt') + ' 반응속도', `<button class="rx idle" id="rx"><b>준비되면 탭!</b><small>초록색으로 바뀌면 최대한 빨리 누르세요</small></button><ol class="rxlog" id="rxlog"></ol>`);
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
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        setTimeout(() => alive && finish('reaction', Math.min(avg, 1500), `<p class="rdet">${times.map(t => t + 'ms').join(' · ')}</p>`, times.map(t => Math.min(t, 1500))), 500);
        pad.className = 'rx done'; pad.innerHTML = `<b>${ms}ms</b>`;
      } else { state = 'shown'; pad.className = 'rx shown'; pad.innerHTML = `<b>${ms}ms</b><small>탭해서 다음 (${times.length + 1} / 5)</small>`; }
    }
  });
}

/* 2) 1 to 25: 틀리면 +1초 */
function playNum25() {
  const nums = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - .5);
  const area = stage(ic('n25') + ' 1 to 25', `<div class="n25top"><span>다음 <b id="nNext">1</b></span><span id="nTime">0.00초</span></div>
    <div class="n25" id="n25">${nums.map(n => `<button data-n="${n}">${n}</button>`).join('')}</div><p class="note center">틀리게 누르면 +1초</p>`);
  let next = 1, t0 = 0, pen = 0, raf = 0, alive = true; const taps = [];
  quitGame = () => { alive = false; cancelAnimationFrame(raf); };
  const tick = () => { if (!alive) return; $('#nTime').textContent = ((performance.now() - t0 + pen) / 1000).toFixed(2) + '초'; raf = requestAnimationFrame(tick); };
  $('#n25').addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    e.preventDefault();
    if (+b.dataset.n === next) {
      if (next === 1) { t0 = performance.now(); tick(); }
      taps.push(Math.round(performance.now() - t0));
      b.disabled = true; b.classList.add('ok'); next++;
      $('#nNext').textContent = next > 25 ? '끝!' : next;
      if (next > 25) { cancelAnimationFrame(raf); const ms = taps[24] + pen; setTimeout(() => alive && finish('num25', Math.min(ms, 600000), '', [...taps, pen]), 300); }
    } else if (next > 1) { pen += 1000; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); }
  });
}

/* 3) 컷 타이밍: 움직이는 플레이헤드를 컷 지점에서 멈추기 (5번, 점점 빨라짐) */
function playCut() {
  const area = stage(ic('clap') + ' 컷 타이밍', `<p class="cutinfo"><span id="cRound">1 / 5</span> · 누적 오차 <b id="cSum">0ms</b></p>
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
    if (round >= 5) { btn.disabled = true; setTimeout(() => alive && finish('cut', Math.min(sum, 6000), `<p class="rdet">${errs.map(x => x + 'ms').join(' · ')}</p>`, errs), 700); }
    else setTimeout(() => alive && start(), 650);
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); if (running) stop(performance.now() - t0); });
  start();
}

/* 4) 나 집에 갈래!: 공룡 게임 방식 픽셀 러너 (js/runner.js) + 캐릭터 꾸미기 */
let RUN = null;   // runner.js 모듈 (처음 열 때 불러옴)
async function playHome() {
  const area = stage(ic('home') + ' 나 집에 갈래!', `<div class="hr" id="hr">
      <div class="hr-scr" id="hrScr"><canvas id="hrCv" aria-label="게임 화면"></canvas>
        <div class="hr-ov" id="hrOv"><b>나 집에 갈래!</b><span>종 쳤다! 장애물을 피해 집까지 달려요</span><small>${matchMedia('(pointer:coarse)').matches ? '화면이나 점프 버튼을 눌러 출발' : '스페이스 · ↑ · 화면 클릭으로 출발'}</small></div></div>
      <div class="hr-touch"><button type="button" class="btn big" id="hrJ">점프</button><button type="button" class="btn big ghost" id="hrD">숙이기</button></div>
      <div class="hr-bar"><button type="button" class="btn" id="hrDress">${ic('brush')}캐릭터 꾸미기</button>
        <p class="hr-keys"><kbd>Space</kbd><kbd>↑</kbd> 점프 (길게 누르면 더 높이) · <kbd>↓</kbd> 숙이기</p>
        <button type="button" class="btn ghost" id="hrSnd" aria-pressed="false">소리 끔</button></div>
      <div class="hr-dress" id="hrDressBox" hidden></div>
    </div>`, true);
  if (!RUN) { try { RUN = await import('./runner.js'); } catch { area.innerHTML = '<p class="empty">게임을 불러오지 못했어요. 새로 고침해 주세요</p>'; return; } }
  if (!$('#hrCv')) return;   // 불러오는 사이 그만둠
  const cv = $('#hrCv'), ov = $('#hrOv'), scr = $('#hrScr');
  let char = RUN.loadChar(), sound = store.get('home_snd', false);
  let best = store.get('home_best', 0);
  const fit = () => {   // 320×104를 정수 배로 (좁으면 꽉 채움)
    const w = $('#hr').clientWidth - 6, k = Math.floor(w / RUN.W);   // 테두리 빼고
    cv.style.width = (k >= 2 ? k * RUN.W : w) + 'px';
  };
  let over = false;
  const R = RUN.createRunner(cv, char, {
    sound, best: () => best,
    onStart() { ov.hidden = true; $('#hr').classList.add('on'); closeDress(); },
    onOver(score, ms) {
      over = true;
      if (score > best) { best = score; store.set('home_best', best); }
      ov.hidden = false; ov.classList.add('dead');
      ov.innerHTML = `<b>앗, 집에 못 갔다…</b><span>${score.toLocaleString('ko-KR')}m 달렸어요</span>`;
      setTimeout(() => {
        if (!$('#hrCv')) return;
        cleanup();
        finish('home', HOME_MAX - Math.max(1, score), `<p class="rdet">${(ms / 1000).toFixed(1)}초 동안 ${score.toLocaleString('ko-KR')}m 달렸어요</p><p class="note center">스페이스·↑로 바로 다시</p>`, [Math.max(1, score), ms]);
      }, 1100);
    },
  });
  window.__home = R;   // 테스트용 (헤드리스 점검)
  fit();
  const ro = new ResizeObserver(fit); ro.observe($('#hr'));
  // 입력: 키보드 · 화면 탭(점프) · 아래 버튼(점프/숙이기)
  const KEY = { ' ': 'jump', ArrowUp: 'jump', w: 'jump', W: 'jump', ArrowDown: 'duck', s: 'duck', S: 'duck' };
  const kd = e => {
    const a = KEY[e.key]; if (!a || over || !$('#hrDressBox').hidden || e.target.closest?.('input,textarea')) return;
    e.preventDefault(); if (!e.repeat) R.input(a, true);
  };
  const ku = e => { const a = KEY[e.key]; if (a) R.input(a, false); };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  const hold = (el, a) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); if (!over && $('#hrDressBox').hidden) R.input(a, true); try { el.setPointerCapture(e.pointerId); } catch {} });
    const up = () => R.input(a, false);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  hold(scr, 'jump'); hold($('#hrJ'), 'jump'); hold($('#hrD'), 'duck');
  const blur = () => { R.input('jump', false); R.input('duck', false); };
  window.addEventListener('blur', blur);
  function cleanup() { R.destroy(); ro.disconnect(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); if (window.__home === R) delete window.__home; }
  quitGame = cleanup;
  const sndBtn = $('#hrSnd');
  const paintSnd = () => { sndBtn.textContent = sound ? '소리 켬' : '소리 끔'; sndBtn.setAttribute('aria-pressed', sound); };
  paintSnd();
  sndBtn.onclick = () => { sound = !sound; store.set('home_snd', sound); R.setSound(sound); paintSnd(); sndBtn.blur(); };

  /* --- 캐릭터 꾸미기 --- */
  const box = $('#hrDressBox');
  let pvTimer = 0;
  function closeDress() { box.hidden = true; clearInterval(pvTimer); $('#hr').classList.remove('dressing'); }
  function paintDress() {
    const sw = (o, i) => o.colors[i][0];
    box.innerHTML = `<div class="hd-pv"><canvas id="hdCv" aria-label="내 캐릭터"></canvas><div class="hd-frs">${['run1', 'jump', 'duck1'].map((f, i) => `<button type="button" data-hf="${f}" class="${i ? '' : 'on'}">${['달리기', '점프', '숙이기'][i]}</button>`).join('')}</div>
        <div class="row"><button type="button" class="btn ghost" id="hdRnd">무작위</button><button type="button" class="btn" id="hdDone">완료</button></div></div>
      <div class="hd-opts">${RUN.OPTS.map(o => `<div class="hd-g"><p>${o.name}</p><div class="hd-ch">${o.colors
        ? o.colors.map((c, i) => `<button type="button" class="hd-sw${char[o.k] === i ? ' on' : ''}${c[0] ? '' : ' none'}" data-hk="${o.k}" data-hv="${i}" data-tip="${c[1]}" aria-label="${o.name} ${c[1]}"${c[0] ? ` data-c="${c[0]}"` : ''}></button>`).join('')
        : o.list.map(([v, t]) => `<button type="button" class="hd-tx${char[o.k] === v ? ' on' : ''}" data-hk="${o.k}" data-hv="${v}">${t}</button>`).join('')}</div></div>`).join('')}</div>`;
    box.querySelectorAll('.hd-sw[data-c]').forEach(b => { b.style.background = b.dataset.c; });   // CSP: style 속성 대신 스크립트로
    let fr = 'run1', tk = 0;
    const pv = () => { const f = fr === 'run1' ? (tk++ % 2 ? 'run2' : 'run1') : fr === 'duck1' ? (tk++ % 2 ? 'duck2' : 'duck1') : fr; RUN.drawPreview($('#hdCv'), char, f); };
    pv(); clearInterval(pvTimer); pvTimer = setInterval(() => { if (!$('#hdCv')) return clearInterval(pvTimer); pv(); }, 180);
    box.onclick = e => {
      const f = e.target.closest('[data-hf]');
      if (f) { fr = f.dataset.hf; box.querySelectorAll('[data-hf]').forEach(x => x.classList.toggle('on', x === f)); pv(); return; }
      const b = e.target.closest('[data-hk]');
      if (b) {
        const o = RUN.OPTS.find(x => x.k === b.dataset.hk);
        char = { ...char, [o.k]: o.colors ? +b.dataset.hv : b.dataset.hv };
        box.querySelectorAll(`[data-hk="${o.k}"]`).forEach(x => x.classList.toggle('on', x === b));
        RUN.saveChar(char); R.setChar(char); pv(); return;
      }
      if (e.target.closest('#hdRnd')) { char = RUN.randomChar(); RUN.saveChar(char); R.setChar(char); const keep = fr; paintDress(); box.querySelector(`[data-hf="${keep}"]`)?.click(); return; }
      if (e.target.closest('#hdDone')) { closeDress(); $('#hrDress').focus(); }
    };
  }
  $('#hrDress').onclick = () => {
    if (R.st.scene !== 'ready') return;
    if (!box.hidden) return closeDress();
    paintDress(); box.hidden = false; $('#hr').classList.add('dressing');
  };
}

/* ===== 시작 ===== */
// 로그인 만료 예고 (2026-10-24): 30일 유지·연장 없음이라 어느 날 갑자기 소개 화면으로 튕기지 않게, 3일 안으로 남으면 하루 한 번 알림
function expWarn() {
  const exp = S.me?.sessExp; if (!exp) return;
  const left = exp - Date.now(), day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  if (left <= 0 || left > 3 * 86400e3) return;
  try { if (localStorage.getItem('sg_expwarn') === day) return; localStorage.setItem('sg_expwarn', day); } catch {}
  const d = Math.ceil(left / 86400e3);
  setTimeout(() => toast(`${d <= 1 ? '하루 안에' : d + '일 뒤'} 자동으로 로그아웃돼요 · 다시 로그인하면 30일 더 유지돼요`, 6000), 2500);
}
export async function init(c) {
  ctx = c; c.stkTray = stkTray;   // app.js 밸런스 댓글에서도 씀
  c.RENDER.me = renderMe; c.RENDER.u = renderUser; c.RENDER.dm = renderDm; c.RENDER.game = renderGame;
  c.RENDER.gacha = () => GCH.render();
  GCH.init({ call, refreshMe, me: () => S.me, setGc: g => { if (S.me) { S.me.gc = { ...S.me.gc, tix: g.tix, shard: g.shard, pity: g.pity, leg: g.leg, own: g.own, fx: g.fx || S.me.gc?.fx || {} }; applyFx(); } } });
  c.report = openReport;
  c.authForm = authHtml;   // 소개 화면의 로그인/가입 폼
  c.onLeave = v => {
    document.body.dataset.view = v;
    if (v === 'dm') closePanel(); else if (threadIn === 'page') stopThread();
  };
  try { const r = await call('config'); S.enabled = r.enabled !== false; S.needCode = !!r.needCode; S.google = r.google || ''; } catch { S.enabled = false; }
  document.body.dataset.view = location.hash.slice(1).split('/')[0] || 'home';
  setupDock();
  ATT.init({ call, av, nameOf, devTag, classTxt, atOf, closeSheet, openModal: c.openModal, closeModal: c.closeModal,
    sheet: html => { sheet(html); $('#socSheet').classList.add('attw'); },
    onBest: (b, t) => { if (S.me) { S.me.attBest = Math.max(S.me.attBest || 0, b || 0); S.me.attTotal = Math.max(S.me.attTotal || 0, t || 0); } } });
  if (S.enabled) await refreshMe(); else paintBadges();
  if (S.google && !S.me) loadGis().catch(() => {});   // 로그인 전이면 구글 스크립트를 미리 받아 둠 → 로그인 페이지 열 때 버튼이 바로 뜸
  if (!S.meErr) c.authed?.(S.me, S.enabled);   // 로그인 전이면 소개 화면 유지, 로그인돼 있으면 닫음 (연결 문제면 지금 상태 그대로)
  expWarn();
  startPoll();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) refreshMe(); });
  $('#btnFeedback').onclick = openFeedback;
  $('#btnOut').onclick = doLogout;
  $('#btnNotices').onclick = () => openNotices();
  ctx.openNotices = openNotices;
  checkNotices();
}

/* ===== 구글 로그인 (Google Identity Services) =====
   .gbtn[data-gintent] 자리가 화면에 생기면 구글 버튼을 그려 넣음. 목적: login(로그인·가입) · link(계정 연결) · withdraw(탈퇴 본인 확인) · reset(아이디 찾기·비밀번호 재설정) */
let gReady = null, gIntent = 'login';
function loadGis() {
  return gReady ||= new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = no;
    document.head.appendChild(s);
  }).then(() => google.accounts.id.initialize({ client_id: S.google, callback: onGoogle, ux_mode: 'popup', auto_select: false }));
}
function mountGoogle() {
  if (!S.google) return;
  const els = [...document.querySelectorAll('.gbtn:not([data-done])')];
  if (!els.length) return;
  loadGis().then(() => els.forEach(el => {
    el.dataset.done = '1';
    google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: el.dataset.gintent === 'login' ? 'continue_with' : 'signin_with', locale: 'ko', width: Math.min(320, el.clientWidth || 280) });
    el.addEventListener('pointerdown', () => { gIntent = el.dataset.gintent; }, true);   // 어느 버튼을 눌렀는지 기억
  })).catch(() => els.forEach(el => { el.classList.add('gfail'); el.textContent = '구글 로그인을 불러오지 못했어요'; }));
}
new MutationObserver(mountGoogle).observe(document.body, { childList: true, subtree: true });
async function onGoogle({ credential }) {
  try {
    if (gIntent === 'link') { await call('google-link', { credential, pw: $('#gPw')?.value || '' }); S.me.google = true; toast('구글 계정을 연결했어요 🔗'); openSettings(); return; }
    if (gIntent === 'withdraw') { await call('withdraw', { credential }); S.me = null; paintBadges(); closeSheet(); renderMe(); ctx.authed?.(null); toast('탈퇴했어요. 그동안 고마웠어요'); return; }
    if (gIntent === 'reset') return googleReset(credential, await call('google-reset', { credential }));
    const r = await call('google', { credential });
    if (r.need === 'signup') return googleSignup(credential, r.name);
    await googleDone('login');
  } catch (x) { toast(x.message); }
}
function googleSignup(credential, name) {   // 구글로 처음 왔을 때: 아이디·닉네임·학년·반만 정하고 가입 (비밀번호 없음)
  const c = ctx.getClass?.() || null;
  sheet(`<h3>🎉 구글로 가입하기</h3><p class="note">아이디와 닉네임만 정하면 끝! 다음부터는 구글 버튼으로 로그인해요.</p>
    <form class="sform" id="gForm">
      <label>아이디<input name="handle" required minlength="3" maxlength="16" pattern="[a-zA-Z0-9_.]{3,16}" autocapitalize="off" placeholder="영어 소문자·숫자 3~16자"><small class="hint">🔑 나중에 바꿀 수 없어요.</small></label>
      <label>이름 (닉네임)<input name="name" required maxlength="20" value="${esc(name || '')}"></label>
      <div class="two"><label>학년<select name="grade">${[1, 2, 3].map(g => `<option value="${g}" ${c && +c.g === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label><label>반<select name="cls">${Array.from({ length: CLS_N }, (_, i) => `<option value="${i + 1}" ${c && +c.c === i + 1 ? 'selected' : ''}>${i + 1}반</option>`).join('')}</select></label></div>
      ${S.needCode ? '<label>가입 코드<input name="code" required maxlength="40"></label>' : ''}
      <p class="ferr" role="alert" hidden></p>
      <div class="row"><button class="btn" type="submit">가입하고 시작하기</button><button class="btn ghost" type="button" data-close>취소</button></div>
    </form>`);
  $('#gForm').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector('[type=submit]'); b.disabled = true;
    try { await call('google', { credential, ...d, handle: d.handle.trim().toLowerCase(), grade: +d.grade, cls: +d.cls }); closeSheet(); await googleDone('signup'); }
    catch (x) { const box = e.target.querySelector('.ferr'); box.textContent = x.message; box.hidden = false; b.disabled = false; }
  };
}
// 아이디·비밀번호 찾기: 구글을 미리 연결해 둔 계정만 (구글 확인 → 아이디 보여 줌 → 원하면 새 비밀번호)
document.addEventListener('click', e => {
  if (!e.target.closest('[data-forgot]')) return;
  sheet(`<h3>🔎 아이디·비밀번호 찾기</h3><p class="note">구글 계정을 <b>미리 연결해 둔</b> 경우에만 찾을 수 있어요. 연결한 구글로 확인해 주세요.</p>
    <p class="note">⚠️ 학교 기기라면 구글 계정 선택 창에서 <b>내 계정이 맞는지</b> 꼭 확인하세요.</p>
    <div class="gbtn" data-gintent="reset"></div><div class="row"><button class="btn ghost" data-close>닫기</button></div>`);
});
function googleReset(credential, r) {
  sheet(`<h3>🔎 찾았어요</h3><p class="note">내 아이디는 <b>${esc(atH(r.handle))}</b> 예요.</p>
    <form class="sform" id="grForm"><p class="lbl">비밀번호도 잊었다면 새로 정하기</p>
      <input name="pw" type="password" placeholder="새 비밀번호 (6자 이상)" minlength="6" maxlength="64" required autocomplete="new-password">
      <p class="ferr" role="alert" hidden></p>
      <div class="row"><button class="btn" type="submit">바꾸고 로그인</button><button class="btn ghost" type="button" data-close>닫기</button></div></form>
    <p class="note">비밀번호를 바꾸면 로그인돼 있던 다른 기기는 모두 로그아웃돼요.</p>`);
  $('#grForm').onsubmit = async e => {
    e.preventDefault();
    const b = e.target.querySelector('[type=submit]'); b.disabled = true;
    try {
      const x = await call('google-reset', { credential, pw: e.target.pw.value });
      closeSheet();
      if (x.banned) return toast('비밀번호를 바꿨어요. 다만 지금은 이용이 정지된 계정이에요');
      await googleDone('login');
    } catch (x) { const box = e.target.querySelector('.ferr'); box.textContent = x.message; box.hidden = false; b.disabled = false; }
  };
}
async function googleDone(mode) {
  await refreshMe();
  toast(mode === 'signup' ? `환영해요, ${S.me.name}! 🎉` : `${S.me.name}, 반가워요!`);
  if (!store.get('gtip', false)) { store.set('gtip', true); setTimeout(() => toast('학교 기기라면 다 쓴 뒤 구글에서도 로그아웃해 주세요 🔒'), 2600); }
  ctx.authed?.(S.me, true, mode);
  renderMe();
}

/* ===== 헤더: 💡 의견 보내기 · 📢 공지 모아 보기 ===== */
const pad2 = n => String(n).padStart(2, '0');
const dt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const NT_IC = { warn: '⚠️', fun: '🎉' };   // 일반(info) 공지는 아이콘 없음 — 창 맨 위 '📢 공지'와 겹쳐 보여서
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
async function openNotices(focus) {   // focus: 띠 공지를 눌러 열면 그 공지의 자세한 내용을 펼쳐 보임
  sheet('<h3>📢 공지</h3><ul class="ntlist"><li class="skel"></li><li class="skel"></li></ul>');
  $('#socSheet').classList.add('wide');   // 공지는 넓게: 접힌 공지 제목이 2줄 안에 들어가게
  if (!ntList || !ptList) await checkNotices();
  if (ntList.length) { store.set('notice_seen', ntList[0].id); store.set('notice_x', null); }   // 다 봤음 + 닫았던 띠 공지도 다시 보이게
  if (ptList.length) store.set('patch_seen', ptList[0].id);
  $('#ntDot').hidden = true;
  // 공지·업데이트 소식 공통 모양: 굵은 큰 제목 + 내용 2줄 미리보기 → 📖 자세히 보기로 펼치고, 맨 아래 작은 '접기'로 다시 접음
  const card = (live, ic, title, inner, foot, id) => `<li class="${live ? 'live' : ''}"${id ? ` data-nid="${esc(id)}"` : ''}>${ic ? `<span class="nt-ic">${ic}</span>` : ''}<div class="nt-c">
      <p class="nt-t">${title}</p>${inner ? `<div class="ntb"><div class="nb-txt">${inner}</div><button type="button" class="nb-more">📖 자세히 보기</button><button type="button" class="nb-fold">접기 ▴</button></div>` : ''}
      <small>${foot}</small></div></li>`;
  const patches = ptList.slice(0, 12).map((x, i) => card(!i, '🛠', esc(x.title || '업데이트'),
      (x.items || []).length ? `<ul class="ptitems">${x.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '', `${esc(x.date || '')}${i ? '' : ' · <b>최신</b>'}`)).join('');
  $('#socSheet').innerHTML = `<h3>📢 공지</h3>${ntList.length ? `<ul class="ntlist">${ntList.map(n => card(n.live, NT_IC[n.tone] || '',
      n.link ? `<a href="${esc(n.link)}" data-close>${esc(n.text)}</a>` : esc(n.text), n.body ? esc(n.body) : '',
      `${dt(n.at)}${n.live ? ' · <b>지금 공지</b>' : ''}`, n.id)).join('')}</ul>` : '<p class="empty">아직 공지가 없어요</p>'}
    ${patches ? `<h3 class="sp">🛠 업데이트 소식</h3><ul class="ntlist">${patches}</ul>` : ''}
    <div class="row"><button class="btn ghost" data-close>닫기</button></div>`;
  $$('#socSheet .ntb').forEach(b => {   // 2줄 안에 다 들어가는 짧은 내용은 '자세히 보기' 버튼을 숨김
    const t = b.querySelector('.nb-txt');
    if (t.scrollHeight <= t.clientHeight + 2) b.classList.add('short');
    b.querySelector('.nb-more').onclick = () => b.classList.add('open');
    b.querySelector('.nb-fold').onclick = () => { b.classList.remove('open'); b.closest('li').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  });
  if (focus) $(`#socSheet [data-nid="${CSS.escape(focus)}"] .ntb:not(.short)`)?.classList.add('open');
}
const FB_KIND = [['idea', '💡 이런 기능 있으면 좋겠어요'], ['bug', '🐞 이상하거나 안 돼요'], ['etc', '💬 그 밖의 말']];
const FB_MAX = 5;
// 사진을 긴 변 1600px·JPEG로 줄여 data URL로 (용량 커지면 더 줄임) — 서버 한도 1MB/장
function shrinkImg(file) {
  return new Promise((ok, no) => {
    const rd = new FileReader();
    rd.onerror = no;
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => no(new Error('이 사진은 열 수 없어요 (JPG·PNG로 올려 주세요)'));
      im.onload = () => {
        let side = 1600, q = .8, out = '';
        for (let k = 0; k < 6; k++) {
          const sc = Math.min(1, side / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc));
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length < 600e3) break;   // base64 600KB ≈ 실제 450KB
          side = Math.round(side * .8); q = Math.max(.6, q - .05);
        }
        ok(out);
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
function openFeedback() {
  if (!S.me) { toast('의견은 로그인하면 보낼 수 있어요'); ctx.go('me'); return; }
  sheet(`<h3>💡 의견 보내기</h3><p class="note">개발자에게 바로 전달돼요. 사이트를 더 좋게 만드는 데 써요!</p>
    <form class="sform" id="fbForm">
      <div class="segs fbk">${FB_KIND.map(([k, t], i) => `<label><input type="radio" name="kind" value="${k}" ${i ? '' : 'checked'}><span>${t}</span></label>`).join('')}</div>
      <textarea name="body" maxlength="500" rows="5" required placeholder="예: 시간표에 교실 이름도 나왔으면 좋겠어요"></textarea>
      <div class="fbpics" id="fbPics"></div>
      <input type="file" id="fbFile" accept="image/*" multiple hidden>
      ${isDev(S.me) ? '' : `<p class="note">보낸 사람 아이디(@${esc(S.me.handle)})가 개발자에게 보여요. 욕설·저격 글은 보내지 말아 주세요.</p>`}
      <div class="row"><button class="btn" type="submit">보내기</button><button class="btn ghost" type="button" data-close>닫기</button></div>
    </form>`);
  const pics = [], box = $('#fbPics'), file = $('#fbFile'), form = $('#fbForm');
  let busy = 0;
  const paint = () => {
    box.innerHTML = pics.map((d, i) => `<span class="fbpic"><img src="${d}" alt="첨부 사진 ${i + 1}"><button type="button" data-rm="${i}" aria-label="사진 빼기">✕</button></span>`).join('')
      + (pics.length + busy < FB_MAX ? `<button type="button" class="fbadd" id="fbAdd">${ic('attach')}<small>${busy ? '줄이는 중…' : '사진 첨부'}</small><small class="fbn">${pics.length}/${FB_MAX}</small></button>` : '');
  };
  const add = async files => {
    const list = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const room = FB_MAX - pics.length - busy;
    if (list.length > room) toast(`사진은 ${FB_MAX}장까지 넣을 수 있어요`);
    const take = list.slice(0, Math.max(0, room));
    busy += take.length; paint();
    for (const f of take) {
      try { pics.push(await shrinkImg(f)); } catch (x) { toast(x.message || '사진을 열지 못했어요'); }
      busy--; paint();
    }
  };
  paint();
  box.addEventListener('click', e => {
    if (e.target.closest('#fbAdd')) { file.click(); return; }
    const rm = e.target.closest('[data-rm]'); if (rm) { pics.splice(+rm.dataset.rm, 1); paint(); }
  });
  file.onchange = () => { add(file.files); file.value = ''; };
  form.body.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); add(fs); } });   // 캡처 붙여넣기
  form.onsubmit = async e => {
    e.preventDefault();
    if (busy) { toast('사진을 준비하고 있어요. 잠깐만요!'); return; }
    const f = e.target, b = f.querySelector('[type=submit]'); b.disabled = true;
    try { await call('feedback', { kind: f.kind.value, body: f.body.value, imgs: pics }); closeSheet(); toast('고마워요! 개발자에게 전달됐어요 🙌'); }
    catch (x) { toast(x.message); b.disabled = false; }
  };
}
