// SVMHS GROUND — 착용 소품(뽑기 전설 'masc' 칸) — 2026-10-24
// 소품 그림과 '어디에 씌울지(부착 지점)'를 나눔: 캐릭터가 없는 테마에서도 소품이 사라지지 않게.
//   부착 지점: 캐릭터 머리(mascot) · 큰 시계 첫 숫자(clock) · 로고 G(logo) — '자동'이면 캐릭터가 있으면 머리, 없으면 시계.
//   프로필 사진 위에는 지점과 상관없이 항상(남에게 보이는 자리, 서버 fxPub의 mfx).
// 새 착용 소품을 넣을 때: WEAR에 { g(mascot 100×100 좌표 <g>), vb(단독 그림 viewBox) }만 추가하면 모든 지점에 같은 규칙으로 붙음.
import { store } from './util.js';

const INK = '#173048';
// 왕관: 마스코트 100×100 좌표(머리 위). 단독 그림은 같은 모양을 vb로 잘라 씀.
const CROWN_P = 'M37.4 7.6 43.6 12.6 50 2.4 56.4 12.6 62.6 7.6 60.4 20.4H39.6Z';
const crownG = halo => `<g class="mfx">${halo ? `<path class="w-halo" d="${CROWN_P}"/>` : ''}<path d="${CROWN_P}" transform="translate(1.2 2)" fill="${INK}"/><path d="${CROWN_P}" fill="#ffc83d" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M39.9 17.2H60.1" stroke="#d98a10" stroke-width="1.4"/><circle cx="50" cy="14.6" r="2.2" fill="#f0646d" stroke="${INK}" stroke-width="1.1"/><circle cx="37.4" cy="7.6" r="1.8" fill="#fff3b0" stroke="${INK}" stroke-width="1.1"/><circle cx="50" cy="2.4" r="1.9" fill="#fff3b0" stroke="${INK}" stroke-width="1.1"/><circle cx="62.6" cy="7.6" r="1.8" fill="#fff3b0" stroke="${INK}" stroke-width="1.1"/><path d="M42 16V12.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></g>`;

// 집 열쇠(히든): 마스코트 머리 위에 비스듬히 떠 있음. 그림은 att-art의 48×48 열쇠를 줄여 씀
const KEY_P = 'M15 12A10 10 0 1 0 24.6 25H34V30.6H37.4V27.6H40V31.2H43.6V19.4H24.6A10 10 0 0 0 15 12Z';
const keyG = halo => `<g class="mfx"><g transform="translate(50 10.5) rotate(-14) scale(.62) translate(-26.5 -21.6)">${halo ? `<path class="w-halo" d="${KEY_P}"/>` : ''}<path d="${KEY_P}" transform="translate(1.6 2.6)" fill="${INK}"/><path d="${KEY_P}" fill="#ffc83d" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M24.6 23H43.6V25H24.6Z" fill="#d98a10" opacity=".55"/><path d="M15 16.4 20.6 21.4V27.6H9.4V21.4Z" fill="#fffbe8" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.6 27.6V24.2H16.4V27.6" fill="#f0646d"/><path d="M8.4 19.4Q9.4 15.2 13.4 13.8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85"/></g></g>`;   // .mfx엔 CSS 애니메이션 transform이 걸려 SVG transform 속성이 덮이므로 안쪽 g에 둠
export const WEAR = {
  'r:fxcrown': { id: 'crown', g: crownG, vb: '33.4 -1.6 33.2 25' },
  'r:fxkey': { id: 'key', g: keyG, vb: '33.2 -0.6 32.2 23.4' },
};
export const SPOTS = [['auto', '자동'], ['mascot', '캐릭터 머리'], ['clock', '큰 시계'], ['logo', '로고']];
export const wearOf = v => WEAR[v] || null;

// 단독 그림(시계·로고·프로필·미리보기): 바탕에 묻히지 않게 흰 스티커 테두리(halo)를 깔아 둠
export const wearSvg = (v, cls = '') => { const w = wearOf(v); return w ? `<svg class="wear ${cls}" viewBox="${w.vb}" aria-hidden="true">${w.g(true)}</svg>` : ''; };
// 마스코트(인라인 SVG) 안에 넣는 조각: 머리(.mh)에 넣어 고개 짓·떨어지기 애니메이션을 같이 탐
export const wearG = v => wearOf(v)?.g(false) || '';

/* ----- 어디에 씌울지 ----- */
export const spotPref = () => { const v = store.get('wear_at', 'auto'); return SPOTS.some(s => s[0] === v) ? v : 'auto'; };
export const setSpotPref = v => { store.set('wear_at', v); document.dispatchEvent(new Event('sg:mfx')); };
// 실제로 씌울 곳: 캐릭터 머리를 골랐는데 캐릭터가 없으면 시계로(소품이 사라지지 않게)
export const resolveSpot = (pref, hasChar) => pref === 'auto' || (pref === 'mascot' && !hasChar) ? (hasChar ? 'mascot' : 'clock') : pref;

/* ----- '그림 넣기'로 넣은 내 캐릭터: 머리 위치 ----- */
// 그림마다 머리 자리가 다르므로 그림의 투명하지 않은 영역 맨 위 띠의 가운데를 자동으로 잡음.
// 결과는 상자(정사각형, 그림은 contain + 왼쪽 아래 정렬 = .mascot img) 기준 비율 {x, y}.
const sigOf = art => art ? art.length + ':' + art.slice(-32) : '';
const autoCache = new Map();
export function autoAnchor(art) {
  const sig = sigOf(art);
  if (autoCache.has(sig)) return Promise.resolve(autoCache.get(sig));
  return new Promise(ok => {
    const im = new Image();
    im.onload = () => {
      let r = { x: .5, y: .08 };
      try {
        const k = Math.min(1, 96 / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data, on = (x, y) => d[(y * w + x) * 4 + 3] > 60;
        let top = -1, bot = -1;
        for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (on(x, y)) { top = y; break; }
        for (let y = h - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < w; x++) if (on(x, y)) { bot = y; break; }
        if (top >= 0) {
          // 맨 위에서 몸 높이의 12%까지(귀·머리카락 끝 포함한 정수리 띠)의 불투명 칸 가로 가운데
          const band = Math.max(1, Math.round((bot - top + 1) * .12));
          let sx = 0, n = 0;
          for (let y = top; y < Math.min(h, top + band); y++) for (let x = 0; x < w; x++) if (on(x, y)) { sx += x; n++; }
          const cx = n ? sx / n + .5 : w / 2, s = 1 / Math.max(w, h), dh = h * s;
          r = { x: cx * s, y: 1 - dh + top * s };
        }
      } catch {}
      autoCache.set(sig, r); ok(r);
    };
    im.onerror = () => ok({ x: .5, y: .08 });
    im.src = art;
  });
}
// 손으로 맞춘 위치(드래그): 그림이 바뀌면 자동으로 무효
export const adjOf = art => { const a = store.get('wear_adj', null); return a && a.sig === sigOf(art) && isFinite(a.x) && isFinite(a.y) ? a : null; };
export const setAdj = (art, p) => { store.set('wear_adj', p ? { sig: sigOf(art), x: +p.x.toFixed(4), y: +p.y.toFixed(4) } : null); document.dispatchEvent(new Event('sg:mfx')); };
export const anchorOf = async art => adjOf(art) || autoAnchor(art);
