// SVMHS GROUND — 소셜 API (/api/s/*): 계정 · 프로필 · 팔로우 · DM · 미니게임 랭킹
// D1 바인딩 이름 DB가 필요하다(없으면 { enabled:false }). 테이블은 첫 요청 때 자동으로 만든다.
// 선택: 가입 코드는 관리자 페이지(/admin) 설정 → 없으면 비밀 변수 JOIN_CODE. 정지된 계정은 로그인 불가.
import { balanceOf, balDay, openAt, closeAt, nextOpen, lastPeriod } from '../../../lib/balance.js';
import { rwNorm, GACHA, GACHA_ALL, RAR, GC, gcHave, gcEarn, gcItem, gcDone, fxOk, GC_TITLE, HIDDEN, HOME_TITLE, HOME_TITLE2, HOME_MARK, isHidden, FX, objName, SHN, RK, rkOf, rkRange, wkOf, wkRange, TIERS, tierAt, tierMode, BEST_N, tierOfK, gamePts, joinBonus } from '../../../public/js/att-rewards.js';
import { HOME_MAX, GOAL, scoreAt } from '../../../public/js/home-score.js';
import { GEAR_MAX, maxScore as gearMax } from '../../../public/js/gear-score.js';
import { ffOn } from '../../../public/js/flags.js';
import { MS, KIND, missionsOf, progOf, applyEv, weekKey, playCounts } from '../../../public/js/mission.js';
import { REWARDS, MILESTONES, rwOn, SHIELD_EVERY, shieldMaxOf, decoSlots, STK_MSG, unlockedOf, kstToday, missedDays, restDay, liveCur, liveMany, weekOf } from '../../../lib/attend.js';
import { patchState, patchSave, draftOut } from '../../../lib/patch.js';
import { randHex, sha256, hashPw, sameStr, cookieOf, clean } from '../../../lib/sec.js';
import { setup, getSettings, joinCodeOf, signupOpen, dmOpen, kstYmd, limited, countOf, ipKey, isWriteLimit, LIMIT_MSG, ADMIN_HANDLE, OLD_ADMIN_HANDLES, TEST_ACCOUNTS, TEST_GRADE, maskIp, logErr } from '../../../lib/db.js';

/* ===== 공용 목록 (public/js/social.js와 같게 유지) ===== */
const AVATARS = ['k:cat','k:dog','k:bear','k:bunny','k:frog','k:chick','k:hamster','k:penguin','k:fox','k:panda','k:dino','k:ghost','k:slime','k:sheep','k:whale','k:axolotl'];   // 2026-10-24: 동물 이모지 → 직접 그린 캐릭터 16종(테마 캐릭터 얼굴). 예전 이모지 값은 lib/db.js v20에서 옮김
const COLORS = ['sky','blue','mint','lime','yellow','peach','pink','violet','ink'];
const STICKERS = ['⭐','✨','💖','💙','🔥','🎬','🎥','📸','🎧','🎮','🍀','🌈','☁️','🌙','🍓','🧋','🐾','👑','💯','🎀','🫧','🪐','🦋','🌷','🍒','🎵','⚡','🌊'];
const GAMES = {   // 모두 '작을수록 좋음' (ms). play: 시작 티켓을 받은 뒤 기록을 내기까지 최소 걸리는 시간
  // 2026-10-24: 개발자 도구로 반응속도 100ms·1to25 2.5초·컷 0ms를 바로 보내 1등이 되던 문제 → 하한을 사람 기준으로 올리고
  // 판마다의 기록(rounds)을 같이 받아 서버가 다시 계산·검사(checkRounds). 하한을 바꾸면 lib/db.js v19 정리 쿼리도 같이
  reaction: { min: 120, max: 1500, play: 5000 },      // 반응속도 5번 평균 (매번 1초 이상 기다림) · 하한 140 → 120 (2026-10-26 하율)
  num25: { min: 4000, max: 600000, play: 2000 },      // 1→25 순서대로 누르기 · 하한 5000 → 4000 (2026-10-27 하율: 모바일은 훨씬 쉬움)
  cut: { min: 15, max: 6000, play: 5000 },            // 컷 타이밍 5번 오차 합 (매번 0.5초 대기 + 이동)
  home: { min: 1, max: HOME_MAX - 1, play: 1000 },     // 집에 가고 싶어!: HOME_MAX - 달린 거리(m) (멀리 갈수록 작음)
  gear: { min: 1, max: GEAR_MAX - 1, play: 3000, ff: 'gear-game' },   // 기자재 정리!(장비 테트리스, 2026-10-27 미리보기): GEAR_MAX - 점수 (높을수록 작음)
};
// 판별 기록 검사: 맞지 않으면 오류 문구, 괜찮으면 null. elapsed = 시작 티켓 이후 실제로 흐른 시간(ms)
// 검사에 걸리면 { a: 관리자용 이유, u: 학생에게 보여 줄 설명, bad: 문제 판 번호(0부터) } — 2026-10-26 하율: '기록이 이상해요' 대신 어떻게·왜 보류됐는지 직관적으로
const H = (a, u, bad) => ({ a, u, bad });
const RX_FREE = 1, RX_PEN = 50, RX_OUT = 5;   // 반응속도 부정출발 벌점 — public/js/social.js와 같게
const rxPen = f => Math.max(0, f - RX_FREE) * RX_PEN;
const sec = ms => (ms / 1000).toFixed(ms < 10000 ? 2 : 1) + '초';
function checkRounds(game, v, r, elapsed) {
  if (!Array.isArray(r)) return H('판 기록 없음(예전 화면)', '판마다의 기록이 같이 오지 않았어요.');
  const n = r.map(x => Math.round(+x));
  if (n.some(x => !Number.isFinite(x))) return H('판 기록에 숫자가 아닌 값', '판마다의 기록 중에 숫자가 아닌 값이 섞여 있어요.');
  const sum = n.reduce((a, b) => a + b, 0), spread = Math.max(...n) - Math.min(...n);
  const idx = f => n.map((x, i) => (f(x) ? i : -1)).filter(i => i >= 0);
  const which = is => is.map(i => `${i + 1}번째 판(${n[i]}ms)`).join(', ');
  if (game === 'reaction') {   // 평균이 v · 5번이 거의 같으면 기계 · 플레이 시간 (판 하나 빠른 건 통과)
    // 6번째 값 = 부정출발 횟수(2026-10-27 하율 "막 찍어서 너무 많이 틀리면 패널티"): 첫 번은 봐주고 그다음부터 한 번마다 +50ms, 5번이면 실격(화면이 기록을 안 보냄). 예전 화면은 5개(부정출발 0)
    const fouls = n.length === 6 ? n.pop() : 0;
    if (n.length !== 5) return H(`판 수가 5가 아님(${n.length})`, `5판이 모두 기록돼야 하는데 ${n.length}판만 기록됐어요.`);
    if (fouls < 0 || fouls >= RX_OUT) return H(`부정출발 횟수 이상(${fouls})`, `부정출발이 ${fouls}번으로 기록됐어요. ${RX_OUT}번이면 실격이라 기록이 남을 수 없어요.`);
    const sum5 = n.reduce((a, b) => a + b, 0), exp = Math.min(Math.round(sum5 / 5) + rxPen(fouls), 1500);
    // 판 하나가 빠르거나 느린 건 보류하지 않음 — 평균(기록)이 120ms 아래면 위의 범위 검사에서 걸림 (2026-10-26 13:37 하율 "평균이 이상하지 않는 이상 보류는 하지 말아")
    if (Math.abs(exp - v) > 1) return H(`평균+벌점(${exp})과 기록(${v})이 다름`, `5판의 평균${fouls > 1 ? '과 부정출발 벌점' : ''}을 더한 값(${exp}ms)과 최종 기록(${v}ms)이 서로 달라요.`);
    const spread5 = Math.max(...n) - Math.min(...n);   // 부정출발 횟수를 뺀 5판으로 다시 계산
    if (spread5 < 6) return H(`5판 차이가 ${spread5}ms뿐 — 매크로 의심`, `5판 기록이 거의 똑같아요(가장 빠른 판과 느린 판 차이 ${spread5}ms). 사람이 누르면 판마다 조금씩 달라지는데, 이렇게 일정하면 자동 클릭으로 보일 수 있어요.`);
    if (elapsed < 5000 + sum5) return H(`플레이 시간이 너무 짧음(${Math.round(elapsed / 1000)}초)`, `게임한 시간이 ${sec(elapsed)}로 너무 짧아요. 판마다 최소 1초는 기다려야 해서 이렇게 빨리 끝날 수 없어요.`);
  } else if (game === 'num25') {   // 25번 누른 시각(첫 탭 = 0, 예전 화면은 느린 기기에서 1~몇 ms가 찍혀 0~5 허용 — 2026-10-26 하율) + 틀린 벌점: 순서대로 늘고, 매크로 패턴(아래) 없음
    const pen = n.length === 26 ? n.pop() : -1;
    if (n.length !== 25 || pen < 0 || pen % 1000 || n[0] < 0 || n[0] > 5) return H('판 기록 형식이 다름', '1부터 25까지 누른 기록이 제대로 오지 않았어요.');
    // 탭 간격 검사(2026-10-27 하율 "이거 해결해"): 간격 하나가 60ms 미만이면 보류하던 걸 바꿈 — 두 손가락으로 거의 동시에 누르면(다음 숫자가 옆에 보일 때·마지막 24→25) 사람도 6~50ms가 나와 정상 기록이 줄줄이 보류됐음.
    // 이제는 매크로에서만 나오는 패턴만 봄: ① 60ms 미만 간격이 14번 이상(절반 넘게) ② 연속 4번 탭 합이 120ms 미만(5번을 0.12초 안에) ③ 간격이 기계처럼 일정(변동 계수 0.1 미만)
    // 같은 날 하율 "모바일은 훨씬 쉬워서 더 널널하게" → 8번·4탭 150ms·0.15에서 완화
    const iv = n.slice(1).map((x, i) => x - n[i]);
    if (iv.some(d => d < 0)) return H('누른 시각이 거꾸로 감', '누른 시각의 순서가 맞지 않아요.');
    const fast = iv.filter(d => d < 60).length;
    if (fast >= 14) return H(`60ms 미만 탭 간격이 ${fast}번 — 매크로 의심`, `숫자 사이를 0.06초(60ms)보다 빨리 넘어간 게 ${fast}번이에요(24번 중). 여러 손가락으로 동시에 누르는 건 괜찮지만 절반 넘게 이러면 자동 클릭으로 보일 수 있어요.`);
    for (let i = 0; i + 4 <= iv.length; i++) { const w = iv[i] + iv[i + 1] + iv[i + 2] + iv[i + 3]; if (w < 120) return H(`${i + 1}→${i + 5} 다섯 번 탭이 ${w}ms — 매크로 의심`,
      `${i + 1}번부터 ${i + 5}번까지 다섯 번을 ${w}ms(0.12초 미만) 안에 눌렀어요. 숫자를 찾으며 이렇게 연달아 누르기는 어려워서 자동 클릭으로 보일 수 있어요.`); }
    const mean = n[24] / 24, sd = Math.sqrt(iv.reduce((a, d) => a + (d - mean) ** 2, 0) / 24);
    if (sd / mean < 0.1) return H(`탭 간격이 너무 일정함(평균 ${Math.round(mean)}ms · 편차 ${Math.round(sd)}ms) — 매크로 의심`, `숫자 사이 간격이 매번 거의 똑같아요(평균 ${Math.round(mean)}ms, 차이 ${Math.round(sd)}ms). 사람은 숫자를 찾는 시간이 매번 달라서 이렇게 일정하기 어려워요.`);
    if (Math.abs(n[24] + pen - v) > 5) return H(`판 기록 합(${n[24] + pen})과 기록(${v})이 다름`, `누른 시각과 벌점을 더한 값(${sec(n[24] + pen)})이 최종 기록(${sec(v)})과 달라요.`);
    if (elapsed < n[24]) return H('플레이 시간보다 기록이 김', `실제로 게임한 시간(${sec(elapsed)})보다 기록(${sec(n[24])})이 더 길어요.`);
  } else if (game === 'home') {   // [거리 m, 달린 시간 ms]: 거리는 시간으로만 정해짐(home-score.js) + 실제로 흐른 시간보다 오래 달릴 수 없음
    if (n.length !== 2) return H('판 기록 형식이 다름', '달린 거리와 시간이 제대로 오지 않았어요.');
    const [m, ms] = n;
    if (m < 1 || ms < 300 || ms > 6 * 3600e3) return H(`달린 시간 이상(${ms}ms)`, `달린 시간(${sec(ms)})이 가능한 범위를 벗어났어요.`);
    if (HOME_MAX - m !== v || scoreAt(ms) !== m) return H(`거리(${m}m)가 달린 시간(${(ms / 1000).toFixed(1)}초)과 안 맞음`,
      `${(ms / 1000).toFixed(1)}초 동안 달리면 ${scoreAt(ms).toLocaleString('ko-KR')}m인데 ${m.toLocaleString('ko-KR')}m로 기록됐어요. 이 게임은 달린 시간으로 거리가 정해져서 둘이 맞아야 해요.`);
    if (ms > elapsed + 1000) return H(`실제 흐른 시간(${Math.round(elapsed / 1000)}초)보다 오래 달림`, `실제로 게임한 시간(${sec(elapsed)})보다 더 오래(${sec(ms)}) 달린 걸로 기록됐어요.`);
  } else if (game === 'gear') {   // [점수, 지운 줄, 놓은 블록 수, 플레이 ms] — gear-score.js 규칙으로 가능한 범위인지
    if (n.length !== 4) return H('판 기록 형식이 다름', '점수·줄·블록 수·시간이 제대로 오지 않았어요.');
    const [sc, ln, pc, ms] = n;
    if (GEAR_MAX - sc !== v) return H(`점수(${sc})와 기록(${v})이 다름`, '점수와 최종 기록이 서로 달라요.');
    if (sc < 1 || ln < 0 || pc < 1 || ms < 1000) return H('판 기록 값이 범위 밖', '점수·줄·블록 수 중에 있을 수 없는 값이 있어요.');
    if (ln * 10 > pc * 4) return H(`줄(${ln})이 블록 수(${pc})보다 많음`, `블록 ${pc}개로는 많아야 ${Math.floor(pc * 4 / 10)}줄까지 지울 수 있는데 ${ln}줄로 기록됐어요.`);
    if (pc > ms / 125 + 5) return H(`블록을 너무 빨리 놓음(${pc}개 · ${sec(ms)})`, `${sec(ms)} 동안 블록 ${pc}개를 놓았어요. 1초에 8개보다 빠르게 놓을 수는 없어서 자동 입력으로 보일 수 있어요.`);
    if (sc > gearMax(ln, pc)) return H(`점수(${sc})가 줄·블록 수로 낼 수 있는 최대(${gearMax(ln, pc)})보다 큼`, `${ln}줄 · 블록 ${pc}개로 낼 수 있는 점수는 많아야 ${gearMax(ln, pc).toLocaleString('ko-KR')}점인데 ${sc.toLocaleString('ko-KR')}점으로 기록됐어요.`);
    if (ms > elapsed + 1000) return H(`실제 흐른 시간(${Math.round(elapsed / 1000)}초)보다 오래 함`, `실제로 게임한 시간(${sec(elapsed)})보다 더 오래(${sec(ms)}) 한 걸로 기록됐어요.`);
  } else if (game === 'cut') {   // 5번 오차(0~1000) 합 = v
    if (n.length !== 5) return H('판 기록 형식이 다름', `5판이 모두 기록돼야 하는데 ${n.length}판만 기록됐어요.`);
    const off = idx(x => x < 0 || x > 1000);
    if (off.length) return H('오차가 0~1000ms 밖', `${which(off)}의 오차가 가능한 범위(0~1초)를 벗어났어요.`, off);
    if (sum !== v) return H(`판 기록 합(${sum})과 기록(${v})이 다름`, `5판 오차를 더한 값(${sum}ms)과 최종 기록(${v}ms)이 달라요.`);
  }
  return null;
}
const TICKET_RE = /^[0-9a-f]{32}$/;
const TICKET_TTL = 3600e3;

const HANDLE_RE = /^[a-z0-9_.]{3,16}$/;
const RESERVED = h => h.startsWith('test_') || h === ADMIN_HANDLE || OLD_ADMIN_HANDLES.includes(h);   // 테스트 계정·개발자(예전 아이디 포함) 아이디는 가입 불가
// 너무 쉬운 비밀번호 (가장 먼저 시도되는 것들) · 아이디와 같은 비밀번호는 거절
const WEAK = new Set(['123456', '1234567', '12345678', '123456789', '1234567890', '000000', '111111', '123123', '654321', 'password', 'qwerty', 'qwerty123', 'abc123', 'asdf1234', 'qwer1234', 'a12345', 'aa1234', '1q2w3e4r', '1q2w3e', 'iloveyou', 'svmhs', 'svmhs123']);
const weakPw = (pw, handle) => WEAK.has(pw.toLowerCase()) || pw.toLowerCase() === handle || /^(.)\1+$/.test(pw);
// 닉네임: 다른 사람과 같으면 안 됨(띄어쓰기·대소문자 무시) + 개발자·관리자로 보이는 이름 금지
const nameKey = n => String(n || '').replace(/\s+/g, '').toLowerCase();
const RESERVED_NAMES = new Set(['개발자', '관리자', '운영자', '운영진', 'developer', 'admin', 'administrator', 'svmhsground']);
async function nameIssue(db, name, selfId = 0) {
  const k = nameKey(name);
  if (RESERVED_NAMES.has(k)) return '쓸 수 없는 닉네임이에요';
  const r = await db.prepare("SELECT 1 FROM users WHERE lower(replace(name, ' ', '')) = ?1 AND id <> ?2 AND is_test = 0 LIMIT 1").bind(k, selfId).first();
  return r ? '이미 다른 친구가 쓰는 닉네임이에요. 다른 걸로 해 주세요' : '';
}
// 구글 연결·구글 로그인·구글로 비밀번호 재설정을 쓸 수 없는 계정 (개발자 계정은 구글이 털려도 관리자 권한이 넘어가지 않게)
const noGoogle = u => !u || u.handle === ADMIN_HANDLE || !!u.is_test;
const SESSION_DAYS = 30;   // 로그인 후 30일이 지나면 다시 로그인 (연장 없음 — 공용 태블릿에 로그인이 무한히 남지 않게)
const COOKIE = 'sg_s';
const SECURITY_HEADERS = { 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin', 'referrer-policy': 'no-referrer' };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS, ...extra },
});
const err = (msg, status = 400) => json({ error: msg }, status);

/* ===== 욕설 기본 필터 (프로필에 공개되는 글: 아이디·닉네임·소개·상태·동아리) =====
   띄어쓰기·특수문자·숫자를 빼고 검사 ('시 발', '씨1발' 등). 완벽하진 않음 → 나머지는 신고로 처리. DM은 사적인 대화라 검사하지 않음 */
const BAD = /씨발|시발|씨빨|씌발|ㅅㅂ|ㅆㅂ|병신|븅신|ㅂㅅ|좆|좃|존나|졸라|개새|개색|개세끼|새끼|쌔끼|썅|니애미|느금|니미|애미|애비|지랄|ㅈㄹ|미친놈|미친년|닥쳐|꺼져|엠창|창녀|걸레|섹스|fuck|shit|bitch/i;
const BAD_G = new RegExp(BAD.source, 'gi');
const isBad = (...xs) => xs.some(x => BAD.test(String(x || '').replace(/[\s\d_.\-~!@#$%^&*()+=|\\/?,'"`:;<>[\]{}·ㆍ]/g, '')));

/* ===== 구글 ID 토큰 확인: 구글 tokeninfo로 서명·만료를 확인하고 우리 사이트용(aud)인지 검사 ===== */
async function verifyGoogle(env, cred) {
  if (!env.GOOGLE_CLIENT_ID || typeof cred !== 'string' || cred.length > 4096) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    if (!r.ok) return null;
    const t = await r.json();
    if (t.aud !== env.GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || +t.exp * 1000 < Date.now() || !t.sub) return null;
    return { sub: String(t.sub), name: t.given_name || t.name || '' };
  } catch { return null; }
}

/* ===== 보안 도구 (공용은 lib/sec.js) ===== */
// 없는 아이디로 로그인할 때도 같은 시간이 걸리게 하는 가짜 해시 (응답 시간으로 아이디 존재 여부를 알 수 없게)
const DUMMY = { pw: '0'.repeat(64), salt: '00000000000000000000000000000000' };
const setCookie = (req, token, maxAge) => {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/api/s; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

// 관리자 계정이 로그아웃·비밀번호 변경·탈퇴하면 관리자 세션도 모두 끝냄 (쿠키도 지움)
const ADMIN_OUT = req => `sg_a=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
const endAdmin = (db, req, me, res) => {
  if (!me || me.handle !== ADMIN_HANDLE) return res;
  res.headers.append('set-cookie', ADMIN_OUT(req));
  return db.prepare('DELETE FROM admin_sessions').run().then(() => res);
};

// 테스트 계정으로 바꿔 들어간 동안 원래 개발자 세션 토큰을 보관하는 쿠키 (HttpOnly, 개발자 세션이 끝나는 때까지)
const DEV_COOKIE = 'sg_d';
const devCookie = (req, token, maxAge) => `${DEV_COOKIE}=${token}; Path=/api/s; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
async function devSession(req, db) {   // 보관된 개발자 세션이 아직 유효하면 { token, exp }
  const token = cookieOf(req, DEV_COOKIE);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await db.prepare('SELECT s.exp FROM sessions s JOIN users u ON u.id = s.uid WHERE s.token = ?1 AND u.handle = ?2 AND s.exp > ?3')
    .bind(await sha256(token), ADMIN_HANDLE, Date.now()).first();
  return r ? { token, exp: r.exp } : null;
}

/* ===== 사용자 ===== */
const PUB = 'id, handle, name, bio, avatar, color, grade, cls, club, mood, stickers, seen, insta, dm_pref, st_cur, st_best, st_last, st_total, st_shield, st_pf, st_title, st_rep, st_deco, gc_fx, gc_own, tier_last';
const pub = u => u && ({
  ...fxPub(u), gcm: isAdm(u) || gcDone(gcOwn(u)), handle: u.handle, name: u.name, title: u.st_title || '', rep: u.st_rep || '', bio: u.bio, avatar: u.avatar, color: u.color, grade: u.grade, cls: u.cls, club: u.club, mood: u.mood, insta: u.insta || '',
  stickers: (() => { try { return JSON.parse(u.stickers); } catch { return []; } })(), online: Date.now() - (u.seen || 0) < 150e3,
});
// 개발자(관리자) 계정은 제한을 모두 풂(2026-10-23 하율 지시): 출석 보상 전부 해금 · 시계 칸·방패 최대 · 내 행동 횟수 제한 없음 ·
// 밸런스 투표 없이 댓글·결과 보기 · DM 받기 설정·DM 끄기 무시. 단 상대가 개발자를 차단했으면 존중, 비밀번호 시도 제한은 보안상 유지
const isAdm = u => u?.handle === ADMIN_HANDLE;
// 주간 미션(2026-10-27 하율, 미리보기 깃발 week-mission): 모두 같은 미션 5개(public/js/mission.js), 미션에 나오는 게임 = 깃발 없는 게임만
// missions 표: day = 'w' + 그 주 월요일 · p = 진행 JSON. 미션 하나 끝낼 때마다 뽑기권 MS.tix장
const MS_GAMES = () => Object.keys(GAMES).filter(g => !GAMES[g].ff);
const misOut = (wk, p) => {
  const list = missionsOf(wk, MS_GAMES());
  return { wk, list: list.map((m, i) => { const c = progOf(m, p), done = !!p.d?.[i]; return { t: m.t, k: m.k, g: m.g || '', n: m.n, c, done, ready: !done && c >= m.n }; }), rw: MS };
};
async function misGet(db, me, wk = weekKey()) {
  const row = await db.prepare('SELECT p FROM missions WHERE uid = ?1 AND day = ?2').bind(me.id, 'w' + wk).first();
  let p = {}; try { p = JSON.parse(row?.p || '{}') || {}; } catch {}
  return { row, p };
}
// 행동 하나 → 진행만 올림. 뽑기권은 미션 창 '받기'(POST misclaim)로 직접 받음(2026-10-27 하율) — p.d[i] = 받음
// 이번 주 미션 중 이 행동으로 올라갈 게 없으면 DB를 안 건드림. 두 탭 동시 요청은 이전 값 조건으로 한 번만
// 응답에 붙일 값: 새로 받을 수 있게 된 미션이 있을 때만 { …misOut, got } (없으면 null)
async function misEv(db, me, ev, x) {
  try {
    if (!ffOn('week-mission', isAdm(me))) return null;
    const wk = weekKey(), list = missionsOf(wk, MS_GAMES());
    for (let tryN = 0; tryN < 3; tryN++) {
      const { row, p } = await misGet(db, me, wk);
      if (!list.some((m, i) => !p.d?.[i] && KIND[m.k].ev === ev)) return null;
      const q = applyEv(p, ev, x), got = [];
      list.forEach((m, i) => { if (!q.d[i] && progOf(m, q) >= m.n && progOf(m, p) < m.n) got.push(i); });
      const js = JSON.stringify(q);
      if (js === (row?.p || '{}')) return null;
      const ok = row
        ? await db.prepare('UPDATE missions SET p = ?1 WHERE uid = ?2 AND day = ?3 AND p = ?4 RETURNING uid').bind(js, me.id, 'w' + wk, row.p).first()
        : await db.prepare('INSERT INTO missions (uid, day, p) VALUES (?1, ?2, ?3) ON CONFLICT (uid, day) DO NOTHING RETURNING uid').bind(me.id, 'w' + wk, js).first();
      if (!ok) continue;
      if (!got.length) return null;
      return { ...misOut(wk, q), got };
    }
  } catch (e) { await logErr(db, 's', { url: 'https://svmhs-ground.pages.dev/mission/' + ev, method: 'MISSION' }, e); }
  return null;
}
const ALL_OPEN = 1e6;
// 개발자는 어떤 랭킹·1등 표시에도 안 나옴 (scores 쿼리에 붙이는 조건)
const OWNER_HANDLE = 'hayul2094';   // 하율 본인(학생용) 계정
const NOT_DEV = `uid NOT IN (SELECT id FROM users WHERE handle = '${ADMIN_HANDLE}')`;
const effBest = u => isAdm(u) ? ALL_OPEN : u.st_best || 0, effTotal = u => isAdm(u) ? ALL_OPEN : u.st_total || 0;
const jsonArr = v => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
// 뽑기: 가진 스티커 {값: 나온 횟수}. 개발자는 전부 가진 것으로
// gc_own(가진 뽑기 보상) 고치기: 읽은 값이 그대로일 때만 씀 → 동시에 뽑기·선물이 와도 서로 덮어써 날아가지 않음.
// fn(o)가 false를 돌려주면 바꿀 게 없음. 반환: 바꿨으면 true, 바꿀 게 없으면 false, 계속 부딪혀 못 바꿨으면 null
async function ownEdit(db, uid, fn) {
  for (let t = 0; t < 8; t++) {
    const cur = await db.prepare('SELECT gc_own FROM users WHERE id = ?1').bind(uid).first();
    if (!cur) return null;
    const o = gcOwn(cur);
    if (fn(o) === false) return false;
    if (await db.prepare('UPDATE users SET gc_own = ?1 WHERE id = ?2 AND gc_own = ?3 RETURNING id').bind(JSON.stringify(o), uid, cur.gc_own || '{}').first()) return true;
  }
  return null;
}
const gcOwn = u => { try { const o = JSON.parse(u?.gc_own || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };
const gcStk = u => isAdm(u) ? GACHA_ALL.filter(g => !g.fx).flatMap(g => [g.v, g.v + SHN]) : gcHave(gcOwn(u));   // 반짝이(_s)도
// 켜 둔 뽑기 효과 {name, prof, clock, masc} — 가진 것만 인정(개발자는 전부)
const gcFx = u => { let o; try { o = JSON.parse(u?.gc_fx || '{}'); } catch { o = {}; } const own = gcOwn(u), out = {};
  for (const k of Object.keys(FX)) if (o && fxOk(k, o[k]) && ((isAdm(u) && !isHidden(o[k])) || own[o[k]] > 0)) out[k] = o[k]; return out; };   // 히든 보상은 개발자도 '가진 것'만
// 남에게 보이는 효과만(닉네임·프로필 등장) — 랭킹·댓글·DM·프로필로 나감
const fxPub = u => { const f = gcFx(u); return { nfx: f.name || '', pfx: f.prof || '', mfx: f.masc || '' }; };   // mfx: 착용 소품(프로필 사진 위 왕관)
// 쓸 수 있는 보상 스티커 = 출석 보상 스티커 + 뽑기 스티커
const rwStk = u => [...unlockedOf(effBest(u), effTotal(u), 'sticker'), ...gcStk(u)];
const gcPub = u => ({ tix: isAdm(u) ? ALL_OPEN : u.gc_tix ?? 0, shard: u.gc_shard || 0, pity: u.gc_pity || 0, leg: u.gc_leg || 0, own: isAdm(u) ? Object.fromEntries(GACHA.flatMap(g => g.fx ? [[g.v, 1]] : [[g.v, 1], [g.v + SHN, 1]])) : gcOwn(u), fx: gcFx(u) });
// 스티커만 보내는 댓글·DM('::r:이름'): 내가 받은 출석 보상 스티커만 허용 → 틀리면 오류 문구, 스티커가 아니면 null
const stkErr = (me, text) => { const m = STK_MSG.exec(text); return m && !rwStk(me).includes(rwNorm(m[1])) ? '아직 받지 못한 스티커예요' : null; };
const card = u => u && ({ handle: u.handle, name: u.name, rep: u.st_rep || '', nfx: fxPub(u).nfx, mfx: fxPub(u).mfx, avatar: u.avatar, color: u.color, mood: u.mood, online: Date.now() - (u.seen || 0) < 150e3 });
const byHandle = (db, h) => db.prepare(`SELECT ${PUB} FROM users WHERE handle = ?1`).bind(String(h || '').toLowerCase()).first();

async function auth(req, db) {
  const token = cookieOf(req, COOKIE);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await db.prepare(`SELECT u.id, u.handle, u.name, u.bio, u.avatar, u.color, u.grade, u.cls, u.club, u.mood, u.stickers, u.seen, u.insta, u.dm_pref, u.google_sub, u.is_test, u.st_cur, u.st_best, u.st_last, u.st_total, u.st_shield, u.st_pf, u.st_title, u.st_rep, u.st_deco, u.gc_tix, u.gc_own, u.gc_pity, u.gc_leg, u.gc_shard, u.gc_fx, s.exp
    FROM sessions s JOIN users u ON u.id = s.uid WHERE s.token = ?1
    AND NOT EXISTS (SELECT 1 FROM bans b WHERE b.uid = u.id AND (b.until = 0 OR b.until > ?2))`).bind(await sha256(token), Date.now()).first();
  if (!row || row.exp < Date.now()) return null;
  if (Date.now() - row.seen > 60e3) await db.prepare('UPDATE users SET seen = ?1 WHERE id = ?2').bind(Date.now(), row.id).run();
  return row;
}
async function newSession(req, db, uid) {
  const token = randHex(32);
  await db.prepare('INSERT INTO sessions (token, uid, exp) VALUES (?1, ?2, ?3)').bind(await sha256(token), uid, Date.now() + SESSION_DAYS * 86400e3).run();
  await db.prepare('DELETE FROM sessions WHERE exp < ?1').bind(Date.now()).run();
  return setCookie(req, token, SESSION_DAYS * 86400);
}
// 관계: 내가 팔로우 · 나를 팔로우 · 내가 차단 · 나를 차단
async function rel(db, me, other) {
  const r = await db.prepare(`SELECT
      EXISTS(SELECT 1 FROM follows WHERE a = ?1 AND b = ?2) AS fo, EXISTS(SELECT 1 FROM follows WHERE a = ?2 AND b = ?1) AS fb,
      EXISTS(SELECT 1 FROM blocks WHERE a = ?1 AND b = ?2) AS bl, EXISTS(SELECT 1 FROM blocks WHERE a = ?2 AND b = ?1) AS bb`).bind(me, other).first();
  return { following: !!r.fo, followsMe: !!r.fb, blocked: !!r.bl, blockedMe: !!r.bb };
}
const friendIds = async (db, me) => (await db.prepare('SELECT f.b AS id FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a WHERE f.a = ?1').bind(me).all()).results.map(r => r.id);
// DM 보내도 되는지: 받는 사람(u)의 설정 — 0 서로 팔로우 · 1 받는 사람이 나를 팔로우 · 2 누구나. 차단은 항상 막음
// 개발자에게는 누구나 팔로우 없이 DM 가능(학생 피드백 창구, 2026-10-23) — 차단은 그대로 존중
const dmAllowed = (u, r) => !r.blocked && !r.blockedMe && (isAdm(u) || (u.dm_pref || 0) === 2 || ((u.dm_pref || 0) === 1 && r.followsMe) || (r.following && r.followsMe));
const pairOf = (x, y) => x < y ? `${x}:${y}` : `${y}:${x}`;

/* ===== 라우터 ===== */
export async function onRequest({ request: req, env, params }) {
  const path = (params.path || []).join('/');
  if (!env.DB) return json({ enabled: false });
  const db = env.DB;
  try { await setup(db); } catch (e) { console.error(e); return isWriteLimit(e) ? json({ error: LIMIT_MSG, limit: true }, 503) : err('잠시 후 다시 시도해 주세요', 500); }
  const method = req.method;
  let body = {};
  if (method === 'POST') {
    // 다른 사이트에서 대신 요청 보내는 것 막기 (JSON만 받음 → 교차 출처는 사전 확인에서 막힘)
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return err('forbidden', 403);
    if (req.headers.get('sec-fetch-site') === 'cross-site') return err('forbidden', 403);
    const cap = path === 'feedback' ? 4 << 20 : 32768;   // 의견(사진 5장까지)만 4MB, 나머지 API는 32KB 넘는 요청이 없음
    if (+(req.headers.get('content-length') || 0) > cap) return err(path === 'feedback' ? '사진 용량이 너무 커요' : 'too large', 413);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return err('bad content type', 415);
    try { body = await req.json(); } catch { return err('bad body'); }
    if (!body || typeof body !== 'object') return err('bad body');
  } else if (method !== 'GET') return err('method not allowed', 405);

  try {
    const route = ROUTES[`${method} ${path.split('/')[0]}`];
    if (!route) return err('not found', 404);
    return await route({ req, env, db, body, arg: decodeURIComponent(path.split('/')[1] || ''), url: new URL(req.url) });
  } catch (e) {
    console.error(e);
    if (isWriteLimit(e)) return json({ error: LIMIT_MSG, limit: true }, 503);
    await logErr(db, 's', req, e);
    return err('잠시 후 다시 시도해 주세요', 500);
  }
}

/* ===== 밸런스 게임 상태 (투표 전엔 결과·댓글을 숨김 — 마감 뒤엔 모두에게 공개) ===== */
async function balState(env, db, me) {
  const ymd = balDay(), now = Date.now();
  const qab = await balanceOf(db, ymd);   // 한 번 나온 질문은 다시 안 나옴 — 남은 질문이 없으면 게임을 숨김
  if (!qab) return { enabled: false };
  const [q, a, b] = qab;
  const last = await lastPeriod(env, db, ymd), opens = openAt(ymd), closes = closeAt(ymd, last), open = now >= opens && now < closes;
  const [votes, mineRow, ncom] = await db.batch([
    db.prepare('SELECT pick, COUNT(*) AS n FROM balance_votes WHERE ymd = ?1 GROUP BY pick').bind(ymd),
    db.prepare('SELECT pick FROM balance_votes WHERE ymd = ?1 AND voter = ?2').bind(ymd, 'u' + me.id),
    db.prepare('SELECT COUNT(*) AS n FROM balance_comments WHERE ymd = ?1').bind(ymd),
  ]);
  const counts = { a: 0, b: 0 };
  for (const r of votes.results) if (r.pick in counts) counts[r.pick] = r.n;
  const mine = mineRow.results[0]?.pick || '';
  let comments = null;
  if (mine || !open || isAdm(me)) {
    comments = (await db.prepare(`SELECT c.id, c.uid, c.body, c.at, COALESCE(v.pick, c.pick) AS pick, u.handle, u.name, u.avatar, u.color, u.st_rep, u.gc_fx, u.gc_own,
      (SELECT COUNT(*) FROM balance_comment_likes l WHERE l.cid = c.id) AS likes, EXISTS (SELECT 1 FROM balance_comment_likes l WHERE l.cid = c.id AND l.uid = ?2) AS liked
      FROM balance_comments c JOIN users u ON u.id = c.uid LEFT JOIN balance_votes v ON v.ymd = c.ymd AND v.voter = 'u' || c.uid
      WHERE c.ymd = ?1 AND NOT EXISTS (SELECT 1 FROM blocks k WHERE (k.a = ?2 AND k.b = c.uid) OR (k.a = c.uid AND k.b = ?2))
      AND NOT EXISTS (SELECT 1 FROM bans x WHERE x.uid = c.uid AND (x.until = 0 OR x.until > ?3))
      ORDER BY (u.handle = ?4) DESC, c.id DESC LIMIT 100`).bind(ymd, me.id, now, ADMIN_HANDLE).all()).results
      .map(r => ({ id: r.id, body: r.body, at: r.at, pick: r.pick, me: r.uid === me.id, dev: r.handle === ADMIN_HANDLE, handle: r.handle, name: r.name, rep: r.st_rep || '', nfx: fxPub(r).nfx, avatar: r.avatar, color: r.color, likes: r.likes, liked: !!r.liked }));
  }
  return { enabled: true, ymd, q, a, b, last, opens, closes, next: nextOpen(ymd), now, open, counts, mine, dev: isAdm(me), ncom: ncom.results[0].n, comments };
}

const needMe = fn => async ctx => {
  const me = await auth(ctx.req, ctx.db);
  if (!me) return err('로그인이 필요해요', 401);
  return fn({ ...ctx, me });
};

const ROUTES = {
  /* ----- 업데이트 공지: 게시본은 모두에게, 다음 공지 초안은 개발자에게만 (lib/patch.js) ----- */
  'GET patch': async ({ req, db }) => {
    const s = await patchState(db), me = await auth(req, db);
    return json({ list: (s.pub || []).map(({ id, date, title, items, ff }) => ({ id, date, title, items, ff: ff || [] })), draft: isAdm(me) ? draftOut(s.d) : undefined });
  },
  'POST patch': needMe(async ({ db, me, body }) => {
    if (!isAdm(me)) return err('개발자만 고칠 수 있어요', 403);
    try { const s = await patchSave(db, body); return json({ ok: true, draft: draftOut(s.d), published: !!s.published }); }
    catch (e) { if (e.status) return err(e.message, e.status); throw e; }
  }),
  /* ----- 계정 ----- */
  'GET config': async ({ env, db }) => {
    const st = await getSettings(db);
    return json({ enabled: true, google: env.GOOGLE_CLIENT_ID || '', needCode: Boolean(joinCodeOf(env, st)), signup: signupOpen(st), dm: dmOpen(st) });
  },

  'POST signup': async ({ req, env, db, body }) => {
    const handle = String(body.handle || '').trim().toLowerCase(), name = clean(body.name, 20), pw = String(body.pw || '');
    if (!HANDLE_RE.test(handle)) return err('아이디는 영어 소문자·숫자·_·. 로 3~16자예요');
    if (RESERVED(handle)) return err('쓸 수 없는 아이디예요');
    if (!name) return err('이름(닉네임)을 적어 주세요');
    if (isBad(handle, name)) return err('욕설이나 나쁜 말은 아이디·닉네임에 쓸 수 없어요');
    const club = clean(body.club, 16);
    if (club && isBad(club)) return err('욕설이나 나쁜 말은 쓸 수 없어요');
    if (pw.length < 6 || pw.length > 64) return err('비밀번호는 6~64자로 해 주세요');
    { const ni = await nameIssue(db, name); if (ni) return err(ni); }
    if (weakPw(pw, handle)) return err('너무 쉬운 비밀번호예요. 다른 걸로 해 주세요');
    const st = await getSettings(db), code = joinCodeOf(env, st);
    if (!signupOpen(st)) return err('지금은 새로 가입할 수 없어요', 403);
    // 학교 와이파이는 한 반·한 학년이 IP 하나를 같이 씀 → 가입 자체는 IP당 넉넉하게(1시간 300번),
    // 가입 코드 대입 방지는 '코드를 틀린 횟수'만 따로 IP당 1시간 30번으로 제한
    const ik = await ipKey(req);
    if (await limited(db, 'su:' + ik, 300, 3600)) return err('가입 시도가 너무 많아요. 나중에 다시 해 주세요', 429);
    if (code) {
      if (await countOf(db, 'cw:' + ik) >= 30) return err('가입 코드를 너무 많이 틀렸어요. 1시간 뒤에 다시 해 주세요', 429);
      if (!sameStr(String(body.code || '').trim(), code)) { await limited(db, 'cw:' + ik, 30, 3600); return err('가입 코드가 달라요'); }
    }
    if (await db.prepare('SELECT 1 FROM users WHERE handle = ?1').bind(handle).first()) return err('이미 있는 아이디예요');
    const salt = randHex(16);
    const g = +body.grade, c = +body.cls;
    const gift = joinBonus(kstYmd());   // 배포 첫 2주 가입 선물(att-rewards.js JOIN)
    const u = await db.prepare(`INSERT INTO users (handle, name, pw, salt, created, avatar, grade, cls, seen, club, gc_tix) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?5, ?9, ?10) RETURNING id`)
      .bind(handle, name, await hashPw(pw, salt), salt, Date.now(), AVATARS[Math.floor(Math.random() * 16)],
        g >= 1 && g <= 3 ? g : 0, c >= 1 && c <= 6 ? c : 0, club, GC.start + gift).first();
    return json({ ok: true, gift }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },

  'POST login': async ({ req, db, body }) => {
    const handle = String(body.handle || '').trim().toLowerCase(), pw = String(body.pw || '');
    // 아이디+IP 기준으로 막아서, 다른 사람이 일부러 틀려도 내 기기에서는 계속 로그인할 수 있게 함. 아이디 전체 한도는 여러 IP로 대입하는 것 대비
    const ik = await ipKey(req), h = handle.slice(0, 16);
    if (await limited(db, 'li:' + ik, 600, 600) ||   /* IP당 10분 600번: 반 전체가 같은 IP로 동시에 로그인해도 안 막힘 */ await limited(db, 'lh:' + h + ':' + ik, 10, 600) || await countOf(db, 'lg:' + h) >= 60) return err('로그인 시도가 너무 많아요. 잠시 뒤에 다시 해 주세요', 429);
    const u = HANDLE_RE.test(handle) && await db.prepare('SELECT id, pw, salt FROM users WHERE handle = ?1').bind(handle).first();
    const ok = sameStr(await hashPw(pw, (u || DUMMY).salt), (u || DUMMY).pw);   // 없는 아이디도 똑같이 해시 계산
    if (!u || !ok) { await limited(db, 'lg:' + h, 60, 3600); return err('아이디나 비밀번호가 맞지 않아요', 401); }   // 아이디 전체로는 '틀린 횟수'만 셈(여러 IP로 대입하는 것 대비)
    const ban = await db.prepare('SELECT until, reason FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(u.id, Date.now()).first();
    if (ban) {
      const when = ban.until ? new Date(ban.until + 9 * 3600e3).toISOString().slice(5, 16).replace('-', '/').replace('T', ' ') + '까지' : '무기한';
      return err(`이용이 정지된 계정이에요 (${when}${ban.reason ? ' · ' + ban.reason : ''})`, 403);
    }
    return json({ ok: true }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },

  'POST logout': async ({ req, db }) => {
    const token = cookieOf(req, COOKIE), me = await auth(req, db), dev = me?.is_test ? await devSession(req, db) : null;
    if (/^[0-9a-f]{64}$/.test(token)) await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha256(token)).run();
    if (dev) await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha256(dev.token)).run();   // 테스트 계정에서 로그아웃하면 개발자 로그인도 끝
    const res = json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) });
    if (cookieOf(req, DEV_COOKIE)) res.headers.append('set-cookie', devCookie(req, '', 0));
    return endAdmin(db, req, me, res);
  },

  'GET me': async ({ req, db }) => {
    try { await settleRounds(db); } catch (e) { console.log('settleRounds', e?.message); }   // 끝난 게임 랭킹 라운드 보상(한 번만)
    const me = await auth(req, db);
    if (!me) return json({ me: null });
    const [unread, fo, fb, fr] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE b = ?1 AND seen = 0 AND del = 0').bind(me.id).first(),
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE a = ?1').bind(me.id).first(),
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE b = ?1').bind(me.id).first(),
      friendIds(db, me.id),
    ]);
    const sw = me.handle === ADMIN_HANDLE ? 'dev' : me.is_test && await devSession(req, db) ? Object.keys(TEST_ACCOUNTS).find(k => TEST_ACCOUNTS[k].handle === me.handle) : '';
    const rkGift = (await db.prepare("SELECT round, substr(game, 3) AS game, place, tix FROM rank_rewards WHERE uid = ?1 AND seen = 0 AND game LIKE 'w:%' ORDER BY round, game").bind(me.id).all()).results;
    return json({ me: { ...pub(me), online: true, dmPref: me.dm_pref || 0, google: !!me.google_sub, sw, attBest: effBest(me), attTotal: effTotal(me), deco: jsonArr(me.st_deco), gc: gcPub(me), sessExp: me.exp }, unread: unread.n, counts: { following: fo.n, followers: fb.n, friends: fr.length }, rkGift });
  },

  'POST me': needMe(async ({ db, me, body }) => {
    const name = clean(body.name, 20);
    if (!name) return err('이름(닉네임)을 적어 주세요');
    if (isBad(name, body.bio, body.mood, body.club, isAdm(me) ? body.title : '')) return err('욕설이나 나쁜 말은 쓸 수 없어요');
    if (nameKey(name) !== nameKey(me.name) && me.handle !== ADMIN_HANDLE) { const ni = await nameIssue(db, name, me.id); if (ni) return err(ni); }
    // 출석 보상으로 해금한 프로필 사진·스티커도 허용 (최고 연속 기록 기준)
    const ub = k => k === 'sticker' ? rwStk(me) : [...unlockedOf(effBest(me), effTotal(me), k), ...(k === 'title' && gcDone(gcOwn(me)) ? [GC_TITLE] : []), ...(k === 'title' && gcOwn(me)['r:fxkey'] > 0 ? [HOME_TITLE] : []), ...(k === 'title' && (gcOwn(me)[HOME_MARK] > 0 || gcOwn(me)['r:fxkey'] > 0) ? [HOME_TITLE2] : [])];   // 스티커는 뽑기 스티커도
    // 예전 보상 이름(r:lion 등)은 새 이름으로 바꿔서 검사 (2026-10-24 그림 교체)
    body.avatar = rwNorm(body.avatar);
    if (Array.isArray(body.stickers)) body.stickers = body.stickers.map(rwNorm);
    if (Array.isArray(body.deco)) body.deco = body.deco.map(rwNorm);
    if (body.rep !== undefined) body.rep = String(body.rep).split(',').map(rwNorm).join(',');
    const avOk = [...AVATARS, ...ub('avatar')], stOk = [...STICKERS, ...ub('sticker')], coOk = [...COLORS, ...ub('color')];
    const avatar = avOk.includes(body.avatar) ? body.avatar : me.avatar;
    const color = coOk.includes(body.color) ? body.color : me.color;
    const adm = isAdm(me);   // 개발자: 치장 제한 없음 — 스티커 12개 · 시계 5칸 · 대표 스티커 3개 · 칭호 직접 쓰기
    const title = adm ? clean(body.title, 12) : body.title === '' || ub('title').includes(body.title) ? String(body.title) : (me.st_title || '');
    const stickers = (Array.isArray(body.stickers) ? body.stickers : []).filter(s => stOk.includes(s)).slice(0, adm ? 12 : 6);
    // 대표 스티커·시계 스티커는 출석 보상 스티커만 (안 보냈으면 그대로 둠)
    const repIn = body.rep === undefined ? null : String(body.rep).split(',').filter(Boolean);
    const rep = repIn === null ? (me.st_rep || '') : repIn.every(v => ub('sticker').includes(v)) ? [...new Set(repIn)].slice(0, adm ? 3 : 1).join(',') : (me.st_rep || '');
    const deco = Array.isArray(body.deco) ? [...new Set(body.deco.filter(s => ub('sticker').includes(s)))].slice(0, adm ? 5 : decoSlots(effBest(me), effTotal(me))) : jsonArr(me.st_deco);
    const dev = me.handle === ADMIN_HANDLE, g = dev ? 0 : +body.grade, c = dev ? 0 : +body.cls;   // 개발자 계정은 학년·반 없음
    // 인스타 아이디: @·주소를 붙여 넣어도 아이디만 남김. 인스타 규칙(영문·숫자·._, 30자)에 안 맞으면 거절
    const insta = String(body.insta || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();
    if (insta && !/^(?!.*\.\.)(?!\.)[a-z0-9._]{1,30}(?<!\.)$/.test(insta)) return err('인스타 아이디는 영문·숫자·밑줄(_)·마침표(.)만 쓸 수 있어요');
    await db.prepare('UPDATE users SET name = ?1, bio = ?2, avatar = ?3, color = ?4, grade = ?5, cls = ?6, club = ?7, mood = ?8, stickers = ?9, insta = ?11, st_title = ?12, st_rep = ?13, st_deco = ?14 WHERE id = ?10')
      .bind(name, clean(body.bio, 80, true), avatar, color, g >= 1 && g <= 3 ? g : 0, c >= 1 && c <= 6 ? c : 0, clean(body.club, 16), clean(body.mood, 24),
        JSON.stringify([...new Set(stickers)]), me.id, insta, title, rep, JSON.stringify(deco)).run();
    return json({ ok: true, mis: await misEv(db, me, 'prof') });
  }),

  'POST password': needMe(async ({ req, db, me, body }) => {
    if (await limited(db, 'pw:' + me.id, 10, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);   // 로그인된 기기를 잠깐 빌린 사람이 비밀번호를 대입하지 못하게
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    if (!sameStr(await hashPw(String(body.old || ''), u.salt), u.pw)) return err('지금 비밀번호가 맞지 않아요', 401);
    const pw = String(body.pw || '');
    if (pw.length < 6 || pw.length > 64) return err('새 비밀번호는 6~64자로 해 주세요');
    if (weakPw(pw, me.handle)) return err('너무 쉬운 비밀번호예요. 다른 걸로 해 주세요');
    const salt = randHex(16);
    const cur = await sha256(cookieOf(req, COOKIE));
    await db.batch([
      db.prepare('UPDATE users SET pw = ?1, salt = ?2 WHERE id = ?3').bind(await hashPw(pw, salt), salt, me.id),
      db.prepare('DELETE FROM sessions WHERE uid = ?1 AND token != ?2').bind(me.id, cur),   // 다른 기기는 로그아웃
    ]);
    return endAdmin(db, req, me, json({ ok: true }));
  }),

  // 관리자 입장: ADMIN_HANDLE 계정만, 비밀번호를 한 번 더 확인 → 12시간 관리자 세션(쿠키 경로 /api/admin, 관리자 API에서 검사)
  'POST admin-pass': needMe(async ({ req, env, db, me, body }) => {
    if (me.handle !== ADMIN_HANDLE) return err('관리자 계정이 아니에요', 403);
    if (await limited(db, 'ap:' + me.id, 8, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    const pw = String(body.pw || '');
    // 비밀번호를 잊었을 때(2026-10-27): Cloudflare 비밀 변수 ADMIN_RESET(8자 이상)과 똑같이 넣으면 developer 비밀번호를 그 값으로 바꾸고 들어감.
    // 들어간 뒤 Cloudflare에서 ADMIN_RESET을 지울 것(남아 있어도 그 값을 아는 사람만 쓸 수 있음). 시도 제한은 위와 같이 적용
    const reset = String(env.ADMIN_RESET || '');
    let ok = sameStr(await hashPw(pw, u.salt), u.pw);
    if (!ok && reset.length >= 8 && pw.length === reset.length && sameStr(pw, reset)) {
      const salt = randHex(16);
      await db.batch([
        db.prepare('UPDATE users SET pw = ?1, salt = ?2 WHERE id = ?3').bind(await hashPw(pw, salt), salt, me.id),
        db.prepare('INSERT INTO admin_log (at, action, detail) VALUES (?1, ?2, ?3)').bind(Date.now(), '비밀번호 재설정(ADMIN_RESET)', maskIp(req)),
      ]);
      ok = true;
    }
    if (!ok) {
      await db.prepare('INSERT INTO admin_log (at, action, detail) VALUES (?1, ?2, ?3)').bind(Date.now(), '로그인 실패', maskIp(req)).run();
      return err('비밀번호가 맞지 않아요', 401);
    }
    const token = randHex(32), H = 12;
    await db.batch([
      db.prepare('DELETE FROM admin_sessions WHERE exp < ?1').bind(Date.now()),
      db.prepare('INSERT INTO admin_sessions (token, exp) VALUES (?1, ?2)').bind(await sha256(token), Date.now() + H * 3600e3),
      db.prepare('INSERT INTO admin_log (at, action, detail) VALUES (?1, ?2, ?3)').bind(Date.now(), '로그인', maskIp(req)),
    ]);
    const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
    return json({ ok: true }, 200, { 'set-cookie': `sg_a=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${H * 3600}${secure}` });
  }),

  'POST withdraw': needMe(async ({ req, env, db, me, body }) => {
    if (await limited(db, 'pw:' + me.id, 10, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);
    // 본인 확인: 비밀번호, 또는 구글로 가입한 계정이면 연결된 구글 로그인
    if (body.credential) {
      const g = await verifyGoogle(env, body.credential);
      if (!g || g.sub !== me.google_sub) return err('연결된 구글 계정으로 확인해 주세요', 401);
    } else {
      const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
      if (!sameStr(await hashPw(String(body.pw || ''), u.salt), u.pw)) return err('비밀번호가 맞지 않아요', 401);
    }
    await db.batch([
      'DELETE FROM sessions WHERE uid = ?1', 'DELETE FROM follows WHERE a = ?1 OR b = ?1', 'DELETE FROM blocks WHERE a = ?1 OR b = ?1',
      'DELETE FROM messages WHERE a = ?1 OR b = ?1', 'DELETE FROM scores WHERE uid = ?1', 'DELETE FROM held_scores WHERE uid = ?1', 'DELETE FROM bans WHERE uid = ?1', 'DELETE FROM reports WHERE reporter = ?1', 'DELETE FROM feedback_img WHERE fid IN (SELECT id FROM feedback WHERE uid = ?1)', 'DELETE FROM feedback WHERE uid = ?1', 'DELETE FROM attendance WHERE uid = ?1',
      'DELETE FROM users WHERE id = ?1',
    ].map(s => db.prepare(s).bind(me.id)));
    return endAdmin(db, req, me, json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) }));
  }),

  // 개발자 → 학과별 테스트 계정(콘·미·프)으로 바꿔 보기 / 개발자로 돌아가기. 개발자 세션은 sg_d 쿠키에 보관
  'POST dev-switch': async ({ req, db, body }) => {
    const me = await auth(req, db);
    if (!me) return err('로그인이 필요해요', 401);
    const cur = cookieOf(req, COOKIE);
    const dev = me.handle === ADMIN_HANDLE ? { token: cur, exp: me.exp } : me.is_test ? await devSession(req, db) : null;
    if (!dev) return err('개발자 계정만 쓸 수 있어요', 403);
    const dropCur = async () => { if (me.is_test) await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha256(cur)).run(); };   // 쓰던 테스트 세션은 지움
    const left = Math.max(0, Math.floor((dev.exp - Date.now()) / 1000));
    if (body.to === 'back') {
      if (!me.is_test) return json({ ok: true });
      await dropCur();
      const res = json({ ok: true }, 200, { 'set-cookie': setCookie(req, dev.token, left) });
      res.headers.append('set-cookie', devCookie(req, '', 0));
      return res;
    }
    const t = Object.hasOwn(TEST_ACCOUNTS, body.to) ? TEST_ACCOUNTS[body.to] : null;
    if (!t) return err('없는 테스트 계정이에요');
    let u = await db.prepare('SELECT id, is_test FROM users WHERE handle = ?1').bind(t.handle).first();
    if (u && !u.is_test) return err('그 아이디는 이미 다른 사람이 쓰고 있어요', 409);
    if (!u) {
      const salt = randHex(16);
      u = await db.prepare(`INSERT INTO users (handle, name, pw, salt, created, avatar, grade, cls, seen, is_test) VALUES (?1, ?2, ?3, ?4, ?5, '🤖', ?6, ?7, ?5, 1) RETURNING id`)
        .bind(t.handle, t.name, await hashPw(randHex(24), salt), salt, Date.now(), TEST_GRADE, t.cls).first();
    }
    await dropCur();
    const res = json({ ok: true, grade: TEST_GRADE, cls: t.cls }, 200, { 'set-cookie': await newSession(req, db, u.id) });
    res.headers.append('set-cookie', devCookie(req, dev.token, left));
    return res;
  },

  /* ----- 사람 ----- */
  'GET user': needMe(async ({ env, db, me, arg }) => {
    const u = await byHandle(db, arg);
    if (!u) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blockedMe) return err('없는 사용자예요', 404);
    const [fo, fb, bests, crowns] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE a = ?1').bind(u.id).first(),
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE b = ?1').bind(u.id).first(),
      db.prepare('SELECT game, MIN(best) AS best FROM scores WHERE uid = ?1 GROUP BY game').bind(u.id).all(),
      topCrowns(db, u.id),
    ]);
    return json({
      user: pub(u), me: u.id === me.id, rel: r, canDm: dmAllowed(u, r) || (isAdm(me) && !r.blocked && !r.blockedMe), counts: { following: fo.n, followers: fb.n },
      bests: Object.fromEntries(bests.results.map(x => [x.game, x.best])), crowns, tier: isAdm(u) ? null : await tierOfUser(db, u),
      streak: isAdm(u) ? { cur: ALL_OPEN, best: ALL_OPEN, total: u.st_total || 0, pf: true } : { cur: (await liveMany(env, db, [u]))[0], best: u.st_best || 0, total: u.st_total || 0, pf: !!u.st_pf },
    });
  }),

  'GET search': needMe(async ({ db, me, url }) => {
    const q = clean(url.searchParams.get('q'), 16).toLowerCase().replace(/[%_\\]/g, '');
    let rows;
    if (q) {
      rows = (await db.prepare(`SELECT ${PUB} FROM users WHERE (handle LIKE ?1 OR name LIKE ?1) AND id != ?2 AND is_test = 0
        AND id NOT IN (SELECT a FROM blocks WHERE b = ?2) ORDER BY seen DESC LIMIT 30`).bind(`%${q}%`, me.id).all()).results;
    } else {   // 검색어 없으면: 최근에 들어온 사람
      rows = (await db.prepare(`SELECT ${PUB} FROM users WHERE id != ?1 AND is_test = 0 AND id NOT IN (SELECT a FROM blocks WHERE b = ?1) ORDER BY seen DESC LIMIT 30`).bind(me.id).all()).results;
    }
    const mine = new Set((await db.prepare('SELECT b FROM follows WHERE a = ?1').bind(me.id).all()).results.map(r => r.b));
    return json({ users: rows.map(u => ({ ...card(u), following: mine.has(u.id), grade: u.grade, cls: u.cls })) });
  }),

  'GET people': needMe(async ({ db, me, url }) => {   // ?who=handle&kind=following|followers|friends
    const who = url.searchParams.get('who') ? await byHandle(db, url.searchParams.get('who')) : me;
    if (!who || (who.id !== me.id && (await rel(db, me.id, who.id)).blockedMe)) return err('없는 사용자예요', 404);
    const kind = url.searchParams.get('kind');
    const sql = {
      following: `SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM follows f JOIN users u ON u.id = f.b WHERE f.a = ?1 ORDER BY f.at DESC LIMIT 200`,
      followers: `SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM follows f JOIN users u ON u.id = f.a WHERE f.b = ?1 ORDER BY f.at DESC LIMIT 200`,
      friends: `SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a JOIN users u ON u.id = f.b WHERE f.a = ?1 ORDER BY u.seen DESC LIMIT 200`,
    }[kind];
    if (!sql) return err('bad kind');
    const rows = (await db.prepare(sql).bind(who.id).all()).results;
    const mine = new Set((await db.prepare('SELECT b FROM follows WHERE a = ?1').bind(me.id).all()).results.map(r => r.b));
    return json({ users: rows.map(u => ({ ...card(u), following: mine.has(u.id), isMe: u.id === me.id })) });
  }),

  // 홈 '친구' 카드(2026-10-25): 맞팔 친구 지금 상태 한 번에 — 접속 중·마지막 접속·상태 메시지·오늘 출석·연속 출석·안 읽은 DM + 나를 새로 팔로우한 사람(맞팔 전, 14일 안)
  'GET buddies': needMe(async ({ env, db, me }) => {
    const U = 'u.id, u.handle, u.name, u.avatar, u.color, u.grade, u.cls, u.seen, u.mood, u.st_cur, u.st_last, u.st_shield, u.st_rep, u.gc_fx, u.gc_own';
    const [fr, rq, un] = await Promise.all([
      db.prepare(`SELECT ${U} FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a JOIN users u ON u.id = f.b WHERE f.a = ?1 ORDER BY u.seen DESC LIMIT 60`).bind(me.id).all(),
      db.prepare(`SELECT ${U} FROM follows f JOIN users u ON u.id = f.a WHERE f.b = ?1 AND f.at > ?2 AND u.is_test = 0
        AND f.a NOT IN (SELECT b FROM follows WHERE a = ?1) AND f.a NOT IN (SELECT b FROM blocks WHERE a = ?1) ORDER BY f.at DESC LIMIT 6`).bind(me.id, Date.now() - 14 * 86400e3).all(),
      db.prepare('SELECT a, COUNT(*) AS n FROM messages WHERE b = ?1 AND seen = 0 AND del = 0 GROUP BY a').bind(me.id).all(),
    ]);
    const rows = fr.results, today = kstToday(), [live, rest] = await Promise.all([liveMany(env, db, rows), restDay(env, db, today)]), unread = Object.fromEntries(un.results.map(r => [r.a, r.n]));
    const friends = rows.map((u, i) => ({ ...card(u), grade: u.grade, cls: u.cls, seen: u.seen || 0, streak: isAdm(u) ? ALL_OPEN : live[i], att: isAdm(u) || u.st_last >= today, unread: unread[u.id] || 0 }));
    return json({ rest, friends, reqs: rq.results.map(u => ({ ...card(u), grade: u.grade, cls: u.cls })) });
  }),

  'POST follow': needMe(async ({ db, me, body }) => {
    const u = await byHandle(db, body.handle);
    if (!u || u.id === me.id) return err('팔로우할 수 없어요');
    if (!isAdm(me) && await limited(db, 'fo:' + me.id, 60, 600)) return err('너무 빨라요. 잠시 후에 해 주세요', 429);
    const r = await rel(db, me.id, u.id);
    if (body.on && (r.blocked || r.blockedMe)) return err('팔로우할 수 없어요');
    let mis = null;
    if (body.on) { const ins = await db.prepare('INSERT OR IGNORE INTO follows (a, b, at) VALUES (?1, ?2, ?3)').bind(me.id, u.id, Date.now()).run(); if (ins.meta?.changes && !r.following) mis = await misEv(db, me, 'fol', { to: u.id }); }
    else await db.prepare('DELETE FROM follows WHERE a = ?1 AND b = ?2').bind(me.id, u.id).run();
    return json({ ok: true, rel: await rel(db, me.id, u.id), mis });
  }),

  'POST block': needMe(async ({ db, me, body }) => {
    const u = await byHandle(db, body.handle);
    if (!u || u.id === me.id) return err('차단할 수 없어요');
    if (!isAdm(me) && await limited(db, 'bk:' + me.id, 60, 600)) return err('너무 빨라요. 잠시 후에 해 주세요', 429);
    if (body.on) {
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO blocks (a, b) VALUES (?1, ?2)').bind(me.id, u.id),
        db.prepare('DELETE FROM follows WHERE (a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)').bind(me.id, u.id),
      ]);
    } else await db.prepare('DELETE FROM blocks WHERE a = ?1 AND b = ?2').bind(me.id, u.id).run();
    return json({ ok: true, rel: await rel(db, me.id, u.id) });
  }),

  'GET blocked': needMe(async ({ db, me }) => {
    const rows = (await db.prepare(`SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM blocks b JOIN users u ON u.id = b.b WHERE b.a = ?1`).bind(me.id).all()).results;
    return json({ users: rows.map(card) });
  }),

  'POST report': needMe(async ({ db, me, body }) => {
    const u = await byHandle(db, body.handle);
    if (!u) return err('없는 사용자예요');
    if (!isAdm(me) && await limited(db, 'rp:' + me.id, 10, 3600)) return err('신고가 너무 많아요', 429);
    // 메시지 신고는 '나와 그 사람의 대화'에 있는 그 사람의 메시지만 (남의 대화를 관리자 화면에 끌어오지 못하게)
    let msg = null;
    if (Number.isInteger(body.msg)) {
      const m = await db.prepare('SELECT id FROM messages WHERE id = ?1 AND pair = ?2 AND a = ?3').bind(body.msg, pairOf(me.id, u.id), u.id).first();
      if (!m) return err('신고할 수 없는 메시지예요');
      msg = m.id;
    }
    await db.prepare('INSERT INTO reports (reporter, target, msg, reason, at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(me.id, u.id, msg, clean(body.reason, 200, true) || '(사유 없음)', Date.now()).run();
    return json({ ok: true });
  }),

  /* ----- DM (서로 팔로우한 친구끼리만) ----- */
  'GET poll': needMe(async ({ db, me }) => {
    const r = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE b = ?1 AND seen = 0 AND del = 0').bind(me.id).first();
    return json({ unread: r.n });
  }),

  'GET inbox': needMe(async ({ db, me }) => {
    const last = (await db.prepare(`SELECT m.id, m.a, m.b, m.body, m.at, m.del FROM messages m
      JOIN (SELECT pair, MAX(id) AS mid FROM messages WHERE a = ?1 OR b = ?1 GROUP BY pair) t ON m.id = t.mid ORDER BY m.id DESC LIMIT 60`).bind(me.id).all()).results;
    const unread = Object.fromEntries((await db.prepare('SELECT a, COUNT(*) AS n FROM messages WHERE b = ?1 AND seen = 0 AND del = 0 GROUP BY a').bind(me.id).all()).results.map(r => [r.a, r.n]));
    const ids = [...new Set([...last.map(m => m.a === me.id ? m.b : m.a), ...await friendIds(db, me.id)])];
    const users = ids.length ? (await db.prepare(`SELECT ${PUB} FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results : [];
    const byId = new Map(users.map(u => [u.id, u]));
    const threads = last.filter(m => byId.has(m.a === me.id ? m.b : m.a)).map(m => {
      const other = m.a === me.id ? m.b : m.a;
      return { user: card(byId.get(other)), last: m.del ? '삭제된 메시지' : m.body, at: m.at, mine: m.a === me.id, unread: unread[other] || 0 };
    });
    const talked = new Set(last.map(m => m.a === me.id ? m.b : m.a));
    const friends = users.filter(u => !talked.has(u.id)).map(card);   // 아직 대화 안 한 친구
    return json({ threads, friends });
  }),

  'GET dm': needMe(async ({ db, me, arg, url }) => {
    const u = await byHandle(db, arg);
    if (!u || u.id === me.id) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blockedMe) return err('없는 사용자예요', 404);
    const after = Math.max(0, parseInt(url.searchParams.get('after')) || 0), before = parseInt(url.searchParams.get('before')) || 0;
    const pair = pairOf(me.id, u.id);
    let rows;
    if (after) rows = (await db.prepare('SELECT id, a, body, at, seen, del FROM messages WHERE pair = ?1 AND id > ?2 ORDER BY id LIMIT 100').bind(pair, after).all()).results;
    else rows = (await db.prepare(`SELECT * FROM (SELECT id, a, body, at, seen, del FROM messages WHERE pair = ?1 ${before ? 'AND id < ?2' : ''} ORDER BY id DESC LIMIT 40) ORDER BY id`)
      .bind(...(before ? [pair, before] : [pair])).all()).results;
    await db.prepare('UPDATE messages SET seen = 1 WHERE pair = ?1 AND b = ?2 AND seen = 0').bind(pair, me.id).run();
    // 상대가 읽은 내 마지막 메시지 (읽음 표시용)
    const read = await db.prepare('SELECT MAX(id) AS id FROM messages WHERE pair = ?1 AND a = ?2 AND seen = 1').bind(pair, me.id).first();
    return json({
      user: card(u), rel: r, canSend: dmAllowed(u, r) || (isAdm(me) && !r.blocked && !r.blockedMe), readUpTo: read?.id || 0,
      messages: rows.map(m => ({ id: m.id, mine: m.a === me.id, body: m.del ? '' : m.body, del: !!m.del, at: m.at })),
    });
  }),

  'POST dm': needMe(async ({ db, me, arg, body }) => {
    const u = await byHandle(db, arg);
    if (!u || u.id === me.id) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blocked || r.blockedMe) return err('메시지를 보낼 수 없어요', 403);
    if (!dmAllowed(u, r) && !isAdm(me)) return err(['서로 팔로우한 친구에게만', '나를 팔로우하는 사람에게만', ''][u.dm_pref || 0] + ' 보낼 수 있어요', 403);
    if (!isAdm(me) && !isAdm(u) && !dmOpen(await getSettings(db))) return err('지금은 DM이 잠시 꺼져 있어요', 403);   // DM을 꺼도 개발자와의 대화는 열림
    // 욕설은 막지 않고 ＊로 가림(친구끼리 대화라 거절하면 거부감 큼) · 1분 15개 · 같은 말 3번 연속 금지 (2026-10-24: 1분 40개 도배 확인)
    const text = clean(body.body, 500, true).replace(BAD_G, m => '＊'.repeat(m.length));
    if (!text) return err('내용을 적어 주세요');
    const se = stkErr(me, text); if (se) return err(se);
    if (!isAdm(me) && await limited(db, 'dm:' + me.id, 15, 60)) return err('너무 빨리 보내고 있어요. 잠깐만요!', 429);
    if (!isAdm(me)) {
      const last = (await db.prepare('SELECT body FROM messages WHERE pair = ?1 AND a = ?2 ORDER BY id DESC LIMIT 2').bind(pairOf(me.id, u.id), me.id).all()).results;
      if (last.length === 2 && last.every(x => x.body === text)) return err('같은 메시지를 계속 보내고 있어요', 429);
    }
    const m = await db.prepare('INSERT INTO messages (pair, a, b, body, at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id, at')
      .bind(pairOf(me.id, u.id), me.id, u.id, text, Date.now()).first();
    return json({ ok: true, message: { id: m.id, mine: true, body: text, del: false, at: m.at }, mis: await misEv(db, me, 'dm', { to: u.id }) });
  }),

  'POST unsend': needMe(async ({ db, me, body }) => {
    const id = parseInt(body.id);
    if (!(id > 0)) return err('지울 수 없어요');
    const r = await db.prepare("UPDATE messages SET del = 1, body = '' WHERE id = ?1 AND a = ?2").bind(id, me.id).run();
    return r.meta.changes ? json({ ok: true }) : err('지울 수 없어요');
  }),

  // DM 받는 범위 설정
  'POST dmpref': needMe(async ({ db, me, body }) => {
    const v = [0, 1, 2].includes(body.pref) ? body.pref : 0;
    await db.prepare('UPDATE users SET dm_pref = ?1 WHERE id = ?2').bind(v, me.id).run();
    return json({ ok: true, dmPref: v });
  }),

  /* ----- 구글 로그인 (Google Identity Services ID 토큰). 비밀 변수 없이 공개 값 GOOGLE_CLIENT_ID만 필요 ----- */
  // 처음이면 { need: 'signup' } → 같은 토큰 + 아이디·닉네임으로 다시 보내면 가입
  'POST google': async ({ req, env, db, body }) => {
    const ik = await ipKey(req);
    if (await limited(db, 'gl:' + ik, 600, 600)) return err('로그인 시도가 너무 많아요. 잠시 뒤에 다시 해 주세요', 429);   // 구글 확인(바깥 요청) 전에 막음
    const g = await verifyGoogle(env, body.credential);
    if (!g) return err('구글 로그인을 확인하지 못했어요. 다시 해 주세요', 401);
    const u = await db.prepare('SELECT id, handle, is_test FROM users WHERE google_sub = ?1').bind(g.sub).first();
    if (u) {
      if (noGoogle(u)) return err('이 계정은 구글로 로그인할 수 없어요. 아이디·비밀번호로 로그인해 주세요', 403);
      const ban = await db.prepare('SELECT until, reason FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(u.id, Date.now()).first();
      if (ban) return err('이용이 정지된 계정이에요' + (ban.reason ? ' · ' + ban.reason : ''), 403);
      return json({ ok: true, handle: u.handle }, 200, { 'set-cookie': await newSession(req, db, u.id) });
    }
    if (body.find) return err('이 구글 계정에 연결된 아이디가 없어요. 아이디·비밀번호로 로그인한 뒤 프로필 → ⚙️에서 연결해 주세요', 404);
    if (!body.handle) return json({ need: 'signup', name: clean(g.name, 20) });
    const handle = String(body.handle).trim().toLowerCase(), name = clean(body.name, 20);
    if (!HANDLE_RE.test(handle)) return err('아이디는 영어 소문자·숫자·_·. 로 3~16자예요');
    if (RESERVED(handle)) return err('쓸 수 없는 아이디예요');
    if (!name) return err('이름(닉네임)을 적어 주세요');
    if (isBad(handle, name)) return err('욕설이나 나쁜 말은 아이디·닉네임에 쓸 수 없어요');
    const club = clean(body.club, 16);
    if (club && isBad(club)) return err('욕설이나 나쁜 말은 쓸 수 없어요');
    { const ni = await nameIssue(db, name); if (ni) return err(ni); }
    const st = await getSettings(db), code = joinCodeOf(env, st);
    if (!signupOpen(st)) return err('지금은 새로 가입할 수 없어요', 403);
    if (await limited(db, 'su:' + ik, 300, 3600)) return err('가입 시도가 너무 많아요. 나중에 다시 해 주세요', 429);
    if (code) {
      if (await countOf(db, 'cw:' + ik) >= 30) return err('가입 코드를 너무 많이 틀렸어요. 1시간 뒤에 다시 해 주세요', 429);
      if (!sameStr(String(body.code || '').trim(), code)) { await limited(db, 'cw:' + ik, 30, 3600); return err('가입 코드가 달라요'); }
    }
    if (await db.prepare('SELECT 1 FROM users WHERE handle = ?1').bind(handle).first()) return err('이미 있는 아이디예요');
    const salt = randHex(16), g2 = +body.grade, c2 = +body.cls;
    const gift = joinBonus(kstYmd());   // 배포 첫 2주 가입 선물(att-rewards.js JOIN)
    const nu = await db.prepare(`INSERT INTO users (handle, name, pw, salt, created, avatar, grade, cls, seen, google_sub, club, gc_tix) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?5, ?9, ?10, ?11) RETURNING id`)
      .bind(handle, name, await hashPw(randHex(24), salt), salt, Date.now(), AVATARS[Math.floor(Math.random() * 16)], g2 >= 1 && g2 <= 3 ? g2 : 0, c2 >= 1 && c2 <= 6 ? c2 : 0, g.sub, club, GC.start + gift).first();   // 비밀번호는 아무도 모르는 무작위 값(구글로만 로그인)
    return json({ ok: true, created: true, gift }, 200, { 'set-cookie': await newSession(req, db, nu.id) });
  },
  // 이미 있는 계정에 구글 연결 / 해제
  // 연결·해제 모두 지금 비밀번호 확인 (로그인된 기기를 잠깐 빌린 사람이 자기 구글을 몰래 연결해 계정을 가져가지 못하게)
  'POST google-link': needMe(async ({ env, db, me, body }) => {
    if (noGoogle(me) && !body.off) return err('개발자·테스트 계정은 구글을 연결할 수 없어요', 403);
    if (await limited(db, 'pw:' + me.id, 10, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    if (!sameStr(await hashPw(String(body.pw || ''), u.salt), u.pw)) return err('지금 비밀번호가 맞지 않아요', 401);
    if (body.off) { await db.prepare('UPDATE users SET google_sub = NULL WHERE id = ?1').bind(me.id).run(); return json({ ok: true }); }
    const g = await verifyGoogle(env, body.credential);
    if (!g) return err('구글 로그인을 확인하지 못했어요', 401);
    const other = await db.prepare('SELECT id FROM users WHERE google_sub = ?1').bind(g.sub).first();
    if (other && other.id !== me.id) return err('이 구글 계정은 이미 다른 아이디에 연결돼 있어요');
    await db.prepare('UPDATE users SET google_sub = ?1 WHERE id = ?2').bind(g.sub, me.id).run();
    return json({ ok: true });
  }),

  // 비밀번호를 잊었을 때: 연결된 구글로 본인 확인 → (pw 없으면) 아이디만 알려 줌 / (pw 있으면) 새 비밀번호로 바꾸고 모든 기기 로그아웃 후 이 기기만 로그인
  'POST google-reset': async ({ req, env, db, body }) => {
    const ik = await ipKey(req);
    if (await limited(db, 'gr:' + ik, 60, 3600)) return err('시도가 너무 많아요. 나중에 다시 해 주세요', 429);
    const g = await verifyGoogle(env, body.credential);
    if (!g) return err('구글 로그인을 확인하지 못했어요. 다시 해 주세요', 401);
    const u = await db.prepare('SELECT id, handle, is_test FROM users WHERE google_sub = ?1').bind(g.sub).first();
    if (!u) return err('이 구글 계정에 연결된 아이디가 없어요. 구글을 미리 연결해 둔 계정만 찾을 수 있어요', 404);
    if (noGoogle(u)) return err('이 계정은 구글로 찾을 수 없어요', 403);
    if (body.pw === undefined) return json({ handle: u.handle });
    if (await limited(db, 'grp:' + u.id, 5, 3600)) return err('비밀번호를 너무 자주 바꿨어요. 1시간 뒤에 다시 해 주세요', 429);
    const pw = String(body.pw || '');
    if (pw.length < 6 || pw.length > 64) return err('새 비밀번호는 6~64자로 해 주세요');
    if (weakPw(pw, u.handle)) return err('너무 쉬운 비밀번호예요. 다른 걸로 해 주세요');
    const ban = await db.prepare('SELECT 1 FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(u.id, Date.now()).first();
    const salt = randHex(16);
    await db.batch([
      db.prepare('UPDATE users SET pw = ?1, salt = ?2 WHERE id = ?3').bind(await hashPw(pw, salt), salt, u.id),
      db.prepare('DELETE FROM sessions WHERE uid = ?1').bind(u.id),   // 혹시 남이 로그인해 둔 기기도 모두 끊김
    ]);
    if (ban) return json({ ok: true, handle: u.handle, banned: true });
    return json({ ok: true, handle: u.handle }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },
  // 모든 기기에서 로그아웃 (학교 태블릿에 로그인을 두고 왔을 때) — 이 기기 포함
  'POST logout-all': needMe(async ({ req, db, me }) => {
    await db.prepare('DELETE FROM sessions WHERE uid = ?1').bind(me.id).run();
    const res = json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) });
    if (cookieOf(req, DEV_COOKIE)) res.headers.append('set-cookie', devCookie(req, '', 0));
    return endAdmin(db, req, me, res);
  }),

  /* ----- 오늘의 밸런스 게임: 월~금 하루 한 문제, 6시 공개 · 마지막 교시 끝 +10분 마감. 한 사람 한 표(로그인 계정 기준), 댓글은 고른 쪽이 같이 보임 ----- */
  'GET bal': needMe(async ({ env, db, me }) => json(await balState(env, db, me))),
  'POST bal': needMe(async ({ env, db, me, body }) => {
    const pick = String(body.pick ?? '');
    if (!['a', 'b', ''].includes(pick)) return err('bad pick');
    const st = await balState(env, db, me);
    if (body.ymd && body.ymd !== st.ymd) return err('질문이 바뀌었어요. 새로 고침해 주세요', 409);
    if (!st.open) return err(Date.now() < st.opens ? '아직 투표 시작 전이에요 (6시 시작)' : '투표가 마감됐어요');
    if (!isAdm(me) && await limited(db, 'bv:' + me.id, 40, 600)) return err('너무 많이 눌렀어요. 잠시 후에 해 주세요', 429);
    if (!pick) await db.prepare('DELETE FROM balance_votes WHERE ymd = ?1 AND voter = ?2').bind(st.ymd, 'u' + me.id).run();
    else await db.prepare('INSERT INTO balance_votes (ymd, voter, pick, at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (ymd, voter) DO UPDATE SET pick = excluded.pick, at = excluded.at')
      .bind(st.ymd, 'u' + me.id, pick, Date.now()).run();
    const mis = pick ? await misEv(db, me, 'bal', { day: st.ymd }) : null;
    return json({ ...(await balState(env, db, me)), mis });
  }),
  'POST balc': needMe(async ({ env, db, me, body }) => {
    const text = clean(body.body, 100, true);
    if (!text) return err('내용을 적어 주세요');
    const se = stkErr(me, text); if (se) return err(se);
    if (isBad(text)) return err('욕설·비속어는 쓸 수 없어요');
    const st = await balState(env, db, me);
    if (body.ymd && body.ymd !== st.ymd) return err('질문이 바뀌었어요. 새로 고침해 주세요', 409);
    if (st.open && !st.mine && !isAdm(me)) return err('먼저 한쪽을 골라야 댓글을 달 수 있어요');
    if (!isAdm(me) && await limited(db, 'bc:' + me.id, 6, 300)) return err('댓글은 5분에 6개까지 달 수 있어요', 429);
    await db.prepare('INSERT INTO balance_comments (ymd, uid, pick, body, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(st.ymd, me.id, st.mine || '', text, Date.now()).run();
    const mis = await misEv(db, me, 'balc', { day: st.ymd });
    return json({ ...(await balState(env, db, me)), mis });
  }),
  'POST balcdel': needMe(async ({ env, db, me, body }) => {
    const r = await db.prepare('DELETE FROM balance_comments WHERE id = ?1 AND uid = ?2').bind(+body.id || 0, me.id).run();
    if (!r.meta.changes) return err('지울 수 없는 댓글이에요');
    await db.prepare('DELETE FROM balance_comment_likes WHERE cid = ?1').bind(+body.id || 0).run();
    return json(await balState(env, db, me));
  }),
  // 댓글 좋아요 켜기/끄기 (댓글이 보이는 사람만, 오늘 질문의 댓글만)
  // 댓글 좋아요 켜기/끄기 — 가볍게: 전체 상태 대신 그 댓글의 좋아요 수만 돌려줌
  // 누를 수 있는 사람: 오늘 질문에 투표했거나, 마감된 뒤(댓글이 보이는 사람과 같은 조건)
  'POST balclike': needMe(async ({ env, db, me, body }) => {
    const id = +body.id || 0, ymd = balDay();
    const [cr, vr] = await db.batch([
      db.prepare('SELECT ymd FROM balance_comments WHERE id = ?1').bind(id),
      db.prepare('SELECT 1 FROM balance_votes WHERE ymd = ?1 AND voter = ?2').bind(ymd, 'u' + me.id),
    ]);
    const c = cr.results[0];
    if (!c || c.ymd !== ymd) return err('없는 댓글이에요', 404);
    if (!isAdm(me) && !vr.results.length && Date.now() < closeAt(ymd, await lastPeriod(env, db, ymd))) return err('먼저 한쪽을 골라야 좋아요를 누를 수 있어요', 403);
    if (!isAdm(me) && await limited(db, 'bl:' + me.id, 60, 600)) return err('너무 많이 눌렀어요. 잠시 후에 해 주세요', 429);
    const write = body.on
      ? db.prepare('INSERT OR IGNORE INTO balance_comment_likes (cid, uid, at) VALUES (?1, ?2, ?3)').bind(id, me.id, Date.now())
      : db.prepare('DELETE FROM balance_comment_likes WHERE cid = ?1 AND uid = ?2').bind(id, me.id);
    const [, n] = await db.batch([write, db.prepare('SELECT COUNT(*) AS n FROM balance_comment_likes WHERE cid = ?1').bind(id)]);
    return json({ id, liked: !!body.on, likes: n.results[0].n, mis: body.on ? await misEv(db, me, 'like', { id }) : null });
  }),
  'POST balcrep': needMe(async ({ db, me, body }) => {
    const c = await db.prepare('SELECT uid, ymd, body FROM balance_comments WHERE id = ?1').bind(+body.id || 0).first();
    if (!c) return err('없는 댓글이에요');
    if (c.uid === me.id) return err('내 댓글은 신고할 수 없어요');
    if (!isAdm(me) && await limited(db, 'rp:' + me.id, 10, 3600)) return err('신고가 너무 많아요', 429);
    await db.prepare('INSERT INTO reports (reporter, target, msg, reason, at) VALUES (?1, ?2, NULL, ?3, ?4)')
      .bind(me.id, c.uid, `[밸런스 댓글 #${+body.id} · ${c.ymd}] ${c.body}` + (body.reason ? ` / 사유: ${clean(body.reason, 100)}` : ''), Date.now()).run();
    return json({ ok: true });
  }),

  /* ----- 의견 보내기 (개발자에게, 로그인 필요) ----- */
  'POST feedback': needMe(async ({ db, me, body }) => {
    const kind = ['idea', 'bug', 'etc'].includes(body.kind) ? body.kind : 'etc';
    const text = clean(body.body, 500, true);
    if (text.length < 2) return err('내용을 조금 더 적어 주세요');
    if (!isAdm(me) && await limited(db, 'fb:' + me.id, 6, 3600)) return err('의견은 1시간에 6번까지 보낼 수 있어요', 429);
    // 사진: 브라우저에서 줄인 data URL(jpeg·png·webp)만, 최대 5장 · 한 장 1MB
    const imgs = [];
    for (const d of (Array.isArray(body.imgs) ? body.imgs : []).slice(0, 5)) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''));
      if (!m) return err('사진 형식을 읽지 못했어요');
      let bin; try { bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)); } catch { return err('사진 형식을 읽지 못했어요'); }
      if (bin.length > 1 << 20) return err('사진 한 장이 너무 커요');
      const ok = m[1] === 'jpeg' ? bin[0] === 0xff && bin[1] === 0xd8 : m[1] === 'png' ? bin[0] === 0x89 && bin[1] === 0x50 : bin[8] === 0x57 && bin[9] === 0x45;   // 실제 파일 머리 확인
      if (!ok) return err('사진 형식을 읽지 못했어요');
      imgs.push({ type: 'image/' + m[1], bin });
    }
    const r = await db.prepare('INSERT INTO feedback (uid, kind, body, at) VALUES (?1, ?2, ?3, ?4)').bind(me.id, kind, text, Date.now()).run();
    const fid = r.meta.last_row_id;
    if (imgs.length) await db.batch(imgs.map((x, i) => db.prepare('INSERT INTO feedback_img (fid, i, type, data) VALUES (?1, ?2, ?3, ?4)').bind(fid, i, x.type, x.bin.buffer)));
    return json({ ok: true });
  }),

  /* ----- 미니게임 ----- */
  // 게임 시작 티켓: 서버가 시작 시각을 기억해 두고(rl 표, 1시간 뒤 만료), 기록은 티켓 하나당 한 번만 받는다
  // → 게임을 안 하고 기록만 바로 보내거나, 같은 기록을 여러 번 보내는 것을 막음 (완전한 조작 방지는 아님)
  'POST start': needMe(async ({ db, me, body }) => {
    const game = String(body.game || '');
    if (!GAMES[game] || (GAMES[game].ff && !ffOn(GAMES[game].ff, isAdm(me)))) return err('bad game');   // 미리보기 게임은 개발자만
    if (!isAdm(me) && await limited(db, 'gs:' + me.id, 60, 600)) return err('잠깐 쉬었다가 해요', 429);
    const ticket = randHex(16);
    await db.prepare('INSERT INTO rl (k, n, reset) VALUES (?1, 0, ?2)').bind(`tk:${me.id}:${game}:${ticket}`, Date.now() + TICKET_TTL).run();
    return json({ ticket });
  }),

  'POST score': needMe(async ({ db, me, body }) => {
    const game = String(body.game || ''), v = Math.round(+body.value), ticket = String(body.ticket || '');
    const g = GAMES[game];
    if (!g || (g.ff && !ffOn(g.ff, isAdm(me))) || !Number.isFinite(v) || v < 0 || v > 1e7) return err('기록이 이상해요');
    if (!isAdm(me) && await limited(db, 'sc:' + me.id, 40, 60)) return err('잠깐 쉬었다가 해요', 429);
    const tk = TICKET_RE.test(ticket) && await db.prepare('DELETE FROM rl WHERE k = ?1 AND reset > ?2 RETURNING reset, n').bind(`tk:${me.id}:${game}:${ticket}`, Date.now()).first();
    if (!tk) return err('게임을 다시 시작해 주세요');
    const elapsed = Date.now() - (tk.n > 0 ? tk.n : tk.reset - TICKET_TTL);   // n > 0 = 이어 달리기 티켓(원래 판 출발 시각)
    // 검사에 걸린 기록은 버리지 않고 보류(2026-10-26 하율) → 관리자 '게임 기록'의 보류 목록에서 확인 후 반영/버림. 판 기록이 아예 없으면(예전 화면) 새로 고침 안내
    if (!Array.isArray(body.rounds)) return err('새로 고침한 뒤 다시 해 주세요');
    const fv = { reaction: x => x + 'ms', num25: x => sec(x), cut: x => '오차 합 ' + x + 'ms', home: x => (HOME_MAX - x).toLocaleString('ko-KR') + 'm', gear: x => (GEAR_MAX - x).toLocaleString('ko-KR') + '점' }[game];
    const why = v < g.min ? H(`너무 빠른 기록(하한 ${g.min})`, game === 'home' ? `${fv(v)}는 갈 수 있는 거리보다 길어요.` : game === 'gear' ? `${fv(v)}는 기록할 수 있는 점수를 넘었어요.` : `${fv(v)}는 사람이 내기 거의 어려운 기록이에요. 바로 랭킹에 올라가는 기준은 ${fv(g.min)} 이상이에요.`)
      : v > g.max ? H(`범위를 넘은 기록(상한 ${g.max})`, game === 'home' ? '달린 거리가 1m도 안 돼요.' : game === 'gear' ? '점수가 0점이에요.' : `${fv(v)}는 기록할 수 있는 범위(${fv(g.max)})를 넘었어요.`)
      : elapsed < g.play ? H(`플레이 시간이 너무 짧음(${Math.round(elapsed / 1000)}초)`, `게임을 시작하고 기록을 내기까지 ${sec(elapsed)}밖에 안 걸렸어요. 이 게임은 최소 ${sec(g.play)}는 걸려요.`)
      : checkRounds(game, v, body.rounds, elapsed);
    if (why) {
      const wait = await db.prepare('SELECT COUNT(*) AS n FROM held_scores WHERE uid = ?1 AND st = 0').bind(me.id).first();
      if (wait.n >= 30) return err('확인을 기다리는 기록이 많아요. 개발자가 확인할 때까지 조금만 기다려 주세요', 429);
      const rounds = JSON.stringify(body.rounds.slice(0, 30).map(x => Math.round(+x) || 0)).slice(0, 500);
      await db.prepare('INSERT INTO held_scores (uid, game, value, rounds, reason, elapsed, day, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
        .bind(me.id, game, v, rounds, why.a.slice(0, 200), Math.min(elapsed, 2e9), kstYmd(), Date.now()).run();
      const mine = await db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first();
      return json({ ok: true, held: true, why: why.u, bad: why.bad || [], best: mine?.b ?? null });
    }
    const day = kstYmd();   // 기록은 날짜별로 쌓되(관리용), 랭킹은 개인 최고 기록 하나로만 매김
    const [prev, allPrev] = await Promise.all([
      db.prepare('SELECT best FROM scores WHERE uid = ?1 AND game = ?2 AND day = ?3').bind(me.id, game, day).first(),
      db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first(),
    ]);
    const prevRank = allPrev.b != null && v < allPrev.b ? await rankOf(db, game, allPrev.b) : null;   // 기록 넣기 전 순위(축하 판단용)
    if (!prev || v < prev.best) {
      await db.prepare(`INSERT INTO scores (uid, game, day, best, at) VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT (uid, game, day) DO UPDATE SET best = excluded.best, at = excluded.at`).bind(me.id, game, day, v, Date.now()).run();
    }
    const best = allPrev.b == null ? v : Math.min(allPrev.b, v);
    const rank = await rankOf(db, game, best);
    const newBest = allPrev.b == null || v < allPrev.b;
    tierMemo.clear();
    // 히든 보상(2026-10-25 하율): 집(50,000m, home-score.js GOAL)에 '처음' 도착한 한 사람 → 집 열쇠 + 칭호. settings 'home_first'를 먼저 넣은 쪽만 성공(동시 도착도 한 명). 개발자 제외
    let first = false, arrived = false;
    // 집에 도착한 판(5만 m 이상): 같은 판을 '밖으로 나가기'로 이어 달릴 수 있게 출발 시각이 같은 이어 달리기 티켓을 하나 더 줌 (2026-10-25 하율)
    let next = null;
    if (game === 'home' && v <= HOME_MAX - GOAL) {
      next = randHex(16);
      await db.prepare('INSERT INTO rl (k, n, reset) VALUES (?1, ?2, ?3)').bind(`tk:${me.id}:${game}:${next}`, Date.now() - elapsed, Date.now() + 6 * 3600e3).run();   // n = 원래 출발 시각, 6시간 유효
    }
    if (game === 'home' && v <= HOME_MAX - GOAL && !isAdm(me)) {
      // 도착한 사람 모두: 칭호 '하교 성공' (처음 한 번만 표시)
      arrived = (await ownEdit(db, me.id, o => { if (o[HOME_MARK] > 0) return false; o[HOME_MARK] = 1; })) === true;
      const won = await db.prepare("INSERT INTO settings (k, v) VALUES ('home_first', ?1) ON CONFLICT (k) DO NOTHING RETURNING k")
        .bind(JSON.stringify({ uid: me.id, at: Date.now() })).first();
      if (won) {
        first = true;
        await ownEdit(db, me.id, o => { for (const h of HIDDEN) o[h.v] = 1; });
        // 사이트 전체 알림: 관리자가 올린 공지가 떠 있지 않을 때만 띠 공지로 48시간 (보상 내용은 말하지 않음 — 히든)
        try {
          const cur = JSON.parse((await db.prepare("SELECT v FROM settings WHERE k = 'notice'").first())?.v || 'null');
          if (!cur || (cur.until && cur.until < Date.now())) {
            const n = { id: randHex(4), text: `${me.name}님이 처음으로 집에 도착했어요! (집에 가고 싶어! ${GOAL.toLocaleString('en-US')}m)`.slice(0, 120), body: '', tone: 'fun', link: '#game', at: Date.now(), until: Date.now() + 48 * 3600e3 };
            await db.batch([
              db.prepare("INSERT INTO settings (k, v) VALUES ('notice', ?1) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(n)),
              db.prepare('INSERT INTO notices (id, text, tone, link, at, until, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(n.id, n.text, n.tone, n.link, n.at, n.until, n.body),
            ]);
          }
        } catch (e) { await logErr(db, 's', { url: 'https://svmhs-ground.pages.dev/home_first', method: 'NOTICE' }, e); }
      }
    }
    // 주간 미션 진행(미리보기 깃발 week-mission) — 처음 낸 기록은 '최고 기록 깨기'로 안 셈
    // 1판 기준(mission.js playCounts): 집에 가고 싶어! 200m · 기자재 정리! 300점 밑이면 판 수에 안 셈
    const mis = playCounts(game, v) ? await misEv(db, me, 'play', { game, v, best: allPrev.b != null && v < allPrev.b, day }) : null;
    // 전체 1~3등 축하(2026-10-25): 새 최고 기록으로 1~3등에 처음 들었거나 순위가 올랐을 때만
    return json({ ok: true, best, newBest, rank, first, arrived, next, mis, cheer: newBest && rank <= 3 && (prevRank == null || rank < prevRank) });
  }),

  'GET rank': needMe(async ({ db, me, url }) => {
    const game = url.searchParams.get('game'), scope = url.searchParams.get('scope') || 'all';
    if (!GAMES[game]) return err('bad game');
    const U = 'u.handle, u.name, u.avatar, u.color, u.grade, u.cls, u.seen, u.st_rep, u.gc_fx, u.gc_own';
    const BEST = `SELECT uid, MIN(best) AS best, at FROM scores WHERE game = ?1 AND ${NOT_DEV} GROUP BY uid`;
    if (scope === 'class') {   // 반 대항전: 반마다 최고 기록 상위 3명 평균
      const rows = (await db.prepare(`SELECT t.best, u.grade, u.cls FROM (${BEST}) t JOIN users u ON u.id = t.uid WHERE u.grade > 0 AND u.cls > 0 ORDER BY t.best`).bind(game).all()).results;
      const by = new Map();
      for (const r of rows) { const k = r.grade + '-' + r.cls; const l = by.get(k) || []; l.push(r.best); by.set(k, l); }
      const list = [...by].map(([k, l]) => { const top = l.slice(0, 3); return { grade: +k.split('-')[0], cls: +k.split('-')[1], value: Math.round(top.reduce((a, b) => a + b, 0) / top.length), players: l.length }; })
        .sort((a, b) => a.value - b.value);
      return json({ scope, list, mine: me.grade && me.cls ? { grade: me.grade, cls: me.cls } : null });
    }
    let rows;
    if (scope === 'round' || scope === 'week') {   // round = 이번 라운드(2주, 점수·티어) · week = 이번 주(1주, 끝나면 1~3등 뽑기권)
      const wk = scope === 'week', rd = wk ? wkOf(kstYmd()) : rkOf(kstYmd()), cur = rd.n < 0 ? (wk ? wkRange(0) : rkRange(0)) : rd;
      const BR = `SELECT uid, MIN(best) AS best, at FROM scores WHERE game = ?1 AND day BETWEEN ?2 AND ?3 AND ${NOT_DEV} GROUP BY uid`;
      rows = (await db.prepare(`SELECT ${U}, t.best AS value, t.uid FROM (${BR}) t JOIN users u ON u.id = t.uid ORDER BY t.best, t.at LIMIT 50`).bind(game, cur.from, cur.to).all()).results;
      const list = rows.map(r => ({ ...card(r), grade: r.grade, cls: r.cls, value: r.value, isMe: r.uid === me.id }));
      let mine = list.findIndex(x => x.isMe) + 1 || null, myValue = list.find(x => x.isMe)?.value ?? null;
      if (!mine) {
        const s2 = await db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2 AND day BETWEEN ?3 AND ?4').bind(me.id, game, cur.from, cur.to).first();
        if (s2?.b != null) { myValue = s2.b; mine = (await db.prepare(`SELECT COUNT(*) + 1 AS r FROM (${BR}) WHERE best < ?4`).bind(game, cur.from, cur.to, s2.b).first()).r; }
      }
      // 지난주 1~3등(뽑기권 받은 사람) — 주 보상은 game 'w:게임'
      const last = !wk ? [] : (await db.prepare(`SELECT k.place, k.tix, ${U} FROM rank_rewards k JOIN users u ON u.id = k.uid WHERE k.round = ?1 AND k.game = ?2 ORDER BY k.place`).bind(cur.n - 1, 'w:' + game).all()).results
        .map(r => ({ ...card(r), place: r.place, tix: r.tix }));
      return json({ scope, list, mine, myValue, round: { n: cur.n, from: cur.from, to: cur.to, started: rd.n >= 0, tix: RK.tix }, last });
    }
    if (scope === 'friends') {
      rows = (await db.prepare(`SELECT ${U}, t.best AS value, t.uid FROM (${BEST}) t JOIN users u ON u.id = t.uid
        WHERE t.uid = ?2 OR t.uid IN (SELECT f.b FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a WHERE f.a = ?2) ORDER BY t.best, t.at LIMIT 50`)
        .bind(game, me.id).all()).results;
    } else {
      rows = (await db.prepare(`SELECT ${U}, t.best AS value, t.uid FROM (${BEST}) t JOIN users u ON u.id = t.uid ORDER BY t.best, t.at LIMIT 50`).bind(game).all()).results;
    }
    const list = rows.map(r => ({ ...card(r), grade: r.grade, cls: r.cls, value: r.value, isMe: r.uid === me.id }));
    let mine = list.findIndex(x => x.isMe) + 1 || null;
    let myValue = list.find(x => x.isMe)?.value ?? null;
    if (!mine && scope === 'all') {
      const s = await db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first();
      if (s?.b != null) { myValue = s.b; mine = await rankOf(db, game, s.b); }
    }
    return json({ scope, list, mine, myValue });
  }),

  /* ----- 출석 체크 (lib/attend.js) ----- */
  // 오늘 출석: 하루 한 번만 기록(두 탭이 동시에 보내도 st_last 조건으로 한 번만). 이미 했으면 지금 상태만 돌려줌
  /* ----- 뽑기 ----- */
  'GET gacha': needMe(async ({ me }) => json({ ...gcPub(me), items: GACHA, rar: RAR, gc: GC, all: isAdm(me) })),
  // 뽑기: n = 1 또는 5. 확률·천장은 att-rewards.js RAR·GC. 두 탭에서 동시에 눌러도 한 번만 반영(이전 값 조건)
  'POST gacha': needMe(async ({ db, me, body }) => {
    const n = +body.n === 5 ? 5 : 1, adm = isAdm(me);
    if (!adm && (me.gc_tix ?? 0) < n) return err(n === 5 ? '뽑기권이 5장 있어야 해요' : '뽑기권이 없어요. 등교하는 날 출석하면 받아요');
    if (!adm && await limited(db, 'gc:' + me.id, 120, 600)) return err('너무 빨라요. 잠시 후에 해 주세요', 429);
    const own = gcOwn(me);
    // 천장은 계정마다 한 번씩만(2026-10-25 하율): 천장으로 '확정'된 순간 그 값을 -1로 바꿔 다시는 안 씀(자연히 나온 건 안 씀)
    let pity = me.gc_pity || 0, leg = me.gc_leg || 0, shard = me.gc_shard || 0, gotRare = false;
    const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = rnd() * 100;
      // 확률은 RAR(시크릿 0.03 · 전설 1 · 희귀 14.47 · 일반 84.5). 천장은 전설·희귀만, 각각 한 번(시크릿은 천장 없음 · 전설·시크릿은 조각 상점에도 없음)
      let rar = x < RAR[4].p ? 4 : x < RAR[4].p + RAR[3].p ? 3 : x < RAR[4].p + RAR[3].p + RAR[2].p ? 2 : 1, used = '';
      if (rar < 3 && leg >= 0 && leg + 1 >= GC.pityLeg) { rar = 3; used = 'leg'; }
      // 5연뽑: 희귀 이상 1개 확정(이건 매번). 1회용 희귀 천장보다 먼저 봐야 어차피 확정될 칸에서 천장이 헛되이 소모되지 않음(2026-10-26)
      else if (n === 5 && i === 4 && !gotRare && rar === 1) rar = 2;
      else if (rar < 2 && pity >= 0 && pity + 1 >= GC.pityRare) { rar = 2; used = 'pity'; }
      if (rar >= 2) gotRare = true;
      if (pity >= 0) pity = used === 'pity' ? -1 : rar >= 2 ? 0 : pity + 1;
      if (leg >= 0) leg = used === 'leg' ? -1 : rar >= 3 ? 0 : leg + 1;
      const pool = GACHA.filter(g => g.rar === rar), g = pool[Math.floor(rnd() * pool.length)];
      const isNew = !own[g.v];
      own[g.v] = (own[g.v] || 0) + 1;
      const sh = isNew ? 0 : GC.shard[rar]; shard += sh;
      out.push({ v: g.v, rar, new: isNew, shard: sh });
    }
    const tix = adm ? (me.gc_tix ?? 0) : (me.gc_tix ?? 0) - n;
    const r = await db.prepare('UPDATE users SET gc_tix = ?1, gc_own = ?2, gc_pity = ?3, gc_leg = ?4, gc_shard = ?5 WHERE id = ?6 AND gc_tix = ?7 AND gc_own = ?8 RETURNING id')
      .bind(tix, JSON.stringify(own), pity, leg, Math.min(shard, 9999), me.id, me.gc_tix ?? 0, me.gc_own || '{}').first();
    if (!r) return err('다른 창에서 먼저 뽑았어요. 한 번 더 눌러 주세요', 409);
    const mis = await misEv(db, me, 'gacha', { n });   // 미션 뽑기권은 gcPub 뒤에 더함
    const after = { ...me, gc_tix: tix + (mis ? mis.got.length * MS.tix : 0), gc_own: JSON.stringify(own), gc_pity: pity, gc_leg: leg, gc_shard: shard };
    return json({ out, ...gcPub(after), mis });
  }),
  // 조각 → 뽑기권 교환은 없앰(2026-10-25 하율: "메리트 없음") — 예전 화면이 부르면 안내만
  'POST gachaex': needMe(async () => err('조각은 이제 스티커 골라 받기·반짝이 강화에 써요. 새로 고침해 주세요')),
  // 조각으로 골라 받기: 아직 없는 것 하나(시크릿 포함) — 가격 GC.pick[등급]
  'POST gcpick': needMe(async ({ db, me, body }) => {
    const v = String(body.v || ''), it = GACHA.find(g => g.v === v), own = gcOwn(me);
    if (!it) return err('지금 시즌에서 받을 수 없는 거예요');
    if (own[v]) return err('이미 가지고 있어요');
    const cost = GC.pick[it.rar];
    if (!cost) return err('전설·시크릿은 조각으로 받을 수 없어요. 뽑기로만 나와요');   // 2026-10-25 하율
    if ((me.gc_shard || 0) < cost) return err(`조각이 ${cost}개 있어야 받을 수 있어요`);
    own[v] = 1;
    const r = await db.prepare('UPDATE users SET gc_shard = gc_shard - ?1, gc_own = ?2 WHERE id = ?3 AND gc_own = ?4 AND gc_shard >= ?1 RETURNING gc_shard')
      .bind(cost, JSON.stringify(own), me.id, me.gc_own || '{}').first();
    if (!r) return err('다시 한 번 눌러 주세요', 409);
    return json({ v, ...gcPub({ ...me, gc_shard: r.gc_shard, gc_own: JSON.stringify(own) }) });
  }),
  // 반짝이 강화: 가진 스티커(일반·희귀)를 반짝이 버전으로 — own['r:x_s'] = 1. 원래 스티커도 그대로 씀
  'POST gcshine': needMe(async ({ db, me, body }) => {
    const v = String(body.v || ''), it = GACHA.find(g => g.v === v), own = gcOwn(me);
    if (!it || it.fx || !GC.shine[it.rar]) return err('반짝이로 바꿀 수 없는 거예요');
    if (!own[v]) return err('먼저 이 스티커를 뽑아야 해요');
    if (own[v + SHN]) return err('이미 반짝이로 바꿨어요');
    const cost = GC.shine[it.rar];
    if ((me.gc_shard || 0) < cost) return err(`조각이 ${cost}개 있어야 바꿀 수 있어요`);
    own[v + SHN] = 1;
    const r = await db.prepare('UPDATE users SET gc_shard = gc_shard - ?1, gc_own = ?2 WHERE id = ?3 AND gc_own = ?4 AND gc_shard >= ?1 RETURNING gc_shard')
      .bind(cost, JSON.stringify(own), me.id, me.gc_own || '{}').first();
    if (!r) return err('다시 한 번 눌러 주세요', 409);
    return json({ v: v + SHN, ...gcPub({ ...me, gc_shard: r.gc_shard, gc_own: JSON.stringify(own) }) });
  }),
  // 랭킹 보상 알림 봤음
  'POST rkseen': needMe(async ({ db, me }) => { await db.prepare('UPDATE rank_rewards SET seen = 1 WHERE uid = ?1 AND seen = 0').bind(me.id).run(); return json({ ok: true }); }),
  // 효과 켜기·끄기: body { slot: name|prof|clock|masc, v: 'r:…' 또는 '' }
  'POST gcfx': needMe(async ({ db, me, body }) => {
    const slot = String(body.slot || ''), v = String(body.v || '');
    if (!FX[slot]) return err('bad slot');
    if (v && (!fxOk(slot, v) || ((!isAdm(me) || isHidden(v)) && !(gcOwn(me)[v] > 0)))) return err('아직 없는 효과예요');
    const fx = gcFx(me); if (v) fx[slot] = v; else delete fx[slot];
    await db.prepare('UPDATE users SET gc_fx = ?1 WHERE id = ?2').bind(JSON.stringify(fx), me.id).run();
    return json(gcPub({ ...me, gc_fx: JSON.stringify(fx) }));
  }),
  // 중복 스티커 선물: body { to: 아이디, v } — 일반·희귀 스티커만, 2개 이상 가진 것만(하나는 남김), 맞팔 친구에게만. 받는 사람 DM에 스티커가 감
  'POST gcgift': needMe(async ({ db, me, body }) => {
    const v = String(body.v || ''), it = gcItem(v);
    if (!it || it.fx) return err('선물할 수 없는 스티커예요');
    const own = gcOwn(me);
    if (!isAdm(me) && !((own[v] || 0) >= 2)) return err('2개 이상 가진 스티커만 선물할 수 있어요');
    const u = await byHandle(db, body.to);
    if (!u || u.id === me.id) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blocked || r.blockedMe || !(r.following && r.followsMe)) return err('서로 팔로우한 친구에게만 선물할 수 있어요', 403);
    if (!isAdm(me) && await limited(db, 'gift:' + me.id, 20, 3600)) return err('선물은 1시간에 20번까지예요', 429);
    if (!isAdm(me)) {
      own[v] -= 1;
      const ok = await db.prepare('UPDATE users SET gc_own = ?1 WHERE id = ?2 AND gc_own = ?3 RETURNING id').bind(JSON.stringify(own), me.id, me.gc_own || '{}').first();
      if (!ok) return err('다시 한 번 눌러 주세요', 409);
    }
    // 받는 사람 쪽도 이전 값 조건으로(동시에 뽑아도 안 날아가게). 끝내 못 넣으면 보낸 사람에게 되돌려 줌(스티커가 사라지지 않게)
    if (!await ownEdit(db, u.id, o => { o[v] = (o[v] || 0) + 1; })) {
      if (!isAdm(me)) await ownEdit(db, me.id, o => { o[v] = (o[v] || 0) + 1; });
      return err('선물이 전해지지 않았어요. 다시 한 번 눌러 주세요', 409);
    }
    const now = Date.now(), pair = pairOf(me.id, u.id);
    await db.batch([
      db.prepare('INSERT INTO messages (pair, a, b, body, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(pair, me.id, u.id, `선물: ${objName(v)} 스티커를 보냈어요!`, now),
      db.prepare('INSERT INTO messages (pair, a, b, body, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(pair, me.id, u.id, '::' + v, now + 1),
    ]);
    return json(gcPub({ ...me, gc_own: JSON.stringify(own) }));
  }),
  'POST att': needMe(async ({ env, db, me }) => attState(env, db, me, true)),
  'GET att': needMe(async ({ env, db, me, url }) => {
    const m = url.searchParams.get('m') || kstToday().slice(0, 6);
    if (!/^\d{6}$/.test(m)) return err('bad month');
    const [st, days] = await Promise.all([attState(env, db, me, false, true),
      db.prepare("SELECT ymd, kind FROM attendance WHERE uid = ?1 AND ymd LIKE ?2 ORDER BY ymd").bind(me.id, m + '%').all()]);
    const body = await st.json();
    return json({ ...body, month: m, days: days.results });
  }),
  // 연속 출석 랭킹: 친구(맞팔 + 나) · 전체 (지금 살아 있는 기록 기준, 같으면 최고 기록 순)
  'GET attrank': needMe(async ({ env, db, me, url }) => {
    const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'friends';
    const U = 'u.id, u.handle, u.name, u.avatar, u.color, u.grade, u.cls, u.seen, u.mood, u.st_cur, u.st_best, u.st_last, u.st_shield, u.st_pf, u.st_title, u.st_rep, u.gc_fx, u.gc_own';
    const since = (() => { const d = new Date(Date.now() + 9 * 3600e3 - 120 * 86400e3); return d.toISOString().slice(0, 10).replace(/-/g, ''); })();
    const rows = (scope === 'friends'
      ? await db.prepare(`SELECT ${U} FROM users u WHERE u.st_cur > 0 AND u.st_last >= ?3 AND u.handle <> '${ADMIN_HANDLE}' AND (u.id = ?1 OR u.id IN (SELECT f.b FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a WHERE f.a = ?1)) ORDER BY u.st_cur DESC LIMIT ?2`).bind(me.id, 200, since).all()
      : await db.prepare(`SELECT ${U} FROM users u WHERE u.st_cur > 0 AND u.st_last >= ?3 AND u.is_test = 0 AND u.handle <> ?1 ORDER BY u.st_cur DESC LIMIT ?2`).bind(ADMIN_HANDLE, 300, since).all()).results;
    const live = await liveMany(env, db, rows);
    const list = rows.map((r, i) => ({ ...card(r), grade: r.grade, cls: r.cls, value: isAdm(r) ? ALL_OPEN : live[i], best: isAdm(r) ? ALL_OPEN : r.st_best, pf: !!r.st_pf, title: r.st_title || '', isMe: r.id === me.id, uid: r.id }))
      .filter(x => x.value > 0).sort((a, b) => b.value - a.value || b.best - a.best || a.uid - b.uid);   // 같으면 먼저 가입한 사람(배포 첫날 모두 1일일 때 순서가 매번 바뀌지 않게)
    // 하율 본인 계정은 연속 출석 랭킹에서 5위 이하로만 보이게(2026-10-26 하율 요청) — 실제 출석 기록은 그대로, 순위 표시만
    const hi = list.findIndex(x => x.handle === OWNER_HANDLE);
    if (hi >= 0 && hi < 4) {
      const [h] = list.splice(hi, 1), at = Math.min(4, list.length), up = list[at - 1];
      if (up) { h.value = Math.min(h.value, up.value); h.best = Math.min(h.best, up.best); }
      list.splice(at, 0, h);
    }
    list.length = Math.min(list.length, 50);
    return json({ scope, list: list.map(({ uid, ...x }) => x) });
  }),

  // 이번 라운드 티어판(2026-10-25): 내 티어·점수·게임별 순위 + 상위 10명
  // ?k=티어 → 그 티어에 지금 있는 사람 전부(순위순, 최대 200명) — 2026-10-26 하율 '티어 누르면 누가 있는지'
  'GET tier': needMe(async ({ db, me, url }) => {
    const b = await tierBoard(db), mine = b.list.find(x => x.uid === me.id) || null;
    const pub1 = x => ({ rank: x.rank, pts: x.pts, tier: x.tier, games: x.games });
    const usersOf = async ids => {   // D1 바인드 한도 때문에 90개씩
      const out = new Map();
      for (let i = 0; i < ids.length; i += 90) { const c = ids.slice(i, i + 90);
        (await db.prepare(`SELECT ${PUB} FROM users WHERE id IN (${c.map(() => '?').join(',')})`).bind(...c).all()).results.forEach(u => out.set(u.id, u)); }
      return out;
    };
    const k = url.searchParams.get('k');
    if (k) {
      if (!tierOfK(k)) return err('없는 티어예요');
      const all = b.list.filter(x => x.tier === k), mem = all.slice(0, 200), byId = await usersOf(mem.map(x => x.uid));
      return json({ k, n: all.length, list: mem.map(x => ({ ...card(byId.get(x.uid)), rank: x.rank, pts: x.pts, isMe: x.uid === me.id })).filter(x => x.handle) });
    }
    // ?all=1 → 이번 라운드 전체 순위(최대 500명) — 2026-10-26 하율 'TOP 10 아래 버튼으로 전체 순위'
    if (url.searchParams.get('all')) {
      const mem = b.list.slice(0, 500), byId = await usersOf(mem.map(x => x.uid));
      return json({ n: b.list.length, list: mem.map(x => ({ ...card(byId.get(x.uid)), ...pub1(x), isMe: x.uid === me.id })).filter(x => x.handle) });
    }
    const cnt = {}; b.list.forEach(x => { cnt[x.tier] = (cnt[x.tier] || 0) + 1; });
    const top = b.list.slice(0, 10), byId = await usersOf(top.map(x => x.uid));
    return json({ cnt, round: { n: b.n, from: b.from, to: b.to }, players: b.list.length, mode: b.mode, tiers: TIERS,
      me: mine ? pub1(mine) : null, last: tierLastOf(me),
      top: top.map(x => ({ ...card(byId.get(x.uid)), ...pub1(x), isMe: x.uid === me.id })).filter(x => x.handle) });
  }),

  // 급식 투표(기기 ID로 /api/vote에 저장됨) → 로그인한 사람의 주간 미션 '급식 투표 n일'. 오늘 그 기기로 실제 투표한 기록이 있어야 셈
  'POST mealmis': needMe(async ({ db, me, req }) => {
    const voter = req.headers.get('x-voter') || '', day = kstYmd();
    if (!/^[a-z0-9]{20,40}$/.test(voter)) return err('bad voter');
    const v = await db.prepare('SELECT 1 FROM meal_votes WHERE ymd = ?1 AND voter = ?2 LIMIT 1').bind(day, voter).first();
    return json({ ok: true, mis: v ? await misEv(db, me, 'meal', { day }) : null });
  }),
  // 다 한 미션의 뽑기권 받기(2026-10-27 하율: 완료 전에 '받기' 버튼 → 누르면 받는 애니메이션). 이번 주 것만, 한 번만(이전 값 조건)
  'POST misclaim': needMe(async ({ db, me, body }) => {
    if (!ffOn('week-mission', isAdm(me))) return err('not found', 404);
    const i = +body.i, wk = weekKey(), list = missionsOf(wk, MS_GAMES());
    if (body.wk && body.wk !== wk) return err('미션이 새 주로 바뀌었어요. 다시 열어 주세요', 409);
    if (!Number.isInteger(i) || !list[i]) return err('bad mission');
    for (let tryN = 0; tryN < 3; tryN++) {
      const { row, p } = await misGet(db, me, wk);
      if (p.d?.[i]) return err('이미 받은 뽑기권이에요', 409);
      if (!row || progOf(list[i], p) < list[i].n) return err('아직 미션을 다 하지 않았어요');
      const q = { ...p, d: [...(p.d || [])] }; q.d[i] = 1;
      const ok = await db.prepare('UPDATE missions SET p = ?1 WHERE uid = ?2 AND day = ?3 AND p = ?4 RETURNING uid').bind(JSON.stringify(q), me.id, 'w' + wk, row.p).first();
      if (!ok) continue;
      const u = await db.prepare(`UPDATE users SET gc_tix = MIN(${GC.max}, gc_tix + ?1) WHERE id = ?2 RETURNING gc_tix`).bind(MS.tix, me.id).first();
      return json({ ...misOut(wk, q), claimed: i, tix: u?.gc_tix ?? null });
    }
    return err('잠시 후 다시 해 주세요', 409);
  }),
  // 개발자 테스트용(2026-10-27 하율 "내 미션 다 완료, 티켓 받기 전으로"): 이번 주 미션 진행을 전부 채우고 받음 표시는 비움 → 5개 모두 '받기'
  'POST misfill': needMe(async ({ db, me }) => {
    if (!isAdm(me)) return err('개발자만 쓸 수 있어요', 403);
    const wk = weekKey(), many = Array.from({ length: 20 }, (_, k) => 'x' + k), all = Object.fromEntries(Object.keys(GAMES).map(g => [g, 99]));
    const p = { c: { play: 99, best: 99, att: 99, gacha: 99, prof: 99, balc: 99 }, g: all, ok: Object.fromEntries(Object.keys(GAMES).map(g => [g, 1])),
      s: Object.fromEntries(['days', 'bal', 'balc', 'meal', 'like', 'dm', 'fol'].map(k => [k, many])), d: [] };
    await db.prepare('INSERT INTO missions (uid, day, p) VALUES (?1, ?2, ?3) ON CONFLICT (uid, day) DO UPDATE SET p = excluded.p').bind(me.id, 'w' + wk, JSON.stringify(p)).run();
    return json(misOut(wk, p));
  }),
  'GET mission': needMe(async ({ db, me }) => {
    if (!ffOn('week-mission', isAdm(me))) return err('not found', 404);
    const wk = weekKey(), { p } = await misGet(db, me, wk);
    return json(misOut(wk, p));
  }),
  'GET games': needMe(async ({ db, me }) => {   // 게임 첫 화면: 게임별 1등 · 내 최고 기록 · 내 순위
    const out = {};
    await Promise.all(Object.keys(GAMES).map(async game => {
      const [top, ma] = await Promise.all([
        db.prepare(`SELECT u.handle, u.name, u.avatar, u.color, u.seen, u.mood, s.best FROM scores s JOIN users u ON u.id = s.uid WHERE s.game = ?1 AND u.handle <> '${ADMIN_HANDLE}' ORDER BY s.best, s.at LIMIT 1`).bind(game).first(),
        db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first(),
      ]);
      const best = ma?.b ?? null;
      out[game] = { top: top ? { ...card(top), value: top.best } : null, best, rank: best != null ? await rankOf(db, game, best) : null };
    }));
    return json({ games: out });
  }),
};

/* ===== 출석 상태 계산 · 오늘 출석 기록 ===== */
async function attState(env, db, me, doCheck, quiet = false) {
  const today = kstToday();
  const pick = x => ({ st_cur: x.st_cur || 0, st_best: x.st_best || 0, st_last: x.st_last || '', st_total: x.st_total || 0, st_shield: x.st_shield || 0, st_pf: x.st_pf ?? 1 });
  let u = pick(me);
  const week = weekOf(today);
  const weekRows = async () => (await db.prepare(`SELECT ymd, kind FROM attendance WHERE uid = ?1 AND ymd >= ?2 AND ymd <= ?3`).bind(me.id, week[0], week[6]).all()).results;
  const out = (extra = {}) => {
    const cur = u.st_last === today ? u.st_cur : liveCur(u, extra.missed ?? []);
    return { today, done: u.st_last === today, cur, best: u.st_best, total: u.st_total, shield: u.st_shield, pf: !!u.st_pf && cur > 0,
      shieldMax: shieldMaxOf(isAdm(me) ? ALL_OPEN : u.st_best, u.st_total), shieldEvery: SHIELD_EVERY, week, all: isAdm(me), ...extra, missed: undefined, ...(isAdm(me) ? { cur: ALL_OPEN, best: ALL_OPEN } : {}) };   // 개발자: 연속 출석 무한(화면엔 ∞)   // all: 개발자는 보상 전부 받은 상태로 표시
  };
  if (u.st_last === today) return json(out({ new: false, weekDays: quiet ? undefined : await weekRows() }));
  const [missed, rest] = await Promise.all([missedDays(env, db, u.st_last, today), restDay(env, db, today)]);
  if (!doCheck || rest) return json(out({ new: false, missed, rest }));   // 쉬는 날(주말·휴업일)은 출석을 세지 않음 — 기록도 그대로
  const prevLive = liveCur(u, missed);
  let cur, used = 0, pf = u.st_pf;
  if (prevLive > 0) { used = missed.length; cur = u.st_cur + 1; if (used) pf = 0; } else { cur = 1; pf = 1; }
  let shield = (prevLive > 0 ? u.st_shield - used : u.st_shield);
  const gotShield = cur % SHIELD_EVERY === 0 && shield < shieldMaxOf(isAdm(me) ? ALL_OPEN : Math.max(u.st_best, cur), u.st_total + 1);
  if (gotShield) shield++;
  const best = Math.max(u.st_best, cur), old = { ...u };
  const tix = gcEarn(cur);   // 뽑기권: 출석 1 + 연속 5일마다 1 + 기념일 1
  const r = await db.prepare(`UPDATE users SET st_cur = ?1, st_best = ?2, st_last = ?3, st_total = st_total + 1, st_shield = ?4, st_pf = ?7, gc_tix = MIN(${GC.max}, gc_tix + ?8) WHERE id = ?5 AND st_last = ?6 RETURNING st_total, gc_tix`)
    .bind(cur, best, today, shield, me.id, u.st_last, pf, tix).first();
  if (!r) {   // 다른 탭이 먼저 기록함 → 새로 읽어서 상태만
    u = pick(await db.prepare('SELECT st_cur, st_best, st_last, st_total, st_shield, st_pf FROM users WHERE id = ?1').bind(me.id).first());
    return json(out({ new: false, weekDays: await weekRows() }));
  }
  const stmts = [db.prepare('INSERT OR IGNORE INTO attendance (uid, ymd, kind) VALUES (?1, ?2, 1)').bind(me.id, today)];
  if (used) for (const y of missed) stmts.push(db.prepare('INSERT OR IGNORE INTO attendance (uid, ymd, kind) VALUES (?1, ?2, 2)').bind(me.id, y));
  await db.batch(stmts);
  const lost = prevLive === 0 && old.st_cur > 0 ? old.st_cur : 0;   // 끊긴 기록(있었다면)
  u = { st_cur: cur, st_best: best, st_last: today, st_total: r.st_total, st_shield: shield, st_pf: pf };
  // 새로 열린 보상: 연속은 최고 기록이 넘어선 것, 누적은 총 출석일이 넘어선 것
  const unlocked = REWARDS.filter(x => !rwOn(x, old.st_best, old.st_total) && rwOn(x, best, r.st_total));
  const mis = await misEv(db, me, 'att');
  return json(out({ new: true, mis, prev: prevLive, lost, used, gotShield, unlocked, tix, tixNow: r.gc_tix + (mis ? mis.got.length * MS.tix : 0), milestone: unlocked.length > 0 || MILESTONES.includes(cur), weekDays: await weekRows() }));
}

// 게임 랭킹 라운드 정산(att-rewards.js RK, 2026-10-25): 끝난 라운드마다 게임별 1~3등에게 뽑기권 RK.tix장.
// rank_rewards 기본키(round, game, place)로 한 번만 — 동시에 여러 요청이 와도 INSERT OR IGNORE가 성공한 쪽만 지급. game '*' 줄 = 그 라운드 정산 끝 표시
let rkChecked = -2, wkChecked = -2;   // 이 워커에서 이미 정산을 확인한 마지막 라운드·주(매 요청 DB를 안 보려고)
async function settleRounds(db) {
  const today = kstYmd(), wcur = wkOf(today).n, cur = rkOf(today).n;
  // 1주 정산: 끝난 주마다 게임별 1~3등에게 뽑기권 RK.tix장 (rank_rewards game 'w:게임', 끝 표시 'w*')
  if (wcur >= 1 && wkChecked < wcur - 1) {
    for (let n = Math.max(0, wcur - 2); n < wcur; n++) {
      if (await db.prepare("SELECT 1 AS x FROM rank_rewards WHERE round = ?1 AND game = 'w*'").bind(n).first()) continue;
      const { from, to } = wkRange(n);
      for (const game of Object.keys(GAMES)) {
        const top = (await db.prepare(`SELECT uid, MIN(best) AS b, at FROM scores WHERE game = ?1 AND day BETWEEN ?2 AND ?3 AND ${NOT_DEV} GROUP BY uid ORDER BY b, at LIMIT 3`).bind(game, from, to).all()).results;
        for (let i = 0; i < top.length; i++) {
          const t = RK.tix[i];
          const ins = await db.prepare('INSERT OR IGNORE INTO rank_rewards (round, game, place, uid, tix, seen, at) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)').bind(n, 'w:' + game, i + 1, top[i].uid, t, Date.now()).run();
          if (ins.meta?.changes) await db.prepare(`UPDATE users SET gc_tix = MIN(${GC.max}, gc_tix + ?1) WHERE id = ?2`).bind(t, top[i].uid).run();
        }
      }
      await db.prepare("INSERT OR IGNORE INTO rank_rewards (round, game, place, uid, tix, seen, at) VALUES (?1, 'w*', 0, 0, 0, 1, ?2)").bind(n, Date.now()).run();
    }
    wkChecked = wcur - 1;
  }
  // 2주 정산: 끝난 라운드의 최종 티어를 지난 라운드 배지로 (끝 표시 '*')
  if (cur >= 1 && rkChecked < cur - 1) {
    for (let n = Math.max(0, cur - 2); n < cur; n++) {
      if (await db.prepare("SELECT 1 AS x FROM rank_rewards WHERE round = ?1 AND game = '*'").bind(n).first()) continue;
      const tb = await tierBoard(db, n);
      for (let i = 0; i < tb.list.length; i += 50) await db.batch(tb.list.slice(i, i + 50).map(x => db.prepare('UPDATE users SET tier_last = ?1 WHERE id = ?2').bind(n + ':' + x.tier, x.uid)));
      await db.prepare("INSERT OR IGNORE INTO rank_rewards (round, game, place, uid, tix, seen, at) VALUES (?1, '*', 0, 0, 0, 1, ?2)").bind(n, Date.now()).run();
    }
    rkChecked = cur - 1;
  }
}

// 라운드 티어판: 게임마다 라운드 안 개인 최고로 순위 → 순위 점수(gamePts) 합 → 줄 세워 백분위로 티어(tierAt). 개발자 제외.
// 같은 워커에서 60초 동안은 다시 계산 안 함(기록이 저장되면 tierMemo.clear())
const tierMemo = new Map();
async function tierBoard(db, n) {
  const rd = rkOf(kstYmd()), cur = n ?? (rd.n < 0 ? 0 : rd.n), { from, to } = rkRange(cur);
  const hit = tierMemo.get(cur); if (hit && Date.now() - hit.at < 60e3) return hit.b;
  const acc = new Map();
  await Promise.all(Object.keys(GAMES).map(async game => {
    const rows = (await db.prepare(`SELECT uid, MIN(best) AS b, MIN(at) AS at FROM scores WHERE game = ?1 AND day BETWEEN ?2 AND ?3 AND ${NOT_DEV} GROUP BY uid ORDER BY b, at`).bind(game, from, to).all()).results;
    let rk = 0;
    rows.forEach((r, i) => { rk = i > 0 && rows[i - 1].b === r.b ? rk : i + 1;   // 같은 기록 = 같은 순위·같은 점수 (2026-10-26 핫픽스)
      const a = acc.get(r.uid) || { uid: r.uid, pts: 0, games: {} }; const p = gamePts(rk, rows.length); a.pts += p; a.games[game] = { r: rk, n: rows.length, p }; acc.set(r.uid, a); });
  }));
  // 2026-10-26 하율 핫픽스: 잘한 3개 게임 점수만 합산(BEST_N) — 싫은 게임 하나는 안 해도 되게.
  //   pts = 잘한 3개 합(티어 기준), all = 4개 전체 합. 동점이면 all → 1등 횟수 순으로 가림(챌린저가 둘 나오지 않게)
  for (const a of acc.values()) {
    const g = Object.entries(a.games).sort((x, y) => y[1].p - x[1].p);
    g.forEach(([, v], i) => { if (i >= BEST_N) v.x = 1; });   // x = 합산에서 빠진 게임
    a.all = a.pts; a.pts = g.slice(0, BEST_N).reduce((t, [, v]) => t + v.p, 0);
    a.first = g.filter(([, v]) => v.r === 1).length;
  }
  const cmp = (a, b) => b.pts - a.pts || b.all - a.all || b.first - a.first;
  const list = [...acc.values()].sort((a, b) => cmp(a, b) || Object.keys(b.games).length - Object.keys(a.games).length);
  list.forEach((x, i) => { x.rank = i > 0 && !cmp(list[i - 1], x) ? list[i - 1].rank : i + 1; x.tier = tierAt(x.rank, list.length, x.pts).k; });
  const b = { n: cur, from, to, list, mode: tierMode(list.length) };
  tierMemo.set(cur, { at: Date.now(), b });
  return b;
}
const tierLastOf = u => { const [n, k] = String(u.tier_last || '').split(':'); return k && tierOfK(k) ? { n: +n, k } : null; };
async function tierOfUser(db, u) {
  const x = (await tierBoard(db)).list.find(y => y.uid === u.id);
  return { cur: x ? { k: x.tier, rank: x.rank, pts: x.pts } : null, last: tierLastOf(u) };
}

async function rankOf(db, game, best) {   // 나보다 최고 기록이 좋은 사람 수 + 1
  return (await db.prepare(`SELECT COUNT(*) + 1 AS r FROM (SELECT MIN(best) AS b FROM scores WHERE game = ?1 AND ${NOT_DEV} GROUP BY uid) WHERE b < ?2`).bind(game, best).first()).r;
}

async function topCrowns(db, uid) {   // 역대 1등인 게임 + 자세히(기록·언제부터·2등과 차이·참가 인원) — 2026-10-25 하율 요청
  const games = Object.keys(GAMES);
  const tops = await Promise.all(games.map(game => db.prepare(`SELECT uid, best, at FROM scores WHERE game = ?1 AND ${NOT_DEV} ORDER BY best, at LIMIT 1`).bind(game).first()));
  const mine = games.map((g, i) => [g, tops[i]]).filter(([, t]) => t?.uid === uid);
  return Promise.all(mine.map(async ([g, t]) => {
    const [sec, cnt] = await Promise.all([
      db.prepare(`SELECT MIN(best) AS b FROM scores WHERE game = ?1 AND ${NOT_DEV} AND uid != ?2`).bind(g, uid).first(),
      db.prepare(`SELECT COUNT(DISTINCT uid) AS n FROM scores WHERE game = ?1 AND ${NOT_DEV}`).bind(g).first(),
    ]);
    return { g, best: t.best, at: t.at, gap: sec?.b != null ? sec.b - t.best : null, n: cnt?.n || 1 };
  }));
}
