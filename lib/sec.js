// 서버 공용 보안 도구 (functions 세 곳·lib가 같이 씀): 해시·난수·비밀번호·상수 시간 비교·쿠키 읽기·사용자 글 정리
export const enc = new TextEncoder();
export const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
export const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
// 비밀번호: PBKDF2-SHA256 10만 번 (Workers가 허용하는 최대 횟수)
export async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256));
}
// 길이가 같으면 끝까지 비교 (응답 시간으로 맞은 글자 수를 알 수 없게)
export const sameStr = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
export const cookieOf = (req, name) => (req.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(name + '='))?.slice(name.length + 1) || '';
// 사용자 글: 제어문자·보이지 않는 글자·방향 바꾸는 글자 제거 · 공백 정리 · 길이 제한(글자 수 기준)
export const clean = (s, max, multiline = false) => {
  let t = String(s ?? '').replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g : /[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  t = multiline ? t.replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ');
  return [...t.trim()].slice(0, max).join('');
};
