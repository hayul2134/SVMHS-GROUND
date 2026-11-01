// 게임 즐겨찾기(2026-11-02 하율 "게임 아이콘 오른쪽 위 빈 별 → 누른 순서대로 즐겨찾기처럼"):
// 홈 › 서비스 › 게임 아이콘마다 오른쪽 위 별. 누르면 채워지고 그 게임이 앞으로(먼저 누른 게임이 맨 앞), 다시 누르면 원래 자리로.
// 저장은 이 기기(sg_gfav, 학교 기기는 한 학생 배정). 별은 버튼 안 span이라 캡처 단계에서 클릭을 가로채 게임이 켜지지 않게 함.
import { $, store } from './util.js';

const KEY = 'gfav';
const grid = $('#apps .catgrid.gm5');
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.12L12 16.9l-5.5 2.87 1.05-6.12L3.1 9.3l6.15-.9z"/></svg>';

if (grid) {
  const apps = [...grid.querySelectorAll('.gapp[data-play]')];
  apps.forEach((b, i) => {
    b.dataset.gi = i;   // 원래 순서
    const s = document.createElement('span');
    s.className = 'gfav';
    s.setAttribute('role', 'button');
    s.innerHTML = STAR;
    b.appendChild(s);
  });
  let fav = store.get(KEY, []).filter(k => apps.some(b => b.dataset.play === k));

  const paint = anim => {
    const first = anim ? new Map(apps.map(b => [b, b.getBoundingClientRect()])) : null;
    const on = new Set(fav);
    const order = [...fav.map(k => apps.find(b => b.dataset.play === k)), ...apps.filter(b => !on.has(b.dataset.play))];
    order.forEach(b => {
      const f = on.has(b.dataset.play);
      b.classList.toggle('faved', f);
      const s = b.querySelector('.gfav');
      s.setAttribute('aria-label', f ? '즐겨찾기 해제' : '즐겨찾기');
      s.setAttribute('aria-pressed', f);
      grid.appendChild(b);
    });
    if (!first || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    apps.forEach(b => {   // 자리 바뀐 아이콘은 원래 자리에서 미끄러져 옴
      const a = first.get(b), z = b.getBoundingClientRect();
      const dx = a.left - z.left, dy = a.top - z.top;
      if (dx || dy) b.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.3,1)' });
    });
  };
  paint(false);

  const hit = e => e.target.closest && e.target.closest('.gapp .gfav');
  // 별을 누를 땐 게임 시작(data-play)·눌림 표시가 일어나지 않게 막음
  ['pointerdown', 'mousedown', 'touchstart'].forEach(t => grid.addEventListener(t, e => { if (hit(e)) e.stopPropagation(); }, true));
  document.addEventListener('click', e => {
    const s = hit(e); if (!s) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const k = s.parentElement.dataset.play;
    fav = fav.includes(k) ? fav.filter(x => x !== k) : [...fav, k];
    store.set(KEY, fav);
    s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop');
    paint(true);
  }, true);
}
