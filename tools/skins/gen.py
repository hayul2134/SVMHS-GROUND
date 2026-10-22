# 테마(스킨) CSS 생성기 — 실행: python3 tools/skins/gen.py
# style.css 안의 "/* ===== 스킨 (자동 생성" ~ "/* ===== 스킨 끝 ===== */" 구간을 통째로 바꿔 씀.
# 색 테마는 색상(h)·채도(s)만 정하면 밝은/어두운 토큰을 둘 다 만든다. 캐릭터 테마는 여기에 마스코트 그림이 더해짐.
# 캐릭터는 모두 이 사이트용 오리지널 동물 그림(기존 캐릭터를 따라 그리지 않음).
import re, urllib.parse, pathlib

CSS = pathlib.Path(__file__).resolve().parents[2] / 'public/css/style.css'
O = '#2b2433'  # 마스코트 외곽선

def svg(body, vb='0 0 100 100'):
    s = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='{vb}'>{body}</svg>"
    return "url(\"data:image/svg+xml," + urllib.parse.quote(s, safe=" ='/:,().-") + "\")"

def S(w=4):
    return f"stroke='{O}' stroke-width='{w}' stroke-linejoin='round' stroke-linecap='round'"

def eyes(y=60, x1=36, x2=64, r=6):
    # 반짝이는 큰 눈: 진한 타원 + 큰 하이라이트 + 작은 하이라이트
    o = ''
    for x in (x1, x2):
        o += (f"<ellipse cx='{x}' cy='{y}' rx='{r}' ry='{r*1.15:.1f}' fill='{O}'/>"
              f"<circle cx='{x+r*.33:.1f}' cy='{y-r*.45:.1f}' r='{r*.42:.1f}' fill='#fff'/>"
              f"<circle cx='{x-r*.38:.1f}' cy='{y+r*.48:.1f}' r='{r*.18:.1f}' fill='#fff'/>")
    return o

def blush(y=69, dx=25, rx=6.5, ry=3.8, c='#ff8fa3', o=.6):
    return f"<ellipse cx='{50-dx}' cy='{y}' rx='{rx}' ry='{ry}' fill='{c}' opacity='{o}'/><ellipse cx='{50+dx}' cy='{y}' rx='{rx}' ry='{ry}' fill='{c}' opacity='{o}'/>"

def wm(y=68, w=6):
    # ω 입
    return f"<path d='M{50-w} {y} q{w/2} {w*.6:.1f} {w} 0 q{w/2} {w*.6:.1f} {w} 0' fill='none' {S(2.6)}/>"

def nose(y=64, c=O):
    return f"<path d='M47.2 {y} h5.6 q0 2.8 -2.8 3.4 q-2.8 -.6 -2.8 -3.4z' fill='{c}' {S(1.4)}/>"

def head(fill, cx=50, cy=60, rx=38, ry=31):
    return f"<ellipse cx='{cx}' cy='{cy}' rx='{rx}' ry='{ry}' fill='{fill}' {S()}/>"

def cloud(circles, fill):
    # 겹친 원 테두리만 바깥에 남기기: 테두리 그리기 → 같은 원을 채우기만 해서 안쪽 선 지우기
    return (''.join(f"<circle cx='{x}' cy='{y}' r='{r}' fill='{fill}' {S()}/>" for x, y, r in circles)
            + ''.join(f"<circle cx='{x}' cy='{y}' r='{r-2}' fill='{fill}'/>" for x, y, r in circles))

SPARK = "<path d='M88 14 q1.2 5 6 6 q-4.8 1 -6 6 q-1.2 -5 -6 -6 q4.8 -1 6 -6z' fill='#fff6a8' stroke='#2b2433' stroke-width='2' stroke-linejoin='round'/>"

# 모두 이 사이트용 오리지널 그림(기존 캐릭터를 따라 그리지 않음). 얼굴은 아래쪽·큰 눈·볼터치로 통일
MASCOT = {
  'cat': "<path d='M17 48 Q12 14 26 15 Q37 19 45 32Z' fill='#ffb36b' " + S() + "/><path d='M83 48 Q88 14 74 15 Q63 19 55 32Z' fill='#ffb36b' " + S() + "/>"
         "<path d='M23 38 Q21 23 27 23 Q33 25 37 31Z' fill='#ffc7c0'/><path d='M77 38 Q79 23 73 23 Q67 25 63 31Z' fill='#ffc7c0'/>"
         + head('#ffb36b', ry=31) +
         "<path d='M44 31 q3 5 0 9 M50 30 v10 M56 31 q-3 5 0 9' stroke='#e8893a' stroke-width='3.2' fill='none' stroke-linecap='round'/>"
         "<ellipse cx='50' cy='69' rx='12' ry='8' fill='#fff1e2'/>"
         + eyes(60, 35, 65) + blush(70, 25) + nose(64.5) + wm(68.5) +
         "<path d='M9 63 l12 1.5 M10 71 l11 -2 M91 63 l-12 1.5 M90 71 l-11 -2' " + S(2.2) + "/>",
  'dog': head('#fff3dd', cy=60, rx=36, ry=31) +
         "<ellipse cx='64' cy='58' rx='10.5' ry='9.5' fill='#f2c99c'/>"
         "<path d='M26 33 Q8 34 8 56 Q9 71 20 67 Q27 63 30 46Z' fill='#c48a5a' " + S() + "/><path d='M74 33 Q92 34 92 56 Q91 71 80 67 Q73 63 70 46Z' fill='#c48a5a' " + S() + "/>"
         + eyes(59, 36, 64) + blush(71, 24) +
         "<ellipse cx='50' cy='71' rx='13' ry='9' fill='#fff' " + S(3) + "/>"
         "<ellipse cx='50' cy='66.5' rx='5.6' ry='4' fill='#2b2433'/><circle cx='51.8' cy='65.4' r='1.3' fill='#fff'/>"
         "<path d='M47.5 75 q2.5 6.5 5 0z' fill='#ff7f8f' " + S(2) + "/>"
         "<path d='M50 70.5 v2.5 M50 73 q-3.5 3.5 -7 .5 M50 73 q3.5 3.5 7 .5' fill='none' " + S(2.4) + "/>",
  'bear': "<circle cx='23' cy='31' r='13' fill='#a7714a' " + S() + "/><circle cx='77' cy='31' r='13' fill='#a7714a' " + S() + "/>"
          "<circle cx='23' cy='31' r='6.5' fill='#f3c9a0'/><circle cx='77' cy='31' r='6.5' fill='#f3c9a0'/>"
          + head('#a7714a', cy=61, rx=37, ry=31) + eyes(59, 36, 64, 5.6) + blush(69, 25, c='#ff9fb0', o=.7) +
          "<ellipse cx='50' cy='71' rx='12' ry='9' fill='#f3c9a0' " + S(3) + "/>"
          "<ellipse cx='50' cy='67' rx='5' ry='3.6' fill='#2b2433'/><circle cx='51.6' cy='66' r='1.1' fill='#fff'/>"
          "<path d='M50 70.5 v1.5 M50 72 q-3 3 -6 .5 M50 72 q3 3 6 .5' fill='none' " + S(2.3) + "/>",
  'bunny': "<path d='M30 44 C19 20 22 4 31 4 C40 4 43 22 42 44Z' fill='#fff' " + S() + "/><path d='M70 44 C81 20 78 4 69 4 C60 4 57 22 58 44Z' fill='#fff' " + S() + "/>"
           "<path d='M31 38 C26 20 27 11 31 11 C35 11 37 22 37 38Z' fill='#ffc2d6'/><path d='M69 38 C74 20 73 11 69 11 C65 11 63 22 63 38Z' fill='#ffc2d6'/>"
           + head('#fff', cy=64, rx=35, ry=27) +
           "<path d='M30 42 l-10 -6 v12z M30 42 l10 -6 v12z' fill='#ff8fb8' " + S(2.4) + "/><circle cx='30' cy='42' r='3' fill='#ff6fa3' " + S(2) + "/>"
           + eyes(63, 37, 63, 5.6) + blush(72, 23) + nose(68.5, '#ff8fb0') + wm(72.5, 5),
  'frog': head('#86d47a', cy=63, rx=39, ry=28) +
          "<circle cx='30' cy='38' r='14' fill='#86d47a' " + S() + "/><circle cx='70' cy='38' r='14' fill='#86d47a' " + S() + "/>"
          "<circle cx='30' cy='39' r='9' fill='#fff'/><circle cx='70' cy='39' r='9' fill='#fff'/>"
          + eyes(39.5, 30, 70, 5.6) + blush(66, 28) +
          "<circle cx='46' cy='56' r='1.6' fill='#2b2433'/><circle cx='54' cy='56' r='1.6' fill='#2b2433'/>"
          "<path d='M37 66 q13 10 26 0' fill='none' " + S(3) + "/>"
          "<path d='M46 70 q4 5 8 0' fill='#ff8fa3' " + S(2) + "/>",
  'chick': "<path d='M47 29 q-3 -12 4 -14 q0 6 3 8 q3 -7 9 -5 q-5 3 -6 11z' fill='#ffd84a' " + S(3) + "/>"
           + head('#ffd84a', cy=60, rx=36, ry=33) + eyes(57, 36, 64, 5.6) + blush(66, 24) +
           "<path d='M44 63 q6 -3 12 0 q-6 7.5 -12 0z' fill='#ff9d3b' " + S(2.6) + "/>"
           "<path d='M15 76 l7 -6 l7 6 l7 -6 l7 6 l7 -6 l7 6 l7 -6 l7 6 l7 -6 l7 6 Q84 93 50 94 Q16 93 15 76z' fill='#fffaf0' " + S(3.4) + "/>",
  'hamster': "<circle cx='25' cy='33' r='10' fill='#f2b878' " + S() + "/><circle cx='75' cy='33' r='10' fill='#f2b878' " + S() + "/>"
             "<circle cx='25' cy='33' r='5' fill='#ffc9c0'/><circle cx='75' cy='33' r='5' fill='#ffc9c0'/>"
             + head('#f2b878', cy=60, rx=38, ry=31) +
             "<path d='M21 68 Q29 51 50 53 Q71 51 79 68 Q74 89 50 90 Q26 89 21 68z' fill='#fff8ee'/>"
             "<path d='M50 31 v8' stroke='#d9914c' stroke-width='3.4' stroke-linecap='round'/>"
             + eyes(60, 36, 64, 5.6) + blush(70, 25, 8, 5) +
             "<ellipse cx='50' cy='65' rx='2.8' ry='2' fill='#ff8fa3'/>" + wm(67.5, 4.5),
  'penguin': head('#3d4f73', cy=58, rx=38, ry=33) +
             "<path d='M50 44 Q58 34 70 40 Q86 50 80 72 Q74 88 50 88 Q26 88 20 72 Q14 50 30 40 Q42 34 50 44z' fill='#fff'/>"
             + eyes(60, 37, 63, 5.4) + blush(69, 22) +
             "<path d='M44 66 q6 -2.5 12 0 q-6 6.5 -12 0z' fill='#ffb340' " + S(2.6) + "/>"
             "<path d='M34 26 q16 -10 32 0 l-2 6 q-14 -7 -28 0z' fill='#ff7f9f' " + S(2.6) + "/><circle cx='50' cy='17' r='4.5' fill='#fff' " + S(2.4) + "/>",
  'fox': "<path d='M18 50 L15 11 Q34 15 45 34Z' fill='#ff9a4d' " + S() + "/><path d='M82 50 L85 11 Q66 15 55 34Z' fill='#ff9a4d' " + S() + "/>"
         "<path d='M22 40 L20 19 Q32 22 38 32Z' fill='#fff4e8'/><path d='M78 40 L80 19 Q68 22 62 32Z' fill='#fff4e8'/>"
         "<path d='M12 56 Q14 30 50 30 Q86 30 88 56 Q86 74 66 82 Q56 88 50 90 Q44 88 34 82 Q14 74 12 56z' fill='#ff9a4d' " + S() + "/>"
         "<path d='M15 60 Q31 58 42 70 Q47 80 50 87 Q42 85 32 79 Q17 71 15 60z' fill='#fff4e8'/><path d='M85 60 Q69 58 58 70 Q53 80 50 87 Q58 85 68 79 Q83 71 85 60z' fill='#fff4e8'/>"
         + eyes(58, 36, 64, 5.4) + blush(68, 25) +
         "<ellipse cx='50' cy='72' rx='4.2' ry='3.2' fill='#2b2433'/><circle cx='51.4' cy='71' r='1' fill='#fff'/>"
         "<path d='M50 75 q-3 3 -6 1 M50 75 q3 3 6 1' fill='none' " + S(2.2) + "/>",
  'panda': "<circle cx='24' cy='31' r='12' fill='#2f2b33' " + S() + "/><circle cx='76' cy='31' r='12' fill='#2f2b33' " + S() + "/>"
           + head('#fff', cy=60, rx=37, ry=31) +
           "<ellipse cx='35' cy='60' rx='9' ry='11.5' transform='rotate(-28 35 60)' fill='#2f2b33'/><ellipse cx='65' cy='60' rx='9' ry='11.5' transform='rotate(28 65 60)' fill='#2f2b33'/>"
           "<circle cx='36' cy='59' r='4.4' fill='#fff'/><circle cx='64' cy='59' r='4.4' fill='#fff'/><circle cx='36.6' cy='59.6' r='2.9' fill='#2f2b33'/><circle cx='63.4' cy='59.6' r='2.9' fill='#2f2b33'/>"
           "<circle cx='37.4' cy='58.4' r='1.1' fill='#fff'/><circle cx='64.2' cy='58.4' r='1.1' fill='#fff'/>"
           + blush(72, 25) +
           "<ellipse cx='50' cy='69' rx='4.6' ry='3.2' fill='#2b2433'/>"
           "<path d='M50 72 v1 M50 73 q-3 3 -6 .5 M50 73 q3 3 6 .5' fill='none' " + S(2.2) + "/>",
  'dino': "<path d='M28 35 l4 -15 l9 10 l9 -17 l9 17 l9 -10 l4 15z' fill='#ffcf5a' " + S(3) + "/>"
          + head('#86dcb0', cy=60, rx=38, ry=31) +
          "<ellipse cx='50' cy='73' rx='20' ry='12' fill='#d2f5e2'/>"
          + eyes(57, 35, 65, 5.6) + blush(67, 27) +
          "<circle cx='46' cy='67' r='1.5' fill='#2b2433'/><circle cx='54' cy='67' r='1.5' fill='#2b2433'/>"
          "<path d='M42 73 q8 6.5 16 0' fill='none' " + S(2.6) + "/><path d='M45.2 74.6 l1.6 3.2 l1.6 -2.4z' fill='#fff' " + S(1.3) + "/>",
  'ghost': "<path d='M18 86 V50 Q18 16 50 16 Q82 16 82 50 V86 q-5.3 -8 -10.7 0 q-5.3 8 -10.7 0 q-5.3 -8 -10.7 0 q-5.3 8 -10.7 0 q-5.3 -8 -10.7 0 q-5.3 8 -10.6 0z' fill='#f8f6ff' " + S() + "/>"
           "<path d='M18 58 q-9 2 -8 10 M82 58 q9 2 8 10' fill='none' " + S(3.4) + "/>"
           + eyes(50, 38, 62, 5.4) + blush(58, 20) + wm(57, 5) +
           "<path d='M48 59.5 q2 4.5 4 0z' fill='#ff8fa3' " + S(1.6) + "/>" + SPARK,
  'slime': "<path d='M50 12 Q60 30 76 44 Q92 60 86 77 Q80 92 50 92 Q20 92 14 77 Q8 60 24 44 Q40 30 50 12z' fill='#7cc8ff' " + S() + "/>"
           "<path d='M27 58 q2 -10 10 -15' stroke='#fff' stroke-width='4' fill='none' stroke-linecap='round'/><circle cx='25' cy='66' r='2.4' fill='#fff'/>"
           + eyes(65, 38, 62, 5.6) + blush(74, 22) + wm(73),
  'sheep': cloud([(30, 34, 13), (50, 28, 14), (70, 34, 13), (19, 52, 12), (81, 52, 12), (22, 72, 12), (78, 72, 12), (35, 85, 12), (65, 85, 12), (50, 87, 12)], '#fff') +
           "<ellipse cx='25' cy='58' rx='10' ry='5' transform='rotate(20 25 58)' fill='#ffe0c8' " + S(3) + "/><ellipse cx='75' cy='58' rx='10' ry='5' transform='rotate(-20 75 58)' fill='#ffe0c8' " + S(3) + "/>"
           "<ellipse cx='50' cy='63' rx='21' ry='20' fill='#ffe7d4' " + S(3.4) + "/>"
           + cloud([(41, 45, 7), (50, 42, 8), (59, 45, 7)], '#fff') +
           eyes(62, 42, 58, 4.4) + blush(70, 14, 4, 2.6) +
           "<path d='M48 68 h4 q0 2 -2 2.6 q-2 -.6 -2 -2.6z' fill='#ff8fb0'/>" + wm(72, 3.5),
  'whale': "<path d='M50 34 v-9 M50 26 q-7 -11 -14 -5 M50 26 q7 -11 14 -5' fill='none' stroke='#7cc8ff' stroke-width='3.6' stroke-linecap='round'/>"
           "<circle cx='34' cy='16' r='2.4' fill='#7cc8ff'/><circle cx='66' cy='16' r='2.4' fill='#7cc8ff'/>"
           "<path d='M14 66 q-10 -2 -10 -12 q8 1 12 6z' fill='#6fb6ff' " + S(3) + "/><path d='M86 66 q10 -2 10 -12 q-8 1 -12 6z' fill='#6fb6ff' " + S(3) + "/>"
           + head('#6fb6ff', cy=62, rx=38, ry=28) +
           "<path d='M16 72 Q50 86 84 72 Q78 88 50 90 Q22 88 16 72z' fill='#e3f3ff'/>"
           + eyes(60, 35, 65, 5.4) + blush(68, 26) + wm(68),
  'axolotl': "<ellipse cx='15' cy='40' rx='10' ry='4.6' transform='rotate(-35 15 40)' fill='#ff86ad' " + S(3) + "/><ellipse cx='10' cy='55' rx='10' ry='4.6' fill='#ff86ad' " + S(3) + "/><ellipse cx='15' cy='70' rx='10' ry='4.6' transform='rotate(35 15 70)' fill='#ff86ad' " + S(3) + "/>"
             "<ellipse cx='85' cy='40' rx='10' ry='4.6' transform='rotate(35 85 40)' fill='#ff86ad' " + S(3) + "/><ellipse cx='90' cy='55' rx='10' ry='4.6' fill='#ff86ad' " + S(3) + "/><ellipse cx='85' cy='70' rx='10' ry='4.6' transform='rotate(-35 85 70)' fill='#ff86ad' " + S(3) + "/>"
             + head('#ffc1d3', cy=58, rx=36, ry=30) + eyes(56, 34, 66, 4.8) + blush(64, 26) +
             "<path d='M39 64 q11 8 22 0' fill='none' " + S(2.8) + "/>"
             "<circle cx='44' cy='38' r='2.2' fill='#ff9dbb'/><circle cx='56' cy='36' r='1.6' fill='#ff9dbb'/>",
}

# 이름(화면에 보일 이름은 app.js SKINS) · 색상 h · 채도 s(%) · 캐릭터
SKINS = [
  # 색깔
  ('pink',   340, 78, None),
  ('mint',   165, 55, None),
  ('purple', 262, 62, None),
  ('peach',   22, 85, None),
  ('lemon',   48, 85, None),
  ('mono',   220,  6, None),
  # 캐릭터
  ('cat',     28, 80, 'cat'),
  ('dog',     34, 45, 'dog'),
  ('bear',    25, 38, 'bear'),
  ('bunny',  320, 55, 'bunny'),
  ('frog',   105, 48, 'frog'),
  ('chick',   46, 90, 'chick'),
  ('hamster', 32, 70, 'hamster'),
  ('penguin',210, 45, 'penguin'),
  ('fox',     20, 85, 'fox'),
  ('panda',  120, 35, 'panda'),
  ('dino',   150, 50, 'dino'),
  ('ghost',  268, 45, 'ghost'),
  ('slime',  205, 75, 'slime'),
  ('sheep',   95, 40, 'sheep'),
  ('whale',  212, 70, 'whale'),
  ('axolotl',340, 65, 'axolotl'),
]

def hsl(h, s, l, a=None):
    s = round(s, 1); l = round(l, 1)
    return f"hsl({h} {s}% {l}%" + (f" / {a})" if a is not None else ")")

def tokens(h, s, dark):
    if not dark:
        return {
          'bg': hsl(h, s * .75, 95), 'dot': hsl(h, s * .7, 40, .16),
          'card': '#ffffff', 'chip': hsl(h, s * .8, 92), 'line': hsl(h, s * .55, 83),
          'ink': hsl(h, min(s, 50), 17), 'text': hsl(h, min(s, 50), 17), 'sub': hsl(h, s * .25, 42), 'on-bg': hsl(h, min(s, 50), 17), 'onc': hsl(h, min(s, 50), 17),
          'accent': hsl(h, s, 55 if s > 20 else 35), 'sky': hsl(h, s, 74 if s > 20 else 80), 'hero': hsl(h, s, 62 if s > 20 else 45),
          'next': hsl(h, s, 80 if s > 20 else 86), 'pink': hsl((h + 35) % 360, s, 82), 'violet': hsl((h + 330) % 360, s, 80),
        }
    return {
      'bg': hsl(h, min(s, 45) * .9, 11), 'dot': 'rgba(255,255,255,.07)',
      'card': hsl(h, min(s, 45) * .85, 17), 'chip': hsl(h, min(s, 45) * .8, 22), 'line': hsl(h, min(s, 45) * .75, 31),
      'ink': '#000', 'text': hsl(h, min(s, 60), 96), 'sub': hsl(h, s * .35, 72), 'on-bg': hsl(h, min(s, 60), 96),
      'accent': hsl(h, s, 64 if s > 20 else 72), 'hero': hsl(h, s, 58 if s > 20 else 55),
    }

def decl(t):
    return ';'.join(f'--{k}:{v}' for k, v in t.items())

out = ["/* ===== 스킨 (자동 생성: tools/skins/gen.py — 직접 고치지 말고 생성기를 고칠 것) =====",
       "   html[data-skin=…]이 색 토큰만 덮어씀 → 밝음/어두움(data-theme)과 따로 조합됨. 기본(파랑)은 스킨 없음 */"]
for name, h, s, m in SKINS:
    out.append(f':root[data-skin="{name}"]{{{decl(tokens(h, s, False))}}}')
    out.append(f':root[data-skin="{name}"][data-theme="dark"]{{{decl(tokens(h, s, True))}}}')
    if m:
        # 마스코트 그림은 한 번만 넣고(스티커·고르기 버튼이 같은 --art 공유), 배경 무늬는 <use>로 두 번 찍기
        art = svg(MASCOT[m])
        pat = svg(f"<defs><g id='m'>{MASCOT[m]}</g></defs><g opacity='.09'><use href='#m' transform='translate(6 6) scale(.3)'/><use href='#m' transform='translate(51 51) scale(.3)'/></g>", '0 0 90 90')
        out.append(f':root[data-skin="{name}"],.sk-{name}{{--art:{art}}}')
        out.append(f':root[data-skin="{name}"]{{--pat:{pat};--pat-size:90px 90px}}')
    # 고르기 창 미리보기 색(밝은 기준)
    lt = tokens(h, s, False)
    out.append(f'.sk-{name}{{--p1:{lt["bg"]};--p2:{lt["accent"]};--p3:{lt["sky"]}}}')
out.append('.sk .sk-face{background-image:var(--art)}')
out.append("/* ===== 스킨 끝 ===== */")
block = '\n'.join(out)

src = CSS.read_text()
pat = re.compile(r"/\* ===== 스킨 \(자동 생성.*?/\* ===== 스킨 끝 ===== \*/", re.S)
src = pat.sub(lambda _: block, src) if pat.search(src) else src.rstrip('\n') + '\n\n' + block + '\n'
CSS.write_text(src)
print('ok', len(block), 'bytes')
