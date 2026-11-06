from PIL import Image, ImageDraw, ImageFont
import os

dest_dir = 'C:/Users/KASHIF/.gemini/antigravity/brain/81a6a4e7-abab-465e-9c55-4c29beca0f91'

# Load master templates
front_master = Image.open('public/branding/master-front-card.png').convert('RGBA')
back_master = Image.open('public/branding/master-back-template.png').convert('RGBA')

W, H = front_master.size # 1240 x 1748

# Helper to render category pill
def draw_category_pill(draw, text, top_pct=0.6625):
    # Pill: centered, width 44%, height 4.4% of H (77px)
    pill_w = round(W * 0.44)
    pill_h = round(H * 0.044)
    x0 = round((W - pill_w) / 2)
    y0 = round(H * top_pct)
    x1 = x0 + pill_w
    y1 = y0 + pill_h
    # Fill: #064B38, Border: #C5A059
    draw.rounded_rectangle([x0, y0, x1, y1], radius=round(pill_h / 2), fill=(6, 75, 56, 255), outline=(197, 160, 89, 255), width=4)
    
    # Text
    try:
        font = ImageFont.truetype('arialbd.ttf', 36)
    except:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = x0 + (pill_w - tw) // 2
    ty = y0 + (pill_h - th) // 2 - 4
    draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)

# Helper to render attendee name
def draw_name(draw, name, top_pct=0.6050):
    try:
        font = ImageFont.truetype('timesbd.ttf', 52)
    except:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), name, font=font)
    tw = bbox[2] - bbox[0]
    tx = (W - tw) // 2
    ty = round(H * top_pct)
    draw.text((tx, ty), name, fill=(15, 44, 35, 255), font=font)

# 1. RENDER CASE A: Dr. Rakesh Nene (No Photo, RN initials, FACULTY)
badge_nene = front_master.copy()
draw_nene = ImageDraw.Draw(badge_nene)

# Initials in frame:
# Frame is x: 32.25%, width: 35.5%, y: 39.02%, height: 19.22%
fx0 = round(W * 0.3225)
fy0 = round(H * 0.3902)
fw = round(W * 0.3550)
fh = round(H * 0.1922)
fx1 = fx0 + fw
fy1 = fy0 + fh
draw_nene.rounded_rectangle([fx0, fy0, fx1, fy1], radius=32, fill=(250, 248, 243, 255), outline=(197, 160, 89, 255), width=5)

try:
    font_init = ImageFont.truetype('timesbd.ttf', 130)
except:
    font_init = ImageFont.load_default()
bbox = draw_nene.textbbox((0, 0), 'RN', font=font_init)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
draw_nene.text((fx0 + (fw - tw) // 2, fy0 + (fh - th) // 2 - 12), 'RN', fill=(11, 67, 51, 255), font=font_init)

draw_name(draw_nene, 'DR. RAKESH NENE')
draw_category_pill(draw_nene, 'FACULTY')

# Ticket code
try:
    font_code = ImageFont.truetype('consola.ttf', 38)
except:
    font_code = ImageFont.load_default()
draw_nene.text((round(W * 0.54), round(H * 0.824)), 'JC-2026-0009', fill=(24, 35, 30, 255), font=font_code)

preview_nene_path = os.path.join(dest_dir, 'preview_dr_rakesh_nene_no_photo.png')
badge_nene.resize((620, 874), Image.Resampling.LANCZOS).save(preview_nene_path)
print('Saved preview_dr_rakesh_nene_no_photo.png')

# 2. RENDER CASE B: Dr. Rahul Singh (With Photo, DELEGATE)
badge_rahul = front_master.copy()
draw_rahul = ImageDraw.Draw(badge_rahul)

# Frame
draw_rahul.rounded_rectangle([fx0, fy0, fx1, fy1], radius=32, fill=(250, 248, 243, 255), outline=(197, 160, 89, 255), width=5)

# Place sample photo inside frame
photo_src = 'C:/Users/KASHIF/.gemini/antigravity/brain/81a6a4e7-abab-465e-9c55-4c29beca0f91/.user_uploaded/media_1793928154304_fc80c29c.jpg'
if os.path.exists(photo_src):
    p_img = Image.open(photo_src).crop((367, 436, 473, 560)).resize((fw - 10, fh - 10), Image.Resampling.LANCZOS)
    badge_rahul.paste(p_img, (fx0 + 5, fy0 + 5))
    # redraw gold border over photo edges
    draw_rahul.rounded_rectangle([fx0, fy0, fx1, fy1], radius=32, outline=(197, 160, 89, 255), width=5)

draw_name(draw_rahul, 'DR. RAHUL SINGH')
draw_category_pill(draw_rahul, 'DELEGATE')
draw_rahul.text((round(W * 0.54), round(H * 0.824)), 'EC-2026-0008', fill=(24, 35, 30, 255), font=font_code)

preview_rahul_path = os.path.join(dest_dir, 'preview_dr_rahul_singh_photo.png')
badge_rahul.resize((620, 874), Image.Resampling.LANCZOS).save(preview_rahul_path)
print('Saved preview_dr_rahul_singh_photo.png')

# 3. RENDER CASE C: Common Back Side (Sharp 90-degree rectangle, centered QR)
preview_back_path = os.path.join(dest_dir, 'preview_master_back_scientific_programme.png')
back_with_qr = back_master.copy()
qr_file = 'public/branding/scientific-programme-qr.png'
if os.path.exists(qr_file):
    qr_img = Image.open(qr_file).resize((280, 280), Image.Resampling.LANCZOS)
    back_with_qr.paste(qr_img, (475, 935))

back_with_qr.resize((620, 874), Image.Resampling.LANCZOS).save(preview_back_path)
print('Saved preview_master_back_scientific_programme.png')

