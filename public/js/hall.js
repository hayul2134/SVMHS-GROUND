// SVMHS GROUND — 기록실(2026-10-30 하율 "랭크 말고 따로 기록으로만 자랑할 수 있는 곳" — 미리보기 깃발 hall)
// 게임·모드마다 역대 최고 기록 1~3등 + 내 기록·순위. 티어(라운드·끝이 정해진 기록)와 별개라 시간 제한 없는 일반 모드·끝없이 달린 거리도 그대로 올라감.
// 기록실 화면을 처음 열 때만 불러옴(첫 로딩 무게 줄이기). 서버 GET hall · 전체 순위는 기존 랭킹 창(역대) 재사용
let D = null;   // social.js가 넘겨줌: { call, GAMES, ic, av, nameOf, devTag, esc, openRank, me }

// 기록실에서 쓰는 이름(모드가 둘인 게임은 모드까지)
const NAME = { gear: ['기자재 정리!', '타임어택'], gearn: ['기자재 정리!', '일반 · 오래 버티기'], home: ['집에 가고 싶어!', '끝까지 달린 거리'], mine: ['지뢰찾기', '랭크 · 중급'], snake: ['뱀 게임', '랭크'], n2048: ['2048', '랭크 · 3분'] };
const ORDER = ['home', 'cut', 'film', 'stair', 'gear', 'gearn', 'blast', 'reaction', 'num25', 'mine', 'snake', 'n2048'];
const CZ = ['mine', 'snake', 'n2048'];   // 게임 칸에서 c_ 로 여는 게임
const dayN = at => Math.max(1, Math.floor((Date.now() - at) / 864e5) + 1);

export function init(deps) { D = deps; }

export async function render() {
  const box = document.getElementById('hallBox'); if (!box || !D) return;
  if (!D.me()) { box.innerHTML = '<p class="empty">기록실은 로그인하면 볼 수 있어요</p>'; return; }
  if (!box.querySelector('.hl-grid')) box.innerHTML = `${head()}<div class="hl-grid skz">${'<article class="hl-card ghost"></article>'.repeat(6)}</div>`;
  let r;
  try { r = await D.call('hall'); } catch (e) { box.innerHTML = `${head()}<p class="empty">${D.esc(e.message || '기록실을 불러오지 못했어요')}</p>`; return; }
  const by = new Map(r.games.map(x => [x.g, x]));
  const list = ORDER.filter(g => by.has(g) && D.GAMES[g]).map(g => by.get(g)).concat(r.games.filter(x => !ORDER.includes(x.g) && D.GAMES[x.g]));
  box.innerHTML = `${head()}<div class="hl-grid">${list.map(cardHtml).join('')}</div>`;
}

const head = () => `<p class="hl-lead"><b>역대 최고 기록만 모아 둔 곳</b><span>티어와 상관없이, 지금까지 나온 가장 좋은 기록이 그대로 남아요. 시간 제한 없는 일반 모드 기록도 여기선 인정!</span></p>`;

function cardHtml(x) {
  const g = D.GAMES[x.g], [nm, md] = NAME[x.g] || [g.name, ''], e = D.esc;
  const [a, ...rest] = x.top;
  const one = a ? `<a class="hl-one${a.isMe ? ' me' : ''}" href="#u/${e(a.handle)}" data-u="1">${D.av(a, 'lg')}<span class="hl-who"><small>1위 · ${dayN(a.at)}일째</small><b>${e(D.nameOf(a))}${D.devTag(a)}</b></span><em class="hl-v">${e(g.fmt(a.v))}</em></a>`
    : '<p class="hl-none">아직 기록이 없어요 — 첫 기록이 곧 1위!</p>';
  const more = rest.map((u, i) => `<li class="${u.isMe ? 'me' : ''}"><span class="hl-rk">${i + 2}</span><a href="#u/${e(u.handle)}" data-u="1">${D.av(u)}<b>${e(D.nameOf(u))}</b></a><em>${e(g.fmt(u.v))}</em></li>`).join('');
  const my = x.me ? `<p class="hl-my">내 기록 <b>${e(g.fmt(x.me.v))}</b> · ${x.n}명 중 <b>${x.me.r}위</b></p>` : `<p class="hl-my no">아직 내 기록이 없어요</p>`;
  return `<article class="hl-card g-${e(x.g)}"><div class="hl-h">${D.ic(g.ic)}<span><b>${e(nm)}</b>${md ? `<small>${e(md)}</small>` : ''}</span></div>
    ${one}${more ? `<ol class="hl-more">${more}</ol>` : ''}${my}
    <div class="hl-btns"><button type="button" class="btn ghost" data-rank="${e(x.g)}" data-scope="all">전체 기록</button><button type="button" class="btn" data-play="${x.g === 'gearn' ? 'gear' : CZ.includes(x.g) ? 'c_' + x.g : e(x.g)}">${D.ic('play')}도전</button></div></article>`;
}
