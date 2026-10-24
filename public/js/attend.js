// SVMHS GROUND — 출석 체크 (듀오링고식 연속 출석) · 서버: lib/attend.js + functions/api/s/[[path]].js (att · attrank)
// 로그인한 채로 사이트를 열면 하루 한 번 자동 출석 → 첫 출석이면 축하 창, 헤더 🔥 → 출석 창
// 디자인 원칙 (듀오링고 연구에서 가져옴 — tools/attend/DESIGN.md)
//  1. 평소엔 짧고 가볍게, 기념일(MILESTONES·보상 해금)만 크게: 빛줄기 + 색종이 + 보상 카드가 차례로
//  2. 불꽃이 기록에 따라 '진화': 주황(1~6) → 붉은 주황(7~29) → 금빛(30~99) → 푸른 불꽃(100~)
//  3. 완벽한 연속(방패 안 씀) = 불꽃에 금빛 후광 · 이번 주 월~금 개근 = 요일 도장이 한 줄 띠로 이어짐
//  4. 이어진 날은 달력·이번 주에서 띠로 연결 → 끊기기 싫은 마음(연속의 시각화)
//  5. 다음 보상까지 남은 날을 늘 보여 줌 (목표가 분명하게)
import { $, esc, pad } from './util.js';
import { REWARDS, KIND, COLOR_NAME, rwOn, rwName, objName } from './att-rewards.js';
import { artOf, ui, medal } from './att-art.js';
export { REWARDS };
export const unlocked = (best, total, kind) => REWARDS.filter(r => r.kind === kind && rwOn(r, best || 0, total || 0)).map(r => r.v);
export const lockedOf = kind => REWARDS.filter(r => r.kind === kind);

let api;   // social.js에서 받음: call · sheet · closeSheet · av · nameOf · devTag · classTxt · atOf · openModal · closeModal · onBest
let st = null, checking = null, doneDay = '';
const kstDay = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const DOW = ['월', '화', '수', '목', '금', '토', '일'];   // 이번 주 도장 줄(월~일)
const DOW_S = ['일', '월', '화', '수', '목', '금', '토'];   // 달력(일요일 시작)
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----- 불꽃 그림 (직접 그림, 규칙: tools/attend/ART_GUIDE.md '불꽃')
   두툼한 아래 → S자로 오른쪽으로 살짝 기울며 가늘어짐 · 크기가 다른 갈고리 끝 3개 · C자로 파인 가장자리 · 떨어져 나간 불씨 2개
   4겹(바깥·가운데·속·심지) + 남색 외곽선 + 두께(오른쪽 아래 진한 판) + 왼쪽 광택 = 로고와 같은 젤리 스티커.
   tier: 0 주황 · 1 붉은 주황 · 2 금빛 · 3 푸른 불꽃. 'burn' 클래스를 붙이면 한 번 활활 타오르고 가만히 멈춤 ----- */
// 개발자 계정은 연속 출석 무한(서버가 1e6을 보냄) → 화면엔 ∞
export const fmtN = n => n >= 1e6 ? '∞' : n;
export const tierOf = n => n >= 100 ? 3 : n >= 30 ? 2 : n >= 7 ? 1 : 0;
const FIRE = [   // [바깥 위, 바깥 아래, 가운데 위, 가운데 아래, 속 위, 속 아래, 심지, 두께]
  ['#ffa03e', '#ff5a36', '#ffc24c', '#ff8b3a', '#ffe68c', '#ffc64e', '#fff9df', '#cf4127'],
  ['#ff7c3a', '#e2372d', '#ffae3e', '#ff6a2e', '#ffd86c', '#ffb43e', '#fff3d0', '#a82a22'],
  ['#ffcf3d', '#f39a0b', '#ffe168', '#ffbe2c', '#fff4b2', '#ffe16a', '#ffffff', '#b8700a'],
  ['#86b8ff', '#5847f0', '#a6d2ff', '#7290ff', '#d8f1ff', '#aad8ff', '#ffffff', '#3a2fb0'],
  ['#d7dee5', '#aab7c4', '#e4e9ee', '#c3ced9', '#f1f4f7', '#dde4ea', '#ffffff', '#8d9aa8'],   // 꺼짐
];
const F_OUT = 'M24 57C14 57 6.5 50.5 6.5 41 6.5 33.5 9.5 28 12 22 13.5 26 15.5 28.5 18 29.5 16.5 20 20.5 12 27 3 27.5 9.5 30 13.5 33.5 17 34.5 14.5 35.5 13 39 11 37.5 15.5 37.5 19 39 22.5 41 26.5 42 31 42 36 42 48.5 34 57 24 57Z';
const F_MID = 'M24 55.5C16.5 55.5 11 50.5 11 43.5 11 38.5 13.5 35 16 32.5 16.5 35.5 18 37 20 37.5 19 30 22 24 27 17.5 27.5 23 30 26 32.5 28.5 33.2 27 34 26 35.5 25.5 34.8 29 35.5 31 36.5 33.5 37.2 35.5 37.5 38 37.5 41 37.5 49.5 31.5 55.5 24 55.5Z';
const F_IN = 'M24 54.5C19 54.5 15.5 51 15.5 46.5 15.5 42 18.5 39 21 36.5 21 39 22 40.5 23.5 41 23.5 36.5 25 33 28 29.5 28.5 33.5 31 36 32.3 39.5 32.8 41 33 42.5 33 44 33 50 29 54.5 24 54.5Z';
const F_CORE = 'M24.5 53.6C21.5 53.6 19.8 51.4 19.8 48.6 19.8 45.6 22.2 43.6 24 41.5 24.8 44 27.2 45.5 28.3 47.5 29 50.8 27.4 53.6 24.5 53.6Z';
const F_BIT1 = 'M36 1.5C37.6 4.2 38.6 5.8 38.6 7.4 38.6 9 37.4 10.1 36 10.1S33.4 9 33.4 7.4C33.4 5.8 34.4 4.2 36 1.5Z';
const F_BIT2 = 'M9.6 10.6C10.7 12.4 11.4 13.4 11.4 14.5 11.4 15.6 10.6 16.4 9.6 16.4S7.8 15.6 7.8 14.5C7.8 13.4 8.5 12.4 9.6 10.6Z';
// 아주 작은 크기(헤더·달력·순위·칩)용 단순한 불꽃: 갈고리 끝 2개만 (작으면 끝이 많을수록 손 모양처럼 보임)
const S_OUT = 'M24 57C14 57 7 50.5 7 41.5 7 32.5 12.5 27 16.5 20.5 17.5 25 19.5 27.5 22.5 28.5 21.5 19 25 10 31 2.5 31.2 11 34.6 16.4 37.8 21.8 40.2 25.8 41.5 30.4 41.5 35.8 41.5 48.2 34 57 24 57Z';
const S_MID = 'M24 55.4C16.8 55.4 11.6 50.6 11.6 43.8 11.6 38.4 14.4 34.6 17.4 31.4 18.2 34.8 20 36.6 22.4 37.2 22 30.8 24.4 25 28.6 20.4 29.2 26.2 32 29.6 34.2 33.4 35.8 36 36.6 38.6 36.6 41.6 36.6 49.8 31 55.4 24 55.4Z';
const S_IN = 'M24 54.4C19.2 54.4 16 51 16 46.6 16 42.4 18.8 39.6 21.4 37.4 21.8 39.6 23 40.8 24.6 41 24.6 37 26.2 33.8 28.8 30.8 29.4 34.4 31.6 37 32.6 40.2 33 41.6 33.2 43 33.2 44.4 33.2 50.2 29.2 54.4 24 54.4Z';
const INKC = '#173048';
let fid = 0;
export function flame(cls = '', o = {}) {
  const i = ++fid, c = FIRE[o.off ? 4 : (o.tier || 0)], small = /\b(fsm|hst-f|cf)\b/.test(cls);
  const OUT = small ? S_OUT : F_OUT, MID = small ? S_MID : F_MID, IN = small ? S_IN : F_IN;
  const lg = (id, a, b) => `<linearGradient id="${id}${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const bit = (d, k) => `<g class="bit ${k}"><path d="${d}" transform="translate(.8 1.4)" fill="${c[7]}" stroke="${INKC}" stroke-width="1.8" stroke-linejoin="round"/><path d="${d}" fill="url(#fb${i})" stroke="${INKC}" stroke-width="1.8" stroke-linejoin="round"/></g>`;
  return `<svg class="flm ${cls}${o.off ? ' off' : ''}" viewBox="-1 -1 50 62" aria-hidden="true">
    <defs>${lg('fa', c[0], c[1])}${lg('fb', c[2], c[3])}${lg('fc', c[4], c[5])}</defs>
    <g class="sps"><path class="sp s1" d="${F_BIT1}" fill="${c[2]}" stroke="${INKC}" stroke-width="1.6" transform="translate(-9 14) scale(.8)"/><path class="sp s2" d="${F_BIT2}" fill="${c[0]}" stroke="${INKC}" stroke-width="1.6" transform="translate(6 6)"/><path class="sp s3" d="${F_BIT1}" fill="${c[4]}" stroke="${INKC}" stroke-width="1.6" transform="translate(-14 2) scale(.7)"/></g>
    <g class="fw">
      <path class="fx" d="${OUT}" transform="translate(1.2 2.2)" fill="${c[7]}" stroke="${INKC}" stroke-width="2.2" stroke-linejoin="round"/>
      <g class="fl"><path class="l1" d="${OUT}" fill="url(#fa${i})"/><path class="l2" d="${MID}" fill="url(#fb${i})"/><path class="l3" d="${IN}" fill="url(#fc${i})"/><path class="l4" d="${F_CORE}" fill="${c[6]}"/>
        <path d="M22.2 21.5C21 26 21.2 29.4 22.6 32.4M33.6 22.8C34.6 25.6 34.8 28 34.4 30.4" fill="none" stroke="${c[1]}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/></g>
      <path class="ol" d="${OUT}" fill="none" stroke="${INKC}" stroke-width="2.4" stroke-linejoin="round"/>
      <path class="fh" d="M10.4 44.5C9.6 39.6 10.8 35.4 13 32.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>
    </g>
    ${small ? '' : bit(F_BIT1, 'b1') + bit(F_BIT2, 'b2')}
  </svg>`;
}
const shieldSvg = (cls = '') => `<svg class="shd ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 4.5 5.3v6.2c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10V5.3L12 2.5z"/><path class="tk" d="m8.6 12 2.4 2.4 4.6-4.8"/></svg>`;
// 큰 불꽃 + 숫자 (+ 완벽한 연속이면 후광)
const bigFire = (n, o = {}) => `<div class="att-fire ${o.sm ? 'sm' : ''} t${tierOf(n)}${o.pf ? ' pf' : ''}">${o.pf ? '<i class="halo" aria-hidden="true"></i>' : ''}${flame('big' + (o.burn ? ' burn' : ''), { tier: tierOf(n), off: !n })}<b class="att-num${n >= 100 && n < 1e6 ? ' d3' : ''}"${o.id ? ` id="${o.id}"` : ''}>${fmtN(o.from ?? n)}</b></div>`;
// 보상 그림 (스티커·사진은 이모지, 배경 색은 동그란 견본, 칭호는 이름표)
export const rwIcon = r => r.kind === 'color' ? `<i class="rw-sw c-${r.v}" aria-hidden="true"></i>` : r.kind === 'title' ? ui('tag', 'rw-tag')
  : r.kind === 'perk' ? (r.v === 'shield3' ? shieldSvg('on rw-tag') : ui('sparkle', 'rw-tag')) : artOf(r.v, 'rw-e');
const named = () => true;   // 이름을 글로 같이 보여 줌 (스티커·프로필 사진은 물건 이름)

/* ----- 헤더 🔥 버튼 ----- */
let chipTier = -1, chipBurned = false;
function paintChip() {
  const b = $('#btnStreak'); if (!b) return;
  b.hidden = !st;
  if (!st) return;
  const lit = !!st.all || ((!!st.done || !!st.rest) && st.cur > 0), t = tierOf(st.cur);   // 쉬는 날엔 출석 안 해도 불꽃 그대로
  if (t !== chipTier || b.dataset.lit !== String(lit)) {   // 불꽃 그림은 단계·켜짐이 바뀔 때만 다시 그림
    const old = b.querySelector('svg'); old?.insertAdjacentHTML('afterend', flame('hst-f', { tier: t, off: !lit })); old?.remove();
    chipTier = t; b.dataset.lit = String(lit);
  }
  // 접속했을 때 한 번만: 활활 타오르고 가만히 (축하 창이 뜨는 날은 창에서 타오르니 헤더는 그 뒤에)
  if (lit && !chipBurned && !document.hidden) { chipBurned = true; burn(b.querySelector('.flm'), st.new ? 900 : 300); }
  b.classList.toggle('lit', lit);
  b.classList.remove('t0', 't1', 't2', 't3'); b.classList.add('t' + t);
  b.classList.toggle('pf', !!st.pf && st.cur >= 3);
  $('#stN').textContent = fmtN(st.cur);
  const lbl = st.all ? '무한 연속 출석 중' : st.done ? `${st.cur}일 연속 출석 중` : st.rest ? `${st.cur}일 연속 · 오늘은 쉬는 날` : '오늘 아직 출석 안 함';
  b.setAttribute('aria-label', lbl + ' — 출석 체크 열기'); b.dataset.tip = lbl;
}
// 불꽃 한 번 타오르기 (애니메이션이 끝나면 클래스를 떼서 가만히)
export function burn(el, delay = 0) {
  if (!el || reduce()) return;
  setTimeout(() => { el.classList.remove('burn'); void el.getBoundingClientRect(); el.classList.add('burn'); setTimeout(() => el.classList.remove('burn'), 2200); }, delay);
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
      setTimeout(prefetch, r.new ? 2500 : 600);   // 출석 창을 바로 열 수 있게 미리 받아 둠
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
  const n = r.all ? null : nextOf(r);
  if (!n) return `<p class="att-next done">${ui('party', 'ic')} 모든 출석 보상을 모았어요!</p>`;
  const lastD = Math.max(0, ...REWARDS.filter(x => x.by === n.by && x.d < n.d).map(x => x.d));
  const base = n.by === 'best' && r.cur < lastD ? 0 : lastD;
  const pct = Math.max(4, Math.min(100, Math.round((n.from - base) / (n.d - base) * 100)));
  return `<div class="att-next"><span class="rw-box">${rwIcon(n)}</span><div class="att-bar"><p><span><b>${n.by === 'total' ? `총 ${n.d}일 출석` : `${n.d}일 연속`}</b> · ${KIND[n.kind]}${named(n.kind) ? ` ${esc(rwName(n))}` : ''}</span><small>${n.left > 0 ? `${n.left}일 남았어요` : '오늘 받아요!'}</small></p><span class="track"><i data-p="${pct}"></i></span></div></div>`;
}

/* ----- 축하 창 (그날 첫 출석) — 평소엔 짧게, 기념일은 크게 ----- */
function celebrate(r) {
  const m = $('#mAtt'); if (!m) return;
  const big = !!r.milestone, first = r.total === 1, pw = perfectWeek(r) && r.week.indexOf(r.today) === 4;   // 금요일에 개근 완성
  const msg = first ? '첫 출석이에요! 등교하는 날마다 들러서 불꽃을 키워 보세요' : r.lost > 1 ? `아쉽게 ${r.lost}일 기록이 끊겼어요. 오늘부터 다시 키워요!` : CHEER[Math.floor(Math.random() * CHEER.length)];
  const notes = [
    pw ? `<p class="att-note pwk">${ui('pw', 'ic')}<span><b>이번 주 개근!</b> 주말 푹 쉬고 월요일에 봐요</span></p>` : '',
    r.used ? `<p class="att-note sh">${shieldSvg('ic')}<span>방패 <b>${r.used}개</b>가 빠진 날을 지켜 줬어요</span></p>` : '',
    r.gotShield ? `<p class="att-note sh got">${shieldSvg('ic')}<span>연속 ${fmtN(r.cur)}일! <b>출석 방패 +1</b> <small>(${r.shield}/${r.shieldMax})</small></span></p>` : '',
    r.tix ? `<p class="att-note gck">${ui('gift', 'ic')}<span>뽑기권 <b>+${r.tix}</b>${r.tixNow != null ? ` <small>(${r.tixNow}장)</small>` : ''}</span><a href="#gacha" data-go="gacha" data-close>뽑으러 가기</a></p>` : '',
    r.pf && [7, 14, 30, 50, 100].includes(r.cur) ? `<p class="att-note pfn">${ui('sparkle', 'ic')}<span><b>완벽한 연속</b> — 방패 없이 여기까지 왔어요</span></p>` : '',
  ].join('');
  const gifts = (r.unlocked || []).map((x, i) => `<div class="att-gift k-${x.kind}" data-i="${i}"><span class="rw-box">${rwIcon(x)}</span><p><b>${x.by === 'total' ? `총 ${x.d}일 출석 보상` : `${x.d}일 연속 보상`}</b><small>${x.kind === 'perk' ? `${esc(rwName(x))}!` : `새 ${KIND[x.kind]}${named(x.kind) ? ` ${esc(rwName(x))}` : ''} 해금!`}${x.kind === 'sticker' ? '<br>대표 스티커·첫 화면 시계·댓글·DM에 쓸 수 있어요' : ''}</small></p></div>`).join('');
  const kick = big ? `<p class="att-kick">${r.unlocked?.length ? ui('gift') + '보상 도착!' : ui('party') + `${fmtN(r.cur)}일 달성!`}</p>` : '';
  $('#attSheet').className = `sheet att-pop${big ? ' ms' : ''}`;
  $('#attSheet').innerHTML = `
    ${big ? '<div class="att-burst" aria-hidden="true"><i class="rays"></i></div>' : ''}
    <div class="att-hero">
      ${kick}
      ${bigFire(r.cur, { burn: true, pf: r.pf && r.cur >= 3, id: 'attNum', from: r.all ? r.cur : Math.max(0, r.cur - 1) })}
      <h3 id="attT"><span>${fmtN(r.cur)}</span>일 연속 출석!</h3>
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
  if (reduce() || r.all) { el.textContent = fmtN(to); return; }
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
// 출석 창은 누르는 즉시 그려야 함(빈 회색 줄이 먼저 보이면 안 됨) → 달별 데이터·순위를 미리 받아 두고(prefetch),
// 열 때는 가진 것으로 바로 그린 뒤 뒤에서 새로 받아 바뀐 게 있을 때만 조용히 고침
const mCache = {}, rCache = {};
function prefetch() {
  const m = kstDay().slice(0, 6);
  api.call('att?m=' + m).then(r => { mCache[m] = r; }).catch(() => {});
  api.call('attrank?scope=friends').then(r => { rCache.friends = r; }).catch(() => {});
}
// 미리 받은 게 없을 때: 오늘 출석 결과(st)로 이번 주 칸만 채워서라도 바로 그림
const fromSt = m => st && { ...st, month: m, days: (st.weekDays || []).filter(x => x.ymd.startsWith(m)) };
const sig = r => JSON.stringify([r.cur, r.best, r.total, r.shield, r.done, r.pf, r.days]);
export async function open(month) {
  const today = kstDay(), viewM = month || today.slice(0, 6), fresh = !month || !$('#attBox');
  const have = mCache[viewM] || (viewM === today.slice(0, 6) ? fromSt(viewM) : null);
  if (fresh) {
    api.sheet(`<div class="att-sheet" id="attBox">${have ? sheetHtml(have) : '<div class="skel"></div><div class="skel"></div><div class="skel"></div>'}</div>`);
    if (have) { bars($('#attBox')); loadRank('friends'); }
  } else if (have && $('#attCal')) $('#attCal').innerHTML = calHtml(have);
  try {
    const r = await api.call('att?m=' + viewM);
    mCache[viewM] = r;
    st = { ...st, ...r, weekDays: st?.weekDays }; paintChip();
    if (!$('#attBox')) return;   // 그 사이 창을 닫음
    if (!fresh) { $('#attCal').innerHTML = calHtml(r); return; }   // 달만 넘길 땐 달력만 다시
    if (have && sig(have) === sig(r)) return;                       // 바뀐 게 없으면 그대로(애니메이션 다시 안 함)
    if (have) {   // 바뀐 부분만: 위쪽 통계·달력·보상 (불꽃은 다시 타오르지 않게)
      const sc = $('#socSheet').scrollTop;
      $('#attBox').innerHTML = sheetHtml(r, true); bars($('#attBox')); $('#socSheet').scrollTop = sc; loadRank($('[data-att-rank].on')?.dataset.attRank || 'friends');
    } else { $('#attBox').innerHTML = sheetHtml(r); bars($('#attBox')); loadRank('friends'); }
  } catch (e) { if (!have && $('#attBox')) $('#attBox').innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
function calHtml(r) {
  const y = +r.month.slice(0, 4), mo = +r.month.slice(4, 6), first = new Date(y, mo - 1, 1), n = new Date(y, mo, 0).getDate();
  const kinds = Object.fromEntries(r.days.map(x => [x.ymd, x.kind]));
  const lead = first.getDay();   // 일요일 시작 (2026-10-23)
  let h = DOW_S.map((d, i) => `<b class="ch${i % 6 === 0 ? ' we' : ''}${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${d}</b>`).join('') + '<i></i>'.repeat(lead);
  for (let d = 1; d <= n; d++) {
    const ymd = `${r.month}${pad(d)}`, k = kinds[ymd], col = (lead + d - 1) % 7, we = col % 6 === 0;
    const jl = k && col > 0 && kinds[`${r.month}${pad(d - 1)}`];   // 같은 줄에서 전날과 이어지면 띠
    h += `<span class="${[k === 1 ? 'on' : k === 2 ? 'sh' : '', jl ? 'jl' : '', ymd === r.today ? 'today' : '', ymd > r.today ? 'fut' : '', we ? 'we' : ''].filter(Boolean).join(' ')}"${k ? ` data-tip="${k === 1 ? '출석' : '방패로 지킴'}"` : ''}>${k === 1 ? flame('cf') : k === 2 ? shieldSvg('cf') : ''}<em>${d}</em></span>`;
  }
  const cnt = r.days.filter(x => x.kind === 1).length;
  const prev = (() => { const t = new Date(y, mo - 2, 1); return `${t.getFullYear()}${pad(t.getMonth() + 1)}`; })();
  const next = (() => { const t = new Date(y, mo, 1); return `${t.getFullYear()}${pad(t.getMonth() + 1)}`; })();
  return `<div class="att-cal-h"><button type="button" class="pg" data-att-m="${prev}" aria-label="이전 달">‹</button><b>${y}년 ${mo}월 <small>· ${cnt}일 출석</small></b><button type="button" class="pg" data-att-m="${next}" aria-label="다음 달" ${next > r.today.slice(0, 6) ? 'disabled' : ''}>›</button></div>
    <div class="att-cal">${h}</div>`;
}
// 보상 칸: 그림 칸(고정 크기) → 날짜 → 설명(2줄 자리 고정) 순서라 칸마다 줄이 똑같이 맞음. 받았으면 오른쪽 위 초록 체크, 아니면 자물쇠
const rwCap = x => x.kind === 'title' ? `‘${x.v}’` : x.kind === 'color' ? `${COLOR_NAME[x.v]} 배경` : x.kind === 'perk' ? (x.v === 'shield3' ? '방패 3개' : '시계 칸 +1') : objName(x.v) || KIND[x.kind];
// 칸 설명은 물건 이름 (과 이름 X — 2026-10-24 하율)
function rewardsHtml(r, by) {
  const own = x => r.all || rwOn(x, r.best, r.total);   // r.all: 개발자 계정 = 전부 해금
  const list = REWARDS.filter(x => x.by === by), have = list.filter(own).length;
  return `<div class="att-rwh"><b>${by === 'best' ? '연속 기록 보상' : '누적 출석 보상'}</b><small>${by === 'best' ? `최고 ${fmtN(r.best)}일` : `총 ${r.all ? '∞' : r.total}일`} · ${have}/${list.length}개 받음</small></div>
    <ul class="att-rw">${list.map(x => {
      const on = own(x);
      return `<li class="k-${x.kind}${on ? ' on' : ''}" data-tip="${esc(KIND[x.kind])}${named(x.kind) ? ' · ' + esc(rwName(x)) : ''}${on ? ' · 받음' : ''}"><span class="rw-ic">${rwIcon(x)}</span><b>${x.d}일</b><small class="rw-cap">${esc(rwCap(x))}</small>${on ? ui('check', 'lk ok') : ui('lock', 'lk')}</li>`;
    }).join('')}</ul>`;
}
function sheetHtml(r, quiet = false) {
  // 개발자 계정: 총 출석·출석 방패도 무한(∞)
  const shields = r.all ? `${shieldSvg('on')}<b class="inf">∞</b>` : Array.from({ length: r.shieldMax }, (_, i) => shieldSvg(i < r.shield ? 'on' : 'off')).join('');
  const state = r.rest && !r.done ? (r.cur ? '오늘은 쉬는 날 — 출석 안 해도 기록 그대로예요' : '쉬는 날엔 출석을 세지 않아요. 등교하는 날 시작해요') : !r.done ? (r.cur ? '오늘은 아직 출석 전이에요' : '오늘부터 다시 불꽃을 키워 봐요') : r.pf && r.cur >= 3 ? `${ui('sparkle', 'ic')}완벽한 연속 — 방패 없이 이어 가는 중` : '내일도 와서 불꽃을 지켜 주세요';
  const md = `${+r.today.slice(4, 6)}.${+r.today.slice(6)}`;
  // 오늘 출석 도장: 완료면 초록 도장(한 번 쾅 찍힘), 아니면 점선 빈 도장
  const stamp = `<div class="att-stamp${r.done ? ' ok' : r.rest ? ' rest' : ''}" role="img" aria-label="${r.done ? '오늘 출석 완료' : r.rest ? '오늘은 쉬는 날' : '오늘 아직 출석 전'}">${r.done ? ui('check', 'sc') : ''}<b>${r.done ? '출석 완료' : r.rest ? '쉬는 날' : '출석 전'}</b><small>${md}</small></div>`;
  return `
    <div class="att-top">
      ${bigFire(r.cur, { sm: true, burn: !quiet, pf: r.pf && r.cur >= 3 })}
      <div class="att-tt">
        <h3>${r.all ? '무한 연속 출석' : r.cur ? `${r.cur}일 연속 출석` : '오늘부터 시작!'}</h3>
        <p class="att-st">${state}</p>
      </div>
      ${stamp}
    </div>
    <div class="att-stats">
      <div><b>${fmtN(r.best)}</b><small>최고 기록</small></div>
      <div><b>${r.all ? '∞' : r.total}</b><small>총 출석</small></div>
      <div class="shs" data-tip="${r.all ? '개발자 계정 · 방패 무한' : `연속 ${r.shieldEvery}일마다 1개 · 최대 ${r.shieldMax}개`}"><span>${shields}</span><small>출석 방패</small></div>
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
      <li>출석은 <b>등교하는 날만</b> 세요. 주말·공휴일에 들어와도 출석으로 치지 않으니, 쉬는 날은 마음 편히 쉬어요.</li>
      <li>연속 ${r.shieldEvery}일마다 <b>출석 방패</b>를 1개 받아요(최대 ${r.shieldMax}개). 빠진 등교일 하루를 방패가 자동으로 메워 줘요.</li>
      <li>방패를 한 번도 안 쓰고 이어 가면 <b>완벽한 연속</b> — 불꽃에 금빛 후광이 생겨요.</li>
      <li>불꽃은 7일·30일·100일에 색이 바뀌어요.</li>
      <li>보상은 최고 연속 기록·총 출석일 기준이라 한 번 받으면 사라지지 않아요.</li>
      <li>받은 <b>스티커</b>는 이름 옆 대표 스티커, 첫 화면 시계 꾸미기, 밸런스 댓글·DM 스티커로 쓸 수 있어요. 고르기는 프로필 꾸미기에서.</li>
      <li>등교하는 날 출석하면 <b>뽑기권</b>도 1장씩 받아요(연속 5일마다·기념일엔 1장 더). 서비스 › 뽑기에서 써요.</li>
      <li><b>혜택</b> 보상: 시계 스티커 칸이 늘어나고(1칸 → 최대 3칸), 연속 30일이면 방패를 3개까지 모을 수 있어요.</li></ul></details>
    <div class="row"><button class="btn ghost" type="button" data-close>닫기</button></div>`;
}
async function loadRank(scope) {
  const list = $('#attRank'); if (!list) return;
  const paint = r => {
    list.innerHTML = r.list.length ? r.list.map((u, i) => `<li class="${u.isMe ? 'me' : ''}"><span class="rk">${medal(i)}</span><a href="#u/${esc(u.handle)}" data-u="1">${api.av(u)}<span class="pi"><b>${esc(api.nameOf(u))}${api.devTag(u)}</b><small>${u.title ? `${ui('tag', 'ic')}${esc(u.title)}` : esc(api.classTxt(u) || api.atOf(u))}</small></span></a><b class="rv att-rv t${tierOf(u.value)}${u.pf && u.value >= 3 ? ' pf' : ''}">${flame('fsm', { tier: tierOf(u.value) })}${fmtN(u.value)}</b></li>`).join('')
      : `<li class="empty">${scope === 'friends' ? '아직 불꽃을 키우는 친구가 없어요. 맞팔 친구에게 같이 하자고 해 보세요!' : '아직 기록이 없어요'}</li>`;
  };
  if (rCache[scope]) paint(rCache[scope]); else list.innerHTML = '<li class="skel"></li>';
  try {
    const r = await api.call('attrank?scope=' + scope);
    if (JSON.stringify(r) !== JSON.stringify(rCache[scope])) { rCache[scope] = r; if ($('#attRank') === list) paint(r); }
  } catch (e) { if (!rCache[scope]) list.innerHTML = `<li class="empty">${esc(e.message)}</li>`; }
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
