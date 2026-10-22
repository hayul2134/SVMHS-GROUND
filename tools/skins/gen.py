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

EYES = f"<circle cx='38' cy='56' r='5' fill='{O}'/><circle cx='62' cy='56' r='5' fill='{O}'/><circle cx='39.6' cy='54.2' r='1.7' fill='#fff'/><circle cx='63.6' cy='54.2' r='1.7' fill='#fff'/>"
CHEEK = "<ellipse cx='27' cy='66' rx='6' ry='3.6' fill='#ff8fa3' opacity='.55'/><ellipse cx='73' cy='66' rx='6' ry='3.6' fill='#ff8fa3' opacity='.55'/>"
ST = f"stroke='{O}' stroke-width='4' stroke-linejoin='round'"

MASCOT = {
  # 고양이: 주황 줄무늬
  'cat': f"<path d='M20 44 L22 14 L44 30 Z' fill='#ffb36b' {ST}/><path d='M80 44 L78 14 L56 30 Z' fill='#ffb36b' {ST}/>"
         f"<path d='M25 34 L27 22 L37 30Z' fill='#ffd9b8'/><path d='M75 34 L73 22 L63 30Z' fill='#ffd9b8'/>"
         f"<ellipse cx='50' cy='58' rx='36' ry='31' fill='#ffb36b' {ST}/>"
         f"<path d='M44 30 q6 6 0 12 M50 28 v14 M56 30 q-6 6 0 12' stroke='#e07f2c' stroke-width='3.4' fill='none' stroke-linecap='round'/>"
         + EYES + CHEEK +
         f"<path d='M46 64 h8 l-4 4z' fill='{O}'/><path d='M50 68 q-4 6 -9 3 M50 68 q4 6 9 3' stroke='{O}' stroke-width='2.6' fill='none' stroke-linecap='round'/>"
         f"<path d='M14 60 h14 M15 68 l13 -3 M86 60 h-14 M85 68 l-13 -3' stroke='{O}' stroke-width='2.4' stroke-linecap='round'/>",
  # 강아지: 크림색 + 갈색 늘어진 귀
  'dog': f"<ellipse cx='50' cy='56' rx='33' ry='31' fill='#fff1d6' {ST}/>"
         f"<path d='M22 32 q-16 4 -12 30 q3 10 12 4 q2 -18 8 -28z' fill='#b9784a' {ST}/><path d='M78 32 q16 4 12 30 q-3 10 -12 4 q-2 -18 -8 -28z' fill='#b9784a' {ST}/>"
         f"<ellipse cx='62' cy='52' rx='10' ry='9' fill='#e8b98b'/>" + EYES +
         f"<ellipse cx='50' cy='70' rx='15' ry='11' fill='#fff' {ST}/><ellipse cx='50' cy='65' rx='6' ry='4.4' fill='{O}'/>"
         f"<path d='M50 70 v4 q-4 4 -8 1 M50 74 q4 4 8 1' stroke='{O}' stroke-width='2.6' fill='none' stroke-linecap='round'/><path d='M47 79 q3 7 6 0' fill='#ff7f8f' {ST.replace('4','2.4')}/>",
  # 곰: 갈색
  'bear': f"<circle cx='24' cy='28' r='13' fill='#9a6a45' {ST}/><circle cx='76' cy='28' r='13' fill='#9a6a45' {ST}/><circle cx='24' cy='28' r='6' fill='#e6b98f'/><circle cx='76' cy='28' r='6' fill='#e6b98f'/>"
          f"<ellipse cx='50' cy='57' rx='36' ry='32' fill='#9a6a45' {ST}/>" + EYES +
          f"<ellipse cx='50' cy='72' rx='15' ry='11' fill='#e6b98f' {ST}/><ellipse cx='50' cy='67' rx='6' ry='4.2' fill='{O}'/>"
          f"<path d='M50 71 v3 q-4 4 -8 1 M50 74 q4 4 8 1' stroke='{O}' stroke-width='2.6' fill='none' stroke-linecap='round'/>" + CHEEK,
  # 토끼: 흰색 + 긴 귀
  'bunny': f"<path d='M30 46 C20 20 24 4 33 4 C42 4 44 24 42 44Z' fill='#fff' {ST}/><path d='M70 46 C80 20 76 4 67 4 C58 4 56 24 58 44Z' fill='#fff' {ST}/>"
           f"<path d='M33 40 C28 22 30 12 33 12 C37 12 38 26 37 40Z' fill='#ffb7cf'/><path d='M67 40 C72 22 70 12 67 12 C63 12 62 26 63 40Z' fill='#ffb7cf'/>"
           f"<ellipse cx='50' cy='64' rx='34' ry='28' fill='#fff' {ST}/>"
           f"<circle cx='38' cy='62' r='5' fill='{O}'/><circle cx='62' cy='62' r='5' fill='{O}'/><circle cx='39.6' cy='60.2' r='1.7' fill='#fff'/><circle cx='63.6' cy='60.2' r='1.7' fill='#fff'/>"
           f"<path d='M46 70 h8 l-4 3.6z' fill='#ff7f9f' stroke='{O}' stroke-width='2' stroke-linejoin='round'/><path d='M50 74 q-4 5 -8 2 M50 74 q4 5 8 2' stroke='{O}' stroke-width='2.6' fill='none' stroke-linecap='round'/>"
           "<ellipse cx='27' cy='73' rx='6' ry='3.6' fill='#ff8fa3' opacity='.55'/><ellipse cx='73' cy='73' rx='6' ry='3.6' fill='#ff8fa3' opacity='.55'/>",
  # 개구리: 초록
  'frog': f"<ellipse cx='50' cy='62' rx='38' ry='28' fill='#7ccf6b' {ST}/>"
          f"<circle cx='30' cy='34' r='14' fill='#7ccf6b' {ST}/><circle cx='70' cy='34' r='14' fill='#7ccf6b' {ST}/>"
          f"<circle cx='30' cy='34' r='8' fill='#fff'/><circle cx='70' cy='34' r='8' fill='#fff'/><circle cx='31' cy='35' r='4.6' fill='{O}'/><circle cx='71' cy='35' r='4.6' fill='{O}'/>"
          f"<path d='M28 64 q22 16 44 0' stroke='{O}' stroke-width='3.4' fill='none' stroke-linecap='round'/>"
          "<ellipse cx='22' cy='62' rx='6' ry='3.6' fill='#ff8fa3' opacity='.6'/><ellipse cx='78' cy='62' rx='6' ry='3.6' fill='#ff8fa3' opacity='.6'/>"
          f"<circle cx='44' cy='52' r='1.8' fill='{O}'/><circle cx='56' cy='52' r='1.8' fill='{O}'/>",
  # 병아리: 노랑
  'chick': f"<path d='M44 18 q2 -12 8 -10 q-2 6 2 8 q4 -6 8 -2 q-6 2 -6 8z' fill='#ffd84a' {ST.replace('4','3')}/>"
           f"<ellipse cx='50' cy='58' rx='36' ry='34' fill='#ffd84a' {ST}/>" + EYES +
           f"<path d='M42 64 L58 64 L50 73Z' fill='#ff9d3b' {ST.replace('4','3')}/><path d='M42 64 L58 64' stroke='{O}' stroke-width='2.4'/>" + CHEEK +
           f"<path d='M14 64 q-6 6 2 12 M86 64 q6 6 -2 12' stroke='{O}' stroke-width='3' fill='none' stroke-linecap='round'/>",
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
        art = svg(MASCOT[m])
        # 배경 무늬: 작은 얼굴을 엇갈려 깔기(옅게)
        pat = svg(f"<g opacity='.09'><g transform='translate(6 6) scale(.3)'>{MASCOT[m]}</g><g transform='translate(51 51) scale(.3)'>{MASCOT[m]}</g></g>", '0 0 90 90')
        out.append(f':root[data-skin="{name}"]{{--art:{art};--pat:{pat};--pat-size:90px 90px}}')
        out.append(f'.sk-{name} .sk-face{{background-image:{art}}}')
    # 고르기 창 미리보기 색(밝은 기준)
    lt = tokens(h, s, False)
    out.append(f'.sk-{name}{{--p1:{lt["bg"]};--p2:{lt["accent"]};--p3:{lt["sky"]}}}')
out.append("/* ===== 스킨 끝 ===== */")
block = '\n'.join(out)

src = CSS.read_text()
pat = re.compile(r"/\* ===== 스킨 \(자동 생성.*?/\* ===== 스킨 끝 ===== \*/", re.S)
src = pat.sub(lambda _: block, src) if pat.search(src) else src.rstrip('\n') + '\n\n' + block + '\n'
CSS.write_text(src)
print('ok', len(block), 'bytes')
