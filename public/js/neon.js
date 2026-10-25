// 네온 시계 관(튜브) 그리기 — 2026-10-25 하율: "깨진다"(16방향 text-shadow 고리가 픽셀 단위로 맞춰져 곡선이 계단처럼 깨짐) + "더 네온 느낌"
// 방식: SVG 필터로 글자 모양을 흐리게 한 뒤 문턱값을 잘라 '둥글고 매끄럽게 부푼 윤곽'을 만듦(확대해도 안 깨짐, 모서리도 둥긂)
//  겹(아래→위): 벽에 번진 빛 2겹 → (밝은 테마만) 짙은 바깥 테두리 → 색 관 → 관 가운데 하얗게 달아오른 심 → 유리 글자 + 안쪽에 비친 빛
// 굵기는 글자 크기(px)에 비례 → 시계 글자 크기가 바뀌면(창 크기·확대) 다시 계산. 색은 CSS 변수(--ne 등)를 flood-color로 그대로 씀
(() => {
  const NS = 'http://www.w3.org/2000/svg', html = document.documentElement;
  let svg, lastF = 0;
  // 글자 가장자리에서 d만큼 바깥까지 채운 가림판: 흐림 σ로 번진 알파를 0.1에서 잘라 냄(곧은 변 기준 d≈1.28σ), 경계 부드러움은 약 1px
  const mask = (id, d) => {
    const s = d / 1.2816, k = s / 0.175 / 0.9;
    return `<feGaussianBlur in="SourceAlpha" stdDeviation="${s.toFixed(2)}" result="b${id}"/>` +
      `<feComponentTransfer in="b${id}" result="${id}"><feFuncA type="linear" slope="${k.toFixed(2)}" intercept="${(0.5 - k * 0.1).toFixed(3)}"/></feComponentTransfer>`;
  };
  const fill = (cls, inM, out) => `<feFlood class="${cls}"/><feComposite in2="${inM}" operator="in" result="${out}"/>`;
  function build(f) {
    const d = x => x * f;
    return `<filter id="sgNeon" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">` +
      mask('mE', d(.058)) + mask('mT', d(.048)) + mask('mCo', d(.034)) + mask('mCi', d(.016)) +
      fill('ne-edge', 'mE', 'E') + fill('ne-tube', 'mT', 'T') +
      fill('ne-hot', 'mCo', 'C0') + `<feComposite in="C0" in2="mCi" operator="out" result="C1"/>` +
      `<feGaussianBlur in="C1" stdDeviation="${d(.005).toFixed(2)}" result="C"/>` +
      `<feGaussianBlur in="T" stdDeviation="${d(.03).toFixed(2)}" result="G1"/>` +
      `<feGaussianBlur in="T" stdDeviation="${d(.09).toFixed(2)}" result="G2b"/>` +
      `<feComponentTransfer in="G2b" result="G2"><feFuncA type="linear" slope=".7"/></feComponentTransfer>` +
      `<feComposite in="G1" in2="SourceAlpha" operator="in" result="INb"/><feComponentTransfer in="INb" result="IN"><feFuncA type="linear" slope=".35"/></feComponentTransfer>` +   // 유리 안쪽에 옅게 비친 관 빛
      `<feMerge><feMergeNode in="G2"/><feMergeNode in="G1"/><feMergeNode in="E"/><feMergeNode in="T"/><feMergeNode in="C"/><feMergeNode in="SourceGraphic"/><feMergeNode in="IN"/></feMerge></filter>`;
  }
  function update() {
    const el = document.getElementById('bigTime');
    if (html.dataset.ckfx !== 'neon' || !el) return;
    const f = Math.round(parseFloat(getComputedStyle(el).fontSize) * 2) / 2;
    if (!f || f === lastF) return;
    lastF = f;
    if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'sprite'); svg.setAttribute('aria-hidden', 'true'); document.body.appendChild(svg); }
    svg.innerHTML = `<defs>${build(f)}</defs>`;
  }
  const start = () => {
    update();
    const el = document.getElementById('bigTime');
    if (el && 'ResizeObserver' in window) new ResizeObserver(update).observe(el);
    addEventListener('resize', update);
    new MutationObserver(update).observe(html, { attributes: true, attributeFilter: ['data-ckfx'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
