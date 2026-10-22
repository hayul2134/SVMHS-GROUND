# 캐릭터 테마 마스코트 그림(SVG 조각, viewBox 0 0 100 100) — gen.py가 불러 씀
# 모두 이 사이트용 오리지널 그림(기존 캐릭터를 따라 그리지 않음).
#
# 귀여움 규칙 (tools/skins/CHARACTER_GUIDE.md에 근거 정리)
#  1) 2등신 미만: 머리가 몸보다 훨씬 큼(머리 y16~74, 몸 y67~94) — 짧고 뭉툭한 팔다리
#  2) 머리는 아래가 살짝 퍼진 찹쌀떡 모양, 이마를 넓게 → 눈은 머리 중심보다 아래(y≈54)
#  3) 눈: 세로로 긴 진한 갈색 타원 + 큰 하이라이트 1개 + 작은 것 1개, 간격은 눈 폭의 약 2배
#  4) 코·입은 아주 작게, 눈 바로 밑에 붙여서(얼굴 아래쪽에 모음)
#  5) 외곽선은 검정 대신 몸 색을 진하게 한 색, 얇게(2.6) — 스티커가 무겁지 않게
#  6) 파스텔 색, 잔선(수염·줄무늬) 최소화
F = '#3b2a2e'  # 눈·입 색 (아주 진한 갈색)


def ln(l, w=2.6):
    return f"stroke='{l}' stroke-width='{w}' stroke-linejoin='round' stroke-linecap='round'"


def mochi(c, l, top=16, bot=74, w=37):
    # 아래가 살짝 퍼진 찹쌀떡 머리
    return (f"<path d='M{50-w} {bot-15} C{50-w} {top+5} {50-w*.55:.1f} {top} 50 {top} C{50+w*.55:.1f} {top} {50+w} {top+5} {50+w} {bot-15} "
            f"C{50+w} {bot+1} {50+w*.6:.1f} {bot} 50 {bot} C{50-w*.6:.1f} {bot} {50-w} {bot+1} {50-w} {bot-15}Z' fill='{c}' {ln(l)}/>")


def eyes(y=54, dx=11, rx=4.3, ry=5.3):
    o = "<g class='me'>"
    for x in (50 - dx, 50 + dx):
        o += (f"<ellipse cx='{x}' cy='{y}' rx='{rx}' ry='{ry}' fill='{F}'/>"
              f"<circle cx='{x+1.4:.1f}' cy='{y-2:.1f}' r='{rx*.45:.1f}' fill='#fff'/>"
              f"<circle cx='{x-1.5:.1f}' cy='{y+2.3:.1f}' r='.8' fill='#fff'/>")
    return o + '</g>'


def blush(y=61, dx=19, rx=5.5, ry=3.2, o=.5):
    return f"<ellipse cx='{50-dx}' cy='{y}' rx='{rx}' ry='{ry}' fill='#ff8fab' opacity='{o}'/><ellipse cx='{50+dx}' cy='{y}' rx='{rx}' ry='{ry}' fill='#ff8fab' opacity='{o}'/>"


def mouth(y=60.5, w=3.5):
    # 작은 ω
    return f"<path d='M{50-w} {y} q{w/2} {w*.65:.1f} {w} 0 q{w/2} {w*.65:.1f} {w} 0' fill='none' {ln(F, 1.8)}/>"


def dotnose(y=58, c='#ff9bb0', r=1.5):
    return f"<ellipse cx='50' cy='{y}' rx='{r*1.3:.1f}' ry='{r:.1f}' fill='{c}'/>"


def face(y=54, dx=11, nose=None, my=None):
    my = my or y + 6.5
    return eyes(y, dx) + blush(y + 7, dx + 8) + (nose or '') + mouth(my)


def body(c, l, belly=None, feet=None, wave=False, arms=True):
    # 그리는 순서: 발 → 몸 → 배 → 팔 (머리는 그 위에)
    fc = feet or c
    o = (f"<ellipse cx='41' cy='91.5' rx='6.5' ry='4.3' fill='{fc}' {ln(l)}/><ellipse cx='59' cy='91.5' rx='6.5' ry='4.3' fill='{fc}' {ln(l)}/>"
         f"<ellipse cx='50' cy='81' rx='18' ry='12.5' fill='{c}' {ln(l)}/>")
    if belly:
        o += f"<ellipse cx='50' cy='84' rx='10' ry='7' fill='{belly}'/>"
    if arms:
        o += f"<ellipse cx='33.5' cy='81' rx='4.6' ry='6.2' transform='rotate(28 33.5 81)' fill='{c}' {ln(l)}/>"
        if wave:  # 오른손 들어 인사
            o += f"<g class='ma'><ellipse cx='72' cy='66' rx='4.6' ry='6.6' transform='rotate(-30 72 66)' fill='{c}' {ln(l)}/></g>"
        else:
            o += f"<ellipse cx='66.5' cy='81' rx='4.6' ry='6.2' transform='rotate(-28 66.5 81)' fill='{c}' {ln(l)}/>"
    return o


def tail(d, c, l, w=6):
    # 굵은 선으로 그린 꼬리: 테두리색 굵게 → 몸색 얇게
    return f"<g class='mt'><path d='{d}' fill='none' stroke='{l}' stroke-width='{w+2.6}' stroke-linecap='round'/><path d='{d}' fill='none' stroke='{c}' stroke-width='{w}' stroke-linecap='round'/></g>"


def cloud(circles, c, l, w=2.6):
    return (''.join(f"<circle cx='{x}' cy='{y}' r='{r}' fill='{c}' stroke='{l}' stroke-width='{w}'/>" for x, y, r in circles)
            + ''.join(f"<circle cx='{x}' cy='{y}' r='{r-w/2-.2:.1f}' fill='{c}'/>" for x, y, r in circles))


SHADOW = "<ellipse cx='50' cy='96' rx='24' ry='2.8' fill='#000' opacity='.08'/>"


def M_cat():
    c, l = '#ffd2a6', '#d08d5a'
    ears = (f"<path d='M15 40 Q10 1 30 7 Q40 11 45 22Z' fill='{c}' {ln(l)}/><path d='M85 40 Q90 1 70 7 Q60 11 55 22Z' fill='{c}' {ln(l)}/>"
            "<path d='M20 28 Q18 11 28 13 Q35 15 38 20Z' fill='#ffb8b8'/><path d='M80 28 Q82 11 72 13 Q65 15 62 20Z' fill='#ffb8b8'/>")
    return (SHADOW + tail('M66 88 Q84 90 82 74 Q81 68 76 70', c, l) + body(c, l, '#fff4e8', wave=True) + ears + mochi(c, l)
            + "<path d='M46 21 q1.6 3 0 6 M50 20 v6.5 M54 21 q-1.6 3 0 6' fill='none' stroke='#f2a66b' stroke-width='2.2' stroke-linecap='round'/>"
            + face(nose="<path d='M48.4 57 h3.2 l-1.6 1.8z' fill='#ff8fa3' stroke='#ff8fa3' stroke-width='1' stroke-linejoin='round'/>", my=60.2))


def M_dog():
    c, l = '#fff3df', '#c9a27a'
    ear = '#e2b07e'
    return (SHADOW + tail('M67 82 Q78 78 77 70', ear, l, 5) + body(c, l, '#ffffff', feet=ear)
            + mochi(c, l) + "<ellipse cx='62' cy='30' rx='8' ry='6' fill='#f6d8b4'/>"
            + f"<path d='M17 29 Q5 32 7 50 Q9 61 17 58 Q24 53 25 36Z' fill='{ear}' {ln(l)}/><path d='M83 29 Q95 32 93 50 Q91 61 83 58 Q76 53 75 36Z' fill='{ear}' {ln(l)}/>"
            + eyes() + blush(61, 19)
            + f"<ellipse cx='50' cy='58.4' rx='3.2' ry='2.3' fill='{F}'/>" + mouth(61.5, 3.2)
            + f"<path d='M48.3 63 q1.7 4 3.4 0z' fill='#ff8fa3' {ln('#e0707f', 1.2)}/>")


def M_bear():
    c, l, m = '#dcae86', '#9e6e4a', '#f6e0c9'
    return (SHADOW + body(c, l, m) + f"<circle cx='23' cy='22' r='10' fill='{c}' {ln(l)}/><circle cx='77' cy='22' r='10' fill='{c}' {ln(l)}/>"
            f"<circle cx='23' cy='22' r='5' fill='#f2c4a8'/><circle cx='77' cy='22' r='5' fill='#f2c4a8'/>" + mochi(c, l)
            + f"<ellipse cx='50' cy='61' rx='9' ry='6.5' fill='{m}'/>" + eyes() + blush(61, 20)
            + f"<ellipse cx='50' cy='58.3' rx='3' ry='2.1' fill='{F}'/>" + mouth(61.2, 3))


def M_bunny():
    c, l, p = '#ffffff', '#e2a6bd', '#ffc9dc'
    return (SHADOW + body(c, l) + "<circle cx='66' cy='88' r='5' fill='#fff' " + ln(l) + "/>"
            + f"<path d='M33 32 C26 12 29 3 35 3 C42 3 44 14 43 32Z' fill='{c}' {ln(l)}/><path d='M67 32 C74 12 71 3 65 3 C58 3 56 14 57 32Z' fill='{c}' {ln(l)}/>"
            + f"<path d='M35 27 C31 14 32 9 35 9 C38 9 39 16 39 27Z' fill='{p}'/><path d='M65 27 C69 14 68 9 65 9 C62 9 61 16 61 27Z' fill='{p}'/>"
            + mochi(c, l, top=22) + eyes(57) + blush(64, 19) + dotnose(61, '#ff9bb8', 1.4) + mouth(63.6, 3))


def M_frog():
    c, l = '#c3eaa8', '#7db269'
    return (SHADOW + body(c, l, '#e8f8d8', wave=True) + mochi(c, l, top=22)
            + f"<circle cx='34' cy='25' r='10.5' fill='{c}' {ln(l)}/><circle cx='66' cy='25' r='10.5' fill='{c}' {ln(l)}/>"
            + eyes(26, 16) + blush(50, 24, 6, 3.4)
            + f"<path d='M43 48 q7 6 14 0' fill='none' {ln(F, 2)}/>")


def M_chick():
    c, l, o = '#ffe98a', '#e0b54a', '#ffb257'
    return (SHADOW + body(c, l, None, feet=o) + mochi(c, l, top=20)
            + f"<path d='M47 21 q-3 -10 3 -12 q0 5 2.5 6.5 q3 -6 8 -4 q-4.5 2.5 -5 9.5z' fill='{c}' {ln(l, 2.2)}/>"
            + eyes(54) + blush(61, 19)
            + f"<path d='M46.6 59 L50 56.8 L53.4 59 L50 61.6Z' fill='{o}' {ln('#d98a2e', 1.4)}/>")


def M_hamster():
    c, l, w = '#f9cf9f', '#c98f5c', '#fffaf2'
    return (SHADOW + body(c, l, w) + f"<circle cx='27' cy='22' r='8' fill='{c}' {ln(l)}/><circle cx='73' cy='22' r='8' fill='{c}' {ln(l)}/>"
            f"<circle cx='27' cy='22' r='4' fill='#ffc4bc'/><circle cx='73' cy='22' r='4' fill='#ffc4bc'/>" + mochi(c, l)
            + f"<path d='M14 60 Q22 44 50 46 Q78 44 86 60 Q84 74 50 74 Q16 74 14 60z' fill='{w}'/>"
            + eyes(54) + blush(62, 21, 7, 4.2, .55) + dotnose(58.2, '#ff9bb0', 1.3) + mouth(60.6, 3))


def M_penguin():
    c, l, w = '#6f86b3', '#465a82', '#ffffff'
    return (SHADOW + body(c, l, w, feet='#ffbe5c') + mochi(c, l)
            + f"<path d='M50 34 Q58 26 70 32 Q84 40 80 60 Q76 72 50 72 Q24 72 20 60 Q16 40 30 32 Q42 26 50 34z' fill='{w}'/>"
            + eyes(54) + blush(61, 19)
            + f"<path d='M46.5 59 q3.5 -2 7 0 q-3.5 4.5 -7 0z' fill='#ffbe5c' {ln('#d98a2e', 1.4)}/>"
            + f"<path d='M30 18 Q50 4 70 18 L68 23 Q50 13 32 23Z' fill='#ff9fbc' {ln('#d9708f', 2.2)}/><circle cx='50' cy='8' r='4.2' fill='#fff' {ln('#d9708f', 2)}/>")


def M_fox():
    c, l, w = '#ffbf8a', '#d47f48', '#fff6ec'
    return (SHADOW + f"<g class='mt'><path d='M64 88 Q90 90 88 66 Q86 58 78 62 Q74 76 62 80Z' fill='{c}' {ln(l)}/><path d='M86 68 Q88 62 82 61 Q80 66 82 70Z' fill='{w}'/></g>"
            + body(c, l, w, feet='#a86c4e')
            + f"<path d='M17 46 L15 7 Q33 11 46 27Z' fill='{c}' {ln(l)}/><path d='M83 46 L85 7 Q67 11 54 27Z' fill='{c}' {ln(l)}/>"
            + f"<path d='M21 36 L20 15 Q30 18 37 26Z' fill='{w}'/><path d='M79 36 L80 15 Q70 18 63 26Z' fill='{w}'/>"
            + mochi(c, l) + f"<path d='M13.5 56 Q30 50 44 62 Q48 68 50 73.5 Q30 74 18 68 Q14 62 13.5 56z' fill='{w}'/><path d='M86.5 56 Q70 50 56 62 Q52 68 50 73.5 Q70 74 82 68 Q86 62 86.5 56z' fill='{w}'/>"
            + eyes(52) + blush(60, 20) + f"<ellipse cx='50' cy='58' rx='2.8' ry='2' fill='{F}'/>" + mouth(60.6, 3))


def M_panda():
    c, l, k = '#ffffff', '#a3a0ad', '#3e3a45'
    pupil = "<g class='me'>"
    for x in (39, 61):
        pupil += (f"<circle cx='{x}' cy='54' r='3.6' fill='#fff'/><circle cx='{x+.5}' cy='54.4' r='2.4' fill='{k}'/><circle cx='{x+1.2}' cy='53.4' r='.9' fill='#fff'/>")
    pupil += '</g>'
    return (SHADOW + body(k, '#2c2932', c, feet=k).replace(f"<ellipse cx='50' cy='81' rx='18' ry='12.5' fill='{k}'", f"<ellipse cx='50' cy='81' rx='18' ry='12.5' fill='{c}'")
            + f"<circle cx='23' cy='22' r='10' fill='{k}' {ln('#2c2932')}/><circle cx='77' cy='22' r='10' fill='{k}' {ln('#2c2932')}/>" + mochi(c, l)
            + f"<ellipse cx='38.5' cy='55' rx='7.4' ry='9.2' transform='rotate(-30 38.5 55)' fill='{k}'/><ellipse cx='61.5' cy='55' rx='7.4' ry='9.2' transform='rotate(30 61.5 55)' fill='{k}'/>"
            + pupil + blush(64, 26) + f"<ellipse cx='50' cy='61' rx='2.8' ry='2' fill='{k}'/>" + mouth(63.4, 3))


def M_dino():
    c, l, s = '#aee8c8', '#5fae86', '#ffd877'
    return (SHADOW + tail('M66 86 Q82 88 90 78', c, l, 9) + body(c, l, '#e2f8ea', wave=True)
            + f"<path d='M33 20 l4 -13 l7 8 l6 -14 l6 14 l7 -8 l4 13z' fill='{s}' {ln('#d6a842', 2.2)}/>" + mochi(c, l, top=17)
            + eyes(53) + blush(60, 19) + "<circle cx='47' cy='58' r='1' fill='#5fae86'/><circle cx='53' cy='58' r='1' fill='#5fae86'/>"
            + mouth(60.5, 3.2) + f"<path d='M44.5 61 l1.4 2.4 l1.4 -2z' fill='#fff' {ln('#5fae86', 1)}/>")


def M_ghost():
    c, l = '#fbfaff', '#b8acdf'
    return (SHADOW
            + f"<path d='M20 84 V46 Q20 12 50 12 Q80 12 80 46 V84 q-5 -7 -10 0 q-5 7 -10 0 q-5 -7 -10 0 q-5 7 -10 0 q-5 -7 -10 0 q-5 7 -10 0z' fill='{c}' {ln(l)}/>"
            + f"<ellipse cx='16' cy='58' rx='4.6' ry='6.4' transform='rotate(40 16 58)' fill='{c}' {ln(l)}/><ellipse cx='85' cy='50' rx='4.6' ry='6.6' transform='rotate(-35 85 50)' fill='{c}' {ln(l)}/>"
            + eyes(46, 10) + blush(53, 18) + mouth(52.5, 3.2)
            + f"<path d='M48.4 54.6 q1.6 3.6 3.2 0z' fill='#ff8fab'/>"
            + "<path class='mk' d='M86 16 q1 4 5 5 q-4 1 -5 5 q-1 -4 -5 -5 q4 -1 5 -5z' fill='#fff2a0' stroke='#e2c45a' stroke-width='1.4' stroke-linejoin='round'/>")


def M_slime():
    c, l = '#b3e2ff', '#5fa8dc'
    return (SHADOW
            + f"<path d='M50 14 Q56 30 72 42 Q90 56 88 74 Q86 92 50 92 Q14 92 12 74 Q10 56 28 42 Q44 30 50 14z' fill='{c}' {ln(l)}/>"
            + "<path d='M26 58 q2 -9 9 -14' stroke='#fff' stroke-width='3.6' fill='none' stroke-linecap='round'/><circle cx='24' cy='65' r='2' fill='#fff'/>"
            + eyes(68, 11) + blush(75, 19) + mouth(74.5, 3.2))


def M_sheep():
    c, l, f = '#ffffff', '#c7bfd6', '#ffe9d6'
    wool = [(30, 26, 11), (50, 21, 12), (70, 26, 11), (20, 42, 10), (80, 42, 10), (19, 58, 9), (81, 58, 9)]
    return (SHADOW + f"<ellipse cx='42' cy='91.5' rx='5.5' ry='4' fill='#8d7d86' {ln('#6d5f68')}/><ellipse cx='58' cy='91.5' rx='5.5' ry='4' fill='#8d7d86' {ln('#6d5f68')}/>"
            + cloud([(38, 80, 10), (50, 84, 11), (62, 80, 10), (50, 74, 10)], c, l) + cloud(wool, c, l)
            + f"<ellipse cx='18' cy='50' rx='8' ry='4.4' transform='rotate(25 18 50)' fill='{f}' {ln('#d8a98a')}/><ellipse cx='82' cy='50' rx='8' ry='4.4' transform='rotate(-25 82 50)' fill='{f}' {ln('#d8a98a')}/>"
            + mochi(f, '#d8a98a', top=30, bot=74, w=29) + cloud([(40, 33, 7), (50, 30, 8), (60, 33, 7)], c, l)
            + eyes(55, 9.5, 3.8, 4.7) + blush(62, 16, 4.4, 2.6) + dotnose(59, '#ff9bb0', 1.2) + mouth(61.4, 2.8))


def M_whale():
    c, l, w = '#a6d4ff', '#5d9edb', '#e6f4ff'
    return (SHADOW
            + "<g class='ms'><path d='M50 22 v-8 M50 15 q-6 -9 -12 -4 M50 15 q6 -9 12 -4' fill='none' stroke='#8ccbff' stroke-width='3.2' stroke-linecap='round'/>"
            + "<circle cx='36' cy='6' r='2' fill='#8ccbff'/><circle cx='64' cy='6' r='2' fill='#8ccbff'/></g>"
            + f"<path d='M78 72 Q94 66 96 54 Q88 54 84 60 Q86 50 80 44 Q76 54 78 62Z' fill='{c}' {ln(l)}/>"
            + mochi(c, l, top=22, bot=90, w=38)
            + f"<path d='M14 70 Q50 82 86 70 Q84 90 50 90 Q16 90 14 70z' fill='{w}'/>"
            + f"<ellipse cx='16' cy='72' rx='5' ry='7.5' transform='rotate(50 16 72)' fill='{c}' {ln(l)}/>"
            + eyes(58, 12) + blush(65, 21) + mouth(64.5, 3.2))


def M_axolotl():
    c, l, g = '#ffd2df', '#e38aa8', '#ff9ebd'
    gills = ''
    for x, y, r in ((15, 30, -35), (11, 43, 0), (15, 56, 35), (85, 30, 35), (89, 43, 0), (85, 56, -35)):
        gills += f"<ellipse cx='{x}' cy='{y}' rx='7.5' ry='3.6' transform='rotate({r} {x} {y})' fill='{g}' {ln(l, 2.2)}/>"
    return (SHADOW + tail('M66 86 Q84 86 88 74', c, l, 8) + body(c, l, '#fff0f5', wave=True) + gills + mochi(c, l, top=18, w=36)
            + eyes(52, 13, 3.8, 4.6) + blush(59, 22)
            + f"<path d='M44 58.5 q6 4.5 12 0' fill='none' {ln(F, 1.9)}/>"
            + "<circle cx='43' cy='29' r='1.8' fill='#ffb3c9'/><circle cx='55' cy='26' r='1.3' fill='#ffb3c9'/>")


def _wrap(v):
    # 그림자 뺀 몸 전체를 .mb로 묶음(통통 튀기 애니메이션). 정적 그림(스티커 미리보기·무늬)에선 클래스가 무시됨
    assert v.startswith(SHADOW)
    return SHADOW + "<g class='mb'>" + v[len(SHADOW):] + '</g>'


# 움직이는 부위 클래스: .mb 몸 전체 · .me 눈(깜빡임) · .ma 흔드는 팔 · .mt 꼬리 · .ms 고래 물줄기 · .mk 반짝이
MASCOT = {k[2:]: _wrap(v()) for k, v in list(globals().items()) if k.startswith('M_')}
