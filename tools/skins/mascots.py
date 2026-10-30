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
    # 2026-10-23: '너무 초롱초롱하다' → 눈을 20% 작게, 하이라이트는 작은 것 하나만(아래쪽 점 제거)
    rx, ry = rx * .8, ry * .8
    o = "<g class='me'>"
    for x in (50 - dx, 50 + dx):
        o += (f"<ellipse cx='{x}' cy='{y}' rx='{rx:.2f}' ry='{ry:.2f}' fill='{F}'/>"
              f"<circle cx='{x+rx*.32:.1f}' cy='{y-ry*.36:.1f}' r='{rx*.3:.1f}' fill='#fff' opacity='.9'/>")
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
    return o + HEAD  # 여기부터 머리(고개 갸웃·따라 움직임)


def tail(d, c, l, w=6):
    # 굵은 선으로 그린 꼬리: 테두리색 굵게 → 몸색 얇게
    return f"<g class='mt'><path d='{d}' fill='none' stroke='{l}' stroke-width='{w+2.6}' stroke-linecap='round'/><path d='{d}' fill='none' stroke='{c}' stroke-width='{w}' stroke-linecap='round'/></g>"


def cloud(circles, c, l, w=2.6):
    return (''.join(f"<circle cx='{x}' cy='{y}' r='{r}' fill='{c}' stroke='{l}' stroke-width='{w}'/>" for x, y, r in circles)
            + ''.join(f"<circle cx='{x}' cy='{y}' r='{r-w/2-.2:.1f}' fill='{c}'/>" for x, y, r in circles))


HEAD = '<!--H-->'
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
    return (SHADOW + body(c, l).replace(HEAD, '') + "<circle cx='66' cy='88' r='5' fill='#fff' " + ln(l) + "/>" + HEAD
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
    # 2026-10-24 '눈이 무섭다' → 흰자 테두리(노려보는 느낌) 빼고 까만 눈 + 하이라이트 2개, 눈두덩은 바깥으로 처지게(八자)
    for x in (39.5, 60.5):
        pupil += (f"<ellipse cx='{x}' cy='55' rx='3.3' ry='3.9' fill='#141217'/>"
                  f"<circle cx='{x+1.1}' cy='53.6' r='1.35' fill='#fff'/><circle cx='{x-1}' cy='56.6' r='.6' fill='#fff' opacity='.8'/>")
    pupil += '</g>'
    return (SHADOW + body(k, '#2c2932', c, feet=k).replace(f"<ellipse cx='50' cy='81' rx='18' ry='12.5' fill='{k}'", f"<ellipse cx='50' cy='81' rx='18' ry='12.5' fill='{c}'")
            + f"<circle cx='23' cy='22' r='10' fill='{k}' {ln('#2c2932')}/><circle cx='77' cy='22' r='10' fill='{k}' {ln('#2c2932')}/>" + mochi(c, l)
            + f"<ellipse cx='38' cy='56' rx='7.6' ry='8.8' transform='rotate(28 38 56)' fill='{k}'/><ellipse cx='62' cy='56' rx='7.6' ry='8.8' transform='rotate(-28 62 56)' fill='{k}'/>"
            + pupil + blush(64, 26) + f"<ellipse cx='50' cy='61' rx='2.8' ry='2' fill='{k}'/>" + mouth(63.4, 3))


def M_dino():
    c, l, s = '#aee8c8', '#5fae86', '#ffd877'
    return (SHADOW + tail('M66 86 Q82 88 90 78', c, l, 9) + body(c, l, '#e2f8ea', wave=True)
            + f"<path d='M33 20 l4 -13 l7 8 l6 -14 l6 14 l7 -8 l4 13z' fill='{s}' {ln('#d6a842', 2.2)}/>" + mochi(c, l, top=17)
            + eyes(53) + blush(60, 19) + "<circle cx='47' cy='58' r='1' fill='#5fae86'/><circle cx='53' cy='58' r='1' fill='#5fae86'/>"
            + "<path d='M47.3 61.8 l1.1 2.3 l1.1 -2.3z' fill='#fff' stroke='#5fae86' stroke-width='.5' stroke-linejoin='round'/>" + mouth(60.5, 3.2))


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


def M_shark():
    # 2026-10-27 추가: 회청색 몸 + 흰 아래턱·배, 머리 위 등지느러미, 초승달 꼬리, 웃는 입에 작은 이빨 두 개(무섭지 않게)
    c, l, w = '#b4c8dc', '#6e8aa8', '#f4f8fc'
    tailfin = (f"<g class='mt'><path d='M64 86 Q74 86 80 80 Q82 72 89 66 Q90 77 85 84 Q90 89 92 95 Q82 92 77 89 Q71 91 64 90Z' fill='{c}' {ln(l)}/></g>")
    dorsal = f"<path d='M38 22 Q46 1 64 3 Q58 10 60 22Z' fill='{c}' {ln(l)}/>"
    mask = f"<path d='M15.5 62 Q32 57 50 57 Q68 57 84.5 62 Q84 73 50 74 Q16 73 15.5 62z' fill='{w}'/>"
    gills = (f"<path d='M19 44 q2.4 3.5 0 7 M23.5 43 q2.4 3.5 0 7' fill='none' {ln(l, 1.8)}/>"
             f"<path d='M81 44 q-2.4 3.5 0 7 M76.5 43 q-2.4 3.5 0 7' fill='none' {ln(l, 1.8)}/>")
    grin = (f"<path d='M43.5 60.5 q6.5 5.2 13 0' fill='#5b3a44' {ln(F, 1.9)}/>"
            f"<path d='M46 61.6 l1.5 2.4 l1.5 -1.7z M51 62.2 l1.5 1.7 l1.5 -2.4z' fill='#fff'/>")
    return (SHADOW + tailfin + body(c, l, w, wave=True) + dorsal + mochi(c, l, top=17)
            + mask + gills + eyes(52) + blush(58.5, 20) + grin)


def _wrap(v):
    # 그림자(.msh) · 몸 전체(.mb) 안에 몸통(.mbo)과 머리(.mh)를 나눠 묶음 → 머리가 몸보다 살짝 늦게 따라 움직이게(겹침 동작)
    # 정적 그림(고르기 버튼·배경 무늬)에선 클래스·주석이 아무 영향 없음
    assert v.startswith(SHADOW)
    v = v[len(SHADOW):]
    if HEAD in v:
        b, h = v.split(HEAD, 1)
        v = f"<g class='mbo'>{b}</g><g class='mh'>{h}</g>"
    return f"<g class='msh'>{SHADOW}</g><g class='mb'>{v}</g>"


# 움직이는 부위 클래스: .msh 그림자 · .mb 몸 전체 · .mbo 몸통 · .mh 머리 · .me 눈(깜빡임) · .ma 흔드는 팔 · .mt 꼬리 · .ms 고래 물줄기 · .mk 반짝이
MASCOT = {k[2:]: _wrap(v()) for k, v in list(globals().items()) if k.startswith('M_')}


# ===== 할로윈 의상 (2026-10-30 하율: "캐릭터들도 각자 할로윈 캐릭터를 정해서 꾸미는 거지 — 고양이에 송곳니·망토로 뱀파이어처럼")
# 원래 그림(M_*)을 그대로 두고 의상만 덧입힘: back = 몸 뒤(그림자 바로 다음) · pre = 몸통 위(머리 아래) · head = 머리 위(얼굴 위)
# 의상도 같은 규칙: 파스텔·외곽선은 그 색의 진한 색 2.6 · 무섭지 않게(작은 송곳니·동그란 눈 유지)
import re as _re
HP, HPL = '#7a55ad', '#4e3275'      # 할로윈 보라(망토·모자)
HO, HOL = '#ff9a3c', '#c96a1c'      # 호박 주황
HK, HKL = '#3e3550', '#2a2238'      # 밤색(검정 대신 아주 진한 보라)


def _fangs(x1, x2, y):
    return ''.join(f"<path d='M{x-1.25:.2f} {y} l1.25 2.9 l1.25 -2.9z' fill='#fff' {ln(F, 1)}/>" for x in (x1, x2))


def _hat(cx, by, w, h, tilt=0, star=True):
    # 마녀 모자: 챙 + 살짝 꺾인 고깔 + 주황 띠 (+ 노란 별)
    o = (f"<g transform='rotate({tilt} {cx} {by})'><ellipse cx='{cx}' cy='{by}' rx='{w}' ry='{w*.24:.1f}' fill='{HP}' {ln(HPL)}/>"
         f"<path d='M{cx-w*.55:.1f} {by-.5} Q{cx-w*.25:.1f} {by-h*.55:.1f} {cx+w*.3:.1f} {by-h} Q{cx+w*.2:.1f} {by-h*.5:.1f} {cx+w*.55:.1f} {by-.5}Z' fill='{HP}' {ln(HPL)}/>"
         f"<path d='M{cx-w*.5:.1f} {by-3} Q{cx} {by-1} {cx+w*.5:.1f} {by-3} L{cx+w*.53:.1f} {by-.8} Q{cx} {by+1.4} {cx-w*.53:.1f} {by-.8}Z' fill='{HO}' {ln(HOL, 1.6)}/>")
    if star:
        o += f"<path d='M{cx+w*.12:.1f} {by-h*.45:.1f} l1.2 2.6 2.8 .3 -2.1 1.9 .6 2.8 -2.5 -1.4 -2.5 1.4 .6 -2.8 -2.1 -1.9 2.8 -.3z' fill='#ffe27a' {ln('#d9a63a', 1)}/>"
    return o + '</g>'


def _pumpkin(cx, cy, rx, ry, face=True, stem=True):
    o = ''
    if stem:
        o += f"<path d='M{cx-1.5} {cy-ry+1} q0 -4.5 3.5 -6 l1.6 1.8 q-2.4 1 -2.4 4.2z' fill='#7fbf6a' {ln('#4f8a41', 1.6)}/>"
    o += (f"<ellipse cx='{cx-rx*.42:.1f}' cy='{cy}' rx='{rx*.62:.1f}' ry='{ry}' fill='{HO}' {ln(HOL)}/>"
          f"<ellipse cx='{cx+rx*.42:.1f}' cy='{cy}' rx='{rx*.62:.1f}' ry='{ry}' fill='{HO}' {ln(HOL)}/>"
          f"<ellipse cx='{cx}' cy='{cy}' rx='{rx*.5:.1f}' ry='{ry}' fill='#ffad57' {ln(HOL)}/>")
    if face:
        s = rx / 10
        o += (f"<path d='M{cx-5*s:.1f} {cy-.4*s:.1f} l2.2 {-3*s:.1f} l2.2 {3*s:.1f}z M{cx+.6*s:.1f} {cy-.4*s:.1f} l2.2 {-3*s:.1f} l2.2 {3*s:.1f}z' fill='{HK}'/>"
              f"<path d='M{cx-5*s:.1f} {cy+2*s:.1f} q{5*s:.1f} {4*s:.1f} {10*s:.1f} 0 q{-5*s:.1f} {1.6*s:.1f} {-10*s:.1f} 0z' fill='{HK}'/>")
    return o


def _band(d, w=5.5):
    # 미라 붕대(진한 테두리 → 흰 띠 → 옅은 결)
    return (f"<path d='{d}' fill='none' stroke='#cbbfae' stroke-width='{w+2.4}' stroke-linecap='round'/>"
            f"<path d='{d}' fill='none' stroke='#fffaf0' stroke-width='{w}' stroke-linecap='round'/>")


def _suit(pre, c, new, line=None):
    # 몸통·팔(·흔드는 팔) 색만 바꿔 '옷' 입히기 — 꼬리·발은 그대로
    pre = _re.sub(r"(<ellipse cx='(?:50' cy='81|33\.5|66\.5|72)'[^>]*?fill=')" + _re.escape(c) + "'", r"\g<1>" + new + "'", pre)
    if line:
        pre = _re.sub(r"(<ellipse cx='(?:50' cy='81|33\.5|66\.5|72)'[^>]*?fill='" + _re.escape(new) + "' stroke=')[^']*'", r"\g<1>" + line + "'", pre)
    return pre


def H_cat(pre, head):   # 뱀파이어: 세운 깃 망토(안감 빨강) + 리본 + 작은 송곳니
    back = (f"<path d='M17 66 L1 34 Q9 44 20 50Z M83 66 L99 34 Q91 44 80 50Z' fill='{HK}' {ln(HKL)}/>"
            f"<path d='M15 60 L5 41 Q11 47 18 51Z M85 60 L95 41 Q89 47 82 51Z' fill='#e0546a'/>"
            f"<path d='M30 68 Q16 82 21 95 Q36 98 50 96 Q64 98 79 95 Q84 82 70 68Z' fill='{HK}' {ln(HKL)}/>"
            f"<path d='M34 71 Q24 82 27 92 Q39 95 50 93.5 Q61 95 73 92 Q76 82 66 71Z' fill='#e0546a'/>")
    pre += (f"<path d='M44 74 l6 2.6 l6 -2.6 l-1.2 5.6 l-4.8 -2.2 l-4.8 2.2z' fill='#e0546a' {ln('#a8344a', 1.6)}/><circle cx='50' cy='76.8' r='2' fill='#ffd34d' {ln('#c9962a', 1.2)}/>")
    return back, pre, head + _fangs(47.6, 52.4, 61.2)


def H_dog(pre, head):   # 해골 옷: 밤색 전신 옷 + 흰 뼈
    pre = _suit(pre, '#fff3df', HK, HKL).replace("fill='#ffffff'/>", f"fill='{HK}'/>", 1)
    pre += ("<g fill='none' stroke='#fffaf0' stroke-width='2.2' stroke-linecap='round'><path d='M50 74.5 v16'/>"
            "<path d='M43 78.5 q7 2.6 14 0 M42 83 q8 2.8 16 0 M43.5 87.5 q6.5 2.4 13 0'/></g>"
            "<g fill='#fffaf0'><circle cx='31' cy='79' r='1.6'/><circle cx='33' cy='84' r='1.6'/><circle cx='69' cy='79' r='1.6'/><circle cx='67' cy='84' r='1.6'/></g>")
    return '', pre, head


def H_bear(pre, head):  # 미라: 머리·몸에 붕대 (눈·입은 비움)
    pre += _band('M34 73 Q50 79 66 74', 4.6) + _band('M33.5 84 Q48 82 66.5 88', 4.6)
    head += _band('M17 38 Q46 27 83 33') + _band('M20 46 Q30 44 36 46') + _band('M70 71 Q78 68 85 63', 4.4)
    return '', pre, head


def H_bunny(pre, head):  # 꼬마 마녀: 귀 사이 마녀 모자
    return '', pre, head + _hat(50, 25, 15, 20, -8)


def H_frog(pre, head):  # 프랑켄슈타인: 관자놀이 볼트 + 이마 꿰맨 자국
    bolt = ''.join(f"<rect x='{x}' y='53' width='7' height='5' rx='1.4' fill='#b9bfc9' {ln('#7b8291', 1.8)}/><rect x='{x2}' y='51.5' width='3' height='8' rx='1' fill='#d6dbe2' {ln('#7b8291', 1.6)}/>"
                   for x, x2 in ((7, 5.5), (86, 91.5)))
    stitch = f"<path d='M41 39.5 h18 M43.5 37 v5 M47.8 37 v5 M52.2 37 v5 M56.5 37 v5' fill='none' {ln('#5c8d4c', 1.8)}/>"
    return '', pre, bolt + head + stitch


def H_chick(pre, head):  # 꼬마 악마: 빨간 뿔 + 뾰족 꼬리 + 삼지창 없이 귀엽게
    back = (tail('M64 88 Q80 92 82 80', '#ff7b7b', '#c94b4b', 4)
            + f"<path d='M78.5 80 L82 72.5 L86 80.5 Q82 78.5 78.5 80Z' fill='#ff7b7b' {ln('#c94b4b', 2)}/>")
    horns = ''.join(f"<path d='M{x} 27 Q{x+d*-5} 15 {x+d*2} 10 Q{x+d*2} 19 {x+d*7} 24Z' fill='#ff7b7b' {ln('#c94b4b', 2.2)}/>" for x, d in ((31, 1), (69, -1)))
    return back, pre, horns + head


def H_hamster(pre, head):  # 사탕 받으러 온 햄찌: 호박 바구니(사탕 가득)
    pre += (f"<path d='M40 79 Q50 64 60 79' fill='none' {ln('#4f3a2a', 2)}/>"
            "<circle cx='45' cy='77' r='3' fill='#ff8fbf' stroke='#d9608f' stroke-width='1.4'/><circle cx='51' cy='75.5' r='3' fill='#8fd7ff' stroke='#4f9cd0' stroke-width='1.4'/><circle cx='56' cy='77.5' r='2.8' fill='#ffe27a' stroke='#d9a63a' stroke-width='1.4'/>"
            + _pumpkin(50, 85, 13, 8, stem=False))
    return '', pre, head


def H_penguin(pre, head):  # 박쥐: 등에 박쥐 날개 + 박쥐 귀 머리띠
    wing = lambda s: (f"<path d='M{50-s*14} 74 Q{50-s*30} 62 {50-s*40} 68 Q{50-s*35} 72 {50-s*36} 78 Q{50-s*30} 75 {50-s*28} 81 Q{50-s*22} 78 {50-s*16} 84Z' fill='{HK}' {ln(HKL)}/>")
    back = wing(1) + wing(-1)
    ears = ''.join(f"<path d='M{x} 15 L{x+d*3} 1.5 L{x+d*10} 12Z' fill='{HK}' {ln(HKL, 2.2)}/><path d='M{x+d*2} 12.5 L{x+d*3.4} 5 L{x+d*7} 11.5Z' fill='#b58cff'/>" for x, d in ((33, 1), (67, -1)))
    return back, pre, head + ears


def H_fox(pre, head):  # 랜턴 든 여우: 잭오랜턴 랜턴
    pre += f"<path d='M66.5 74 L70 66' fill='none' {ln('#6b4a2e', 2)}/>" + _pumpkin(70.5, 84, 9, 6.5)
    return '', pre, head


def H_panda(pre, head):  # 강시: 청나라 모자 + 이마 부적
    hat = (f"<ellipse cx='50' cy='20' rx='19' ry='4.5' fill='{HK}' {ln(HKL)}/><path d='M37 19.5 Q38 7 50 7 Q62 7 63 19.5Z' fill='{HK}' {ln(HKL)}/>"
           "<circle cx='50' cy='6' r='2.6' fill='#e0546a' stroke='#a8344a' stroke-width='1.4'/>")
    tag = ("<path d='M44.5 21 h11 l-.6 19 q-4.9 1.6 -9.8 0z' fill='#ffe27a' stroke='#d9a63a' stroke-width='1.4' stroke-linejoin='round'/>"
           "<path d='M50 24 v13 M47 27 h6 M47.5 31 q2.5 2 5 0 M47.5 34.5 q2.5 -2 5 0' fill='none' stroke='#e0546a' stroke-width='1.4' stroke-linecap='round'/>")
    return '', pre, head + tag + hat


def H_dino(pre, head):  # 사탕옥수수 공룡: 주황·흰 가시 + 막대사탕
    head = head.replace("fill='#ffd877'", f"fill='{HO}'", 1).replace("stroke='#d6a842'", f"stroke='{HOL}'", 1)
    lolly = (f"<path d='M84 66 L91 47' {ln('#c9b8a0', 4.4)}/><path d='M84 66 L91 47' stroke='#fff' stroke-width='2.4' stroke-linecap='round'/>"
             f"<ellipse cx='84.5' cy='66' rx='4.6' ry='6.6' transform='rotate(-30 84.5 66)' fill='#aee8c8' {ln('#5fae86')}/>"
             "<circle cx='92' cy='43' r='6' fill='#ff8fbf' stroke='#d9608f' stroke-width='2'/><path d='M92 43 m-3.5 0 a3.5 3.5 0 1 1 3.5 3.5 a2 2 0 1 1 -2 -2' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/>")
    return '', pre, head + lolly + "<path d='M38.5 12.2 l2 2.4 M50 7 l0 3 M61.5 12.2 l-2 2.4' stroke='#fff' stroke-width='2' stroke-linecap='round'/>"


def H_ghost(pre, head):  # 호박 쓴 유령: 머리에 잭오랜턴 모자
    return '', pre, head + _pumpkin(50, 13, 15, 8.5)


def H_slime(pre, head):  # 마녀 슬라임: 큰 마녀 모자
    return '', pre, head + _hat(50, 27, 22, 26, 6)


def H_sheep(pre, head):  # 유령 풍선 든 양
    return '', pre, head + ("<path d='M71 76 Q80 62 85 48' fill='none' stroke='#b8acdf' stroke-width='1.4'/>"
                            f"<path d='M76 46 Q76 30 85 30 Q94 30 94 46 l-2.8 -2.4 -2.8 2.4 -2.8 -2.4 -2.8 2.4 -2.8 -2.4z' fill='#fbfaff' {ln('#b8acdf', 2.2)}/>"
                            f"<circle cx='82' cy='38' r='1.4' fill='{F}'/><circle cx='88' cy='38' r='1.4' fill='{F}'/><path d='M83.5 41.5 q1.5 1.4 3 0' fill='none' {ln(F, 1.2)}/>")


def H_whale(pre, head):  # 꼬마 해적 고래: 해골 해적 모자(물줄기는 모자 위로)
    return '', pre, head + (f"<path d='M20 34 Q30 14 50 16 Q70 14 80 34 Q66 27 50 29 Q34 27 20 34Z' fill='{HK}' {ln(HKL)}/>"
                            "<path d='M22 32.5 Q36 26 50 27.5 Q64 26 78 32.5' fill='none' stroke='#ffd34d' stroke-width='1.6'/>"
                            "<circle cx='50' cy='21.5' r='3.4' fill='#fffaf0'/><rect x='48' y='23.5' width='4' height='2.4' rx='.8' fill='#fffaf0'/>"
                            f"<circle cx='48.7' cy='21.3' r='.9' fill='{HK}'/><circle cx='51.3' cy='21.3' r='.9' fill='{HK}'/>")


def H_axolotl(pre, head):  # 검은 고양이 분장: 고양이 귀 머리띠 + 방울 목걸이
    ears = ''.join(f"<path d='M{x} 25 L{x+d*2} 9 L{x+d*13} 19Z' fill='{HK}' {ln(HKL, 2.2)}/><path d='M{x+d*3} 21.5 L{x+d*3.6} 13.5 L{x+d*9.5} 18.5Z' fill='#ff9ebd'/>" for x, d in ((30, 1), (70, -1)))
    band = f"<path d='M27.5 27 Q50 15 72.5 27' fill='none' stroke='{HK}' stroke-width='3' stroke-linecap='round'/>"
    pre += (f"<path d='M38 73.5 Q50 78 62 73.5' fill='none' stroke='#e0546a' stroke-width='3' stroke-linecap='round'/>"
            "<circle cx='50' cy='78' r='3' fill='#ffd34d' stroke='#c9962a' stroke-width='1.4'/><path d='M48.4 78.6 h3.2' stroke='#c9962a' stroke-width='1'/>")
    return '', pre, head + band + ears


def H_shark(pre, head):  # 저승사자 상어: 검은 도포 + 갓(등지느러미가 갓을 뚫고 나옴)
    pre = _suit(pre, '#b4c8dc', HK, HKL).replace("fill='#f4f8fc'/>", "fill='#fffaf0'/>", 1)
    pre += f"<path d='M43 70 L50 84 L57 70' fill='none' stroke='#fffaf0' stroke-width='2.2' stroke-linejoin='round'/>"
    fin = "<path d='M38 22 Q46 1 64 3 Q58 10 60 22Z' fill='#b4c8dc' " + ln('#6e8aa8') + "/>"
    # 2026-10-30 하율 "지느러미가 모자에 이상하게 튀어나와 있다" → 갓을 작게, 머리 왼쪽에 비스듬히(지느러미는 그대로 보이게)
    gat = (f"<g transform='rotate(-22 30 29.5)'><ellipse cx='30' cy='29.5' rx='16' ry='3.6' fill='#2a2238' fill-opacity='.82' {ln('#120d1a', 2)}/>"
           f"<path d='M23.5 29 L24.5 20.5 Q30 19.1 35.5 20.5 L36.5 29Z' fill='#2a2238' fill-opacity='.88' {ln('#120d1a', 2)}/></g>")
    return '', pre, head + gat + fin


def _hw(name, v):
    assert v.startswith(SHADOW)
    rest = v[len(SHADOW):]
    if HEAD in rest:
        pre, head = rest.split(HEAD, 1)
    else:
        pre, head = '', rest
    back, pre, head = globals()['H_' + name](pre, head)
    return SHADOW + back + pre + (HEAD if HEAD in rest else '') + head


MASCOT_HW = {k[2:]: _wrap(_hw(k[2:], v())) for k, v in list(globals().items()) if k.startswith('M_')}
