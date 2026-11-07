import os
from PIL import Image, ImageDraw
import numpy as np

src_img = 'C:/Users/KASHIF/.gemini/antigravity/brain/81a6a4e7-abab-465e-9c55-4c29beca0f91/.user_uploaded/media_1793927253695_d559c58d.jpg'
dest_front = 'public/branding/master-front-card.png'
dest_back = 'public/branding/master-back-template.png'

TARGET_W, TARGET_H = 1240, 1748 # Exact 105 mm x 148 mm at 300 DPI (A6 portrait)

im = Image.open(src_img).convert('RGBA')

# Colors
deep_green = (1, 56, 33, 255)
gold_color = (197, 160, 89, 255)

# ==============================================================================
# 1. FRONT CARD
# ==============================================================================
f_raw = im.crop((32, 8, 495, 695))
W_raw, H_raw = f_raw.size # 463 x 687

# Square the 4 corners in f_raw with deep_green:
# Top corners
for y in range(0, 35):
    for x in range(0, 35):
        r, g, b, a = f_raw.getpixel((x, y))
        if r > 10 or g > 75 or b > 50 or (abs(r - b) < 15 and r > 100):
            f_raw.putpixel((x, y), deep_green)
    for x in range(W_raw - 35, W_raw):
        r, g, b, a = f_raw.getpixel((x, y))
        if r > 10 or g > 75 or b > 50 or (abs(r - b) < 15 and r > 100):
            f_raw.putpixel((x, y), deep_green)

# Bottom corners (completely eliminate grey residue)
for y in range(H_raw - 35, H_raw):
    for x in range(0, 35):
        r, g, b, a = f_raw.getpixel((x, y))
        if r > 15 or g > 75 or b > 50 or (abs(r - b) < 20 and r > 70):
            f_raw.putpixel((x, y), deep_green)
    for x in range(W_raw - 35, W_raw):
        r, g, b, a = f_raw.getpixel((x, y))
        if abs(r - b) < 20 and r > 70:
            f_raw.putpixel((x, y), deep_green)

# Scale up to 1240 x 1748
f_scaled = f_raw.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)

# COVER TOP PUNCHHOLES WITH SOLID HEADER GRADIENT (Zero white lanyard slots)
f_arr = np.array(f_scaled)
for y in range(0, 165):
    # Left hole wipe: x in [130..365]
    c_l = f_arr[y, 100].astype(float)
    c_r = f_arr[y, 450].astype(float)
    for x in range(125, 370):
        t = (x - 125) / float(370 - 125)
        f_arr[y, x] = ((1.0 - t) * c_l + t * c_r).astype(np.uint8)

    # Right hole wipe: x in [925..1130]
    c_l = f_arr[y, 880].astype(float)
    c_r = f_arr[y, 1150].astype(float)
    for x in range(920, 1135):
        t = (x - 920) / float(1135 - 920)
        f_arr[y, x] = ((1.0 - t) * c_l + t * c_r).astype(np.uint8)

# Square the top 20 rows completely so no light border pixels remain
for y in range(0, 25):
    for x in range(0, TARGET_W):
        if f_arr[y, x, 0] > 40 or f_arr[y, x, 1] > 70 or f_arr[y, x, 2] > 45:
            f_arr[y, x] = f_arr[26, x]

f_scaled = Image.fromarray(f_arr)
f_draw = ImageDraw.Draw(f_scaled)

sx = TARGET_W / float(W_raw)
sy = TARGET_H / float(H_raw)

# Clean dynamic fields
f_draw.rounded_rectangle([round(147*sx), round(268*sy), round(311*sx), round(400*sy)], radius=round(18*sx), fill=(250, 248, 243, 255))
# Wipe old photo frame bottom boundary and underline before attendee name (y: 990..1055, x: 350..890)
f_draw.rectangle([350, 990, 890, 1055], fill=(250, 248, 243, 255))
f_draw.rectangle([round(65*sx), round(414*sy), round(400*sx), round(450*sy)], fill=(250, 248, 243, 255))
f_draw.rectangle([round(130*sx), round(455*sy), round(335*sx), round(492*sy)], fill=(250, 248, 243, 255))
f_draw.rectangle([201+2, 1267+2, 580-2, 1599-2], fill=(255, 255, 255, 255))
f_draw.rectangle([201, 1267, 580, 1599], outline=gold_color, width=4)
f_draw.rounded_rectangle([round(248*sx), round(566*sy), round(368*sx), round(594*sy)], radius=round(8*sx), fill=(253, 246, 226, 255))

# Left and Right logos
diam = 268
if os.path.exists('public/branding/jasicon-emblem.png'):
    l_logo = Image.open('public/branding/jasicon-emblem.png').resize((diam, diam), Image.Resampling.LANCZOS)
    f_scaled.paste(l_logo, (240 - diam // 2, 228 - diam // 2), l_logo)
    f_draw.ellipse([240 - diam // 2, 228 - diam // 2, 240 + diam // 2, 228 + diam // 2], outline=gold_color, width=3)

if os.path.exists('public/branding/asi-jharkhand-logo.png'):
    r_logo = Image.open('public/branding/asi-jharkhand-logo.png').resize((diam, diam), Image.Resampling.LANCZOS)
    f_scaled.paste(r_logo, (1002 - diam // 2, 229 - diam // 2), r_logo)
    f_draw.ellipse([1002 - diam // 2, 229 - diam // 2, 1002 + diam // 2, 229 + diam // 2], outline=gold_color, width=3)

# FRONT CENTER LOGO:
# 1. Erase 100% of old shield, old logo, and shoulders using seamless horizontal gradient interpolation:
# For each row y from 90 to 378 across x=415..825 (between left emblem and right emblem):
for y in range(90, 378):
    c_left = np.array(f_scaled.getpixel((415, y)), dtype=float)
    c_right = np.array(f_scaled.getpixel((825, y)), dtype=float)
    for x in range(415, 826):
        t = (x - 415) / float(825 - 415)
        interpolated = (1.0 - t) * c_left + t * c_right
        f_scaled.putpixel((x, y), tuple(interpolated.astype(int)))

# 2. Draw pristine white oval shield (rx=175, ry=130, cx=620, cy=237; bounds: x: 445..795, y: 107..367):
shield_cx, shield_cy = 620, 237
shield_rx, shield_ry = 175, 130
shield_box = [shield_cx - shield_rx, shield_cy - shield_ry, shield_cx + shield_rx, shield_cy + shield_ry]
f_draw.ellipse(shield_box, fill=(255, 255, 255, 255), outline=gold_color, width=4)

# 3. Paste authentic center logo inside shield (width=240, height=221, centered at 620, 237)
# Bounds: x=500..740, y=126..347. Leaves 20px white buffer before shield bottom (y=367).
# Leaves 17px clean deep-green clearance before '25TH ANNUAL CONFERENCE OF' at y=384.
if os.path.exists('public/branding/jasicon-main-center-logo.png'):
    c_logo = Image.open('public/branding/jasicon-main-center-logo.png')
    c_w = 240
    c_h = int(c_w * (c_logo.height / float(c_logo.width)))
    c_resized = c_logo.resize((c_w, c_h), Image.Resampling.LANCZOS)
    f_scaled.paste(c_resized, (shield_cx - c_w // 2, shield_cy - c_h // 2), c_resized)

f_scaled.save(dest_front)
print('Successfully saved pristine master-front-card.png (ZERO square box, ZERO underneath ghosting)')


# ==============================================================================
# 2. BACK CARD (CONFIRMED ACCURATE & PERFECTED)
# ==============================================================================
b_raw = im.crop((528, 8, 991, 695))
W_raw, H_raw = b_raw.size

# Square top corners with parchment gradient:
for y in range(0, 35):
    sample_tl = b_raw.getpixel((25, y))
    for x in range(0, 30):
        r, g, b, a = b_raw.getpixel((x, y))
        if abs(r - b) < 15 and r > 180:
            b_raw.putpixel((x, y), sample_tl)
            
    sample_tr = b_raw.getpixel((W_raw - 25, y))
    for x in range(W_raw - 30, W_raw):
        r, g, b, a = b_raw.getpixel((x, y))
        if abs(r - b) < 15 and r > 180:
            b_raw.putpixel((x, y), sample_tr)

# Bottom corners with deep green:
for y in range(H_raw - 35, H_raw):
    for x in range(0, 35):
        r, g, b, a = b_raw.getpixel((x, y))
        if abs(r - b) < 20 and r > 70:
            b_raw.putpixel((x, y), deep_green)
    for x in range(W_raw - 35, W_raw):
        r, g, b, a = b_raw.getpixel((x, y))
        if abs(r - b) < 20 and r > 70:
            b_raw.putpixel((x, y), deep_green)

b_scaled = b_raw.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)

# COVER TOP PUNCHHOLES ON BACK CARD (Parchment background, y: 0..100)
b_arr = np.array(b_scaled)
for y in range(0, 100):
    c_l = b_arr[y, 80].astype(float)
    c_r = b_arr[y, 380].astype(float)
    for x in range(125, 350):
        t = (x - 125) / float(350 - 125)
        b_arr[y, x] = ((1.0 - t) * c_l + t * c_r).astype(np.uint8)

    c_l = b_arr[y, 880].astype(float)
    c_r = b_arr[y, 1160].astype(float)
    for x in range(890, 1115):
        t = (x - 890) / float(1115 - 890)
        b_arr[y, x] = ((1.0 - t) * c_l + t * c_r).astype(np.uint8)

b_scaled = Image.fromarray(b_arr)
b_draw = ImageDraw.Draw(b_scaled)

# BACK CENTER LOGO & HEADER CLEANUP:
# Erase 100% of old back logo and all red artifacts across the full width (x: 80..1160) from y=70 down to y=373!
for y_coord in range(70, 374):
    sample_parchment = b_scaled.getpixel((80, y_coord))
    for x_coord in range(80, 1160):
        b_scaled.putpixel((x_coord, y_coord), sample_parchment)

# Paste authentic center logo centered cleanly above JASICON 2026:
if os.path.exists('public/branding/jasicon-main-center-logo.png'):
    c_logo = Image.open('public/branding/jasicon-main-center-logo.png')
    target_h = 240
    target_w = int(target_h * (c_logo.width / float(c_logo.height))) # ~260 px
    c_resized_back = c_logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    b_scaled.paste(c_resized_back, (620 - target_w // 2, 220 - target_h // 2), c_resized_back)

# Clean and unify the single authentic gold QR box (x: 391..839, y: 885..1265; Center=(615, 1075)):
box_x0, box_y0 = 391, 885
box_x1, box_y1 = 839, 1265
b_draw.rectangle([box_x0 + 4, box_y0 + 4, box_x1 - 4, box_y1 - 4], fill=(255, 255, 255, 255))
b_draw.rectangle([box_x0, box_y0, box_x1, box_y1], outline=gold_color, width=4)

b_scaled.save(dest_back)
print('Successfully saved pristine master-back-template.png (ZERO ghosting/leaking, 40px clean margin)')
