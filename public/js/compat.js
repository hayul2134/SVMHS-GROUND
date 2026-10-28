/* SVMHS GROUND — 오래된 기기 호환 (2026-10-28 하율: "모든 기기에서 가능하게 최적화")
 * 학교 태블릿은 관리 앱 때문에 OS 업데이트가 막혀 있는 경우가 많아서(예: iPadOS 15 사파리, 오래된 크롬·삼성 인터넷)
 * 최신 CSS 문법이 통째로 무시되면 색이 빠지고·빈 칸이 보이고·배치가 깨진다. 그런 기기에서만 아래를 한다:
 *   color-mix() → 지금 테마 색으로 계산한 값 / :has() → JS가 붙이는 표시용 클래스 / @container → 크기 감시 클래스
 *   cqw·cqi 단위 → 가장 가까운 컨테이너 폭 변수 / dvh·svh·lvh → vh / :focus-visible 섞인 선택자 → 나머지만 살림
 *   inert 속성, canvas roundRect 보충
 * 방법: style.css 원문을 받아 위 문법만 바꾼 사본을 같은 순서 그대로 <style>로 넣고 원래 <link>는 끈다(순서가 같아야 디자인이 안 바뀜).
 * 최신 브라우저는 첫 줄 검사만 하고 아무것도 안 함. 주소에 ?compat=force 를 붙이면 최신 브라우저에서도 강제로 켜서 결과를 비교할 수 있음.
 */
(function () {
  'use strict';
  var W = window, D = document, de = D.documentElement;
  var force = /[?&]compat=force\b/.test(location.search);
  var sup = function (p, v) { try { return !!(W.CSS && CSS.supports && CSS.supports(p, v)); } catch (e) { return false; } };
  var supSel = function (s) { try { return !!(W.CSS && CSS.supports && CSS.supports('selector(' + s + ')')); } catch (e) { return false; } };

  /* ---------- 작은 보충(항상 검사) ---------- */
  // inert: 지원 안 하면 속성만 남기고 CSS로 못 누르게
  if (!('inert' in HTMLElement.prototype)) {
    try {
      Object.defineProperty(HTMLElement.prototype, 'inert', {
        configurable: true,
        get: function () { return this.hasAttribute('inert'); },
        set: function (v) { if (v) this.setAttribute('inert', ''); else this.removeAttribute('inert'); }
      });
    } catch (e) {}
    W.__inertCss = ['[inert]{pointer-events:none;-webkit-user-select:none;user-select:none}', '[inert] *{pointer-events:none}'];
    try { var sh0 = D.styleSheets[D.styleSheets.length - 1]; for (var q0 = 0; q0 < W.__inertCss.length; q0++) sh0.insertRule(W.__inertCss[q0], sh0.cssRules.length); } catch (e) {}
  }
  // canvas roundRect (사파리 16 미만·크롬 99 미만)
  var C2 = W.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C2 && !C2.roundRect) {
    C2.roundRect = function (x, y, w, h, r) {
      var a = Array.isArray(r) ? r : [r == null ? 0 : r];
      var rr = function (v) { v = typeof v === 'object' && v ? (v.x || 0) : (+v || 0); return Math.max(0, Math.min(v, Math.abs(w) / 2, Math.abs(h) / 2)); };
      var tl = rr(a[0]), tr = rr(a.length > 1 ? a[1] : a[0]), br = rr(a.length > 2 ? a[2] : a[0]), bl = rr(a.length > 3 ? a[3] : (a.length > 1 ? a[1] : a[0]));
      this.moveTo(x + tl, y); this.lineTo(x + w - tr, y); this.arcTo(x + w, y, x + w, y + tr, tr);
      this.lineTo(x + w, y + h - br); this.arcTo(x + w, y + h, x + w - br, y + h, br);
      this.lineTo(x + bl, y + h); this.arcTo(x, y + h, x, y + h - bl, bl);
      this.lineTo(x, y + tl); this.arcTo(x, y, x + tl, y, tl); this.closePath();
    };
  }

  /* ---------- CSS 변환 필요 여부 ---------- */
  var need = {
    mix: force || !sup('color', 'color-mix(in srgb, red 50%, blue)'),
    has: force || !supSel(':has(*)'),
    fv: force || !supSel(':focus-visible'),
    cq: force || !sup('container-type', 'inline-size'),
    cqu: force || !sup('width', '1cqw'),
    dvh: force || !sup('height', '1dvh')
  };
  if (!need.mix && !need.has && !need.fv && !need.cq && !need.cqu && !need.dvh) return;

  var link = null, ls = D.querySelectorAll('link[rel="stylesheet"]');
  for (var i = 0; i < ls.length; i++) if (/\/css\/style\.css/.test(ls[i].getAttribute('href') || '')) link = ls[i];
  if (!link) return;
  var src = '';
  try { var x = new XMLHttpRequest(); x.open('GET', link.href, false); x.send(); if (x.status >= 200 && x.status < 300) src = x.responseText; } catch (e) {}
  if (!src) return;

  /* ---------- 아주 작은 CSS 파서 (주석·문자열·괄호를 지키며 블록 단위로) ---------- */
  function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }
  // 최상위에서 sep 문자로 자르기 (괄호·문자열 안은 무시)
  function splitTop(s, sep) {
    var out = [], d = 0, q = 0, st = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = 0; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '(' || c === '[') d++;
      else if (c === ')' || c === ']') d--;
      else if (c === sep && d === 0) { out.push(s.slice(st, i)); st = i + 1; }
    }
    out.push(s.slice(st)); return out;
  }
  function closeParen(s, open) { // s[open] === '('
    var d = 0, q = 0;
    for (var i = open; i < s.length; i++) {
      var c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = 0; continue; }
      if (c === '"' || c === "'") q = c; else if (c === '(') d++; else if (c === ')') { d--; if (!d) return i; }
    }
    return s.length - 1;
  }
  // 블록 파싱 → [{t:'rule',sel,body} | {t:'at',pre,kids} | {t:'raw',text}]
  function parse(s) {
    var items = [], i = 0, n = s.length;
    while (i < n) {
      while (i < n && /\s/.test(s[i])) i++;
      if (i >= n) break;
      var st = i, q = 0, d = 0;
      while (i < n) { // 머리말(선택자·@규칙) 끝 = { 또는 ;
        var c = s[i];
        if (q) { if (c === '\\') i++; else if (c === q) q = 0; }
        else if (c === '"' || c === "'") q = c;
        else if (c === '(') d++; else if (c === ')') d--;
        else if (d === 0 && (c === '{' || c === ';')) break;
        i++;
      }
      var head = s.slice(st, i).trim();
      if (i >= n) { if (head) items.push({ t: 'raw', text: head }); break; }
      if (s[i] === ';') { items.push({ t: 'raw', text: head + ';' }); i++; continue; }
      // 블록 본문
      var bs = ++i; d = 1; q = 0;
      while (i < n && d) {
        var c2 = s[i];
        if (q) { if (c2 === '\\') i++; else if (c2 === q) q = 0; }
        else if (c2 === '"' || c2 === "'") q = c2;
        else if (c2 === '{') d++; else if (c2 === '}') d--;
        i++;
      }
      var body = s.slice(bs, i - 1);
      if (head[0] === '@') {
        var name = (head.match(/^@([\w-]+)/) || [, ''])[1];
        if (/^(media|supports|container|layer|document)$/.test(name) || (/^-?\w*-?keyframes$/.test(name) && false)) items.push({ t: 'at', pre: head, kids: parse(body) });
        else if (/keyframes$/.test(name)) items.push({ t: 'kf', pre: head, kids: parse(body) });
        else items.push({ t: 'raw', text: head + '{' + body + '}' });
      } else items.push({ t: 'rule', sel: head, body: body });
    }
    return items;
  }

  /* ---------- 색 계산 (color-mix) ---------- */
  var probe = null;
  function toRGBA(str) {
    str = (str || '').trim();
    if (!str) return null;
    if (str === 'transparent') return [0, 0, 0, 0];
    if (!probe) { probe = D.createElement('i'); probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none'; }
    if (!probe.parentNode) (D.body || de).appendChild(probe);
    probe.style.color = ''; probe.style.color = str;
    if (!probe.style.color) return null;
    var m = getComputedStyle(probe).color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/);
    if (!m) return null;
    var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  function resolveVars(v, cs, depth) {
    if ((depth || 0) > 8) return v;
    var out = '', i = 0;
    while (true) {
      var k = v.indexOf('var(', i);
      if (k < 0) { out += v.slice(i); break; }
      out += v.slice(i, k);
      var e = closeParen(v, k + 3), inner = v.slice(k + 4, e), parts = splitTop(inner, ',');
      var name = parts[0].trim(), fb = parts.length > 1 ? parts.slice(1).join(',').trim() : '';
      var val = (cs.getPropertyValue(name) || '').trim();
      out += resolveVars(val || fb, cs, (depth || 0) + 1);
      i = e + 1;
    }
    return out;
  }
  function mixOne(args, cs) { // "in srgb, A p%, B q%"
    var parts = splitTop(args, ',');
    if (parts.length < 3) return null;
    var cols = [], pcts = [];
    for (var j = 1; j < 3; j++) {
      var p = parts[j].trim(), pm = p.match(/\s(-?[\d.]+)%\s*$/) || p.match(/^(-?[\d.]+)%\s/);
      var col = pm ? p.replace(pm[0], ' ').trim() : p, pct = pm ? parseFloat(pm[1]) : null;
      col = evalColor(col, cs); if (!col) return null;
      cols.push(col); pcts.push(pct);
    }
    var p1 = pcts[0], p2 = pcts[1];
    if (p1 == null && p2 == null) { p1 = 50; p2 = 50; } else if (p1 == null) p1 = 100 - p2; else if (p2 == null) p2 = 100 - p1;
    var sum = p1 + p2; if (sum <= 0) return null;
    var mult = sum < 100 ? sum / 100 : 1; p1 /= sum; p2 /= sum;
    var A = cols[0], B = cols[1], a = A[3] * p1 + B[3] * p2;
    var r = [0, 0, 0];
    for (var c = 0; c < 3; c++) r[c] = a ? (A[c] * A[3] * p1 + B[c] * B[3] * p2) / a : 0;
    a *= mult;
    return 'rgba(' + Math.round(r[0]) + ',' + Math.round(r[1]) + ',' + Math.round(r[2]) + ',' + (+a.toFixed(4)) + ')';
  }
  function evalColor(s, cs) {
    s = resolveVars(s, cs).trim();
    if (/color-mix\(/.test(s)) s = replaceMix(s, cs);
    if (s == null) return null;
    return toRGBA(s);
  }
  function replaceMix(v, cs) {
    var out = '', i = 0;
    while (true) {
      var k = v.indexOf('color-mix(', i);
      if (k < 0) { out += v.slice(i); break; }
      out += v.slice(i, k);
      var e = closeParen(v, k + 9), res = mixOne(resolveVars(v.slice(k + 10, e), cs), cs);
      if (res == null) return null;
      out += res; i = e + 1;
    }
    return out;
  }

  /* ---------- :has() → 클래스 ---------- */
  var HAS = [], hasKey = {};
  function levels(s) { var lv = [], d = 0, q = 0; for (var i = 0; i < s.length; i++) { var c = s[i]; if (q) { lv.push(d); if (c === q) q = 0; continue; } if (c === '"' || c === "'") q = c; if (c === '(' || c === '[') { lv.push(d); d++; continue; } if (c === ')' || c === ']') { d--; } lv.push(d); } return lv; }
  function compoundAt(s, pos) {
    var lv = levels(s), a = pos, b = pos;
    while (a > 0 && !(lv[a - 1] === 0 && /[\s>+~,]/.test(s[a - 1]))) a--;
    while (b < s.length && !(lv[b] === 0 && /[\s>+~,]/.test(s[b]))) b++;
    return s.slice(a, b);
  }
  function stripFn(s, re) { // re: 함수 이름 패턴, 괄호까지 지움
    var out = '', i = 0, m;
    var rx = new RegExp(re, 'g');
    while ((m = rx.exec(s))) {
      var k = m.index; if (k < i) continue;
      var open = k + m[0].length - 1, e = closeParen(s, open);
      out += s.slice(i, k); i = e + 1; rx.lastIndex = i;
    }
    return out + s.slice(i);
  }
  function candOf(comp) {
    var c = stripFn(comp, ':(has|not)\\(');
    c = c.replace(/::?[\w-]+(?!\()/g, function (p) { return /^:(first|last|only|nth|empty|root|checked|disabled|enabled|placeholder-shown|required|link)/.test(p) ? p : ''; });
    c = c.replace(/::?[\w-]+\([^)]*\)/g, function (p) { return /^:(is|where|nth)/.test(p) ? p : ''; });
    return c.trim() || '*';
  }
  function rwHas(sel) {
    var i = 0;
    while (true) {
      var k = sel.indexOf(':has(', i);
      if (k < 0) return sel;
      var e = closeParen(sel, k + 4), arg = rwHas(sel.slice(k + 5, e).trim());
      var comp = compoundAt(sel, k), cand = candOf(comp);
      var key = cand + '\u0001' + arg, id = hasKey[key];
      if (id == null) { id = hasKey[key] = HAS.length; HAS.push({ cand: cand, arg: /^[>+~]/.test(arg) ? arg : ' ' + arg, cls: '__h' + id }); }
      sel = sel.slice(0, k) + '.__h' + id + sel.slice(e + 1);
      i = k;
    }
  }
  function evalHas() {
    for (var h = 0; h < HAS.length; h++) {
      var H = HAS[h], els;
      try { els = D.querySelectorAll(H.cand); } catch (e) { continue; }
      for (var j = 0; j < els.length; j++) {
        var el = els[j], ok = false;
        try { ok = !!el.querySelector(':scope ' + H.arg); } catch (e) {}
        if (ok !== el.classList.contains(H.cls)) el.classList.toggle(H.cls, ok);
      }
      // 조건이 사라진 요소(후보에서 빠진 것 포함)도 정리
      var old = D.getElementsByClassName(H.cls);
      for (var m = old.length - 1; m >= 0; m--) { var o = old[m]; var still = false; try { still = o.matches(H.cand) && !!o.querySelector(':scope ' + H.arg); } catch (e) {} if (!still) o.classList.remove(H.cls); }
    }
  }

  /* ---------- @container → 크기 클래스 ---------- */
  var CQSEL = [], TH = {}; // TH['max260']=true
  function cqClass(pre) { // "@container (max-width:260px)" → ['__cqmax260', ...] (and 조건만)
    var conds = pre.replace(/^@container\s*/, '').split(/\s+and\s+/i), cls = '';
    for (var i = 0; i < conds.length; i++) {
      var m = conds[i].match(/\(\s*(max|min)-width\s*:\s*([\d.]+)px\s*\)/);
      if (!m) return null;
      var key = m[1] + Math.round(+m[2]); TH[key] = 1; cls += '.__cq' + key;
    }
    return cls;
  }
  var RO = W.ResizeObserver ? new ResizeObserver(function (ents) {
    for (var i = 0; i < ents.length; i++) applyCQ(ents[i].target, ents[i].contentRect.width);
  }) : null;
  var seen = W.WeakSet ? new WeakSet() : null;
  function applyCQ(el, w) {
    for (var k in TH) {
      var n = +k.slice(3), on = k[1] === 'a' ? w <= n : w >= n;
      if (on !== el.classList.contains('__cq' + k)) el.classList.toggle('__cq' + k, on);
    }
    if (need.cqu) el.style.setProperty('--__cqw', (w / 100) + 'px');
  }
  function scanCQ() {
    if (!CQSEL.length) return;
    var els; try { els = D.querySelectorAll(CQSEL.join(',')); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (seen && seen.has(el)) continue;
      if (seen) seen.add(el);
      if (RO) RO.observe(el); else applyCQ(el, el.clientWidth);
    }
  }

  /* ---------- 변환 ---------- */
  var MIXES = []; // {sel, prop, val}
  function tDecls(body, sel) {
    var ds = splitTop(body, ';'), out = [];
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i]; if (!d.trim()) continue;
      var c = d.indexOf(':'); if (c < 0) { out.push(d); continue; }
      var prop = d.slice(0, c).trim(), val = d.slice(c + 1);
      if (/^container-type$/i.test(prop) && need.cq) { if (CQSEL.indexOf(sel) < 0 && sel) CQSEL.push(sel); }
      if (need.dvh && /[\d.](d|s|l)v(h|w|min|max)\b/.test(val)) val = val.replace(/([\d.])(d|s|l)v(h|w|min|max)\b/g, '$1v$3');
      if (need.cqu && /[\d.]cq(w|i|h|b|min|max)\b/.test(val)) val = val.replace(/(-?[\d.]+)cq(w|i|h|b|min|max)\b/g, function (m0, n, u) { return 'calc(' + n + ' * ' + (/^(w|i)$/.test(u) ? 'var(--__cqw,1vw)' : '1vh') + ')'; });
      if (need.mix && /color-mix\(/.test(val)) { var id = MIXES.length; MIXES.push({ sel: sel, val: val }); out.push(prop + ':\u0002' + id + '\u0002'); continue; }
      out.push(prop + ':' + val);
    }
    return out.join(';');
  }
  function tSel(sel) {
    var items = splitTop(sel, ','), keep = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (need.fv && /:focus-visible/.test(it)) continue;  // 지원 안 하면 이 선택자만 버림(전엔 규칙 전체가 버려졌음)
      if (need.has && /:has\(/.test(it)) it = rwHas(it);
      keep.push(it);
    }
    return keep.join(',');
  }
  function prefix(sel, cls) { return splitTop(sel, ',').map(function (s) { return cls + ' ' + s.trim(); }).join(','); }
  // 규칙 하나하나를 문자열로 (CSP 때문에 <style>을 못 넣어서 원래 시트에 insertRule로 같은 순서대로 다시 채움)
  function emit(items, cqc, out) {
    out = out || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.t === 'raw') { if (/^@(import|charset|namespace)/.test(it.text)) continue; out.push(it.text); }
      else if (it.t === 'kf') { var kb = ''; for (var j = 0; j < it.kids.length; j++) { var k = it.kids[j]; kb += k.t === 'rule' ? k.sel + '{' + tDecls(k.body, '') + '}' : ''; } out.push(it.pre + '{' + kb + '}'); }
      else if (it.t === 'at') {
        if (/^@container/.test(it.pre) && need.cq) { var cc = cqClass(it.pre); if (cc) emit(it.kids, (cqc || '') + cc, out); }
        else { var inner = emit(it.kids, cqc, []); if (inner.length) out.push(it.pre + '{' + inner.join('\n') + '}'); }
      } else {
        var s = tSel(it.sel); if (!s) continue;
        if (cqc) s = prefix(s, cqc);
        out.push(s + '{' + tDecls(it.body, s) + '}');
      }
    }
    return out;
  }

  var RULES;
  try { RULES = emit(parse(stripComments(src))); } catch (e) { return; }
  var sheet = link.sheet; if (!sheet) return;
  var rootCS = getComputedStyle(de), MIXAT = [];
  for (var r0 = 0; r0 < RULES.length; r0++) if (RULES[r0].indexOf('\u0002') >= 0) MIXAT.push(r0);
  // color-mix 하나 = var(--__mN, 루트 기준 값). 요소마다 다른 변수(--tc 등 루트에 없는 변수)를 쓰면 tick에서 그 요소에 --__mN을 따로 넣음
  var LOCAL = [];
  function isLocal(M) {
    if (M.local != null) return M.local;
    var re = /var\(\s*(--[\w-]+)/g, m; M.local = false;
    while ((m = re.exec(M.val))) if (!(rootCS.getPropertyValue(m[1]) || '').trim()) { M.local = true; break; }
    if (M.local) { M.q = M.sel.replace(/:{1,2}(before|after|placeholder|selection|marker|backdrop|-webkit-[\w-]+)\b/g, '').replace(/:(hover|active|focus-within|focus)\b/g, ''); LOCAL.push(M); }
    return M.local;
  }
  function fill(txt) {
    return txt.replace(/\u0002(\d+)\u0002/g, function (m0, id) {
      var M = MIXES[+id], r = replaceMix(M.val, rootCS);
      if (r == null) r = 'unset';
      return isLocal(M) ? 'var(--__m' + id + ',' + r + ')' : r;
    });
  }
  function evalLocal() {
    for (var i = 0; i < LOCAL.length; i++) {
      var M = LOCAL[i], els, id = MIXES.indexOf(M);
      try { els = D.querySelectorAll(M.q); } catch (e) { continue; }
      for (var j = 0; j < els.length; j++) {
        var r = replaceMix(M.val, getComputedStyle(els[j]));
        if (r != null && els[j].style.getPropertyValue('--__m' + id) !== r) els[j].style.setProperty('--__m' + id, r);
      }
    }
  }
  // 원래 시트 비우고 바꾼 규칙으로 다시 채움. POS[i] = RULES[i]가 들어간 자리(못 들어간 건 -1)
  var POS = [];
  (function build() {
    var t0 = Date.now(), TX = [];
    for (var k = 0; k < RULES.length; k++) TX.push(RULES[k].indexOf('\u0002') >= 0 ? fill(RULES[k]) : RULES[k]);   // 원래 시트가 살아 있을 때 변수 값을 읽어 계산
    try { while (sheet.cssRules.length) sheet.deleteRule(sheet.cssRules.length - 1); } catch (e) { return; }
    var n = 0;
    for (var i = 0; i < TX.length; i++) { try { sheet.insertRule(TX[i], n); POS[i] = n++; } catch (e) { POS[i] = -1; } }
    if (W.__inertCss) for (var q = 0; q < W.__inertCss.length; q++) try { sheet.insertRule(W.__inertCss[q], sheet.cssRules.length); } catch (e) {}
    W.__compatMs = Date.now() - t0;
  })();
  de.classList.add('compat');
  function render() {
    for (var j = 0; j < MIXAT.length; j++) {
      var i = MIXAT[j], at = POS[i]; if (at < 0) continue;
      var txt = fill(RULES[i]);
      try { sheet.deleteRule(at); sheet.insertRule(txt, at); } catch (e) { try { sheet.insertRule('x-dead{}', at); } catch (e2) {} }
    }
  }

  /* ---------- 갱신 ---------- */
  var queued = false, lastMixKey = '';
  function mixKey() { return de.className.replace(/\b(__\w+|pre|compat)\b/g, '') + '|' + [].map.call(de.attributes, function (a) { return a.name === 'style' || a.name === 'class' ? '' : a.name + '=' + a.value; }).join(',') + '|' + (D.body ? D.body.className : ''); }
  function tick() {
    queued = false;
    if (need.mix) { var k = mixKey(); if (k !== lastMixKey) { lastMixKey = k; render(); } if (LOCAL.length) evalLocal(); }
    if (need.cq) scanCQ();
    if (need.has && HAS.length) evalHas();
    if (mo) mo.takeRecords();
  }
  function soon() { if (queued) return; queued = true; (W.requestAnimationFrame || setTimeout)(tick); }
  var mo = W.MutationObserver ? new MutationObserver(soon) : null;
  function start() {
    lastMixKey = ''; tick();
    if (mo) mo.observe(de, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'aria-selected', 'aria-expanded', 'data-theme', 'data-skin', 'data-tone', 'checked', 'disabled'] });
    D.addEventListener('input', soon, true); D.addEventListener('change', soon, true);
    W.addEventListener('pageshow', soon);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
  W.__compat = { need: need, has: HAS.length, mix: MIXES.length, cq: CQSEL.length, refresh: function () { lastMixKey = ''; soon(); } };
})();
