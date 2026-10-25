// SVMHS GROUND — 앱으로 설치하기 (2026-10-25 하율: "사이트까지 들어가는 게 귀찮으면 안 되니까 앱으로 바로 실행" — 맥·윈도우·태블릿·모바일)
// 방식: PWA. 설치 버튼을 주는 브라우저(Chrome·Edge·웨일·삼성 인터넷·안드로이드)는 버튼 한 번,
// 버튼이 없는 곳(아이폰·아이패드 Safari, 맥 Safari, 카카오톡 등 앱 안 브라우저)은 기기에 맞는 순서를 그림으로 안내.
// 설치 신호(beforeinstallprompt)는 theme.js가 페이지 맨 처음에 잡아 window.__bip에 둠(모듈이 늦게 떠도 놓치지 않게).
import { $, store, toast } from './util.js';
import { ffOn } from './flags.js';

const FF = 'app-install';
const ua = navigator.userAgent;
const mm = q => { try { return matchMedia(q).matches; } catch { return false; } };
export const isApp = () => mm('(display-mode: standalone)') || mm('(display-mode: window-controls-overlay)') || mm('(display-mode: minimal-ui)') || navigator.standalone === true;

const iOS = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   // 아이패드는 '맥'이라고 자기소개함
const android = /Android/.test(ua);
const kakao = /KAKAOTALK/i.test(ua);
const inApp = kakao || /Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|everytimeApp|DaumApps|; wv\)/i.test(ua);
const samsung = /SamsungBrowser/.test(ua);
const firefox = /Firefox|FxiOS/.test(ua);
const edge = /Edg(e|A|iOS)?\//.test(ua);
const whale = /Whale/.test(ua);
const macSafari = !iOS && /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR|Whale/.test(ua);
const safariVer = +((ua.match(/Version\/(\d+)/) || [])[1] || 0);
const iosSafari = iOS && !/CriOS|FxiOS|EdgiOS|Whale|NAVER|KAKAOTALK|Instagram/.test(ua);
const iosVer = +((ua.match(/OS (\d+)_/) || [])[1] || safariVer || 0);

const URL0 = location.origin + '/';
const I = id => `<svg class="a-i" viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
const steps = arr => `<ol class="asteps">${arr.map(s => `<li>${s}</li>`).join('')}</ol>`;

// 기기·브라우저별 안내 (설치 버튼이 있으면 그게 1순위)
function guide() {
  if (isApp()) return { k: 'done', h: '이미 앱으로 쓰고 있어요', b: '<p class="a-sub">지금 이 화면이 설치된 GROUND 앱이에요. 다음부터도 아이콘을 눌러 바로 여세요.</p>' };
  if (inApp) return {
    k: 'inapp', h: (kakao ? '카카오톡' : '이 앱') + ' 안에서는 설치가 안 돼요',
    b: `<p class="a-sub">앱 안에 들어 있는 브라우저라 설치 버튼이 없어요. ${iOS ? 'Safari' : 'Chrome'}로 열면 바로 설치할 수 있어요.</p>
      <div class="a-acts"><button class="btn big" type="button" id="appOut">${iOS ? 'Safari' : 'Chrome'}로 열기</button><button class="btn ghost" type="button" id="appCopy">주소 복사</button></div>
      ${iOS ? steps([`오른쪽 아래(또는 위) <b>⋯</b> 버튼 → <b>Safari로 열기</b>(또는 <b>다른 브라우저로 열기</b>)`, `열린 Safari에서 이 버튼을 다시 눌러 주세요`]) : ''}`,
  };
  if (window.__bip) return {
    k: 'prompt', h: '버튼 한 번이면 설치 끝',
    b: `<p class="a-sub">${android ? '홈 화면' : '바탕화면·시작 메뉴(맥은 Dock·Launchpad)'}에 GROUND 아이콘이 생기고, 주소창 없는 앱 창으로 바로 열려요.</p>
      <div class="a-acts"><button class="btn big" type="button" id="appGo">${I('i-app')}지금 설치하기</button></div>`,
  };
  if (iOS) {
    if (!iosSafari && iosVer && iosVer < 16) return { k: 'ios-old', h: 'Safari에서 설치할 수 있어요', b: `<p class="a-sub">이 브라우저는 홈 화면 추가를 못 해요. <b>Safari</b>로 열어 주세요.</p><div class="a-acts"><button class="btn ghost" type="button" id="appCopy">주소 복사</button></div>` };
    const ipad = !/iPhone|iPod/.test(ua);
    return {
      k: 'ios', h: (ipad ? '아이패드' : '아이폰') + ' 홈 화면에 추가하기',
      b: steps([
        `${iosSafari ? (ipad ? '주소창 오른쪽' : '화면 아래쪽(또는 주소창 옆 <b>⋯</b>)') : '주소창 옆'}의 <b>공유</b> 버튼 ${I('i-ios-share')}을 눌러요`,
        `목록을 위로 올려 <b>홈 화면에 추가</b> ${I('i-plus-sq')}를 눌러요 <small>(안 보이면 맨 아래 '작업 편집'에서 켜기)</small>`,
        `오른쪽 위 <b>추가</b> <small>('웹 앱으로 열기'가 보이면 켜 두기)</small>`,
      ]) + `<p class="a-tip">홈 화면의 GROUND 아이콘으로 열면 주소창 없이 앱처럼 열려요. 앱에서 로그인이 풀려 있으면 처음 한 번만 다시 로그인해 주세요.</p>`,
    };
  }
  if (macSafari) return safariVer >= 17
    ? { k: 'mac-safari', h: '맥 Dock에 추가하기', b: steps([`화면 맨 위 메뉴 막대에서 <b>파일</b>`, `<b>Dock에 추가…</b> → <b>추가</b>`]) + `<p class="a-tip">Dock과 Launchpad에 GROUND가 생기고, 누르면 따로 된 앱 창으로 열려요.</p>` }
    : { k: 'mac-old', h: 'Chrome으로 열면 설치할 수 있어요', b: `<p class="a-sub">이 Safari는 버전이 낮아 앱 설치를 못 해요(Safari 17 이상 또는 Chrome·Edge·웨일).</p><div class="a-acts"><button class="btn ghost" type="button" id="appCopy">주소 복사</button></div>` };
  if (firefox && !android) return { k: 'ff', h: 'Firefox는 앱 설치를 못 해요', b: `<p class="a-sub">컴퓨터용 Firefox엔 설치 기능이 없어요. <b>Chrome·Edge·웨일</b>로 이 주소를 열면 버튼 한 번에 설치돼요.</p><div class="a-acts"><button class="btn ghost" type="button" id="appCopy">주소 복사</button></div>` };
  if (samsung) return { k: 'samsung', h: '홈 화면에 추가하기', b: steps([`아래쪽 <b>≡</b> 메뉴`, `<b>현재 페이지 추가</b>(또는 <b>페이지 추가</b>) → <b>홈 화면</b>`, `<b>추가</b>`]) };
  if (android) return { k: 'android', h: '홈 화면에 추가하기', b: steps([`오른쪽 위 <b>⋮</b> 메뉴`, `<b>홈 화면에 추가</b> → <b>설치</b>`]) + `<p class="a-tip">메뉴에 <b>앱 설치</b>가 보이면 그걸 눌러도 돼요.</p>` };
  // 컴퓨터 Chrome·Edge·웨일인데 설치 신호가 아직 없을 때(이미 설치했거나, 브라우저가 아직 준비 중)
  return {
    k: 'desk', h: '컴퓨터에 앱으로 설치하기',
    b: steps(edge
      ? [`오른쪽 위 <b>⋯</b> 메뉴`, `<b>앱</b> → <b>이 사이트를 앱으로 설치</b>`, `<b>설치</b>`]
      : whale
        ? [`주소창 오른쪽 <b>설치</b> 아이콘 ${I('i-app')} 또는 <b>⋯</b> 메뉴의 <b>앱 설치</b>`, `<b>설치</b>`]
        : [`주소창 오른쪽 끝 <b>설치</b> 아이콘 ${I('i-app')}`, `안 보이면 <b>⋮</b> → <b>전송, 저장, 공유</b> → <b>페이지를 앱으로 설치</b>`, `<b>설치</b>`])
      + `<p class="a-tip">이미 설치했다면 바탕화면·시작 메뉴(맥은 Launchpad)에서 <b>GROUND</b>를 찾아 여세요.</p>`,
  };
}

function render() {
  const g = guide();
  $('#appT').textContent = g.h;
  $('#appBody').innerHTML = g.b;
  $('#appBody').dataset.k = g.k;
}

async function copy() {
  try { await navigator.clipboard.writeText(URL0); } catch { const i = document.createElement('input'); i.value = URL0; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
  toast('주소를 복사했어요. 브라우저 주소창에 붙여 넣어 주세요', 2600);
}
function openOut() {
  if (kakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(URL0); return; }
  if (android) { location.href = `intent://${location.host}/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(URL0)};end`; return; }
  copy();
}
async function prompt() {
  const e = window.__bip; if (!e) return render();
  window.__bip = null;
  try { e.prompt(); const r = await e.userChoice; if (r?.outcome === 'accepted') { closeAll(); return; } } catch {}
  render();
}

let open = null;
const closeAll = () => { hideNudge(true); document.querySelector('#mApp.open [data-close]')?.click(); };
export function openApp() { render(); open?.('#mApp'); hideNudge(true); }

// 한 번만 뜨는 작은 권유 카드: 로그인한 뒤, 앱이 아니고, 아직 안 닫았을 때
const NK = 'appNudge';
function hideNudge(forever) { const n = $('#appNudge'); if (n) n.classList.remove('show'); if (forever) store.set(NK, 1); }
function maybeNudge() {
  if (isApp() || store.get(NK) || !$('#appNudge')) return;
  if (!ffOn(FF, document.documentElement.classList.contains('dev-pv'))) return;
  let lsIn = false; try { lsIn = localStorage.getItem('sg_in') === '1'; } catch {}
  if (!lsIn || document.documentElement.classList.contains('prelogin')) return;
  $('#appNudgeTx').innerHTML = window.__bip || iOS || macSafari || android ? '앱으로 설치하면 다음부터 <b>아이콘 한 번</b>에 바로 열려요' : '앱으로 설치하면 주소 칠 필요 없이 <b>바로</b> 열려요';
  $('#appNudge').classList.add('show');
}

export function initInstall({ openModal }) {
  open = openModal;
  const sync = () => { const a = isApp(); document.documentElement.classList.toggle('is-app', a); $('#btnApp').hidden = a; $('#inApp') && ($('#inApp').hidden = a); };
  sync();
  try { matchMedia('(display-mode: standalone)').addEventListener('change', sync); } catch {}
  $('#btnApp').onclick = openApp;
  $('#inApp')?.addEventListener('click', openApp);
  $('#installBtn').hidden = false;           // 이용 안내 › 앱처럼 쓰기: 이제 어떤 기기든 안내 창으로
  $('#installBtn').textContent = '내 기기에 설치하는 법';
  $('#installBtn').onclick = openApp;
  $('#appBody').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'appGo') prompt(); else if (b.id === 'appCopy') copy(); else if (b.id === 'appOut') openOut();
  });
  $('#appNudgeGo').onclick = openApp;
  $('#appNudgeX').onclick = () => hideNudge(true);
  addEventListener('sg-bip', () => { if ($('#mApp').classList.contains('open')) render(); });
  addEventListener('appinstalled', () => { window.__bip = null; hideNudge(true); closeAll(); toast(android ? '설치 완료! 홈 화면의 GROUND로 바로 열 수 있어요' : '설치 완료! 바탕화면·시작 메뉴(Dock)의 GROUND로 바로 열 수 있어요', 3200); });
  setTimeout(maybeNudge, 12000);             // 첫 화면 등장 연출이 다 끝난 뒤
}
