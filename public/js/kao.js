// SVMHS GROUND — 글자 이모티콘(카오모지) 줄바꿈 금지 (2026-10-25 하율: "글씨로 만든 이모티콘은 앞으로 무조건 안 잘리게")
// 화면에 새로 들어오는 모든 글자(DM·공지·댓글·토스트 등, 앞으로 생길 기능 포함)를 지켜보다가
// (๑•̀ㅂ•́)و✧ · ٩(ˊᗜˋ*)و · ^^ · ㅠㅠ 같은 덩어리를 <span class="kao">(white-space:nowrap)로 감싼다.
// 감싸지 않을 곳: 입력칸·편집 영역·script/style·svg·data-nokao 아래.
import { ffOn } from './flags.js';

const FF = 'kao-nowrap';
const K = '[^\\s가-힣A-Za-z0-9]';                                   // 이모티콘 글자(자모 ㅂ·ㅠ 포함, 완성형 한글·영문·숫자·공백 제외)
const PAREN = '[(（][^()（）\\n가-힣A-Za-z0-9]{1,24}[)）]';          // 괄호 얼굴
const RE = new RegExp(`${K}{0,6}${PAREN}${K}{0,6}|${K}{0,4}[\\^ㅠㅜ]${K}{1,6}`, 'gu');
const QUICK = /[(（\^ㅠㅜ]/;
const SKIP = 'script,style,textarea,input,select,option,svg,code,pre,[contenteditable],[data-nokao],.kao';

const html = document.documentElement;
const active = () => ffOn(FF, html.classList.contains('dev-pv'));

function wrapText(node) {
  const s = node.nodeValue;
  if (!s || s.length < 2 || !QUICK.test(s)) return;
  const p = node.parentElement;
  if (!p || p.closest(SKIP)) return;
  RE.lastIndex = 0;
  let m, last = 0, frag = null;
  while ((m = RE.exec(s))) {
    const t = m[0];
    // 괄호 하나·기호 하나뿐인 건 이모티콘 아님 ( "(!)" 정도는 감싸도 무해 )
    if (t.length < 2) continue;
    frag ||= document.createDocumentFragment();
    if (m.index > last) frag.append(s.slice(last, m.index));
    const sp = document.createElement('span');
    sp.className = 'kao'; sp.textContent = t;
    frag.append(sp);
    last = m.index + t.length;
  }
  if (!frag) return;
  if (last < s.length) frag.append(s.slice(last));
  node.replaceWith(frag);
}

function scan(root) {
  if (!root) return;
  if (root.nodeType === 3) { wrapText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1 && root.closest(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (QUICK.test(n.nodeValue)) list.push(n);
  list.forEach(wrapText);
}

let on = false;
const mo = new MutationObserver(recs => {
  if (!active()) return;
  for (const r of recs) {
    if (r.type === 'characterData') wrapText(r.target);
    else r.addedNodes.forEach(scan);
  }
});

function start() {
  if (on || !active()) return;
  on = true;
  scan(document.body);
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
}

// 개발자 미리보기 표시(dev-pv)는 로그인 뒤에 붙으므로 html class 변화도 지켜본다
new MutationObserver(start).observe(html, { attributes: true, attributeFilter: ['class'] });
if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
