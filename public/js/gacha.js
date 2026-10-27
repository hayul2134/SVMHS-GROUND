// SVMHS GROUND — 뽑기 (2026-10-24 하율: "뽑기 같은 기능도 있으면 좋겠어") · 서버: functions/api/s/[[path]].js (gacha · gcpick · gcshine)
// 시즌 1 「쉬는 시간」(2026-10-24 개편): 일반 16 스티커 · 희귀 8 움직이는 스티커(2026-10-25 각 8·4종 추가) · 전설 4 효과 · 시크릿 1 (att-rewards.js GACHA, 그림 att-art.js GA).
// 효과는 '내 효과'에서 켬(서버 gcfx) · 중복 스티커는 맞팔 친구에게 선물(gcgift) · 다 모으면 칭호 + 프로필 홀로 테두리.
// 조각 상점(2026-10-25 하율: 조각 → 뽑기권은 메리트 없음): 없는 것 골라 받기(gcpick, 시크릿 포함) · 가진 스티커 반짝이 강화(gcshine, 값 끝 '_s').
// 뽑기권: 등교일 출석마다 1장(+연속 5일마다·기념일 1장 더, 처음 3장 선물) + 매주 게임 랭킹 1~3등(3·2·1장, 서버 settleRounds).
// 연출(2026-10-25 2차): 화면 전체 무대 gacha-fx.js — 은색 캡슐(등급 숨김) → 금 가며 등급 승급. 끝나면 결과를 아래 #gcStage에 열린 채로 남김.
// 확률·천장은 화면에 그대로 공개(아래 '확률·규칙'). 동작 줄이기 설정이면 연출 없이 바로 결과.
import { $, esc, toast, store } from './util.js';
import { GACHA, HIDDEN, RAR, GC, FX, GC_TITLE, RK, SHN, MILESTONES, objName, neonPick } from './att-rewards.js';
import { artOf, ensureSprite, stillHref } from './att-art.js';
import { play } from './gacha-fx.js';
import * as NW from './gcnew.js';   // 새로 얻은 것 빨간 표시 + 어디서 착용하는지 안내(2026-10-25)
import { SPOTS, spotPref, setSpotPref, resolveSpot, wearSvg, anchorOf, setAdj } from './wear.js';

let api;   // social.js에서 받음: call · refreshMe · me() · setGc(g)
let busy = false, view = 'all';
const gcItem = v => GACHA.find(g => g.v === v);
const flash = r => { if (reduce()) return; const f = document.createElement('i'); f.className = 'gc-flash r' + r; f.setAttribute('aria-hidden', 'true'); document.body.append(f); setTimeout(() => f.remove(), 950); };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 애니메이션 스킵(2026-10-25 하율): 뽑기 전에 체크하면 무대 없이 바로 결과 — 이 기기 sg_gc_skip
const skipPref = () => { try { return localStorage.getItem('sg_gc_skip') === '1'; } catch { return false; } };
const setSkipPref = v => { try { localStorage.setItem('sg_gc_skip', v ? '1' : '0'); } catch {} };
const wait = ms => new Promise(r => setTimeout(r, ms));
const RCLS = { 1: 'r1', 2: 'r2', 3: 'r3', 4: 'r4' };
let gift = null;   // 선물 고르는 중인 스티커 { v, list: 맞팔 친구 }
const fmt = n => n >= 1e6 ? '∞' : n;

/* ----- 뽑기 기계 (직접 그림: 로고와 같은 젤리 — 남색 선 · 두께 · 광택) ----- */
const CAPS = [[52, 88, 'r1'], [78, 96, 'r2'], [104, 86, 'r1'], [64, 64, 'r1'], [94, 60, 'r3'], [42, 66, 'r2'], [116, 66, 'r1'], [80, 38, 'r1'], [58, 40, 'r2'], [102, 38, 'r1']];
const capSvg = (x, y, c, r = 12) => `<g class="cp ${c}" transform="translate(${x} ${y})"><circle r="${r}" fill="#fff" stroke="#173048" stroke-width="2.6"/><path d="M-${r} 0A${r} ${r} 0 0 1 ${r} 0Z" class="ct" stroke="#173048" stroke-width="2.6" stroke-linejoin="round"/><path d="M-${r - 4} -${r * .38}Q-${r * .5} -${r - 3} 0 -${r - 3.6}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/></g>`;
const machine = (k = '') => `<svg class="gc-mc" viewBox="0 0 160 206" aria-hidden="true">
  <defs><clipPath id="gcDome${k}"><circle cx="80" cy="68" r="55"/></clipPath>
    <linearGradient id="gcGlass${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf7ff" stop-opacity=".95"/><stop offset="1" stop-color="#b8e2ff" stop-opacity=".75"/></linearGradient></defs>
  <circle cx="83" cy="73" r="58" fill="#173048"/>
  <circle cx="80" cy="68" r="58" fill="url(#gcGlass${k})" stroke="#173048" stroke-width="4"/>
  <g clip-path="url(#gcDome${k})"><g class="gc-in">${CAPS.map(([x, y, c]) => capSvg(x, y, c)).join('')}</g></g>
  <path d="M42 28Q58 14 80 13" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/><path d="M30 48Q32 40 36 35" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <path d="M33 118H131V128H33Z" transform="translate(3 5)" fill="#173048"/><path d="M33 118H131V128H33Z" fill="url(#gY)" stroke="#173048" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="M30 128H134Q140 128 140 134V194Q140 200 134 200H30Q24 200 24 194V134Q24 128 30 128Z" transform="translate(3 5)" fill="#173048"/>
  <path d="M30 128H134Q140 128 140 134V194Q140 200 134 200H30Q24 200 24 194V134Q24 128 30 128Z" fill="url(#gB)" stroke="#173048" stroke-width="3.6" stroke-linejoin="round"/>
  <path d="M30 136V188" stroke="#fff" stroke-width="3.6" stroke-linecap="round" opacity=".55"/>
  <rect x="58" y="134" width="48" height="13" rx="6.5" fill="#fff" stroke="#173048" stroke-width="2.6"/><text x="82" y="144.6" text-anchor="middle" font-family="Jua,sans-serif" font-size="11" fill="#173048">뽑기</text>
  <g transform="translate(56 171)"><g class="gc-knob"><circle r="17" fill="#173048" transform="translate(2 3)"/><circle r="17" fill="url(#gY)" stroke="#173048" stroke-width="3.2"/><rect x="-14" y="-4" width="28" height="8" rx="4" fill="#fff" stroke="#173048" stroke-width="2.6"/><path d="M-9 -9Q-5 -13 1 -13" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g></g>
  <rect x="90" y="156" width="36" height="32" rx="7" fill="#15263d" stroke="#173048" stroke-width="3"/><path d="M93 160H123V168Q108 172 93 168Z" fill="#3a5478"/>
  <g transform="translate(108 178)"><g class="gc-out">${capSvg(0, 0, 'r1', 9)}</g></g>
</svg>`;
// 결과 캡슐 (열리기 전): 위 반쪽 색이 등급

/* ----- 화면 ----- */
export function init(a) {
  api = a;
  document.addEventListener('click', onClick);
  document.addEventListener('change', e => { const c = e.target.closest?.('[data-gc-skip]'); if (c) { setSkipPref(c.checked); toast(c.checked ? '이제 애니메이션 없이 바로 결과가 나와요' : '뽑기 애니메이션을 다시 보여 줘요'); } });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-gc-wear][role=button]')) { e.preventDefault(); e.target.click(); } });
  // 꾸미기에서 붙이거나 켜서 '새로 얻음'이 줄면 뽑기 화면의 안내 띠·빨간 표시도 같이
  document.addEventListener('sg:gcnew', () => { const nb = $('#gcNewb'); if (nb) nb.outerHTML = newBanner(); const box = $('#gcBox'); if (box) NW.paint(box); });
}
export async function render() {
  const box = $('#gcBox'); if (!box) return;
  const me = api.me();
  if (!me) { box.innerHTML = `<div class="gc-empty card"><p>로그인하면 뽑기를 할 수 있어요.</p></div>`; return; }
  ensureSprite();
  if (!me.gc) await api.refreshMe();
  paint();
}
function paint() {
  const box = $('#gcBox'), g = api.me()?.gc; if (!box || !g) return;
  const keep = $('#gcStage')?.innerHTML;
  box.innerHTML = `
    <section class="gc-top card">
      <div class="gc-mcw">${machine()}</div>
      <div class="gc-side">
        <div class="gc-tix"><span class="gc-tk" aria-hidden="true">${tkSvg()}</span><b id="gcTix">${fmt(g.tix)}</b><small>뽑기권</small></div>
        <div class="gc-btns">
          <button class="btn gc-go" type="button" data-gc="1" ${g.tix < 1 || busy ? 'disabled' : ''}>1번 뽑기<small>뽑기권 1장</small></button>
          <button class="btn lime gc-go" type="button" data-gc="5" ${g.tix < 5 || busy ? 'disabled' : ''}>5번 뽑기<small>희귀 이상 1개 확정</small></button>
        </div>
        <label class="gc-skipck"><input type="checkbox" data-gc-skip ${skipPref() ? 'checked' : ''}><i aria-hidden="true"></i>뽑기 애니메이션 스킵 <small>바로 결과 보기</small></label>
        <p class="gc-pity">${g.pity < 0 ? '희귀 확정 <b>사용함</b>' : `희귀 확정까지 <b>${GC.pityRare - g.pity}</b>번`} · ${g.leg < 0 ? '전설 확정 <b>사용함</b>' : `전설 확정까지 <b>${GC.pityLeg - g.leg}</b>번`}</p>
        <div class="gc-shard"><span><i class="gc-sh" aria-hidden="true"></i>조각 <b>${g.shard}</b></span><button type="button" class="btn ghost" data-gc-shop>조각 상점</button></div>
        <p class="gc-how">${g.tix < 1 ? '<b>뽑기권이 없어요.</b> ' : ''}등교하는 날 출석하면 1장 · 연속 5일마다 1장 더 · 매주 모두에게 ${RK.week}장 · <a href="#game" data-go="game">라운드 티어</a> 챌린저 ${RK.tierTix.challenger}·그마 ${RK.tierTix.grandmaster}·마스터 ${RK.tierTix.master}장!</p>
      </div>
    </section>
    <section class="gc-stage" id="gcStage" aria-live="polite">${keep || ''}</section>
    ${newBanner()}
    ${whereBox()}
    ${fxBox(g)}
    ${shop(g)}
    <section class="gc-col card">
      <div class="gc-colh"><h3>시즌 1 「쉬는 시간」 도감 <small>${GACHA.filter(x => g.own[x.v]).length}/${GACHA.length}</small></h3>
        <div class="segs"><button type="button" data-gc-view="all" class="${view === 'all' ? 'on' : ''}">모두 보기</button><button type="button" data-gc-view="have" class="${view === 'have' ? 'on' : ''}">가진 것만</button></div></div>
      ${prog(g)}
      ${gift ? giftBox() : ''}
      ${[4, 3, 2, 1].map(r => { const list = GACHA.filter(x => x.rar === r && (view === 'all' || g.own[x.v])); return list.length ? `<h4 class="gc-rh ${RCLS[r]}">${RAR[r].n}<small>${RAR[r].p}% · ${TIER[r]}</small></h4><ul class="gc-grid">${list.map(x => cell(x, g.own[x.v] || 0)).join('')}</ul>` : ''; }).join('') || '<p class="gc-none">아직 뽑은 게 없어요. 첫 뽑기를 해 보세요!</p>'}
      <p class="gc-use">가진 칸을 누르면 <b>꾸미기</b>에서 바로 그 칸이 열려요. 2개 이상 가진 스티커는 <b>맞팔 친구에게 선물</b>할 수 있어요.</p>
    </section>
    <details class="gc-rule card"><summary>확률 · 규칙</summary>
      <table class="gc-rates"><thead><tr><th>등급</th><th>확률</th><th>종류</th><th>한 종류당</th></tr></thead><tbody>
      ${[1, 2, 3, 4].map(r => { const k = GACHA.filter(x => x.rar === r).length; return `<tr class="${RCLS[r]}"><td>${RAR[r].n}</td><td>${RAR[r].p}%</td><td>${k}종</td><td>${+(RAR[r].p / k).toFixed(3)}%</td></tr>`; }).join('')}
      </tbody></table>
      <ul><li>희귀 이상이 ${GC.pityRare - 1}번 연속 안 나오면 <b>${GC.pityRare}번째는 희귀 확정</b>, 전설 이상이 ${GC.pityLeg - 1}번 연속 안 나오면 <b>${GC.pityLeg}번째는 전설 확정</b>이에요. <b>이 확정은 희귀·전설 각각 한 번만</b> 쓸 수 있어요(확정으로 받은 뒤엔 운으로만).</li>
      <li>5번 뽑기는 희귀 이상이 <b>1개 이상 확정</b>이에요.</li>
      <li>이미 가진 게 또 나오면 조각을 받아요(일반 ${GC.shard[1]} · 희귀 ${GC.shard[2]} · 전설 ${GC.shard[3]} · 시크릿 ${GC.shard[4]}개).</li>
      <li>조각 상점: 아직 없는 걸 <b>골라서 받기</b>(일반 ${GC.pick[1]} · 희귀 ${GC.pick[2]}개 — <b>전설·시크릿은 뽑기로만</b>) · 가진 스티커를 <b>반짝이로 바꾸기</b>(일반 ${GC.shine[1]} · 희귀 ${GC.shine[2]}개). 조각을 뽑기권으로 바꿀 수는 없어요.</li>
      <li>시즌 1을 전부 모으면 칭호 <b>‘${GC_TITLE}’</b>과 프로필 사진 <b>홀로그램 테두리</b>를 받아요.</li>
      <li>뽑기권은 등교하는 날 출석하면 1장, 연속 출석 ${GC.bonusEvery}일마다 1장 더, 출석 기념일(연속 ${MILESTONES.slice(0, 4).join('·')}일…)에 1장 더 받아요. 매주 월요일엔 모두에게 ${RK.week}장, 라운드(${RK.days}일)가 끝나면 최종 티어로 챌린저 ${RK.tierTix.challenger}장 · 그랜드마스터 ${RK.tierTix.grandmaster}장 · 마스터 ${RK.tierTix.master}장을 줘요. 최대 ${GC.max}장까지 모여요.</li>
      <li>돈으로 사는 건 없어요. 결과는 서버에서 정해지고, 창을 닫아도 그대로 남아요.</li></ul>
    </details>`;
  tuneInit();
  lazyAnim();
  NW.paint(box);
}
// 착용하러 가기: 스티커 → 꾸미기 › 스티커(카드 탭), 효과 → 꾸미기 › 효과. 그 칸으로 스크롤·반짝(social.js openEdit)
const wearOpt = v => NW.kindOf(v) === 'fx' ? { tab: 'fx', v } : { tab: 'stk', sub: 'st', v };
const PATH = { stk: ['☰ 메뉴', '꾸미기', '스티커'], fx: ['☰ 메뉴', '꾸미기', '효과'] };
const path = k => `<span class="gw-path">${PATH[k].map(x => `<b>${x}</b>`).join('<i aria-hidden="true">›</i>')}</span>`;
// 새로 얻었는데 아직 안 써 본 것 — 빨간 띠(꾸미기에서 누르면 사라짐)
function newBanner() {
  const L = NW.list(); if (!L.length) return '<div id="gcNewb" hidden></div>';
  const st = L.filter(v => NW.kindOf(v) === 'stk'), fx = L.filter(v => NW.kindOf(v) === 'fx');
  return `<section class="gc-newb card" id="gcNewb"><div class="gn-hd"><b class="gn-t"><i class="gn-dot" aria-hidden="true"></i>새로 얻은 것 ${L.length}개</b><small>아직 안 써 봤어요 — 꾸미기에서 <b class="gn-red">빨간 표시</b>가 붙은 칸을 누르면 착용돼요</small></div>
    <ul class="gn-l">${L.slice(0, 10).map(v => `<li><button type="button" data-gc-wear="${esc(v)}" data-tip="${esc(objName(v))} · ${NW.kindOf(v) === 'fx' ? '효과에서 켜기' : '스티커에서 붙이기'}" aria-label="${esc(objName(v))} 착용하러 가기">${artOf(v, 'still')}</button></li>`).join('')}${L.length > 10 ? `<li class="gn-more">+${L.length - 10}</li>` : ''}</ul>
    <div class="gn-act">${st.length ? `<button type="button" class="btn gn-go" data-gc-wear="${esc(st[0])}">스티커 ${st.length}개 붙이러 가기 ${path('stk')}</button>` : ''}${fx.length ? `<button type="button" class="btn gn-go" data-gc-wear="${esc(fx[0])}">효과 ${fx.length}개 켜러 가기 ${path('fx')}</button>` : ''}<button type="button" class="btn ghost gn-x" data-gc-nwclr>표시만 지우기</button></div></section>`;
}
// 뽑은 건 어디서 쓰나요? — 등급별 착용 위치를 한눈에(2026-10-25 하율: "어디로 가면 착용할 수 있는지 명확하게")
function whereBox() {
  return `<section class="gc-where card"><h3>뽑은 건 어디서 착용해요?</h3><ul>
    <li><span class="gw-k k1">일반·희귀 스티커</span>${path('stk')}<small><b>카드</b> = 프로필 카드 · <b>대표</b> = 이름 옆 · <b>시계</b> = 첫 화면 시계 — 탭에서 고르고 <b>저장</b></small><button type="button" class="btn ghost" data-gc-wtab="stk">바로 가기</button></li>
    <li><span class="gw-k k2">반짝이 스티커</span>${path('stk')}<small>조각 상점에서 바꾼 금빛 스티커 — 원래 스티커 바로 뒤 칸</small><button type="button" class="btn ghost" data-gc-wtab="stk">바로 가기</button></li>
    <li><span class="gw-k k3">전설·시크릿 효과</span>${path('fx')}<small>누르면 저장 없이 <b>바로 켜져요</b> · 아래 ‘내 효과’에서도 켤 수 있어요</small><button type="button" class="btn ghost" data-gc-wtab="fx">바로 가기</button></li>
    <li><span class="gw-k k4">댓글·DM 스티커</span><span class="gw-path"><b>밸런스 댓글 · DM</b><i aria-hidden="true">›</i><b>스티커 버튼</b></span><small>따로 착용할 필요 없이 가진 스티커를 바로 보낼 수 있어요</small></li>
  </ul><p class="gw-new"><i class="nw-b st" aria-hidden="true">N</i> 새로 얻은 건 <b>빨간 표시</b>가 따라가요: ☰ 메뉴 → 꾸미기 → 탭 → 그 칸</p></section>`;
}
// 렉 방지(2026-10-25 실측: 도감·상점이 한꺼번에 움직이면 120→19fps): 화면에 보이는 스티커만 움직이고, 나머지는 멈춘 그림(stillHref)으로 바꿔 둠
let io = null;
function lazyAnim() {
  io?.disconnect();
  if (!('IntersectionObserver' in window)) return;
  io = new IntersectionObserver(es => es.forEach(e => e.target.querySelectorAll('use').forEach(u => {
    const base = u.dataset.h || (u.dataset.h = u.getAttribute('href')), want = e.isIntersecting ? base : stillHref(base);
    if (u.getAttribute('href') !== want) u.setAttribute('href', want);
  })), { rootMargin: '80px 0px' });
  document.querySelectorAll('#gcBox svg.art:not(.still)').forEach(s => io.observe(s));
}
const TIER = { 1: '스티커', 2: '움직이는 스티커', 3: '효과', 4: '도감엔 ?로만 보여요' };
const isSecHidden = (x, n) => x.rar === 4 && !n;
function cell(x, n) {
  if (isSecHidden(x, n)) return `<li class="r4 lock sec" data-tip="시크릿 — 뽑기에서만 ${RAR[4].p}%"><span class="gc-ic" aria-hidden="true">?</span><small>???</small></li>`;
  const tip = `${objName(x.v)}${x.d ? ' — ' + x.d : ''}${n ? ` · ${n}번 나옴` : ' · 아직 못 뽑음'}`;
  const canGift = !x.fx && n >= 2;
  const sh = api.me()?.gc?.own?.[x.v + SHN] > 0;   // 반짝이로 바꾼 스티커는 도감에도 반짝이로
  // 이름표는 카드형(이름 / 설명 / 등급·횟수) — 한 줄로 길게 붙이면 안 읽힘(2026-10-25 하율). data-tip은 낭독·대체용 한 줄
  const meta = [RAR[x.rar].n, n ? `${n}번 나옴` : '아직 못 뽑음', sh ? '반짝이' : ''].filter(Boolean).join(' · ');
  const use = n ? (x.fx ? '누르면 꾸미기 › 효과로 가요' : '누르면 꾸미기 › 스티커로 가요') : '';   // 쓰는 법은 맨 아래 따로 한 줄(등급 줄에 붙이면 두 줄로 꺾여 지저분함)
  return `<li class="${RCLS[x.rar]}${n ? ' on' : ' lock'}" data-tip="${esc(tip + (sh ? ' · 반짝이' : ''))}" data-tip-t="${esc(objName(x.v))}" data-tip-d="${esc(x.d || '')}" data-tip-m="${esc(meta)}" data-tip-u="${esc(use)}" data-tip-r="${x.rar}"${n ? ` data-nw="${x.v}" data-nw-view data-nw-t="NEW"` : ''}><span class="gc-ic"${n ? ` role="button" tabindex="0" data-gc-wear="${x.v}" aria-label="${esc(objName(x.v))} 착용하러 가기"` : ''}>${artOf(sh ? x.v + SHN : x.v)}</span><small>${esc(objName(x.v))}</small>${n > 1 ? `<em>×${n}</em>` : ''}${canGift ? `<button type="button" class="gc-gift" data-gc-gift="${x.v}" aria-label="${esc(objName(x.v))} 친구에게 선물">선물</button>` : ''}</li>`;
}
// 시리즈 진행: 빈칸을 먼저 보여 주고, 다 모으면 무엇을 받는지 같이 보여 줌(세트 수집 설계)
function prog(g) {
  const have = GACHA.filter(x => g.own[x.v]).length, all = GACHA.length;
  return `<div class="gc-prog"><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${all}" aria-valuenow="${have}"><i class="w${Math.round(have / all * 20) * 5}"></i></div>
    <p>${have >= all ? `<b>시즌 1 완성!</b> 칭호 ‘${esc(GC_TITLE)}’ · 프로필 사진 홀로그램 테두리를 받았어요. <a href="#me" data-go="me">칭호 달기 →</a>` : `<b>${all - have}칸</b> 남았어요 — 다 모으면 칭호 ‘${esc(GC_TITLE)}’ + 프로필 사진 홀로그램 테두리`}</p></div>`;
}
// 조각 상점: ① 골라서 받기(아직 없는 일반·희귀만 — 전설·시크릿은 뽑기로만, 2026-10-25 하율) ② 반짝이로 바꾸기(가진 일반·희귀 스티커)
// 조각을 많이 쓰는 버튼이라 한 번 누르면 '조각 N개 쓰기?'로 바뀌고 3초 안에 한 번 더 눌러야 실행(arm)
// 상점 그림(2026-10-25 하율: "희귀들 다 애니메이션"): 희귀 이상은 움직이는 그림 — lazyAnim이 화면에 보이는 칸만 움직여 렉 방지. 일반은 원래 안 움직이는 스티커라 멈춘 그림
const shopArt = (v, rar) => artOf(v, rar >= 2 ? undefined : 'still');
// 등급별로 나눠 보여 줌(희귀 → 일반, 도감과 같은 등급 제목)
const byRar = (list, cell) => [4, 3, 2, 1].map(r => { const L = list.filter(x => x.rar === r); return L.length ? `<p class="gc-rh ${RCLS[r]}">${RAR[r].n}<small>${L.length}종 · ${TIER[r]}</small></p><ul class="gc-grid gc-buyl">${L.map(cell).join('')}</ul>` : ''; }).join('');
function shop(g) {
  const miss = GACHA.filter(x => !g.own[x.v] && GC.pick[x.rar]).sort((a, b) => b.rar - a.rar);
  const shn = GACHA.filter(x => GC.shine[x.rar]).sort((a, b) => b.rar - a.rar), shOwn = shn.filter(x => g.own[x.v + SHN]).length;
  const btn = (k, v, cost) => `<button type="button" class="btn gc-buy" data-gc-${k}="${v}" data-cost="${cost}" ${g.shard < cost ? 'disabled' : ''}><i class="gc-sh" aria-hidden="true"></i>${cost}</button>`;
  const pick = byRar(miss, x => `<li class="${RCLS[x.rar]}${x.rar === 4 ? ' sec' : ''}"><span class="gc-ic">${x.rar === 4 ? '<span aria-hidden="true">?</span>' : shopArt(x.v, x.rar)}</span><small>${x.rar === 4 ? '시크릿' : esc(objName(x.v))}</small>${btn('pick', x.v, GC.pick[x.rar])}</li>`);
  const up = byRar(shn, x => { const has = g.own[x.v], done = g.own[x.v + SHN];
    return `<li class="${RCLS[x.rar]}${done ? ' on' : has ? '' : ' lock'}"><span class="gc-ic">${shopArt(has ? x.v + SHN : x.v, x.rar)}</span><small>${esc(objName(x.v))}</small>${done ? '<em class="gc-done">반짝이</em>' : has ? btn('shine', x.v, GC.shine[x.rar]) : '<em class="gc-need">먼저 뽑기</em>'}</li>`; });
  return `<section class="gc-shop card" id="gcShop"><div class="gc-shoph"><h3>조각 상점</h3><span class="gc-shn"><i class="gc-sh" aria-hidden="true"></i>조각 <b>${g.shard}</b></span></div>
    <h4>골라서 받기 <small>뽑기 운이 안 따를 때, 갖고 싶은 걸 바로 · 일반·희귀만(전설·시크릿은 뽑기로만)</small></h4>
    ${pick || `<p class="gc-none">${GACHA.every(x => g.own[x.v]) ? '시즌 1을 다 모았어요!' : '일반·희귀는 다 모았어요! 전설·시크릿은 뽑기로만 나와요.'} 남은 조각은 반짝이로 바꾸는 데 써 보세요.</p>`}
    <h4>반짝이로 바꾸기 <small>${shOwn}/${shn.length} · 금빛으로 빛나고 별이 반짝여요. 프로필·이름 옆·시계·댓글·DM 어디서나 그대로</small></h4>
    ${up}</section>`;
}
// 내 효과(전설·시크릿): 칸마다 가진 효과 중 하나를 켬
function fxBox(g) {
  const fx = g.fx || {};
  return `<section class="gc-fxw card"><h3>내 효과</h3><ul class="gc-fxs">${Object.entries(FX).map(([slot, nm]) => {
    const pool = [...GACHA, ...HIDDEN.filter(h => g.own[h.v])];   // 히든 보상은 가진 사람에게만 보임
    const mine = pool.filter(x => x.fx === slot && g.own[x.v]), on = fx[slot];
    const show = pool.find(x => x.v === on) || mine[0] || GACHA.find(x => x.fx === slot && x.rar === 3);
    const np = slot === 'clock' && on === 'r:fxneon' ? `<div class="gc-neon"><small>네온 색</small>${neonPick(store.get('neon_c', 'pink'))}</div>` : slot === 'masc' && on ? wearBox(on) : '';
    return `<li class="${on ? 'on' : mine.length ? '' : 'none'}"><span class="gc-ic">${mine.length ? artOf(show.v) : ''}</span><b>${nm}</b><small>${mine.length ? esc(objName(show.v)) + (on ? ' · 켜짐' : ' · 꺼짐') : '전설에서 나와요 — ' + esc(show.d)}</small>
      ${mine.length ? `<div class="gc-fxb">${mine.map(x => `<button type="button" class="btn ghost${on === x.v ? ' on' : ''}" data-gc-fx="${slot}" data-v="${on === x.v ? '' : x.v}" data-nw="${x.v}">${on === x.v ? esc(objName(x.v)) + ' 끄기' : esc(objName(x.v)) + ' 켜기'}</button>`).join('')}</div>` : ''}${np}</li>`;
  }).join('')}</ul></section>`;
}
// 착용 소품(왕관): 어디에 씌울지 + '그림 넣기' 캐릭터면 머리 위치 맞추기(끌어서) — wear.js
const myArt = () => { try { return localStorage.getItem('sg_myart'); } catch { return null; } };
const SPOT_N = Object.fromEntries(SPOTS);
function wearBox(v) {
  const pref = spotPref(), art = myArt(), hasChar = !!document.getElementById('mascot'), at = resolveSpot(pref, hasChar);
  const why = pref === 'mascot' && !hasChar ? '캐릭터 테마가 아니라서 지금은 <b>큰 시계</b> 위에 씌웠어요'
    : pref === 'auto' ? `지금은 <b>${SPOT_N[at]}</b> 위에 있어요 (캐릭터가 없으면 큰 시계로)` : `<b>${SPOT_N[at]}</b> 위에 있어요`;
  return `<div class="gc-wear"><small>씌울 곳</small><div class="wear-pick" role="radiogroup" aria-label="왕관 씌울 곳">${SPOTS.map(([k, n]) => `<button type="button" role="radio" aria-checked="${pref === k}" class="${pref === k ? 'on' : ''}" data-wear-at="${k}">${n}</button>`).join('')}</div>
    <p class="wear-why">${why} · 프로필 사진 위엔 항상 보여요</p>
    ${art && at === 'mascot' ? `<div class="wear-tune"><div class="wt-box" data-wt aria-label="왕관을 끌어서 내 그림 머리에 맞추기"><img src="${esc(art)}" alt=""><i class="wt-cr">${wearSvg(v)}</i></div><p><small>내 그림이라 머리 위치를 자동으로 잡았어요. 어긋나면 왕관을 <b>끌어서</b> 맞춰 주세요.</small><button type="button" class="btn ghost" data-wt-auto>자동 위치로</button></p></div>` : ''}</div>`;
}
async function tuneInit() {
  const box = document.querySelector('[data-wt]'), art = myArt(); if (!box || !art) return;
  const cr = box.querySelector('.wt-cr'), put = p => { cr.style.setProperty('--wx', p.x * 100 + '%'); cr.style.setProperty('--wy', p.y * 100 + '%'); };
  put(await anchorOf(art));
  let drag = null;
  const at = e => { const r = box.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  box.onpointerdown = e => { drag = at(e); box.setPointerCapture(e.pointerId); box.classList.add('drag'); put(drag); e.preventDefault(); };
  box.onpointermove = e => { if (!drag) return; drag = at(e); put(drag); };
  box.onpointerup = box.onpointercancel = () => { if (!drag) return; box.classList.remove('drag'); setAdj(art, drag); drag = null; toast('왕관 위치를 맞췄어요'); };
}
function giftBox() {
  const fr = gift.list;
  return `<div class="gc-giftf card"><span class="gc-ic">${artOf(gift.v)}</span><p><b>${esc(objName(gift.v))}</b> 스티커를 누구에게 선물할까요? <small>(서로 팔로우한 친구 · DM으로 가요)</small></p>
    ${fr == null ? '<p>친구 목록을 불러오는 중…</p>' : fr.length ? `<ul>${fr.map(u => `<li><button type="button" data-gc-to="${esc(u.handle)}">${esc(u.name)} <small>@${esc(u.handle)}</small></button></li>`).join('')}</ul>` : '<p>아직 서로 팔로우한 친구가 없어요.</p>'}
    <button type="button" class="btn ghost" data-gc-gift-x>취소</button></div>`;
}
const tkSvg = () => `<svg viewBox="0 0 40 28"><path d="M5 3H35Q37 3 37 5V10A4 4 0 0 0 37 18V23Q37 25 35 25H5Q3 25 3 23V18A4 4 0 0 0 3 10V5Q3 3 5 3Z" transform="translate(1.4 2)" fill="#173048"/><path d="M5 3H35Q37 3 37 5V10A4 4 0 0 0 37 18V23Q37 25 35 25H5Q3 25 3 23V18A4 4 0 0 0 3 10V5Q3 3 5 3Z" fill="url(#gY)" stroke="#173048" stroke-width="2.2" stroke-linejoin="round"/><path d="M26 5V23" stroke="#173048" stroke-width="1.6" stroke-dasharray="2 2.2"/><path d="M14.5 8.6 16 12.2 19.8 12.4 16.8 14.8 17.8 18.6 14.5 16.4 11.2 18.6 12.2 14.8 9.2 12.4 13 12.2Z" fill="#fff" stroke="#173048" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

/* ----- 뽑기 ----- */
let last = null;   // 지금 열고 있는 결과
async function draw(n) {
  if (busy) return;
  busy = true; paintBtns();
  // 2026-10-25 2차: 화면 전체 무대 연출(gacha-fx.js) — 동작 줄이기 설정이면 바로 결과
  const req = api.call('gacha', { n }).then(r => { api.setGc(r); return r; });
  let r, res = { again: null };
  try {
    if (reduce() || skipPref()) r = await req;
    else { res = await play({ req, n, machine: machine('X'), tix: () => api.me()?.gc?.tix ?? 0 }); r = await req; }
  } catch (e) { busy = false; paintBtns(); toast(e.message || '뽑기를 못 했어요'); return; }
  last = { out: r.out, open: new Set() };
  busy = false;
  paint();
  // 페이지엔 방금 결과를 열린 채로 남김(무대를 닫은 뒤 다시 볼 수 있게)
  const stage = $('#gcStage'); if (stage) {
    const top = Math.max(...r.out.map(x => x.rar));
    stage.className = `gc-stage show top${top}`;
    stage.innerHTML = `<div class="gc-res">${r.out.map((x, i) => `<div class="gc-slot" data-s="${i}"></div>`).join('')}</div><div class="gc-act"></div>`;
    r.out.forEach((_, i) => openCap(i, true));
    if (skipPref() && top >= 3) flash(top);
    if (skipPref()) stage.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
  }
  if (res.again && (api.me()?.gc?.tix ?? 0) >= res.again) draw(res.again);
}
async function openCap(i, instant = false) {
  if (!last || last.open.has(i)) return;
  last.open.add(i);
  const x = last.out[i], slot = $(`.gc-slot[data-s="${i}"]`); if (!slot) return;
  const cap = slot.querySelector('.gc-cap');
  if (!instant && cap) {
    cap.classList.add('shake' + x.rar);
    await wait(x.rar >= 3 ? 1100 + (x.rar - 3) * 500 : x.rar === 2 ? 700 : 320);
    cap.classList.add('pop');
    await wait(260);
  }
  slot.innerHTML = `<div class="gc-got ${RCLS[x.rar]}${instant ? '' : ' in'}">${x.rar > 1 ? '<i class="gc-rays" aria-hidden="true"></i>' : ''}<span class="gc-ic">${artOf(x.v)}</span>
    <b class="gc-rt">${RAR[x.rar].n}</b><small>${esc(objName(x.v))}</small>${x.new ? '<em class="gc-new">NEW</em>' : `<em class="gc-dup">조각 +${x.shard}</em>`}</div>`;
  if (x.rar >= 3 && !instant) flash(x.rar);
  if (last.open.size === last.out.length) done();
}
function done() {
  busy = false;
  const keep = $('#gcStage')?.innerHTML;
  paint();
  const st = $('#gcStage'); if (st && keep) { st.innerHTML = keep.replace(/ in"/g, '"'); st.className = 'gc-stage show'; }
  // 새로 얻은 것 착용 버튼은 칸 안이 아니라 '결과 닫기' 옆에 하나로(칸 높이·정렬 유지, 2026-10-26)
  const nv = (last?.out || []).filter(x => x.new).map(x => x.v);
  const nst = nv.filter(v => !gcItem(v)?.fx), nfx = nv.filter(v => gcItem(v)?.fx);
  const act = $('.gc-act'); if (act) act.innerHTML = `${nst.length ? `<button type="button" class="btn gc-wearb" data-gc-wear="${esc(nst[0])}">새 스티커 ${nst.length}개 붙이러 가기 ›</button>` : ''}${nfx.length ? `<button type="button" class="btn gc-wearb" data-gc-wear="${esc(nfx[0])}">새 효과 ${nfx.length}개 켜러 가기 ›</button>` : ''}<button type="button" class="btn ghost" data-gc-close>결과 닫기</button>`;
}
function paintBtns() {
  const g = api.me()?.gc; if (!g) return;
  document.querySelectorAll('[data-gc]').forEach(b => { b.disabled = busy || g.tix < +b.dataset.gc; });
}
let armed = null;
function arm(b) {   // 첫 번째 누름: 확인 상태로
  if (armed && armed !== b) disarm();
  armed = b; b.classList.add('arm'); b.dataset.txt = b.innerHTML; b.innerHTML = `조각 ${b.dataset.cost}개 쓰기?`;
  clearTimeout(arm.t); arm.t = setTimeout(disarm, 3000);
}
function disarm() { if (!armed) return; armed.classList.remove('arm'); if (armed.dataset.txt) armed.innerHTML = armed.dataset.txt; armed = null; }
async function buy(kind, v) {
  armed = null;
  try {
    const r = await api.call(kind === 'pick' ? 'gcpick' : 'gcshine', { v }); api.setGc(r); paint();
    const it = gcItem(v);
    if (kind === 'pick') { if (it?.rar >= 3) flash(it.rar); toast(`${objName(r.v)}을(를) 받았어요!${it?.fx ? ' 내 효과에서 켜 보세요' : ''}`); }
    else toast(`${objName(v)} 스티커가 반짝이로 바뀌었어요! 꾸미기에서 골라 보세요`);
    $('#gcShop')?.scrollIntoView({ block: 'nearest' });
  } catch (e) { toast(e.message); paint(); }
}
async function setFx(slot, v) {
  try { const r = await api.call('gcfx', { slot, v }); api.setGc(r); paint(); toast(v ? `${objName(v)} 켰어요` : '효과를 껐어요'); }
  catch (e) { toast(e.message); }
}
async function openGift(v) {
  gift = { v, list: null }; paint();
  try { const r = await api.call('people?kind=friends'); if (gift?.v === v) { gift.list = r.list || r.people || r.users || []; paint(); } }
  catch (e) { gift = null; paint(); toast(e.message); }
}
async function sendGift(to) {
  if (!gift) return;
  const v = gift.v;
  try { const r = await api.call('gcgift', { to, v }); api.setGc(r); gift = null; paint(); toast(`${objName(v)} 스티커를 선물했어요! DM으로 갔어요`); }
  catch (e) { toast(e.message); }
}
function onClick(e) {
  const t = e.target;
  const b = t.closest('[data-gc]'); if (b && !b.disabled) { draw(+b.dataset.gc); return; }
  const c = t.closest('.gc-cap'); if (c) { openCap(+c.dataset.i); return; }
  if (t.closest('[data-gc-all]')) { last?.out.forEach((_, i) => openCap(i, true)); return; }
  if (t.closest('[data-gc-close]')) { const s = $('#gcStage'); if (s) { s.innerHTML = ''; s.className = 'gc-stage'; } last = null; return; }
  if (t.closest('[data-gc-shop]')) { $('#gcShop')?.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }); return; }
  const bu = t.closest('[data-gc-pick],[data-gc-shine]');
  if (bu && !bu.disabled) { const k = bu.dataset.gcPick ? 'pick' : 'shine'; if (bu === armed) buy(k, bu.dataset.gcPick || bu.dataset.gcShine); else arm(bu); return; }
  const fb = t.closest('[data-gc-fx]'); if (fb) { setFx(fb.dataset.gcFx, fb.dataset.v); return; }
  const we = t.closest('[data-gc-wear]'); if (we) { api.edit?.(wearOpt(we.dataset.gcWear)); return; }
  const wt = t.closest('[data-gc-wtab]'); if (wt) { const L = NW.list().filter(v => NW.kindOf(v) === wt.dataset.gcWtab); api.edit?.(L[0] ? wearOpt(L[0]) : wt.dataset.gcWtab === 'fx' ? { tab: 'fx' } : { tab: 'stk', sub: 'st' }); return; }
  if (t.closest('[data-gc-nwclr]')) { NW.seenAll(NW.list()); toast('새로 얻음 표시를 지웠어요'); return; }
  const wa = t.closest('[data-wear-at]'); if (wa) { setSpotPref(wa.dataset.wearAt); paint(); return; }
  if (t.closest('[data-wt-auto]')) { const a = myArt(); if (a) setAdj(a, null); paint(); toast('자동 위치로 돌렸어요'); return; }
  const gb = t.closest('[data-gc-gift]'); if (gb) { openGift(gb.dataset.gcGift); return; }
  if (t.closest('[data-gc-gift-x]')) { gift = null; paint(); return; }
  const to = t.closest('[data-gc-to]'); if (to) { sendGift(to.dataset.gcTo); return; }
  const v = t.closest('[data-gc-view]'); if (v) { view = v.dataset.gcView; paint(); }
}
