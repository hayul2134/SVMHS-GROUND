// SVMHS GROUND — 체육 창고 정리!(2026-11-02 하율: "수박 게임 방식, 체육 창고 정리!로 — 내 화면에만", 미리보기 깃발 ball-game)
// 같은 공 두 개가 닿으면 다음 공으로 합쳐짐. 공이 위쪽 선 위에 1.5초 머물면 끝. 지금은 시험판 — 서버·랭킹 없이 이 기기 최고 기록만(sg_ball_best).
// 물리는 직접 구현(고정 스텝 1/120초, 원끼리만, 삼각함수 없음) → 나중에 '오늘의 판'·서버 검사에서 기기마다 같은 결과가 나오게.
// createBall(el, O) → { start, destroy }
import { store } from './util.js';
import { makeSfx, sndBtnHtml, bindSnd } from './sfx.js';

// 공 10단계: [이름, 반지름(상자 너비 400 기준), 합쳐서 이 공이 될 때 점수]
export const BALLS = [
  ['구슬', 14, 0], ['탁구공', 20, 1], ['골프공', 27, 3], ['테니스공', 35, 6], ['야구공', 44, 10],
  ['핸드볼', 54, 15], ['배구공', 65, 21], ['축구공', 77, 28], ['농구공', 90, 36], ['짐볼', 104, 45],
];
const VANISH = 100;            // 짐볼 두 개가 만나면 둘 다 사라지고 받는 점수
const W = 440, H = 708;        // 캔버스 논리 크기
const L = 20, R = 420, FLOOR = 650, LINE = 112, DROP_Y = 62;
const G = 1500, DT = 1 / 120, ITER = 7, OVER_T = 1.5, COOL = 0.5;
const INK = '#2a2846';

export function createBall(el, O = {}) {
  el.innerHTML = `<div class="bl"><div class="bl-wrap"><canvas class="bl-cv"></canvas><div class="bl-ov" hidden></div></div>
    <div class="bl-bar"><span class="bl-help">끌어서 위치 · 떼면 떨어뜨리기 · 키보드 ←→ / Space</span>${sndBtnHtml('blSnd')}</div></div>`;
  const cv = el.querySelector('.bl-cv'), ctx = cv.getContext('2d'), ov = el.querySelector('.bl-ov');
  const S = makeSfx('sg_ball_snd'); bindSnd(el.querySelector('#blSnd'), S);
  let best = +store.get('ball_best', 0) || 0;
  let balls, score, cur, next, dropX, cool, over, paused, maxLv, alive = true, raf = 0, last = 0, acc = 0, keyDir = 0, dirty = true, seq = 0;
  let scale = 1, dpr = 1;
  const sprites = new Map();

  // ── 공 그림(한 번 그려서 캐시, 회전만 해서 붙임) ──
  function sprite(lv) {
    const key = lv + ':' + scale + ':' + dpr; if (sprites.has(key)) return sprites.get(key);
    const r = BALLS[lv][1], pad = 5, s = scale * dpr, n = Math.ceil((r + pad) * 2 * s);
    const c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'); g.scale(s, s); g.translate(r + pad, r + pad);
    // 스티커 칼선(흰 테) → 잉크 외곽
    g.beginPath(); g.arc(0, 0, r + 2.6, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, 7); g.clip();
    paint(g, lv, r);
    // 윗면 빛·아래 그늘(통통한 느낌)
    const sh = g.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.05);
    sh.addColorStop(0, 'rgba(255,255,255,.45)'); sh.addColorStop(.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(20,20,60,.22)');
    g.fillStyle = sh; g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
    g.beginPath(); g.arc(0, 0, r, 0, 7); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
    const out = { c, half: (r + pad) }; sprites.set(key, out); return out;
  }
  function paint(g, lv, r) {
    const fill = c => { g.fillStyle = c; g.fillRect(-r, -r, r * 2, r * 2); };
    const line = (w, c) => { g.lineWidth = w; g.strokeStyle = c; g.lineCap = 'round'; };
    if (lv === 0) {          // 구슬: 유리 + 소용돌이 무늬
      fill('#8fd3ff'); line(r * .32, '#3d7bff'); g.beginPath(); g.moveTo(-r * .7, r * .3); g.bezierCurveTo(-r * .2, -r * .6, r * .3, r * .7, r * .8, -r * .2); g.stroke();
      line(r * .16, '#ff7aa8'); g.beginPath(); g.moveTo(-r * .5, -r * .6); g.bezierCurveTo(0, -r * .1, r * .1, r * .3, r * .3, r * .8); g.stroke();
    } else if (lv === 1) {   // 탁구공: 주황 + 로고 줄
      fill('#ffad4a'); line(1.6, 'rgba(120,50,0,.45)'); g.beginPath(); g.ellipse(0, 0, r * .55, r * .22, -.4, 0, 7); g.stroke();
    } else if (lv === 2) {   // 골프공: 흰색 + 딤플
      fill('#ffffff'); g.fillStyle = '#c9d3e6';
      for (let y = -r; y <= r; y += r * .3) for (let x = -r + ((y / (r * .3)) & 1 ? r * .15 : 0); x <= r; x += r * .3) { g.beginPath(); g.arc(x, y, r * .075, 0, 7); g.fill(); }
    } else if (lv === 3) {   // 테니스공: 연두 + 흰 곡선 2줄
      fill('#d7ef3c'); line(r * .14, '#fffbe6');
      g.beginPath(); g.moveTo(-r * .95, -r * .5); g.bezierCurveTo(-r * .2, -r * .3, -r * .2, r * .3, -r * .95, r * .5); g.stroke();
      g.beginPath(); g.moveTo(r * .95, -r * .5); g.bezierCurveTo(r * .2, -r * .3, r * .2, r * .3, r * .95, r * .5); g.stroke();
    } else if (lv === 4) {   // 야구공: 크림 + 빨간 실밥
      fill('#fff3dc'); line(r * .06, '#e0463c');
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(sx * r * .55, -r * .95); g.bezierCurveTo(sx * r * .1, -r * .3, sx * r * .1, r * .3, sx * r * .55, r * .95); g.stroke();
        for (let t = -0.75; t <= 0.76; t += 0.25) { const y = t * r, x = sx * (r * .2 + Math.abs(t) * Math.abs(t) * r * .38); g.beginPath(); g.moveTo(x - r * .1, y - r * .04); g.lineTo(x + r * .1, y + r * .04); g.stroke(); }
      }
    } else if (lv === 5) {   // 핸드볼: 빨강 + 흰·남색 띠
      fill('#ff6262'); line(r * .2, '#ffffff'); g.beginPath(); g.arc(-r * .9, r * .9, r * 1.3, -1.6, 0); g.stroke();
      line(r * .12, '#2f4fd8'); g.beginPath(); g.arc(-r * .9, r * .9, r * .95, -1.6, 0); g.stroke();
      line(r * .12, '#ffffff'); g.beginPath(); g.arc(r * 1.1, -r * 1.1, r * .9, 1.4, 3.3); g.stroke();
    } else if (lv === 6) {   // 배구공: 노랑·파랑 곡선 패널
      fill('#ffd84d'); g.fillStyle = '#3d7bff';
      g.beginPath(); g.moveTo(-r, -r * .25); g.bezierCurveTo(-r * .2, -r * .6, r * .4, -r * .2, r, -r * .7); g.lineTo(r, -r * .2); g.bezierCurveTo(r * .4, r * .2, -r * .2, -r * .1, -r, r * .2); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-r * .6, r); g.bezierCurveTo(-r * .3, r * .3, r * .2, r * .5, r * .5, r); g.closePath(); g.fill();
      line(1.6, INK); g.beginPath(); g.moveTo(-r, -r * .25); g.bezierCurveTo(-r * .2, -r * .6, r * .4, -r * .2, r, -r * .7); g.moveTo(-r, r * .2); g.bezierCurveTo(-r * .2, -r * .1, r * .4, r * .2, r, -r * .2); g.stroke();
    } else if (lv === 7) {   // 축구공: 흰색 + 검은 오각형
      fill('#ffffff');
      const pent = (cx, cy, s) => { g.beginPath(); const P = [[0, -1], [.951, -.309], [.588, .809], [-.588, .809], [-.951, -.309]]; P.forEach(([x, y], i) => i ? g.lineTo(cx + x * s, cy + y * s) : g.moveTo(cx + x * s, cy + y * s)); g.closePath(); g.fill(); };
      g.fillStyle = '#2a2846'; pent(0, 0, r * .3);
      const O5 = [[0, -1], [.951, -.309], [.588, .809], [-.588, .809], [-.951, -.309]];
      for (const [x, y] of O5) pent(x * r * .82, y * r * .82, r * .26);
      line(1.4, '#2a2846'); for (const [x, y] of O5) { g.beginPath(); g.moveTo(x * r * .3, y * r * .3); g.lineTo(x * r * .6, y * r * .6); g.stroke(); }
    } else if (lv === 8) {   // 농구공: 주황 + 검은 솔기
      fill('#ff8a3d'); line(r * .055, '#3a2416');
      g.beginPath(); g.moveTo(0, -r); g.lineTo(0, r); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
      g.beginPath(); g.arc(-r * 1.25, 0, r * .95, -1.1, 1.1); g.stroke(); g.beginPath(); g.arc(r * 1.25, 0, r * .95, 2.04, 4.24); g.stroke();
    } else {                 // 짐볼: 보라 + 반짝 띠
      fill('#b07cff'); line(r * .05, 'rgba(255,255,255,.55)'); g.beginPath(); g.ellipse(0, 0, r * .98, r * .35, 0, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-r * .35, -r * .5, r * .22, r * .1, -.5, 0, 7); g.fill();
    }
  }

  // ── 크기 맞추기: 화면에 남은 높이 안에 통째로 ──
  function fit() {
    const wrap = el.querySelector('.bl-wrap'); if (!wrap) return;
    const top = wrap.getBoundingClientRect().top, bar = el.querySelector('.bl-bar')?.offsetHeight || 0;
    const avH = Math.max(320, innerHeight - top - bar - 90), avW = Math.max(240, el.clientWidth || 360);
    const ns = Math.min(avW / W, avH / H, 1.6), nd = Math.min(2, devicePixelRatio || 1);
    if (Math.abs(ns - scale) < .001 && nd === dpr && cv.width) return;
    scale = ns; dpr = nd; sprites.clear();
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
    cv.style.width = Math.round(W * scale) + 'px'; cv.style.height = Math.round(H * scale) + 'px';
    dirty = true;
  }

  // ── 판 ──
  const pick = () => { const r = Math.random(); return r < .26 ? 0 : r < .5 ? 1 : r < .72 ? 2 : r < .88 ? 3 : 4; };   // 작은 공이 조금 더 자주
  function reset() {
    balls = []; score = 0; cur = pick(); next = pick(); dropX = (L + R) / 2; cool = 0; over = false; paused = false; maxLv = 0; acc = 0; last = 0;
    ov.hidden = true; dirty = true;
  }
  const clampX = x => { const r = BALLS[cur][1]; return Math.max(L + r, Math.min(R - r, x)); };
  function drop() {
    if (over || paused || cool > 0) return;
    const r = BALLS[cur][1];
    balls.push({ x: clampX(dropX) + ((seq * 37) % 9 - 4) * .03, y: DROP_Y,   // 같은 자리에 계속 놓아도 탑처럼 서지 않게 아주 작은 어긋남(씨앗 없이 순서로만 정해짐)
      vx: 0, vy: 0, lv: cur, r, R: r, a: 0, age: 0, top: 0, grow: 1, id: ++seq });
    S.tone(520, .05, 'triangle', .04);
    cur = next; next = pick(); cool = COOL; dirty = true;
  }
  function step() {
    for (const b of balls) {
      b.age += DT; if (b.grow < 1) { b.grow = Math.min(1, b.grow + DT * 9); b.r = b.R * (.55 + .45 * b.grow); }
      b.vy += G * DT; b.vx *= .9985; b.x += b.vx * DT; b.y += b.vy * DT;
    }
    const merges = [];
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= (rr + .6) * (rr + .6)) continue;
          if (a.lv === b.lv && !a.dead && !b.dead && a.grow === 1 && b.grow === 1) { a.dead = b.dead = true; merges.push([a, b]); continue; }
          if (a.dead || b.dead || d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || .001, nx = dx / d, ny = dy / d, ov2 = rr - d;
          const ma = a.R * a.R, mb = b.R * b.R, ia = mb / (ma + mb), ib = ma / (ma + mb);
          a.x -= nx * ov2 * ia; a.y -= ny * ov2 * ia; b.x += nx * ov2 * ib; b.y += ny * ov2 * ib;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vn < 0) { const jn = -(1.12) * vn; a.vx -= nx * jn * ia; a.vy -= ny * jn * ia; b.vx += nx * jn * ib; b.vy += ny * jn * ib;
            const tx = -ny, ty = nx, vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty, f = vt * .04; a.vx += tx * f * ia; a.vy += ty * f * ia; b.vx -= tx * f * ib; b.vy -= ty * f * ib; }
        }
      }
      for (const b of balls) {
        if (b.x - b.r < L) { b.x = L + b.r; if (b.vx < 0) b.vx *= -.2; }
        if (b.x + b.r > R) { b.x = R - b.r; if (b.vx > 0) b.vx *= -.2; }
        if (b.y + b.r > FLOOR) { b.y = FLOOR - b.r; if (b.vy > 0) b.vy *= -.12; b.vx *= .985; }
      }
    }
    if (merges.length) {
      for (const [a, b] of merges) {
        const lv = a.lv + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        if (lv >= BALLS.length) { score += VANISH; burst(x, y, 9, 24); S.tone(880, .25, 'triangle', .06); S.tone(1320, .3, 'triangle', .05, .08); continue; }
        const R2 = BALLS[lv][1];
        balls.push({ x: Math.max(L + R2, Math.min(R - R2, x)), y: Math.min(FLOOR - R2, y), vx: (a.vx + b.vx) / 2, vy: Math.min(0, (a.vy + b.vy) / 2), lv, r: R2 * .55, R: R2, a: (a.a + b.a) / 2, age: .4, top: 0, grow: 0, id: ++seq });
        score += BALLS[lv][2]; if (lv > maxLv) maxLv = lv;
        burst(x, y, lv, 8 + lv); S.tone(700 - lv * 45, .09, 'sine', .07, 0, 980 - lv * 50);
        if (lv === BALLS.length - 1) pop('짐볼 완성!');
      }
      balls = balls.filter(b => !b.dead);
    }
    for (const b of balls) b.a += (b.vx / Math.max(6, b.r)) * DT;
    // 끝 판정: 떨어진 지 1초 지난 공이 선 위에 1.5초 이상
    let warn = 0;
    for (const b of balls) {
      if (b.age > 1 && b.y - b.r < LINE) { b.top += DT; warn = Math.max(warn, b.top); if (b.top > OVER_T) { gameOver(); return; } } else b.top = 0;
    }
    lineWarn = warn;
  }
  let lineWarn = 0, fx = [], msg = null;
  function burst(x, y, lv, n) { for (let i = 0; i < n; i++) { const t = i / n * 6.283, sp = 90 + (i * 37 % 60) + lv * 12; fx.push({ x, y, vx: sp * dirX(t), vy: sp * dirY(t) - 60, life: .45, c: ['#ffd25e', '#8fd3ff', '#ffffff', '#ff8aa8'][i % 4] }); } }
  const dirX = t => Math.cos(t), dirY = t => Math.sin(t);   // 화면 효과 전용(물리에는 안 씀)
  function pop(text) { msg = { text, t: 1.4 }; }
  function gameOver() {
    over = true; dirty = true;
    const nb = score > best; if (nb) { best = score; store.set('ball_best', best); }
    S.tone(300, .3, 'sawtooth', .04, 0, 120);
    ov.innerHTML = `<div class="bl-card"><b class="bl-t">창고가 꽉 찼어요!</b><p class="bl-sc">${score.toLocaleString()}점</p>
      <p class="bl-sub">${nb ? '<em>내 최고 기록 경신!</em>' : `내 최고 ${best.toLocaleString()}점`} · 가장 큰 공 ${BALLS[maxLv][0]}</p>
      <button type="button" class="btn big" data-bl-again>다시 하기</button><p class="bl-note">시험판 · 기록은 이 기기에만 저장돼요</p></div>`;
    ov.hidden = false;
  }
  function pause(on) {
    if (over || paused === on) return; paused = on; dirty = true;
    ov.innerHTML = on ? '<div class="bl-card"><b class="bl-t">잠깐 멈춤</b><button type="button" class="btn big" data-bl-go>계속하기</button></div>' : '';
    ov.hidden = !on; if (!on) last = 0;
  }

  // ── 그리기 ──
  function draw() {
    const s = scale * dpr; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.clearRect(0, 0, W, H);
    // 창고 안 벽(나무 판자)
    ctx.fillStyle = '#eef5ff'; ctx.fillRect(L, LINE - 26, R - L, FLOOR - LINE + 26);
    ctx.strokeStyle = 'rgba(61,123,255,.08)'; ctx.lineWidth = 1;
    for (let x = L + 40; x < R; x += 40) { ctx.beginPath(); ctx.moveTo(x, LINE - 26); ctx.lineTo(x, FLOOR); ctx.stroke(); }
    // 위쪽 선
    const blink = lineWarn > 0 && (performance.now() / 160 | 0) % 2;
    ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.strokeStyle = lineWarn > 0 ? (blink ? '#ff4d4d' : 'rgba(255,77,77,.4)') : 'rgba(42,40,70,.25)';
    ctx.beginPath(); ctx.moveTo(L, LINE); ctx.lineTo(R, LINE); ctx.stroke(); ctx.setLineDash([]);
    // 공
    for (const b of balls) {
      const sp = sprite(b.lv), k = b.r / b.R;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.scale(k, k);
      ctx.drawImage(sp.c, -sp.half, -sp.half, sp.half * 2, sp.half * 2); ctx.restore();
    }
    // 효과
    for (const p of fx) { ctx.globalAlpha = Math.max(0, p.life / .45); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // 상자 테두리(벽·바닥)
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(L - 5, LINE - 26); ctx.lineTo(L - 5, FLOOR + 5); ctx.lineTo(R + 5, FLOOR + 5); ctx.lineTo(R + 5, LINE - 26); ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = '#c98a4b';
    ctx.beginPath(); ctx.moveTo(L - 5, LINE - 26); ctx.lineTo(L - 5, FLOOR + 5); ctx.lineTo(R + 5, FLOOR + 5); ctx.lineTo(R + 5, LINE - 26); ctx.stroke();
    // 위 줄: 점수 · 다음 공
    ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillText('점수', L, 22);
    ctx.font = '400 30px Jua, Pretendard, sans-serif'; ctx.fillText(score.toLocaleString(), L, 52);
    ctx.font = '600 12px Pretendard, sans-serif'; ctx.fillStyle = '#7a7a99'; ctx.fillText('최고 ' + best.toLocaleString(), L, 70);
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillText('다음', R, 22); ctx.textAlign = 'left';
    { const sp = sprite(next), k = 22 / BALLS[next][1], cx = R - 26, cy = 50; ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.drawImage(sp.c, -sp.half, -sp.half, sp.half * 2, sp.half * 2); ctx.restore(); }
    // 떨어뜨릴 공 + 안내선
    if (!over) {
      const x = clampX(dropX), r = BALLS[cur][1];
      ctx.strokeStyle = 'rgba(42,40,70,.18)'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(x, DROP_Y + r); ctx.lineTo(x, FLOOR); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = cool > 0 ? .45 : 1;
      const sp = sprite(cur); ctx.drawImage(sp.c, x - sp.half, DROP_Y - sp.half, sp.half * 2, sp.half * 2); ctx.globalAlpha = 1;
    }
    // 아래: 공 진화 순서
    const y0 = FLOOR + 32, gap = (R - L) / BALLS.length;
    BALLS.forEach((bb, i) => {
      const sp = sprite(i), k = Math.min(1, (7 + i * 1.1) / bb[1]), cx = L + gap * (i + .5);
      ctx.globalAlpha = i <= Math.max(4, maxLv) ? 1 : .3;
      ctx.save(); ctx.translate(cx, y0); ctx.scale(k, k); ctx.drawImage(sp.c, -sp.half, -sp.half, sp.half * 2, sp.half * 2); ctx.restore();
    });
    ctx.globalAlpha = 1;
    // 가운데 글자(짐볼 완성 등)
    if (msg) { ctx.globalAlpha = Math.min(1, msg.t / .4); ctx.textAlign = 'center'; ctx.font = '400 34px Jua, Pretendard, sans-serif';
      ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.strokeText(msg.text, W / 2, 300); ctx.fillStyle = '#7a4bff'; ctx.fillText(msg.text, W / 2, 300); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
  }

  function frame(t) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    fit();
    const dt = last ? Math.min(.1, (t - last) / 1000) : 0; last = t;
    if (!over && !paused) {
      if (keyDir) dropX = clampX(dropX + keyDir * 320 * dt);
      if (cool > 0) cool -= dt;
      acc += dt; let n = 0;
      while (acc >= DT && n < 12) { step(); acc -= DT; n++; if (over) break; }
      if (n === 12) acc = 0;
    }
    for (const p of fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
    fx = fx.filter(p => p.life > 0); if (msg && (msg.t -= dt) <= 0) msg = null;
    if (!paused || dirty) { draw(); dirty = false; }
  }

  // ── 입력 ──
  const toX = e => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; };
  let down = false;
  const pd = e => { if (over || paused) return; down = true; dropX = clampX(toX(e)); cv.setPointerCapture?.(e.pointerId); e.preventDefault(); };
  const pm = e => { if (over || paused) return; if (down || e.pointerType === 'mouse') dropX = clampX(toX(e)); };
  const pu = e => { if (!down) return; down = false; dropX = clampX(toX(e)); drop(); };
  cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pm); cv.addEventListener('pointerup', pu);
  cv.addEventListener('pointercancel', () => { down = false; });
  const typing = e => e.target.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('.modal.open');
  const kd = e => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (paused) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); pause(false); } return; }
    if (over) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); reset(); } return; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keyDir = -1; e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keyDir = 1; e.preventDefault(); }
    else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS')) { e.preventDefault(); drop(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') pause(true);
  };
  const ku = e => { if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && keyDir < 0) keyDir = 0; if ((e.code === 'ArrowRight' || e.code === 'KeyD') && keyDir > 0) keyDir = 0; };
  const vis = () => { if (document.hidden) pause(true); };
  const blur = () => pause(true);
  ov.addEventListener('click', e => { if (e.target.closest('[data-bl-again]')) reset(); else if (e.target.closest('[data-bl-go]')) pause(false); });
  addEventListener('keydown', kd); addEventListener('keyup', ku); document.addEventListener('visibilitychange', vis); addEventListener('blur', blur);

  reset();
  return {
    start() { fit(); raf = requestAnimationFrame(frame); },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); document.removeEventListener('visibilitychange', vis); removeEventListener('blur', blur);
    },
    get state() { return { score, balls: balls.length, over }; },   // 검사용
  };
}
