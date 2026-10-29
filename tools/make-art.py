# Renders Pomodoro store art: banner.png (1000x800) and icon.png (330x330).
# Style follows the Store's existing skills: dark background, glowing title; white glyph icon.
import math, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1]
FONT = '/root/.hermes/cache/scratch/Nunito.ttf'
CYAN, GREEN, PURPLE = (37, 242, 251), (92, 224, 122), (181, 140, 255)
S = 2  # supersample

def font(size, weight):
    f = ImageFont.truetype(FONT, size * S); f.set_variation_by_name(weight); return f

def glow(base, layer, radius, strength=2):
    blur = layer.filter(ImageFilter.GaussianBlur(radius * S))
    for _ in range(strength): base.alpha_composite(blur)
    base.alpha_composite(layer)

# ---- banner ----
W, H = 1000 * S, 800 * S
banner = Image.new('RGBA', (W, H), (20, 18, 16, 255))
ring = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
cx, cy, r, lw = W // 2, 300 * S, 175 * S, 26 * S
d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(33, 32, 43, 255), width=lw)        # track
d.arc([cx - r, cy - r, cx + r, cy + r], start=-90 + 0.4 * 360, end=270, fill=CYAN + (255,), width=lw)  # 60% left
glow(banner, ring, 14)
text = Image.new('RGBA', (W, H), (0, 0, 0, 0)); t = ImageDraw.Draw(text)
t.text((cx, cy), '15:00', font=font(92, 'Light'), fill=(255, 255, 255, 255), anchor='mm')
t.text((cx, 600 * S), 'Pomodoro', font=font(150, 'Black'), fill=CYAN + (255,), anchor='mm')
glow(banner, text, 10, 1)
dots = Image.new('RGBA', (W, H), (0, 0, 0, 0)); g = ImageDraw.Draw(dots)
for i, colour in enumerate([CYAN, CYAN, (55, 54, 74), (0, 0, 0)]):
    x = cx + (i - 1.5) * 44 * S; y = 712 * S; rr = 12 * S
    g.ellipse([x - rr, y - rr, x + rr, y + rr], fill=colour + (255,), outline=(88, 88, 109, 255), width=3 * S)
banner.alpha_composite(dots)
banner.convert('RGB').resize((1000, 800), Image.LANCZOS).save(OUT + '/banner.png')

# ---- icon: white stopwatch glyph on transparent, 330x330 like other Store skills ----
S2 = 4; W = 330 * S2
icon = Image.new('LA', (W, W), (0, 0)); d = ImageDraw.Draw(icon)
c = W // 2; r = int(W * 0.33); lw = int(W * 0.07); cy = c + 18 * S2
d.ellipse([c - r, cy - r, c + r, cy + r], outline=(255, 255), width=lw)
d.rounded_rectangle([c - 24 * S2, cy - r - 44 * S2, c + 24 * S2, cy - r - 7 * S2], radius=9 * S2, fill=(255, 255))
i = lw * 1.7; d.pieslice([c - r + i, cy - r + i, c + r - i, cy + r - i], -90, 30, fill=(255, 255))
icon.resize((330, 330), Image.LANCZOS).save(OUT + '/icon.png')
print('wrote banner.png and icon.png')
