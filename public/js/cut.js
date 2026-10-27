// SVMHS GROUND — 컷 타이밍 2 (2026-10-27 하율: "애들이 많이 좋아해서 제대로 출시 — 디벨롭해서 내 화면에 먼저", 미리보기 깃발 cut-v2)
// 규칙·점수는 1판과 똑같이 유지(랭킹·티어·미션·서버 검사 그대로): 5번 · 끝까지 가는 시간 DUR · 컷 지점 35~85% · 시작 전 0.5초 · 오차 |누른 시각 − 컷 지점| (0~1000ms) 합.
// 바뀐 것: 편집 프로그램 타임라인(V1 영상 클립 + A1 음악 파형, 파형이 튀는 비트 = 컷 지점) · 레이저(자르기 도구)로 클립이 실제로 잘림 ·
//          일찍/늦게(±ms) 표시와 판정 팝업 · 키보드 C/Space(프리미어 자르기 단축키 C) · 타임라인을 눌러도 컷 · 시작 화면 · 효과음(기본 꺼짐) · 결과 등급·습관 분석.
// 누른 시각은 이벤트의 timeStamp(손가락·키가 눌린 순간)를 씀 — 처리 지연이 기록에 섞이지 않게.

export const DUR = [2400, 2100, 1800, 1550, 1300];   // social.js 1판과 같게 (바꾸면 랭킹이 달라짐)
const WAIT = 500, NEXT = 950;
export const MISS_MS = 1000;   // 끝까지 안 누르면 1000ms(최대 오차) — 2026-10-27 판정 패치: 예전엔 '컷 지점~끝' 거리만 더해져서 안 누르는 게 늦게 누르는 것보다 점수가 좋을 수 있었음
const CLIPS = [['인터뷰_A캠.mp4', 'BGM_비트.wav'], ['B롤_운동장.mp4', 'BGM_비트.wav'], ['드론_교정.mp4', 'BGM_후렴.wav'], ['슬로모_점프.mov', 'BGM_후렴.wav'], ['엔딩_단체샷.mp4', 'BGM_엔딩.wav']];
export const judge = (e, end) => end || e >= 1000 ? ['miss', 'MISS'] : e <= 15 ? ['perfect', 'PERFECT'] : e <= 50 ? ['great', 'GREAT'] : e <= 120 ? ['good', 'GOOD'] : ['bad', 'BAD'];
export const grade = s => s <= 75 ? 'S' : s <= 200 ? 'A' : s <= 400 ? 'B' : s <= 800 ? 'C' : 'D';
// 결과 칭호 (2026-10-28 하율 디벨롭 A): 등급마다 편집자 직급
const TITLE = { S: ['편집의 신', '프레임 단위로 맞추는 손'], A: ['메인 편집자', '이 정도면 본편 맡겨도 돼요'], B: ['어시스턴트', '감은 잡았어요, 조금만 더!'], C: ['편집 인턴', '비트를 귀로 말고 눈으로!'], D: ['컷 미스 장인', '자를 곳을 지나치는 재능…'] };
// 판마다 장면 (클립 색 · 파형 모양): [V1 색, V1 줄무늬, 테두리, 파형 기본 높이, 흔들림]
const SCENE = [['#6a5fd6', '#5a50c2', '#b9b2ff', .14, .22], ['#2f9e8f', '#268678', '#9be8dc', .2, .18], ['#d9813b', '#c06f2e', '#ffd2a6', .1, .32], ['#3f86e0', '#3474c4', '#b4d4ff', .24, .16], ['#d4a017', '#b78910', '#ffe59a', .16, .3]];
const side = d => d === 0 ? '딱 맞게' : `${Math.abs(d)}ms ${d < 0 ? '일찍' : '늦게'}`;
const tc = ms => { const f = Math.floor(ms / (1000 / 30)), p = n => String(n).padStart(2, '0'); return `00:00:${p(Math.floor(f / 30))}:${p(f % 30)}`; };   // 30fps 타임코드
const RAZOR = '<svg class="ctm-rz" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 9.2 20.6 3.4 15 13z" fill="#e8eef7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3.2 17.4 11 9.2l4 3.8-8 8.2z" fill="#ffd23f" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m6.6 16.6 2.2 2.1M9 14.2l2.2 2.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';   // 커터 칼(편집 프로그램 자르기 도구)

export function html(touchy) {
  return `<div class="ctm" id="ct"><div class="ctm-ov" id="ctOv"></div>
    <div class="ctm-top">
      <p class="ctm-tc"><small id="ctRn">ROUND 1/5 · 속도 ×1.0</small><b id="ctTc">00:00:00:00</b></p>
      <ol class="ctm-rd" id="ctRd">${DUR.map((_, i) => `<li><span>${i + 1}</span></li>`).join('')}</ol>
      <p class="ctm-sum"><small>오차 합</small><b id="ctSum">0<i>ms</i></b></p>
    </div>
    <div class="ctm-tl" id="ctTl">
      <div class="ctm-nm"><i></i><span>V1</span><span>A1</span></div>
      <div class="ctm-ar" id="ctAr">
        <div class="ctm-ru"></div>
        <div class="ctm-ln v"><div class="ctm-cl" id="ctClA"><b id="ctClN"></b></div><div class="ctm-cl r" id="ctClB"></div></div>
        <div class="ctm-ln a"><canvas id="ctWv" aria-hidden="true"></canvas><b class="ctm-an" id="ctAn"></b></div>
        <i class="ctm-mk" id="ctMk"></i>
        <i class="ctm-gp" id="ctGp" hidden><b id="ctGpT"></b></i>
        <div class="ctm-hs" id="ctHs"><i class="ctm-hd"></i></div>
        <i class="ctm-flash" id="ctFl"></i>
      </div>
    </div>
    <p class="ctm-msg" id="ctMsg" aria-live="polite"></p>
    <div class="ctm-bar"><button type="button" class="btn big ctm-btn" id="ctBtn">${RAZOR}<span>CUT</span></button>
      <button type="button" class="btn ghost hr-snd ctm-snd" id="ctSnd" aria-pressed="false"></button></div>
    <p class="hr-keys ctm-keys">${touchy ? '버튼이나 타임라인 아무 데나 눌러도 컷' : '<kbd>C</kbd> 또는 <kbd>Space</kbd> · 타임라인을 클릭해도 컷'}</p>
  </div>`;
}

// root: html()을 넣은 영역. o: { sound, onSound(on), onDone(sum, errs, signed) }. 반환: 그만두기 함수
export function run(root, o) {
  const $ = s => root.querySelector(s);
  const ar = $('#ctAr'), hs = $('#ctHs'), mk = $('#ctMk'), clA = $('#ctClA'), clB = $('#ctClB'), wv = $('#ctWv'), ov = $('#ctOv'), msg = $('#ctMsg'), btn = $('#ctBtn'), gp = $('#ctGp'), fl = $('#ctFl');
  let round = 0, sum = 0, raf = 0, t0 = 0, target = 0, dur = 0, state = 'intro', alive = true, sound = !!o.sound, actx = null, frac = 0;
  // 판정 시각 맞추기(2026-10-27 판정 패치): requestAnimationFrame의 시각은 '그리기 시작한 때'이고 실제로 화면에 보이는 건 한 프레임 뒤.
  // 그래서 플레이헤드를 '화면에 보일 때의 시각'(지금 + 1프레임) 위치에 그림 → 눈에 보이는 위치 = 판정에 쓰는 시각. 프레임 간격은 기기마다 달라(60·120Hz) 직접 잼.
  let fi = 1000 / 60, lastF = 0;
  const frame = now => { if (lastF) { const d = now - lastF; if (d > 4 && d < 50) fi += (d - fi) * .2; } lastF = now; return Math.min(34, Math.max(6, fi)); };
  const errs = [], signed = [], timers = [], cuts = [];   // cuts: 판마다 [컷 지점 비율, 자른 곳 비율 또는 null(놓침)] — 결과 화면 '내 컷 다시 보기'
  let streak = 0;   // 연속 PERFECT
  const later = (f, ms) => timers.push(setTimeout(() => alive && f(), ms));

  /* 소리 (기본 꺼짐 — 교실) */
  const ac = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { actx = null; } return actx; };
  const tone = (f, t, d, type = 'sine', v = .16, f2) => { const a = ac(); if (!a) return; const s = a.currentTime + t, os = a.createOscillator(), g = a.createGain();
    os.type = type; os.frequency.setValueAtTime(f, s); if (f2) os.frequency.exponentialRampToValueAtTime(f2, s + d); g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(.001, s + d); os.connect(g).connect(a.destination); os.start(s); os.stop(s + d + .02); };
  const snip = () => { const a = ac(); if (!a) return; const n = a.sampleRate * .045, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; const s = a.createBufferSource(), hp = a.createBiquadFilter(), g = a.createGain();
    // 2026-10-28 하율 "탁 소리가 크고 너무 높아 날카로움": 고음 통과(2400Hz)+네모파 1800Hz 클릭 → 중음대(약 1.1kHz) 잡음 작게 + 낮은 '툭'
    hp.type = 'bandpass'; hp.frequency.value = 1100; hp.Q.value = .8; g.gain.value = .16; s.buffer = b; s.connect(hp).connect(g).connect(a.destination); s.start(); tone(240, 0, .07, 'triangle', .1, 130); };
  const sfx = k => { if (!sound) return; snip(); if (k === 'perfect') { tone(784, .05, .14, 'sine', .08); tone(1046, .12, .22, 'sine', .07); } else if (k === 'great') tone(659, .05, .16, 'sine', .07); else if (k === 'good') tone(523, .05, .12, 'sine', .06); else tone(180, .03, .2, 'triangle', .07, 120); };   // 판정음도 한 단계 낮고 부드럽게(사인파·작게)
  const sndBtn = $('#ctSnd');
  const paintSnd = () => { const t = sound ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', sound); };
  sndBtn.onclick = () => { sound = !sound; o.onSound?.(sound); if (sound) ac(); paintSnd(); sndBtn.blur(); };
  paintSnd();

  /* 음악 파형: 잔잔한 막대 + 컷 지점에 큰 비트 */
  const wave = (f, sc = SCENE[Math.min(round, 4)]) => {
    const r = wv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(1, Math.round(r.width * dpr)), Hh = Math.max(1, Math.round(r.height * dpr));
    wv.width = W; wv.height = Hh; const g = wv.getContext('2d'), bw = 3 * dpr, gap = 2 * dpr, mid = Hh / 2, tx = f * W;
    g.fillStyle = '#3ddc97';
    for (let x = gap; x < W - bw; x += bw + gap) {
      const d = Math.abs(x + bw / 2 - tx) / dpr, beat = Math.max(0, 1 - d / 9) ** 1.4, tail = x > tx ? Math.max(0, 1 - (x - tx) / dpr / 40) * .35 : 0;
      const h = Math.min(.96, sc[3] + Math.random() * sc[4] + beat * .82 + tail * Math.random()) * mid;
      g.globalAlpha = beat > .2 ? 1 : .72; g.fillStyle = beat > .2 ? '#a8ffd2' : '#3ddc97'; g.fillRect(x, mid - h, bw, h * 2);
    }
    g.globalAlpha = 1;
  };
  const setHead = f => { frac = f; hs.style.transform = `translateX(${(f * 100).toFixed(3)}%)`; };

  const paintTop = () => {
    $('#ctRn').textContent = `ROUND ${Math.min(round + 1, 5)}/5 · 속도 ×${(DUR[0] / DUR[Math.min(round, 4)]).toFixed(1)}`;
    $('#ctSum').innerHTML = `${sum}<i>ms</i>`;
  };
  const start = () => {
    state = 'wait'; dur = DUR[round]; target = dur * (.35 + Math.random() * .5);
    const f = target / dur;
    ar.style.setProperty('--tg', (f * 100).toFixed(3) + '%');
    clA.classList.remove('cut', 'gone'); clB.classList.remove('cut'); clB.hidden = true; clA.style.width = ''; gp.hidden = true; mk.className = 'ctm-mk';
    $('#ctClN').textContent = CLIPS[round][0]; $('#ctAn').textContent = CLIPS[round][1];
    const sc = SCENE[round]; ar.style.setProperty('--c1', sc[0]); ar.style.setProperty('--c2', sc[1]); ar.style.setProperty('--cb', sc[2]); ar.classList.toggle('last', round === 4);
    root.querySelectorAll('#ctRd li').forEach((li, i) => li.classList.toggle('now', i === round));
    wave(f); setHead(0); $('#ctTc').textContent = tc(0); paintTop();
    msg.className = 'ctm-msg rdy'; msg.innerHTML = round === 4 ? '<b>마지막 컷!</b><small>엔딩 장면이에요</small>' : '<b>준비…</b>';
    later(() => {
      msg.className = 'ctm-msg'; msg.innerHTML = '<span>파형이 튀는 <b class="ctm-red">빨간 컷 지점</b>에서 CUT!</span>';
      lastF = 0;
      // 0초는 '첫 화면이 실제로 보이는 순간'으로 잡음(타이머가 프레임 중간에 불려도 시작이 밀리거나 플레이헤드가 뒤로 튀지 않게)
      raf = requestAnimationFrame(now0 => {
        if (!alive) return;
        t0 = now0 + frame(now0); state = 'run';
        const step = now => {
          if (state !== 'run' || !alive) return;
          const f = frame(now), tv = now + f - t0;   // 이 프레임이 화면에 보일 때의 게임 시각
          setHead(Math.max(0, Math.min(1, tv / dur))); $('#ctTc').textContent = tc(Math.max(0, Math.min(tv, dur)));
          if (performance.now() - t0 >= dur) return stop(dur, true);   // 끝은 실제 시각으로 (화면 예측으로 일찍 끝내지 않음)
          raf = requestAnimationFrame(step);
        };
        step(now0);
      });
    }, WAIT);
  };

  const stop = (tAt, end) => {
    if (state !== 'run') return; state = 'judge'; cancelAnimationFrame(raf);
    tAt = Math.max(0, Math.min(dur, tAt));
    const e = end ? MISS_MS : Math.min(1000, Math.round(Math.abs(tAt - target))), d = Math.round(tAt - target), [k, name] = judge(e, end);
    errs.push(e); signed.push(end ? null : d); sum += e;
    const cf = tAt / dur; cuts.push([target / dur, end ? null : cf]);
    streak = k === 'perfect' ? streak + 1 : 0;
    setHead(cf); $('#ctTc').textContent = tc(tAt); paintTop();
    // 클립이 실제로 잘림: 왼쪽 조각 + 오른쪽 조각(살짝 벌어짐)
    if (!end) {
      clA.style.width = (cf * 100).toFixed(3) + '%'; clA.classList.add('cut');
      clB.hidden = false; clB.style.left = (cf * 100).toFixed(3) + '%'; clB.classList.remove('cut'); void clB.offsetWidth; clB.classList.add('cut');
      fl.style.left = (cf * 100).toFixed(3) + '%'; fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
      if (e > 3) {   // 컷 지점과 내가 자른 곳 사이 구간 + ±ms
        const a = Math.min(cf, target / dur), b = Math.max(cf, target / dur);
        gp.hidden = false; gp.className = 'ctm-gp ' + k + (d < 0 ? ' early' : ' late'); gp.style.left = (a * 100).toFixed(3) + '%'; gp.style.width = ((b - a) * 100).toFixed(3) + '%'; $('#ctGpT').textContent = (d > 0 ? '+' : '') + d + 'ms';
      }
    } else clA.classList.add('gone');
    mk.className = 'ctm-mk ' + k;
    const li = root.querySelectorAll('#ctRd li')[round]; li.className = 'j-' + k; li.innerHTML = `<span>${e >= 1000 ? '✕' : e}</span>`;
    msg.className = 'ctm-msg pop j-' + k + (streak >= 2 ? ' combo c' + Math.min(streak, 4) : ''); msg.innerHTML = `<b>${name}${streak >= 2 ? ` <em>×${streak}</em>` : ''}</b><small>${end ? '컷 지점을 지나쳤어요' : streak >= 2 ? `${streak}연속 PERFECT! · ${side(d)}` : side(d)}</small>`;
    if (k === 'perfect') {   // 연속일수록 크게 흔들리고 반짝이가 많아짐
      ar.classList.remove('shake', 'shake2', 'shake3'); void ar.offsetWidth; ar.classList.add(streak >= 3 ? 'shake3' : streak === 2 ? 'shake2' : 'shake');
      if (streak >= 2) { const n = Math.min(18, 6 + streak * 3); for (let i = 0; i < n; i++) { const sp = document.createElement('i'); sp.className = 'ctm-sp';
        sp.style.left = (cf * 100).toFixed(2) + '%'; sp.style.setProperty('--dx', (Math.random() * 2 - 1) * (40 + streak * 14) + 'px'); sp.style.setProperty('--dy', -(20 + Math.random() * (40 + streak * 10)) + 'px');
        sp.style.animationDelay = (Math.random() * 80) + 'ms'; ar.append(sp); setTimeout(() => sp.remove(), 900); } }
    }
    sfx(k);
    round++;
    if (round >= 5) { state = 'done'; btn.disabled = true; off(); later(() => o.onDone(sum, errs.slice(), signed.slice(), cuts.slice()), 900); }
    else later(start, NEXT);
  };

  // 누른 시각 = 이벤트가 생긴 순간(timeStamp, performance.now와 같은 시계). 옛 Safari처럼 다른 시계를 주거나 이상하면 지금 시각으로
  const at = e => { const now = performance.now(), ts = e?.timeStamp; return (ts > 0 && ts <= now + 1 && now - ts < 250 ? ts : now) - t0; };
  // 화면을 벗어나면(탭 전환·창 최소화) 그 판은 공정하게 판정할 수 없음 → 그 판만 처음부터 다시
  const vis = () => { if (document.hidden && (state === 'run' || state === 'wait')) { cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers.length = 0; state = 'paused'; }
    else if (!document.hidden && state === 'paused') { msg.className = 'ctm-msg'; msg.innerHTML = '<span>화면을 벗어나서 이번 판은 다시 해요</span>'; later(start, 600); } };
  document.addEventListener('visibilitychange', vis);
  const intro = () => {
    ov.hidden = false; ov.innerHTML = `<div class="ctm-in"><b>${RAZOR}편집의 신</b><p class="ctm-sub">완벽한 타이밍을 찾아라!</p><span>음악 비트(파형이 튀는 <em>빨간 컷 지점</em>)에<br>플레이헤드가 닿는 순간 CUT!</span>
      <ul><li><i class="j-perfect">PERFECT</i>15ms</li><li><i class="j-great">GREAT</i>50ms</li><li><i class="j-good">GOOD</i>120ms</li></ul>
      <div class="ctm-demo" aria-hidden="true"><i class="d-ly d-a"><i class="d-st"><i class="d-t"><i class="d-c"></i><i class="d-m"></i></i><i class="d-t"><i class="d-c"></i><i class="d-m"></i></i></i></i><i class="d-ly d-b"><i class="d-st"><i class="d-t"><i class="d-c l"></i><i class="d-c r"></i><i class="d-m"></i></i><i class="d-t"><i class="d-c l"></i><i class="d-c r"></i><i class="d-m"></i></i></i></i><i class="d-hd"></i><i class="d-fl"></i><b class="d-pf">PERFECT</b></div>
      <small>5번 · 점점 빨라져요 · 오차 합이 작을수록 1등</small><button type="button" class="btn big" id="ctGo">시작</button></div>`;
    $('#ctGo').onclick = go; };
  const go = () => { if (state !== 'intro') return; ov.hidden = true; ov.innerHTML = ''; if (sound) ac(); start(); };
  const press = e => { if (state === 'intro') return go(); if (state === 'run') stop(at(e)); };

  btn.addEventListener('pointerdown', e => { e.preventDefault(); press(e); });
  $('#ctTl').addEventListener('pointerdown', e => { if (e.target.closest('#ctOv button')) return; e.preventDefault(); if (state === 'run') press(e); });
  const key = e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyC' || e.code === 'Space' || (e.code === 'Enter' && state === 'intro')) { if (e.target.closest?.('input,textarea,select')) return; e.preventDefault(); press(e); }
  };
  document.addEventListener('keydown', key);
  const off = () => { document.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', vis); };
  const rs = () => { if (state !== 'done') wave(target && dur ? target / dur : .5); };
  addEventListener('resize', rs);

  intro(); paintTop(); wave(.6); setHead(0);
  window.__cut = { get state() { return state; }, get target() { return target; }, get t0() { return t0; }, get dur() { return dur; }, get fi() { return fi; }, errs, signed };   // 테스트 훅
  return () => { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); off(); removeEventListener('resize', rs); try { actx?.close(); } catch {} };
}

// 결과 화면에 넣을 내용: 등급 · 습관 · 판별 기록(.rdet 자식 5개 = 서버가 보류 때 문제 판 빨간 표시에 씀)
export function resultHtml(sum, errs, signed, cuts = []) {
  const g = grade(sum), hit = signed.filter(x => x != null), avg = hit.length ? Math.round(hit.reduce((a, b) => a + b, 0) / hit.length) : 0;
  const pf = errs.filter(e => e <= 15).length;
  const tip = !hit.length ? '전부 지나쳤어요. 비트가 오기 조금 전에 손을 준비해 보세요' : Math.abs(avg) < 8 ? '일찍·늦게 치우치지 않고 고르게 맞아요. 편집자 손이에요' : avg < 0 ? `평균 ${-avg}ms 일찍 누르는 편이에요 — 한 박자 참았다가!` : `평균 ${avg}ms 늦게 누르는 편이에요 — 비트를 보고 조금 미리!`;
  const [tt, ts] = TITLE[g];
  // 내 컷 다시 보기: 5판을 타임라인 5줄로 — 빨간 선 = 컷 지점, 파란 선 = 내가 자른 곳, 사이 구간 = 오차
  const rp = cuts.length === 5 ? `<div class="ctm-rp" aria-label="내 컷 다시 보기"><p class="ctm-rph">내 컷 다시 보기 <small><i class="k-t"></i>컷 지점 <i class="k-c"></i>내가 자른 곳</small></p>${cuts.map(([t, c], i) => {
    const [k] = judge(errs[i], c == null), a = c == null ? t : Math.min(t, c), w = c == null ? 0 : Math.abs(c - t);
    return `<div class="rp-row j-${k}"><span class="rp-n">${i + 1}</span><div class="rp-tr"><i class="rp-cl" data-c="${SCENE[i][0]}"></i>${w ? `<i class="rp-gp" data-l="${a}" data-w="${w}"></i>` : ''}<i class="rp-t" data-l="${t}"></i>${c == null ? '<b class="rp-miss">MISS</b>' : `<i class="rp-c" data-l="${c}"></i>`}</div><span class="rp-v">${c == null ? '지나침' : side(signed[i])}</span></div>`; }).join('')}</div>` : '';
  return `<div class="ctm-res"><p class="ctm-grade g-${g}">${g}</p><div><p class="ctm-ttl">${tt}</p><p class="ctm-tip">${ts}</p><p class="ctm-tip sub">${tip}</p>${pf ? `<p class="ctm-pf">PERFECT ${pf}번</p>` : ''}</div></div>${rp}
    <p class="rdet ctm-rdet">${errs.map((e, i) => { const [k, n] = judge(e, signed[i] == null); return `<span class="j-${k}"><b>${n}</b>${signed[i] == null ? '지나침' : side(signed[i])}</span>`; }).join('')}</p>`;
}

// 결과 화면을 넣은 뒤 호출: CSP(style-src)가 style="" 속성을 막아서 위치·색은 여기서 CSSOM으로 넣음
export function paintReplay(root) {
  root?.querySelectorAll('.ctm-rp [data-l]').forEach(el => { el.style.left = (+el.dataset.l * 100).toFixed(2) + '%'; if (el.dataset.w) el.style.width = (+el.dataset.w * 100).toFixed(2) + '%'; });
  root?.querySelectorAll('.ctm-rp [data-c]').forEach(el => el.style.setProperty('--c', el.dataset.c));
}
