// SVMHS GROUND — 마우스 이름표([data-tip])를 화면 맨 위 층(body)에 띄움 (2026-10-24)
// 예전엔 CSS ::after로 그 요소 안에 그려서, 스크롤되는 창(꾸미기 시트 등)이나 화면 가장자리에서 잘렸음.
// 이제는 position:fixed 한 장을 화면 안에 맞춰 놓음 → 어떤 창 안에서도, 가장자리에서도 안 잘림. 터치 기기는 안 씀(CSS와 같음).
const fine = matchMedia('(hover:hover)');
let box, cur = null, raf = 0;
const M = 8;   // 화면 가장자리 여백

function make() {
  box = document.createElement('div');
  box.className = 'htip';
  box.setAttribute('aria-hidden', 'true');
  document.body.appendChild(box);
  document.documentElement.classList.add('htip-on');   // CSS ::after 이름표 끔
}

// 카드형 이름표(data-tip-t 제목 · -d 설명 · -m 아래 작은 줄 · -r 등급 색): 긴 설명을 한 줄로 붙이지 않고 나눠서 보여 줌 (2026-10-25)
function fillCard(el) {
  box.textContent = '';
  const add = (tag, cls, txt) => { if (!txt) return; const n = document.createElement(tag); n.className = cls; n.textContent = txt; box.appendChild(n); };
  add('b', 'ht-t', el.getAttribute('data-tip-t'));
  add('span', 'ht-d', el.getAttribute('data-tip-d'));
  add('span', 'ht-m r' + (el.getAttribute('data-tip-r') || ''), el.getAttribute('data-tip-m'));
  add('span', 'ht-u', el.getAttribute('data-tip-u'));
}

function place() {
  if (!cur) return;
  if (!cur.isConnected || !cur.getAttribute('data-tip')) return hide();
  const t = cur.getAttribute('data-tip'), card = cur.hasAttribute('data-tip-t');
  if (box.dataset.k !== t) { box.dataset.k = t; card ? fillCard(cur) : (box.textContent = t); }
  box.classList.toggle('wrap', !!cur.closest('.cal'));
  box.classList.toggle('card', card);
  const r = cur.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  if (r.bottom < 0 || r.top > vh) return hide();
  const w = box.offsetWidth, h = box.offsetHeight;
  let x, y;
  if (cur.closest('.bs-list') && r.left - w - 8 >= M) {          // 오른쪽 목록: 왼쪽에 띄움
    x = r.left - w - 8; y = r.top + r.height / 2 - h / 2;
  } else {
    x = cur.hasAttribute('data-tip-end') ? r.right - w : r.left + r.width / 2 - w / 2;
    y = r.bottom + 9;
    if (y + h > vh - M && r.top - 9 - h >= M) y = r.top - 9 - h;   // 아래 자리가 없으면 위로
  }
  x = Math.min(Math.max(x, M), vw - w - M);
  y = Math.min(Math.max(y, M), vh - h - M);
  box.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  raf = requestAnimationFrame(place);   // 버튼이 움직여도(스크롤·애니메이션) 따라감
}

function show(el) {
  if (!box) make();
  if (cur === el) return;
  cancelAnimationFrame(raf);
  cur = el;
  box.classList.remove('on');
  place();
  if (cur) box.classList.add('on');
}
function hide() {
  cancelAnimationFrame(raf);
  cur = null;
  if (box) { box.classList.remove('on'); delete box.dataset.k; }
}

if (fine.matches) {
  make();
  document.addEventListener('pointerover', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = e.target.closest?.('[data-tip]');
    el ? show(el) : hide();
  }, { passive: true });
  document.addEventListener('pointerleave', hide);
  document.addEventListener('focusin', e => { const el = e.target.closest?.('[data-tip]'); if (el && el.matches(':focus-visible')) show(el); });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') hide(); }, { passive: true });
  addEventListener('blur', hide);
}
