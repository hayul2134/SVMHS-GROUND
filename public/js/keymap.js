// SVMHS GROUND — 게임 키 설정(키 매핑) (2026-10-28 하율 "설정 버튼 만들어서 키 매핑 마음대로 할 수 있게" + "키 매핑이 들어가는 게임들은 다 추가해")
// 게임마다 동작 → 키(e.code, 자판 위치) 목록. 학생이 바꾼 것만 이 기기(localStorage sg_keys)에 저장. 한글 입력 상태에서도 e.code라 그대로 먹음.
// 새 게임에 키보드 조작을 넣으면: KEYDEF에 동작을 추가하고 게임 코드에서 actOf(game, e)로 동작을 읽을 것. 화면의 키 안내는 keysHtml로.
export const KEYDEF = {
  home: [['jump', '점프', ['Space', 'ArrowUp', 'KeyW']], ['duck', '숙이기', ['ArrowDown', 'KeyS']]],
  stair: [['turn', '방향 바꾸기', ['ArrowLeft', 'KeyF']], ['climb', '오르기', ['ArrowRight', 'KeyJ', 'Space']]],
  gear: [['left', '왼쪽 이동', ['ArrowLeft', 'KeyA']], ['right', '오른쪽 이동', ['ArrowRight', 'KeyD']], ['cw', '돌리기', ['ArrowUp', 'KeyX', 'KeyW']], ['ccw', '반대로 돌리기', ['KeyZ']],
    ['down', '내리기', ['ArrowDown', 'KeyS']], ['drop', '바로 놓기', ['Space']], ['hold', '보관', ['KeyC', 'ShiftLeft', 'ShiftRight']], ['pause', '멈춤', ['KeyP']]],
  cut: [['cut', '컷', ['KeyC', 'Space']]],
  reaction: [['tap', '누르기', ['Space']]],
};
const RESTART = ['restart', '다시 시작', ['KeyR']];   // 다시 시작 버튼이 있는 게임 공통(계단 오르기는 없음)
export const defsOf = g => [...(KEYDEF[g] || []), ...(g === 'stair' ? [] : [RESTART])];
export const MAX_KEYS = 3;
// 설정에 못 쓰는 키: 창·브라우저·입력기 조작 키
const BAN = new Set(['Escape', 'Tab', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'CapsLock', 'Lang1', 'Lang2', 'F5', 'F11', 'F12', 'ContextMenu', '']);
export const banned = code => BAN.has(code);

let cache = null;
const load = () => { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem('sg_keys') || '{}') || {}; } catch { cache = {}; } return cache; };
const save = () => { try { localStorage.setItem('sg_keys', JSON.stringify(cache)); } catch {} };

// { 동작: [키…] } — 바꾼 게 없으면 기본값
export function keysOf(g) {
  const mine = load()[g] || {}, out = {};
  for (const [a, , def] of defsOf(g)) out[a] = Array.isArray(mine[a]) ? mine[a] : def;
  return out;
}
// 눌린 키 → 동작 이름(없으면 '')
export function actOf(g, e) {
  const k = keysOf(g);
  for (const a in k) if (k[a].includes(e.code)) return a;
  return '';
}
export const isCustom = g => !!Object.keys(load()[g] || {}).length;
// 한 동작의 키 목록을 바꿈 — 같은 게임의 다른 동작에 같은 키가 있으면 거기선 뺌(한 키 = 한 동작)
export function setKeys(g, act, codes) {
  const all = keysOf(g), mine = { ...(load()[g] || {}) };
  for (const a in all) if (a !== act && all[a].some(c => codes.includes(c))) mine[a] = all[a].filter(c => !codes.includes(c));
  mine[act] = codes.slice(0, MAX_KEYS);
  // 기본값과 같아진 동작은 저장 안 함
  for (const [a, , def] of defsOf(g)) if (mine[a] && mine[a].length === def.length && mine[a].every((c, i) => c === def[i])) delete mine[a];
  cache[g] = mine; if (!Object.keys(mine).length) delete cache[g]; save();
}
export function resetKeys(g) { load(); delete cache[g]; save(); }

// 키 이름(화면 표시용)
const NAME = { Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', Enter: 'Enter', Backspace: '⌫', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Insert: 'Ins' };
export function keyName(c) {
  if (NAME[c]) return NAME[c];
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  if (/^Numpad/.test(c)) return '숫자판 ' + c.slice(6).replace('Enter', 'Enter').replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', '.');
  return c;
}
const kbd = c => `<kbd>${keyName(c).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[s])}</kbd>`;
// 키 안내 줄: acts = [[동작, '표시 글자'] …] → "<kbd>←</kbd><kbd>F</kbd> 방향 바꾸기 · …"
export function keysHtml(g, acts) {
  const k = keysOf(g);
  return acts.map(([a, t]) => (k[a]?.length ? k[a].map(kbd).join('') : '<kbd>없음</kbd>') + ' ' + t).join(' · ');
}
export const kbdOf = (g, a) => (keysOf(g)[a] || []).map(kbd).join('');
