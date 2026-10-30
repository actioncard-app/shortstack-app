# Side-by-side BEFORE | AFTER images per screen (Pillow; ImageMagick isn't on the box).
import sys, os
from PIL import Image, ImageDraw, ImageFont
root = 'screenshots'; os.makedirs(f'{root}/compare', exist_ok=True)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34)
except Exception: font = ImageFont.load_default()
for n in sorted(os.listdir(f'{root}/before')):
    a, b = f'{root}/before/{n}', f'{root}/after/{n}'
    if not os.path.exists(b): continue
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    h = max(A.height, B.height); W = A.width + B.width + 30
    out = Image.new('RGB', (W, h + 60), (30, 30, 36)); d = ImageDraw.Draw(out)
    out.paste(A, (0, 60)); out.paste(B, (A.width + 30, 60))
    d.text((20, 12), 'BEFORE', fill=(200, 200, 210), font=font); d.text((A.width + 50, 12), 'AFTER', fill=(255, 200, 80), font=font)
    out.save(f'{root}/compare/{n}'); print('compare', n)
