// 네온 시계 관(튜브) — 6차(2026-10-25 하율: "애매하게 뭉툭해서 그래픽 깨진 것 같은 것 없애 봐")
// 5차 SVG 필터(흐림+문턱값)는 모서리·획 끝에서 두께가 들쭉날쭉해 뭉툭한 혹처럼 보였고, 글자를 SVG <text>로 stroke하면
// Outfit 웹폰트(가변 글꼴)의 겹친 윤곽이 글자 속 선으로 비침 → 겹침을 정리한 Outfit ExtraBold(800) 숫자 윤곽을 path로 넣어
// 그 윤곽선에 일정한 두께의 stroke(모서리 둥글게) 3겹: 짙은 가장자리 → 네온색 → 흰 심. 속은 비어 배경이 보이는 윤곽 네온관.
// 원래 글자는 투명(폭·자리 유지), 빛 번짐은 CSS drop-shadow. 색은 CSS 변수(--ne-edge·--ne-tube·--ne-hot).
// 시계는 app.js setHtml이 innerHTML을 통째로 바꾸므로 바뀔 때마다 다시 붙임(MutationObserver), 글자 크기가 바뀌면 다시 계산
(() => {
  // 숫자 윤곽: 글꼴 단위 1000 = 1em, [가로 폭, path] (Outfitio/Outfit-Fonts Outfit-ExtraBold.otf, OFL)
  const G = {"0":[671,"M337 11C514 11 644 -138 644 -355C644 -571 513 -721 335 -721C157 -721 27 -571 27 -356C27 -140 159 11 337 11ZM335 -143C254 -143 206 -218 206 -356C206 -492 254 -566 335 -566C416 -566 465 -491 465 -355C465 -218 417 -143 335 -143Z"],"1":[390,"M151 0H328V-709H16V-560H151Z"],"2":[576,"M22 0H547V-149H296L422 -272C501 -348 532 -408 532 -492C532 -632 435 -721 282 -721C166 -721 76 -672 18 -578L135 -474C178 -540 217 -567 268 -567C322 -567 357 -535 357 -485C357 -451 341 -423 300 -380L22 -97Z"],"3":[569,"M256 11C428 11 541 -86 541 -231C541 -349 469 -427 372 -437L526 -612V-709H60V-560H288L167 -419V-321C184 -327 216 -331 243 -331C319 -331 366 -295 366 -236C366 -176 319 -140 253 -140C201 -140 149 -164 125 -199L11 -87C69 -24 156 11 256 11Z"],"4":[613,"M18 -145H351V0H526V-145H594V-294H526V-427H351V-294H229L432 -709H240L18 -243Z"],"5":[568,"M257 11C431 11 541 -90 541 -234C541 -361 456 -470 295 -470C267 -470 246 -467 227 -462L238 -560H502V-709H95L60 -372L130 -308C160 -330 199 -344 244 -344C319 -344 365 -302 365 -241C365 -180 319 -140 250 -140C198 -140 146 -164 122 -199L8 -87C66 -24 160 11 257 11Z"],"6":[579,"M289 11C442 11 558 -97 558 -238C558 -372 451 -475 317 -475H315L484 -709H284L81 -412C40 -352 21 -296 21 -237C21 -96 137 11 289 11ZM289 -140C233 -140 192 -183 192 -242C192 -300 233 -344 289 -344C346 -344 387 -301 387 -242C387 -183 346 -140 289 -140Z"],"7":[530,"M108 0H291L513 -611V-709H16V-560H320Z"],"8":[569,"M285 11C442 11 544 -77 544 -198C544 -281 502 -346 436 -377C488 -406 517 -465 517 -526C517 -638 422 -721 285 -721C147 -721 52 -638 52 -526C52 -465 81 -406 132 -377C67 -346 25 -281 25 -198C25 -77 127 11 285 11ZM285 -437C244 -437 215 -466 215 -507C215 -547 244 -576 285 -576C325 -576 354 -546 354 -505C354 -465 325 -437 285 -437ZM285 -138C232 -138 194 -174 194 -224C194 -273 232 -310 285 -310C338 -310 375 -273 375 -224C375 -174 338 -138 285 -138Z"],"9":[579,"M95 0H295L498 -297C539 -357 558 -413 558 -473C558 -613 442 -721 289 -721C137 -721 20 -612 20 -472C20 -337 128 -234 262 -234H264ZM289 -366C233 -366 192 -409 192 -467C192 -526 233 -569 289 -569C346 -569 387 -526 387 -467C387 -409 346 -366 289 -366Z"],":":[300,"M150 -278C207 -278 249 -322 249 -379C249 -436 207 -481 150 -481C92 -481 50 -436 50 -379C50 -322 92 -278 150 -278ZM150 11C207 11 249 -33 249 -90C249 -147 207 -191 150 -191C92 -191 50 -147 50 -90C50 -33 92 11 150 11Z"],".":[304,"M153 11C210 11 252 -33 252 -90C252 -147 210 -191 153 -191C95 -191 53 -147 53 -90C53 -33 95 11 153 11Z"]};
  const NS = 'http://www.w3.org/2000/svg', html = document.documentElement;
  const on = () => html.dataset.ckfx === 'neon';
  function paint(el) {
    if (!el) return;
    for (const sp of el.querySelectorAll(':scope > .n, :scope > .c')) {
      const old = sp.querySelector(':scope > .nsvg');
      const ch = [...sp.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''), g = G[ch];
      if (!on() || !g) { old?.remove(); sp.classList.remove('ntg'); continue; }
      const fs = parseFloat(getComputedStyle(sp).fontSize), w = sp.offsetWidth;
      const key = ch + '|' + fs + '|' + w;
      if (old && old.dataset.k === key) continue;
      old?.remove();
      // 글자 기준선 위치: 폭 0짜리 표식을 기준선에 놓고 잼
      const mk = document.createElement('i'); mk.className = 'nb'; sp.appendChild(mk);
      const y = mk.offsetTop; mk.remove();
      const s = fs / 1000, x = (w - g[0] * s) / 2;   // 칸 가운데 정렬(text-align:center와 같음)
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'nsvg'); svg.setAttribute('aria-hidden', 'true'); svg.dataset.k = key;
      const p = c => `<path class="${c}" d="${g[1]}"/>`;
      svg.innerHTML = `<g transform="translate(${x.toFixed(2)} ${y}) scale(${s.toFixed(5)})">${p('t1') + p('t2') + p('t3')}</g>`;
      sp.appendChild(svg); sp.classList.add('ntg');
    }
  }
  const all = () => paint(document.getElementById('bigTime'));
  const start = () => {
    const el = document.getElementById('bigTime');
    if (!el) return;
    all();
    new MutationObserver(all).observe(el, { childList: true });
    // #bigTime은 inline(<b>)이라 ResizeObserver가 크기 변화를 못 잡음 → 창 크기를 바꾸면 관이 옛 글자 크기로 남던 버그(2026-10-25).
    // 블록인 부모(.clock)를 지켜보고, 창 크기 변화도 같이 받음
    if ('ResizeObserver' in window) new ResizeObserver(all).observe(el.parentElement || el);
    addEventListener('resize', all);
    new MutationObserver(all).observe(html, { attributes: true, attributeFilter: ['data-ckfx'] });
    document.fonts?.ready.then(() => { el.querySelectorAll('.nsvg').forEach(s => s.remove()); all(); });   // 글꼴이 늦게 오면 기준선 다시
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
