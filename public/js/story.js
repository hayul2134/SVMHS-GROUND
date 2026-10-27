// SVMHS GROUND — 랭킹 스토리 이미지 (2026-10-26 하율: 학생이 랭킹을 캡처해 인스타 스토리에 올리면 글자·화면이 뭉개져 보임)
// 화면 캡처 대신 1080×1920(스토리 규격)으로 처음부터 또렷하게 그려서 공유·저장.
// 랭킹 창(#rankList)에 이미 그려진 줄을 그대로 읽음 → 사이트 화면과 같은 이름·반·기록·아바타·트로피.
// 아바타: 캐릭터(.kav)는 CSS --art 그림, 직접 그린 그림(svg <use>)은 쓰인 스프라이트만 모아 독립 SVG로, 개발자는 로고 그림.
const W = 1080, H = 1920, INK = '#173048', SUB = '#5a6f86';
const css = (el, p) => getComputedStyle(el).getPropertyValue(p).trim();
const urlOf = v => { const m = /url\(["']?(.*?)["']?\)\s*$/.exec(v || ''); return m ? m[1] : ''; };
const load = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// <use href="#..">가 가리키는 스프라이트(그 안의 url(#..) 그라데이션까지)를 모아 따로 열 수 있는 SVG로
function svgSrc(svg) {
  const ids = new Set(), q = [];
  const scan = el => {
    el.querySelectorAll?.('use').forEach(u => { const h = (u.getAttribute('href') || u.getAttribute('xlink:href') || '').slice(1); if (h) q.push(h); });
    (el.outerHTML.match(/url\(#([^)]+)\)/g) || []).forEach(m => q.push(m.slice(5, -1)));
  };
  const own = svg.cloneNode(true);
  // 화면에서 숨겨 둔 겹(흰 테두리 등)은 빼고 보이는 그대로만
  [...svg.querySelectorAll('use')].forEach((u, i) => { if (getComputedStyle(u).display === 'none') own.querySelectorAll('use')[i].setAttribute('data-x', '1'); });
  own.querySelectorAll('[data-x]').forEach(n => n.remove());
  scan(own);
  const defs = [];
  while (q.length) { const id = q.shift(); if (ids.has(id)) continue; ids.add(id); const n = document.getElementById(id); if (!n) continue; defs.push(n.outerHTML); scan(n); }
  const r = svg.getBoundingClientRect(), vb = svg.getAttribute('viewBox');
  own.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); own.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  own.setAttribute('width', Math.round(r.width) || 24); own.setAttribute('height', Math.round(r.height) || 24);
  if (!vb) own.setAttribute('viewBox', `0 0 ${Math.round(r.width) || 24} ${Math.round(r.height) || 24}`);
  own.removeAttribute('class');
  own.insertAdjacentHTML('afterbegin', `<defs>${defs.join('')}</defs>`);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(own.outerHTML);
}

async function avatarOf(av) {
  if (!av) return null;
  const out = { bg: css(av, 'background-color') || '#6fc6f4', pc: css(av, '--pc'), img: null, mode: 'fit' };
  const kav = av.querySelector('.kav'), img = av.querySelector('img'), svg = av.querySelector('svg');
  if (kav) { out.img = await load(urlOf(css(kav, '--art'))); out.mode = 'kav'; }
  else if (img) out.img = await load(img.src);
  else if (svg) out.img = await load(svgSrc(svg));
  else out.txt = av.textContent.trim();
  return out;
}

async function rowsOf(list) {
  const lis = [...list.querySelectorAll(':scope > li')].filter(li => !li.classList.contains('skel') && !li.classList.contains('skz') && !li.classList.contains('empty'));
  return Promise.all(lis.slice(0, 6).map(async li => {
    const mdl = li.querySelector('.rk .mdl'), pi = li.querySelector('.pi');
    const nameEl = pi?.querySelector('b');
    let name = '';
    if (nameEl) { const c = nameEl.cloneNode(true); c.querySelectorAll('.devb,.rep,svg,i').forEach(n => n.remove()); name = c.textContent.trim(); }
    return {
      me: li.classList.contains('me'),
      rank: (li.querySelector('.rk')?.textContent || '').trim(),
      medal: mdl ? { img: await load(urlOf(getComputedStyle(mdl).backgroundImage)), n: mdl.textContent.trim(), color: getComputedStyle(mdl).color } : null,
      av: await avatarOf(li.querySelector('.av')),
      dev: !!nameEl?.querySelector('.devb'),
      name, sub: (pi?.querySelector('small')?.textContent || '').trim(),
      val: (li.querySelector('.rv')?.textContent || '').trim(),
    };
  }));
}

const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
function fit(c, t, max) { if (c.measureText(t).width <= max) return t; while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
function sparkle(c, x, y, r, col) { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * .18, y - r * .18, x + r, y); c.quadraticCurveTo(x + r * .18, y + r * .18, x, y + r); c.quadraticCurveTo(x - r * .18, y + r * .18, x - r, y); c.quadraticCurveTo(x - r * .18, y - r * .18, x, y - r); c.closePath(); c.fillStyle = col; c.fill(); }

// title: '1 to 25 랭킹', scope: '역대' 등, note: 아래 한 줄(내 순위 등)
export async function rankStory(list, { title, scope = '', note = '' }) {
  try { await document.fonts.ready; } catch {}
  const DISP = css(document.documentElement, '--disp') || 'sans-serif', NUM = css(document.documentElement, '--num') || 'sans-serif', BODY = getComputedStyle(document.body).fontFamily;
  const rows = await rowsOf(list);
  const logo = await load('/logo-mark.svg?v=4');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  // 배경: 사이트 파란색 + 작은 반짝이
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5aa9ef'); g.addColorStop(1, '#2a6fc4');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalAlpha = .08; c.fillStyle = '#fff';
  for (let y = 40; y < H; y += 64) for (let x = (y / 64 % 2) * 32 + 16; x < W; x += 64) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
  c.globalAlpha = 1;

  // 카드 크기 (스토리 위·아래 가림 영역 피해 가운데로)
  const RH = 132, GAP = 14, CW = 900, CX = (W - CW) / 2, HEAD = 190, PAD = 40;
  const CH = HEAD + rows.length * RH + Math.max(0, rows.length - 1) * GAP + PAD + (note ? 70 : 0);
  const top = Math.max(360, (H - CH) / 2 + 40), CY = top;

  // 로고 줄
  const ly = CY - 150;
  c.fillStyle = '#fff'; c.font = `400 64px ${DISP}`; c.textBaseline = 'middle'; c.textAlign = 'left';
  const lw = (logo ? 122 : 0) + c.measureText('SVMHS GROUND').width, lx = (W - lw) / 2;   // 로고+글자 묶음을 가운데로
  if (logo) c.drawImage(logo, lx, ly - 10, 104, 104);
  c.shadowColor = 'rgba(10,40,110,.35)'; c.shadowOffsetY = 4;
  c.fillText('SVMHS GROUND', lx + (logo ? 122 : 0), ly + 44);
  c.shadowColor = 'transparent'; c.shadowOffsetY = 0;
  sparkle(c, CX + 40, CY - 40, 22, '#fff6c8'); sparkle(c, CX + CW - 30, ly + 10, 16, '#fff6c8'); sparkle(c, CX + CW - 80, CY + CH + 90, 26, '#fff6c8');

  // 카드: 스티커처럼 진한 테두리 + 오른쪽 아래 그림자
  rr(c, CX + 16, CY + 16, CW, CH, 52); c.fillStyle = INK; c.fill();
  rr(c, CX, CY, CW, CH, 52); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 6; c.strokeStyle = INK; c.stroke();

  // 머리: 제목 + 범위 칩
  c.fillStyle = INK; c.font = `400 66px ${DISP}`; c.textAlign = 'left';
  const tt = fit(c, title, CW - 300);
  c.fillText(tt, CX + 56, CY + 96);
  if (scope) {
    c.font = `800 38px ${BODY}`;
    const sw = c.measureText(scope).width + 56, sx = CX + CW - 56 - sw;
    rr(c, sx, CY + 66, sw, 64, 32); c.fillStyle = '#ffe08a'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    c.fillStyle = INK; c.textAlign = 'center'; c.fillText(scope, sx + sw / 2, CY + 99);
  }

  // 줄
  let y = CY + HEAD - 20;
  for (const r of rows) {
    const x = CX + 28, w = CW - 56;
    if (r.me) { rr(c, x, y, w, RH, 30); c.fillStyle = '#fff1c2'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#c98a00'; c.stroke(); }
    const mid = y + RH / 2;
    // 순위
    if (r.medal?.img) {
      c.drawImage(r.medal.img, x + 20, mid - 42, 80, 80);
      // 숫자는 트로피 그림 안에 들어 있음(2026-10-26)
    } else { c.fillStyle = SUB; c.font = `900 46px ${NUM}`; c.textAlign = 'center'; c.fillText(r.rank, x + 60, mid + 2); }
    // 아바타
    let tx = x + 128;
    if (r.av) {
      const d = 92, ax = tx, ay = mid - d / 2;
      c.save(); c.beginPath(); c.arc(ax + d / 2, mid, d / 2, 0, 7); c.fillStyle = r.av.pc || r.av.bg; c.fill(); c.clip();
      if (r.av.img) {
        if (r.av.mode === 'kav') c.drawImage(r.av.img, ax - d * .125, ay + d * .05, d * 1.25, d * 1.25);
        else { const s = d * .82; c.drawImage(r.av.img, ax + (d - s) / 2, ay + (d - s) / 2, s, s); }
      } else if (r.av.txt) { c.font = `48px ${BODY}`; c.textAlign = 'center'; c.fillStyle = INK; c.fillText(r.av.txt, ax + d / 2, mid + 2); }
      c.restore();
      c.beginPath(); c.arc(ax + d / 2, mid, d / 2, 0, 7); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
      tx += d + 26;
    }
    // 기록
    c.font = `900 48px ${NUM}`; c.textAlign = 'right'; c.fillStyle = INK;
    const vw = c.measureText(r.val).width; c.fillText(r.val, x + w - 26, mid + 2);
    // 이름·반
    const nmax = x + w - 26 - vw - 30 - tx;
    c.textAlign = 'left'; c.fillStyle = r.me ? '#5c4100' : INK; c.font = `900 44px ${BODY}`;
    const nm = fit(c, r.name, nmax - (r.dev ? 130 : 0));
    c.fillText(nm, tx, r.sub ? mid - 22 : mid + 2);
    if (r.dev) { const bx = tx + c.measureText(nm).width + 14; c.font = `800 26px ${BODY}`; const bw = c.measureText('개발자').width + 24; rr(c, bx, mid - 44, bw, 42, 21); c.fillStyle = INK; c.fill(); c.fillStyle = '#fff'; c.fillText('개발자', bx + 12, mid - 22); }
    if (r.sub) { c.font = `700 32px ${BODY}`; c.fillStyle = SUB; c.fillText(fit(c, r.sub, nmax), tx, mid + 30); }
    y += RH + GAP;
  }
  if (note) { c.font = `800 34px ${BODY}`; c.fillStyle = SUB; c.textAlign = 'center'; c.fillText(fit(c, note, CW - 100), W / 2, CY + CH - 56); }

  // 아래 주소
  c.fillStyle = 'rgba(255,255,255,.92)'; c.font = `800 38px ${BODY}`; c.textAlign = 'center';
  c.fillText('svmhs-ground.pages.dev', W / 2, Math.min(H - 300, CY + CH + 110));
  return new Promise(res => cv.toBlob(res, 'image/png'));
}

// 공유 창(폰·태블릿) → 안 되면 파일로 저장
export async function shareBlob(blob, name = 'svmhs-ground.png') {
  const f = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [f] })) {
    try { await navigator.share({ files: [f] }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  }
  const u = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });   // data: 주소(CSP img-src에 blob: 없음)
  const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return 'saved';
}
