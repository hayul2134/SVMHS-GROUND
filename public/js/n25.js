// SVMHS GROUND — 1 to 25 2 (2026-10-28 하율 "1 to 25 게임 디벨롭 진행해", 미리보기 깃발 n25-v2 — 개발자 화면 먼저)
// 규칙·점수는 1판과 똑같이 유지(랭킹·티어·미션·서버 검사 그대로): 5×5 무작위 · 1을 누른 순간부터 25를 누를 때까지 · 틀리면 +1초.
//   서버로 보내는 판 기록도 그대로: [25번 누른 시각(첫 탭 0) …, 벌점 합]
// 바뀐 것: 시작 안내(1 칸 반짝) · 진행 막대 + 내 최고 기록 유령(이 기기) · 5칸마다 구간 기록과 최고 대비 ±초 · 틀리면 칸 흔들림 + '+1초'·진동 ·
//          빠르게 이어 누르면 '착착' 연속 표시 · 효과음(기본 꺼짐, 숫자마다 음이 올라감) · 끝나면 칸이 차례로 튐 ·
//          결과: 등급·칭호 · '어디서 헤맸나' 판 지도(숫자마다 찾는 데 걸린 시간 색칠, 틀린 칸 표시) · 구간 5개 기록

export const N = 25, PEN = 1000;
const FAST = 450;                 // 이보다 빨리 이어 누르면 연속(착착)
const KEY_BEST = 'n25_best2';     // 이 기기 최고 판: { v, t:[누른 시각], p:[그때까지 벌점] }
export const grade = ms => ms <= 9000 ? 'S' : ms <= 12000 ? 'A' : ms <= 16000 ? 'B' : ms <= 22000 ? 'C' : 'D';
const TITLE = { S: ['스캐너 눈', '보자마자 찾는 눈이에요'], A: ['날쌘 손가락', '이 정도면 반에서 손꼽혀요'], B: ['차분한 탐색가', '감은 잡았어요, 조금만 더!'], C: ['꼼꼼이', '하나씩 확실하게 찾는 타입'], D: ['숨은 숫자 찾기 중', '다음 판은 분명 빨라져요'] };
const sec = ms => (ms / 1000).toFixed(2);
const sgn = ms => (ms < 0 ? '−' : '+') + sec(Math.abs(ms));
// 숫자마다 올라가는 음(펜타토닉 두 옥타브 남짓)
const SCALE = [0, 2, 4, 7, 9];
const hz = i => 392 * 2 ** ((SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12 / 2.2);

const readBest = store => { try { const b = store.get(KEY_BEST, null); return b && Array.isArray(b.t) && b.t.length === N && Array.isArray(b.p) && b.p.length === N && b.v > 0 && b.t.concat(b.p).every(Number.isFinite) ? b : null; } catch { return null; } };

export function html(touchy) {
  return `<div class="n2" id="n2">
    <div class="n2-top">
      <p class="n2-next"><small>다음</small><b id="n2Next">1</b></p>
      <p class="n2-time"><b class="n2-combo" id="n2Combo" hidden></b><b id="n2Time">0.00</b><small>초</small><i class="n2-split" id="n2Split" hidden></i></p>
      <p class="n2-miss"><small>틀림</small><b id="n2Miss">0</b></p>
    </div>
    <div class="n2-prog" aria-hidden="true"><i class="n2-bar" id="n2Bar"></i><i class="n2-ghost" id="n2Ghost" hidden><b>최고</b></i>${[5, 10, 15, 20].map(k => `<i class="n2-cp" data-k="${k}"></i>`).join('')}</div>
    <div class="n2-wrap"><div class="n2-grid" id="n2Grid"></div></div>
    <div class="n2-bar2"><p class="n2-msg" id="n2Msg" aria-live="polite">${touchy ? '<b>1</b>을 누르면 시작! 1부터 25까지 순서대로' : '<b>1</b>을 클릭하면 시작! 1부터 25까지 순서대로'}</p>
      <span class="n2-btns"><button type="button" class="btn ghost hr-snd n2-snd" id="n2Snd" aria-pressed="false"></button></span></div>
    <p class="note center n2-note">틀리게 누르면 +1초 · 5칸마다 내 최고 기록과 비교</p>
  </div>`;
}

// root: html()을 넣은 영역. o: { store, sound, onSound(on), onDone(value, rounds, detailHtml) }. 반환: 그만두기 함수
export function run(root, o) {
  const $ = s => root.querySelector(s);
  const grid = $('#n2Grid'), tEl = $('#n2Time'), nEl = $('#n2Next'), mEl = $('#n2Miss'), bar = $('#n2Bar'), gh = $('#n2Ghost'), sp = $('#n2Split'), cb = $('#n2Combo'), msg = $('#n2Msg'), sndBtn = $('#n2Snd');
  const nums = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
  grid.innerHTML = nums.map((n, i) => `<button type="button" data-n="${n}" data-i="${i}"${n === 1 ? ' class="go"' : ''}><span>${n}</span></button>`).join('');
  const best = readBest(o.store);
  let next = 1, t0 = 0, pen = 0, raf = 0, alive = true, state = 'ready', sound = !!o.sound, actx = null, combo = 0, spT = 0;
  const taps = [], penAt = [], miss = {}, timers = [];
  const later = (f, ms) => timers.push(setTimeout(() => alive && f(), ms));

  /* 소리 (cut.js와 같은 방식 — 사인파·작게, 기본 꺼짐) */
  const ac = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { actx = null; } return actx; };
  const tone = (f, at, len, type = 'sine', vol = .06, f2 = 0) => { const c = ac(); if (!c) return; const t = c.currentTime + at, os = c.createOscillator(), g = c.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t); if (f2) os.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + len); os.connect(g).connect(c.destination); os.start(t); os.stop(t + len + .02); };
  const sfx = (k, i = 0) => { if (!sound) return;
    if (k === 'ok') tone(hz(i), 0, .16, 'sine', .055);
    else if (k === 'bad') tone(200, 0, .22, 'triangle', .07, 110);
    else if (k === 'cp') { tone(hz(i), 0, .12, 'sine', .05); tone(hz(i) * 1.5, .06, .18, 'sine', .045); }
    else if (k === 'end') [0, 4, 7, 12].forEach((s, j) => tone(523 * 2 ** (s / 12), j * .07, .35, 'sine', .05)); };
  const paintSnd = () => { const t = sound ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', sound); };
  sndBtn.onclick = () => { sound = !sound; o.onSound?.(sound); if (sound) ac(); paintSnd(); sndBtn.blur(); };
  paintSnd();
  if (best) { gh.hidden = false; gh.style.setProperty('--p', '0%'); }

  /* 화면 */
  const eff = () => performance.now() - t0 + pen;                       // 지금까지 기록(벌점 포함)
  const ghostAt = ms => { if (!best) return -1; let k = 0; while (k < N && best.t[k] + best.p[k] <= ms) k++; return k; };   // 최고 판은 이 시각에 몇 개 찾았나
  const setW = (el, k) => el.style.setProperty('--p', (k / N * 100).toFixed(2) + '%');
  const tick = () => {
    if (!alive || state !== 'play') return;
    const e = eff(); tEl.textContent = sec(e);
    if (best) { const g = ghostAt(e); setW(gh, g); gh.classList.toggle('ahead', g > next - 1); }
    raf = requestAnimationFrame(tick);
  };
  const split = (k, e) => {   // 5칸마다: 이 기기 최고 판의 같은 칸 대비
    if (!best) return;
    const d = e - (best.t[k - 1] + best.p[k - 1]);
    sp.hidden = false; sp.textContent = sgn(d); sp.className = 'n2-split ' + (d <= 0 ? 'up' : 'down');
    void sp.offsetWidth; sp.classList.add('show'); clearTimeout(spT); spT = setTimeout(() => { sp.classList.remove('show'); }, 1300);
  };
  const float = (b, txt, cls) => { const f = document.createElement('i'); f.className = 'n2-fl ' + cls; f.textContent = txt; b.appendChild(f); later(() => f.remove(), 700); };

  const onTap = e => {
    const b = e.target.closest('button[data-n]'); if (!b || state === 'done' || state === 'quit') return;
    if (b.disabled || b.classList.contains('ok')) { e.preventDefault(); return; }   // 이미 찾은 칸은 다시 눌러도 벌점 없음(1판과 같게)
    e.preventDefault();
    const now = e.timeStamp > 0 && Math.abs(performance.now() - e.timeStamp) < 1000 ? e.timeStamp : performance.now();   // 손가락이 닿은 순간(처리 지연 빼고)
    const n = +b.dataset.n;
    if (n === next) {
      if (next === 1) { t0 = now; taps.push(0); state = 'play'; root.classList.add('on'); msg.innerHTML = '좋아요, 계속!'; if (sound) ac(); raf = requestAnimationFrame(tick); }
      else {
        const t = Math.max(taps[taps.length - 1], Math.round(now - t0)), gap = t - taps[taps.length - 1];
        taps.push(t);
        combo = gap < FAST ? combo + 1 : 0;
        if (combo >= 3) { cb.hidden = false; cb.textContent = `착착 ${combo + 1}`; cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump'); }
        else cb.hidden = true;
      }
      penAt.push(pen);
      b.disabled = true; b.classList.remove('go', 'bad'); b.classList.add('ok');
      sfx(next % 5 === 0 ? 'cp' : 'ok', next - 1);
      if (next % 5 === 0) { root.querySelector(`.n2-cp[data-k="${next}"]`)?.classList.add('hit'); split(next, taps[next - 1] + pen); }
      setW(bar, next); next++;
      nEl.textContent = next > N ? '끝!' : next; nEl.parentElement.classList.remove('flip'); void nEl.offsetWidth; nEl.parentElement.classList.add('flip');
      if (next > N) done();
    } else if (state === 'play') {
      pen += PEN; combo = 0; cb.hidden = true;
      miss[b.dataset.i] = (miss[b.dataset.i] || 0) + 1; mEl.textContent = Object.values(miss).reduce((a, c) => a + c, 0);
      mEl.parentElement.classList.remove('hurt'); void mEl.offsetWidth; mEl.parentElement.classList.add('hurt');
      b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); float(b, '+1초', 'pen');
      tEl.parentElement.classList.remove('hurt'); void tEl.offsetWidth; tEl.parentElement.classList.add('hurt');
      sfx('bad'); try { if (matchMedia('(pointer:coarse)').matches) navigator.vibrate?.(35); } catch {}
    } else if (state === 'ready') {   // 시작 전엔 벌점 없음 — 1을 찾아 누르도록 안내만
      msg.innerHTML = '<b>1</b>부터 눌러야 시작해요'; grid.querySelector('.go')?.classList.remove('nudge'); void grid.offsetWidth; grid.querySelector('.go')?.classList.add('nudge');
    }
  };
  grid.addEventListener('pointerdown', onTap);
  grid.addEventListener('contextmenu', e => e.preventDefault());

  function done() {
    state = 'done'; cancelAnimationFrame(raf); cb.hidden = true;
    const v = taps[N - 1] + pen; tEl.textContent = sec(v); root.classList.add('fin');
    msg.innerHTML = best && v < best.v ? '<b>이 기기 최고 기록!</b>' : '끝!';
    sfx('end');
    [...grid.children].forEach((b, i) => b.style.setProperty('--d', ((i % 5 + Math.floor(i / 5)) * 35) + 'ms'));
    const rec = { v, t: taps.slice(), p: penAt.slice() };
    if (!best || v < best.v) try { o.store.set(KEY_BEST, rec); } catch {}
    const board = nums.map((n, i) => [n, miss[i] || 0]);
    later(() => o.onDone(Math.min(v, 600000), [...taps, pen], resultHtml(v, taps, pen, board, best)), 750);
  }

  const quit = () => { alive = false; state = 'quit'; cancelAnimationFrame(raf); timers.forEach(clearTimeout); clearTimeout(spT); grid.removeEventListener('pointerdown', onTap); try { actx?.close(); } catch {} };
  window.__n25 = { get state() { return state; }, get next() { return next; }, get pen() { return pen; }, taps, nums };   // 테스트 훅
  return quit;
}

// 결과: 등급·칭호 · 판 지도(숫자마다 찾는 데 걸린 시간) · 구간 기록 5개
// board: 칸 순서대로 [숫자, 그 칸을 잘못 누른 횟수]. prev: 이 판 전의 이 기기 최고(없으면 null)
export function resultHtml(v, taps, pen, board, prev) {
  const g = grade(v), [tt, ts] = TITLE[g];
  const gap = n => n === 1 ? 0 : taps[n - 1] - taps[n - 2];          // n을 찾는 데 걸린 시간(바로 전 숫자부터)
  const gaps = taps.map((_, i) => gap(i + 1)).slice(1), hi = Math.max(...gaps), lo = Math.min(...gaps);
  const slow = gaps.map((x, i) => [x, i + 2]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]);
  const misses = board.reduce((a, [, m]) => a + m, 0);
  const seg = [0, 1, 2, 3, 4].map(s => taps[s * 5 + 4] - (s ? taps[s * 5 - 1] : 0));   // 1~5(1을 누른 뒤 5까지) · 6~10 …
  const fastS = seg.indexOf(Math.min(...seg)), slowS = seg.indexOf(Math.max(...seg));
  const avg = Math.round(taps[N - 1] / (N - 1));
  const tip = misses >= 4 ? `틀린 게 ${misses}번(+${misses}초) — 확실할 때만 눌러도 더 빨라져요` : gaps[N - 2] > avg * 2.2 ? '마지막 숫자에서 오래 걸렸어요. 끝까지 남은 칸을 미리 봐 두세요' : slowS === 4 ? '뒤로 갈수록 느려졌어요. 남은 칸이 적을 땐 눈을 크게 움직여 보세요' : slowS === 0 ? '처음 5개가 제일 느렸어요. 1을 누르기 전에 2·3·4 위치를 봐 두세요' : `숫자 하나에 평균 ${sec(avg)}초 — 고르게 잘 찾았어요`;
  const lv = x => hi === lo ? 0 : Math.round((x - lo) / (hi - lo) * 4);   // 0(빠름)~4(오래 헤맴)
  const cells = board.map(([n, m]) => `<span class="h${n === 1 ? 's' : lv(gap(n))}${slow.includes(n) ? ' slow' : ''}"><b>${n}</b><small>${n === 1 ? '시작' : sec(gap(n))}</small>${m ? `<i class="x" aria-label="${m}번 틀림">${m > 1 ? m : ''}</i>` : ''}</span>`).join('');
  const cmp = prev ? `<p class="n2-cmp ${v <= prev.v ? 'up' : 'down'}">${v < prev.v ? `이 기기 최고 기록을 ${sec(prev.v - v)}초 앞당겼어요!` : v === prev.v ? '이 기기 최고 기록과 똑같아요!' : `이 기기 최고(${sec(prev.v)}초)보다 ${sec(v - prev.v)}초 늦어요`}</p>` : '';
  return `<div class="ctm-res n2-res"><p class="ctm-grade g-${g}">${g}</p><div><p class="ctm-ttl">${tt}</p><p class="ctm-tip">${ts}</p><p class="ctm-tip sub">${tip}</p>${misses ? `<p class="n2-pen">틀림 ${misses}번 · 벌점 +${pen / 1000}초</p>` : '<p class="n2-pen ok">한 번도 안 틀렸어요</p>'}</div></div>${cmp}
    <div class="n2-map" aria-label="어디서 헤맸나"><p class="n2-mh">어디서 헤맸나 <small>숫자를 찾는 데 걸린 시간 · 진할수록 오래</small></p><div class="n2-mg">${cells}</div>
    <p class="n2-mk"><span><i class="h0"></i>빠름</span><span><i class="h4"></i>오래</span><span><i class="x"></i>틀린 칸</span></p></div>
    <p class="rdet n2-seg">${seg.map((s, i) => `<span class="${i === fastS ? 'fast' : i === slowS ? 'slow' : ''}"><b>${i * 5 + 1}~${i * 5 + 5}</b>${sec(s)}초</span>`).join('')}</p>`;
}

// 결과 화면을 한 화면에 (2026-10-28 하율 "한 번에 보일 수 있게"): finish()가 그린 .result를 세 묶음으로 나눔
//   왼쪽 = 기록·등급·구간 / 가운데 = 판 지도 / 오른쪽 = 저장 메시지·내 기록. 넓은 화면은 가로 3칸, 좁은 화면은 위아래(CSS .n2-out)
export function layout(res) {
  if (!res || res.classList.contains('n2-out')) return;
  const q = s => res.querySelector(':scope > ' + s), L = document.createElement('div'), R = document.createElement('div');
  L.className = 'n2-l'; R.className = 'n2-r';
  ['.rlbl', '.rval', '.n2-res', '.n2-cmp', '.n2-seg'].forEach(s => { const e = q(s); if (e) L.appendChild(e); });
  const map = q('.n2-map'), msg = q('#rMsg');
  res.prepend(L); if (map) L.after(map);
  (map || L).after(R); if (msg) R.appendChild(msg); const mr = q('#myRec'); if (mr) R.appendChild(mr);
  res.classList.add('n2-out');
}
