// 카카오톡 안 브라우저로 열리면 기기 기본 브라우저(크롬·사파리)로 넘김 — 로그인 유지·구글 로그인·홈 화면 추가가 카톡 안에선 잘 안 되기 때문
(function () {
  try { if (/KAKAOTALK/i.test(navigator.userAgent)) location.replace('kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href)); } catch (e) {}
})();
// 첫 화면 깜빡임 방지: CSS보다 먼저 저장된 테마(없으면 기기 설정)를 적용한다. (모듈이 아닌 일반 스크립트)
(function () {
  var t = null;
  try { t = JSON.parse(localStorage.getItem('sg_theme')); } catch (e) {}
  if (t !== 'dark' && t !== 'light') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  // 색깔·캐릭터 테마(스킨). 모르는 이름이면 CSS 규칙이 없어 기본 파랑으로 보임
  var k = null;
  try { k = JSON.parse(localStorage.getItem('sg_skin')); } catch (e) {}
  if (/^[a-z]{2,12}$/.test(k || '')) document.documentElement.dataset.skin = k;
  // 내 캐릭터 그림의 옅은 배경 무늬(app.js가 줄여서 저장한 data URL). 왼쪽 아래 스티커는 app.js가 #mascot으로 붙임
  try {
    var a = localStorage.getItem('sg_myart'), pt = localStorage.getItem('sg_mypat');
    if (a && a.indexOf('data:image/') === 0) {
      var rs = document.documentElement.style;
      if (pt && pt.indexOf('data:image/') === 0) { rs.setProperty('--pat', 'url("' + pt + '")'); rs.setProperty('--pat-size', '90px 90px'); }
    }
  } catch (e) {}
  // 로그인 전이면 소개 화면만 보임 — 로그인 없이는 사이트를 볼 수 없음 (sg_in: 로그인돼 있던 기기 표시 → 깜빡임 방지)
  try { sessionStorage.removeItem('sg_peek'); if (!localStorage.getItem('sg_in')) document.documentElement.classList.add('prelogin'); } catch (e) { document.documentElement.classList.add('prelogin'); }
})();

// 눌림 애니메이션 통일: 트랙패드 '탭하여 클릭'·터치스크린은 누름→뗌이 순식간이라 :active가 거의 안 보인다.
// 누르는 순간 .is-pressed를 붙이고 최소 MIN ms 유지해, 물리 클릭과 같은 눌림 모션이 보이게 한다.
(function () {
  var SEL = '.iconbtn,.hi,.app,.bo,.go-svc,.s-svc,.bt-more,.tray .cell.vote,.tray .it.vote,.drink.vote,.pager button,.btn,.tbtn,.n25 button,.dmpill';
  var MIN = 150;
  var cur = null, t0 = 0;
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function release() {
    if (!cur) return;
    var el = cur, left = MIN - (now() - t0);
    cur = null;
    clearTimeout(el._prT);
    el._prT = setTimeout(function () { el.classList.remove('is-pressed'); }, left > 0 ? left : 0);
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (!el || el.disabled) return;
    if (cur && cur !== el) { clearTimeout(cur._prT); cur.classList.remove('is-pressed'); }
    clearTimeout(el._prT);
    cur = el; t0 = now();
    el.classList.add('is-pressed');
  }, { capture: true, passive: true });
  ['pointerup', 'pointercancel', 'dragstart'].forEach(function (n) {
    document.addEventListener(n, release, { capture: true, passive: true });
  });
  window.addEventListener('blur', release);
  // iOS Safari는 touchstart 리스너가 있어야 :active가 동작한다.
  document.addEventListener('touchstart', function () {}, { passive: true });
})();
