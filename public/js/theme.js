// 첫 화면 깜빡임 방지: CSS보다 먼저 저장된 테마(없으면 기기 설정)를 적용한다. (모듈이 아닌 일반 스크립트)
(function () {
  var t = null;
  try { t = JSON.parse(localStorage.getItem('sg_theme')); } catch (e) {}
  if (t !== 'dark' && t !== 'light') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
})();
