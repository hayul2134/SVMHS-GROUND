// SVMHS GROUND — 선생님 몰래 춤추기 3D 무대 (2026-11-01 하율: "AI 그림 느낌 말고 네가 직접 — 도형 느낌 안 나게, 안 되면 3D로")
// three.js(public/js/vendor, MIT)로 교실·선생님·반 친구 9명을 만들고 툰 셰이딩 + 잉크 외곽선(OutlineEffect)으로 그림.
// 판에 영향을 주는 값은 없음 — dance.js가 매 프레임 넘겨주는 상태(view)대로 자세만 바꿔서 그림.
import * as THREE from './vendor/three.module.min.js';
import { OutlineEffect } from './vendor/OutlineEffect.js';

const INK = 0x173048;
const PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

export function createStage(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const fx = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: new THREE.Color(INK).toArray(), defaultAlpha: 1 });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f8fc);
  const camera = new THREE.PerspectiveCamera(52, 9 / 16, 0.1, 60);
  camera.position.set(0, 4.9, 7.0); camera.lookAt(0, 0.85, -1.6);   // 교실 뒤쪽 높은 곳에서 칠판·선생님·반 전체가 보이게

  // 툰 셰이딩 3단계 그라데이션
  const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const matC = new Map();
  const M = (color, o = {}) => { const key = color + JSON.stringify(o); let m = matC.get(key); if (m) return m; m = new THREE.MeshToonMaterial({ color, gradientMap: grad, ...o }); if (o.noOutline) m.userData.outlineParameters = { visible: false }; matC.set(key, m); return m; };
  const flat = (color, o = {}) => { const m = new THREE.MeshBasicMaterial({ color, ...o }); m.userData.outlineParameters = { visible: false }; return m; };

  // 빛: 하늘색 반구광 + 왼쪽 창문에서 들어오는 햇빛
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9a777, 1.35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dc, 1.6); sun.position.set(-5, 7, 4); scene.add(sun);

  // 도형 도우미
  const mesh = (geo, mat, x = 0, y = 0, z = 0, p) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (p || scene).add(m); return m; };
  const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
  const cap = (r, len, mat, p) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat); m.position.y = -len / 2 - r * 0.6; p.add(m); return m; };
  const sph = (r, mat, x, y, z, p, sx = 1, sy = 1, sz = 1) => { const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat, x, y, z, p); m.scale.set(sx, sy, sz); return m; };
  const lathe = (pts, mat, p, y = 0, seg = 20) => mesh(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg), mat, 0, y, 0, p);
  const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  const canvasTex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

  /* ===== 교실 ===== */
  const ROOM = { L: -2.7, R: 2.7, F: -5, B: 9, H: 3.6 };
  // 바닥: 나무 판자(그린 텍스처)
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#d3a46c', '#cc9c63', '#d8ab74', '#c8975e'][i % 4]; g.fillRect(i * 64, 0, 64, h); }
    g.strokeStyle = 'rgba(110,70,30,.35)'; g.lineWidth = 3; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); }
    for (let i = 0; i < 8; i++) { const y = (i * 173) % h; g.beginPath(); g.moveTo(i * 64, y); g.lineTo(i * 64 + 64, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,240,210,.18)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = (i * 97) % w, y = (i * 61) % h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + 30, x, y + 60); g.stroke(); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 5);
  const floor = mesh(new THREE.PlaneGeometry(ROOM.R - ROOM.L, ROOM.B - ROOM.F), M(0xffffff, { map: floorTex, noOutline: true }), 0, 0, (ROOM.F + ROOM.B) / 2); floor.rotation.x = -PI / 2;
  // 벽(앞·왼쪽·오른쪽) + 아래 판자
  const wallM = flat(0xe6f3fc), wainM = flat(0xb3d8f1), sideM = flat(0xd6eaf8);
  box(ROOM.R - ROOM.L, ROOM.H, 0.1, wallM, 0, ROOM.H / 2, ROOM.F - 0.05);
  box(0.1, ROOM.H, ROOM.B - ROOM.F, sideM, ROOM.L - 0.05, ROOM.H / 2, (ROOM.F + ROOM.B) / 2);
  box(0.1, ROOM.H, ROOM.B - ROOM.F, sideM, ROOM.R + 0.05, ROOM.H / 2, (ROOM.F + ROOM.B) / 2);
  box(ROOM.R - ROOM.L, 0.95, 0.06, wainM, 0, 0.475, ROOM.F + 0.02);
  box(0.06, 0.95, ROOM.B - ROOM.F, flat(0xa3cdea), ROOM.L + 0.02, 0.475, (ROOM.F + ROOM.B) / 2);
  box(0.06, 0.95, ROOM.B - ROOM.F, flat(0xa3cdea), ROOM.R - 0.02, 0.475, (ROOM.F + ROOM.B) / 2);
  box(ROOM.R - ROOM.L, 0.06, 0.1, flat(0x86bde4), 0, 0.96, ROOM.F + 0.05);
  for (let x = ROOM.L + 0.45; x < ROOM.R; x += 0.9) box(0.7, 0.62, 0.02, flat(0xa3cdea), x, 0.5, ROOM.F + 0.06);   // 판자 무늬
  box(ROOM.R - ROOM.L, 0.12, 0.14, flat(0xffffff), 0, ROOM.H - 0.06, ROOM.F + 0.07);   // 천장 몰딩
  // 전자칠판: 화면 텍스처에 판서 글씨를 그림
  const BW = 3.9, BH = 1.75, BY = 2.2, BZ = ROOM.F + 0.08;
  box(BW + 0.22, BH + 0.22, 0.08, M(0x2a3f56), 0, BY, BZ - 0.03);
  const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 424; const bg2 = bc.getContext('2d');
  const boardTex = new THREE.CanvasTexture(bc); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  const screen = mesh(new THREE.PlaneGeometry(BW, BH), flat(0xffffff, { map: boardTex }), 0, BY, BZ + 0.015);
  box(1.4, 0.05, 0.12, M(0x4b5a70), 0, BY - BH / 2 - 0.16, BZ + 0.05);
  box(0.16, 0.025, 0.03, M(0xff8f8f), -0.25, BY - BH / 2 - 0.125, BZ + 0.06); box(0.16, 0.025, 0.03, M(0x6fc6f4), 0.05, BY - BH / 2 - 0.125, BZ + 0.06);
  // 교탁(책·머그컵) · 시계 · 급훈
  const lect = grp(scene, -2.05, 0, -4.4);
  box(0.9, 1.05, 0.6, M(0xb9875a), 0, 0.525, 0, lect); box(1, 0.06, 0.7, M(0x8f6340), 0, 1.08, 0, lect);
  box(0.36, 0.05, 0.26, M(0x6fc6f4), -0.15, 1.14, 0, lect); box(0.32, 0.05, 0.24, M(0xff8f8f), -0.15, 1.19, 0, lect); box(0.28, 0.05, 0.22, M(0xffe08a), -0.15, 1.24, 0, lect);
  mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.14, 16), M(0xffffff), 0.25, 1.18, 0, lect);
  const clock = grp(scene, 2.32, 2.95, ROOM.F + 0.05);
  const face = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 32), M(0xffffff), 0, 0, 0, clock); face.rotation.x = PI / 2;
  const hand1 = box(0.025, 0.17, 0.01, flat(INK), 0, 0.07, 0.035, clock), hand2 = box(0.02, 0.22, 0.01, flat(INK), 0, 0, 0.04, clock);
  hand2.geometry.translate(0, 0.1, 0); hand1.geometry.translate(0, 0.0, 0);
  

  /* ===== 사람 만들기(관절 계층) ===== */
  const SKIN = 0xf7caa1;
  // 몸: 위아래로 매끈한 통(lathe) — 어깨는 둥글고 허리는 살짝 들어감
  const torsoPts = (h, sh, wa) => [[0.001, 0], [wa * 0.95, 0.005], [wa, h * 0.12], [wa * 0.96, h * 0.45], [sh * 0.98, h * 0.78], [sh, h * 0.88], [sh * 0.82, h * 0.97], [sh * 0.35, h], [0.001, h]];
  function limb(parent, x, y, z, r1, l1, r2, l2, mat1, mat2, end) {
    const a = grp(parent, x, y, z); cap(r1, l1, mat1, a);
    const b = grp(a, 0, -l1 - r1 * 1.2, 0); cap(r2, l2, mat2 || mat1, b);
    const c = grp(b, 0, -l2 - r2 * 1.2, 0); if (end) end(c);
    return { a, b, c };
  }
  function person(o) {
    const S = o.scale || 1, root = grp(scene), body = grp(root, 0, o.hipY, 0);
    const clothM = M(o.cloth), skinM = M(SKIN), pantsM = M(o.pants || 0x2f3550), hairM = M(o.hair);
    // 다리(치마면 맨다리 + 무릎 양말)
    const legM = o.skirt ? skinM : pantsM;
    const shoe = c => { const s = sph(0.07 * S, M(o.shoe || 0x2f2a33), 0, -0.02 * S, 0.035 * S, c, 1, 0.7, 1.55); return s; };
    const legL = limb(body, -0.085 * S, -0.02, 0, 0.068 * S, 0.3 * S, 0.058 * S, 0.3 * S, legM, o.skirt ? M(0xffffff) : legM, shoe);
    const legR = limb(body, 0.085 * S, -0.02, 0, 0.068 * S, 0.3 * S, 0.058 * S, 0.3 * S, legM, o.skirt ? M(0xffffff) : legM, shoe);
    if (o.skirt) lathe([[0.12 * S, 0.02], [0.2 * S, -0.16 * S], [0.235 * S, -0.27 * S], [0.001, -0.27 * S]].reverse().map(([r, h]) => [r, h]), M(o.skirt), body, 0);
    else lathe([[0.001, -0.1 * S], [0.16 * S, -0.1 * S], [0.175 * S, 0], [0.16 * S, 0.06 * S], [0.001, 0.06 * S]], pantsM, body);
    // 상체
    const chest = grp(body, 0, 0.04 * S, 0);
    const TH = (o.torsoH || 0.5) * S;
    lathe(torsoPts(TH, 0.2 * S * (o.wide || 1), 0.165 * S), clothM, chest).scale.z = 0.72;
    if (o.vest) { lathe(torsoPts(TH * 0.86, 0.205 * S, 0.17 * S), M(o.vest), chest, 0.02).scale.z = 0.75; }
    if (o.hood) sph(0.15 * S, M(o.cloth), 0, TH * 0.9, -0.1 * S, chest, 1.1, 0.75, 0.6);
    if (o.collar) { const cl = lathe([[0.075 * S, 0], [0.11 * S, 0.02 * S], [0.085 * S, 0.06 * S], [0.06 * S, 0.06 * S]], M(o.collar), chest, TH * 0.93); cl.scale.z = 0.85; }
    if (o.stripe) box(0.03 * S, TH * 0.9, 0.02, M(o.stripe), 0, TH * 0.45, -0.12 * S, chest);
    // 목·머리
    const neck = grp(chest, 0, TH, 0); mesh(new THREE.CylinderGeometry(0.055 * S, 0.06 * S, 0.1 * S, 12), skinM, 0, 0.03 * S, 0, neck);
    const head = grp(neck, 0, 0.1 * S, 0), HR = (o.headR || 0.19) * S;
    const skull = sph(HR, skinM, 0, HR, 0, head, 0.95, 1.05, 1);
    sph(HR * 0.22, skinM, -HR * 0.95, HR * 0.95, 0, head, 0.6, 1, 1); sph(HR * 0.22, skinM, HR * 0.95, HR * 0.95, 0, head, 0.6, 1, 1);   // 귀
    hairOf(o, head, HR, hairM);
    // 팔
    const handE = c => sph(0.05 * S, skinM, 0, -0.02 * S, 0, c, 0.85, 1.1, 0.75);
    const sleeve = M(o.sleeve || o.cloth);
    const armL = limb(chest, -0.235 * S * (o.wide || 1), TH * 0.86, 0, 0.058 * S, 0.24 * S, 0.052 * S, 0.22 * S, sleeve, sleeve, handE);
    const armR = limb(chest, 0.235 * S * (o.wide || 1), TH * 0.86, 0, 0.058 * S, 0.24 * S, 0.052 * S, 0.22 * S, sleeve, sleeve, handE);
    // 발밑 그림자
    const sh = mesh(new THREE.CircleGeometry(0.32 * S, 24), flat(0x173048, { transparent: true, opacity: 0.16, depthWrite: false }), 0, 0.012, 0, root); sh.rotation.x = -PI / 2;
    return { root, body, chest, head, skull, neck, armL, armR, legL, legR, shadow: sh, S, HR, o };
  }
  // 머리 모양(뒤에서 보이는 모습이 중요): 두피를 덮는 머리 + 모양별 덧붙임
  function hairOf(o, head, R, m) {
    const cover = sph(R * 1.07, m, 0, R * 1.08, -R * 0.06, head, 1, o.hs === 'buzz' ? 0.98 : 1.04, 1.02);
    if (o.hs === 'buzz') { cover.scale.set(0.98, 0.98, 0.98); return; }
    // 뒷머리: 목덜미까지
    sph(R * 0.9, m, 0, R * 0.62, -R * 0.42, head, 1.08, 0.8, 0.7);
    if (o.hs === 'short' || !o.hs) { for (const x of [-0.5, 0, 0.5]) sph(R * 0.32, m, x * R, R * 0.35, -R * 0.68, head, 1, 1.25, 0.8); }
    if (o.hs === 'long' || o.hs === 'wave') { const l = lathe([[0.001, -R * 1.7], [R * 0.85, -R * 1.6], [R * 1.0, -R * 0.6], [R * 1.02, R * 0.3], [0.001, R * 0.6]], m, head, R * 0.6); l.scale.z = 0.55; l.position.z = -R * 0.45; }
    if (o.hs === 'bun') { sph(R * 0.42, m, 0, R * 2.0, -R * 0.35, head); mesh(new THREE.TorusGeometry(R * 0.32, R * 0.08, 8, 16), M(o.acc2 || 0xffd25e), 0, R * 1.75, -R * 0.3, head).rotation.x = PI / 2.3; }
    if (o.hs === 'pony') { const p = grp(head, 0, R * 1.45, -R * 0.95); p.rotation.x = 0.5; cap(R * 0.26, R * 1.0, m, p); head.userData.tail = p; }
    if (o.hs === 'twin') for (const d of [-1, 1]) { const p = grp(head, d * R * 0.95, R * 1.3, -R * 0.4); p.rotation.z = d * 0.35; cap(R * 0.22, R * 0.9, m, p); (head.userData.twins ||= []).push(p); }
    if (o.acc === 'band') { const b = mesh(new THREE.TorusGeometry(R * 1.06, R * 0.07, 8, 24, PI), M(0xff6fa8), 0, R * 1.15, 0, head); b.rotation.y = PI / 2; b.rotation.x = -0.25; }
    if (o.acc === 'cap') { const c = sph(R * 1.12, M(0xe0464e), 0, R * 1.2, 0, head, 1, 0.75, 1); c.geometry = new THREE.SphereGeometry(R * 1.12, 20, 12, 0, PI * 2, 0, PI / 2); box(R * 0.9, R * 0.08, R * 0.9, M(0xa8323a), 0, R * 1.18, -R * 1.2, head); }
    if (o.acc === 'phones') { const b = mesh(new THREE.TorusGeometry(R * 1.15, R * 0.06, 8, 24, PI), M(0x3b6cf6), 0, R * 1.05, 0, head); for (const d of [-1, 1]) sph(R * 0.3, M(0x3b6cf6), d * R * 1.08, R * 0.95, 0, head, 0.6, 1, 1); }
  }

  // 책상·의자
  function desk(x, z) {
    const d = grp(scene, x, 0, z), wood = M(0xe2b47c), metal = M(0x8a93a8);
    box(1.0, 0.05, 0.6, wood, 0, 0.74, 0, d);
    box(0.94, 0.12, 0.5, M(0x6f7790), 0, 0.64, 0, d);
    for (const [a, b] of [[-0.46, -0.26], [0.46, -0.26], [-0.46, 0.26], [0.46, 0.26]]) box(0.04, 0.72, 0.04, metal, a, 0.36, b, d);
    const ch = grp(scene, x, 0, z + 0.62);
    box(0.44, 0.04, 0.42, wood, 0, 0.45, 0, ch); box(0.44, 0.3, 0.035, wood, 0, 0.78, 0.2, ch);
    for (const [a, b] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.19], [0.2, 0.19]]) box(0.03, 0.45, 0.03, metal, a, 0.225, b, ch);
    box(0.03, 0.4, 0.03, metal, -0.2, 0.65, 0.2, ch); box(0.03, 0.4, 0.03, metal, 0.2, 0.65, 0.2, ch);
    return { d, ch };
  }

  /* ===== 반 친구들(뒤에서 보임: 얼굴이 칠판 쪽) ===== */
  const KIDS = [
    { hair: 0x2c2a3c, hs: 'short', cloth: 0x34407a, collar: 0xf3f5fa, ds: 3 },
    { hair: 0x5f3d26, hs: 'bun', cloth: 0xf0dcbc, skirt: 0x3a4566, ds: 5, sleep: true },
    { hair: 0x2c2a3c, hs: 'buzz', cloth: 0xe05252, pants: 0xe05252, stripe: 0xffffff, ds: 7 },
    { hair: 0x8a4a2a, hs: 'wave', cloth: 0xffa9cf, skirt: 0x3a4566, acc: 'band', hood: true, ds: 1 },
    { hair: 0x26222e, hs: 'twin', cloth: 0x34407a, collar: 0xf3f5fa, skirt: 0x3a4566, ds: 6 },
    { hair: 0x4a3324, hs: 'short', cloth: 0xa4adbf, acc: 'phones', hood: true, ds: 4 },
    { hair: 0x5f3d26, hs: 'pony', cloth: 0x7fd8b9, skirt: 0x3a4566, hood: true, ds: 2 },
    { hair: 0x1f1f26, hs: 'short', cloth: 0x34407a, collar: 0xf3f5fa, acc: 'cap', ds: 0 },
    { hair: 0x2c2a3c, hs: 'short', cloth: 0x34407a, collar: 0xf3f5fa, ds: 8, me: true },
  ];
  const SEAT = [[-1.6, -1.6], [0, -1.6], [1.6, -1.6], [-1.6, 0.5], [0, 0.5], [1.6, 0.5], [-1.6, 2.6], [1.6, 2.6], [0, 2.6]];
  const kids = KIDS.map((o, i) => {
    const [x, z] = SEAT[i]; desk(x, z);
    const p = person({ ...o, hipY: 0.98, scale: 1, shoe: 0x2f2a33 });
    p.home = new THREE.Vector3(x, 0, z + 0.62); p.ph = i * 1.37; p.tp = 0.9 + (i % 4) * 0.08;
    p.root.rotation.y = PI;   // 칠판 쪽을 봄(카메라엔 뒷모습)
    return p;
  });
  // 파티 때 발밑 색 조명
  const GLOW = [0x6fc6f4, 0xffe08a, 0x8fe8cf, 0xa9c4ff, 0xff8f8f];
  const glows = kids.map((k, i) => { const g = mesh(new THREE.CircleGeometry(0.75, 32), flat(GLOW[i % GLOW.length], { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), k.home.x, 0.015, k.home.z); g.rotation.x = -PI / 2; return g; });

  /* ===== 선생님(60대 · 은발 · 네모 안경 · 니트 조끼 · 넥타이 · 나무 막대기) ===== */
  const T = person({ hipY: 1.1, scale: 1.2, cloth: 0xf3f5fa, vest: 0x7a5236, pants: 0x5d5a66, shoe: 0x4a3226, hair: 0xd9dce2, hs: 'teacher', torsoH: 0.56, headR: 0.17, wide: 1.05 });
  {
    const h = T.head, R = T.HR;
    // 숱 많은 은발: 앞머리 볼륨 + 옆머리 + 물결
    for (const [x, y, z, r] of [[-0.55, 1.75, 0.35, 0.42], [0.1, 1.85, 0.45, 0.45], [0.55, 1.7, 0.3, 0.38], [-0.85, 1.25, 0.1, 0.34], [0.85, 1.25, 0.1, 0.34], [0, 1.9, -0.2, 0.5]]) sph(R * r, M(0xd9dce2), x * R, y * R, z * R, h);
    // 얼굴(앞: +z)
    const eyeM = flat(0x1d1b2e), glassM = M(0x1d1b2e);
    T.eyes = [-1, 1].map(d => sph(R * 0.09, eyeM, d * R * 0.36, R * 1.02, R * 0.93, h, 1, 1.2, 0.5));
    T.brows = [-1, 1].map(d => box(R * 0.42, R * 0.1, R * 0.08, M(0x8c8f98), d * R * 0.38, R * 1.28, R * 0.92, h));
    for (const d of [-1, 1]) { const fr = mesh(new THREE.TorusGeometry(R * 0.24, R * 0.035, 6, 4), glassM, d * R * 0.38, R * 1.02, R * 0.99, h); fr.rotation.z = PI / 4; fr.scale.set(1.15, 0.85, 1); }
    box(R * 0.2, R * 0.03, R * 0.03, glassM, 0, R * 1.06, R * 1.0, h);
    sph(R * 0.13, M(0xeab48f), 0, R * 0.82, R * 1.0, h, 1, 1.1, 0.9);   // 코
    T.mouth = box(R * 0.36, R * 0.06, R * 0.05, flat(0x7a2630), 0, R * 0.55, R * 0.92, h);
    // 넥타이
    const tie = box(0.07, 0.34, 0.02, M(0xc2364a), 0, 0.4, 0.175, T.chest); tie.rotation.x = -0.12;
    box(0.09, 0.07, 0.03, M(0xa82c3d), 0, 0.58, 0.17, T.chest);
    // 막대기(왼손) · 펜(오른손)
    T.stick = grp(T.armL.c, 0, -0.03, 0); const st = mesh(new THREE.CylinderGeometry(0.013, 0.017, 1.0, 8), M(0xb9813f), 0, 0, 0, T.stick); st.rotation.x = PI / 2; st.position.z = 0.32;
    T.pen = box(0.02, 0.14, 0.02, M(0x1d1b2e), 0, -0.07, 0, T.armR.c);
  }
  T.root.position.set(0, 0, -4.35); T.root.rotation.y = PI;
  let tX = 0;

  /* ===== 판서(칠판 텍스처) ===== */
  let boardKey = '';
  function paintBoard(lines, font) {
    const g = bg2, W = bc.width, H = bc.height;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1f3b58'); gr.addColorStop(1, '#152b42'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(380, 0); g.lineTo(180, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#26405a'; g.fillRect(0, 0, W, 34); ['#ff8f8f', '#ffe08a', '#6fc6f4', '#ffffff', '#8fe8cf'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(30 + i * 30, 17, 7, 0, 7); g.fill(); });
    let cur = { x: 70, y: 110 };
    lines.forEach((L, i) => {
      g.font = `${i === 0 ? 50 : 40}px ${font}`; g.fillStyle = i === 0 ? '#ffe08a' : i === 3 ? '#ff9b9b' : '#f2f6ff'; g.textBaseline = 'alphabetic';
      const y = 108 + i * 82; g.fillText(L.text, 60, y);
      if (i === 0 && L.under) { g.fillRect(60, y + 12, g.measureText(L.full).width, 5); }
      cur = { x: 60 + g.measureText(L.text).width, y: y - 18 };
    });
    g.strokeStyle = 'rgba(125,211,255,.8)'; g.lineWidth = 4; g.beginPath(); g.moveTo(800, 340); g.lineTo(980, 340); g.moveTo(890, 380); g.lineTo(890, 150); g.stroke();
    if (lines.length >= 3) { g.strokeStyle = '#8fe8cf'; g.lineWidth = 6; g.beginPath(); for (let x = -80; x <= 80; x += 4) { const y = 300 - ((x + 10) * (x + 10)) * 0.02; x === -80 ? g.moveTo(890 + x, y) : g.lineTo(890 + x, y); } g.stroke(); }
    boardTex.needsUpdate = true;
    return cur;
  }
  let cursor = { x: 70, y: 110 };

  /* ===== 춤 동작: 관절 각도(라디안) — 저마다 다르게 ===== */
  function setArm(a, sx, sz, el, side) { a.a.rotation.set(sx, 0, sz * side); a.b.rotation.set(el, 0, 0); }
  function setLeg(l, hx, kx, sz = 0) { l.a.rotation.set(hx, 0, sz); l.b.rotation.set(kx, 0, 0); }
  function poseKid(k, mode, t, amp, sleepy) {
    const b = k.body, ch = k.chest, hd = k.head;
    k.root.position.copy(k.home); b.rotation.set(0, 0, 0); ch.rotation.set(0, 0, 0); hd.rotation.set(0, 0, 0);
    if (mode === 'sit') {
      b.position.y = 0.5;
      setLeg(k.legL, -PI / 2, PI / 2); setLeg(k.legR, -PI / 2, PI / 2);
      const br = Math.sin(t * 1.6 + k.ph) * 0.012;
      ch.rotation.x = 0.12 + br; setArm(k.armL, -1.15, 0.15, -0.7, -1); setArm(k.armR, -1.15 + (k.o.wr ? Math.sin(t * 9) * 0.05 : 0), 0.15, -0.7, 1);
      hd.rotation.x = 0.15 + Math.max(0, Math.sin(t * 0.35 + k.ph * 2) - 0.85) * 0.5;
      if (k.o.sleep || sleepy >= 1) { ch.rotation.x = 0.75; hd.rotation.x = 0.55; setArm(k.armL, -1.6, 0.5, -1.5, -1); setArm(k.armR, -1.6, 0.5, -1.5, 1); }
      else if (sleepy > 0) { hd.rotation.x = 0.15 + sleepy * 0.6; ch.rotation.x = 0.12 + sleepy * 0.25; }
      k.root.position.z = k.home.z - 0.05;
      k.shadow.visible = false;
      return;
    }
    // 춤(일어나서 의자 옆 통로로 반 발짝)
    k.shadow.visible = true;
    const S = Math.sin(t), A = Math.abs(S), S2 = Math.sin(t * 2), bounce = Math.abs(Math.sin(t * 2)) * 0.07 * amp;
    b.position.y = 0.98 + bounce - 0.04 * amp; k.root.position.z = k.home.z + 0.35;
    let aL = [0, 0, 0], aR = [0, 0, 0], lL = [0, 0], lR = [0, 0], lean = 0, twist = 0, side = 0, nod = 0;
    switch (k.o.ds % 9) {
      case 0: { const f = clamp(S * 2.5, -1, 1); aL = [-2.4 * (f > 0 ? 1 : 0.2), 0.3 + 0.4 * f, -0.2]; aR = [-2.4 * (f < 0 ? 1 : 0.2), 0.3 - 0.4 * f, -0.2]; side = f * 0.1; twist = f * 0.25; lL = [-0.2 * f, 0.3]; lR = [0.2 * f, 0.3]; break; }   // 디스코 찌르기
      case 1: aL = [-2.8, 0.25 + S * 0.35, -0.3]; aR = [-2.8, 0.25 - S * 0.35, -0.3]; side = S * 0.12; lL = [-0.1, 0.25 + A * 0.2]; lR = [0.1, 0.25]; break;   // 두 팔 흔들기
      case 2: { const up = S2 > 0; aR = [up ? -2.9 : -1.6, 0.2, up ? 0 : -1.6]; aL = [-0.3, 0.5, -1.4]; nod = up ? -0.2 : 0.15; lL = [-0.3, 0.6]; lR = [0.1, 0.2]; break; }   // 주먹 위로
      case 3: { const n = Math.floor(((t / 1.57) % 4 + 4) % 4); const P = [[[-1.57, 0.2, -1.57], [0, 0.2, 0]], [[-1.57, 1.4, 0], [-1.57, 0.2, -1.57]], [[0, 1.5, -1.57], [-1.57, 1.4, 0]], [[-0.4, 0.2, -1.2], [-0.4, 0.2, -1.2]]][n]; aL = P[0]; aR = P[1]; twist = [0, -0.3, 0.3, 0][n]; break; }   // 로봇
      case 4: nod = Math.sin(t * 4) * 0.35; aL = [-0.9, 0.3, -1.2]; aR = [-0.4 + Math.sin(t * 8) * 0.25, 0.1, -1.0]; lean = 0.15; lL = [-0.3, 0.6]; lR = [0.1, 0.3]; break;   // 헤드뱅 + 에어 기타
      case 5: { const c = A; aL = [-3.0, 0.15 + c * 0.25, 0]; aR = [-3.0, 0.15 + c * 0.25, 0]; lL = [-0.05, 0.2]; lR = [-0.05, 0.2]; break; }   // 머리 위 박수
      case 6: aL = [-PI + S * PI, 0.4, 0]; aR = [-S * PI, 0.4, 0]; twist = S * 0.3; lL = [-0.2, 0.3]; lR = [0.2, 0.3]; break;   // 풍차
      case 7: { const j = A; b.position.y += j * 0.25 * amp; aL = [-2.7, 0.4, -0.2]; aR = [-2.7, 0.4, -0.2]; lL = [-0.6 * j, 1.0 * j]; lR = [-0.6 * j, 1.0 * j]; break; }   // 점프
      default: { const f = clamp(S * 2, -1, 1); aL = [-1.2 - 1.2 * Math.max(0, f), 0.6, -0.8]; aR = [-1.2 - 1.2 * Math.max(0, -f), 0.6, -0.8]; side = f * 0.12; twist = f * 0.3; lL = [-0.4 * Math.max(0, f), 0.7 * Math.max(0, f)]; lR = [-0.4 * Math.max(0, -f), 0.7 * Math.max(0, -f)]; }   // 나: 신나게 흔들기
    }
    const s2 = Math.min(1.3, amp);
    setArm(k.armL, aL[0] * s2, aL[1], aL[2], -1); setArm(k.armR, aR[0] * s2, aR[1], aR[2], 1);
    setLeg(k.legL, lL[0], lL[1]); setLeg(k.legR, lR[0], lR[1]);
    b.rotation.z = side * amp; b.rotation.y = twist * amp; ch.rotation.x = -lean; hd.rotation.x = nod; hd.rotation.z = -side * 0.6;
    if (hd.userData.tail) hd.userData.tail.rotation.z = Math.sin(t * 2 + 1) * 0.5;
    for (const tw of hd.userData.twins || []) tw.rotation.x = Math.sin(t * 2 + 0.5) * 0.4;
  }

  /* ===== 선생님 자세 ===== */
  function poseTeacher(v, dt) {
    const k = T, st = v.tst, b = k.body, ch = k.chest, hd = k.head;
    // 판서 위치 따라 걷기(그림만)
    const target = clamp((cursor.x / bc.width - 0.5) * BW - 0.38, -1.5, 1.5);
    if (st === 'write' || st === 'idle') tX += clamp(target - tX, -0.55 * dt, 0.55 * dt);
    const walking = Math.abs(target - tX) > 0.02 && (st === 'write' || st === 'idle');
    k.root.position.set(tX, 0, -4.25);
    b.position.y = 1.1 + (walking ? Math.abs(Math.sin(v.t * 8)) * 0.02 : 0);
    ch.rotation.set(0, 0, 0); hd.rotation.set(0, 0, 0);
    setLeg(k.legL, walking ? Math.sin(v.t * 8) * 0.2 : 0, 0.05); setLeg(k.legR, walking ? -Math.sin(v.t * 8) * 0.2 : 0, 0.05);
    // 막대기: 왼손에 들고 아래로
    setArm(k.armL, 0.1, 0.15, -0.3, -1); k.stick.rotation.set(0.9, 0, 0);
    // 기본: 등 돌리고(칠판 보며) 판서
    let face = PI;
    const writeArm = () => { setArm(k.armR, -2.5 + Math.sin(v.t * 16) * 0.05, -0.15, -0.5, 1); };
    let mood = 'calm';
    if (st === 'write' || st === 'idle') { writeArm(); ch.rotation.x = -0.05; }
    else if (st === 'pause') { setArm(k.armR, -2.35, -0.15, -0.55, 1); }   // 펜만 멈춤
    else if (st === 'warn') { setArm(k.armR, -0.2, 0.15, -0.3, 1); const p = clamp((v.dur - v.tm) / 30, 0, 1); hd.rotation.y = -0.35 * ease(p) + (v.twitch ? Math.sin(v.t * 60) * 0.03 : 0); }
    else if (st === 'peek') { setArm(k.armR, -0.2, 0.15, -0.3, 1); const p = clamp((v.dur - v.tm) / 8, 0, 1); hd.rotation.y = -1.25 * ease(p); ch.rotation.y = -0.35 * ease(p); mood = 'sus'; }
    else if (st === 'turn') { const p = clamp(1 - v.tm / v.tf, 0, 1); face = PI - PI * ease(p); setArm(k.armR, lerp(-2.4, -0.15, p), 0.15, -0.3, 1); mood = 'sus'; }
    else if (st === 'look') { face = 0; setArm(k.armR, -0.15, 0.15, -0.3, 1); hd.rotation.y = Math.sin(v.t * 2.2) * 0.35; mood = 'sus'; setArm(k.armL, -0.5, 0.15, -1.2, -1); k.stick.rotation.set(0, 0, 0); }
    else if (st === 'caught') { face = 0; mood = 'angry'; const sh = Math.sin(v.t * 30) * 0.05;
      setArm(k.armR, -1.5 + sh, 0.1, -0.1, 1); setArm(k.armL, -2.6, 0.3, -0.6, -1); k.stick.rotation.set(-0.6 + sh * 3, 0, 0); ch.rotation.x = 0.12; hd.rotation.x = 0.1; }
    else if (st === 'turnback') { const p = clamp(1 - v.tm / v.tf, 0, 1); face = PI * ease(p); }
    k.root.rotation.y = face;
    // 표정
    const sus = mood === 'sus', ang = mood === 'angry';
    k.brows[0].rotation.z = ang ? -0.35 : sus ? 0.05 : 0; k.brows[1].rotation.z = ang ? 0.35 : sus ? -0.25 : 0;
    k.brows[0].position.y = k.HR * (ang ? 1.22 : 1.28); k.brows[1].position.y = k.HR * (ang ? 1.22 : sus ? 1.33 : 1.28);
    for (const e of k.eyes) { e.scale.y = sus ? 0.45 : 1.2; e.position.x = Math.sign(e.position.x) * k.HR * 0.36 + (sus ? Math.sin(v.t * 3) * k.HR * 0.06 : 0); }
    k.mouth.scale.set(ang ? 1.1 : sus ? 0.8 : 1, ang ? 4.5 : 1, 1);
  }

  /* ===== 화면 크기 · 그리기 ===== */
  let W = 0, H = 0;
  function resize(w, h) { if (w === W && h === H) return; W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const tmp = new THREE.Vector3();
  function project(obj, dy = 0) { obj.getWorldPosition(tmp); tmp.y += dy; tmp.project(camera); return { x: (tmp.x + 1) / 2, y: (1 - tmp.y) / 2 }; }
  let lastT = 0;
  return {
    resize,
    // view: { t, tst, tm, dur, tf, party, m, zzz, slept, twitch, board: { lines:[{text,full,under}], font } }
    render(v) {
      const dt = clamp(v.t - lastT, 0, 0.1); lastT = v.t;
      const key = v.board.lines.map(l => l.text).join('|');
      if (key !== boardKey) { boardKey = key; cursor = paintBoard(v.board.lines, v.board.font); }
      poseTeacher(v, dt);
      const amp = 1 + (v.m - 1) * 0.3, tempo = 2.4 + (v.m - 1) * 0.8;
      kids.forEach((k, i) => {
        const me = k.o.me, mode = v.party ? 'dance' : 'sit';
        poseKid(k, mode, mode === 'dance' ? v.t * tempo * k.tp + k.ph : v.t, amp, me ? (v.slept ? 1 : clamp((v.zzz - 0.6) / 0.4, 0, 0.95) * (v.party ? 0 : 1)) : 0);
        glows[i].material.opacity = v.pv * 0.45; glows[i].material.color.setHex(GLOW[(i + Math.floor(v.t * 2)) % GLOW.length]);
      });
      // 파티: 교실이 살짝 어두워짐(선생님 쪽은 그대로 보이게 반구광만 낮춤)
      hemi.intensity = 1.35 - 0.45 * v.pv; sun.intensity = 1.6 - 0.5 * v.pv;
      const now = new Date(); hand1.rotation.z = -((now.getHours() % 12) / 12) * PI * 2; hand2.rotation.z = -(now.getMinutes() / 60) * PI * 2;
      fx.render(scene, camera);
    },
    // 화면 위 UI 위치(0~1): 선생님 머리 위 · 나 머리 위
    teacherHead() { return project(T.head, T.HR * 2.6); },
    meHead() { return project(kids[8].head, 0.5); },
    dispose() { renderer.dispose(); },
  };
}
