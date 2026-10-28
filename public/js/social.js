// SVMHS GROUND — 소셜: 계정 · 프로필 꾸미기 · 팔로우 · DM · 미니게임 랭킹 (서버: functions/api/s/[[path]].js)
import { $, $$, esc, toast, store, idle, onWake, ghost, ghostIn, ghostOr } from './util.js';
import * as ATT from './attend.js';
import * as NW from './gcnew.js';   // 새로 얻은 뽑기 보상 빨간 표시(2026-10-25)
import { wearOf, wearSvg } from './wear.js';
import { ATT_COLORS, COLOR_NAME, rwOn, decoSlots, objName, rwDay, FLAME_AT, GACHA, GACHA_OLD, RAR, FX, NEON, GC_TITLE, HIDDEN, HOME_TITLE, HOME_TITLE2, HOME_FIRST, HOME_MARK, gcDone, SHN, RK, rkOf, wkOf } from './att-rewards.js';
import { emo, artOf, ui, stkOf, stkMsg, repTag, kavName } from './att-art.js';
import { HOME_MAX, GOAL } from './home-score.js';
import { GEAR_MAX, GEAR_TIME } from './gear-score.js';
import { STAIR_MAX, floorName as stairFloor } from './stair-score.js';
import { ffOn, RELEASED } from './flags.js';
import * as KM from './keymap.js';   // 게임 키 설정(2026-10-28)
import { KIND, weekLeft, PLAY_RULE } from './mission.js';   // 주간 미션(2026-10-27, 미리보기 깃발 week-mission)
import { TIERS, TIER_PCT, BEST_N, tierOfK, PTS_MIN_N } from './att-rewards.js';
import { CLUBS, clubOf, clubLogo } from './clubs.js';
import { ACH, ACH_FF, ACH_GAMES, ACH_TITLE, ACH_TITLES, achOf, achProg, achTitles } from './achv.js';   // 게임 업적(2026-10-28, 미리보기 깃발 achv)   // 새 기능 미리보기 — 개발자만 먼저 (2026-10-25)

/* ===== 서버와 같게 유지하는 목록 ===== */
const AVATARS = ['k:cat','k:dog','k:bear','k:bunny','k:frog','k:chick','k:hamster','k:penguin','k:fox','k:panda','k:dino','k:ghost','k:slime','k:sheep','k:whale','k:axolotl','k:shark'];   // 2026-10-24: 동물 이모지 → 직접 그린 캐릭터 16종(테마 캐릭터 얼굴). 예전 이모지 값은 lib/db.js v20에서 옮김
const COLORS = ['sky','blue','mint','lime','yellow','peach','pink','violet','ink'];
const ALL_COLORS = [...COLORS, ...ATT_COLORS];   // 출석 보상 전용 배경 색 포함
const STICKERS = ['⭐','✨','💖','💙','🔥','🎬','🎥','📸','🎧','🎮','🍀','🌈','☁️','🌙','🍓','🧋','🐾','👑','💯','🎀','💧','🪐','🦋','🌷','🍒','🎵','⚡','🌊'];
// 마우스를 올리면 뜨는 이름표(data-tip)용 이름
const EMO_NAME = { '😎':'선글라스','🐶':'강아지','🐱':'고양이','🐰':'토끼','🦊':'여우','🐻':'곰','🐼':'판다','🐸':'개구리','🐥':'병아리','🐧':'펭귄','🦄':'유니콘','🐯':'호랑이','🐨':'코알라','🐹':'햄스터','👽':'외계인','🤖':'로봇','👻':'유령','🎃':'호박','🌝':'보름달','🍀':'네잎클로버','🔥':'불꽃','⚡':'번개','💧':'물방울','🌈':'무지개','🎬':'촬영 슬레이트','🎥':'영화 카메라','🎧':'헤드폰','🎮':'게임패드','🏀':'농구공','⚽':'축구공','🎸':'기타','🍓':'딸기','🍩':'도넛','🧋':'버블티','🍕':'피자','💜':'보라 하트','⭐':'별','✨':'반짝반짝','💖':'반짝 하트','💙':'파란 하트','📸':'사진기','☁️':'구름','🌙':'달','🐾':'발자국','👑':'왕관','💯':'백점','🎀':'리본','🫧':'비눗방울','🪐':'행성','🦋':'나비','🌷':'튤립','🍒':'체리','🎵':'음표','🌊':'파도' };
const COLOR_KO = { sky:'하늘색', blue:'파란색', mint:'민트색', lime:'연두색', yellow:'노란색', peach:'살구색', pink:'분홍색', violet:'보라색', ink:'남색' };
const MAX_STICKERS = 6;
const stkMax = u => isDev(u) ? 12 : MAX_STICKERS;   // 개발자는 치장 제한 없음(배너 자리 12개)
const ADMIN_HANDLE = 'developer';   // 서버 lib/db.js와 같게 (버튼 표시용, 실제 권한은 서버가 검사)
// 직접 그린 스티커 아이콘(index.html 스프라이트 #sj-*) — 이모지 대신 (2026-10-24)
const ic = (k, cls = '') => `<svg class="sic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${k}"/></svg>`;
const GAMES = {
  // 집에 가고 싶어!: 멀리 갈수록 좋음 → 서버엔 HOME_MAX - 거리로 저장(다른 게임처럼 작을수록 1등)
  // 기자재 정리!(2026-10-27 하율, 미리보기 깃발 gear-game — 개발자만): 촬영 장비 블록 쌓기. 높을수록 좋음 → 서버엔 GEAR_MAX - 점수
  gear: { ff: 'gear-game', name: '기자재 정리!', ic: 'gear', desc: '수업 끝! 촬영 장비를 빈틈없이 정리해 줄을 채워요 · 랭킹전은 2분 점수 대결', fmt: v => (GEAR_MAX - v).toLocaleString('ko-KR') + '점' },
  // 기자재 정리! 일반 모드(2026-10-28 하율 "랭크에는 포함되지 않아도 순위는 나오게"): 따로 순위만 — 게임 목록·티어엔 안 나옴(casual), 기자재 정리! 랭킹 창의 '일반' 전환으로 봄
  gearn: { ff: 'gear-game', casual: true, name: '기자재 정리! 일반', ic: 'gear', desc: '시간 제한 없이 자유롭게 · 티어·보상과 상관없는 일반 모드 순위', fmt: v => (GEAR_MAX - v).toLocaleString('ko-KR') + '점' },
  // 영상고 계단 오르기(2026-10-28 하율, 미리보기 깃발 stair-game — 개발자만): 무한 계단식. 높을수록 좋음 → 서버엔 STAIR_MAX - 오른 칸
  stair: { ff: 'stair-game', name: '영상고 계단 오르기', ic: 'stair', desc: '종 치기 전에 교실까지! 방향을 바꾸며 끝없는 계단 오르기', fmt: v => (STAIR_MAX - v).toLocaleString('ko-KR') + '칸' },
  home: { name: '집에 가고 싶어!', ic: 'run', desc: '하교 달리기! 장애물을 점프·숙이기로 피해 집까지 달려요', fmt: v => (HOME_MAX - v).toLocaleString('ko-KR') + 'm' },
  cut: { beta: true, name: '컷 타이밍', ic: 'clap', desc: '플레이헤드가 컷 지점에 오면 CUT! 5번 오차 합', fmt: v => '오차 ' + v + 'ms' },
  reaction: { beta: true, name: '반응속도', ic: 'bolt', desc: '초록색으로 바뀌는 순간 탭! 5번 평균 · 미리 찍으면 벌점', fmt: v => v + 'ms' },
  num25: { name: '1 to 25', ic: 'n25', desc: '1부터 25까지 순서대로 빠르게 누르기', fmt: v => (v / 1000).toFixed(2) + '초' },
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
  if (j.mis) msResult(j.mis);
  if (j.ach) achResult(j.ach);   // 게임 업적 달성(기록 저장 응답)   // 주간 미션을 깬 응답(게임·뽑기·출석·DM·팔로우·프로필)
  return j;
}
const fail = e => toast(e.message || '문제가 생겼어요');

/* ===== 작은 조각들 ===== */
// 개발자 계정은 이모지 대신 사이트 로고 + 무지개 링 아바타 (어디서나 같게)
const av = (u, cls = '', x = '') => u?.handle === ADMIN_HANDLE ? `<span class="av avdev ${cls}"><img src="/logo-mark.svg?v=4" alt="">${x}${u.online ? '<i class="dot" data-tip="접속 중"></i>' : ''}</span>` : `<span class="av c-${esc(ALL_COLORS.includes(u.color) ? u.color : 'sky')} ${cls}">${emo(u.avatar || 'k:cat', 'ava')}${x}${u.online ? '<i class="dot" data-tip="접속 중"></i>' : ''}</span>`;
// 착용 소품(왕관 등)을 프로필 사진 위에 — 큰 사진(프로필 카드·꾸미기 미리보기)에만
const avWear = v => wearOf(v) ? `<i class="avwear">${wearSvg(v)}</i>` : '';
const isDev = u => u?.handle === ADMIN_HANDLE;
// 지금 보이는 게임만(미리보기 깃발 게임은 개발자에게만)
const gamesOn = () => Object.entries(GAMES).filter(([, g]) => !g.casual && (!g.ff || ffOn(g.ff, isDev(S.me))));
// 뽑기 전설 '별똥별 등장': 프로필을 열 때 한 번 쏟아지는 별(위치·크기·시간을 조금씩 다르게)
const pfxStars = () => `<div class="pfx-star" aria-hidden="true">${'<i></i>'.repeat(14)}</div>`;   // 위치·크기·시간은 style.css nth-child (CSP: style 속성 금지)
// 개발자 프로필 전용 등장 (2026-10-25 하율: 별똥별 말고 특별하게) — 카드 위를 무지개 빛이 한 번 쓸고, 사진 뒤에서 무지개 빛줄기·충격파·반짝이가 터짐
const pfxDev = () => '<div class="pfx-dev" aria-hidden="true"></div>';
const pdBurst = () => `<i class="pd-burst" aria-hidden="true"><i class="pd-rays"></i><i class="pd-ring"></i>${'<i class="pd-sp"></i>'.repeat(12)}</i>`;
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
/* 로딩 뼈대용 가짜 데이터 (2026-10-27) — 진짜 그리는 함수에 넣어 같은 모양을 만든 뒤 util.js ghost()로 뼈대로 (글자는 안 보이고 길이만 씀) */
const FK_U = (i = 0) => ({ handle: 'loading' + i, name: ['친구 이름', '닉네임자리', '이름이길어요'][i % 3], color: 'sky', avatar: 'k:cat', mood: '상태 메시지가 들어가는 자리', grade: 1, cls: 1, value: 10, pts: 100, tier: 'gold', rank: i + 1, seen: Date.now() });
const FK_US = n => Array.from({ length: n }, (_, i) => FK_U(i));
const ghPeople = n => ghostOr(() => FK_US(n).map(u => personRow(u, '<button class="fbtn">팔로우</button>')).join(''), n);
const FK_PROF = self => ({ user: { ...FK_U(), bio: '자기소개가 들어가는 자리예요. 두 줄 정도 길이로 보여요' }, me: self, counts: { followers: 0, following: 0 }, streak: { cur: 3, best: 3, total: 3 }, bests: {}, rel: {}, crowns: [] });
const ghProfile = self => ghostOr(() => profileHtml(FK_PROF(self)), 3);
const followBtn = u => u.isMe ? '' : `<button class="fbtn ${u.following ? 'on' : ''}" data-follow="${esc(u.handle)}" data-on="${u.following ? 0 : 1}">${u.following ? '팔로잉' : '팔로우'}</button>`;
const needLogin = (msg) => `<div class="card soc-gate"><p class="gate-em">🔐</p><p><b>${msg}</b></p><p class="muted small">아이디만 있으면 1분이면 가입해요</p><button class="btn" data-go="me">로그인 / 가입하기</button></div>`;
const offCard = () => `<div class="card soc-gate"><p class="gate-em">🛠️</p><p><b>소셜 기능을 준비하고 있어요</b></p><p class="muted small">곧 열려요! 조금만 기다려 주세요</p></div>`;

function sheet(html) { $('#socSheet').classList.remove('wide', 'attw', 'edw'); $('#socSheet').innerHTML = html; ctx.openModal('#mSoc'); }
const closeSheet = () => ctx.closeModal($('#mSoc'));

/* ===== 헤더 배지 · 주기적 확인 ===== */
// 서비스 › 뽑기 카드: 가진 뽑기권 수(개발자는 무제한 → ∞)
function paintTix() {
  const t = S.me?.gc?.tix;
  $$('[data-gc-tix]').forEach(el => {
    const has = t != null && t > 0;
    el.textContent = t == null ? '캡슐 뽑으러 가기' : has ? `뽑기권 ${t >= 1e6 ? '∞' : t > 99 ? '99+' : t}장` : '출석하면 뽑기권';
    el.closest('.gc-app')?.classList.toggle('has-tix', has);
  });
}
function paintBadges() {
  const n = S.me ? S.unread : 0;
  $$('[data-badge="dm"]').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
  paintTix();
  const dev = S.me?.handle === ADMIN_HANDLE;
  if (!S.me) ATT.sync(null);   // 로그아웃: 🔥 버튼 숨김
  $('#btnOut').hidden = !S.me;   // 로그인돼 있을 때만 메뉴 맨 아래 빨간 로그아웃
  $('#btnEdit').hidden = !S.me;   // 메뉴 '프로필' 바로 아래 '꾸미기' (로그인했을 때만)
  $('#btnAdmin').hidden = !dev;   // 관리자 계정일 때만 메뉴에 표시 (권한은 서버가 검사)
  ['#btnClass', '#btnReport'].forEach(id => { $(id).hidden = dev; });   // 개발자 계정엔 설정·신고 필요 없음 (QR 공유는 개발자도 씀)
  $('#btnMe .mi').innerHTML = S.me ? av({ ...S.me, online: false }, 'tiny') : '<svg viewBox="0 0 24 24"><use href="#i-user"/></svg>';
  NW.paint();   // ☰ 메뉴·꾸미기의 빨간 '새로 얻음' 표시
}
// 네온 시계 색: 이 기기에 저장 · 고르는 곳은 꾸미기 미리보기와 뽑기 '내 효과' 두 군데(같은 버튼 data-neon-c)
const neonC = () => { const v = store.get('neon_c', 'pink'); return NEON.some(x => x[0] === v) ? v : 'pink'; };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-neon-c]'); if (!b) return;
  store.set('neon_c', b.dataset.neonC); document.documentElement.dataset.neon = b.dataset.neonC;
  $$('[data-neon-c]').forEach(x => { const on = x.dataset.neonC === b.dataset.neonC; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
});
// 내가 켠 뽑기 효과 중 내 화면에만 보이는 것: 시계 테마(html[data-ckfx]) · 착용 소품(html[data-mfx] → app.js가 캐릭터 머리·시계·로고 중 한 곳에 붙임). 착용 소품은 프로필 사진 위에도(남에게 보임, 서버 mfx)
function applyFx() {
  const fx = S.me?.gc?.fx || {}, h = document.documentElement;
  const ck = fx.clock === 'r:fxneon' ? 'neon' : '', mf = wearOf(fx.masc) ? fx.masc : '';   // 착용 소품 값 그대로(wear.js)
  if (ck) h.dataset.ckfx = ck; else delete h.dataset.ckfx;
  h.dataset.neon = neonC();
  if ((h.dataset.mfx || '') !== mf) { if (mf) h.dataset.mfx = mf; else delete h.dataset.mfx; document.dispatchEvent(new Event('sg:mfx')); }
}
// 뽑기 상태 받기(뽑기 화면·꾸미기 효과 탭 공용)
function setGc(g) { if (S.me && g) { S.me.gc = { ...S.me.gc, tix: g.tix ?? S.me.gc?.tix, shard: g.shard ?? S.me.gc?.shard, pity: g.pity ?? S.me.gc?.pity, leg: g.leg ?? S.me.gc?.leg, own: g.own || S.me.gc?.own, fx: g.fx || S.me.gc?.fx || {} }; applyFx(); paintTix(); NW.paint(); } }
// 게시된 패치 공지의 새 기능 깃발(ff)을 모두에게 엶 — 한 번만 받아 둠
// 2026-10-28 고침: 예전엔 페이지를 연 뒤 한 번만 받아서, 공지(00시) 전부터 켜 둔 창·앱은 새로고침 전까지 새 기능이 안 열렸음 → 5분 지나면 다시 받음(실패하면 다음에 다시)
let relP = null, relAt = 0;
// NEW 배지(2026-10-28 하율 "NEW는 출시되고 2일 지나면 없애줘"): 깃발이 공지로 처음 공개된 시각(at)부터 48시간만 · 공개 전(개발자 미리보기)엔 계속
const REL_AT = {}, NEW_MS = 2 * 864e5;
const newOn = (ff, dev) => { if (!ffOn(ff, false)) return !!dev; const t = REL_AT[ff]; return t > 0 && Date.now() - t < NEW_MS; };
const loadReleased = () => {
  if (relP && Date.now() - relAt < 5 * 60e3) return relP;
  relAt = Date.now();
  return relP = fetch('/api/s/patch', { credentials: 'same-origin', cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => { for (const x of j.list || []) for (const f of x.ff || []) { RELEASED.add(f); if (x.at > 0 && !(REL_AT[f] <= x.at)) REL_AT[f] = x.at; } }).catch(() => { relAt = 0; });
};
// 열린 미리보기 깃발 요소에 data-ffon 표시(나중에 그려지는 data-ff 요소도 지켜봄) — 안 열린 건 CSS가 숨김
let ffObs = null;
function markFF(root) {
  const dev = isDev(S.me), one = el => el.toggleAttribute('data-ffon', ffOn(el.dataset.ff, dev));
  if (root.nodeType !== 1) return;
  if (root.hasAttribute('data-ff')) one(root);
  root.querySelectorAll('[data-ff]').forEach(one);
  const nb = el => el.toggleAttribute('data-nfon', newOn(el.dataset.nf, dev));
  if (root.hasAttribute('data-nf')) nb(root);
  root.querySelectorAll('[data-nf]').forEach(nb);
}
function paintFF() {
  markFF(document.body);
  if (!ffObs) { ffObs = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) markFF(n); }); ffObs.observe(document.body, { childList: true, subtree: true }); }
}
async function refreshMe() {
  try {
    const [r] = await Promise.all([call('me'), loadReleased()]);
    S.me = r.me; S.unread = r.unread || 0; S.counts = r.counts || null; S.meErr = false;
    document.documentElement.classList.toggle('dev-pv', isDev(S.me)); document.documentElement.dataset.ffr = [...RELEASED].join(' '); paintFF(); document.documentElement.classList.toggle('rk2', ffOn('rk-split', isDev(S.me))); document.documentElement.classList.toggle('tl2', ffOn('tier-look', isDev(S.me))); document.documentElement.classList.toggle('tf', ffOn('tier-fancy', isDev(S.me))); document.documentElement.classList.toggle('tpad', ffOn('tier-pad', isDev(S.me)));
    { const c2 = ffOn('cut-v2', isDev(S.me)); document.documentElement.classList.toggle('cut2', c2); GAMES.cut.name = c2 ? '편집의 신' : '컷 타이밍'; GAMES.cut.beta = !c2; }
    { const rx = ffOn('rx-season', isDev(S.me)); document.documentElement.classList.toggle('rxs', rx); GAMES.reaction.beta = !rx; }   // 반응속도 정식 출시(새 시즌) — Beta 떼기
    try { const h = document.documentElement; localStorage.setItem('sg_ffc', JSON.stringify({ c: ['dev-pv', 'rk2', 'tl2', 'tf', 'tpad', 'cut2', 'rxs'].filter(x => h.classList.contains(x)), r: h.dataset.ffr || '' })); } catch {}   // 2026-10-28 하율 "게임 4개 먼저 나오고 기자재 정리가 툭 튀어나온다": 깃발 상태를 저장 → 다음 접속 땐 theme.js가 첫 화면 그리기 전에 붙임   // 2026-10-28 하율: 새 컷 타이밍은 이름 '편집의 신'·정식(Beta 뗌) — 깃발 cut-v2와 함께 공개   // 미리보기 기능([data-ff]) 개발자에게만 보이게
    if (r.rkGift?.length) rkGiftToast(r.rkGift);
  } catch (e) { S.me = null; S.meErr = !e.status || e.status >= 500; }   // meErr: 연결·서버 문제(로그아웃 상태라고 단정 못 함)
  paintBadges();
  applyFx();
  if (!S.meErr) loadMission();
  if (!S.meErr) { ATT.sync(S.me); ctx?.setDeco?.(S.me?.deco || []); ctx?.setClub?.(S.me?.club); }   // 하루 한 번 자동 출석 (첫 출석이면 축하 창) · 첫 화면 시계 스티커
  if (!panelOpen()) loadRecent();
  if (!S.meErr) loadBuddies();
}
// 끝난 게임 랭킹 라운드 보상(서버 settleRounds가 이미 뽑기권을 넣음) → 한 번 알리고 봤음 표시
// 2026-10-27: 'w:all' = 매주 모두에게 주는 뽑기권 · 't:티어' = 라운드 최종 티어 보상 · (예전) 'w:게임' = 게임 1~3등
function rkGiftToast(list) {
  const n = list.reduce((a, x) => a + x.tix, 0);
  const what = x => x.game === 'w:all' ? '이번 주 뽑기권' : x.game.startsWith('t:') ? `지난 라운드 ${tierOfK(x.game.slice(2))?.n || ''} 티어` : `${GAMES[x.game.slice(2)]?.name || x.game} ${x.place}등`;
  toast(`🎟️ ${[...new Set(list.map(what))].join(' · ')} — 뽑기권 ${n}장을 받았어요`, 6000);
  call('rkseen', {}).catch(() => {});
}
function startPoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(pollOnce, 60000);   // 60초마다 (학생 수가 많을 때 Cloudflare 무료 요청 수 아끼기, 대화창 안은 따로 3~15초) · 5분 넘게 안 만지면 쉼(util idle)
}
onWake(() => { pollOnce(); if ((document.body.dataset.view || 'home') === 'home' && S.me) loadBuddies(); });
async function pollOnce() {
    if (document.hidden || idle() || !S.me || openThread) return;
    try { const r = await call('poll'); const more = r.unread > S.unread; S.unread = r.unread; paintBadges();
    if (more) { if (panelOpen()) renderDm('', $('#dmPBox'), true); else { if (!location.hash.startsWith('#dm')) toast('💬 새 메시지가 왔어요'); loadRecent(); } } } catch {}
}

/* ===== 로그인 · 가입 ===== */
// keep: 탭(로그인↔가입)을 바꿀 때 적던 아이디·비밀번호를 그대로 옮겨 줌
const CLS_N = 6;   // 서울영상고는 학년마다 6반까지
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="e-open" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle class="e-open" cx="12" cy="12" r="3"/><path class="e-shut" d="M3.5 9.5Q12 16.5 20.5 9.5M7 13.4 5.4 15.8M12 15.2v2.8M17 13.4l1.6 2.4"/></svg>';
// 동아리 고르기 칸 (가입·구글 가입) — 값은 동아리 이름, '없음'은 빈 값. 가입 땐 하나는 꼭 고르게(없으면 '없음')
const clubPickHtml = () => `<fieldset class="clubpick su"><legend>동아리 <small>프로필에 로고로 보여요 · 나중에 바꿀 수 있어요</small></legend><div class="cp-grid">
  <label class="cp-i none"><input type="radio" name="club" value=""><span><i class="cp-x" aria-hidden="true">없음</i><b>없음</b></span></label>
  ${CLUBS.map(([k, n]) => `<label class="cp-i"><input type="radio" name="club" value="${esc(n)}"><span><img src="/clubs/${k}.webp" alt="" loading="lazy" width="128" height="128"><b>${esc(n)}</b></span></label>`).join('')}
</div></fieldset>`;
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
        ${clubPickHtml()}
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
  if (mode === 'signup' && !f.querySelector('[name=club]:checked')) return ['동아리를 골라 주세요 (없으면 \'없음\')', 'club'];
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
    const res = await call(mode, d);
    await refreshMe();
    if (card.closest('#introAuth')) { card.classList.add('ok'); await new Promise(r => setTimeout(r, 760)); }   // 소개 화면: '입장!' 도장 찍히고 닫힘
    ctx.authed?.(S.me, true, mode);   // 소개 화면이면 닫힘 (가입 때 고른 학년·반은 여기서 이 기기 반 설정으로 들어감)
    renderMe();
    // 가입 직후 창을 연달아 띄우지 않음(2026-10-24): 프로필 꾸미기 창은 자동으로 안 열고, 첫 출석 축하 창 하나만 뜸.
    // 환영 인사는 출석 창이 닫힌 뒤(또는 바로) 짧게
    const hi = () => toast(mode === 'signup' ? `환영해요, ${S.me.name}! 🎉${giftMsg(res)}` : `${S.me.name}, 반가워요!`, res?.gift > 0 ? 5000 : 1800);
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
  hit.forEach(n => { const x = f.elements[n]; if (x instanceof RadioNodeList) x[0]?.closest('.apick,.clubpick')?.classList.add('bad'); else x?.classList.add('bad'); });
  box.textContent = '⚠️ ' + msg; box.hidden = false;
  f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  const pw = f.elements.pw;
  if (hit.includes('pw') && pw && err.status) { pw.value = ''; pw.dispatchEvent(new Event('input', { bubbles: true })); pw.focus(); }
  else { const x = f.elements[hit[0]]; (x instanceof RadioNodeList ? x[0] : x)?.focus(); }
}
document.addEventListener('input', e => {
  const f = e.target.closest?.('#authForm'); if (!f) return;
  const t = e.target, up = f.dataset.mode === 'signup';
  t.classList.remove('bad'); t.closest('.apick,.clubpick')?.classList.remove('bad');
  if (t.name === 'handle') {   // 아이디: 치는 대로 소문자, 띄어쓰기 없앰 (커서 위치 유지)
    const v = t.value.toLowerCase().replace(/\s+/g, '');
    if (v !== t.value) { const p = t.selectionStart - (t.value.length - v.length); t.value = v; try { t.setSelectionRange(p, p); } catch {} }
    t.closest('.fld').classList.toggle('valid', up && HANDLE_OK.test(v));
  }
  if (t.name === 'name') f.querySelector('[data-cnt]').textContent = `${[...t.value].length}/20`;
  if (t.name === 'pw' && up) { const m = f.querySelector('.pwm'), lv = t.value ? pwLevel(t.value) : 0; const fill = t.value ? pwFill(t.value) : 0; if (lv > +m.dataset.lv) { const seg = m.querySelectorAll('i')[lv - 1]; seg.classList.remove('pop'); void seg.offsetWidth; seg.classList.add('pop'); } m.querySelectorAll('i').forEach((x, k) => x.style.setProperty('--f', Math.max(0, Math.min(1, fill - k)).toFixed(3))); m.dataset.lv = lv; m.classList.toggle('short', !!t.value && !lv); m.querySelector('em').textContent = t.value && !lv ? `${6 - t.value.length}자 더` : PW_TXT[lv]; }
  if (!f.querySelector('.bad')) f.querySelector('.ferr').hidden = true;
});

/* ===== 라운드 티어 배지 (2026-10-25) ===== */
const tierIc = k => `<svg class="tri${ffOn('tier-look', isDev(S.me)) ? ' tri2' : ''}" viewBox="0 0 48 44" aria-hidden="true"><use href="#${ffOn('tier-look', isDev(S.me)) ? 'tr2' : 'tr'}-${k}"/></svg>`;   // tr2 = 2차 엠블럼(미리보기)   // 티어 엠블럼(index.html #tr-*)
const tierBadge = (k, extra = '', tip = '') => { const t = tierOfK(k); return t ? `<span class="tierb t-${t.k}"${tip ? ` data-tip="${esc(tip)}"` : ''}>${tierIc(t.k)}${t.n}${extra}</span>` : ''; };
const tierChips = tr => !tr ? '' : (tr.cur ? tierBadge(tr.cur.k, '', `이번 라운드 ${tierOfK(tr.cur.k).n} · ${tr.cur.rank}위 · ${tr.cur.pts}점`) : '')
  + (tr.last ? `<span class="tierl" data-tip="지난 라운드 티어">${tierBadge(tr.last.k, ' <small>지난 라운드</small>')}</span>` : '');
// 프로필 티어 명판(2026-10-26 하율: "프로필에 티어가 더 잘 보일 수 있게") — 큰 엠블럼 + 티어 이름 + 순위·점수, 지난 라운드는 옆에 작게
// 레디언트(2026-10-26 하율): 개발자 계정 전용 티어 — 로고(G) 엠블럼 + 반짝임. 티어표(TIERS·계단·TOP 10)엔 없고 프로필·내 티어 칸에만
const RADIANT = { k: 'radiant', n: '레디언트' };
const radOn = u => isDev(u) && ffOn('tier-radiant', isDev(S.me));
const radIc = () => '<svg class="tri tri2 tri-rd" viewBox="0 0 48 44" aria-hidden="true"><use href="#tr2-radiant"/></svg>';
const tierPlate = (tr, u) => {
  if (radOn(u)) return `<div class="ptier2"><div class="tplate t-radiant" data-tip="개발자 전용 티어 · 순위·티어표에는 나오지 않아요"><span class="tp-em">${radIc()}</span><span class="tp-tx"><small>개발자 전용 티어</small><b>${RADIANT.n}</b><em>순위에 포함되지 않아요</em></span></div></div>`;
  if (!tr || (!tr.cur && !tr.last)) return '';
  const c = tr.cur && tierOfK(tr.cur.k);
  const last = tr.last ? `<span class="tierl" data-tip="지난 라운드 티어">${tierBadge(tr.last.k, ' <small>지난 라운드</small>')}</span>` : '';
  const chOn = ffOn('tier-champ', isDev(S.me));
  const up = chOn && c && tr.last && tr.last.n === tr.cur.n - 1 && tIx(tr.last.k) - tIx(c.k) > 0 ? `<span class="tch-up">▲ ${tIx(tr.last.k) - tIx(c.k)}계단 <small>지난 라운드보다</small></span>` : '';
  const chs = chOn && tr.cur?.ch?.length ? `<div class="pch">${tr.cur.ch.filter(g => GAMES[g]).map(g => `<span class="pch-c">${ic(GAMES[g].ic)}${GAMES[g].name} <b>1등</b></span>`).join('')}<small>이번 라운드</small></div>` : '';
  return c ? `<div class="ptier2"><div class="tplate t-${c.k}"><span class="tp-em">${tierIc(c.k)}</span><span class="tp-tx"><small>이번 라운드 티어</small><b>${c.n}</b><em>${tr.cur.rank}위 · ${tr.cur.pts}점</em>${up}</span></div>${last}</div>${chs}` : `<p class="ptier">${last}</p>`;
};

/* ===== 역대 1등 왕관 패 (2026-10-25 하율: 더 자세하고 화려하게) — 기록 · 며칠째 1위 · 2등과 차이 · 참가 인원 ===== */
const CROWN_GAP = { home: v => v.toLocaleString('ko-KR') + 'm', reaction: v => v + 'ms', num25: v => (v / 1000).toFixed(2) + '초', cut: v => v + 'ms' };
function crownHtml(c) {
  if (typeof c === 'string') c = { g: c };   // 옛 응답 형식(게임 이름만)
  const g = GAMES[c.g]; if (!g) return '';
  const days = c.at ? Math.max(1, Math.floor((Date.now() - c.at) / 864e5) + 1) : 0;
  const since = c.at ? new Date(c.at) : null;
  const meta = [c.n && `<span>${ic('trophy')}${c.n}명 중 1위</span>`,
    days && `<span data-tip="${since.getMonth() + 1}월 ${since.getDate()}일부터">${ic('fire')}${days}일째 지키는 중</span>`,
    c.gap != null ? `<span>${ic('ruler')}2등과 ${c.gap ? esc(CROWN_GAP[c.g]?.(c.gap) ?? c.gap) : '동점'} 차이</span>` : c.n ? `<span>${ic('flag')}유일한 도전자</span>` : ''].filter(Boolean).join('');
  return `<div class="crown2" aria-label="${esc(g.name)} 역대 1등${c.best != null ? ' · ' + esc(g.fmt(c.best)) : ''}">
    <i class="cr-shine" aria-hidden="true"></i><i class="cr-spk s1" aria-hidden="true"></i><i class="cr-spk s2" aria-hidden="true"></i><i class="cr-spk s3" aria-hidden="true"></i>
    <span class="cr-medal" aria-hidden="true">${ic('trophy', 'cr-crown')}<b>1</b></span>
    <span class="cr-txt"><small>${ic(g.ic)}${esc(g.name)} · 역대 1등</small>${c.best != null ? `<b class="cr-rec">${esc(g.fmt(c.best))}</b>` : '<b class="cr-rec">1등</b>'}${meta ? `<span class="cr-meta">${meta}</span>` : ''}</span>
  </div>`;
}

/* ===== 프로필 카드 ===== */
const STK_POS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'];
function profileHtml(d) {
  const u = d.user, self = d.me;
  // 학년·반 · 학과 · 동아리를 이름 바로 아래 눈에 띄게 (2026-10-25 하율) — 학과는 반 번호로(1·2 콘텐츠, 3·4 미디어, 5·6 프로듀스 — 가입 화면 dephint와 같음)
  const dep = !isDev(u) && u.cls ? [null, ['con', '콘텐츠과', 'clap'], ['con', '콘텐츠과', 'clap'], ['med', '미디어과', 'palette'], ['med', '미디어과', 'palette'], ['pro', '프로듀스과', 'monitor'], ['pro', '프로듀스과', 'monitor']][+u.cls] : null;
  const chips = [classTxt(u) && `<span class="pi-c pi-cls">${ic('book')}${esc(classTxt(u))}</span>`,
    dep && `<span class="pi-c pi-dep d-${dep[0]}">${ic(dep[2])}${dep[1]}</span>`,
    u.club && `<span class="pi-c pi-club">${clubLogo(u.club, 'pi-logo') || ic('cam')}${esc(u.club)}</span>`].filter(Boolean).join('');
  const sk = d.streak || {}, tier = ' t' + ATT.tierOf(sk.cur || 0);
  const streak = !(sk.cur || sk.best) ? '' : `<button type="button" class="pstreak${sk.cur ? tier : ' off'}${sk.pf && sk.cur >= 3 ? ' pf' : ''}" ${self ? 'data-att-open' : ''} data-tip="최고 ${ATT.fmtN(sk.best)}일 · 총 ${sk.total}일 출석${sk.pf && sk.cur >= 3 ? ' · 완벽한 연속' : ''}">${ATT.flame('fsm', { off: !sk.cur, tier: ATT.tierOf(sk.cur || 0) })}<b>${sk.cur >= 1e6 ? '무한 연속 출석' : sk.cur ? `${sk.cur}일 연속 출석` : '연속 출석 쉬는 중'}</b></button>`;
  const ttl = u.title ? `<p class="ptitle${isDev(u) ? ' dev' : ''}${u.title === HOME_TITLE ? ' first' : ''}"><span>${ui('tag', 'ic')}${ttlHtml(u.title)}</span></p>` : '';
  const tch = tierChips(d.tier);
  const crowns = (d.crowns || []).map(crownHtml).join('');
  const r = d.rel || {};
  const mutual = r.following && r.followsMe;
  const actions = self
    ? isDev(u) ? `<a class="btn dv-adm" href="/admin/#monitor">${ic('tool')}관리자 페이지</a><button class="btn lime" data-act-s="edit">${ic('pencil')}꾸미기</button><button class="btn ghost" data-act-s="logout">로그아웃</button>`   // 개발자: 꾸미기(제한 없음) · 계정 설정 없음
      : S.me?.sw ? ''   // 테스트 계정: 학과 바꾸기·개발자로 돌아가기만(아래 swBar)
      : `<button class="btn" data-act-s="edit">${ic('pencil')}프로필 꾸미기</button><button class="btn ghost icb" data-act-s="settings" aria-label="계정 설정" data-tip="계정 설정"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-gear"/></svg></button>`
    : r.blocked ? `<button class="btn ghost" data-block="${esc(u.handle)}" data-on="0">차단 풀기</button>`
    : `<button class="btn ${r.following ? 'ghost' : ''}" data-follow="${esc(u.handle)}" data-on="${r.following ? 0 : 1}">${r.following ? '팔로잉 ✓' : r.followsMe ? '맞팔로우 하기' : '팔로우'}</button>
       <button class="btn ${(d.canDm ?? mutual) ? 'lime' : 'ghost'}" data-dm="${esc(u.handle)}" ${(d.canDm ?? mutual) ? '' : 'data-locked="1"'}>💬 ${isDev(u) ? '개발자에게 DM' : 'DM'}</button>
       <button class="btn ghost" data-act-s="more" data-h="${esc(u.handle)}" aria-label="더보기">⋯</button>`;
  const bests = gamesOn().map(([k, g]) => `<li><span>${ic(g.ic)}</span><small>${g.name}</small><b>${d.bests?.[k] != null ? esc(g.fmt(d.bests[k])) : '-'}</b></li>`).join('');
  // 프로필 게임 기록 2(2026-10-28 하율: 게임이 늘수록 세로 목록이 지저분) — 한 기록 = 2칸 격자 타일, 안 한 게임은 아래 작은 아이콘 한 줄로 모음 · 미리보기 깃발 pbest-v2
  const gOn = gamesOn(), gHas = gOn.filter(([k]) => d.bests?.[k] != null), gNo = gOn.filter(([k]) => d.bests?.[k] == null);
  const bests2 = `<section class="pgrec" aria-label="게임 최고 기록"><p class="pg-h"><span>${ic('trophy')}게임 기록</span><small>${gHas.length}/${gOn.length}개 플레이</small></p>${gHas.length ? `<ul class="pg-grid">${gHas.map(([k, g]) => `<li><small>${ic(g.ic)}<span>${g.name}</span></small><b>${esc(g.fmt(d.bests[k]))}</b></li>`).join('')}</ul>` : '<p class="pg-none">아직 플레이한 게임이 없어요</p>'}${gNo.length && gHas.length ? `<p class="pg-no"><small>안 한 게임</small>${gNo.map(([, g]) => `<i data-tip="${esc(g.name)}" aria-label="${esc(g.name)}">${ic(g.ic)}</i>`).join('')}</p>` : ''}</section>`;
  return `<article class="pcard c-${esc(u.color)}${isDev(u) ? ' dev' : ''}${u.gcm ? ' gcm' : ''}${!isDev(u) && sk.cur >= FLAME_AT[1] ? ' hot' : ''}">${isDev(u) ? pfxDev() : u.pfx === 'r:fxstar' ? pfxStars() : ''}
    <div class="pban" aria-hidden="true">${(u.stickers || []).slice(0, stkMax(u)).map((s, i) => `<i class="stk ${STK_POS[i]}">${emo(s, 'stka')}</i>`).join('')}</div>
    <div class="pbody">
      <div class="phead">
        ${av(u, 'big', avWear(u.mfx) + (isDev(u) ? pdBurst() : ''))}
        <div class="pid">
          ${u.mood ? `<p class="pmood"><span>${esc(u.mood)}</span></p>` : ''}
          <div class="pnrow"><h2 class="pname">${esc(nameOf(u))}${repTag(u)}</h2><p class="pstats ig"><button type="button" data-people="followers" data-h="${esc(u.handle)}">팔로워 <b>${d.counts.followers}</b></button><button type="button" data-people="following" data-h="${esc(u.handle)}">팔로잉 <b>${d.counts.following}</b></button></p></div>${ttl}${chips ? `<p class="pinfo">${chips}</p>` : ''}${ffOn('tier-profile', isDev(S.me)) || radOn(u) ? tierPlate(d.tier, u) : tch ? `<p class="ptier">${tch}</p>` : ''}
          <p class="phandle">${[isDev(u) ? `<span class="pdevtag">${ic('tool')}SVMHS GROUND 개발자</span>` : esc(atOf(u)), u.online && !self ? '<b class="onl">접속 중</b>' : '', !self && r.followsMe ? '<span class="fm">나를 팔로우함</span>' : ''].filter(Boolean).join(' · ')}</p>
        </div>
        ${actions ? `<div class="pact">${actions}</div>` : ''}
      </div>
      <div class="pcols">
        <div class="pmain">
          ${isDev(u) ? '<button class="pdev" type="button" data-fb><svg class="sic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chat"/></svg><span>궁금한 점·원하는 기능은 DM으로 편하게 보내 주세요! <span class="nw">팔로우 안 해도 돼요</span></span></button>' : ''}
          ${isDev(u) ? '' : u.bio ? `<p class="pbio">${esc(u.bio)}</p>` : self ? '<p class="pbio muted">아직 소개가 없어요. 프로필 꾸미기에서 적어 보세요!</p>' : ''}
          ${crowns ? `<p class="pcrowns">${crowns}</p>` : ''}
          ${u.insta ? `<a class="pinsta" href="https://www.instagram.com/${encodeURIComponent(u.insta)}/" target="_blank" rel="noopener noreferrer" aria-label="인스타그램 @${esc(u.insta)} 열기 (새 창)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/></svg>@${esc(u.insta)}<span aria-hidden="true">↗</span></a>` : ''}
        </div>
        <aside class="pside">
          ${streak}
          ${isDev(u) ? '' : ffOn('pbest-v2', isDev(S.me)) ? bests2 : `<ul class="pbest" aria-label="게임 최고 기록">${bests}</ul>`}
          ${achProf(d, u)}
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
  if (!box.querySelector('.pcard:not(.skz)')) box.innerHTML = ghProfile(true);
  try {
    const d = await call('user/' + encodeURIComponent(S.me.handle)); S.meProf = d;
    box.innerHTML = profileHtml(d) + `
      <section class="card findcard">
        <div class="ct"><h2>👋 친구 찾기</h2></div>
        <form class="form" id="findForm" autocomplete="off" role="search"><input id="findQ" placeholder="아이디나 이름으로 검색" maxlength="16" aria-label="친구 검색"><button class="btn">검색</button></form>
        <p class="note" id="findNote">최근에 들어온 친구들</p>
        <ul class="plist" id="findList" data-swap>${ghPeople(4)}</ul>
      </section>`;
    findPeople('');
    if (wantFind) {   // 프로필 등장 효과·사진이 늦게 자리 잡아 높이가 바뀜 → 1.2초 동안 자리가 바뀌면 다시 맞춤
      wantFind = false;
      const f = box.querySelector('.findcard'), t0 = Date.now(); let last = -1;
      const sc = () => { if (!f.isConnected || location.hash !== '#me') return; const y = Math.max(0, f.getBoundingClientRect().top + scrollY - 76); if (Math.abs(y - last) > 2) { scrollTo({ top: y, behavior: last < 0 ? 'smooth' : 'auto' }); last = y; } if (Date.now() - t0 < 1200) setTimeout(sc, 150); };
      requestAnimationFrame(sc);
    }
  } catch (e) { box.innerHTML = `<div class="card"><p class="empty">${esc(e.message)}</p></div>`; }
}
// 홈 친구 카드의 '친구 찾기'(2026-10-25 하율): 프로필 화면을 열고 바로 아래 친구 찾기 칸까지 내려 줌
let wantFind = false;
document.addEventListener('click', e => { if (e.target.closest('[data-find]')) wantFind = true; }, true);
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
  box.innerHTML = ghProfile(false);
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
    sheet(`<h3>${title}</h3><ul class="plist" id="pplList" data-swap>${ghPeople(4)}</ul><div class="row"><button class="btn ghost" data-close>닫기</button></div>`);
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
// 미리보기 = 실제 화면 그대로(2026-10-25 하율: "적용했을 때 화면이랑 똑같이"):
// 프로필은 진짜 프로필 카드(profileHtml)를 지금 고른 값으로 그려 실제 폭으로 놓고 줄여 보여 주고,
// 시계는 첫 화면 시계(#bigclock .clock)를 그대로 복제해 지금 고른 시계 스티커만 바꿔 끼움 — 따로 흉내 낸 그림이 없어서 어긋날 일이 없음
function pvHtml(u, st) {
  const fx = S.me?.gc?.fx || {}, fxOn = Object.keys(FX).filter(k => fx[k]);
  const base = S.meProf?.user?.handle === u.handle ? S.meProf : { counts: { followers: 0, following: 0 }, streak: {}, crowns: [], bests: {}, rel: {}, user: u };
  const user = { ...base.user, ...st.f, avatar: st.avatar, color: st.color, stickers: st.stickers, rep: st.rep, title: st.title, nfx: fx.name || '', pfx: fx.prof || '', mfx: fx.masc || '', online: false };
  return `<div class="pv-top"><b>미리보기</b><small>적용하면 이렇게 보여요</small><button type="button" class="pv-fold" data-pv-fold aria-label="미리보기 접기·펴기"><span class="o">접기</span><span class="c">펴기</span></button></div>
    <div class="pv-body">
      <div class="pv-real pv-rp" aria-hidden="true"><div class="pv-sc">${profileHtml({ ...base, me: true, user })}</div></div>
      <div class="pv-real pv-rc" aria-hidden="true"><div class="pv-sc"></div></div>
    </div>
    <button type="button" class="pv-fxs" data-ed-go="fx">${fxOn.length ? `${fxOn.map(k => artOf(fx[k], 'pka')).join('')}<span>효과 <b>${fxOn.length}개</b> 켜짐</span>` : '<span>켜 둔 뽑기 효과 없음</span>'}<i aria-hidden="true">›</i></button>`;
}
// 실제 프로필 화면 폭(보이는 #meBox가 있으면 그 폭, 없으면 main 안에 .soc를 잠깐 놓고 잼) — 같은 폭으로 그려야 줄바꿈·배치가 실제와 같음
function realProfW() {
  const live = $('#meBox'); if (live?.offsetWidth) return live.offsetWidth;
  // 프로필 화면이 숨어 있으면 잠깐 자리만 차지하지 않게(높이 0·안 보이게) 펼쳐서 실제 폭을 잼 — 화면 폭별 규칙(#v-me .soc 820/910px)이 그대로 걸림
  const v = $('#v-me'); if (!v || !live) return 640;
  const keep = v.style.cssText; v.style.cssText = 'display:block!important;visibility:hidden;height:0;overflow:hidden;margin:0;padding:0';
  const w = live.offsetWidth; v.style.cssText = keep;
  return w || 640;
}
// 첫 화면 시계 복제: id는 지우고, JS로 넣은 위치값(style)도 그대로 옮김(CSP — 속성 복사 대신 cssText)
function cloneClock(deco) {
  const live = $('#bigclock .clock'), stage = $('#bigclock'); if (!live || !stage) return null;
  const sec = document.createElement('section'); sec.className = stage.className + ' pv-stage';
  const c = live.cloneNode(true), a = [live, ...live.querySelectorAll('*')], b = [c, ...c.querySelectorAll('*')];
  b.forEach((x, i) => { x.removeAttribute('id'); x.removeAttribute('role'); if (a[i]?.style?.cssText) x.style.cssText = a[i].style.cssText; });
  [1, 2, 3, 4, 5].forEach(i => { const el = c.querySelector('.du' + i), v = deco[i - 1]; if (!el) return; el.innerHTML = v ? emo(v, 'dua') : ''; el.classList.toggle('on', !!v); c.classList.toggle('d' + i, !!v); });
  sec.append(c); return sec;
}
// 실제 크기로 그린 걸 칸 폭에 맞게 줄임. 시계는 숫자 밖으로 삐져나온 스티커까지 다 들어오게 테두리를 잼
function fitPv(box) {
  box.querySelectorAll('.pv-real').forEach(w => {
    const sc = w.firstElementChild; if (!sc) return;
    const W = w.clientWidth - 10; if (W <= 0) return;   // 10: 카드 그림자·기울기 여유
    if (w.classList.contains('pv-rp')) {
      const nat = realProfW();
      sc.style.width = nat + 'px';
      const s = Math.min(1, W / nat);
      sc.style.transform = `scale(${s})`; w.style.height = Math.ceil(sc.offsetHeight * s) + 12 + 'px';
      return;
    }
    // 시계: 숫자 밖으로 나온 스티커까지 다 넣음. 창이 열리며 커지는 중이어도 맞게 — 화면상 크기를 조상 배율로 나눠 실제 크기로 환산
    sc.style.transform = 'none';
    const o = sc.getBoundingClientRect(), k = o.width / (sc.offsetWidth || 1) || 1;
    let x0 = 0, y0 = 0, x1 = sc.offsetWidth, y1 = sc.offsetHeight;
    sc.querySelectorAll('.clock, .clock *').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; x0 = Math.min(x0, (r.left - o.left) / k); y0 = Math.min(y0, (r.top - o.top) / k); x1 = Math.max(x1, (r.right - o.left) / k); y1 = Math.max(y1, (r.bottom - o.top) / k); });
    const pad = 10, bw = x1 - x0 + pad * 2, bh = y1 - y0 + pad * 2, Wc = w.clientWidth, s = Math.min(1, Wc / bw);
    sc.style.transform = `translate(${(Wc - bw * s) / 2 - (x0 - pad) * s}px, ${-(y0 - pad) * s}px) scale(${s})`;
    w.style.height = Math.ceil(bh * s) + 'px';
  });
}
// 메뉴의 '꾸미기': 지금 화면 위에 바로 꾸미기 창(닫으면 보던 화면 그대로 — 2026-10-25: 프로필로 넘어가지 않게)
// 새로 얻은 뽑기 보상이 있으면 그 칸이 있는 탭으로 바로 열림(스티커 먼저, 없으면 효과)
document.getElementById('btnEdit')?.addEventListener('click', () => { if (!S.me) return; const n = NW.count(); openEdit(n.stk ? { tab: 'stk' } : n.fx ? { tab: 'fx' } : {}); });
// o: { tab, sub, v } — 뽑기 화면 '착용하러 가기'에서 그 탭을 열고 그 칸으로 스크롤·반짝
function openEdit(o = {}) {
  const u = S.me; if (!u) return;
  const picked = new Set(u.stickers || []);
  const deco = [...(u.deco || [])], slots = isDev(u) ? 5 : decoSlots(u.attBest, u.attTotal);
  const tab0 = ['info', 'face', 'stk', 'fx'].includes(o.tab) ? o.tab : ['info', 'face', 'stk', 'fx'].includes(store.get('ed_tab')) ? store.get('ed_tab') : 'face';
  const sub0 = ['st', 'rep', 'deco'].includes(o.sub) ? o.sub : ['st', 'rep', 'deco'].includes(store.get('ed_sub')) ? store.get('ed_sub') : 'st';
  if (o.tab) store.set('ed_tab', tab0); if (o.sub) store.set('ed_sub', sub0);
  const TABS = [['info', '기본 정보'], ['face', '프로필 꾸미기'], ['stk', '스티커'], ['fx', '효과']];
  const SUBS = [['st', '카드'], ['rep', '대표'], ['deco', '시계']];
  const viewSeg = `<div class="pk-view" role="group" aria-label="꾸미기 목록 보기"><div class="pk-seg">${[['all', '모두 보기'], ['own', '보유한 것만']].map(([k, n]) => `<button type="button" data-view="${k}" class="${pkView() === k ? 'on' : ''}" aria-pressed="${pkView() === k}">${n}</button>`).join('')}</div></div>`;
  sheet(`<div class="ed-hd"><h3>프로필 꾸미기</h3><button type="button" class="ed-x" data-ed-x aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button></div>
    <form class="sform ed" id="editForm" autocomplete="off" data-tab="${tab0}" data-sub="${sub0}">
     <div class="ed-main">
      <aside class="ed-pv"><div class="pv${store.get('pv_fold', 0) ? ' fold' : ''}" id="edPrev" aria-live="polite"></div></aside>
      <div class="ed-side">
       <div class="ed-tabs" role="tablist">${TABS.map(([k, n]) => `<button type="button" role="tab" data-ed-tab="${k}" aria-selected="${k === tab0}"${k === 'stk' || k === 'fx' ? ` data-nw-kind="${k}"` : ''}>${n}</button>`).join('')}</div>
       <div class="ed-body">
      <div class="ed-pane" data-pane="info">
      <label>이름 (닉네임)<input name="name" maxlength="20" required value="${esc(u.name)}"><small class="hint">${isDev(u) ? '🛠 개발자 계정은 이름·아이디 대신 어디서나 \'개발자\'로 표시돼요.' : `친구들에게 보이는 이름이에요. 로그인은 아이디 @${esc(u.handle)}로 해요.`}</small></label>
      <label>상태 메시지<input name="mood" maxlength="24" placeholder="예: 시험 끝나면 놀자🔥" value="${esc(u.mood)}"></label>
      <label>소개<textarea name="bio" maxlength="80" rows="2" placeholder="나를 한 줄로 소개해 보세요">${esc(u.bio)}</textarea></label>
      ${isDev(u) ? '<input type="hidden" name="grade" value="0"><input type="hidden" name="cls" value="0">' : `<div class="two"><label>학년<select name="grade"><option value="0">비공개</option>${[1, 2, 3].map(g => `<option value="${g}" ${u.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label>
        <label>반<select name="cls"><option value="0">비공개</option>${Array.from({ length: CLS_N }, (_, i) => `<option value="${i + 1}" ${u.cls === i + 1 ? 'selected' : ''}>${i + 1}반</option>`).join('')}</select></label></div>`}
      <div class="two"><label>인스타 아이디<span class="fld at ig"><span class="pre" aria-hidden="true">@</span><input name="insta" maxlength="60" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="선택" value="${esc(u.insta || '')}"></span></label>
      </div>
      <small class="hint">인스타 아이디를 적으면 프로필에 버튼이 생겨요.${isDev(u) ? ' 개발자 계정은 학년·반이 표시되지 않아요.' : ''}</small>
      <fieldset class="clubpick"><legend>동아리 <small>고르면 프로필에 로고로 보여요</small></legend><div class="cp-grid">
        <label class="cp-i none"><input type="radio" name="club" value="" ${u.club ? '' : 'checked'}><span><i class="cp-x" aria-hidden="true">없음</i><b>없음</b></span></label>
        ${CLUBS.map(([k, n]) => `<label class="cp-i"><input type="radio" name="club" value="${esc(n)}" ${u.club === n ? 'checked' : ''}><span><img src="/clubs/${k}.webp" alt="" loading="lazy" width="128" height="128"><b>${esc(n)}</b></span></label>`).join('')}
        ${u.club && !clubOf(u.club) ? `<label class="cp-i"><input type="radio" name="club" value="${esc(u.club)}" checked><span><i class="cp-x" aria-hidden="true">${esc(u.club.slice(0, 2))}</i><b>${esc(u.club)}</b></span></label>` : ''}
      </div></fieldset>
      </div>
      <div class="ed-pane" data-pane="face">
      ${pkSec('프로필 사진', '내 프로필 · 친구 목록 · DM · 랭킹에 보이는 내 얼굴', viewSeg)}
      <div class="pick" id="pAv">${pkDiv('기본')}${AVATARS.map(a => `<button type="button" data-v="${a}" class="${a === (isDev(u) ? '' : u.avatar) ? 'on' : ''}${a === 'k:shark' ? ' ff-shark' : ''}" data-tip="${kavName(a)}" aria-label="${kavName(a)}">${emo(a)}</button>`).join('')}${attDiv('avatar')}${attPicks('avatar', x => !isDev(u) && x === u.avatar)}</div></section>
      ${pkSec('배경 색', '프로필 사진 뒤 동그라미 · 프로필 카드 윗부분 색', '')}
      <div class="pick csw" id="pCo">${pkDiv('기본')}${COLORS.map(c => `<button type="button" data-v="${c}" class="c-${c} ${c === u.color ? 'on' : ''}" data-tip="${COLOR_KO[c] || c}" aria-label="${COLOR_KO[c] || c}"></button>`).join('')}${attDiv('color')}${attPicks('color', x => x === u.color)}</div></section>
      <section class="pk-sec">${isDev(u) ? `<label>칭호 <small class="att-sm">개발자 전용 · 직접 쓰기</small><input name="title" maxlength="12" value="${esc(u.title || '')}" placeholder="예: 그라운드 주인"><small class="hint">마음대로 적을 수 있어요(12자). 무지개 칭호로 보여요.</small></label>` : `<label>칭호 <small class="att-sm">${ATT.flame('fsm', { tier: 1 })}출석 보상</small><select name="title">${titleOpts(u.title)}</select><small class="hint">프로필 이름 아래와 출석 순위에 보여요. 출석할수록 더 열려요.</small></label>`}</section>
      </div>
      <div class="ed-pane" data-pane="stk">
      <div class="ed-subbar"><div class="ed-sub" role="tablist">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-ed-sub="${k}" aria-selected="${k === sub0}" data-nw-kind="stk">${n}<b data-subn="${k}"></b></button>`).join('')}</div>${viewSeg}</div>
      <div class="ed-sp" data-sp="st">${pkSec('프로필 카드 스티커', '내 프로필 카드 윗부분(별 배경)에 붙어요 · 여러 개 고르기', `<b id="stkN">${picked.size}/${stkMax(u)}</b><button type="button" class="pk-clr" data-clr="st">${ui('peel', 'ic')}모두 떼기</button>`)}
      <div class="pick" id="pSt">${pkDiv('기본')}${STICKERS.map(s => `<button type="button" data-v="${s}" class="${picked.has(s) ? 'on' : ''}" data-tip="${EMO_NAME[s] || s}" aria-label="${EMO_NAME[s] || s}">${s}</button>`).join('')}${attDiv('sticker')}${attPicks('sticker', x => picked.has(x))}</div></section></div>
      <div class="ed-sp" data-sp="rep">${pkSec('대표 스티커', '이름 바로 옆에 작게 붙어요 · 댓글 · 랭킹 · DM · 친구 목록 어디서나', `<b>${isDev(u) ? '3개까지' : '1개'}</b><button type="button" class="pk-clr" data-clr="rep">${ui('peel', 'ic')}떼기</button>`)}
      <div class="pick" id="pRep"><button type="button" data-v="" class="att-none ${u.rep ? '' : 'on'}" data-tip="대표 스티커 안 달기">없음</button>${attDiv('sticker')}${attPicks('sticker', x => String(u.rep || '').split(',').includes(x))}</div></section></div>
      <div class="ed-sp" data-sp="deco">${pkSec('첫 화면 시계 스티커', '내 첫 화면 큰 시계 둘레에 붙어요 · 나만 보여요', `<b id="decoN"></b><button type="button" class="pk-clr" data-clr="deco">${ui('peel', 'ic')}모두 떼기</button>`)}
      <div class="pick" id="pDeco">${attDiv('sticker')}${attPicks('sticker', x => deco.includes(x))}</div>
      <small class="hint">칸은 연속 ${rwDay('perk', 'deco2').d}일·총 ${rwDay('perk', 'deco3').d}일 출석으로 하나씩 늘어나요.</small></section></div>
      <div class="ed-stkft"><p class="hint att-hint">불꽃 칸 색이 칠해진 건 출석 보상이에요. 헤더의 불꽃 버튼에서 기록과 받는 방법을 볼 수 있어요.</p><button type="button" class="pv-clr" data-clr="all" data-tip="카드·대표·시계 스티커를 한 번에 떼요 · 저장해야 반영돼요">${ui('peel', 'ic')}스티커 전부 떼기</button></div>
      </div>
      <div class="ed-pane" data-pane="fx" id="edFx"></div>
       </div>
      </div>
     </div>
     <div class="ed-ft"><button class="btn ghost" type="button" data-ed-x>취소</button><button class="btn" type="submit">저장</button></div>
    </form>`);
  pkApply();
  NW.paint($('#editForm'));
  if (o.v) setTimeout(() => {   // 착용하러 가기: 그 칸을 화면 가운데로 + 반짝
    const b = $(`#editForm .ed-pane[data-pane="${tab0}"] ${tab0 === 'stk' ? `.ed-sp[data-sp="${sub0}"] ` : ''}[data-v="${CSS.escape(o.v)}"]`);
    if (!b) return; b.scrollIntoView({ block: 'center', behavior: 'smooth' }); b.classList.remove('nw-flash'); void b.offsetWidth; b.classList.add('nw-flash');
  }, 60);
  $$('#editForm .pk-seg').forEach(g => { g.onclick = e => { const b = e.target.closest('[data-view]'); if (!b) return; store.set('edit_view', b.dataset.view); pkApply(); }; });
  // 탭(기본 정보·프로필 꾸미기·스티커·효과) + 스티커 안 작은 탭(카드·대표·시계) — 한 번에 한 묶음만 보여서 스크롤이 짧음, 마지막 탭은 기억
  const goTab = k => { const f = $('#editForm'); f.dataset.tab = k; store.set('ed_tab', k); $$('#editForm [data-ed-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.edTab === k)); $('#editForm .ed-body').scrollTop = 0; if (k === 'fx') paintFx(); };
  const goSub = k => { const f = $('#editForm'); f.dataset.sub = k; store.set('ed_sub', k); $$('#editForm [data-ed-sub]').forEach(b => b.setAttribute('aria-selected', b.dataset.edSub === k)); $('#editForm .ed-body').scrollTop = 0; };
  $('#socSheet .ed-x').onclick = () => closeSheet();
  $('#editForm').addEventListener('click', e => {
    if (e.target.closest('[data-ed-x]')) { e.preventDefault(); return closeSheet(); }
    const t = e.target.closest('[data-ed-tab]'); if (t) return goTab(t.dataset.edTab);
    const sb = e.target.closest('[data-ed-sub]'); if (sb) return goSub(sb.dataset.edSub);
    const g = e.target.closest('[data-ed-go]'); if (g) return goTab(g.dataset.edGo);
    const fb = e.target.closest('[data-ed-fx]'); if (fb) return edSetFx(fb.dataset.edFx, fb.dataset.v);
  });
  // 효과 탭: 켜 둔 뽑기 효과(칸마다 가진 것 중 하나 켜기/끄기 — 바로 저장) + 네온 색(이 기기)
  const paintFx = () => {
    const box = $('#edFx'); if (!box) return;
    const g = S.me?.gc || {}, fx = g.fx || {}, own = g.own || {};
    box.innerHTML = `<p class="ed-note">뽑기 전설·시크릿으로 받은 효과예요. 누르면 <b>바로 켜지고 꺼져요</b>(저장 안 눌러도 돼요).</p><ul class="ed-fxl">${Object.entries(FX).map(([slot, nm]) => {
      const pool = [...GACHA, ...HIDDEN.filter(h => own[h.v])];   // 히든 보상은 가진 사람에게만
      const mine = pool.filter(x => x.fx === slot && own[x.v]), on = fx[slot];
      const show = pool.find(x => x.v === on) || mine[0] || GACHA.find(x => x.fx === slot && x.rar === 3);
      return `<li class="${on ? 'on' : mine.length ? '' : 'none'}"><div class="ed-fxh"><span class="ed-fxi">${mine.length ? artOf(show.v, 'pka') : ui('lock', 'ic')}</span><p><b>${esc(nm)}</b><small>${mine.length ? (on ? `${esc(objName(on))} 켜짐` : '꺼짐') : `아직 없어요 · 뽑기 전설에서 나와요`}</small></p></div>
        ${mine.length ? `<div class="ed-fxb"><button type="button" class="${on ? '' : 'on'}" data-ed-fx="${slot}" data-v="">끄기</button>${mine.map(x => `<button type="button" class="${on === x.v ? 'on' : ''}" data-ed-fx="${slot}" data-v="${x.v}" data-nw="${x.v}">${artOf(x.v, 'pka')}${esc(objName(x.v))}</button>`).join('')}</div>` : ''}
        ${slot === 'clock' && on === 'r:fxneon' ? `<div class="ed-neon"><small>네온 색 <em>이 기기에 저장</em></small><div class="ed-ncs" role="radiogroup" aria-label="네온 색">${NEON.map(([k, n]) => `<button type="button" role="radio" aria-checked="${neonC() === k}" class="ed-nc nc-${k}${neonC() === k ? ' on' : ''}" data-neon-c="${k}"><i></i>${n}</button>`).join('')}</div></div>` : ''}
        ${slot === 'masc' && on ? '<p class="ed-note sm">씌울 곳(캐릭터·시계·로고)은 서비스 › 뽑기 › 내 효과에서 골라요.</p>' : ''}</li>`;
    }).join('')}</ul>`;
    NW.paint(box);
  };
  let fxBusy = false;
  const edSetFx = async (slot, v) => {
    if (fxBusy || (S.me?.gc?.fx?.[slot] || '') === v) return; fxBusy = true;
    try { const r = await call('gcfx', { slot, v }); setGc(r); paintFx(); prev(); toast(v ? `${objName(v)} 켰어요` : '효과를 껐어요'); }
    catch (err) { fail(err); } finally { fxBusy = false; }
  };
  $('#editForm').addEventListener('click', e => { if (e.target.closest('[data-neon-c]')) setTimeout(prev, 0); });   // 네온 색 → 미리보기 시계
  if (tab0 === 'fx') paintFx();
  const sel = { avatar: u.avatar, color: u.color, rep: u.rep || '' };
  // 실시간 미리보기: 고르는 즉시 프로필 카드·이름 옆·시계에 어떻게 붙는지 보여 줌(바뀐 곳은 반짝)
  $('#socSheet').classList.add('edw');   // 꾸미기 창은 미리보기가 잘 보이게 넓게
  const F = $('#editForm');
  let clrSync = () => {};
  const fv = () => { const e = F.elements; return { name: e.name.value.trim() || u.name, mood: e.mood?.value.trim() ?? u.mood, bio: e.bio?.value.trim() ?? u.bio, grade: +(e.grade?.value ?? u.grade) || 0, cls: +(e.cls?.value ?? u.cls) || 0, club: e.club ? e.club.value : u.club, insta: e.insta ? e.insta.value.trim().replace(/^@/, '') : u.insta }; };
  let ckObs = null, fitT = 0;
  const prev = () => {
    const box = $('#edPrev'); if (!box) return;
    box.innerHTML = pvHtml(u, { ...sel, stickers: [...picked], deco, f: fv(), title: F.elements.title?.value || '', max: stkMax(u), slots });
    const ck = cloneClock(deco), slot = box.querySelector('.pv-rc .pv-sc');
    if (ck) slot.append(ck); else box.querySelector('.pv-rc').remove();
    // 첫 화면 시계가 바뀌면(1초마다·네온 관 붙임) 복제본 숫자도 같이
    ckObs?.disconnect(); const bt = $('#bigTime');
    if (ck && bt) { ckObs = new MutationObserver(() => { const t = box.querySelector('.pv-rc .s-big'); if (!t?.isConnected) { ckObs.disconnect(); return; } t.innerHTML = bt.innerHTML; t.className = bt.className; const st = $('#bigclock'); if (st) ck.className = st.className + ' pv-stage'; }); ckObs.observe(bt, { childList: true, subtree: true, characterData: true, attributes: true }); }
    fitPv(box); clearTimeout(fitT); fitT = setTimeout(() => fitPv(box), 400);   // 창 열림 애니메이션·글꼴 뒤에 한 번 더
    document.fonts?.ready?.then(() => box.isConnected && fitPv(box));
    box.querySelectorAll('.pv-sc').forEach(sc => { const ro = new ResizeObserver(() => { if (!sc.isConnected) { ro.disconnect(); return; } cancelAnimationFrame(sc._f); sc._f = requestAnimationFrame(() => fitPv(box)); }); ro.observe(sc.firstElementChild || sc); });
    clrSync(); subN();
  };
  const subN = () => { const n = { st: `${picked.size}/${stkMax(u)}`, rep: sel.rep ? `${sel.rep.split(',').length}` : '', deco: `${deco.length}/${slots}` }; $$('#editForm [data-subn]').forEach(b => { b.textContent = n[b.dataset.subn]; }); };
  prev();
  let pvT = 0; const prevSoon = () => { clearTimeout(pvT); pvT = setTimeout(prev, 120); };
  F.addEventListener('input', e => { if (e.target.closest('[data-pane="info"]') || e.target.name === 'title') prevSoon(); });
  F.addEventListener('change', e => { if (e.target.closest('[data-pane="info"]') || e.target.name === 'title') prevSoon(); });
  if (!S.meProf || S.meProf.user?.handle !== u.handle) call('user/' + encodeURIComponent(u.handle)).then(d => { S.meProf = d; prev(); }).catch(() => {});
  { const ro = new ResizeObserver(() => { const b = $('#edPrev'); if (!b?.isConnected) { ro.disconnect(); return; } fitPv(b); }); ro.observe($('.ed-pv')); }
  $('#edPrev').addEventListener('click', e => { if (!e.target.closest('[data-pv-fold]')) return; const f = !$('#edPrev').classList.contains('fold'); $('#edPrev').classList.toggle('fold', f); store.set('pv_fold', f ? 1 : 0); });
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
    else if (deco.length >= slots) { toast(slots < 3 ? `지금은 ${slots}칸까지! 연속 ${rwDay('perk', 'deco2').d}일·총 ${rwDay('perk', 'deco3').d}일 출석하면 칸이 늘어나요` : '시계 스티커는 3개까지!'); return; }
    else deco.push(b.dataset.v);
    b.classList.toggle('on', deco.includes(b.dataset.v)); decoN(); prev('deco');
  };
  // 스티커 한 번에 떼기 — 칸마다 '모두 떼기' + 미리보기 '스티커 전부 떼기'(카드·대표·시계). 저장 전까지는 취소로 되돌릴 수 있음
  clrSync = () => {
    const has = { st: picked.size > 0, rep: !!sel.rep, deco: deco.length > 0 };
    $$('#editForm .pk-clr').forEach(b => { b.disabled = !has[b.dataset.clr]; });
    const all = $('#editForm .pv-clr'); if (all) all.disabled = !(has.st || has.rep || has.deco);
  };
  const clearStk = k => {
    const parts = [];
    if ((k === 'st' || k === 'all') && picked.size) { picked.clear(); $$('#pSt .on').forEach(x => x.classList.remove('on')); $('#stkN').textContent = `0/${stkMax(u)}`; parts.push('st'); }
    if ((k === 'rep' || k === 'all') && sel.rep) { sel.rep = ''; $$('#pRep button').forEach(x => x.classList.toggle('on', !x.dataset.v)); parts.push('rep'); }
    if ((k === 'deco' || k === 'all') && deco.length) { deco.length = 0; $$('#pDeco .on').forEach(x => x.classList.remove('on')); decoN(); parts.push('deco'); }
    if (!parts.length) return;
    prev(parts.join(' ')); toast(k === 'all' ? '스티커를 전부 뗐어요 · 저장하면 반영돼요' : '뗐어요 · 저장하면 반영돼요');
  };
  F.addEventListener('click', e => { const b = e.target.closest('.pk-clr,.pv-clr'); if (b) clearStk(b.dataset.clr); });
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
      await refreshMe(); ctx.adoptClass?.(S.me, true); closeSheet(); if (location.hash === '#me') renderMe(); toast('프로필을 저장했어요 ✨');
    } catch (err) { fail(err); }
  };
}

// 출석 보상 칸: 해금된 건 고를 수 있고, 아직이면 흐리게 + 자물쇠(누르면 필요한 일수 안내)
const attHave = r => r.by === 'gacha' ? !!S.me?.gc?.own?.[r.v] : rwOn(r, S.me?.attBest || 0, S.me?.attTotal || 0);
// 스티커 = 출석 보상 스티커 + 뽑기 스티커(by 'gacha')
// 뽑기에서 빠진 스티커(GACHA_OLD)는 이미 가진 사람에게만 보임 — 더는 못 얻는 걸 잠금으로 보여 주지 않음(개발자도 '전부 보유'는 현재 뽑기 목록 기준)
// 반짝이 버전('_s', 조각 상점에서 강화)은 원래 스티커 바로 뒤에, 가진 사람에게만 보임
const GC_ITEMS = [...GACHA, ...GACHA_OLD].filter(g => !g.fx).flatMap(g => [{ ...g, by: 'gacha', kind: 'sticker' }, { ...g, v: g.v + SHN, shn: 1, by: 'gacha', kind: 'sticker' }]);
const gcList = () => GC_ITEMS.filter(g => (!GACHA_OLD.some(o => o.v === g.v.replace(/_s$/, '')) || S.me?.gc?.own?.[g.v]) && (!g.shn || S.me?.gc?.own?.[g.v]));
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
// 뽑기 스티커 구분선 — 등급(일반·희귀)마다 따로: 등급 칩 + 뽑은 개수 (2026-10-25 하율: 희귀·일반이 섞여 보이지 않게)
function gcDiv(rar) {
  const L = gcList().filter(g => g.rar === rar), n = L.filter(attHave).length;
  return pkDiv(`<span class="pk-rar rr${rar}">${RAR[rar].n}</span>뽑기 스티커 <small>${n}/${L.length} 뽑음</small><span class="pk-none">아직 뽑은 ${RAR[rar].n} 스티커가 없어요 · 서비스 › 뽑기</span>`, (n ? '' : ' zero') + ` gdv rr${rar}`);
}
function attPicks(kind, isOn) {
  const L = rwList(kind);
  return L.map((r, i) => {
    const gc = r.by === 'gacha', head = gc && !(L[i - 1]?.by === 'gacha' && L[i - 1].rar === r.rar);
    const tip = gc ? `${r.shn ? '조각 상점' : '뽑기 ' + RAR[r.rar].n} · ${objName(r.v)}` : `${r.by === 'total' ? '총 출석' : '연속 출석'} ${r.d}일 보상 · ${kind === 'color' ? COLOR_NAME[r.v] : objName(r.v)}`;
    const inner = kind === 'color' ? '' : artOf(r.v, 'pka');
    const gr = gc ? ` gr${r.rar}` : '';
    return (head ? gcDiv(r.rar) : '') + (attHave(r)
      ? `<button type="button" data-v="${r.v}" class="att-pk${gr}${kind === 'color' ? ' c-' + r.v : ''} ${isOn(r.v) ? 'on' : ''}" data-tip="${tip}" aria-label="${tip}"${gc ? ` data-nw="${r.v}"` : ''}>${inner}</button>`
      : `<button type="button" class="att-pk lock${gr}${kind === 'color' ? ' c-' + r.v : ''}" data-lock="${gc ? 'g' : r.d}" data-by="${r.by}" data-tip="🔒 ${tip}" aria-label="${tip} (잠김)">${inner}<span class="pk-lk">${ui('lock')}</span><i>${gc ? '뽑기' : r.d}</i></button>`);
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
  // 창(모달) 위로 잘리면 아래로 펼침 (2026-10-26)
  const box = btn.closest('.sheet,.modal') , tr = t.getBoundingClientRect(), top = box ? Math.max(0, box.getBoundingClientRect().top) : 0;
  if (tr.top < top + 6) t.classList.add('dn');
  const close = ev => { if (!t.isConnected) return off(); if (ev.type === 'keydown' ? ev.key === 'Escape' : !t.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) { t.remove(); off(); } };
  const off = () => { document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', close, true); };
  setTimeout(() => { document.addEventListener('pointerdown', close, true); document.addEventListener('keydown', close, true); });
  t.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; t.remove(); off(); onPick(b.dataset.v); };
}
// 칭호 글자: 첫 5만 m 도착자 칭호는 앞에 금빛 '최초' 도장을 붙여 강조
const ttlHtml = t => t === HOME_TITLE ? `<em class="t-first">${esc(HOME_FIRST)}</em>${esc(HOME_TITLE)}` : esc(t);
function titleOpts(cur) {
  const have = ATT.lockedOf('title').filter(attHave), gcT = gcDone(S.me?.gc?.own);   // 뽑기 시리즈 완성 칭호
  const own = S.me?.gc?.own || {}, hT = own['r:fxkey'] > 0, h2 = hT || own[HOME_MARK] > 0;   // 히든 칭호: 가진 사람만 이름이 보임, 아직이면 잠긴 칸에 '???'로만 (2026-10-25 하율 — 공지엔 안 씀)
  const opt = t => `<option value="${esc(t)}" ${t === cur ? 'selected' : ''}>${esc(t)}</option>`;
  return `<option value="">없음</option>${hT ? opt(HOME_TITLE) : ''}${h2 ? opt(HOME_TITLE2) : ''}${have.map(r => `<option value="${esc(r.v)}" ${r.v === cur ? 'selected' : ''}>${esc(r.v)}</option>`).join('')}${gcT ? `<option value="${esc(GC_TITLE)}" ${GC_TITLE === cur ? 'selected' : ''}>${esc(GC_TITLE)}</option>` : `<option disabled>🔒 ${esc(GC_TITLE)} (뽑기 시리즈 완성)</option>`}${ATT.lockedOf('title').filter(r => !attHave(r)).map(r => `<option disabled>🔒 ${esc(r.v)} (${r.by === 'total' ? '총' : '연속'} ${r.d}일)</option>`).join('')}${achOn() ? (() => { const at = achTitles(S.me?.ach || {}); return ACH_TITLES.map(t => at.includes(t) ? opt(t) : `<option disabled>🔒 ${esc(t)} (게임 업적 모두)</option>`).join(''); })() : ''}${h2 ? '' : '<option disabled>🔒 ??? (히든)</option>'}${hT ? '' : '<option disabled>🔒 ??? — 집에 먼저 가는 사람에게 주어지는 칭호입니다</option>'}`;
}

/* ===== 계정 설정 ===== */
/* ----- 개발자: 학과별 테스트 계정으로 바꿔 보기 (콘 1반 · 미 3반 · 프 5반, 2학년) ----- */
const SW = [['con', '콘텐츠과'], ['mi', '미디어과'], ['pro', '프로듀스과']];
const swBar = () => !S.me?.sw ? '' : `<div class="swbar"><p>${ic('flask')}학과별로 보기 ${S.me.sw === 'dev' ? '' : `<b>· 지금 ${esc(SW.find(x => x[0] === S.me.sw)?.[1] || '')} 테스트 계정</b>`}</p>
  <div class="swbtns">${SW.map(([k, n]) => `<button class="btn ${S.me.sw === k ? '' : 'ghost'}" type="button" data-sw="${k}" ${S.me.sw === k ? 'disabled' : ''}>${n}</button>`).join('')}</div>
  ${S.me.sw === 'dev' ? '' : `<button class="btn lime" type="button" data-sw="back">${ic('tool')}개발자로 돌아가기</button>`}</div>`;
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
    <p class="lbl">🏆 자랑 메시지</p>
    <label class="pdok"><input type="checkbox" id="bragAll"><span>DM으로 오는 기록 자랑 받기</span></label>
    <ul class="plist" id="bragList"></ul>
    <p class="lbl">차단한 사람</p><ul class="plist" id="blkList">${ghPeople(2)}</ul>
    <div class="col">${S.me?.handle === ADMIN_HANDLE ? '<a class="btn" href="/admin/">🛠 관리자 페이지</a>' : ''}<button class="btn ghost" id="btnLogout">로그아웃</button><button class="btn ghost" id="btnLogoutAll" title="학교 태블릿 등에 로그인을 두고 왔을 때">모든 기기에서 로그아웃</button><button class="btn ghost danger" id="btnWithdraw">탈퇴하기</button><button class="btn ghost" data-close>닫기</button></div>`);
  call('blocked').then(r => {
    $('#blkList').innerHTML = r.users.length ? r.users.map(u => personRow(u, `<button class="fbtn" data-block="${esc(u.handle)}" data-on="0">풀기</button>`)).join('') : '<li class="empty">없어요</li>';
    $('#bragAll').checked = !r.bragAll;
    $('#bragList').innerHTML = (r.bragMuted || []).map(u => personRow(u, `<button class="fbtn" data-bragoff="${esc(u.handle)}">자랑 다시 받기</button>`)).join('');
  }).catch(() => { $('#blkList').innerHTML = ''; });
  $('#bragAll').onchange = async e => { const on = !e.target.checked; try { await call('bragmute', { all: true, on }); toast(on ? '이제 자랑 메시지를 받지 않아요' : '자랑 메시지를 다시 받아요'); } catch (x) { e.target.checked = on; fail(x); } };
  $('#bragList').onclick = async e => { const b = e.target.closest('[data-bragoff]'); if (!b) return; try { await call('bragmute', { handle: b.dataset.bragoff, on: false }); b.closest('li').remove(); toast('자랑 메시지를 다시 받아요'); } catch (x) { fail(x); } };
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
// DM 목록 카드 (진짜·뼈대 공용)
function dmListHtml(threads0, friends0, panel) {
    const threads = threads0.map(t => `<li class="thread ${t.unread ? 'new' : ''}"><a ${toThread(t.user.handle, panel)}>${av(t.user)}
      <span class="pi"><b>${esc(nameOf(t.user))}${repTag(t.user)}</b><small>${t.mine ? '나: ' : ''}${stkOf(t.last) ? '스티커를 보냈어요' : esc(t.last)}</small></span>
      <span class="tm">${ago(t.at)}${t.unread ? `<i class="nb">${t.unread}</i>` : ''}</span></a></li>`).join('');
    const friends = friends0.map(u => `<a class="fchip" ${toThread(u.handle, panel)}>${av(u)}<small>${esc(u.name)}</small></a>`).join('');
    return `<div class="card dmcard">
      ${friends ? `<p class="lbl">친구에게 먼저 말 걸기</p><div class="frow">${friends}</div>` : ''}
      <ul class="plist">${threads || '<li class="empty">아직 주고받은 메시지가 없어요</li>'}</ul>
      <p class="note">💡 서로 팔로우한 친구끼리 DM할 수 있어요. 불편한 메시지는 프로필의 ⋯에서 차단·신고해 주세요.</p>
    </div>`;
}
async function renderDm(handle, box = $('#dmBox'), panel = false) {
  stopThread();
  if (S.enabled === false) { box.innerHTML = offCard(); return; }
  if (!S.me) { box.innerHTML = needLogin('DM을 하려면 로그인해 주세요'); return; }
  if (handle) return renderThread(handle, box, panel);
  if (!box.querySelector('.dmcard')) box.innerHTML = ghostOr(() => dmListHtml(FK_US(4).map((u, i) => ({ user: u, last: '메시지 미리보기가 들어가는 자리', at: Date.now() - i * 6e5 })), FK_US(4), panel), 3);
  try {
    const r = await call('inbox');
    paintRecent(r.threads);
    if (openThread) return;
    box.innerHTML = dmListHtml(r.threads, r.friends, panel);
  } catch (e) { box.innerHTML = `<div class="card"><p class="empty">${esc(e.message)}</p></div>`; }
}

/* ===== 홈 친구 카드 (한눈에 보기, 2026-10-25) =====
   맞팔 친구를 접속 중 → 안 읽은 DM → 최근 접속 순으로. 칸: 사진(접속 점·안 읽은 수) · 이름 · 접속 상태·반 · 상태 메시지 · 연속 출석 불꽃(오늘 출석했으면 켜짐)
   맨 앞엔 나를 새로 팔로우한 사람(14일 안, 맞팔 전) + 맞팔 버튼. 홈을 보고 있을 때만 90초마다 새로 고침 */
let bdTimer = 0, bdBusy = false;
const bdTile = (u, rest) => {
  const st = u.online ? '접속 중' : u.seen ? ago(u.seen) + ' 접속' : '';
  const lit = u.att || (rest && u.streak > 0), fire = u.streak > 0 || u.att
    ? `<span class="bd-f${lit ? '' : ' off'}" data-tip="${u.att ? '오늘 출석 완료' : rest ? '오늘은 쉬는 날' : '아직 출석 전'}">${ATT.flame('fsm', { tier: ATT.tierOf(u.streak), off: !lit })}<b>${ATT.fmtN(u.streak)}</b></span>` : '';
  return `<li class="bd${u.online ? ' on' : ''}${u.unread ? ' new' : ''}">
    <a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}">
      <span class="bd-av">${av(u, '', avWear(u.mfx))}</span>
      <b class="bd-n"><span>${esc(nameOf(u))}</span>${devTag(u)}</b>
      <small class="bd-s">${esc([st, classTxt(u).replace('학년 ', '-').replace('반', '')].filter(Boolean).join(' · '))}</small>
      ${u.mood ? `<span class="bd-m">${esc(u.mood)}</span>` : ''}${fire}
    </a>
    <button class="bd-dm" type="button" data-bdm="${esc(u.handle)}" aria-label="${esc(nameOf(u))}에게 메시지" data-tip="메시지">${'<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chat"/></svg>'}${u.unread ? `<i>${u.unread > 99 ? '99+' : u.unread}</i>` : ''}</button>
  </li>`;
};
const bdReq = u => `<li class="bd req"><a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}"><span class="bd-av">${av(u, '', avWear(u.mfx))}</span><b class="bd-n"><span>${esc(nameOf(u))}</span>${devTag(u)}</b><small class="bd-s">나를 팔로우했어요</small></a><button class="btn bd-fb" type="button" data-follow="${esc(u.handle)}" data-on="1">맞팔하기</button></li>`;
async function loadBuddies() {
  const card = $('#bdCard'); if (!card) return;
  if (!S.me) { card.hidden = true; paintHeroFr([]); $('#sRk') && ($('#sRk').hidden = true); return; }
  loadHomeRank();
  if (bdBusy) return; bdBusy = true;
  try {
    const r = await call('buddies');
    const fr = r.friends.sort((a, b) => b.online - a.online || (b.unread > 0) - (a.unread > 0) || b.seen - a.seen);
    const on = fr.filter(u => u.online).length;
    $('#bdLive').hidden = !fr.length; $('#bdLive').innerHTML = on ? `<i class="dot"></i>지금 <b>${on}</b>명 접속 중` : `친구 <b>${fr.length}</b>명`;
    $('#bdLive').classList.toggle('on', !!on);
    $('#bdBox').innerHTML = fr.length || r.reqs.length ? r.reqs.map(bdReq).join('') + fr.map(u => bdTile(u, r.rest)).join('')
      : `<li class="bd-empty"><p><b>아직 맞팔 친구가 없어요</b>서로 팔로우하면 여기서 친구가 지금 접속 중인지, 오늘 출석했는지 바로 보여요</p><button class="btn" type="button" data-go="me" data-find>친구 찾으러 가기</button></li>`;
    card.hidden = false; paintHeroFr(fr);
  } catch { if (!$('#bdBox .bd')) card.hidden = true; }
  finally { bdBusy = false; }
}
/* 첫 화면 친구 띠 (2026-10-25): 접속 중인 맞팔 친구 얼굴만(없으면 최근 접속 순) 최대 5명 — 꾸민 왕관이 그대로 보이게 */
const HFR_MAX = 5;
function paintHeroFr(fr) {
  const el = $('#hFr'); if (!el) return;
  if (!S.me || !fr.length) { el.hidden = true; return; }
  const on = fr.filter(u => u.online), pool = on.length ? on : fr, show = pool.slice(0, HFR_MAX), more = pool.length - show.length;
  $('#hFrT').innerHTML = on.length ? `지금 <b>${on.length}</b>명 접속 중` : `친구 <b>${fr.length}</b>명`;
  el.classList.toggle('on', !!on.length);
  $('#hFrAvs').innerHTML = show.map(u => `<a class="sf-a${u.unread ? ' new' : ''}" href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}" data-tip="${esc(nameOf(u))}${u.mood ? ' · ' + esc(u.mood) : ''}" aria-label="${esc(nameOf(u))} 프로필">${av(u, '', avWear(u.mfx))}</a>`).join('')
    + (more > 0 ? `<span class="sf-more">+${more}</span>` : '');
  // 첫 등장 애니메이션(boot)이 끝난 뒤 늦게 나타나면 '툭' 튀지 않게 살짝 떠오름 (2026-10-25)
  const cl = document.documentElement.classList;
  if (el.hidden && !cl.contains('pre') && !cl.contains('boot')) { el.classList.remove('fr-in'); void el.offsetWidth; el.classList.add('fr-in'); el.addEventListener('animationend', () => el.classList.remove('fr-in'), { once: true }); }
  el.hidden = false;
}

/* ===== 홈 전체 랭킹 (2026-10-25, 친구 → 전체로 변경) — 전체 학생. 탭: 연속 출석 · 게임 4종. 꾸민 이름(홀로그램·황금)·대표 스티커·왕관이 보이게
   탭마다 5분 동안은 다시 안 불러옴(무료 요청량), 고른 탭은 이 기기에 기억 */
// 2026-10-26 하율: 홈 랭킹은 연속 출석 + 티어(2주 라운드)만, 게임별 탭은 뺌 — 미리보기 깃발 'rank-tier'(월요일 패치에 공개)
const RK_OLD = [['att', '연속 출석', 'fire'], ...Object.entries(GAMES).filter(([, g]) => !g.ff).map(([k, g]) => [k, g.name, g.ic])];
const RK_NEW = [['att', '연속 출석', 'fire'], ['tier', '티어', '']];
const rkTabs = () => ffOn('rank-tier', isDev(S.me)) ? RK_NEW : RK_OLD;
const rkCache = {};
let rkTab = store.get('rk_tab', 'att');
async function loadHomeRank(force) {
  const card = $('#sRk'); if (!card || !S.me) return;
  const RK_TABS = rkTabs();
  if (!RK_TABS.some(t => t[0] === rkTab)) rkTab = 'att';
  const tf = ffOn('tier-fancy', isDev(S.me));   // 2026-10-26 하율: 티어 순위 버튼 더 잘 보이고 화려하게 — 글자 붙은 탭
  $('#rkTabs').innerHTML = RK_TABS.map(([k, n, i]) => `<button type="button" role="tab" aria-selected="${k === rkTab}" data-rk="${k}"${tf ? ` class="rkt-${k}"` : ` data-tip="${n}"`} aria-label="${n}">${i ? ic(i) : tierIc('challenger')}${tf ? `<span class="rkt-l">${n}</span>` : ''}</button>`).join('');
  card.hidden = false;
  const tab = rkTab, c = rkCache[tab];
  if (c) paintHomeRank(tab, c.r);
  if (!force && c && Date.now() - c.at < 300e3) return;
  if (!c) { try { paintHomeRank(tab, { list: FK_US(3) }); ghostIn($('#rkList')); } catch { $('#rkList').innerHTML = '<li class="skel"></li>'; } }
  try {
    const r = tab === 'tier' ? await call('tier').then(d => ({ list: d.top })) : await call(tab === 'att' ? 'attrank?scope=all' : `rank?game=${tab}&scope=all`);
    rkCache[tab] = { r, at: Date.now() };
    if (rkTab === tab) paintHomeRank(tab, r);
  } catch (e) { if (!c && rkTab === tab) $('#rkList').innerHTML = `<li class="rk-empty">${esc(e.message)}</li>`; }
}
// 출석 랭킹이 빈 때(오픈 전 주말·첫날 아침): 주말 출석은 안 세니 언제부터 순위가 생기는지 안내 (2026-10-25)
function attEmpty() {
  const d = new Date().getDay();
  return d === 0 || d === 6 ? '출석은 등교일에만 세요<br>월요일 첫 출석부터 순위가 생겨요' : '아직 1등 자리가 비어 있어요<br>오늘 출석하면 바로 이름이 올라가요';
}
function paintHomeRank(tab, r) {   // 시간표 아래 따로 떨어진 랭킹 카드, 1~3등 (2026-10-25 3차: 분리 + 1등 금빛 강조)
  const g = GAMES[tab], list = r.list.slice(0, 3);
  const val = u => tab === 'tier' ? `<span class="rk-tr t-${esc(u.tier)}" data-tip="${u.pts}점">${tierIc(u.tier)}${esc(tierOfK(u.tier)?.n || '')}</span>` : g ? esc(g.fmt(u.value)) : `${ATT.flame('fsm', { tier: ATT.tierOf(u.value) })}${esc(ATT.fmtN(u.value))}<small>일</small>`;
  $('#rkList').innerHTML = list.length ? list.map((u, i) => `<li class="rk p${i + 1}${u.isMe ? ' me' : ''}">
      <span class="rk-n"><i class="mdl m${i + 1}">${i + 1}</i></span>
      <a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}"><span class="rk-av">${av(u, 'xs', avWear(u.mfx))}</span><b><span>${esc(nameOf(u))}</span>${devTag(u)}</b></a>
      <b class="rk-v">${val(u)}</b></li>`).join('')
    : `<li class="rk-empty">${tab === 'att' ? attEmpty() : tab === 'tier' ? '이번 라운드 기록이 아직 없어요<br>게임을 하면 티어가 매겨져요' : `${esc(g.name)} 기록이 아직 없어요 <button type="button" data-play="${tab}">첫 기록 남기기</button>`}</li>`;
}
function startBuddies() {
  clearInterval(bdTimer);
  bdTimer = setInterval(() => { if (!document.hidden && !idle() && S.me && (document.body.dataset.view || 'home') === 'home') loadBuddies(); }, 90000);
  document.addEventListener('click', e => { const b = e.target.closest('[data-bdm]'); if (!b) return; e.preventDefault(); openPanel(b.dataset.bdm); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-rk]');
    if (t) { rkTab = t.dataset.rk; store.set('rk_tab', rkTab); loadHomeRank(); return; }
    if (e.target.closest('#hFrGo')) { const c = $('#bdCard'); if (c && !c.hidden) c.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }
  });
}

/* ===== 떠 있는 메시지 창 (컴퓨터) · 둥근 버튼 (폰) ===== */
const panelOpen = () => !!$('#dmPanel') && !$('#dmPanel').hidden;
const wide = () => matchMedia('(min-width:900px)').matches;
function paintRecent(threads = []) {
  const el = $('#dmAvs'); if (!el) return;
  const h = S.me ? threads.slice(0, 3).map(t => av(t.user)).join('') : '';
  if (el._h !== h) { el._h = h; el.innerHTML = h; }   // 같은 얼굴이면 다시 안 그림 → 등장 애니메이션이 새로 고칠 때마다 반복되지 않게
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

// 기록 자랑 메시지(2026-10-27 하율) — 서버가 만든 '::b:종류:값:순위:인원'만 카드로
const BRAG = /^::b:([a-z0-9]+):([a-z0-9]+):(\d+):(\d+)$/;
function bragHtml(body) {
  const x = BRAG.exec(body || ''); if (!x) return '';
  const [, k, v, r, n] = x;
  let icon, name, val;
  if (k === 'st') { icon = ATT.flame('fsm', { tier: ATT.tierOf(Math.min(+v, 999)) }); name = '연속 출석'; val = +v >= 1e6 ? '무한 ∞' : `${(+v).toLocaleString('ko-KR')}일째`; }
  else if (k === 'tier') { const t = TIERS.find(y => y.k === v); if (!t) return ''; icon = tierIc(v); name = '이번 라운드 티어'; val = t.n; }
  else { const g = GAMES[k]; if (!g) return ''; icon = ic(g.ic); name = g.name; val = g.fmt(+v); }
  return `<span class="brag${k === 'tier' ? ' t-' + v : ''}"><span class="bg-ic">${icon}</span><span class="bg-tx"><small>${ic('trophy')}기록 자랑 · ${esc(name)}</small><b>${esc(val)}</b>${+n ? `<em>${+n}명 중 <i>${+r}위</i></em>` : ''}</span></span>`;
}
// 상대가 아직 안 읽은 내 메시지엔 카톡처럼 옆에 '1' (2026-10-27 하율)
function bubbleHtml(m, next, readUpTo, hideBrag) {
  const gap = !next || next.mine !== m.mine || next.at - m.at > 300e3;
  const bg = !m.del && bragHtml(m.body), hid = bg && !m.mine && hideBrag;
  const sk = !m.del && !bg && stkMsg(m.body);
  const ur = m.mine && !m.del && m.id > readUpTo;
  return `<li class="msg ${m.mine ? 'me' : 'you'} ${m.del ? 'del' : ''}${sk ? ' stk' : ''}${bg ? (hid ? ' bghid' : ' isbrag') : ''}" data-id="${m.id}">
    <span class="mrow">${ur ? '<i class="ur" aria-label="안 읽음">1</i>' : ''}<span class="bb">${m.del ? '삭제된 메시지' : hid ? '가린 자랑 메시지' : bg || sk || esc(m.body)}</span></span>
    ${gap ? `<small class="mt">${hm(m.at)}</small>` : ''}</li>`;
}
// 내 기록 고르기 (메시지 입력칸 트로피 버튼)
async function bragTray(btn, onPick) {
  const old = $('.stk-tray'); if (old) { const same = old._btn === btn; old.remove(); if (same) return; }
  const t = document.createElement('div');
  t.className = 'stk-tray brag-tray'; t._btn = btn; t.setAttribute('role', 'dialog'); t.setAttribute('aria-label', '자랑할 기록 고르기');
  t.innerHTML = `<small class="bt-h">어떤 기록을 자랑할까요?</small><div class="bt-list">${ghostOr(() => ['연속 출석', '이번 라운드 티어', '집에 가고 싶어!'].map(n => `<button type="button"><span class="bg-ic">${ic('trophy')}</span><span class="bt-n">${n}</span><b>000</b></button>`).join(''), 2)}</div>`;
  btn.parentElement.append(t);
  const close = ev => { if (!t.isConnected) return off(); if (ev.type === 'keydown' ? ev.key === 'Escape' : !t.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) { t.remove(); off(); } };
  const off = () => { document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', close, true); };
  setTimeout(() => { document.addEventListener('pointerdown', close, true); document.addEventListener('keydown', close, true); });
  let d; try { d = await call('user/' + encodeURIComponent(S.me.handle)); } catch (e) { t.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  if (!t.isConnected) return;
  const row = (k, icon, name, val) => `<button type="button" data-brag="${k}"><span class="bg-ic">${icon}</span><span class="bt-n">${esc(name)}</span><b>${esc(val)}</b></button>`;
  const rows = [];
  if (d.streak?.cur > 0) rows.push(row('st', ATT.flame('fsm', { tier: ATT.tierOf(Math.min(d.streak.cur, 999)) }), '연속 출석', d.streak.cur >= 1e6 ? '∞' : d.streak.cur + '일'));
  const tc = d.tier?.cur; if (tc) rows.push(row('tier', tierIc(tc.k), '이번 라운드 티어', TIERS.find(y => y.k === tc.k)?.n || ''));
  for (const [k, g] of Object.entries(GAMES)) if ((!g.ff || ffOn(g.ff, isDev(S.me))) && d.bests?.[k] != null) rows.push(row(k, ic(g.ic), g.name, g.fmt(d.bests[k])));
  t.innerHTML = rows.length ? `<small class="bt-h">어떤 기록을 자랑할까요?</small><div class="bt-list">${rows.join('')}</div>` : '<p>아직 자랑할 기록이 없어요.<br>출석하거나 게임을 한 판 해 보세요!</p>';
  const box = btn.closest('.sheet,.modal'), tr = t.getBoundingClientRect(), top = box ? Math.max(0, box.getBoundingClientRect().top) : 0;
  if (tr.top < top + 6) t.classList.add('dn');
  t.onclick = e => { const b = e.target.closest('[data-brag]'); if (!b) return; t.remove(); off(); onPick(b.dataset.brag); };
}
async function renderThread(handle, box, panel) {
  const q = sel => box.querySelector(sel);
  openThread = handle; threadIn = panel ? 'panel' : 'page';
  box.innerHTML = ghostOr(() => `<div class="card chat"><div class="chead"><a class="back">‹</a><a class="who">${av(FK_U())}<span class="pi"><b>친구 이름</b><small>@아이디</small></span></a></div><ol class="msgs">${[[0, '안녕 뭐해'], [1, '나 지금 쉬는 시간이야'], [0, '집에 가고 싶어 같이 하자'], [1, 'ㅇㅋ']].map(([me, t], i) => bubbleHtml({ id: i, mine: !!me, at: i, body: t }, null, 1e9, false)).join('')}</ol></div>`, 2);
  let msgs = [], readUpTo = 0, d;
  try { d = await call('dm/' + encodeURIComponent(handle)); }
  catch (e) { box.innerHTML = `<div class="card soc-gate"><p class="gate-em">🤔</p><p><b>${esc(e.message)}</b></p><a class="btn ghost" ${toList(panel)}>DM 목록</a></div>`; openThread = ''; threadIn = ''; return; }
  if (openThread !== handle) return;
  msgs = d.messages; readUpTo = d.readUpTo;
  const bgS = d.brag || {}, hideBrag = () => !!(bgS.iMute || bgS.iMuteAll);
  box.innerHTML = `<div class="card chat">
    <div class="chead"><a ${toList(panel)} class="back" aria-label="DM 목록">‹</a><a href="#u/${esc(d.user.handle)}" class="who">${av(d.user)}<span class="pi"><b>${esc(nameOf(d.user))}${devTag(d.user)}</b><small>${d.user.online ? '접속 중' : esc(atOf(d.user))}</small></span></a></div>
    <ol class="msgs" id="msgs" aria-live="polite">${msgs.length >= 40 ? '<li class="older"><button id="olderBtn">이전 메시지 보기</button></li>' : ''}</ol>
    ${d.canSend ? `<form class="compose" id="dmForm" autocomplete="off"><button class="stk-btn" type="button" id="dmStk" aria-label="스티커 보내기" data-tip="스티커">${ui('sparkle', 'ic')}</button><button class="stk-btn brag-btn${bgS.theyMute ? ' off' : ''}" type="button" id="dmBrag" aria-label="내 기록 자랑하기" data-tip="${bgS.theyMute ? '자랑 메시지를 받지 않는 친구예요' : '기록 자랑'}">${ic('trophy', 'ic')}</button><textarea id="dmIn" rows="1" maxlength="500" placeholder="메시지 보내기…" aria-label="메시지"></textarea><button class="btn" aria-label="보내기">➤</button></form>`
      : `<p class="note locked">${d.rel.blocked ? '차단한 사람이에요' : '이 친구의 DM 설정 때문에 지금은 보낼 수 없어요'}</p>`}
  </div>`;
  const list = q('#msgs');
  const paint = (keepScroll) => {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const older = list.querySelector('.older')?.outerHTML || '';
    list.innerHTML = older + (msgs.length ? msgs.map((m, i) => bubbleHtml(m, msgs[i + 1], readUpTo, hideBrag())).join('') : `<li class="empty hello">👋 ${esc(d.user.name)}에게 첫 메시지를 보내 보세요</li>`);
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
      const isB = li.classList.contains('isbrag') || li.classList.contains('bghid');
      if (isB) {   // 자랑 메시지: 이 친구 자랑만 그만 받기 / 다시 받기 (2026-10-27 하율)
        sheet(`<h3>자랑 메시지</h3><p class="note">${bgS.iMuteAll ? '지금은 모든 자랑 메시지를 받지 않고 있어요. 계정 설정에서 바꿀 수 있어요.' : bgS.iMute ? '이 친구의 자랑 메시지를 가리고 있어요.' : '이 친구가 보내는 기록 자랑을 그만 받을 수 있어요. 일반 메시지는 그대로 와요.'}</p><div class="col">${bgS.iMuteAll ? '' : `<button class="btn" id="bgMute">${bgS.iMute ? '다시 받기' : '이 친구 자랑 그만 받기'}</button>`}<button class="btn ghost" data-report="${esc(handle)}" data-msg="${id}">🚨 이 메시지 신고</button><button class="btn ghost" data-close>닫기</button></div>`);
        const mb = $('#bgMute');
        if (mb) mb.onclick = async () => { try { const r = await call('bragmute', { handle, on: !bgS.iMute }); bgS.iMute = r.on; closeSheet(); paint(true); toast(r.on ? '이 친구의 자랑 메시지를 가렸어요' : '자랑 메시지를 다시 받아요'); } catch (x) { fail(x); } };
        return;
      }
      sheet(`<h3>메시지</h3><p class="quote">${esc(li.textContent.trim())}</p><div class="col"><button class="btn ghost" data-report="${esc(handle)}" data-msg="${id}">🚨 이 메시지 신고</button><button class="btn ghost" data-close>닫기</button></div>`);
    }
  };
  const form = q('#dmForm');
  if (form) {
    const inp = q('#dmIn');
    const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight + inp.offsetHeight - inp.clientHeight, 120) + 'px'; };   // border-box라 테두리 두께를 더해야 글자가 가운데 (빼먹으면 아래로 쏠림)
    inp.addEventListener('input', grow);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    const send = async (text, keep, brag) => {
      try { const r = await call('dm/' + encodeURIComponent(handle), brag ? { brag } : { body: text }); if (!msgs.some(m => m.id === r.message.id)) msgs.push(r.message); paint(); dmDelay = 3000; }
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
    q('#dmBrag').onclick = e => bgS.theyMute ? toast('이 친구는 자랑 메시지를 받지 않아요') : bragTray(e.currentTarget, k => send('', false, k));
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

/* ===== 주간 미션 (2026-10-27 하율: 출석 버튼 옆 · 매주 다른 미션 5개 · 하나마다 뽑기권 1장, 다 하면 미션 창에서 받기) ===== */
// 미리보기 깃발 week-mission. 서버가 행동마다 진행을 올리고 깬 미션만큼 뽑기권을 넣음 → 응답의 mis로 알림
let msD = null, msAt = 0;
const msOn = () => !!S.me && ffOn('week-mission', isDev(S.me));
async function loadMission(force) {
  if (!msOn()) { paintMsBtn(); return null; }
  if (!force && msD && Date.now() - msAt < 60000 && msD.wk) { paintMsBtn(); return msD; }
  try { msD = await call('mission'); msAt = Date.now(); } catch {}
  paintMsBtn(); return msD;
}
function paintMsBtn() {
  const b = $('#btnMission'); if (!b) return;
  b.hidden = !msOn() || !msD;
  if (b.hidden) return;
  const n = msD.list.filter(x => x.done).length, all = n === msD.list.length, rd = msD.list.filter(x => x.ready).length;
  $('#msN').textContent = `${n}/${msD.list.length}`;
  b.classList.toggle('all', all);
  // 받을 수 있는 뽑기권이 있으면 빨간 숫자(gcnew.js와 같은 .nw-b)
  let dot = b.querySelector('.nw-b');
  if (rd) { if (!dot) { dot = document.createElement('i'); dot.className = 'nw-b'; dot.setAttribute('aria-hidden', 'true'); b.append(dot); } dot.textContent = rd; } else dot?.remove();
  b.classList.toggle('ready', !!rd);
  b.setAttribute('aria-label', `주간 미션 열기 — ${n}개 완료${rd ? ` · 받을 뽑기권 ${rd}장` : ''}`);
}
const msLeftTx = () => { const m = Math.max(0, Math.floor(weekLeft() / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${m % 60}분` : `${m % 60}분`; };
const MS_GO = { game: ['game', '게임 하러 가기'], bal: ['bal', '밸런스 게임 열기'], att: ['att', '출석 체크 열기'], friends: ['dm', 'DM 열기'], gacha: ['gacha', '뽑기 하러 가기'], edit: ['edit', '꾸미기 열기'], meal: ['meal', '급식 투표하러 가기'] };
const MS_IC = { play: 'play', bal: 'vote', balc: 'vote', meal: 'tray', like: 'heart', att: 'fire', dm: 'heart', fol: 'heart', gacha: 'gacha', prof: 'brush' };
function msRow(m, i) {
  const g = m.g && GAMES[m.g], go = KIND[m.k]?.go, pct = Math.round(m.c / m.n * 100);
  const dest = g ? `data-play="${m.g}"` : go ? `data-ms-go="${go}"` : '';
  const icn = g ? g.ic : KIND[m.k]?.ev === 'play' ? 'play' : MS_IC[m.k] || 'flag';
  const btn = m.done ? '<span class="ms-ok">완료</span>'
    : m.ready ? `<button type="button" class="ms-claim" data-ms-claim="${i}" aria-label="뽑기권 ${msD?.rw?.tix || 1}장 받기">${ic('tix')}<span>받기</span></button>` : dest ? `<button type="button" class="ms-go" ${dest} aria-label="${g ? g.name + ' 하러 가기' : MS_GO[go]?.[1] || '하러 가기'}">${ic(icn)}</button>` : '';
  return `<li class="${m.done ? 'done' : m.ready ? 'ready' : ''}"><span class="ms-no">${m.done ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9"/></svg>' : i + 1}</span>
    <div class="ms-tx"><b>${esc(document.documentElement.classList.contains('cut2') ? m.t.replace('컷 타이밍', '편집의 신') : m.t)}</b><span class="ms-bar"><i class="w${Math.round(pct / 5) * 5}"></i></span><small>${m.c.toLocaleString('ko-KR')} / ${m.n.toLocaleString('ko-KR')}${m.u ? esc(m.u) : ''}<em>${ic('tix', 'ms-tki')}뽑기권 ${msD?.rw?.tix || 1}</em></small></div>${btn}</li>`;
}
async function openMission() {
  sheet('<div class="ms-sheet"><div class="skel"></div></div>');
  try { paintMission({ list: ['급식 투표 3일', '밸런스 게임 참여 3번', '게임 1판 하기', '출석 5일', '반응속도 3판'].map(t => ({ t, c: 1, n: 3 })), rw: { tix: 1 } }); ghostIn($('#socSheet')); } catch {}
  const d = await loadMission(true);
  if (!d) { $('#socSheet').innerHTML = '<p class="note center">미션을 불러오지 못했어요</p>'; return; }
  paintMission(d);
}
function paintMission(d) {
  const n = d.list.filter(x => x.done).length, tot = d.list.length, rd = d.list.filter(x => x.ready).length;
  $('#socSheet').innerHTML = `<div class="ms-sheet${n === tot ? ' all' : ''}">
    <div class="ms-top">${ic('tix', 'ms-big')}<div><h3>주간 미션</h3><small>새 미션까지 ${msLeftTx()} · 월요일 0시에 바뀌어요</small></div></div>
    <div class="ms-sum"><span class="ms-pips">${d.list.map(x => `<i class="${x.done ? 'on' : ''}"></i>`).join('')}</span><b>${n === tot ? `이번 주 미션 끝! 뽑기권 ${tot * d.rw.tix}장 모두 받았어요` : rd ? `받을 수 있는 뽑기권 ${rd * d.rw.tix}장! '받기'를 눌러 주세요` : `미션 하나 깰 때마다 뽑기권 ${d.rw.tix}장 · 이번 주 ${n * d.rw.tix} / ${tot * d.rw.tix}장`}</b></div>
    <ol class="ms-list">${d.list.map(msRow).join('')}</ol>
    <p class="ms-note">${PLAY_RULE} · 검사에 걸려 보류된 기록은 세지 않아요 · 받지 않은 뽑기권은 월요일 0시에 미션과 함께 사라져요</p>
    <div class="row">${n ? '<button type="button" class="btn" data-go="gacha" data-close>뽑으러 가기</button>' : ''}<button type="button" class="btn ghost" data-close>닫기</button></div>
  </div>`;
}
// 뽑기권 받기: 버튼에서 티켓이 튀어 올라 위쪽 미션 버튼으로 날아감 → 칸은 완료로
let msClaiming = false;
// 2026-10-27 하율: 누르는 동안은 눌린 모양(theme.js .is-pressed), 손을 떼는 순간(click) 바로 효과 + 완료 표시 → 서버 응답은 뒤에서 맞춤(실패하면 되돌림)
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-ms-claim]'); if (!b || msClaiming) return;
  msClaiming = true;
  const i = +b.dataset.msClaim, li = b.closest('li'), prev = msD;
  // 화면 먼저: 티켓 날리기 + 그 칸 완료 + 위쪽 빨간 숫자 줄이기
  const fly = msFly(b);
  if (msD) { msD = { ...msD, list: msD.list.map((x, k) => k === i ? { ...x, done: true, ready: false } : x) }; paintMsBtn(); }
  li?.classList.remove('ready'); li?.classList.add('done', 'got');
  b.replaceWith(Object.assign(document.createElement('span'), { className: 'ms-ok', textContent: '완료' }));
  const no = li?.querySelector('.ms-no'); if (no) no.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9"/></svg>';
  let r;
  try { r = await call('misclaim', { i, wk: prev?.wk }); }
  catch (er) { msD = prev; paintMsBtn(); toast(er.message); msClaiming = false; openMission(); return; }
  msD = r; msAt = Date.now();
  if (S.me?.gc) { S.me.gc.tix = r.tix ?? (S.me.gc.tix || 0) + r.rw.tix; paintTix(); }
  await fly;
  if ($('.ms-sheet')) paintMission(r);
  paintMsBtn();
  const h = $('#btnMission'); if (h) { h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); }
  toast(r.list.every(x => x.done) ? `이번 주 미션 끝! 뽑기권 ${r.list.length * r.rw.tix}장 다 받았어요 🎉` : `뽑기권 +${r.rw.tix}장!`, 2600);
  msClaiming = false;
});
// 뽑기권 받기 효과(2026-10-27 하율 "나타나는 효과·들어가는 효과 더 예쁘게")
// ① 나타남: 빛 고리 + 빛살 + 반짝이 별, 티켓이 통통 튀어나와 반짝(광택 쓸기) ② 날아감: 곡선 + 꼬리 별가루 ③ 들어감: 미션 버튼 흡수 고리 + '+1' + 작은 별
const msFx = (cls, x, y) => { const d = document.createElement('div'); d.className = cls; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.append(d); return d; };
function msStars(x, y, n, dist, size = 10) {
  for (let k = 0; k < n; k++) {
    const st = msFx('ms-star', x, y), a = (k / n) * Math.PI * 2 + Math.random() * .5, r = dist * (.7 + Math.random() * .5), z = size * (.6 + Math.random() * .7);
    st.style.width = st.style.height = z + 'px';
    st.classList.add('c' + (k % 3));
    st.animate([{ transform: 'translate(-50%,-50%) scale(0) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r * .8}px),calc(-50% + ${Math.sin(a) * r * .8}px)) scale(1.1) rotate(90deg)`, opacity: 1, offset: .55 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r}px),calc(-50% + ${Math.sin(a) * r}px)) scale(0) rotate(180deg)`, opacity: 0 }],
      { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.catch(() => {}).then(() => st.remove());
  }
}
function msFly(from) {
  // 2026-10-27 하율 "나타나는 게 짜쳐 → 자연스럽게": 빛 고리·빛살 뺌. 버튼 속 티켓 아이콘이 그대로 떠올라(같은 크기·자리에서 시작) 부드럽게 커지고,
  // 잠깐 떠 있는 동안 광택이 한 번 지나간 뒤 가속하며 미션 버튼으로 빨려 들어감. 뒤에 은은한 빛 번짐만
  const a = (from.querySelector('.sic') || from).getBoundingClientRect(), tgt = $('#btnMission'), t = tgt && !tgt.hidden ? tgt.getBoundingClientRect() : null;
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body.animate) return new Promise(r => setTimeout(r, 200));
  const S0 = a.width / 52;   // .ms-fly 52px 기준, 버튼 속 아이콘 크기에서 시작
  const glow = msFx('ms-glow', x0, y0 - 44);
  glow.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0, offset: .15 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: .9, offset: .45 }, { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0 }], { duration: 950, easing: 'ease-out' }).finished.then(() => glow.remove());
  const tk = msFx('ms-fly', x0, y0); tk.innerHTML = ic('tix') + '<i class="ms-shine"></i>';
  // ① 튀어나옴(2026-10-27 하율 "너무 빨리 등장, 튀어나오는 것처럼"): 움찔(눌림) → 위로 쭉 늘어나며 튀어나옴 → 떨어지며 납작 → 작게 한 번 더 튐 → 자리 잡음
  const Q = (x, y, sx, sy, r) => `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`;
  // 2026-10-27 하율 "너무 과해" → 늘어남·납작 폭을 줄이고 두 번째 반동 없앰: 살짝 움찔 → 톡 튀어나와 → 한 번 가볍게 자리 잡음
  const up = tk.animate([
    { transform: Q(0, 0, S0, S0, 0), easing: 'ease-in-out' },
    { transform: Q(0, 2, S0 * 1.1, S0 * .88, 0), offset: .14, easing: 'cubic-bezier(.2,.8,.3,1)' },
    { transform: Q(0, -50, 1.2, 1.3, -2), offset: .5, easing: 'cubic-bezier(.4,0,.6,1)' },
    { transform: Q(0, -42, 1.28, 1.21, 0), offset: .74, easing: 'ease-out' },
    { transform: Q(0, -44, 1.25, 1.25, 0) },
  ], { duration: 560, fill: 'forwards' });   // 820 → 560 (2026-10-27 하율 "좀 더 빨리")
  const T = (x, y, sc, r) => Q(x, y, sc, sc, r);
  tk.querySelector('.ms-shine').animate([{ transform: 'translateX(-130%) skewX(-18deg)' }, { transform: 'translateX(-130%) skewX(-18deg)', offset: .5 }, { transform: 'translateX(260%) skewX(-18deg)' }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
  setTimeout(() => msStars(x0, y0 - 50, 4, 40, 7), 260);
  return up.finished.catch(() => {}).then(() => new Promise(r => setTimeout(r, 200))).then(() => {
    if (!t) { tk.remove(); return; }
    // ② 빨려 들어감(620ms): 위로 휘는 곡선, 점점 빨라지며 작아짐 + 별가루 꼬리
    const dx = t.left + t.width / 2 - x0, dy = t.top + t.height / 2 - y0, sx = 0, sy = -44, cx = dx * .3, cy = Math.min(sy, dy) - 70;
    const kf = [], N = 10;
    for (let k = 0; k <= N; k++) { const u = k / N, px = (1 - u) ** 2 * sx + 2 * (1 - u) * u * cx + u * u * dx, py = (1 - u) ** 2 * sy + 2 * (1 - u) * u * cy + u * u * dy;
      kf.push({ transform: T(px, py, 1.25 - .9 * u * u, -u * 18), opacity: k === N ? .9 : 1 }); }
    const D = 620, fly = tk.animate(kf, { duration: D, easing: 'cubic-bezier(.55,0,.75,.4)', fill: 'forwards' });
    let raf = 0, last = 0;
    const trail = ts => { if (ts - last > 28) { last = ts; const r = tk.getBoundingClientRect(), d = msFx('ms-dust', r.left + r.width / 2, r.top + r.height / 2); d.classList.add('c' + (Math.random() * 3 | 0));
      d.animate([{ transform: 'translate(-50%,-50%) scale(.9)', opacity: .8 }, { transform: `translate(-50%,-50%) translate(${(Math.random() - .5) * 10}px,8px) scale(0)`, opacity: 0 }], { duration: 480, easing: 'ease-out' }).finished.then(() => d.remove()); }
      raf = requestAnimationFrame(trail); };
    raf = requestAnimationFrame(trail);
    return fly.finished.catch(() => {}).then(() => {
      cancelAnimationFrame(raf); tk.remove();
      // ③ 도착: 버튼이 받아먹듯 눌렸다 튀고, 은은한 빛 + '+1'
      const x1 = t.left + t.width / 2, y1 = t.top + t.height / 2;
      const g2 = msFx('ms-glow sm', x1, y1);
      g2.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .95 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], { duration: 560, easing: 'ease-out' }).finished.then(() => g2.remove());
      msStars(x1, y1, 5, 30, 7);
      const plus = msFx('ms-plus', x1, y1 + 18); plus.textContent = '+' + (msD?.rw?.tix || 1);
      plus.animate([{ transform: 'translate(-50%,-6px)', opacity: 0 }, { transform: 'translate(-50%,6px)', opacity: 1, offset: .25 }, { transform: 'translate(-50%,10px)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,16px)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }).finished.then(() => plus.remove());
      tgt.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: .25 }, { transform: 'scale(1.08)', offset: .6 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
    });
  });
}
// 미션 '하러 가기' — 게임은 data-play(기존 처리), 나머지는 여기서
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ms-go]'); if (!b) return;
  const k = MS_GO[b.dataset.msGo]?.[0]; closeSheet();
  setTimeout(() => {
    if (k === 'bal') { ctx.go('home'); setTimeout(() => $('#plMore')?.click(), 250); }
    else if (k === 'meal') { ctx.go('home'); setTimeout(() => $('#hMeal')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250); }
    else if (k === 'att') $('#btnStreak')?.click();
    else if (k === 'edit') $('#btnEdit')?.click();
    else if (k) ctx.go(k);
  }, 120);
});
document.getElementById('btnMission')?.addEventListener('click', () => { if (S.me) openMission(); });
// 밸런스 게임(app.js) 응답은 이벤트로 받음
document.addEventListener('sg:mis', e => msResult(e.detail));
// 미션을 깬 응답 → 알림 + 뽑기권 숫자·버튼 갱신
function msResult(m) {
  if (!m?.got?.length) return;
  msD = m; msAt = Date.now(); paintMsBtn();
  toast(`미션 완료! '${m.list[m.got[0]].t}' · 위쪽 미션 버튼에서 뽑기권을 받으세요`, 5000);
  const b = $('#btnMission'); if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
}

/* ===== 미니게임 (#game) ===== */
async function renderGame() {
  const box = $('#gameBox');
  let info = null;
  if (S.me && !box.querySelector('.ggrid:not(.skz)')) box.innerHTML = ghostOr(() => gameHtml(Object.fromEntries(gamesOn().map(([k]) => [k, { best: 0, rank: 1, top: FK_U() }]))), 4);
  if (S.me) { try { info = (await call('games')).games; } catch {} }
  box.innerHTML = gameHtml(info);
  if (S.me) loadTier();
}
// 기자재 정리! 티어 반영(2026-10-28 하율, 미리보기 깃발 gear-tier): 랭킹전·일반 중 순위 점수가 높은 쪽 한 칸 → 어느 쪽이 들어갔는지 표시
//   개발자는 티어 밖이라 '내' 내역이 없음 → 1위 학생 내역으로 미리보기
const GT = 'gear-tier', gtOn = () => ffOn(GT, isDev(S.me)), GT_FROM = '10/29';
const gtMode = m => m === 'n' ? '일반' : '랭킹전';
async function gearTier() {
  try { const d = await call('tier'); if (!d.g) return null; const dev = !d.me && isDev(S.me), u = d.me || (dev ? d.top?.[0] : null);
    return { on: !!d.g.on, x: u?.games?.gear || null, dev }; } catch { return null; }
}
function gtText(t) {
  if (!t) return '';
  if (!t.on) return `${GT_FROM}부터 티어엔 랭킹전·일반 중 순위가 더 좋은 쪽이 들어가요`;
  const x = t.x; if (!x) return '티어엔 랭킹전·일반 중 순위가 더 좋은 쪽이 들어가요';
  return `${t.dev ? '미리보기(1위 학생 기준) · 티어엔' : '내 티어엔'} 지금 ${gtMode(x.m)} ${x.r}위(${x.p}점)가 들어가 있어요${x.o ? ` · ${gtMode(x.m === 'n' ? 'r' : 'n')}은 ${x.o.r}위(${x.o.p}점)` : ''}`;
}
// 게임 화면 (진짜·뼈대 공용)
function gameHtml(info) {
  return `${rkBand()}${S.me ? `<section class="card tier-card" id="tierBox">${ghostOr(() => `<div class="tr-head"><div class="tr-me">${tierIc('gold')}<div><small>라운드 티어</small><b>골드</b><span>상위 00% · 000점</span></div></div></div><ol class="tr-stairs">${TIERS.map(x => `<li class="t-${x.k}">${tierIc(x.k)}<b>${x.n}</b><small>000점+</small></li>`).join('')}</ol>`, 1)}</section>` : ''}${S.me ? achBar() : ''}<div class="ggrid">${gamesOn().map(([k, g], i) => {
    const x = info?.[k];
    // 2026-10-28 하율: 서비스 게임 칸처럼 한 줄 5개로 · 한눈에 — 설명은 이름에 마우스를 올리면(title), 기록·순위·1등을 짧게
    return `<article class="card gcard g-${k}"${g.ff ? ` data-ff="${g.ff}"` : ""}>${g.ff ? `<b class="beta new" data-nf="${g.ff}">NEW</b>` : ""}${g.beta ? '<b class="beta">Beta</b>' : ''}
      <p class="gem">${ic(g.ic)}</p><h3 title="${esc(g.desc)}">${g.name}</h3>
      ${x ? `<div class="gstat"><span>내 기록<b>${x.best != null ? esc(g.fmt(x.best)) : '-'}</b></span><span>내 순위<b>${x.rank != null ? x.rank + '위' : '-'}</b></span></div>
        <p class="gtop">${x.top ? `<small>${ic('trophy')}1등</small><a href="#u/${esc(x.top.handle)}">${av(x.top, 'xs')}<span>${esc(x.top.name)}</span></a><b>${esc(g.fmt(x.top.value))}</b>` : `<small>${ic('trophy')}1등</small><i>비어 있어요!</i>`}</p>` : `<p class="gdesc">${g.desc}</p>`}
      <div class="gbtns"><button class="btn big" data-play="${k}">${ic('play')}플레이</button><button class="btn ghost gbr" data-rank="${k}" aria-label="${esc(g.name)} 순위" title="순위">${ic('trophy')}<span>순위</span></button>${!g.casual && ACH_GAMES.includes(k) ? `<button class="btn ghost gbr gach" data-ach="${k}" data-ff="${ACH_FF}" aria-label="${esc(g.name)} 업적" title="업적">${medal(3, true)}<span>업적</span></button>` : ''}</div>
    </article>`;
  }).join('')}</div>
  ${S.me ? '' : '<p class="note center">로그인하면 기록이 랭킹에 올라가고 반 대항전에 참여해요!</p>'}`;
}
/* ===== 게임 업적 (2026-10-28 하율: 스팀처럼 — public/js/achv.js, 미리보기 깃발 achv) ===== */
// 메달 그림(이모지 금지 → 직접 그린 SVG): lv 1 브론즈 · 2 실버 · 3 골드 · 4 무지개, on = 달성
const medal = (lv, on) => `<svg class="amd am${lv}${on ? '' : ' off'}" viewBox="0 0 24 24" aria-hidden="true"><path class="am-rb" d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z"/><circle class="am-o" cx="12" cy="14.5" r="7.5"/><circle class="am-i" cx="12" cy="14.5" r="5.2"/><path class="am-s" d="M12 10.6l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/></svg>`;
const achOn = () => ffOn(ACH_FF, isDev(S.me));
const achCnt = own => ACH.filter(a => own?.[a.k]).length;
const achBar = () => `<button type="button" class="ach-bar" data-ach="" data-ff="${ACH_FF}">${medal(4, true)}<span><b>게임 업적</b><small>모은 업적 ${achCnt(S.me?.ach)} / ${ACH.length} · 게임마다 업적을 다 모으면 칭호</small></span><i aria-hidden="true">›</i></button>`;
const gName = g => g === 'all' ? '공통' : GAMES[g]?.name || g;
function achResult(keys) {
  if (!achOn() || !keys?.length) return;
  if (S.me) { S.me.ach = { ...(S.me.ach || {}) }; for (const k of keys) S.me.ach[k] = Date.now(); }
  const a = ACH.find(x => x.k === keys[0]);
  toast(`업적 달성! ‘${a?.n || ''}’${keys.length > 1 ? ` 외 ${keys.length - 1}개` : ''} · 게임 화면 업적에서 확인`, 5000);
  const t = $('.ach-bar small'); if (t) t.textContent = `모은 업적 ${achCnt(S.me?.ach)} / ${ACH.length} · 게임마다 업적을 다 모으면 칭호`;
}
let achD = null, achTab = 'all';
async function openAch(h = '', g = '') {
  sheet('<div class="ach-sheet"><div class="skel"></div></div>'); $('#socSheet').classList.add('wide');
  try { achD = await call('ach' + (h ? '?u=' + encodeURIComponent(h) : '')); } catch (e) { $('#socSheet').innerHTML = `<p class="note center">${esc(e.message)}</p>`; return; }
  achD.h = h; achTab = g && (g === 'all' || ACH_GAMES.includes(g)) ? g : 'all';
  if (achD.me && S.me) S.me.ach = achD.own;
  paintAch();
}
function achRow(a) {
  const d = achD, at = d.own[a.k], hide = a.hid && !at, pr = !at && achProg(a, d.st), pct = d.rare[a.k] ?? 0;
  const fmt = n => n.toLocaleString('ko-KR');
  return `<li class="${at ? 'got' : ''}${hide ? ' hid' : ''}">${medal(a.lv, !!at)}<div class="ach-tx"><b>${hide ? '???' : esc(a.n)}</b><small>${hide ? '숨겨진 업적 — 직접 찾아보세요' : esc(a.d)}</small>${pr ? `<span class="ach-pg"><i data-w="${Math.round(pr[0] / pr[1] * 20) * 5}"></i><em>${fmt(pr[0])} / ${fmt(pr[1])}</em></span>` : ''}</div>
    <div class="ach-rt"><span class="ach-pc${pct < 5 ? ' rare' : ''}">${d.players ? `학생 ${pct}%` : '-'}</span>${at ? `<small>${new Date(at).getMonth() + 1}/${new Date(at).getDate()} 달성</small>` : ''}</div></li>`;
}
function paintAch() {
  const d = achD, tabs = ['all', ...ACH_GAMES.filter(g => GAMES[g] && gamesOn().some(([k]) => k === g))];
  const cnt = g => { const l = achOf(g); return `${l.filter(a => d.own[a.k]).length}/${l.length}`; };
  const list = achOf(achTab).slice().sort((a, b) => !!d.own[b.k] - !!d.own[a.k]);
  const ttl = ACH_TITLE[achTab], tDone = ttl && achOf(achTab).filter(a => !a.hid).every(a => d.own[a.k]);
  $('#socSheet').innerHTML = `<div class="ach-sheet">
    <div class="ach-top">${medal(4, true)}<div><h3>${d.me ? '내 업적' : '업적'}</h3><small>${achCnt(d.own)} / ${ACH.length}개 달성 · 달성률은 게임해 본 학생 ${d.players}명 기준</small></div></div>
    <div class="ach-tabs" role="tablist">${tabs.map(g => `<button type="button" role="tab" class="${g === achTab ? 'on' : ''}" data-ach-tab="${g}" aria-selected="${g === achTab}">${g === 'all' ? medal(2, true) : ic(GAMES[g].ic)}<span>${esc(gName(g))}</span><small>${cnt(g)}</small></button>`).join('')}</div>
    <ol class="ach-list">${list.map(achRow).join('')}</ol>
    ${ttl ? `<p class="ach-note${tDone ? ' done' : ''}">${ui('tag', 'ic')}${tDone ? `칭호 ‘${esc(ttl)}’ 획득! 프로필 꾸미기에서 달 수 있어요` : `숨겨진 업적을 뺀 ${esc(gName(achTab))} 업적을 모두 모으면 칭호 ‘${esc(ttl)}’`}</p>` : '<p class="ach-note">한 판으로만 깨는 업적은 그 기록을 낸 판에서만 달성돼요 · 보류된 기록은 세지 않아요</p>'}
    <div class="row"><button type="button" class="btn ghost" data-close>닫기</button></div>
  </div>`;
  for (const i of $$('#socSheet .ach-pg i')) i.classList.add('w' + i.dataset.w);   // 진행 막대 폭(CSP: style 속성 금지 → 5% 단위 클래스)
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ach-tab]'); if (t && achD) { achTab = t.dataset.achTab; paintAch(); return; }
  const b = e.target.closest('[data-ach]'); if (!b || !S.me || !achOn()) return;
  e.preventDefault(); openAch(b.dataset.h || '', b.dataset.ach || '');
});
const achProf = (d, u) => !d.ach || isDev(u) ? '' : `<button type="button" class="pach" data-ach="" data-h="${esc(u.handle)}" data-ff="${ACH_FF}"><span class="pach-h">${medal(3, true)}업적 <b>${d.ach.n}</b>/${d.ach.of}</span>${d.ach.top.length ? `<span class="pach-l">${d.ach.top.map(x => { const a = ACH.find(y => y.k === x.k); return a ? `<i title="학생 ${x.p}% 달성">${medal(a.lv, true)}${esc(a.n)}</i>` : ''; }).join('')}</span>` : '<span class="pach-l"><i class="none">아직 없어요</i></span>'}</button>`;
// 티어 박탈감 줄이기(2026-10-28 하율 — 미리보기 깃발 tier-champ): 게임별 이번 라운드 1등 · 어제보다 오른 것 · 오늘 많이 오른 학생
const tIx = k => TIERS.findIndex(t => t.k === k);
const md = ymd => ymd ? `${+ymd.slice(4, 6)}/${+ymd.slice(6, 8)}` : '';
function chUpLine(c) {   // 내 티어 칸 아래: 어제보다 · 지난 라운드보다
  const a = [], r = c.me, p = c.prev;
  if (r && r.d > 0) a.push(`<span class="tch-up">▲ ${r.d}계단 <small>어제 ${tierOfK(r.from)?.n || ''}</small></span>`);
  else if (r && r.dp > 0) a.push(`<span class="tch-up">+${r.dp}점 <small>어제보다</small></span>`);
  else if (r && !r.d && !r.dp) a.push('<span class="tch-eq">어제와 같아요 <small>한 판 더 하면 오를 수 있어요</small></span>');
  else if (r) a.push('<span class="tch-eq">다른 학생이 올라왔어요 <small>한 판 더 하면 되찾을 수 있어요</small></span>');
  if (p && p.d > 0) a.push(`<span class="tch-up">▲ ${p.d}계단 <small>지난 라운드 ${tierOfK(p.k)?.n || ''}보다</small></span>`);
  else if (p) a.push(`<span class="tch-eq">지난 라운드 ${tierOfK(p.k)?.n || ''}</span>`);
  return a.length ? `<span class="tch-me">${a.join('')}${c.pv ? '<small class="tch-pv">미리보기 · 1위 학생 기준</small>' : ''}</span>` : '';
}
function chBlock(c) {
  const gs = gamesOn().filter(([k]) => GAMES[k]);
  const byG = new Map((c.games || []).map(x => [x.g, x]));
  const GAP = { home: v => v.toLocaleString('ko-KR') + 'm', stair: v => v.toLocaleString('ko-KR') + '칸', gear: v => v.toLocaleString('ko-KR') + '점', reaction: v => v + 'ms', cut: v => v + 'ms', num25: v => (v / 1000).toFixed(2) + '초' };
  const champs = gs.map(([k, g]) => { const x = byG.get(k);
    if (!x) return `<li class="tcc none"><span class="tcc-g">${ic(g.ic)}<b>${g.name}</b></span><span class="tcc-md e">1등 자리 비어 있음</span><p class="tcc-empty">아직 1등이 없어요<small>지금 한 판 하면 바로 1등!</small></p></li>`;
    const rec = x.b != null && g.fmt ? g.fmt(x.b) : '', gm = k === 'gear' && x.m ? `<i class="tcc-mode">${gtMode(x.m)}</i>` : '';
    const gap = x.gap === 0 ? '공동 1등' : x.gap > 0 && GAP[k] ? `2등과 ${GAP[k](x.gap)} 차이` : x.n === 1 ? '유일한 도전자' : '';
    return `<li class="tcc${x.me ? ' me' : ''}">
      <span class="tcc-g">${ic(g.ic)}<b>${g.name}</b>${gm}</span><span class="tcc-md">${ic('trophy')}1등</span>
      <span class="tcc-u">${x.users.map(u => `<a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}">${av(u, 'xs', avWear(u.mfx))}<span>${esc(nameOf(u))}</span></a>`).join('')}${x.more ? `<small>외 ${x.more}명</small>` : ''}</span>
      ${rec ? `<b class="tcc-rec">${esc(rec)}</b>` : ''}
      <span class="tcc-meta"><span>${ic('flag')}${x.n}명 중 1등</span>${gap ? `<span>${ic('ruler')}${gap}</span>` : ''}${x.me ? '<span class="tcc-mine">나!</span>' : ''}</span></li>`; }).join('');
  const mine = (c.games || []).filter(x => x.me).length;
  const rise = c.rise?.length ? c.rise.map(u => `<li class="${u.isMe ? 'me' : ''}"><a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}">${av(u, 'xs', avWear(u.mfx))}<b><span>${esc(nameOf(u))}</span>${devTag(u)}</b></a><span class="tch-mv">${u.d > 0 ? `${tierBadge(u.from)}<i>→</i>${tierBadge(u.to)}` : tierBadge(u.to)}</span><em>${u.d > 0 ? `▲${u.d}` : ''}${u.dp > 0 ? ` +${u.dp}점` : ''}</em></li>`).join('') : '';
  return `<section class="tch">
    <div class="tch-h">${ic('trophy')}<b>이번 라운드 게임별 1등</b>${mine ? `<span class="tch-mine">나도 ${mine}개 게임 1등!</span>` : '<small>티어와 따로, 게임마다 1등이 있어요</small>'}</div>
    <ul class="tch-list tcc-list">${champs}</ul>
    ${c.since ? `<div class="tch-h">${ic('fire')}<b>어제보다 많이 오른 학생</b><small>${md(c.since)}까지 기록과 비교</small></div>${rise ? `<ol class="tch-rise">${rise}</ol>` : '<p class="tch-none">아직 오른 학생이 없어요 — 첫 주인공이 되어 볼까요?</p>'}` : '<p class="tch-none">라운드 첫날이라 내일부터 \'어제보다 오른 학생\'이 보여요</p>'}
  </section>`;
}
// 라운드 티어 카드 (2026-10-25): 게임마다 라운드 순위 점수(1등 100 ~ 꼴찌 100/참가자 수) 합 → 줄 세워 백분위로 티어
async function loadTier() {
  const box = $('#tierBox'); if (!box) return;
  if (!RK.start) { box.innerHTML = `<div class="tr-head"><div class="tr-me">${tierIc('iron')}<div><small>라운드 티어</small><b>곧 시작</b><span>정식 업데이트 주부터 2주마다 매겨요</span></div></div><p class="tr-how">게임마다 라운드 순위로 점수를 받아요(1등 100점, 참가만 해도 점수). 잘한 ${BEST_N}개 게임 점수를 합쳐 아이언부터 챌린저까지 티어가 정해져요.</p></div>`; return; }
  let d; try { d = await call('tier'); } catch { box.hidden = true; return; }
  if (!$('#tierBox')) return;
  const m = d.me, t = m && tierOfK(m.tier);
  const byPts = d.mode === 'pts', lbOf = x => byPts || !d.v2 ? (byPts ? x.pl : x.lb) : x.pt ? `${x.lb} · ${x.pl}` : x.lb;   // 티어 2차: 20명+ = 상위 %와 점수 중 높은 쪽 → 둘 다 표시
  const lbSt = x => lbOf(x).split(' · ').map((t, i, a) => `<i class="${a.length > 1 && !i ? 'tl-rk' : 'tl-pt'}">${t}</i>`).join('<i class="tl-dot"> · </i>');   // 계단 라벨: '1등 · 340점+' → 두 줄로 나눌 수 있게   // 2026-10-26 핫픽스: 참가자 TIER_PCT명 미만이면 점수 구간
  const ladder = TIERS.map(x => `<li class="t-${x.k}${m && x.k === m.tier ? ' on' : ''}">${tierIc(x.k)}<b>${x.n}</b><small>${lbOf(x)}</small></li>`).join('');
  // gear-tier 미리보기: 개발자는 티어 밖 → 1위 학생 점수 내역으로 보여 줌
  const pm = m || (d.g && isDev(S.me) ? d.top?.[0] : null);
  const per = pm ? gamesOn().map(([k, g]) => { const x = pm.games[k];
    if (k === 'gear' && d.g) {   // 기자재 정리!: 반영된 모드 + 다른 모드
      if (!d.g.on) return `<li>${ic(g.ic)}<span>${g.name}</span><b><i>${GT_FROM}부터 티어에 들어가요</i></b></li>`;
      return `<li class="tg-gear">${ic(g.ic)}<span>${g.name}</span><b>${x ? `<span class="tg-m">${gtMode(x.m)} ✓</span>${x.r}위 / ${x.n}명 · ${x.x ? `<i>+${x.p} · 합산 제외</i>` : `<em>+${x.p}</em>`}` : '<i>기록 없음 · 하면 점수!</i>'}</b>${x?.o ? `<small class="tg-o">${gtMode(x.m === 'n' ? 'r' : 'n')} ${x.o.r}위 / ${x.o.n}명 · +${x.o.p} (미반영)</small>` : x ? '' : '<small class="tg-o">랭킹전·일반 중 순위가 더 좋은 쪽이 들어가요</small>'}</li>`;
    }
    return `<li>${ic(g.ic)}<span>${g.name}</span><b>${x ? `${x.r}위 / ${x.n}명 · ${x.x ? `<i>+${x.p} · 합산 제외</i>` : `<em>+${x.p}</em>`}` : '<i>기록 없음 · 하면 점수!</i>'}</b></li>`; }).join('') : '';
  const perPv = !m && pm ? '<p class="tr-pv">미리보기 · 1위 학생 기준 점수 내역(개발자는 티어 밖)</p>' : '';
  // 총점(2026-10-28 하율 "총 몇점인지 보이게"): 점수 내역 아래 합산 = 잘한 BEST_N개 점수 더하기
  const sumIn = pm ? Object.values(pm.games || {}).filter(x => !x.x).map(x => x.p).sort((a, b) => b - a) : [];
  const perSum = pm ? `<p class="tr-sum"><span>총점</span><b>${pm.pts}점</b><small>잘한 ${BEST_N}개 합산${sumIn.length ? ` · ${sumIn.join(' + ')}` : ''}</small></p>` : '';
  const top = d.top.length ? d.top.map(trRow).join('') : '<li class="empty">아직 이번 라운드 기록이 없어요</li>';
  // TOP 10은 펼친 채로, 그 아래 '전체 순위 보기'(2026-10-26 하율 요청)
  const allOn = ffOn('tier-all', isDev(S.me)), opn = allOn ? ' open' : '';   // 미리보기 깃발 tier-all
  const more = allOn && d.players > d.top.length ? `<button type="button" class="btn ghost tr-all" aria-expanded="false">${ic('trophy')}<span>전체 순위 보기 · ${d.players}명</span></button>` : '';
  // 2026-10-25 하율 '티어 더 예쁘게' — 미리보기 깃발 tier-look(개발자 화면 먼저, 월요일 공개)
  if (ffOn('tier-look', isDev(S.me))) {
    const APEX = new Set(['master', 'grandmaster', 'challenger']);
    const rev = [...TIERS].reverse();
    const cnt = d.cnt || {};
    const stairs = rev.map(x => `<li class="t-${x.k}${APEX.has(x.k) ? ' apex' : ''}${m && x.k === m.tier ? ' on' : ''}" data-tk="${x.k}" role="button" tabindex="0" aria-expanded="false" aria-label="${x.n} — 지금 ${cnt[x.k] || 0}명, 눌러서 보기">${m && x.k === m.tier ? '<i class="tl-me">나</i>' : ''}<span class="tl-em">${tierIc(x.k)}</span><span class="tl-bar"></span><span class="tl-lab"><b>${x.n}</b><small>${lbSt(x)}</small><span class="tl-cnt${cnt[x.k] ? '' : ' z'}">${cnt[x.k] || 0}명</span></span></li>`).join('');
    const k = t ? t.k : 'iron', rad = !t && radOn(S.me);   // 개발자는 순위에 안 나와 티어가 없음 → 레디언트
    const CH = d.champ, chMe = CH ? chUpLine(CH) : '';
    box.classList.add('tr2');
    box.innerHTML = `<div class="tr2-top">
      ${rad ? `<div class="tm t-radiant apex"><span class="tm-em"><i class="tm-halo"></i>${radIc()}</span>
        <div class="tm-tx"><small>개발자 전용 티어</small><b>${RADIANT.n}</b><span class="tm-st">순위·티어표에는 나오지 않아요</span>${chMe}</div></div>` : `<div class="tm t-${k}${t ? '' : ' none'}${t && APEX.has(t.k) ? ' apex' : ''}"><span class="tm-em"><i class="tm-halo"></i>${tierIc(k)}</span>
        <div class="tm-tx"><small>이번 라운드 내 티어</small>${t ? `<b>${t.n}</b><span class="tm-st"><em>${m.rank}위</em> / ${d.players}명<i></i><em>${m.pts}점</em></span>${chMe}` : `<b>아직 없음</b><span class="tm-st">게임을 한 판 하면 티어가 생겨요</span>`}</div></div>`}
      <ol class="tm-how"><li><b>1</b><span>게임마다 라운드 순위로 점수<small>${d.v2 ? `1등 100점 · 참가 ${PTS_MIN_N}명 미만 게임은 점수가 줄어요` : '1등 100점 · 참가만 해도 점수'}</small></span></li><li><b>2</b><span>잘한 ${BEST_N}개 게임 점수를 합쳐 줄 세우기<small>${d.v2 ? '같으면 전체 합 → 먼저 달성한 사람' : '같으면 전체 합으로 가려요'}</small></span></li><li><b>3</b><span>${d.v2 ? `점수 구간으로 티어 결정<small>${TIER_PCT}명부터는 상위 %와 점수 중 높은 쪽</small>` : byPts ? `점수 구간으로 티어 결정<small>${TIER_PCT}명이 모이면 상위 %로 바뀌어요</small>` : '상위 몇 %인지로 티어 결정<small>라운드가 끝나면 지난 티어는 프로필 배지로</small>'}</span></li><li><b>4</b><span>라운드 끝나면 뽑기권<small>챌린저 ${RK.tierTix.challenger}장 · 그랜드마스터 ${RK.tierTix.grandmaster}장 · 마스터 ${RK.tierTix.master}장</small></span></li></ol>
    </div>
    <p class="tr-tap">티어를 누르면 지금 그 티어에 있는 사람을 볼 수 있어요</p>
    <ol class="tr-stairs">${stairs}</ol>
    <div class="tr-who" hidden></div>
    ${CH ? chBlock(CH) : ''}
    ${per ? `${perPv}<ul class="tr-games">${per}</ul>${perSum}` : ''}
    <details class="tr-top"${opn}><summary>${ic('trophy')}<span>티어 순위 TOP 10</span><i class="trt-go" aria-hidden="true"></i></summary><ol>${top}</ol>${more}</details>`;
    tierWho(box); trAll(box, top);
    const sl = box.querySelector('.tr-stairs'), on = sl?.querySelector('li.on');   // 폰: 가로로 넘기는 계단을 내 티어 쪽으로
    if (on && sl.scrollWidth > sl.clientWidth) sl.scrollLeft = on.offsetLeft - (sl.clientWidth - on.offsetWidth) / 2;
    return;
  }
  box.innerHTML = `<div class="tr-head"><div class="tr-me ${t ? 't-' + t.k : ''}">${t ? `${tierIc(t.k)}<div><small>이번 라운드 내 티어</small><b>${t.n}</b><span>${m.rank}위 / ${d.players}명 · ${m.pts}점</span></div>` : `${tierIc('iron')}<div><small>이번 라운드 내 티어</small><b>-</b><span>게임을 한 판 하면 티어가 생겨요</span></div>`}</div>
      <p class="tr-how">게임마다 이번 라운드 순위로 점수를 받아요(1등 100점, 참가만 해도 점수). 잘한 ${BEST_N}개 게임 점수를 합쳐 순위를 매기고, ${byPts ? `참가자가 ${TIER_PCT}명보다 적을 땐 점수 구간으로, 그 뒤엔 상위 몇 %인지로` : '상위 몇 %인지로'} 티어가 정해져요. 라운드가 끝나면 새로 시작하고 지난 티어는 프로필에 배지로 남아요.</p></div>
    <ol class="tr-ladder">${ladder}</ol>
    ${per ? `<ul class="tr-games">${per}</ul>` : ''}
    <details class="tr-top"${opn}><summary>티어 순위 TOP 10</summary><ol>${top}</ol>${more}</details>`;
  trAll(box, top);
}

// 티어 순위 한 줄
function trRow(u) { return `<li class="${u.isMe ? 'me' : ''}${u.tier === 'challenger' || u.tier === 'grandmaster' ? ' tx t-' + u.tier : ''}"><span class="tr-n">${u.rank}</span>${tierBadge(u.tier)}<a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}">${av(u, 'xs', avWear(u.mfx))}<b><span>${esc(nameOf(u))}</span>${devTag(u)}</b></a><em>${u.pts}점</em></li>`; }
// TOP 10 아래 '전체 순위 보기' ↔ 'TOP 10만 보기'(2026-10-26 하율 요청) — 한 번 불러온 전체 목록은 기억
function trAll(box, top10) {
  const btn = box.querySelector('.tr-all'), ol = box.querySelector('.tr-top ol'); if (!btn || !ol) return;
  const lab = btn.querySelector('span'), base = lab.textContent;
  let all = null, open = false;
  btn.onclick = async () => {
    if (open) { open = false; ol.innerHTML = top10; lab.textContent = base; btn.setAttribute('aria-expanded', 'false'); box.querySelector('.tr-top').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (!all) {
      btn.disabled = true; lab.textContent = '불러오는 중…';
      try { const r = await call('tier?all=1'); all = r.list.map(trRow).join('') + (r.n > r.list.length ? `<li class="empty">외 ${r.n - r.list.length}명</li>` : ''); }
      catch { btn.disabled = false; lab.textContent = '불러오지 못했어요 · 다시 누르기'; return; }
      btn.disabled = false;
    }
    open = true; ol.innerHTML = all; lab.textContent = 'TOP 10만 보기'; btn.setAttribute('aria-expanded', 'true');
    ol.querySelector('li.me')?.scrollIntoView({ block: 'center', behavior: 'smooth' });   // 전체 순위를 펼치면 내 줄로 (2026-10-28)
  };
}

// 티어 계단을 누르면 그 티어에 지금 있는 사람 목록(2026-10-26 하율 요청) — 같은 티어를 다시 누르면 닫힘
function tierWho(box) {
  const panel = box.querySelector('.tr-who'), memo = new Map();
  let open = '';
  const show = async k => {
    box.querySelectorAll('.tr-stairs li').forEach(li => { const on = li.dataset.tk === k; li.classList.toggle('sel', on); li.setAttribute('aria-expanded', on ? 'true' : 'false'); });
    if (!k) { panel.hidden = true; panel.innerHTML = ''; return; }
    const t = tierOfK(k);
    const head = n => `<div class="tw-head t-${k}">${tierIc(k)}<b>${t.n}</b><span>${n == null ? '' : `지금 ${n}명`}</span><button type="button" class="tw-x" aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button></div>`;
    panel.hidden = false; panel.className = 'tr-who t-' + k;
    if (!memo.has(k)) panel.innerHTML = head(null) + ghostOr(() => `<ol>${FK_US(4).map((u, i) => `<li><span class="tr-n">${i + 1}</span><a>${av(u, 'xs')}<b><span>${esc(u.name)}</span></b></a><em>000점</em></li>`).join('')}</ol>`, 1);
    let r = memo.get(k);
    if (!r) { try { r = await call('tier?k=' + k); memo.set(k, r); } catch { panel.innerHTML = head(null) + '<p class="tw-empty">불러오지 못했어요. 잠시 뒤 다시 눌러 주세요</p>'; return; } }
    if (open !== k) return;   // 그 사이 다른 티어를 누름
    const li = r.list.map(u => `<li class="${u.isMe ? 'me' : ''}"><span class="tr-n">${u.rank}</span><a href="#u/${esc(u.handle)}" data-u="${esc(u.handle)}">${av(u, 'xs', avWear(u.mfx))}<b><span>${esc(nameOf(u))}</span>${devTag(u)}</b></a><em>${u.pts}점</em></li>`).join('');
    panel.innerHTML = head(r.n) + (r.list.length ? `<ol class="tw-list">${li}</ol>${r.n > r.list.length ? `<p class="tw-more">외 ${r.n - r.list.length}명</p>` : ''}` : '<p class="tw-empty">지금 이 티어엔 아무도 없어요 — 먼저 올라가 볼까요?</p>');
  };
  const pick = li => { const k = li.dataset.tk; open = open === k ? '' : k; show(open); };
  box.onclick = e => {
    if (e.target.closest('.tw-x')) { open = ''; show(''); return; }
    const li = e.target.closest('.tr-stairs li[data-tk]'); if (li) pick(li);
  };
  box.onkeydown = e => { const li = e.target.closest?.('.tr-stairs li[data-tk]'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(li); } };
}

/* 축하 트로피 (2026-10-25 하율 요청): 1등 금 · 2등 은 · 3등 동 — 색은 CSS .ch-tro.r1~r3 */
function trophySvg(rank) {
  return `<svg class="ch-tro r${rank}" viewBox="0 0 120 132" aria-hidden="true">
    <path class="t-ol" d="M30 26c-14 0-20 8-18 18 2 11 12 18 24 20" fill="none" stroke-width="13" stroke-linecap="round"/>
    <path class="t-ol" d="M90 26c14 0 20 8 18 18-2 11-12 18-24 20" fill="none" stroke-width="13" stroke-linecap="round"/>
    <path class="t-d" d="M30 26c-14 0-20 8-18 18 2 11 12 18 24 20" fill="none" stroke-width="6" stroke-linecap="round"/>
    <path class="t-d" d="M90 26c14 0 20 8 18 18-2 11-12 18-24 20" fill="none" stroke-width="6" stroke-linecap="round"/>
    <path class="t-ol t-f" stroke-width="4" stroke-linejoin="round" d="M51 82h18l3 18H48z"/>
    <path class="t-ol t-f" stroke-width="4" stroke-linejoin="round" d="M26 12h68v34c0 22-15 38-34 38S26 68 26 46z"/>
    <path class="t-d" d="M80 14h12v32c0 20-13 35-30 37 13-6 18-20 18-36z"/>
    <path class="t-l" d="M33 18h9v26c0 10 3 18 8 24-11-4-17-14-17-26z"/>
    <rect class="t-ol t-d" x="36" y="100" width="48" height="10" rx="3" stroke-width="4"/>
    <rect class="t-ol t-base" x="28" y="110" width="64" height="16" rx="4" stroke-width="4"/>
    <rect class="t-f" x="50" y="114" width="20" height="8" rx="2"/>
    <text class="t-n" x="60" y="56" text-anchor="middle">${rank}</text>
  </svg>`;
}

/* ===== 1~3등 축하 (2026-10-25): 새 최고 기록으로 전체 1~3등에 처음 들거나 순위가 오르면 화면 전체 검정 블러 + 축하 ===== */
function cheer(game, rank, value) {
  document.querySelector('.cheer')?.remove();
  const g = GAMES[game], el = document.createElement('div');
  el.className = 'cheer r' + rank; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '축하');
  const conf = Array.from({ length: 36 }, (_, i) => `<i class="cf c${i % 6}"></i>`).join('');
  el.innerHTML = `<div class="ch-conf" aria-hidden="true">${conf}</div><div class="ch-box"><i class="ch-rays" aria-hidden="true"></i>${trophySvg(rank)}
    <p class="ch-t">전체 ${rank}등!</p><p class="ch-s">${ic(g.ic)} ${esc(g.name)} · ${esc(g.fmt(value))}</p><p class="ch-m">${['', '학교 1등이에요! 이 자리 지켜 봐요', '1등이 코앞이에요! 한 번만 더?', '시상대 입성! 이제 더 위로'][rank]}</p>
    <small class="ch-go">아무 데나 누르면 닫혀요</small></div>`;
  document.body.appendChild(el);
  const t0 = performance.now();
  const close = e => { if (performance.now() - t0 < 700) { e?.stopPropagation?.(); e?.preventDefault?.(); return; } el.classList.add('out'); setTimeout(() => el.remove(), 250); document.removeEventListener('keydown', key, true); };
  const key = e => { e.stopPropagation(); e.preventDefault(); if (['Escape', 'Enter', ' ', 'ArrowUp'].includes(e.key)) close(e); };
  document.addEventListener('keydown', key, true);
  el.addEventListener('pointerdown', e => { e.stopPropagation(); close(e); });
}

// 2주 라운드(att-rewards.js RK): 마감까지 남은 날 + 보상 안내 띠
const kstNow = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
function rkInfo(wk = false) {   // wk: 뽑기권 주(1주) · 아니면 점수·티어 라운드(2주)
  const of = wk ? wkOf : rkOf;
  const r = of(kstNow()), started = r.n >= 0, cur = started ? r : of(RK.start ? RK.start.replace(/-/g, '') : kstNow());
  if (!RK.start) return { started: false, open: false, from: '', to: '', left: 0, md: '' };
  const day = y => Date.UTC(+y.slice(0, 4), +y.slice(4, 6) - 1, +y.slice(6, 8)) / 864e5;
  const left = day(cur.to) - day(kstNow());   // 마지막 날(이 날 밤 12시에 마감)까지 남은 날
  return { started, from: cur.from, to: cur.to, left, md: `${+cur.to.slice(4, 6)}/${+cur.to.slice(6, 8)}` };
}
const ddl = k => k.left ? 'D-' + k.left : '오늘 밤 12시';
function rkBand() {   // 두 주기 안내: 1주 = 뽑기권 · 2주 = 점수·티어 (2026-10-25)
  const w = rkInfo(true), r = rkInfo();
  if (!w.open && w.open !== undefined) return `<div class="rk-band card"><span class="rk-tk" aria-hidden="true">${ic('trophy')}</span><p><b>주간 랭킹·티어는 정식 업데이트 주부터 시작해요</b><small>시작하면 ${RK.days}일마다 점수·티어를 새로 매기고, 라운드가 끝나면 챌린저 ${RK.tierTix.challenger}장 · 그랜드마스터 ${RK.tierTix.grandmaster}장 · 마스터 ${RK.tierTix.master}장. 지금 기록은 '역대' 랭킹에 쌓여요</small></p></div>`;
  return `<div class="rk-band card"><span class="rk-tk" aria-hidden="true">${ic('trophy')}</span><p><b>${w.started ? `라운드 마감 ${ddl(r)}` : `${+w.from.slice(4, 6)}/${+w.from.slice(6, 8)} 첫 주·첫 라운드 시작`}</b><small>라운드(${RK.days}일)가 끝나면 티어로 뽑기권 — 챌린저 ${RK.tierTix.challenger}장 · 그랜드마스터 ${RK.tierTix.grandmaster}장 · 마스터 ${RK.tierTix.master}장 (${r.md} 밤 12시 마감, 그 뒤 기록·티어 새로 시작) · 매주 모두에게 뽑기권 ${RK.week}장</small></p></div>`;
}
async function openRank(game, scope = 'week') {
  if (S.enabled === false) { toast('랭킹을 준비하고 있어요'); return; }
  if (!S.me) { toast('랭킹은 로그인하면 볼 수 있어요'); ctx.go('me'); return; }
  const g = GAMES[game];
  // 기자재 정리!: 랭킹전 / 일반 전환(2026-10-28) — 일반은 티어·보상과 상관없어 이번 주·역대·친구만
  const gm = game === 'gear' || game === 'gearn', gt = gm && gtOn();   // gear-tier: 일반 모드도 티어에 들어가니 '이번 라운드' 탭
  if (g.casual && (scope === 'class' || (scope === 'round' && !gt))) scope = 'all';
  const gtP = gt ? gearTier() : null;
  const modeSeg = gm ? `<div class="segs rk-mode" role="group" aria-label="게임 방식"><button data-rank="gear" data-scope="week" class="${game === 'gear' ? 'on' : ''}">${ic('trophy')}랭킹전</button><button data-rank="gearn" data-scope="all" class="${game === 'gearn' ? 'on' : ''}">일반</button></div>` : '';
  const tabs = (g.casual ? (gt ? [['week', '이번 주'], ['round', '이번 라운드'], ['all', '역대'], ['friends', '친구']] : [['week', '이번 주'], ['all', '역대'], ['friends', '친구']]) : [['week', '이번 주'], ['round', '이번 라운드'], ['all', '역대'], ['friends', '친구'], ['class', '반 대항전']]).map(([k, t]) => `<button data-rank="${game}" data-scope="${k}" class="${k === scope ? 'on' : ''}">${t}</button>`).join('');
  const scopeName = { week: '이번 주', round: '이번 라운드', all: '역대', friends: '친구', class: '반 대항전' }[scope] || '';
  sheet(`<h3 class="rk-h3">${ic(g.ic)} ${gm ? '기자재 정리!' : g.name} 랭킹<button type="button" class="rk-story" id="rkStory"${ffOn('story-share', isDev(S.me)) ? '' : ' hidden'} aria-label="스토리용 이미지로 공유">${ic('photo')}스토리 공유</button></h3>${modeSeg}<div class="segs">${tabs}</div><ol class="rank" id="rankList">${ghostOr(() => FK_US(5).map((u, i) => `<li><span class="rk">${i < 3 ? `<i class="mdl m${i + 1}">${i + 1}</i>` : i + 1}</span><a>${av(u)}<span class="pi"><b>${esc(u.name)}</b><small>1학년 1반</small></span></a><b class="rv">000</b></li>`).join(''), 2)}</ol>
    <p class="note" id="rankNote"></p><div class="row"><button class="btn" data-play="${gm ? 'gear' : game}">${ic('play')}도전하기</button><button class="btn ghost" data-close>닫기</button></div>`);
  try {
    const r = await call(`rank?game=${game}&scope=${scope}`);
    const medal = i => i < 3 ? `<i class="mdl m${i + 1}">${i + 1}</i>` : i + 1;   // 1~3등 금·은·동 배지 (이모지 대신)
    // 스토리 공유(2026-10-26): 캡처하면 뭉개지니까 1080×1920으로 새로 그린 이미지
    $('#rkStory').onclick = async ev => {
      const b = ev.currentTarget; if (b.disabled) return; b.disabled = true;
      try {
        const ST = await import('./story.js');
        const blob = await ST.rankStory($('#rankList'), { title: `${g.name} 랭킹`, scope: scopeName, note: $('#rankNote')?.textContent.startsWith('내 순위') ? $('#rankNote').textContent : '' });
        const r = await ST.shareBlob(blob, `ground-${game}-rank.png`);
        if (r === 'saved') toast('스토리용 이미지를 저장했어요! 스토리에 그대로 올려 보세요');
      } catch { toast('이미지를 만들지 못했어요. 다시 눌러 주세요'); }
      b.disabled = false;
    };
    if (scope === 'class') {
      $('#rankList').innerHTML = r.list.length ? r.list.map((c, i) => `<li class="${r.mine && r.mine.grade === c.grade && r.mine.cls === c.cls ? 'me' : ''}"><span class="rk">${medal(i)}</span><span class="pi"><b>${c.grade}학년 ${c.cls}반</b><small>${c.players}명 참가</small></span><b class="rv">${esc(g.fmt(c.value))}</b></li>`).join('')
        : '<li class="empty">아직 아무 반도 기록이 없어요</li>';
      $('#rankNote').textContent = '반마다 최고 기록 상위 3명의 평균이에요. 프로필에 학년·반을 적어야 반 점수에 들어가요.';
    } else {
      $('#rankList').innerHTML = r.list.length ? r.list.map((u, i) => `<li class="${u.isMe ? 'me' : ''}"><span class="rk">${medal(i)}</span><a href="#u/${esc(u.handle)}" data-u="1">${av(u)}<span class="pi"><b>${esc(nameOf(u))}${devTag(u)}</b><small>${esc(classTxt(u) || atOf(u))}</small></span></a><b class="rv">${esc(g.fmt(u.value))}</b></li>`).join('')
        : '<li class="empty">아직 기록이 없어요. 첫 1등을 노려 보세요!</li>';
      $('#rankNote').textContent = r.mine && !r.list.some(x => x.isMe) ? `내 순위: ${r.mine}위 (${g.fmt(r.myValue)})` : g.casual ? (gt ? `일반 모드 점수 순위예요${scope === 'week' ? ' (이번 주 기록)' : scope === 'round' ? ' (이번 라운드 기록)' : ''}` : `일반 모드 점수 순위예요 · 티어·뽑기권과는 상관없어요${scope === 'week' ? ' (이번 주 기록)' : ''}`) : scope === 'week' ? '이번 주에 낸 기록 중 각자 최고 기록으로 매겨요' : scope === 'round' ? '이번 라운드(2주)에 낸 기록 중 각자 최고 기록 — 이 순위로 티어 점수를 받아요' : '각자 최고 기록으로 순위를 매겨요';
      if (!g.casual && (scope === 'week' || scope === 'round')) {   // 주(뽑기권)·라운드(티어) 안내 + 지난주 1~3등
        const wk = scope === 'week', k = rkInfo(wk);
        $('#rankList').insertAdjacentHTML('beforebegin', `<div class="rk-rd"><p><b>${k.started ? `마감 ${ddl(k)}` : !RK.start ? '정식 업데이트 주부터 시작' : wk ? '첫 주 준비 중' : '첫 라운드 준비 중'}</b> · ${wk ? '이번 주 기록 순위 (보상은 라운드 티어로)' : '이 순위로 티어 점수를 받아요'}</p>${r.last?.length ? `<p class="rk-last"><small>지난주</small>${r.last.map(u => `<a href="#u/${esc(u.handle)}" data-u="1"><i class="mdl m${u.place}">${u.place}</i>${av(u, 'xs')}${esc(nameOf(u))}</a>`).join('')}</p>` : ''}</div>`);
        if (!r.list.length) $('#rankList').innerHTML = `<li class="empty">${wk ? '이번 주' : '이번 라운드'} 기록이 아직 없어요. 지금 하면 1등!</li>`;
      }
      // 내 자리(2026-10-28 하율 "랭킹 누르면 자신이 어디 위치에 있는지 바로"): 50등 밖이면 목록 끝에 ⋯ + 내 줄, 기록이 없으면 '기록 없음' 줄
      if (r.list.length && !r.list.some(x => x.isMe)) {
        const myRow = r.mine ? `<span class="rk">${r.mine}</span>` : '<span class="rk">-</span>';
        $('#rankList').insertAdjacentHTML('beforeend', `<li class="rk-gap" aria-hidden="true">⋯</li><li class="me out">${myRow}<a href="#u/${esc(S.me.handle)}" data-u="1">${av(S.me)}<span class="pi"><b>${esc(nameOf(S.me))}${devTag(S.me)}</b><small>${esc(classTxt(S.me) || atOf(S.me))}</small></span></a><b class="rv">${r.mine ? esc(g.fmt(r.myValue)) : '기록 없음'}</b></li>`);
      }
    }
    // gear-tier: 지금 티어에 들어간 모드 표시(전환 버튼 '티어' · 이번 라운드 내 줄 '티어 반영 ✓/미반영' · 아래 안내 한 줄)
    if (gtP) gtP.then(t => {
      if (!t || !$('#rankList') || !$('.rk-mode')) return;
      const x = t.on ? t.x : null;
      if (x) $(`.rk-mode [data-rank="${x.m === 'n' ? 'gearn' : 'gear'}"]`)?.insertAdjacentHTML('beforeend', '<i class="rk-tier">티어</i>');
      // 개발자 미리보기는 1위 학생 기준이라 내 줄 표시는 안 붙임
      if (x && scope === 'round' && !t.dev) { const mine = (x.m === 'n') === (game === 'gearn'); $('#rankList li.me .pi b')?.insertAdjacentHTML('beforeend', `<i class="rk-tin${mine ? ' on' : ''}">${mine ? '티어 반영 ✓' : '미반영'}</i>`); }
      $('#rankNote')?.insertAdjacentHTML('afterend', `<p class="note rk-gt">${esc(gtText(t))}</p>`);
    });
    rkToMe();
  } catch (e) { $('#rankList').innerHTML = `<li class="empty">${esc(e.message)}</li>`; }
}
// 랭킹 창이 열리면 내 줄로 바로 스크롤(앞뒤 순위가 같이 보이게 가운데) + 한 번 반짝. 스크롤해서 벗어나도 내 줄은 위·아래 끝에 붙어 있음(CSS sticky)
function rkToMe() {
  const me = $('#rankList li.me'); if (!me) return;
  const sc = me.closest('.sheet'), rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => {
    if (sc && sc.scrollHeight > sc.clientHeight) {
      me.style.position = 'static';   // sticky로 붙어 있는 자리 말고 원래 자리를 재야 함
      const top = me.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      me.style.position = '';
      sc.scrollTo({ top: Math.max(0, top - (sc.clientHeight - me.offsetHeight) / 2), behavior: rm ? 'auto' : 'smooth' });
    }
    me.classList.remove('rk-flash'); void me.offsetWidth; me.classList.add('rk-flash');
  });
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
  el.innerHTML = `<div class="ptop${wide ? ' wide' : ''}"><b>${title}</b><span class="pbtns">${GAMES[curGame] ? `<button class="pquit prank" type="button" data-rank="${curGame}" aria-label="${esc(GAMES[curGame].name)} 랭킹 보기">${ic('trophy')}<span>랭킹</span></button>` : ''}${KM.defsOf(curGame).length && GAMES[curGame] ? `<button class="pquit pkeys" type="button" id="pKeys" aria-label="키 설정" data-tip="키 설정"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-gear"/></svg><span>키 설정</span></button>` : ''}<button class="pquit" type="button" id="pQuit" aria-label="게임 나가기"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-logout"/></svg>나가기</button></span></div><div class="parea${wide ? ' wide' : ''}" id="parea">${html}</div>`;
  el.hidden = false; document.body.classList.add('playing');
  $('#pQuit').onclick = endPlay;
  const kb = $('#pKeys'); if (kb) kb.onclick = () => openKeys(curGame);
  homeRO?.disconnect(); homeRO = null; requestAnimationFrame(fitHome);
  return $('#parea');
}
// 게임 키 안내 칸 채우기: <span data-ka="동작" [data-one]> → 지금 설정된 키(keymap.js). 게임이 화면을 그릴 때마다 자동으로(MutationObserver)
function paintKA(all = false) {
  const g = curGame; if (!g) return;
  $$(`#gamePlay [data-ka]${all ? '' : ':empty'}`).forEach(el => {
    const k = KM.keysOf(g)[el.dataset.ka] || [];
    el.innerHTML = (el.hasAttribute('data-one') ? k.slice(0, 1) : k).map(c => `<kbd>${esc(KM.keyName(c))}</kbd>`).join('') || (el.hasAttribute('data-one') ? '' : '<kbd>없음</kbd>');
  });
}
{ let kaQ = 0; new MutationObserver(() => { if (!kaQ) kaQ = requestAnimationFrame(() => { kaQ = 0; paintKA(); }); }).observe($('#gamePlay'), { childList: true, subtree: true }); }

// 키 설정 창(2026-10-28 하율 "설정 버튼 만들어서 키 매핑 마음대로" + "키 매핑이 들어가는 게임들은 다 추가") — 게임 위 '키 설정' 버튼
//   동작마다 키 최대 3개, 키를 눌러 지우기·'+ 키 추가'로 다음에 누른 키 등록, 다른 동작에 있던 키는 거기서 빠짐, 이 기기에만 저장
//   창이 떠 있는 동안 게임은 키를 안 받음(모든 게임이 .modal.open이면 무시)
function openKeys(g) {
  $('#mKeys')?.remove();
  const name = GAMES[g]?.name || '게임';
  const m = document.createElement('div');
  m.className = 'modal open km-modal'; m.id = 'mKeys'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'kmT');
  let wait = '';   // 키를 기다리는 동작
  const paint = () => {
    const k = KM.keysOf(g);
    m.innerHTML = `<div class="sheet km-sheet"><button class="sheet-x" type="button" data-kmx aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>
      <h3 id="kmT">키 설정 · ${esc(name)}</h3><p class="muted small">키를 누르면 지워지고, '+ 키'를 누른 뒤 원하는 키를 누르면 등록돼요 · 이 기기에만 저장돼요</p>
      <ul class="km-list">${KM.defsOf(g).map(([a, t]) => `<li${wait === a ? ' class="wait"' : ''}><b>${esc(t)}</b><span class="km-keys">${k[a].map(c => `<button type="button" class="km-k" data-del="${a}" data-c="${esc(c)}" aria-label="${esc(t)} 키 ${esc(KM.keyName(c))} 지우기"><kbd>${esc(KM.keyName(c))}</kbd><i aria-hidden="true">×</i></button>`).join('')}${wait === a ? '<em class="km-wait">원하는 키를 누르세요 · Esc 취소</em>' : k[a].length < KM.MAX_KEYS ? `<button type="button" class="km-add" data-add="${a}">+ 키</button>` : ''}${k[a].length ? '' : '<small class="km-none">키 없음</small>'}</span></li>`).join('')}</ul>
      <div class="row km-foot"><button type="button" class="btn ghost" data-kmreset${KM.isCustom(g) ? '' : ' disabled'}>기본 키로 되돌리기</button><button type="button" class="btn" data-kmx>완료</button></div></div>`;
  };
  const done = () => { document.removeEventListener('keydown', onKey, true); m.remove(); syncLock(); paintKA(true); $('#pKeys')?.focus(); };
  const syncLock = () => { const r = document.documentElement; r.classList.toggle('modal-lock', !!document.querySelector('.modal.open')); };
  const onKey = e => {
    e.stopImmediatePropagation();   // 창이 떠 있는 동안 키는 이 창만
    if (!wait) { if (e.key === 'Escape') { e.preventDefault(); done(); } return; }
    e.preventDefault();
    if (e.key === 'Escape') { wait = ''; paint(); return; }
    if (e.repeat) return;
    if (KM.banned(e.code)) { toast('그 키는 쓸 수 없어요'); return; }
    const a = wait, cur = KM.keysOf(g)[a]; wait = '';
    if (!cur.includes(e.code)) KM.setKeys(g, a, [...cur, e.code]);
    paint(); m.querySelector(`[data-add="${a}"]`)?.focus();
  };
  m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-kmx]')) return done();
    const d = e.target.closest('[data-del]'); if (d) { const a = d.dataset.del; KM.setKeys(g, a, KM.keysOf(g)[a].filter(c => c !== d.dataset.c)); wait = ''; paint(); return; }
    const ad = e.target.closest('[data-add]'); if (ad) { wait = ad.dataset.add; paint(); return; }
    if (e.target.closest('[data-kmreset]')) { KM.resetKeys(g); wait = ''; paint(); }
  });
  paint(); document.body.append(m); syncLock(); document.addEventListener('keydown', onKey, true);
  m.querySelector('.km-add, .km-k')?.focus();
}
// 게임 중에도 왼쪽 위 집 버튼(#btnHome)을 그대로 보여 줌 (2026-10-26)
// 집 버튼은 헤더 원래 자리 그대로. 게임 제목 왼쪽 끝·나가기 오른쪽 끝을 게임 화면(집에 가고 싶어!는 화면 틀 .hr-scr, 나머지는 게임 칸) 양 끝에 맞춤 — 제목이 집 버튼과 겹치면 버튼 오른쪽으로
let homeRO = null;
function fitHome() {
  const t = $('#gamePlay .ptop'), h = $('#btnHome'), g = $('#gamePlay .hr-scr') || $('#parea')?.firstElementChild;
  if (!t || !h || !g) return;
  t.style.paddingLeft = t.style.paddingRight = ''; h.style.translate = '';
  const a = h.getBoundingClientRect(), p = t.getBoundingClientRect(), r = g.getBoundingClientRect();
  if (!a.width || !r.width) return;
  // 2026-10-28 하율 "랭킹·키 설정·나가기 버튼 모든 게임이 다 저 위치에": 게임 칸 폭과 상관없이 제목은 집 버튼 바로 오른쪽, 버튼 묶음은 화면 오른쪽 끝(집 버튼과 좌우 대칭 여백)
  const vert = a.bottom > p.top && a.top < p.bottom;   // 집 버튼과 제목 줄이 같은 높이일 때만 집 버튼 오른쪽에서 시작
  const L = vert ? a.right + 12 : Math.max(8, a.left), R = innerWidth - Math.max(8, a.left);
  t.style.paddingLeft = Math.max(0, L - p.left) + 'px';
  t.style.paddingRight = Math.max(0, p.right - R) + 'px';
  if (!homeRO && window.ResizeObserver) { homeRO = new ResizeObserver(() => requestAnimationFrame(fitHome)); homeRO.observe(g); }
}
function unfitHome() { homeRO?.disconnect(); homeRO = null; const h = $('#btnHome'); if (h) h.style.translate = ''; }
addEventListener('resize', () => { if (document.body.classList.contains('playing')) fitHome(); });
// 게임 중 집 버튼을 누르면 게임을 닫고 처음 화면으로 (이동 자체는 app.js의 [data-go] 처리)
document.addEventListener('click', e => { if (e.target.closest('[data-go]') && document.body.classList.contains('playing')) endPlay(); });
// 게임 안에서 연 창(랭킹 등)은 게임과 함께 닫음 — 안 닫으면 나간 뒤에 뒤늦게 남아 보임 (2026-10-25)
function endPlay() { unfitHome(); quitGame?.(); quitGame = null; closeSheet(); $('#gamePlay').hidden = true; $('#gamePlay').innerHTML = ''; document.body.classList.remove('playing'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#gamePlay').hidden && !document.querySelector('.modal.open')) endPlay(); }, true);

// 다시 시작 버튼(2026-10-27 하율 "게임 화면 바로 아래, 원래 버튼이 있으면 그 아래") — 게임마다 넣는 자리가 달라 HTML로 줌. 누르면 restartGame (아래 click 위임)
const RE_BTN = `<button class="prestart" type="button" data-restart aria-label="처음부터 다시 시작 (R)" aria-keyshortcuts="R"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-restart"/></svg>다시 시작<span data-ka="restart" data-one></span></button>`;
const RE_ROW = `<div class="prow">${RE_BTN}</div>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-restart]'); if (b) { b.blur(); restartGame(); } });   // 누른 뒤 포커스가 남아 있으면 스페이스·엔터가 이 버튼을 또 눌러 판이 다시 시작되던 문제 (2026-10-28)

// 게임 중 위 줄 '랭킹'(2026-10-28 하율 "랭킹을 바로 볼 수 있는 버튼 모든 게임에") — 열기 전에 하던 판을 멈춤(기자재 정리!는 멈춤 화면, 집에 가고 싶어!는 창이 닫힐 때까지 정지)
document.addEventListener('click', e => { if (e.target.closest('.prank')) window.dispatchEvent(new Event('blur')); }, true);
// 모든 게임 공통 '다시 시작'(2026-10-27 하율 "모든 게임에 재시작 버튼"): 게임 화면 위 나가기 옆 — 하던 판을 버리고 같은 게임을 처음부터
// (연타로 시작 티켓 한도(10분 60번)를 쓰지 않게 0.8초 안 연타는 무시, 게임 안에서 연 창은 닫음)
let curGame = '', reAt = 0;
function restartGame() {
  if (!curGame || performance.now() - reAt < 800) return;
  reAt = performance.now(); closeSheet(); play(curGame);
}
// R 키로 다시 시작(2026-10-27 하율) — 게임 키보다 먼저 받아서(capture) 기자재 정리!의 '아무 키나 누르면 시작'과 겹치지 않게. 한글 입력 상태(ㄱ)도 e.code로 잡힘
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || $('#gamePlay').hidden || KM.actOf(curGame, e) !== 'restart') return;   // 다시 시작 키도 키 설정대로(기본 R)
  if (curGame === 'stair') return;   // 영상고 계단 오르기는 다시 시작 버튼·R 키 없음(2026-10-28 하율: 열심히 하다 잘못 눌릴까 봐) — 끝나면 아무 키로 새 판
  if (e.target.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('.modal.open')) return;
  e.preventDefault(); e.stopImmediatePropagation(); restartGame();
}, true);
let ticket = null;   // 서버 시작 티켓 (기록 저장 때 같이 보냄, 한 판에 한 번)
function play(game) {
  if (game === 'gearn') game = 'gear';   // 일반 모드 순위에서 '도전하기' → 같은 게임 화면
  quitGame?.(); quitGame = null; curGame = game;
  ticket = S.me && game !== 'gear' && game !== 'stair' ? call('start', { game }).then(r => r.ticket).catch(() => '') : null;
  if (GAMES[game]?.ff && !ffOn(GAMES[game].ff, isDev(S.me))) return;
  ({ reaction: playReaction, num25: playNum25, cut: playCut, home: playHome, gear: playGear, stair: playStair })[game]?.();
}

// 편집의 신 결과 한 화면에(2026-10-28 하율 "스크롤 안 하고도 보이게"): 왼쪽 = 점수·등급·저장 결과·내 기록(접는 버튼) / 오른쪽 = 내 컷 다시 보기·판별 판정
function cutLayout(res) {
  if (!res || res.classList.contains('ct-out')) return;
  const q = s => res.querySelector(':scope > ' + s), L = document.createElement('div'), R = document.createElement('div');
  L.className = 'ct-l'; R.className = 'ct-r';
  ['.rlbl', '.rval', '.ctm-res', '#rMsg'].forEach(s => { const e = q(s); if (e) L.appendChild(e); });
  ['.ctm-rp', '.rdet'].forEach(s => { const e = q(s); if (e) R.appendChild(e); });
  res.prepend(L); L.after(R); res.classList.add('ct-out');
}
async function finish(game, value, detail = '', rounds = []) {   // rounds: 판마다의 기록 (서버가 다시 계산·검사)
  const g = GAMES[game], area = $('#parea'); if (!area) return;
  area.classList.remove('wide'); $('#gamePlay .ptop')?.classList.remove('wide');
  area.innerHTML = `<div class="result"><p class="gem">${ic(g.ic)}</p><p class="rlbl">${g.name} 결과</p><p class="rval">${esc(g.fmt(value))}</p>${detail}<p class="rmsg" id="rMsg">${S.me ? '기록 저장 중…' : '로그인하면 기록이 쌓여요!'}</p>
    <div class="row"><button class="btn big" id="again">다시 하기</button><button class="btn ghost" data-rank="${game}" id="toRank">${ic('trophy')}랭킹</button></div></div>`;
  $('#again').onclick = () => play(game);
  if (game === 'num25' && N25 && area.querySelector('.n2-res')) N25.layout(area.querySelector('.result'));   // 1 to 25 2: 결과를 한 화면에(3칸)
  if (game === 'cut' && area.querySelector('.ctm-rp')) cutLayout(area.querySelector('.result'));   // 편집의 신: 결과를 한 화면에(2칸, 2026-10-28 하율)
  homeRO?.disconnect(); homeRO = null; requestAnimationFrame(fitHome);   // 제목 줄을 결과 칸 폭에 다시 맞춤(게임 칸 기준으로 남아 제목이 두 줄로 꺾이던 것)
  $('#toRank').addEventListener('click', endPlay);
  if (game === 'home') {   // 공룡 게임처럼 스페이스·↑로 바로 다시
    const k = e => { if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') && !e.repeat && $('#again')) { e.preventDefault(); play(game); } };
    setTimeout(() => { if ($('#again')) { document.addEventListener('keydown', k); quitGame = () => document.removeEventListener('keydown', k); } }, 350);
  }
  if (!S.me) return;
  try {
    const r = await saveScore(game, value, rounds);
    if (r.held) {   // 왜 보류됐는지 + 문제 판 빨간 표시 (2026-10-26 하율)
      (r.bad || []).forEach(i => $('#parea .rdet')?.children[i]?.classList.add('bad'));
      $('#rMsg').outerHTML = heldBox(r); return;
    }
    $('#rMsg').innerHTML = r.newBest ? '<b>최고 기록 경신!</b> 지금까지 중 가장 잘했어요' : `내 최고 ${esc(g.fmt(r.best))}`;   // 게임 안에선 순위 안 보여 줌(2026-10-27 하율)
    $('#rMsg').insertAdjacentHTML('afterend', '<div id="myRec"></div>'); myRecInto($('#myRec'), game, null, game === 'cut' ? { open: false } : null);
  } catch (e) { if ($('#rMsg')) $('#rMsg').textContent = e.message; }
}
// 기록 저장(서버가 판 기록·티켓으로 다시 검사) — 결과 화면 없이 그 자리에서 다시 하는 게임(집에 가고 싶어!)도 같이 씀
// 검사에 걸린 기록은 서버가 버리지 않고 보류(2026-10-26 하율) — 개발자가 관리자 화면에서 반영/버림
// 결과 화면용: 왜 보류됐는지(서버 r.why) → 그래서 어떻게 됐는지
const heldBox = r => `<div class="rheld" id="rMsg"><b>기록 보류</b><p>${esc(r.why || '확인이 필요한 기록이에요.')}</p><small>그래서 이 기록은 바로 랭킹에 올리지 않고 맡아 뒀어요. 개발자가 확인한 뒤 문제없으면 랭킹에 반영돼요. 억울하면 <button type="button" class="rheld-fb" data-fb>의견 보내기</button>로 알려 주세요!</small></div>`;
const heldLine = r => `<b>기록 보류</b> ${esc(r.why || '')} 개발자가 확인한 뒤 반영돼요`;
// 게임 안 '내 기록' 칸 (2026-10-27 하율: 게임 화면에선 순위·랭킹 대신 — 못하는 친구도 스트레스 없이 자기 기록만 보게)
//   역대 최고 + 최근 날짜별 최고(막대는 내 기록끼리 비교, 작을수록 좋음인 저장값 기준) · 로그인 안 했으면 이 기기 최고만
// fold(2026-10-28 하율 "스크롤 안 해도 보이게, 난잡하면 버튼처럼 펴고 접어서"): '내 최고' 줄이 펼치기 버튼, 아래 최근 기록은 접힘 · 펼침 상태는 게임마다 이 기기에 기억(sg_mr_<게임>)
async function myRecInto(el, game, local = null, fold = null) {
  if (!el) return;
  const g = GAMES[game], md = d => `${+d.slice(4, 6)}/${+d.slice(6, 8)}`;
  const wrap = (best, body) => {
    if (!fold) return `<div class="myrec">${best}${body}</div>`;
    const open = store.get('mr_' + game, fold.open ?? false);
    return `<div class="myrec mr-fold${open ? ' open' : ''}"><button type="button" class="mr-tog" aria-expanded="${open}">${best.replace('<p class="mr-best">', '<span class="mr-best">').replace(/<\/p>$/, '<svg class="mr-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>')}</button><div class="mr-body"${open ? '' : ' hidden'}>${body}</div></div>`;
  };
  const hook = () => { const b = el.querySelector('.mr-tog'); if (!b) return; b.onclick = () => { const box = b.parentElement, on = !box.classList.contains('open'); box.classList.toggle('open', on); b.setAttribute('aria-expanded', on); box.querySelector('.mr-body').hidden = !on; store.set('mr_' + game, on); b.blur(); }; };   // blur: 게임 키(스페이스)가 이 버튼을 다시 누르지 않게
  if (!S.me) { el.innerHTML = wrap(`<p class="mr-best">${ic('trophy')}<span>내 최고</span><b>${local != null ? esc(g.fmt(local)) : '-'}</b></p>`, '<p class="mr-pe">로그인하면 날마다 내 기록이 쌓여요</p>'); hook(); return; }
  let r; try { r = await call('myrec?game=' + game); } catch { return null; }
  if (!el.isConnected || !Array.isArray(r?.days)) return r;
  const vs = r.days.map(x => x.v), lo = Math.min(...vs), hi = Math.max(...vs), today = kstNow();
  const w = v => hi === lo ? 100 : Math.round(25 + 75 * (hi - v) / (hi - lo));
  el.innerHTML = wrap(`<p class="mr-best">${ic('trophy')}<span>내 최고</span><b>${r.best ? esc(g.fmt(r.best.v)) : '-'}</b>${r.best ? `<small>${md(r.best.day)}</small>` : ''}</p>`,
    r.days.length ? `<p class="mr-h">최근 기록 <small>날마다 가장 잘한 판 · ${r.playDays}일 했어요</small></p><ol class="mr-days">${r.days.map(x => `<li class="${x.v === r.best?.v ? 'top' : ''}${x.day === today ? ' now' : ''}"><span>${x.day === today ? '오늘' : md(x.day)}</span><i data-w="${w(x.v)}"></i><b>${esc(g.fmt(x.v))}</b></li>`).join('')}</ol>` : '<p class="mr-pe">아직 기록이 없어요. 첫 판을 해 보세요!</p>'); hook();
  // 막대 차오르기 (2026-10-28 하율) — CSP가 style="" 속성을 막으니 CSSOM으로: 0에서 시작해 다음 프레임에 목표 길이로, 위에서부터 차례로
  const bars = [...el.querySelectorAll('.mr-days i[data-w]')];
  bars.forEach((b, i) => b.style.setProperty('--d', (0.15 + i * 0.09).toFixed(2) + 's'));
  requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach(b => b.style.setProperty('--w', b.dataset.w + '%'))));
  return r;
}
async function saveScore(game, value, rounds) {
  const t = ticket; ticket = null;   // 저장 중에 새 판을 시작해도 새 티켓을 지우지 않게 (먼저 비움)
  const r = await call('score', { game, value, rounds, ticket: await t });
  if ($('#v-game').classList.contains('on')) renderGame();
  return r;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* 1) 반응속도: 5번 평균
   부정출발 벌점(2026-10-27 하율 "막 찍어서 너무 많이 틀리면 패널티"): 초록 전에 누르거나 초록이 '화면에 보이고' 0.1초 안에 누르면(미리 찍은 것) 부정출발.
   첫 번은 봐주고 2번째부터 한 번마다 최종 기록 +RX_PEN ms, RX_OUT번이면 그 게임 실격(기록 없음). 부정출발 뒤 1초는 눌러도 안 넘어감(연타 방지).
   서버로는 판 기록 5개 뒤에 부정출발 횟수를 붙여 보냄(checkRounds가 벌점까지 다시 계산)
   판정 정밀화(2026-10-28 하율 "버그 싹다 잡고 판정 강화"):
   · 시작 시각 = 초록이 실제로 화면에 그려진 프레임(rAF 두 번째 타임스탬프). 예전엔 색을 바꾸라고 '명령한' 시각이라 화면 갱신 지연(0~17ms+)만큼 기록이 늘고 기기마다 들쭉날쭉했음
   · 누른 시각 = 입력 이벤트가 발생한 시각(e.timeStamp). 예전엔 처리 코드가 돈 시각이라 페이지가 바쁘면 그만큼 늦게 찍힘
   · 초록이 그려지기 전에 누름 = 부정출발(못 보고 누른 것) · 두 번째 손가락·오른쪽 클릭은 무시 · 스페이스바로도(노트북)
   · 화면을 벗어나면(탭 전환·창 내림) 그 판은 무효 → 다시(벌점 없음) — 숨은 탭은 타이머가 밀려 기록이 엉터리가 됨
   · 1500ms 넘는 판은 1500으로 쳐서 평균(서버와 같게 — 예전엔 화면은 원래 값, 서버는 1500으로 계산해 '평균이 다름'으로 보류됐음) */
const RX_FREE = 1, RX_PEN = 50, RX_OUT = 5, RX_ANTI = 100, RX_LOCK = 1000, RX_CAP = 1500;
const rxPen = f => Math.max(0, f - RX_FREE) * RX_PEN;
const evT = e => { const n = performance.now(), t = e.timeStamp; return t > 0 && t <= n + 1 && t > n - 1000 ? t : n; };   // 이벤트 시각(같은 시간축이 아니면 지금)
function playReaction() {
  stage(ic('bolt') + ' 반응속도', `<button class="rx idle" id="rx"><b>준비되면 탭!</b><small>초록색으로 바뀌면 최대한 빨리 누르세요${matchMedia('(pointer:fine)').matches ? ' · 스페이스바도 돼요' : ''}</small></button>${RE_ROW}<ol class="rxlog" id="rxlog"></ol><p class="rxfoul" id="rxfoul">초록색 전에 누르면 부정출발 · 첫 번은 봐주고, 그다음부터 한 번마다 +${RX_PEN}ms · ${RX_OUT}번이면 실격</p>`);
  const pad = $('#rx'), log = $('#rxlog'), fl = $('#rxfoul');
  const times = []; let state = 'idle', t0 = 0, timer = 0, raf = 0, alive = true, lastD = 0, fouls = 0;
  /* 대기 시간: 고르게 뽑으면(예전 1~3.5초) 기다릴수록 '이제 곧'이 보여 예측됨 →
     지수 분포(언제든 나올 확률이 같음)로 0.7~7초, 가끔 아주 짧게(0.45~0.95초), 직전과 0.7초 이상 차이
     → 5판 대기 합의 최솟값 ≈ 0.45+1.15+0.45+1.15+0.45 = 3.65초 (서버 checkRounds 플레이 시간 검사가 이 값 기준) */
  const rxDelay = () => {
    for (let i = 0; i < 20; i++) {
      const d = Math.random() < .12 ? 450 + Math.random() * 500 : 700 + -Math.log(1 - Math.random()) * 1700;
      if (d <= 7000 && Math.abs(d - lastD) >= 700) return (lastD = d);
    }
    return (lastD = 700 + Math.random() * 4000);
  };
  const stop = () => { clearTimeout(timer); cancelAnimationFrame(raf); timer = raf = 0; };
  const arm = () => {
    state = 'wait'; t0 = 0; pad.className = 'rx wait'; pad.innerHTML = `<b>기다려…</b><small>${times.length + 1} / 5</small>`;
    timer = setTimeout(() => {
      if (!alive || state !== 'wait') return;
      raf = requestAnimationFrame(() => {   // 이 프레임에 초록으로 바꾸고
        if (!alive || state !== 'wait') return;
        state = 'go'; pad.className = 'rx go'; pad.innerHTML = '<b>지금!</b>';
        raf = requestAnimationFrame(ts => { if (alive && state === 'go') t0 = ts; });   // 다음 프레임 시작 = 초록이 화면에 나온 시각
      });
    }, rxDelay());
  };
  const foul = why => {
    stop(); fouls++;
    const pen = rxPen(fouls);
    fl.className = 'rxfoul on' + (fouls >= RX_OUT - 1 ? ' hot' : '');
    fl.innerHTML = `부정출발 <b>${fouls} / ${RX_OUT}</b>` + (pen ? ` · 벌점 <b>+${pen}ms</b>` : ' · 이번 한 번은 봐줄게요');
    if (fouls >= RX_OUT) {
      state = 'done'; pad.className = 'rx early'; pad.innerHTML = `<b>실격!</b><small>부정출발 ${RX_OUT}번 — 이번 게임은 기록이 없어요</small>`;
      timer = setTimeout(() => { if (!alive) return; state = 'shown'; times.length = 0; fouls = 0; log.innerHTML = '';
        fl.className = 'rxfoul'; fl.textContent = '처음부터 다시! 초록색이 될 때까지 꾹 참기';
        pad.className = 'rx shown'; pad.innerHTML = '<b>다시 도전</b><small>탭해서 처음부터 (1 / 5)</small>'; }, 1800);
      return;
    }
    state = 'lock'; pad.className = 'rx early';
    pad.innerHTML = `<b>${why}</b><small>${pen ? `벌점 +${RX_PEN}ms · ` : ''}잠깐만요…</small>`;
    timer = setTimeout(() => { if (!alive || state !== 'lock') return; state = 'shown'; const s = pad.querySelector('small'); if (s) s.textContent = `${pen ? `벌점 +${RX_PEN}ms · ` : ''}탭해서 이번 판 다시 (${times.length + 1} / 5)`; }, RX_LOCK);
  };
  const press = at => {
    if (state === 'lock' || state === 'done') return;   // 부정출발 뒤 1초는 연타해도 안 넘어감
    if (state === 'idle' || state === 'shown') return arm();
    if (state === 'wait') return foul('앗, 너무 빨라요!');
    if (state !== 'go') return;
    if (!t0) return foul('앗, 너무 빨라요!');   // 초록으로 바꿨지만 아직 화면에 안 나온 순간 = 보고 누른 게 아님
    const ms = Math.round(at - t0);
    if (ms < RX_ANTI) return foul('미리 눌렀죠?');   // 초록이 보이고 0.1초 안 = 사람이 보고 누를 수 없는 속도(찍은 것)
    stop(); times.push(ms); log.insertAdjacentHTML('beforeend', `<li>${ms}ms</li>`);
    if (times.length >= 5) {
      state = 'done';
      const cap = times.map(t => Math.min(t, RX_CAP)), avg = Math.round(cap.reduce((a, b) => a + b, 0) / 5), pen = rxPen(fouls);
      const det = `<p class="rdet">${times.map(t => `<span>${t}ms</span>`).join(' · ')}</p>` + (fouls ? `<p class="rpen">평균 ${avg}ms + 부정출발 ${fouls}번 벌점 ${pen}ms</p>` : '');
      timer = setTimeout(() => alive && finish('reaction', Math.min(avg + pen, RX_CAP), det, [...cap, fouls]), 500);
      pad.className = 'rx done'; pad.innerHTML = `<b>${ms}ms</b>`;
    } else { state = 'shown'; pad.className = 'rx shown'; pad.innerHTML = `<b>${ms}ms</b><small>탭해서 다음 (${times.length + 1} / 5)</small>`; }
  };
  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!e.isPrimary || e.button > 0) return;   // 두 번째 손가락·오른쪽/가운데 클릭 무시
    press(evT(e));
  });
  pad.addEventListener('contextmenu', e => e.preventDefault());   // 길게 눌러도 메뉴 안 뜨게
  const key = e => {   // 스페이스바 (노트북) — 누르고 있어도 한 번만
    if (KM.actOf('reaction', e) !== 'tap' || !pad.isConnected) return;   // 키 설정(기본 Space)
    if (e.target.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('.modal.open')) return;
    e.preventDefault(); if (!e.repeat) press(evT(e));
  };
  const away = () => {   // 화면을 벗어나면 진행 중인 판 무효(벌점 없음)
    if (!document.hidden || (state !== 'wait' && state !== 'go')) return;
    stop(); state = 'shown'; pad.className = 'rx shown';
    pad.innerHTML = `<b>잠깐 멈췄어요</b><small>화면을 벗어나서 이번 판은 무효 · 탭해서 다시 (${times.length + 1} / 5)</small>`;
  };
  document.addEventListener('keydown', key);
  document.addEventListener('visibilitychange', away);
  quitGame = () => { alive = false; stop(); document.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', away); };
}

/* 2) 1 to 25: 틀리면 +1초 */
let N25 = null;   // n25.js 모듈 (1 to 25 2 — 미리보기 깃발 n25-v2, 처음 열 때 불러옴)
async function playNum25b() {
  const area = stage(ic('n25') + ' 1 to 25', '<p class="empty">불러오는 중…</p>');
  if (!N25) { try { N25 = await import('./n25.js'); } catch { area.innerHTML = '<p class="empty">게임을 불러오지 못했어요. 새로 고침해 주세요</p>'; return; } }
  if (!area.isConnected) return;
  area.innerHTML = N25.html(matchMedia('(pointer:coarse)').matches);
  area.querySelector('#n2Snd')?.insertAdjacentHTML('beforebegin', RE_BTN);   // 다시 시작은 안내 줄 오른쪽(소리 버튼 옆) — 줄을 하나 아껴 한 화면에
  quitGame = N25.run(area, {
    store, sound: store.get('n25_snd', false), onSound: on => store.set('n25_snd', on),
    onDone: (v, rounds, det) => finish('num25', v, det, rounds),
  });
}
function playNum25() {
  if (ffOn('n25-v2', isDev(S.me))) return playNum25b();
  const nums = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - .5);
  stage(ic('n25') + ' 1 to 25', `<div class="n25top"><span>다음 <b id="nNext">1</b></span><span id="nTime">0.00초</span></div>
    <div class="n25" id="n25">${nums.map(n => `<button data-n="${n}">${n}</button>`).join('')}</div>${RE_ROW}<p class="note center">틀리게 누르면 +1초</p>`);
  let next = 1, t0 = 0, pen = 0, raf = 0, alive = true; const taps = [];
  quitGame = () => { alive = false; cancelAnimationFrame(raf); };
  const tick = () => { if (!alive) return; $('#nTime').textContent = ((performance.now() - t0 + pen) / 1000).toFixed(2) + '초'; raf = requestAnimationFrame(tick); };
  $('#n25').addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    e.preventDefault();
    if (+b.dataset.n === next) {
      if (next === 1) { t0 = performance.now(); taps.push(0); tick(); }   // 첫 탭은 시작점이라 늘 0 (예전엔 tick() 뒤에 재서 느린 기기에서 1ms가 찍혀 보류됨, 2026-10-26)
      else taps.push(Math.round(performance.now() - t0));
      b.disabled = true; b.classList.add('ok'); next++;
      $('#nNext').textContent = next > 25 ? '끝!' : next;
      if (next > 25) { cancelAnimationFrame(raf); const ms = taps[24] + pen; setTimeout(() => alive && finish('num25', Math.min(ms, 600000), '', [...taps, pen]), 300); }
    } else if (next > 1) { pen += 1000; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); }
  });
}

/* 3) 컷 타이밍: 움직이는 플레이헤드를 컷 지점에서 멈추기 (5번, 점점 빨라짐) */
let CUT = null;   // cut.js 모듈 (컷 타이밍 2 — 미리보기 깃발 cut-v2, 처음 열 때 불러옴)
async function playCut2() {
  // 2026-10-27 하율 "노트북이면 노트북 화면처럼, 데스크탑이면 데스크탑 화면에서 띄운 것처럼": 마우스 쓰는 기기면 게임을 기기 화면(바탕화면 + 편집 프로그램 창) 안에 크게 띄움.
  //   모니터 가로(CSS px) 1920 이상 = 데스크탑(모니터+받침대), 그 밑 = 노트북(얇은 테두리+키보드 바닥). 창 제목줄은 맥(신호등 점)·윈도우(─ □ ✕) 따라감. 터치 기기·좁은 창은 그대로(CSS가 틀을 풂)
  const dev = matchMedia('(hover:hover) and (pointer:fine)').matches ? (screen.width >= 1920 ? 'desk' : 'lap') : '';
  const area = stage(ic('clap') + ' 편집의 신', '<p class="empty">불러오는 중…</p>', !!dev);
  if (!CUT) { try { CUT = await import('./cut.js'); } catch { area.innerHTML = '<p class="empty">게임을 불러오지 못했어요. 새로 고침해 주세요</p>'; return; } }
  if (!area.isConnected) return;
  const game = CUT.html(matchMedia('(pointer:coarse)').matches);
  const mac = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
  const bar = mac ? '<i class="ctd-dots"><i></i><i></i><i></i></i><b>편집의 신 — 시퀀스 01</b><i></i>'
    : '<b>편집의 신 — 시퀀스 01</b><i class="ctd-wc"><i>─</i><i>□</i><i>✕</i></i>';
  area.innerHTML = dev ? `<div class="ctd ${dev}"><div class="ctd-scr"><div class="ctd-win"><div class="ctd-tb${mac ? ' mac' : ''}" aria-hidden="true">${bar}</div><div class="ctd-body">${game}</div></div></div><i class="ctd-base" aria-hidden="true"></i></div>` : game;
  const cb = area.querySelector('.ctm-bar');
  cb?.insertAdjacentHTML('afterend', RE_ROW.replace('class="prow"', 'class="prow re-alt"'));
  cb?.querySelector('.ctm-snd')?.insertAdjacentHTML('beforebegin', RE_BTN.replace('class="prestart"', 'class="prestart re-in"'));
  const quit = CUT.run(area, {
    sound: store.get('cut_snd', false), onSound: on => store.set('cut_snd', on),
    onDone: (sum, errs, signed, cuts) => { finish('cut', Math.min(sum, 6000), CUT.resultHtml(sum, errs, signed, cuts), errs); CUT.paintReplay($('#parea')); },
  });
  quitGame = quit;
}
function playCut() {
  if (ffOn('cut-v2', isDev(S.me))) return playCut2();
  stage(ic('clap') + ' 컷 타이밍', `<p class="cutinfo"><span id="cRound">1 / 5</span> · 누적 오차 <b id="cSum">0ms</b></p>
    <div class="tl" id="tl"><div class="tl-ruler"></div><i class="tl-mark" id="cMark"></i><i class="tl-head" id="cHead"></i></div>
    <p class="cutmsg" id="cMsg">빨간 컷 지점에 플레이헤드가 오면 CUT!</p>
    <div class="cut-bar"><button class="btn big cutbtn" id="cBtn">✂ CUT</button>${RE_BTN.replace('class="prestart"', 'class="prestart re-in"')}</div>${RE_ROW.replace('class="prow"', 'class="prow re-alt"')}`);
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
    // 2026-10-27 판정 패치: 0초 = 첫 프레임, 끝은 실제 시각, 놓치면 1000ms(새 컷 타이밍과 같은 규칙)
    raf = requestAnimationFrame(now0 => {
      if (!alive) return; running = true; t0 = now0;
      const step = now => {
        if (!running || !alive) return;
        head.style.left = Math.max(0, Math.min(100, (now - t0) / dur * 100)) + '%';
        if (performance.now() - t0 >= dur) return stop(dur, true);   // 끝까지 가면 놓친 것
        raf = requestAnimationFrame(step);
      };
      step(now0);
    });
  };
  const stop = (tAt, miss) => {
    if (!running) return; running = false; cancelAnimationFrame(raf);
    const e = miss ? 1000 : Math.min(1000, Math.round(Math.abs(Math.max(0, tAt) - target)));
    errs.push(e); sum += e; $('#cSum').textContent = sum + 'ms';
    $('#cMsg').innerHTML = e <= 15 ? `<b class="perfect">PERFECT! ${e}ms</b>` : e <= 50 ? `<b class="great">GREAT ${e}ms</b>` : e <= 120 ? `<b>GOOD ${e}ms</b>` : `<b class="miss">${e >= 1000 ? 'MISS' : e + 'ms'}</b>`;
    round++;
    if (round >= 5) { btn.disabled = true; setTimeout(() => alive && finish('cut', Math.min(sum, 6000), `<p class="rdet">${errs.map(x => `<span>${x}ms</span>`).join(' · ')}</p>`, errs), 700); }
    else setTimeout(() => alive && start(), 650);
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); if (!running) return; const now = performance.now(), ts = e.timeStamp; stop((ts > 0 && ts <= now + 1 && now - ts < 250 ? ts : now) - t0); });
  start();
}

/* 4) 집에 가고 싶어!: 공룡 게임 방식 픽셀 러너 (js/runner.js) + 캐릭터 꾸미기 */
/* 6) 영상고 계단 오르기 (js/stair.js, 무한 계단식 픽셀 게임) — 2026-10-28 하율, 미리보기(개발자만)
   왼쪽 = 방향 바꾸기(← · F) / 오른쪽 = 오르기(→ · J · Space). 화면 왼쪽 절반·오른쪽 절반 터치도 같음.
   캐릭터는 '집에 가고 싶어!'에서 꾸민 그대로. 점수·층·종 게이지·'도착!'은 캔버스 위 DOM(또렷한 글자).
   끝 처리(2026-10-28 하율 "헛디뎌 끝났는데 다음 판 도중 게임 오버 창이 뜸 → 끝나면 확실히 끝나고 다시 시작"):
   판마다 번호(run)를 붙여, 결과·저장 응답이 다른 판에 끼어들지 않게. 끝나면 결과 창이 뜰 때까지(0.75초)와 뜬 뒤 0.5초는 입력 무시 → 그 뒤 아무 키·화면으로 새 판.
   시작 티켓도 판마다 따로(이전 판 저장이 새 판 티켓을 쓰던 문제) */
let STAIR = null;
async function playStair() {
  const touchy = matchMedia('(pointer:coarse)').matches;
  const area = stage(ic('stair') + ' <span class="sr-pre">영상고 </span>계단 오르기', `<div class="sr" id="sr"><div class="sr-main">
      <div class="hr-scr sr-scr" id="srScr"><canvas id="srCv" aria-label="게임 화면"></canvas>
        <div class="sr-hud" aria-hidden="true"><svg class="sr-bell" id="srBell" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="7" y="0" width="2" height="3" fill="#2a2846"/><path d="M6 2.5h4v1h1v1h1v3h1v3h1v1.5H2V10.5h1v-3h1v-3h1v-1h1z" fill="#ffd25e" stroke="#2a2846" stroke-width="1"/><path d="M5.5 4.5h1v5h-1zM4.5 8h1v2h-1z" fill="#fff1b8"/><path d="M3 10.5h10v1H3z" fill="#e09a2a"/><rect x="6.5" y="12.5" width="3" height="2.5" fill="#2a2846"/></svg><div class="sr-gauge"><b id="srG"></b></div></div>
        <div class="sr-num" aria-live="off"><b id="srN">0</b><small id="srF">1층</small></div>
        <div class="sr-pop" id="srPop" aria-live="polite"></div>
        <div class="sr-tap" aria-hidden="true"><span>방향 바꾸기</span><span>오르기</span></div>
        <div class="hr-ov" id="srOv"></div></div>
      <div class="sr-touch"><button type="button" class="btn big ghost" id="srT" aria-label="방향 바꾸기">⇄ 방향 바꾸기</button><button type="button" class="btn big" id="srC" aria-label="오르기">오르기 ▲</button></div>
      <div class="hr-bar"><button type="button" class="btn" id="srDress">${ic('brush')}캐릭터 꾸미기</button><p class="hr-keys"><span data-ka="turn"></span> 방향 바꾸기 · <span data-ka="climb"></span> 오르기</p>
        <button type="button" class="btn ghost hr-snd" id="srSnd" aria-pressed="false" aria-label="소리 켜기" data-tip="소리 켜기" data-tip-end></button></div>
      <div class="hr-dress" id="srDressBox" hidden></div></div>
      <aside class="sr-side" id="srRec"></aside>
    </div>`, true);   // 넓은 칸: 오른쪽에 내 기록
  if (!STAIR || !RUN) { try { STAIR = await import('./stair.js'); RUN = await import('./runner.js'); } catch { area.innerHTML = '<p class="empty">게임을 불러오지 못했어요. 새로 고침해 주세요</p>'; return; } }
  if (!$('#srCv')) return;
  const cv = $('#srCv'), ov = $('#srOv'), scr = $('#srScr'), gEl = $('#srG'), nEl = $('#srN'), fEl = $('#srF'), pop = $('#srPop');
  let sound = store.get('stair_snd', false), best = store.get('stair_best', 0), run = 0, runTk = null, shownN = -1, shownF = -1, popT = 0, shownG = '', shownLow = false, shownC = null;
  const ready = () => {
    ov.hidden = false; ov.className = 'hr-ov sr-ready'; scr.classList.add('rdy'); scr.classList.remove('low', 'end');
    ov.innerHTML = `<b>영상고 계단 오르기</b><span>종 치기 전에 계단으로 7층 꼭대기까지!</span>${best ? `<em class="sr-best">${ic('trophy')}내 최고 ${best.toLocaleString('ko-KR')}칸</em>` : ''}
      <small>${touchy ? '왼쪽·오른쪽을 눌러 출발' : `${esc(KM.keyName(KM.keysOf('stair').climb[0] || ''))} 오르기 · ${esc(KM.keyName(KM.keysOf('stair').turn[0] || ''))} 방향 바꾸기로 출발`}</small>`;
  };
  const R = STAIR.createStair(cv, {
    sound,
    onStart() { ov.hidden = true; scr.classList.remove('rdy'); runTk = S.me ? call('start', { game: 'stair' }).then(r => r.ticket).catch(() => '') : null; },
    onPause(on) { if (on) { ov.hidden = false; ov.className = 'hr-ov'; ov.innerHTML = `<b>잠깐 멈춤</b><span>종 게이지도 같이 멈췄어요</span><small>${touchy ? '화면을 누르면 계속' : '아무 키나 누르면 계속'}</small>`; } else ov.hidden = true; },
    onFrame(st) {
      // 최적화(2026-10-28): 바뀐 것만 DOM에 씀(매 프레임 class·style을 다시 쓰면 스타일 재계산)
      const gv = st.gauge.toFixed(3); if (gv !== shownG) { shownG = gv; gEl.style.setProperty('--g', gv); }   // CSP: style 속성 대신 CSSOM
      const low = st.scene === 'play' && st.gauge < .22; if (low !== shownLow) { shownLow = low; scr.classList.toggle('low', low); }
      const gc = st.gauge > .45 ? '' : st.gauge > .22 ? 'mid' : 'bad'; if (gc !== shownC) { shownC = gc; gEl.className = gc; }
      if (st.steps !== shownN) { shownN = st.steps; nEl.textContent = st.steps.toLocaleString('ko-KR'); if (st.steps) { nEl.classList.remove('bump'); void nEl.offsetWidth; nEl.classList.add('bump'); } }
      if (st.floor !== shownF) { shownF = st.floor; fEl.textContent = stairFloor(st.floor); }
    },
    onFloor(f, label, big, sub) {
      clearTimeout(popT); pop.className = 'sr-pop'; void pop.offsetWidth;
      pop.innerHTML = `<b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; pop.className = 'sr-pop on' + (big ? ' big' : '');
      popT = setTimeout(() => { pop.className = 'sr-pop'; }, sub ? 1900 : 1300);
    },
    onOver(res) {
      const no = run, tk = runTk; runTk = null;
      const nb = res.steps > best;
      if (nb) { best = res.steps; store.set('stair_best', best); }
      scr.classList.remove('low'); scr.classList.add('end');
      ov.hidden = false; ov.className = 'hr-ov dead';
      const msg = !S.me ? '로그인하면 랭킹에 올라가요' : res.steps < 1 ? '0칸은 기록하지 않아요' : '기록 저장 중…';
      ov.innerHTML = `<b>${res.why === 'time' ? '종 쳤다… 지각!' : '발을 헛디뎠어요!'}</b><div class="hr-card"><p class="hr-sc"><em>${res.steps.toLocaleString('ko-KR')}칸</em><span>${esc(stairFloor(res.floor))}까지 · ${(res.ms / 1000).toFixed(1)}초${res.ms > 1500 ? ` · 1초에 ${(res.steps / (res.ms / 1000)).toFixed(1)}칸` : ''}</span>${nb && res.steps ? '<i class="hr-nb">최고 기록!</i>' : ''}</p>
        <small class="hr-msg" id="srMsg">${msg}</small></div><small class="hr-go">${touchy ? '화면을 눌러 다시' : '스페이스 · 엔터 · 클릭으로 다시'}</small>`;
      if (!S.me || res.steps < 1) return;
      ticket = tk;   // 이 판의 티켓으로만 저장
      saveScore('stair', STAIR_MAX - res.steps, [res.steps, res.ms, res.turns]).then(r => {
        if (no !== run || !$('#srMsg')) return;
        if (r.held) { $('#srMsg').innerHTML = heldLine(r); return; }
        const b = r.best != null ? STAIR_MAX - r.best : best; if (b > best) { best = b; store.set('stair_best', b); }
        $('#srMsg').innerHTML = r.newBest ? '<b>최고 기록 경신!</b> 지금까지 중 가장 높이 올랐어요' : `내 최고 ${b.toLocaleString('ko-KR')}칸`;   // 응답에 best가 없으면 이 기기 최고(NaN 방지)
        myRecInto($('#srRec'), 'stair', null, { open: true });
      }).catch(e => { if (no === run && $('#srMsg')) $('#srMsg').textContent = e.message; });
    },
  });
  window.__stair = R;   // 테스트용
  ready();
  // 끝난 뒤 다시: 결과 창이 뜬 뒤 0.5초부터만 → 판 번호를 올리고 새 판(화면은 그대로)
  const again = () => {
    if (!R.st.shown || performance.now() - R.st.shownAt < 500) return;
    run++; clearTimeout(popT); pop.className = 'sr-pop'; R.reset(); ready();
  };
  const dress = charDress($('#srDressBox'), $('#sr'), $('#srDress'), c => R.setChar(c));
  $('#srDress').onclick = () => {   // 판 중엔 안 열림(판이 끝났으면 새 판 준비 화면으로 돌린 뒤)
    if (R.st.scene === 'over') { run++; clearTimeout(popT); pop.className = 'sr-pop'; R.reset(); ready(); }
    if (R.st.scene !== 'ready') return;
    dress.toggle();
  };
  const act = kind => { if (dress.open) return; if (R.st.scene === 'over') again(); else R.input(kind); };
  const pd = (kind, e) => { e.preventDefault(); if (e.button > 0) return; act(kind); };
  $('#srT').addEventListener('pointerdown', e => pd('turn', e)); $('#srC').addEventListener('pointerdown', e => pd('climb', e));
  scr.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); pd(e.clientX < r.left + r.width / 2 ? 'turn' : 'climb', e); });
  const kd = e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || dress.open || document.querySelector('.modal.open') || e.target.closest?.('input,textarea')) return;
    const c = e.code, ka = KM.actOf('stair', e), turn = ka === 'turn', climb = ka === 'climb';   // 키 설정대로(2026-10-28)
    if (R.st.scene === 'over') { if (climb || turn || c === 'Enter') { e.preventDefault(); again(); } return; }
    if (R.st.scene === 'pause' && c !== 'Escape' && c !== 'KeyR') { e.preventDefault(); R.input('climb'); return; }
    if (turn || climb) { e.preventDefault(); R.input(turn ? 'turn' : 'climb'); }
  };
  document.addEventListener('keydown', kd);
  const sndBtn = $('#srSnd');
  const paintSnd = () => { const t = sound ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', sound); };
  paintSnd();
  sndBtn.onclick = () => { sound = !sound; store.set('stair_snd', sound); R.setSound(sound); paintSnd(); sndBtn.blur(); };
  myRecInto($('#srRec'), 'stair', best ? STAIR_MAX - best : null, { open: true });
  // 선명도(2026-10-28): 판 폭을 '한 도트(160칸 기준) = 기기 픽셀 정수 배'로 맞춤 — CSS가 정한 폭 그대로면 1.08배·2.2배처럼 소수 배라
  // 도트 굵기가 들쭉날쭉하고, 캔버스(320)보다 작게 줄면 가는 선이 사라졌음. 짝수 배(캔버스 한 칸 = 정수 픽셀)를 우선, 너무 작아지면 홀수 배
  const snapScr = () => {
    if (!cv.isConnected) return;
    scr.style.removeProperty('width');
    const dpr = devicePixelRatio || 1, av = cv.getBoundingClientRect().width * dpr, bw = scr.offsetWidth - scr.clientWidth;
    let n = Math.floor(av / STAIR.W + .01);
    if (n < 2) return;   // 아주 작은 화면은 그대로(정수 배로 맞추면 너무 작아짐)
    if (n % 2 && n > 2 && (n - 1) / n >= .8) n--;
    scr.style.width = (n * STAIR.W / dpr + bw) + 'px';
  };
  let snapRaf = 0; const snapSoon = () => { cancelAnimationFrame(snapRaf); snapRaf = requestAnimationFrame(snapScr); };
  const snapRO = new ResizeObserver(snapSoon); snapRO.observe($('#parea')); addEventListener('resize', snapSoon); snapScr();
  quitGame = () => { run++; R.destroy(); clearTimeout(popT); snapRO.disconnect(); removeEventListener('resize', snapSoon); document.removeEventListener('keydown', kd); if (window.__stair === R) window.__stair = null; };
}

/* 5) 기자재 정리!: 촬영 장비 블록으로 기자재실 정리 (js/gear.js, 테트리스 방식) — 2026-10-27 하율, 미리보기(개발자만) */
let GEAR = null;   // gear.js 모듈 (처음 열 때 불러옴)
async function playGear() {
  const touchy = matchMedia('(pointer:coarse)').matches;
  const area = stage(ic('gear') + ' 기자재 정리!', `<div class="gr" id="gr">
      <div class="gr-main">
        <div class="gr-lcol"><aside class="gr-side"><p class="gr-lb">보관 <span data-ka="hold" data-one></span></p><canvas class="gr-mini" id="grHold" width="104" height="56"></canvas>
          <dl class="gr-stat"><dt class="gr-tmL">남은 시간</dt><dd id="grTm" class="gr-tm">2:00</dd><dt>점수</dt><dd id="grSc">0</dd><div class="gr-fxs" id="grFx"></div><dt>정리한 줄</dt><dd id="grLn">0</dd><dt>레벨</dt><dd id="grLv">1</dd></dl></aside><div class="gr-rkslot" id="grRkSlot"></div></div>
        <div class="gr-scr" id="grScr"><canvas id="grCv" aria-label="게임 화면"></canvas>
          <div class="gr-ov" id="grOv"></div><div class="gr-pop" id="grPop" aria-live="polite"></div></div>
        <aside class="gr-side"><p class="gr-lb">다음</p><div class="gr-next"><canvas class="gr-mini" id="grN0" width="104" height="56"></canvas><canvas class="gr-mini sm" id="grN1" width="104" height="56"></canvas><canvas class="gr-mini sm" id="grN2" width="104" height="56"></canvas></div></aside>
      </div>
      <div class="gr-touch">
        <div class="gt gt-l"><button type="button" class="btn ghost" data-gk="left" aria-label="왼쪽">◀</button><button type="button" class="btn ghost" data-gk="right" aria-label="오른쪽">▶</button>
        <button type="button" class="btn ghost" data-gk="down" aria-label="천천히 내리기">▼</button></div>
        <div class="gt gt-r"><button type="button" class="btn ghost" data-gk="ccw" aria-label="왼쪽으로 돌리기">↺</button><button type="button" class="btn" data-gk="cw" aria-label="오른쪽으로 돌리기">↻</button>
        <button type="button" class="btn" data-gk="drop" aria-label="바로 내리기">⤓</button><button type="button" class="btn ghost" data-gk="hold" aria-label="보관">보관</button></div></div>
      <div class="hr-bar gr-bar"><p class="hr-keys"><span data-ka="left" data-one></span><span data-ka="right" data-one></span> 이동 · <span data-ka="cw" data-one></span> 돌리기 · <span data-ka="down" data-one></span> 내리기 · <span data-ka="drop" data-one></span> 바로 놓기 · <span data-ka="hold" data-one></span> 보관 · <span data-ka="pause" data-one></span> 멈춤</p>
        ${RE_BTN}<button type="button" class="btn ghost hr-snd" id="grSnd" aria-pressed="false" aria-label="소리 켜기" data-tip="소리 켜기" data-tip-end></button></div>
      <div class="hr-rk" id="grRk"></div>
    </div>`, true);
  if (!GEAR) { try { GEAR = await import('./gear.js'); } catch { area.innerHTML = '<p class="empty">게임을 불러오지 못했어요. 새로 고침해 주세요</p>'; return; } }
  if (!$('#grCv')) return;
  const cv = $('#grCv'), ov = $('#grOv'), pop = $('#grPop');
  // 2026-10-27 하율: 일반(연습 — 랭킹 제외) / 랭킹전(2분 점수 대결 — 랭킹·보상) 두 가지로. best = 랭킹전 최고, bestN = 일반 최고(이 기기만)
  let sound = store.get('gear_snd', false), best = store.get('gear_best', 0), bestN = store.get('gear_best_n', 0), nRec = null, over = false, deadAt = 0, runNo = 0;
  let mode = 'normal';   // 2026-10-27 하율: 들어올 때마다 기본은 일반 모드(지난번 고른 방식 기억 안 함)
  const setMode = m => { mode = m === 'rank' ? 'rank' : 'normal'; store.set('gear_mode', mode); $('#gr').dataset.mode = mode; R.setLimit(mode === 'rank' ? GEAR_TIME : 0);
    ov.querySelectorAll('[data-gm]').forEach(b => { const on = b.dataset.gm === mode; if (on && b.getAttribute('aria-pressed') === 'false') { b.classList.remove('pick'); void b.offsetWidth; b.classList.add('pick'); } b.setAttribute('aria-pressed', on); }); paintHud(); };
  const hint = touchy ? '화면을 누르거나 버튼으로 시작' : '아무 키나 누르면 시작';
  const ready = () => { ov.hidden = false; ov.className = 'gr-ov hr-ov'; ov.innerHTML = `<b>기자재 정리!</b><span>수업 끝! 장비를 선반에 빈틈없이 정리해서<br>가로 한 줄을 채우면 반납 완료</span><ul class="gr-kinds">${GEAR.ORDER.map(k => `<li><canvas class="gr-k" data-k="${k}" width="104" height="56"></canvas><small>${GEAR.KIND[k].n}</small></li>`).join('')}</ul>
    <div class="gr-modes" role="group" aria-label="게임 방식"><button type="button" data-gm="normal"><b>일반</b><small>${gtOn() ? '시간 제한 없이 오래 버티기' : '시간 제한 없음 · 티어 제외'}</small></button><button type="button" data-gm="rank"><b>${ic('trophy')}랭킹전</b><small>${gtOn() ? '2분 안에 최고 점수' : '2분 점수 대결 · 티어 반영'}</small></button></div>
    ${gtOn() ? '<small class="gr-gt">티어엔 두 방식 중 순위가 더 좋은 쪽이 들어가요</small>' : ''}<small>${touchy ? '방식을 누르면 바로 시작' : '← → 로 방식 고르고, 아무 키나 누르면 시작'}</small>`; ov.querySelectorAll('[data-k]').forEach(c => R.drawMini(c, c.dataset.k)); setMode(mode); requestAnimationFrame(() => ov.querySelectorAll('[data-k]').forEach(c => { const w = c.getBoundingClientRect().width || 78; snapMini(c, w, Math.max(w, (c.closest('ul')?.clientWidth || 4 * w) / 4 - 4)); R.drawMini(c, c.dataset.k); })); };
  // 점수는 올라가는 게 보이게 굴려서 표시 + 오를 때 툭 튀김 (2026-10-27 하율 "점수 얻을 때 확실한 이펙트")
  let shown = 0;
  const paintHud = () => { const s = R.st, sc = $('#grSc');
    if (s.score < shown) shown = s.score; else if (s.score > shown) shown += Math.max(1, Math.ceil((s.score - shown) * .35));
    sc.textContent = shown.toLocaleString('ko-KR'); $('#grLn').textContent = s.lines; $('#grLv').textContent = s.level;
    if (mode === 'rank') { const left = Math.max(0, GEAR_TIME - s.ms), sec = Math.ceil(left / 1000), tm = $('#grTm'); tm.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); tm.classList.toggle('warn', s.scene === 'play' && left <= 10000); } };
  const bump = big => { const sc = $('#grSc'); sc.classList.remove('bump', 'bump2'); void sc.offsetWidth; sc.classList.add(big ? 'bump2' : 'bump'); };
  const scr0 = $('#grScr');
  // 점수 효과는 판 위가 아니라 점수판 옆에서 (2026-10-27 2차 하율: 판 위 '+점수'가 시야를 가림)
  const floatPt = (pts, x, y, n) => {
    if (n) {
      const el = document.createElement('i'); el.className = 'gr-fx n' + n; el.textContent = '+' + pts.toLocaleString('ko-KR');
      const slot = $('#grFx'); slot.replaceChildren(el); setTimeout(() => el.remove(), 900);
      scr0.classList.remove('hit', 'hit4'); void scr0.offsetWidth; scr0.classList.add(n === 4 ? 'hit4' : 'hit');
    }
    bump(n);
  };
  // 작은 장비 그림(52×28 도트)은 한 도트 = 기기 픽셀 정수 배가 되게 폭을 맞춤(2026-10-28 — 1.15배·0.67배처럼 소수 배로 늘리면 도트 굵기가 들쭉날쭉·뭉개짐)
  const snapMini = (c, w = c.getBoundingClientRect().width || 78, max = w * 1.12) => { const dpr = devicePixelRatio || 1; let n = Math.max(1, Math.round(w * dpr / 52)); while (n > 1 && 52 * n / dpr > max) n--; const pw = 52 * n; c.style.width = pw / dpr + 'px'; if (c.width !== pw) { c.width = pw; c.height = 28 * n; } };
  const paintQ = () => { R.drawMini($('#grHold'), R.st.hold);   // 보관 블록은 다음 블록처럼 그대로 (2026-10-27 하율: 흐리게 그리던 것 제거)
     [0, 1, 2].forEach(i => R.drawMini($('#grN' + i), R.st.queue[i])); };
  let popT = 0;
  const R = GEAR.createGear(cv, {
    sound,
    // 시작 티켓은 판을 시작하는 순간 고른 방식으로 받음(2026-10-28: 일반 모드도 서버에 저장 → 'gearn' 순위, 티어 제외)
    onStart() { ov.hidden = true; over = false; paintQ(); ticket = S.me ? call('start', { game: mode === 'rank' ? 'gear' : 'gearn' }).then(r => r.ticket).catch(() => '') : null; },
    onQueue: paintQ,
    onScore: floatPt,
    onPause(on) { if (on) { ov.hidden = false; ov.className = 'gr-ov hr-ov'; ov.innerHTML = `<b>잠깐 멈춤</b><span>정리하던 장비는 그대로 있어요</span><small>${touchy ? '화면을 누르면 계속' : '아무 키나 누르면 계속'}</small>`; } else ov.hidden = true; },
    onClear(n, name, pts, up) {
      // 2026-10-27 하율 "위에 뜨는 효과는 더 크고 화려하게": 글자가 하나씩 튀어 오르고, 뒤에 빛살이 돌며 별가루가 터짐 (4줄은 무지개)
      clearTimeout(popT); pop.className = 'gr-pop on n' + n;
      const letters = [...name].map((ch, i) => ch === ' ' ? ' ' : `<span data-i="${i}">${esc(ch)}</span>`).join('');
      const stars = Array.from({ length: n === 4 ? 14 : 4 + n * 2 }, (_, i) => { const a = i / (n === 4 ? 14 : 4 + n * 2) * 6.283 + Math.random() * .4, d = 60 + Math.random() * (n === 4 ? 70 : 40);
        return `<i class="gr-star" data-x="${Math.round(Math.cos(a) * d)}" data-y="${Math.round(Math.sin(a) * d * .6)}" data-d="${(Math.random() * .15).toFixed(2)}"></i>`; }).join('');
      pop.innerHTML = `<div class="gr-burst"></div>${stars}<b>${letters}</b><small>+${pts.toLocaleString('ko-KR')}</small>${up ? `<em>레벨 ${R.st.level}!</em>` : ''}`;
      pop.querySelectorAll('[data-i]').forEach(e => e.style.setProperty('--i', e.dataset.i));   // CSP가 style="" 속성을 막아서 CSSOM으로
      pop.querySelectorAll('.gr-star').forEach(e => { e.style.setProperty('--x', e.dataset.x + 'px'); e.style.setProperty('--y', e.dataset.y + 'px'); e.style.setProperty('--d', e.dataset.d + 's'); });
      { const b = pop.querySelector('b'), fs = parseFloat(getComputedStyle(b).fontSize), w = $('#grScr').clientWidth * .92; if (b.scrollWidth > w) b.style.fontSize = Math.floor(fs * w / b.scrollWidth) + 'px'; }   // 긴 문구('울트라 기자재! X2' 등)가 판 밖으로 안 넘치게 줄임
      void pop.offsetWidth; popT = setTimeout(() => { pop.className = 'gr-pop'; }, n === 4 ? 1500 : 1200);
    },
    onOver(res) {
      over = true; deadAt = performance.now(); const no = ++runNo, rk = mode === 'rank';
      const nb = rk ? res.score > best : res.score > bestN;
      if (nb && rk) { best = res.score; store.set('gear_best', best); } else if (nb) { bestN = res.score; store.set('gear_best_n', bestN); }
      ov.hidden = false; ov.className = 'gr-ov hr-ov dead';
      const msg = !S.me ? (rk ? '로그인하면 랭킹에 올라가요' : '로그인하면 일반 모드 순위에 올라가요') : !rk && res.score >= 1 ? '일반 순위 확인 중…' : !rk ? '0점은 기록하지 않아요' : res.score < 1 ? '0점은 기록하지 않아요' : '기록 저장 중…';
      ov.innerHTML = `<b>${res.timeUp ? '시간 끝! 반납 완료' : '장비실이 꽉 찼어요!'}</b><div class="hr-card"><p class="hr-sc"><em>${res.score.toLocaleString('ko-KR')}점</em><span>${rk ? '랭킹전 · ' : '일반 · '}${res.lines}줄 · 레벨 ${res.level}</span>${nb ? '<i class="hr-nb">최고 기록!</i>' : ''}</p>
        <small class="hr-msg" id="grMsg">${msg}</small></div><small class="hr-go">${touchy ? '화면을 눌러 다시' : '스페이스 · 엔터 · 클릭으로 다시'}</small>`;
      if (!S.me || res.score < 1) return;
      // 일반 모드(2026-10-28 하율 "랭크에는 포함되지 않아도 순위는 나오게"): 'gearn'으로 저장 → 따로 순위만(티어·보상·미션 제외)
      saveScore(rk ? 'gear' : 'gearn', GEAR_MAX - res.score, [res.score, res.lines, res.pieces, res.ms]).then(r => {
        if (no !== runNo || !$('#grMsg')) return;
        if (r.held) { $('#grMsg').innerHTML = heldLine(r); return; }
        if (!rk) {
          nRec = { best: GEAR_MAX - r.best, rank: r.rank };
          if (nRec.best > bestN) { bestN = nRec.best; store.set('gear_best_n', bestN); }
          $('#grMsg').innerHTML = `${r.newBest ? '<b>일반 최고 기록 경신!</b> ' : ''}일반 모드 <b>${r.rank}위</b> · 내 최고 ${esc(GAMES.gearn.fmt(r.best))} <button type="button" class="hr-rklink" data-rank="gearn" data-scope="${gtOn() ? 'round' : 'all'}">순위 보기</button><br><small${gtOn() ? ' id="grTi">티어 확인 중…' : '>티어·보상과는 상관없어요'}</small>`;
          paintRk(); gtEnd(no); return;
        }
        $('#grMsg').innerHTML = (r.newBest ? '<b>최고 기록 경신!</b> 지금까지 중 가장 잘했어요' : `랭킹전 내 최고 ${esc(GAMES.gear.fmt(r.best))}`) + (gtOn() ? '<br><small id="grTi">티어 확인 중…</small>' : '');
        syncBest(r.best); paintRk(); gtEnd(no);
      }).catch(e => { if (no === runNo && $('#grMsg')) $('#grMsg').textContent = e.message; });
    },
  });
  // gear-tier: 결과 화면에 지금 티어에 들어간 모드(일반이 반영되면 강조)
  function gtEnd(no) {
    if (!gtOn()) return;
    gearTier().then(t => { const el = $('#grTi'); if (!el || no !== runNo) return;
      if (!t) { el.textContent = ''; return; }
      const x = t.on ? t.x : null;
      el.innerHTML = x && x.m === 'n' && !t.dev ? `<b>일반 모드가 티어에 반영돼요!</b> (${x.p}점${x.o ? ` · 랭킹전 ${x.o.p}점` : ''})` : esc(t.dev ? gtText(t) : x ? `티어엔 ${gtMode(x.m)}(${x.p}점)이 들어가 있어요` : gtText(t)); });
  }
  window.__gear = R;   // 테스트용
  ready(); paintHud(); paintQ();
  const hudT = setInterval(paintHud, 50);
  const restart = () => {
    if (!over || performance.now() - deadAt < 400) return false;
    over = false; ticket = null;   // 티켓은 onStart에서(고른 방식으로)
    R.reset(); shown = 0; ready(); paintHud(); paintQ(); return true;
  };
  // 화면 크기: 판(120×240)을 정수 배(기기 픽셀 기준)로 — 옆 칸(보관·다음)과 아래 버튼·랭킹이 스크롤 없이 보이게
  // 2026-10-27 기기별 최적화: 가로로 눕힌 폰(세로 600px 이하 + 터치)은 조작 버튼을 판 양옆으로(.gr CSS) → 세로는 판만 들어가면 되고, 가로는 버튼 자리를 뺌.
  //   판이 작아지면 시작·끝 안내를 줄여 보여 줌(data-bs: s 300px 미만 · xs 190px 미만, data-bh: 판 높이 380px 미만)
  const sideMQ = matchMedia('(pointer:coarse) and (orientation:landscape)');   // 2026-10-28: 가로 태블릿(아이패드)도 버튼을 판 양옆으로
  const fit = () => {
    // 폭은 창 기준(게임 칸 폭이 앱 창에서 좁게 잡히던 경우 대비 — 2026-10-27 2차)
    // 2026-10-27 3차 하율 "전체적으로 크기 키우고 바로 다음 블록은 더 크게": 보관·바로 다음 = 큰 칸, 그 뒤 2개 = 작은 칸. 옆 칸 폭은 큰 칸에 맞춤
    // 기기별 최적화(2026-10-27): 눕힌 폰은 양옆 터치 버튼 자리(extra)를 빼고, 세로는 판만 들어가게(hRes) · 최소 1배
    let hRes; const sideBtns = sideMQ.matches, extra = sideBtns ? 2 * (innerHeight > 600 ? 178 : 150) + 20 : 0, minK = sideBtns ? 1 : 1.5;
    // 2026-10-27 하율 "너무 커, 기기마다 화면에 딱 맞게": 창 높이가 아니라 실제 게임 칸(.parea)의 보이는 아래 끝 기준 + 판 아래 줄(터치 버튼·키 안내) 실제 높이만큼 빼서, 판과 키 안내가 스크롤 없이 한 화면에
    const pa = $('#gr').closest('.parea'), pr = pa ? pa.getBoundingClientRect() : null;
    const top = $('#grScr').getBoundingClientRect().top + (pa ? pa.scrollTop : 0), dpr = devicePixelRatio || 1;
    const vh = Math.min(innerHeight, visualViewport?.height || innerHeight, pr && pr.bottom > 0 ? pr.bottom : innerHeight);
    const tch = $('#gr .gr-touch'), bar = $('#gr .gr-bar'), tH = tch && getComputedStyle(tch).display !== 'none' && !sideBtns ? tch.offsetHeight + 12 : 0;
    hRes = sideBtns ? (innerHeight > 600 && bar ? bar.offsetHeight + 24 : 12) : tH + (bar ? bar.offsetHeight + 12 : 0) + 14;
    const w = Math.min(innerWidth - 24, 1240), avH = vh - top - hRes;
    const bigOf = q => Math.round(Math.min(52 * Math.min(3.4, q * 1.2), innerWidth * (innerWidth < 520 ? .13 : .17)));
    let q = 2.5; for (let i = 0; i < 3; i++) q = Math.max(minK, Math.min((w - 2 * (bigOf(q) + 22) - 40 - extra) / GEAR.BW, avH / GEAR.BH));
    const big = bigOf(q), side = 2 * (big + 22) + 40 + extra;
    document.querySelectorAll('#gr .gr-side').forEach(el => { el.style.width = big + 22 + 'px'; });
    $('#gr').style.setProperty('--sw', big + 22 + 'px');   // 아래 키 안내·랭킹 줄 폭도 커진 옆 칸에 맞춤(안 맞추면 키 안내가 두 줄로 꺾임)
    // 2026-10-27 하율 "화면이 이상해": 앱 창(배율이 소수인 기기)에서 내림 때문에 최소 크기보다 작아지고, 창 높이가 바뀌어도 다시 안 맞춰 판이 손바닥만 했음
    //   → 최소 크기는 올림으로 지키고, 창 크기·게임 칸 크기가 바뀔 때마다 다시 맞춤
    const k = Math.min((w - side) / GEAR.BW, avH / GEAR.BH);
    const mk = Math.min(minK, Math.max(1, k));   // 아주 작은 창에선 최소 배율보다 화면 맞춤이 먼저
    let per = Math.max(Math.ceil(mk * dpr) <= k * dpr ? Math.ceil(mk * dpr) : Math.floor(mk * dpr), Math.floor(k * dpr)) / dpr;
    if (per < k * .88) per = Math.max(mk, Math.floor(k * 20) / 20);   // 정수 배로 내리면 판이 너무 작아질 때(눕힌 폰 1.3배→1배)만 소수 배
    const gr = $('#gr'), bw = per * GEAR.BW, bh = per * GEAR.BH;
    gr.dataset.bs = bw < 190 ? 'xs' : bw < 300 ? 's' : ''; gr.dataset.bh = bh < 380 ? 's' : '';
    cv.style.width = per * GEAR.BW + 'px';
    // 보관·다음 칸 캔버스도 보이는 크기(기기 픽셀)만큼 만들어 선명하게
    document.querySelectorAll('#gr .gr-mini').forEach(c => snapMini(c, c.classList.contains('sm') ? Math.round(big * .62) : big));
    R.setScale(per * dpr); paintQ();
    $('#gr').style.setProperty('--gw', Math.round(per * GEAR.BW) + 'px');
  };
  fit(); const fitT = [setTimeout(fit, 250), setTimeout(fit, 1000)];   // 창이 열리며 크기가 바뀌는 앱 창 대비
  const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe($('#parea')); ro.observe(document.documentElement); addEventListener('resize', fit); sideMQ.addEventListener?.('change', fit);
  // 키보드
  // 글자 키는 e.code(자판 위치)로 — 한글 입력 상태면 C가 'ㅊ'으로 와서 보관(C)·돌리기(Z·X)·멈춤(P)이 안 먹던 문제 (2026-10-27 하율 "보관 기능이 제대로 안돼")
  const keyOf = e => { const a = KM.actOf('gear', e); return a === 'pause' || a === 'restart' ? '' : a; };   // 키 설정대로(2026-10-28, e.code라 한글 입력 상태도 그대로)
  // 같은 동작을 여러 키로 누를 수 있어서(←와 A 등) 실제로 눌린 키를 기억 — 하나만 떼도 멈추던 문제 (2026-10-28)
  const HOLDK = ['left', 'right', 'down'], held = new Map();
  const relAll = () => { held.clear(); HOLDK.forEach(a => R.input(a, false)); };
  const kd = e => {
    if (e.target.closest?.('input,textarea') || document.querySelector('.modal.open')) return;
    if (e.metaKey || e.ctrlKey) { relAll(); return; }   // 맥 Cmd+화살표 등: keyup이 안 와서 키가 눌린 채 남던 문제 (2026-10-28)
    if (over) { if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); restart(); } return; }
    if (R.st.scene === 'ready' && (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code) || ['left', 'right'].includes(KM.actOf('gear', e)))) { e.preventDefault(); if (e.repeat) return; setMode(mode === 'rank' ? 'normal' : 'rank'); return; }   // 시작 전: 방식 고르기
    if (R.st.scene === 'ready' && (e.code === 'Digit1' || e.code === 'Digit2')) { e.preventDefault(); setMode(e.code === 'Digit2' ? 'rank' : 'normal'); R.input('cw', true); R.input('cw', false); return; }
    if (KM.actOf('gear', e) === 'pause') { e.preventDefault(); if (R.st.scene === 'play') R.pause(); else R.resume(); return; }
    const a = keyOf(e); if (!a) { if (R.st.scene !== 'play' && !['Meta', 'Alt', 'Control', 'Tab', 'Escape', 'CapsLock', 'HangulMode', 'Process'].includes(e.key)) { e.preventDefault(); R.input('cw', true); } return; }   // 시작 전·멈춤: 아무 키(엔터 포함)나
    e.preventDefault();
    const fe = document.activeElement; if (fe?.matches?.('button') && fe.closest('#gamePlay')) fe.blur();   // 버튼에 포커스가 남아 스페이스가 그 버튼(다시 시작·방식 등)을 누르던 문제
    if (HOLDK.includes(a)) { held.set(e.code, a); if (e.repeat && (R.st.scene !== 'play' || R.isHeld(a))) return; }   // 누른 걸 놓친 채(창 전환·Cmd 등) 계속 누르고 있으면 반복 신호로 다시 잡음
    else if (e.repeat) return;
    R.input(a, true);
  };
  const ku = e => {
    if (e.key === 'Meta' || e.key === 'Control') return relAll();
    const a = keyOf(e); if (!a) return; e.preventDefault();
    if (HOLDK.includes(a)) { held.delete(e.code); if ([...held.values()].includes(a)) return; }
    R.input(a, false);
  };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  // 터치 버튼: 누르고 있으면 좌우·아래는 계속
  $('#gr .gr-touch').addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-gk]'); if (!b) return; e.preventDefault();
    if (over) { restart(); return; }
    const a = b.dataset.gk; R.input(a, true);
    const up = () => { R.input(a, false); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); b.removeEventListener('lostpointercapture', up); };
    try { b.setPointerCapture(e.pointerId); } catch {}
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  // 게임 화면 손가락 조작: 톡 = 돌리기 · 옆으로 밀기 = 한 칸씩 이동 · 아래로 휙 = 바로 놓기 · 아래로 천천히 = 내리기
  let tp = null;
  const scr = $('#grScr');
  scr.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (over) { restart(); return; }
    if (R.st.scene === 'ready') {   // 방식 버튼: 마우스·터치로 누르면 눌리는 모양을 잠깐 보여 주고 그 방식으로 시작 (2026-10-27 하율)
      const mb = e.target.closest?.('[data-gm]');
      if (mb) { if (mb.classList.contains('go')) return; setMode(mb.dataset.gm); mb.classList.add('go'); setTimeout(() => { mb.classList.remove('go'); if (R.st.scene === 'ready') { R.input('cw', true); R.input('cw', false); } }, 180); return; }
    }
    if (R.st.scene !== 'play') { R.input('cw', true); R.input('cw', false); return; }
    tp = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false, soft: false };
    try { scr.setPointerCapture(e.pointerId); } catch {}
  });
  scr.addEventListener('pointermove', e => {
    if (!tp) return;
    const cell = cv.getBoundingClientRect().width / GEAR.COLS;
    while (e.clientX - tp.x > cell) { R.input('right', true); R.input('right', false); tp.x += cell; tp.moved = true; }
    while (tp.x - e.clientX > cell) { R.input('left', true); R.input('left', false); tp.x -= cell; tp.moved = true; }
    if (e.clientY - tp.y0 > cell * 1.5 && Math.abs(e.clientX - tp.x0) < cell * 1.5 && !tp.soft) { tp.soft = true; R.input('down', true); }
  });
  const tup = e => {
    if (!tp) return;
    const dy = e.clientY - tp.y0, dt = performance.now() - tp.t, cell = cv.getBoundingClientRect().width / GEAR.COLS;
    if (tp.soft) R.input('down', false);
    if (dy > cell * 2 && dt < 260) { R.input('drop', true); R.input('drop', false); }
    else if (!tp.moved && !tp.soft && Math.abs(dy) < cell && dt < 300) { R.input('cw', true); R.input('cw', false); }
    tp = null;
  };
  scr.addEventListener('pointerup', tup); scr.addEventListener('pointercancel', tup);
  ov.addEventListener('pointerdown', e => { if (e.target.closest('[data-rank]')) return; if (over) { e.stopPropagation(); restart(); } });   // '순위 보기'는 다시 시작 대신 순위 창
  const blur = () => { relAll(); if (R.st.scene === 'play') R.pause(); };
  window.addEventListener('blur', blur);
  // 아래 랭킹(친구·전체 1~5등) — 집에 가고 싶어!와 같은 모양
  function syncBest(v) { if (v == null || !isFinite(v)) return; const b = GEAR_MAX - v; if (b > 0 && b !== best) { best = b; store.set('gear_best', b); } }
  async function paintRk() {   // 게임 화면 아래: 순위 대신 내 기록 (2026-10-27 하율)
    const el = $('#grRk'); if (!el) return;
    const r = await myRecInto(el, 'gear', best ? GEAR_MAX - best : null, { open: false });   // 접는 버튼(2026-10-28 하율)
    if (r?.best) syncBest(r.best.v);
    const lb = el.querySelector('.mr-best > span'); if (lb) lb.textContent = '랭킹전 최고';
    // 일반 모드: 서버 기록 순위(2026-10-28) — 이번에 저장한 결과가 있으면 그 순위, 없으면 이 기기 최고
    if (bestN || nRec) (el.querySelector('.mr-body') || el.querySelector('.myrec'))?.insertAdjacentHTML('beforeend', `<p class="mr-n">일반 모드 내 최고 <b>${(nRec?.best || bestN).toLocaleString('ko-KR')}점</b>${nRec?.rank ? `<small>${nRec.rank}위</small>` : `<small>${S.me ? '' : '이 기기'}</small>`}${S.me ? '<button type="button" class="hr-rklink" data-rank="gearn" data-scope="all">일반 순위</button>' : ''}</p>`);
  }

  // 내 기록 자리(2026-10-28 하율 "스크롤 안 해도 보이게"): 마우스 기기 넓은 화면은 보관 칸 아래(접는 버튼, 펼치면 왼쪽 빈자리에 떠서 판을 안 가림), 그 외는 아래 줄
  const recMQ = matchMedia('(hover:hover) and (pointer:fine) and (min-width:760px) and (min-height:501px)');
  const placeRk = () => { const el = $('#grRk'); if (!el) return; const to = recMQ.matches ? $('#grRkSlot') : $('#gr'); if (el.parentElement !== to) to.appendChild(el); };
  placeRk(); recMQ.addEventListener?.('change', placeRk);
  paintRk();
  const sndBtn = $('#grSnd');
  const paintSnd = () => { const t = sound ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', sound); };
  paintSnd();
  sndBtn.onclick = () => { sound = !sound; store.set('gear_snd', sound); R.setSound(sound); paintSnd(); sndBtn.blur(); };
  quitGame = () => { R.destroy(); clearInterval(hudT); recMQ.removeEventListener?.("change", placeRk); fitT.forEach(clearTimeout); clearTimeout(popT); ro.disconnect(); removeEventListener('resize', fit); sideMQ.removeEventListener?.('change', fit); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); if (window.__gear === R) delete window.__gear; };
}

/* 캐릭터 꾸미기 창 — 캐릭터를 쓰는 게임 공용(집에 가고 싶어!·영상고 계단 오르기)
   2026-10-28 하율: "캐릭터를 따로 써야되는 게임은 아래에 캐릭터 커스터마이징 버튼 무조건 추가" — 새 캐릭터 게임도 이걸 붙일 것.
   저장은 runner.js saveChar(한 캐릭터를 모든 게임이 같이 씀). onChar(c): 게임 화면에 바로 반영 */
function charDress(box, wrap, btn, onChar) {
  let char = RUN.loadChar(), pvTimer = 0;
  function closeDress() { box.hidden = true; clearInterval(pvTimer); wrap.classList.remove('dressing'); }
  function paintDress() {
    box.innerHTML = `<div class="hd-pv"><canvas id="hdCv" aria-label="내 캐릭터"></canvas><div class="hd-frs">${['run1', 'jump', 'duck1'].map((f, i) => `<button type="button" data-hf="${f}" class="${i ? '' : 'on'}">${['달리기', '점프', '숙이기'][i]}</button>`).join('')}</div>
        <div class="row"><button type="button" class="btn ghost hd-dice" id="hdRnd" aria-label="무작위로 꾸미기" title="무작위로 꾸미기"><svg class="sic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-dice"/></svg></button><button type="button" class="btn" id="hdDone">완료</button></div></div>
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
        RUN.saveChar(char); onChar(char); pv(); return;
      }
      if (e.target.closest('#hdRnd')) { char = RUN.randomChar(); RUN.saveChar(char); onChar(char); const keep = fr; paintDress(); box.querySelector(`[data-hf="${keep}"]`)?.click(); box.querySelector('#hdRnd')?.classList.add('roll'); return; }
      if (e.target.closest('#hdDone')) { closeDress(); btn.focus(); }
    };
  }
  return {
    get open() { return !box.hidden; },
    close: closeDress,
    toggle() { if (!box.hidden) return closeDress(); char = RUN.loadChar(); paintDress(); box.hidden = false; wrap.classList.add('dressing'); },
  };
}
let RUN = null;   // runner.js 모듈 (처음 열 때 불러옴)
async function playHome() {
  const area = stage(ic('run') + ' 집에 가고 싶어!', `<div class="hr" id="hr">
      <div class="hr-scr" id="hrScr"><canvas id="hrCv" aria-label="게임 화면"></canvas>
        <div class="hr-ov" id="hrOv"><b>집에 가고 싶어!</b><span>종 쳤다! 장애물을 피해 집까지 달려요</span><small>${matchMedia('(pointer:coarse)').matches ? '화면이나 점프 버튼을 눌러 출발' : '스페이스 · ↑ · 화면 클릭으로 출발'}</small></div></div>
      <div class="hr-touch"><button type="button" class="btn big" id="hrJ">점프</button><button type="button" class="btn big ghost" id="hrD">숙이기</button>${RE_BTN.replace('class="prestart"', 'class="prestart re-in"')}</div>
      <div class="hr-bar"><button type="button" class="btn" id="hrDress">${ic('brush')}캐릭터 꾸미기</button>
        <p class="hr-keys"><span data-ka="jump"></span> 점프 (길게 누르면 더 높이) · <span data-ka="duck"></span> 숙이기</p>
        <button type="button" class="btn ghost hr-snd" id="hrSnd" aria-pressed="false" aria-label="소리 켜기" data-tip="소리 켜기" data-tip-end></button></div>
      ${RE_ROW}
      <div class="hr-dress" id="hrDressBox" hidden></div>
      <div class="hr-rk" id="hrRk"></div>
    </div>`, true);
  if (!RUN) { try { RUN = await import('./runner.js'); } catch { area.innerHTML = '<p class="empty">게임을 불러오지 못했어요. 새로 고침해 주세요</p>'; return; } }
  if (!$('#hrCv')) return;   // 불러오는 사이 그만둠
  const cv = $('#hrCv'), ov = $('#hrOv'), scr = $('#hrScr');
  // 안내 글자 맞춤 (2026-10-27 하율: 게임 오버 문구가 위아래로 잘림). 게임 화면은 3:1로 납작해서 세로가 먼저 모자라는데
  // 글자 크기는 가로 폭(vw·컨테이너 폭) 기준이라, 3배 화면(세로 312px)에서도 제목+결과 카드+'다시' 안내가 세로를 넘쳤음.
  // → 실제로 잰 높이·폭이 게임 화면보다 크면 안쪽 줄들만 그 비율로 줄임(zoom). 기록 저장 문구가 바뀌어도 다시 맞춤
  let fitting = false;
  const fitOv = () => {
    if (ov.hidden || fitting) return; fitting = true;
    const kids = [...ov.children]; kids.forEach(c => { c.style.zoom = ''; });
    for (let i = 0; i < 3 && kids.length; i++) {
      const cs = getComputedStyle(ov), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const gap = (parseFloat(cs.rowGap) || 0) * (kids.length - 1);
      const top = Math.min(...kids.map(c => c.getBoundingClientRect().top)), bot = Math.max(...kids.map(c => c.getBoundingClientRect().bottom));
      const wid = Math.max(...kids.map(c => c.getBoundingClientRect().width));
      const needH = bot - top - gap, roomH = ov.clientHeight - pad - gap - 2;
      const roomW = ov.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
      const k = Math.min(1, roomH / needH, roomW / wid);
      if (k > .985) break;
      const z = (parseFloat(kids[0].style.zoom) || 1) * k;
      kids.forEach(c => { c.style.zoom = Math.max(.45, z).toFixed(3); });
    }
    fitting = false;
  };
  new MutationObserver(() => requestAnimationFrame(fitOv)).observe(ov, { childList: true, subtree: true, characterData: true });
  const ovHid = new MutationObserver(() => requestAnimationFrame(fitOv)); ovHid.observe(ov, { attributes: true, attributeFilter: ['hidden', 'class'] });
  document.fonts?.ready.then(fitOv);
  let char = RUN.loadChar(), sound = store.get('home_snd', false);
  let best = store.get('home_best', 0);
  let last = store.get('home_last', null);   // 직전 판 기록 (2026-10-25 하율: 점수 옆에 전 기록)
  // 화면 크기 (2026-10-25): 가로 폭 + 세로 남는 자리까지 보고 최대한 크게. 한 도트 = 기기 픽셀 정수배(dpr 2면 0.5px 단위)라 도트 크기가 고르게
  const fit = () => {
    const w = $('#parea').clientWidth - 6, top = scr.getBoundingClientRect().top + scrollY;
    const hAvail = innerHeight - top - 320;   // 아래 조작 줄 + 친구·전체 랭킹(1~5등)이 스크롤 없이 보이게
    // 최소 3배(세로 312px) — 게임 오버 문구가 잘리지 않게 (2026-10-25 하율). 단 가로로 눕힌 폰처럼 세로가 짧으면
    // 점프·숙이기 버튼이 화면 밖으로 밀려나지 않게 '게임 화면 + 터치 버튼'이 한 화면에 들어오는 만큼만 (2026-10-27, 최소 2배)
    const tch = $('#hr .hr-touch'), ctrl = tch && tch.offsetHeight ? tch.offsetHeight + 12 : 0;
    const hFit = innerHeight - top - ctrl - 14;
    const dpr = devicePixelRatio || 1, k = Math.min(w / RUN.W, Math.max(Math.max(2, Math.min(3, hFit / RUN.H)), hAvail / RUN.H));
    const per = k >= 1 ? Math.floor(k * dpr) / dpr : k;
    const cw = Math.min(w, per * RUN.W);
    cv.style.width = cw + 'px'; $('#hr').style.width = cw + 6 + 'px';   // 아래 조작 줄·랭킹 줄도 게임 화면 폭에 맞춤
    requestAnimationFrame(fitOv);
  };
  // 게임 오버 (2026-10-25 하율: 가벼운 게임이라 결과 화면으로 넘어가지 않게) — 공룡 게임처럼 화면 위에 기록만 띄우고 그 자리에서 바로 다시
  let over = false, deadAt = 0, runNo = 0, choosing = false, goTicket = null;
  const touchy = matchMedia('(pointer:coarse)').matches;
  const R = RUN.createRunner(cv, char, {
    frozen: () => !!document.querySelector('.modal.open'),   // 랭킹 등 창이 떠 있는 동안 멈춤 (2026-10-28)
    sound, best: () => best, sfx2: ffOn('home-sfx', isDev(S.me)),
    onStart() { ov.hidden = true; ov.classList.remove('dead', 'win', 'again'); $('#hr').classList.add('on'); closeDress(); },
    onReady() {   // 집에서 나와 출발 자리에 섬 → 입력하면 다시 출발
      ov.hidden = false; ov.className = 'hr-ov again';
      ov.innerHTML = `<b>다시 출발!</b><span>이제 끝없이 달려요</span><small>${touchy ? '화면이나 점프 버튼을 눌러 출발' : '스페이스 · 화살표 · 화면 클릭으로 출발'}</small>`;
    },
    onOver(score, ms, win) {   // win: 5만 m 골인(집 도착) — 집에서 쉬기 / 밖으로 나가기 고르기
      if (win) return arrived(score, ms);
      over = true; deadAt = performance.now(); const no = ++runNo; $('#hr').classList.remove('on');
      const nb = score > best;
      if (nb) { best = score; store.set('home_best', best); }
      const prev = last; last = score; store.set('home_last', score);
      ov.hidden = false; ov.classList.add('dead'); ov.classList.toggle('win', !!win);
      // 결과 카드 하나에 기록·직전·저장 상태를 정리 (2026-10-25 하율: 게임 화면에 다 때려 넣어 잘리고 여백 없음 → 정돈)
      ov.innerHTML = `<b>${win ? '집 도착! 수고했어요' : '앗, 집에 못 갔다…'}</b><div class="hr-card"><p class="hr-sc"><em>${score.toLocaleString('ko-KR')}m</em><span>${(ms / 1000).toFixed(1)}초</span>${nb ? '<i class="hr-nb">최고 기록!</i>' : ''}</p>${prev != null ? `<p class="hr-prev">직전 ${prev.toLocaleString('ko-KR')}m${score !== prev ? `<i class="${score > prev ? 'hr-up' : 'hr-dn'}">${score > prev ? '▲' : '▼'}${Math.abs(score - prev).toLocaleString('ko-KR')}</i>` : ''}</p>` : ''}
        <small class="hr-msg" id="hrMsg">${S.me ? '기록 저장 중…' : '로그인하면 랭킹에 올라가요'}</small></div><small class="hr-go">${matchMedia('(pointer:coarse)').matches ? '화면을 눌러 다시' : '스페이스 · ↑ · 클릭으로 다시'}</small>`;
      if (!S.me) return;
      saveScore('home', HOME_MAX - Math.max(1, score), [Math.max(1, score), ms]).then(r => {
        if (no !== runNo || !$('#hrMsg')) return;
        if (r.held) { $('#hrMsg').innerHTML = heldLine(r); return; }
        $('#hrMsg').innerHTML = r.first ? `<b>히든 보상!</b> 처음으로 집에 온 단 한 사람 — 착용 소품 ‘집 열쇠’ · 칭호 ‘${esc(HOME_TITLE)}’를 받았어요`
          : r.arrived ? `<b>집 도착!</b> 칭호 ‘${esc(HOME_TITLE2)}’를 받았어요 — 프로필 꾸미기에서 달 수 있어요`
          : (r.newBest ? '<b>최고 기록 경신!</b> 지금까지 중 가장 멀리 왔어요' : `내 최고 ${esc(GAMES.home.fmt(r.best))}`);
        syncBest(r.best);
        if (r.first || r.arrived) refreshMe();
        paintRk(true);
      }).catch(e => { if (no === runNo && $('#hrMsg')) $('#hrMsg').textContent = e.message; });
    },
  });
  // 집 도착(2026-10-25 하율): 마리오 골인처럼 집에 들어간 뒤 안내 + 버튼 두 개.
  // 처음 도착한 한 사람: '집에 최초로 도착했습니다!' + 히든 칭호 발견 띠 / 그 뒤: '집에 도착했습니다!' + 받은 칭호
  // 왼쪽 '집에서 쉬기' = 5만 m로 끝 · 오른쪽 '밖으로 나가기' = 캐릭터가 나와서, 입력하면 같은 판을 이어 끝없이 달림(이어 달리기 티켓)
  function arrived(score, ms) {
    over = true; choosing = true; deadAt = performance.now(); const no = ++runNo; $('#hr').classList.remove('on');
    const nb = score > best;
    if (nb) { best = score; store.set('home_best', best); }
    last = score; store.set('home_last', score);
    ov.hidden = false; ov.className = 'hr-ov dead win';
    const paint = r => {
      const first = !!r?.first;
      const title = first ? '집에 <u>최초로</u> 도착했습니다!' : '집에 도착했습니다!';
      const prize = !S.me ? '<p class="hr-prize">로그인하면 도착 칭호를 받을 수 있어요</p>'
        : !r ? '<p class="hr-prize wait">칭호 확인 중…</p>'
        : r.err ? `<p class="hr-prize">${esc(r.err)}</p>`
        : r.held ? `<p class="hr-prize">${heldLine(r)}</p>`
        : first ? `<div class="hr-hidden"><i>히든 칭호 발견!</i><p>처음으로 히든 칭호를 발견했어요</p><p class="hr-ttl"><span class="t-first">${esc(HOME_FIRST)}</span> ${esc(HOME_TITLE)}</p><small>착용 소품 ‘집 열쇠’도 함께 받았어요 · 프로필 꾸미기에서 달 수 있어요</small></div>`
        : `<p class="hr-prize">${r.arrived ? '칭호를 얻었어요' : '보유 중인 칭호'} <b class="hr-ttl">${esc(HOME_TITLE2)}</b>${r.arrived ? ' · 프로필 꾸미기에서 달 수 있어요' : ''}</p>`;
      ov.innerHTML = `<b class="hr-win">${title}<br>축하합니다!</b>${prize}
        <div class="hr-pick"><button type="button" class="btn ghost" data-hr="rest">${ic('home')}집에서 쉬기</button><button type="button" class="btn" data-hr="out">${ic('run')}밖으로 나가기</button></div>`;
    };
    paint(null);
    goTicket = null;
    if (!S.me) return;
    const sv = saveScore('home', HOME_MAX - score, [score, ms]);
    goTicket = sv.then(r => r.next || '').catch(() => '');
    sv.then(r => {
      if (r.held) { if (no === runNo && choosing) paint(r); return; }
      syncBest(r.best);
      if (r.first || r.arrived) refreshMe();
      paintRk(true);
      if (no === runNo && choosing) paint(r);
    }).catch(e => { if (no === runNo && choosing) paint({ err: e.message }); });
  }
  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-hr]'); if (!b || !choosing) return;
    choosing = false;
    if (b.dataset.hr === 'rest') {   // 5만 m로 끝 — 이 판 기록은 이미 저장됨
      deadAt = performance.now();
      ov.querySelector('.hr-pick')?.remove();
      ov.insertAdjacentHTML('beforeend', `<p class="hr-prize">푹 쉬어요! 오늘 기록 <b>${GOAL.toLocaleString('ko-KR')}m</b></p><small class="hr-go">${touchy ? '화면을 눌러 다시' : '스페이스 · ↑ · 클릭으로 다시'}</small>`);
      return;
    }
    over = false; ov.hidden = true; ov.className = 'hr-ov';
    ticket = S.me ? goTicket : null;   // 같은 판을 이어서 저장
    R.goOut();
  });
  // 다시 하기: 죽은 뒤 0.4초가 지나야 (누르고 있던 점프로 바로 다시 시작되지 않게). 새 판마다 서버 시작 티켓을 새로 받음
  const restart = () => {
    if (!over || choosing || performance.now() - deadAt < 400) return false;
    over = false; ticket = S.me ? call('start', { game: 'home' }).then(r => r.ticket).catch(() => '') : null;
    R.reset(); R.jump(); return true;
  };
  // 아래 랭킹 (2026-10-25 하율: 버튼 없이 바로 보이게) — 왼쪽 친구 랭킹 · 오른쪽 전체 랭킹, 각 1~5등 + 순위 밖이면 내 순위
  // 로그인 중이면 '내 최고'(아래 줄·게임 화면 HI)는 서버 기록으로 맞춤 — 기기마다 따로 쌓인 값과 결과 카드의 '내 최고'가 달랐음 (2026-10-25)
  function syncBest(v) { if (v == null || !isFinite(v)) return; const b = HOME_MAX - v; if (b >= 0 && b !== best) { best = b; store.set('home_best', b); } }
  async function paintRk() {   // 게임 화면 아래: 순위 대신 내 기록 (2026-10-27 하율)
    const el = $('#hrRk'); if (!el) return;
    const r = await myRecInto(el, 'home', best ? HOME_MAX - best : null);
    if (r?.best) syncBest(r.best.v);
  }

  paintRk();
  window.__home = R;   // 테스트용 (헤드리스 점검)
  fit();
  const ro = new ResizeObserver(fit); ro.observe($('#parea')); addEventListener('resize', fit);
  // 입력: 키보드 · 화면 탭(점프) · 아래 버튼(점프/숙이기)
  const hkey = e => KM.actOf('home', e).replace('restart', '') || (e.code === 'ArrowLeft' || e.code === 'ArrowRight' ? 'go' : '');   // 키 설정대로(2026-10-28) · ←→는 집 도착 버튼 고르기
  const relH = () => { R.input('jump', false); R.input('duck', false); };
  const kd = e => {
    if (e.metaKey || e.ctrlKey) { relH(); return; }
    const a = hkey(e); if (!a || !$('#hrDressBox').hidden || e.target.closest?.('input,textarea') || document.querySelector('.modal.open')) return;
    if (choosing) {   // 집에서 고르는 중: ←·→로 버튼 이동, 스페이스·엔터는 버튼 그대로(실수로 새 판 시작 안 되게)
      if (a === 'go') { e.preventDefault(); const bs = [...ov.querySelectorAll('[data-hr]')]; (bs[e.key === 'ArrowLeft' ? 0 : 1] || bs[0])?.focus(); }
      return;
    }
    e.preventDefault(); if (e.repeat) return;
    if (over) { if (a === 'jump') restart(); return; }
    R.input(a, true);
  };
  const ku = e => { if (e.key === 'Meta' || e.key === 'Control') return relH(); const a = hkey(e); if (a) R.input(a, false); };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  const hold = (el, a) => {
    el.addEventListener('pointerdown', e => { if (e.target.closest?.('[data-hr]')) return; e.preventDefault(); if (!$('#hrDressBox').hidden || choosing) return; if (over) { restart(); return; } R.input(a, true); try { el.setPointerCapture(e.pointerId); } catch {} });
    const up = () => R.input(a, false);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  hold(scr, 'jump'); hold($('#hrJ'), 'jump'); hold($('#hrD'), 'duck');
  const blur = () => { R.input('jump', false); R.input('duck', false); };
  window.addEventListener('blur', blur);
  function cleanup() { R.destroy(); ro.disconnect(); removeEventListener('resize', fit); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); if (window.__home === R) delete window.__home; }
  quitGame = cleanup;
  const sndBtn = $('#hrSnd');
  const paintSnd = () => {   // 소리 아이콘: 켜짐 = 스피커+소리 물결, 꺼짐 = 스피커+✕ (2026-10-25)
    const t = sound ? '소리 끄기' : '소리 켜기';
    sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`;
    sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', sound);
  };
  paintSnd();
  sndBtn.onclick = () => { sound = !sound; store.set('home_snd', sound); R.setSound(sound); paintSnd(); sndBtn.blur(); };

  /* --- 캐릭터 꾸미기 (공용 charDress) --- */
  const dress = charDress($('#hrDressBox'), $('#hr'), $('#hrDress'), c => { char = c; R.setChar(c); });
  $('#hrDress').onclick = () => {
    if (R.st.scene === 'dead') { over = false; R.reset(); ov.classList.remove('dead'); ov.innerHTML = '<b>집에 가고 싶어!</b>'; }
    if (R.st.scene !== 'ready') return;
    dress.toggle();
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
  // 뽑기(gacha.js·gacha-fx.js)는 뽑기 화면을 처음 열 때만 불러옴 — 첫 화면에서 받는 코드 줄이기
  let gch = null;
  c.RENDER.gacha = () => (gch ||= import('./gacha.js').then(m => { m.init({ call, refreshMe, me: () => S.me, setGc, edit: o => { if (S.me) openEdit(o); } }); return m; })).then(m => m.render());
NW.init(() => S.me);
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
  startPoll(); startBuddies();
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
  })).catch(() => {   // 실패 표시도 done → 이 글자 바꿈이 다시 MutationObserver를 불러 무한 반복(화면 멈춤)하던 것 막음. 다음에 창을 열면 다시 시도
    gReady = null;
    els.forEach(el => { el.dataset.done = '1'; el.classList.add('gfail'); el.textContent = '구글 로그인을 불러오지 못했어요'; });
  });
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
function googleSignup(credential, name) {   // 구글로 처음 왔을 때: 아이디·닉네임·학년·반·동아리만 정하고 가입 (비밀번호 없음)
  const c = ctx.getClass?.() || null;
  sheet(`<h3>🎉 구글로 가입하기</h3><p class="note">아이디와 닉네임만 정하면 끝! 다음부터는 구글 버튼으로 로그인해요.</p>
    <form class="sform" id="gForm">
      <label>아이디<input name="handle" required minlength="3" maxlength="16" pattern="[a-zA-Z0-9_.]{3,16}" autocapitalize="off" placeholder="영어 소문자·숫자 3~16자"><small class="hint">🔑 나중에 바꿀 수 없어요.</small></label>
      <label>이름 (닉네임)<input name="name" required maxlength="20" value="${esc(name || '')}"></label>
      <div class="two"><label>학년<select name="grade">${[1, 2, 3].map(g => `<option value="${g}" ${c && +c.g === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label><label>반<select name="cls">${Array.from({ length: CLS_N }, (_, i) => `<option value="${i + 1}" ${c && +c.c === i + 1 ? 'selected' : ''}>${i + 1}반</option>`).join('')}</select></label></div>
      ${clubPickHtml()}
      ${S.needCode ? '<label>가입 코드<input name="code" required maxlength="40"></label>' : ''}
      <p class="ferr" role="alert" hidden></p>
      <div class="row"><button class="btn" type="submit">가입하고 시작하기</button><button class="btn ghost" type="button" data-close>취소</button></div>
    </form>`);
  $('#gForm').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector('[type=submit]');
    if (!e.target.querySelector('[name=club]:checked')) { const box = e.target.querySelector('.ferr'); box.textContent = '동아리를 골라 주세요 (없으면 \'없음\')'; box.hidden = false; return; }
    b.disabled = true;
    try { const res = await call('google', { credential, ...d, handle: d.handle.trim().toLowerCase(), grade: +d.grade, cls: +d.cls }); closeSheet(); await googleDone('signup', res); }
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
// 배포 첫 2주 가입 선물(서버 joinBonus) — 환영 인사 뒤에 붙임
const giftMsg = r => r?.gift > 0 ? ` 가입 선물로 뽑기권 ${r.gift}장을 더 드렸어요` : '';
async function googleDone(mode, res) {
  await refreshMe();
  toast(mode === 'signup' ? `환영해요, ${S.me.name}! 🎉${giftMsg(res)}` : `${S.me.name}, 반가워요!`, res?.gift > 0 ? 5000 : 1800);
  if (!store.get('gtip', false)) { store.set('gtip', true); setTimeout(() => toast('학교 기기라면 다 쓴 뒤 구글에서도 로그아웃해 주세요 🔒'), 2600); }
  ctx.authed?.(S.me, true, mode);
  renderMe();
}

/* ===== 헤더: 💡 의견 보내기 · 📢 공지 모아 보기 ===== */
const pad2 = n => String(n).padStart(2, '0');
const dt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const NT_IC = { warn: '⚠️', fun: '🎉' };   // 일반(info) 공지는 아이콘 없음 — 창 맨 위 '📢 공지'와 겹쳐 보여서
let ntList = null;
// 업데이트 소식(패치노트): /api/s/patch 게시본(lib/patch.js — 컨펌된 초안이 월요일 06:00에 공개) + 옛 public/patchnotes.json (최신이 맨 앞)
// 개발자 계정에는 '다음 공지 초안'(pnDraft)도 같이 와서 공지 창에서 바로 고칠 수 있음 — 학생에겐 안 보임
let ptList = null, pnDraft = null;
async function checkNotices() {   // 새 공지·새 업데이트 소식이 있으면 📢 버튼에 빨간 점 (본 것: sg_notice_seen · sg_patch_seen)
  const [n, p, old] = await Promise.all([
    fetch('/api/notices').then(r => r.json()).then(j => j.list || []).catch(() => []),
    fetch('/api/s/patch', { credentials: 'same-origin', cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    fetch('/patchnotes.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).then(j => Array.isArray(j) ? j : []).catch(() => []),
  ]);
  ntList = n; ptList = [...(p.list || []), ...old]; pnDraft = p.draft || null;
  $('#ntDot').hidden = !((ntList.length && store.get('notice_seen') !== ntList[0].id) || (ptList.length && store.get('patch_seen') !== ptList[0].id));
}
const dueTxt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
// 개발자 전용: 다음 공지 초안 편집 카드
function draftCard(d, hot) {   // hot: 핫픽스 초안이면 그 고친 날('YYYY-MM-DD')
  const row = (x = {}) => `<li data-id="${esc(x.id || '')}" data-pf="${esc(x.ff || '')}" data-img="${esc(x.img || '')}" data-noimg="${x.noimg ? 1 : ''}"><textarea rows="2" maxlength="300" placeholder="공지 한 줄 (이모지·이모티콘 환영)">${esc(x.t || '')}</textarea>${x.img ? `<span class="pdimg"><img src="${esc(x.img)}" alt="" loading="lazy"><button type="button" class="pdix" data-tip="사진 빼기">사진 빼기</button></span>` : ''}${x.ff ? `<small class="pdff">새 기능 · ${esc(x.ff)}</small>` : ''}<button type="button" class="pdx" aria-label="이 줄 빼기" data-tip="이 줄 빼기">✕</button></li>`;
  return `<div class="pdraft${hot ? ' pdhot' : ''}"${hot ? ` data-hot="${esc(hot)}"` : ' id="pnDraft"'}><p class="pdh"><b>${hot ? `📝 ${+hot.slice(5, 7)}/${+hot.slice(8)} 고친 것 · 패치 공지 초안` : '📝 모아 둔 공지 초안'}</b><span class="pdme">나만 보여요</span></p>
    <p class="note">${hot ? `이날 고치고 추가한 것들이에요. 문구를 고치고 <b>공개에 체크해 저장</b>해야 <b>${esc(dueTxt(d.due))}</b>에 모두에게 올라가요(새 기능도 그때 모두에게 열려요). 체크 안 하면 시간이 지나도 안 올라가고, 나중에 체크해 저장하면 그때 바로 올라가요.` : d.imm ? '<b>바로 공지 기간(11/2 월 06:00까지)</b>: 여기서 <b>저장하는 순간 바로 모두에게 공개</b>돼요(자동으로 쌓인 수정 소식은 저장 전엔 안 나가요).' : `수정을 올리면 여기에 바로 쌓여요. 고치거나 빼고 저장하면, 체크해 둔 초안만 <b>${esc(dueTxt(d.due))}</b>에 모두에게 한 번에 공개돼요.`}</p>
    <input class="pdt" maxlength="60" placeholder="${esc(d.defTitle)}" value="${esc(d.title || '')}">
    <ol class="pdl">${d.items.map(row).join('')}</ol>${d.items.length ? '' : '<p class="empty">아직 쌓인 공지가 없어요</p>'}
    <button type="button" class="btn ghost pdadd">＋ 한 줄 추가</button>
    <label class="pdok"><input type="checkbox" ${d.approved ? 'checked' : ''}><span>${esc(dueTxt(d.due))}에 모두에게 공개</span></label>
    <div class="row"><button type="button" class="btn pdsave">저장</button></div></div>`;
}
function bindDraft() { $$('#socSheet .pdraft').forEach(bindDraftBox); }
function bindDraftBox(box) {
  const hot = box.dataset.hot || '';
  const list = box.querySelector('.pdl');
  const rowHtml = () => { const t = document.createElement('template'); t.innerHTML = draftCard({ ...pnDraft, items: [{}] }); return t.content.querySelector('.pdl li'); };
  box.addEventListener('click', e => { if (e.target.closest('.pdx')) e.target.closest('li').remove(); else if (e.target.closest('.pdix')) { const li = e.target.closest('li'); li.dataset.img = ''; li.dataset.noimg = '1'; e.target.closest('.pdimg').remove(); } });
  box.querySelector('.pdadd').onclick = () => { const li = rowHtml(); list.append(li); box.querySelector('.empty')?.remove(); li.querySelector('textarea').focus(); };
  box.querySelector('.pdsave').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const j = await call('patch', { ...(hot ? { hot } : {}), title: box.querySelector('.pdt').value, ok: box.querySelector('.pdok input').checked,
        items: [...list.children].map(li => ({ id: li.dataset.id, ff: li.dataset.pf, img: li.dataset.img, noimg: !!li.dataset.noimg, t: li.querySelector('textarea').value })) });
      pnDraft = j.draft; ptList = null;
      toast(j.published ? '공개 시각이 지나서 바로 모두에게 올렸어요 🎉' : '초안을 저장했어요');
      if (j.published) openNotices(); else b.disabled = false;
    } catch (x) { fail(x); b.disabled = false; }
  };
}
async function openNotices(focus) {   // focus: 띠 공지를 눌러 열면 그 공지의 자세한 내용을 펼쳐 보임
  sheet('<h3>📢 공지</h3><ul class="ntlist">' + ghostOr(() => ['이번 주 업데이트 소식이 들어가는 자리', '공지 제목이 들어가는 자리예요', '10월 27일 화요일 패치'].map(t => `<li><span class="nt-ic">🛠</span><div class="nt-c"><p class="nt-t">${t}</p><div class="ntb"><div class="nb-txt">공지 내용 미리보기가 두 줄 정도 들어가는 자리예요. 내용이 길면 자세히 보기로 펼쳐요</div></div><small>10월 27일</small></div></li>`).join(''), 2) + '</ul>');
  $('#socSheet').classList.add('wide');   // 공지는 넓게: 접힌 공지 제목이 2줄 안에 들어가게
  if (!ntList || !ptList || (isDev(S.me) && !pnDraft)) await checkNotices();
  if (ntList.length) store.set('notice_seen', ntList[0].id);   // 다 봤음 (✕로 닫은 띠 공지는 다시 띄우지 않음)
  if (ptList.length) store.set('patch_seen', ptList[0].id);
  $('#ntDot').hidden = true;
  // 공지·업데이트 소식 공통 모양: 굵은 큰 제목 + 내용 2줄 미리보기 → 📖 자세히 보기로 펼치고, 맨 아래 작은 '접기'로 다시 접음
  const card = (live, ic, title, inner, foot, id) => `<li class="${live ? 'live' : ''}"${id ? ` data-nid="${esc(id)}"` : ''}>${ic ? `<span class="nt-ic">${ic}</span>` : ''}<div class="nt-c">
      <p class="nt-t">${title}</p>${inner ? `<div class="ntb"><div class="nb-txt">${inner}</div><button type="button" class="nb-more">📖 자세히 보기</button><button type="button" class="nb-fold">접기 ▴</button></div>` : ''}
      <small>${foot}</small></div></li>`;
  const patches = ptList.slice(0, 12).map((x, i) => card(!i, '🛠', esc(x.title || '업데이트'),
      (x.items || []).length ? `<ul class="ptitems">${x.items.map(t => typeof t === 'string' ? `<li>${esc(t)}</li>` : `<li>${esc(t.t || '')}${t.img ? `<img class="ptimg" src="${esc(t.img)}" alt="" loading="lazy">` : ''}</li>`).join('')}</ul>` : '', `${esc(x.date || '')}${i ? '' : ' · <b>최신</b>'}`, x.id ? 'p:' + x.id : '')).join('');
  $('#socSheet').innerHTML = `<h3>📢 공지</h3>${ntList.length ? `<ul class="ntlist">${ntList.map(n => card(n.live, NT_IC[n.tone] || '',
      n.link ? `<a href="${esc(n.link)}" data-close>${esc(n.text)}</a>` : esc(n.text), n.body ? esc(n.body) : '',
      `${dt(n.at)}${n.live ? ' · <b>지금 공지</b>' : ''}`, n.id)).join('')}</ul>` : '<p class="empty">아직 공지가 없어요</p>'}
    ${patches || pnDraft ? `<h3 class="sp">🛠 업데이트 소식</h3>${pnDraft && isDev(S.me) ? (pnDraft.hot || []).map(h => draftCard({ ...h, approved: h.ok }, h.day)).join('') + (pnDraft.items?.length ? draftCard(pnDraft) : '') : ''}${patches ? `<ul class="ntlist">${patches}</ul>` : ''}` : ''}
    <div class="row"><button class="btn ghost" data-close>닫기</button></div>`;
  $$('#socSheet .ptimg').forEach(im => im.onclick = () => {   // 공지 사진 누르면 크게 보기 (어디든 누르거나 Esc로 닫기)
    const z = document.createElement('div'); z.className = 'ptzoom'; z.innerHTML = `<img src="${esc(im.getAttribute('src'))}" alt="">`;
    const off = () => { z.remove(); removeEventListener('keydown', k, true); }, k = e => { if (e.key === 'Escape') { e.stopPropagation(); off(); } };
    z.onclick = off; addEventListener('keydown', k, true); document.body.append(z);
  });
  $$('#socSheet .ntb').forEach(b => {   // 2줄 안에 다 들어가는 짧은 내용은 '자세히 보기' 버튼을 숨김
    const t = b.querySelector('.nb-txt');
    if (t.scrollHeight <= t.clientHeight + 2) b.classList.add('short');
    b.querySelector('.nb-more').onclick = () => b.classList.add('open');
    b.querySelector('.nb-fold').onclick = () => { b.classList.remove('open'); b.closest('li').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  });
  bindDraft();
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
