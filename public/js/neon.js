// 네온 시계 관(튜브) — 6차(2026-10-25 하율: "애매하게 뭉툭해서 그래픽 깨진 것 같은 것 없애 봐")
// 5차는 SVG 필터(흐림+문턱값)로 윤곽을 부풀리고 깎아서 관을 만들었는데, 이 방식은 모서리·획 끝에서 두께가 들쭉날쭉해져
// 뭉툭한 혹처럼 보였음 → 진짜 '선'으로 그림: 숫자 칸(span.n/.c)마다 같은 글자를 SVG <text>로 겹쳐 놓고
// 글자 윤곽선에 일정한 두께의 stroke(모서리 둥글게 linejoin=round)를 3겹 — 짙은 가장자리 → 네온색 → 흰 심.
// 원래 글자는 투명(자리·폭은 그대로), 빛 번짐은 CSS drop-shadow. 색은 CSS 변수 그대로(--ne-edge·--ne-tube·--ne-hot).
// 시계는 app.js setHtml이 innerHTML을 통째로 바꾸므로, 바뀔 때마다 다시 붙임(MutationObserver)
(() => {
  const NS = 'http://www.w3.org/2000/svg', html = document.documentElement;
  const on = () => html.dataset.ckfx === 'neon';
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function paint(el) {
    if (!el) return;
    for (const sp of el.querySelectorAll(':scope > .n, :scope > .c')) {
      const old = sp.querySelector(':scope > .ntb');
      if (!on()) { old?.remove(); continue; }
      const ch = [...sp.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (old && old.dataset.ch === ch) continue;
      old?.remove();
      // 글자 기준선 위치: 폭 0짜리 표식을 기준선에 놓고 잼
      const mk = document.createElement('i'); mk.className = 'nb'; sp.appendChild(mk);
      const y = (mk.offsetTop / parseFloat(getComputedStyle(sp).fontSize)).toFixed(4) + 'em'; mk.remove();   // em으로 → 창 크기가 바뀌어 글자가 커져도 그대로 맞음
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'ntb'); svg.setAttribute('aria-hidden', 'true'); svg.dataset.ch = ch;
      const t = c => `<text class="${c}" x="50%" y="${y}" text-anchor="middle">${esc(ch)}</text>`;
      svg.innerHTML = t('t1') + t('t2') + t('t3');
      sp.appendChild(svg);
    }
  }
  const all = () => paint(document.getElementById('bigTime'));
  const start = () => {
    const el = document.getElementById('bigTime');
    if (!el) return;
    all();
    new MutationObserver(all).observe(el, { childList: true });
    new MutationObserver(all).observe(html, { attributes: true, attributeFilter: ['data-ckfx'] });
    document.fonts?.ready.then(() => { el.querySelectorAll('.ntb').forEach(s => s.remove()); all(); });   // 글꼴이 늦게 오면 기준선 다시
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
