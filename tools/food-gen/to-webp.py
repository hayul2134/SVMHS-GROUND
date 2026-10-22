# 카툰 원본(jpg, 흰 배경) → 배경을 투명하게 지우고 음식만 잘라 256px WebP로 저장
# python3 to-webp.py <원본 폴더> <public/food/c 폴더>
import sys, glob, os
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
MARK = (255, 0, 255)
for p in sorted(glob.glob(f'{src}/*.jpg')):
    key = os.path.basename(p)[:-4]
    im = Image.open(p).convert('RGB')
    w, h = im.size
    m = im.copy()
    # 네 모서리·가장자리 여러 점에서 흰 배경을 채워 표시 (흰 바탕과 이어진 부분만 지움 → 음식 안의 흰색은 남음)
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if sum(m.getpixel((x, y))) > 690:
            ImageDraw.floodfill(m, (x, y), MARK, thresh=38)
    mask = Image.new('L', (w, h), 255)
    mp, mk = m.load(), mask.load()
    for y in range(h):
        for x in range(w):
            if mp[x, y] == MARK: mk[x, y] = 0
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))   # 가장자리 부드럽게
    rgba = im.copy(); rgba.putalpha(mask)
    box = mask.point(lambda v: 255 if v > 24 else 0).getbbox()
    if box:
        pad = int(max(w, h) * 0.02)
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))
        rgba = rgba.crop(box)
    rgba.thumbnail((256, 256), Image.LANCZOS)
    rgba.save(f'{out}/{key}.webp', 'WEBP', quality=80, method=6)
    print(key, rgba.size, os.path.getsize(f'{out}/{key}.webp'))
