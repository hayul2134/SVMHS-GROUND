// 네온 시계 관(튜브) 그리기 — 2026-10-25 하율: "깨진다"(16방향 text-shadow 고리가 픽셀 단위로 맞춰져 곡선이 계단처럼 깨짐) + "더 네온 느낌"
// 방식: SVG 필터로 글자 모양을 흐리게 한 뒤 문턱값을 잘라 '둥글고 매끄럽게 부푼 윤곽'을 만듦(확대해도 안 깨짐, 모서리도 둥긂)
//  5차(하율 "개구려, 안 보이고 네온 같지 않음"): 속을 채운 유리 글자 → 속이 빈 '윤곽선 관'으로. 관 단면은 짙은 가장자리 → 네온색 → 흰 심, 아래 번진 빛 2겹
// 굵기는 글자 크기(px)에 비례 → 시계 글자 크기가 바뀌면(창 크기·확대) 다시 계산. 색은 CSS 변수(--ne 등)를 flood-color로 그대로 씀
(() => {
  const NS = 'http://www.w3.org/2000/svg', html = document.documentElement;
  let svg, lastF = 0;
  // 문턱값 가림판: 글자 알파를 σ로 흐린 뒤 t에서 잘라 냄 — t=0.1이면 가장자리 바깥으로 d만큼 부풀고, t=0.9면 안쪽으로 d만큼 깎임(곧은 변 기준 d≈1.28σ)
  const thr = (id, d, t) => {
    const s = d / 1.2816, k = s / 0.175 / 0.8;
    return `<feGaussianBlur in="SourceAlpha" stdDeviation="${s.toFixed(2)}" result="b${id}"/>` +
      `<feComponentTransfer in="b${id}" result="${id}"><feFuncA type="linear" slope="${k.toFixed(2)}" intercept="${(0.5 - k * t).toFixed(3)}"/></feComponentTransfer>`;
  };
  // 글자 윤곽선을 따라 가는 관: 바깥으로 w 부푼 것 − 안으로 w 깎인 것 = 윤곽선 양쪽으로 w 두께의 띠(글자 속은 비어서 배경이 보임 → 진짜 네온 윤곽 간판)
  const ring = (id, w) => thr(id + 'o', w, 0.1) + thr(id + 'i', w, 0.9) + `<feComposite in="${id}o" in2="${id}i" operator="out" result="${id}"/>`;
  const fill = (cls, inM, out) => `<feFlood class="${cls}"/><feComposite in2="${inM}" operator="in" result="${out}"/>`;
  const glow = (src, s, a, out) => `<feGaussianBlur in="${src}" stdDeviation="${s.toFixed(2)}" result="${out}b"/><feComponentTransfer in="${out}b" result="${out}"><feFuncA type="linear" slope="${a}"/></feComponentTransfer>`;
  function build(f) {
    const d = x => x * f;
    // 관 단면: 가장자리 짙은 색(--ne-edge) → 네온색(--ne-tube) → 가운데 하얗게 달아오른 심(--ne-hot), 아래에 번진 빛 2겹
    return `<filter id="sgNeon" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">` +
      ring('R3', d(.042)) + ring('R2', d(.032)) + ring('R1', d(.011)) +
      fill('ne-edge', 'R3', 'E') + fill('ne-tube', 'R2', 'T0') + fill('ne-hot', 'R1', 'C0') +
      `<feGaussianBlur in="T0" stdDeviation="${d(.0035).toFixed(2)}" result="T"/><feGaussianBlur in="C0" stdDeviation="${d(.005).toFixed(2)}" result="C"/>` +
      glow('T0', d(.025), 1, 'G1') + glow('T0', d(.08), .8, 'G2') +
      `<feMerge><feMergeNode in="G2"/><feMergeNode in="G1"/><feMergeNode in="E"/><feMergeNode in="T"/><feMergeNode in="C"/></feMerge></filter>`;
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
