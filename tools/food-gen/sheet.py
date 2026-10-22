import sys,glob,os
from PIL import Image, ImageDraw
d=sys.argv[1]; out=sys.argv[2]; keys=sys.argv[3:] or sorted(os.path.basename(f)[:-4] for f in glob.glob(f'{d}/*.jpg'))
W=220; cols=5; rows=(len(keys)+cols-1)//cols
s=Image.new('RGB',(W*cols,(W+16)*rows),'white'); dr=ImageDraw.Draw(s)
for i,k in enumerate(keys):
    p=f'{d}/{k}.jpg'
    if not os.path.exists(p): continue
    x=(i%cols)*W; y=(i//cols)*(W+16); s.paste(Image.open(p).convert('RGB').resize((W,W)),(x,y)); dr.text((x+4,y+W+1),k,fill='black')
s.save(out,quality=82)
