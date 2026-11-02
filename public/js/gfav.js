// 게임 즐겨찾기(2026-11-02 하율 "게임 아이콘 오른쪽 위 빈 별 → 누른 순서대로 즐겨찾기처럼"):
// 홈 › 서비스 › 게임 아이콘마다 오른쪽 위 별. 누르면 채워지고 그 게임이 앞으로(먼저 누른 게임이 맨 앞), 다시 누르면 원래 자리로.
// 저장은 이 기기(sg_gfav, 학교 기기는 한 학생 배정). 별은 버튼 안 span이라 캡처 단계에서 클릭을 가로채 게임이 켜지지 않게 함.
import { $, store } from './util.js';

const KEY = 'gfav';
const grid = $('#apps .catgrid.gm5');
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.46 4.00Q12.00 2.70 12.54 4.00L14.38 8.40Q14.70 9.18 15.54 9.25L20.30 9.63Q21.70 9.75 20.64 10.66L17.01 13.77Q16.37 14.32 16.57 15.14L17.67 19.79Q18.00 21.15 16.80 20.42L12.72 17.94Q12.00 17.50 11.28 17.94L7.20 20.42Q6.00 21.15 6.33 19.79L7.43 15.14Q7.63 14.32 6.99 13.77L3.36 10.66Q2.30 9.75 3.70 9.63L8.46 9.25Q9.30 9.18 9.62 8.40Z"/></svg>';

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
    // 노드를 옮기면 처음 나타날 때 쓰는 popIn 애니메이션이 전부 다시 돌아 '새로 고침'처럼 보임(08:52 하율) → 별을 한 번 누른 뒤엔 그 애니메이션 끔
    if (anim) grid.classList.add('gfav-calm');
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
      if (dx || dy) b.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.25,.9,.3,1)' });   // transform(스티커 기울기)과 따로 도는 translate
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
