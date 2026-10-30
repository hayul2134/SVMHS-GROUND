// 게임 효과음 공용(2026-10-30 하율 "모든 게임에 효과음") — Web Audio 합성, 파일 없음. 기본 꺼짐, 게임마다 켬/끔을 이 기기에 저장(store 키)
import { store } from './util.js';
let ac = null;
function au() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
export function makeSfx(key) {
  let on = !!store.get(key, false);
  const S = {
    get on() { return on; },
    set(v) { on = !!v; store.set(key, on); if (on) au(); },
    // f → f2(있으면)로 미끄러지는 음 하나. d초, at초 뒤
    tone(f, d = .08, type = 'square', vol = .05, at = 0, f2 = 0) {
      if (!on) return; const a = au(); if (!a) return;
      const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
    },
    noise(d = .2, vol = .08, at = 0, hp = 200) {   // 쿵·펑 같은 잡음
      if (!on) return; const a = au(); if (!a) return;
      const t = a.currentTime + at, n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
      src.connect(f).connect(g).connect(a.destination); src.start(t);
    },
  };
  return S;
}
// 소리 버튼(다른 게임과 같은 모양 .hr-snd) — html 문자열, bindSnd로 연결
export const sndBtnHtml = (id, cls = '') => `<button type="button" class="btn ghost hr-snd ${cls}" id="${id}" aria-pressed="false" aria-label="소리 켜기" data-tip="소리 켜기" data-tip-end></button>`;
export function bindSnd(btn, S) {
  if (!btn) return;
  const paint = () => { const t = S.on ? '소리 끄기' : '소리 켜기'; btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${S.on ? 'on' : 'off'}"/></svg>`; btn.setAttribute('aria-pressed', S.on); btn.setAttribute('aria-label', t); btn.dataset.tip = t; };
  paint(); btn.onclick = () => { S.set(!S.on); paint(); btn.blur(); if (S.on) S.tone(660, .07, 'triangle', .05); };
}
