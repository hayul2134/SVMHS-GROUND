# 테마(스킨) CSS 생성기 — 실행: python3 tools/skins/gen.py
# style.css 안의 "/* ===== 스킨 (자동 생성" ~ "/* ===== 스킨 끝 ===== */" 구간을 통째로 바꿔 씀.
# 색 테마는 색상(h)·채도(s)만 정하면 밝은/어두운 토큰을 둘 다 만든다. 캐릭터 테마는 여기에 마스코트 그림이 더해짐.
# 캐릭터는 모두 이 사이트용 오리지널 동물 그림(기존 캐릭터를 따라 그리지 않음).
import re, urllib.parse, pathlib

CSS = pathlib.Path(__file__).resolve().parents[2] / 'public/css/style.css'

def svg(body, vb='0 0 100 100'):
    s = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='{vb}'>{body}</svg>"
    return "url(\"data:image/svg+xml," + urllib.parse.quote(s, safe=" ='/:,().-") + "\")"

import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mascots import MASCOT, MASCOT_HW  # 마스코트 그림은 mascots.py

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
  ('shark',  205, 30, 'shark'),   # 2026-10-27 추가(미리보기 깃발 shark)
]

def hsl(h, s, l, a=None):
    s = round(s, 1); l = round(l, 1)
    return f"hsl({h} {s}% {l}%" + (f" / {a})" if a is not None else ")")

def tokens(h, s, dark):
    if not dark:
        return {
          'bg': hsl(h, s * .75, 95), 'dot': hsl(h, s * .7, 40, .16),
          'card': '#ffffff', 'chip': hsl(h, s * .8, 92), 'line': hsl(h, s * .55, 83),
          'ink': hsl(h, min(s, 50), 17), 'text': hsl(h, min(s, 50), 17), 'sub': hsl(h, s * .25, 35), 'on-bg': hsl(h, min(s, 50), 17), 'onc': hsl(h, min(s, 50), 17),
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
        # 큰 마스코트는 public/js/mascots.js가 인라인 SVG로 띄워 움직임 → 여기 --art는 고르기 버튼 미리보기용만
        out.append(f'.sk-{name}{{--art:{art}}}')
        out.append(f':root[data-skin="{name}"]{{--pat:{pat};--pat-size:90px 90px}}')
    # 고르기 창 미리보기 색(밝은 기준)
    lt = tokens(h, s, False)
    out.append(f'.sk-{name}{{--p1:{lt["bg"]};--p2:{lt["accent"]};--p3:{lt["sky"]}}}')
out.append('.sk .sk-face{background-image:var(--art)}')
out.append("/* ===== 스킨 끝 ===== */")
# 움직이는 마스코트용 JS 모듈(app.js가 캐릭터 테마일 때만 동적 import)
import json
JS = CSS.parents[1] / 'js/mascots.js'
JS.write_text("// 자동 생성: tools/skins/gen.py — 직접 고치지 말 것. 캐릭터 테마 마스코트 인라인 SVG\nexport const MASCOT = "
              + json.dumps({k: f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>{v}</svg>" for k, v in MASCOT.items()}, ensure_ascii=False, indent=0) + ";\n"
              + "// 할로윈 의상(2026-10-30, mascots.py H_*) — html.hw일 때 app.js syncMascot이 씀\nexport const MASCOT_HW = "
              + json.dumps({k: f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>{v}</svg>" for k, v in MASCOT_HW.items()}, ensure_ascii=False, indent=0) + ";\n")
# 할로윈 캐릭터 CSS(프로필 사진·고르기 버튼 --art, 캐릭터 테마 배경 무늬) — 기간에만 theme.js/social.js가 불러옴(style.css 무게 늘리지 않게)
hw = ["/* 자동 생성: tools/skins/gen.py — 할로윈 의상 캐릭터(html.hw). 기간 동안만 theme.js·social.js가 <link>로 불러옴 */"]
for name, h, s_, m in SKINS:
    if not m: continue
    hw.append(f'html.hw .sk-{name}{{--art:{svg(MASCOT_HW[m])}}}')
    p2 = svg(f"<defs><g id='m'>{MASCOT_HW[m]}</g></defs><g opacity='.09'><use href='#m' transform='translate(6 6) scale(.3)'/><use href='#m' transform='translate(51 51) scale(.3)'/></g>", '0 0 90 90')
    hw.append(f':root.hw[data-skin="{name}"]{{--pat:{p2},url("/hw/pat.svg");--pat-size:90px 90px,260px 260px}}')
    hw.append(f':root.hw[data-skin="{name}"][data-theme="dark"]{{--pat:{p2},url("/hw/pat-d.svg")}}')
(CSS.parent / 'hw-chars.css').write_text('\n'.join(hw) + '\n')
block = '\n'.join(out)

src = CSS.read_text()
pat = re.compile(r"/\* ===== 스킨 \(자동 생성.*?/\* ===== 스킨 끝 ===== \*/", re.S)
src = pat.sub(lambda _: block, src) if pat.search(src) else src.rstrip('\n') + '\n\n' + block + '\n'
CSS.write_text(src)
print('ok', len(block), 'bytes')
