// 첫 화면 깜빡임 방지: CSS보다 먼저 저장된 테마(없으면 기기 설정)를 적용한다. (모듈이 아닌 일반 스크립트)
(function () {
  var t = null;
  try { t = JSON.parse(localStorage.getItem('sg_theme')); } catch (e) {}
  if (t !== 'dark' && t !== 'light') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  // 로그인 전이면 소개 화면부터 (sg_in: 로그인한 적 있는 기기 표시 → 깜빡임 방지, sg_peek: 이번 창에서 '둘러보기' 누름)
  try { if (!localStorage.getItem('sg_in') && !sessionStorage.getItem('sg_peek')) document.documentElement.classList.add('prelogin'); } catch (e) {}
})();

// 눌림 애니메이션 통일: 트랙패드 '탭하여 클릭'·터치스크린은 누름→뗌이 순식간이라 :active가 거의 안 보인다.
// 누르는 순간 .is-pressed를 붙이고 최소 MIN ms 유지해, 물리 클릭과 같은 눌림 모션이 보이게 한다.
(function () {
  var SEL = '.iconbtn,.hi,.app,.pl-o,.tray .cell.vote,.tray .it.vote,.drink.vote,.pager button,.btn,.tbtn,.n25 button,.dmpill';
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
