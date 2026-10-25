// 네온 시계 관(튜브) — 6차(2026-10-25 하율: "애매하게 뭉툭해서 그래픽 깨진 것 같은 것 없애 봐")
// 5차는 SVG 필터(흐림+문턱값)로 윤곽을 부풀리고 깎아서 관을 만들었는데, 이 방식은 모서리·획 끝에서 두께가 들쭉날쭉해져
// 뭉툭한 혹처럼 보였음 → 진짜 '선'으로 그림: 숫자 칸(span.n/.c)마다 같은 글자를 SVG <text>로 겹쳐 놓고
// 글자 윤곽선에 일정한 두께의 stroke(모서리 둥글게 linejoin=round)를 3겹 — 짙은 가장자리 → 네온색 → 흰 심.
// 원래 글자는 투명(자리·폭은 그대로), 빛 번짐은 CSS drop-shadow. 색은 CSS 변수 그대로(--ne-edge·--ne-tube·--ne-hot).
// 시계는 app.js setHtml이 innerHTML을 통째로 바꾸므로, 바뀔 때마다 다시 붙임(MutationObserver)
(() => {
  const NS = 'http://www.w3.org/2000/svg', html = document.documentElement;
  const on = () => html.dataset.ckfx === 'neon';
  let seq = 0;
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function paint(el) {
    if (!el) return;
    for (const sp of el.querySelectorAll(':scope > .n, :scope > .c')) {
      const old = sp.querySelector(':scope > .ntb');
      if (!on()) { old?.remove(); continue; }
      const ch = [...sp.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (old && old.dataset.ch === ch && +old.dataset.fs === parseFloat(getComputedStyle(sp).fontSize)) continue;   // 글자·크기 같으면 그대로
      old?.remove();
      // 글자 기준선 위치: 폭 0짜리 표식을 기준선에 놓고 잼
      const mk = document.createElement('i'); mk.className = 'nb'; sp.appendChild(mk);
      const y = (mk.offsetTop / parseFloat(getComputedStyle(sp).fontSize)).toFixed(4) + 'em'; mk.remove();   // em으로 → 창 크기가 바뀌어 글자가 커져도 그대로 맞음
      const svg = document.createElementNS(NS, 'svg'), id = 'ntm' + (++seq), fs = parseFloat(getComputedStyle(sp).fontSize);
      svg.setAttribute('class', 'ntb'); svg.setAttribute('aria-hidden', 'true'); svg.dataset.ch = ch; svg.dataset.fs = fs;
      const t = (c, x = '') => `<text class="${c}" x="50%" y="${y}" text-anchor="middle"${x}>${esc(ch)}</text>`;
      // Outfit 글자는 획끼리 겹친 윤곽(속 선)이 있어 stroke를 그대로 그리면 글자 속에 선이 비침 →
      // 글자 속을 관 안쪽 두께(가장 굵은 겹의 절반)만큼 깎은 영역을 가려서, 윤곽선 근처의 관만 남김
      const r = (fs * 0.041).toFixed(2);
      svg.innerHTML = `<defs><filter id="${id}e" x="-20%" y="-20%" width="140%" height="140%"><feMorphology operator="erode" radius="${r}"/></filter>` +
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%"><rect x="-50%" y="-50%" width="200%" height="200%" fill="#fff"/>${t('mk', ` filter="url(#${id}e)"`)}</mask></defs>` +
        `<g mask="url(#${id})">${t('t1') + t('t2') + t('t3')}</g>`;
      sp.appendChild(svg);
    }
  }
  const all = () => paint(document.getElementById('bigTime'));
  const start = () => {
    const el = document.getElementById('bigTime');
    if (!el) return;
    all();
    new MutationObserver(all).observe(el, { childList: true });
    if ('ResizeObserver' in window) new ResizeObserver(all).observe(el);   // 글자 크기가 바뀌면 깎는 두께(px)도 다시
    new MutationObserver(all).observe(html, { attributes: true, attributeFilter: ['data-ckfx'] });
    document.fonts?.ready.then(() => { el.querySelectorAll('.ntb').forEach(s => s.remove()); all(); });   // 글꼴이 늦게 오면 기준선 다시
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
