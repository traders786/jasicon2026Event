import os
from PIL import Image, ImageDraw
import numpy as np

src_path = 'C:/Users/KASHIF/.gemini/antigravity/brain/81a6a4e7-abab-465e-9c55-4c29beca0f91/.user_uploaded/media_1793904993455_58c00425.jpg'
dest_path = 'public/branding/master-front-card.png'

print(f'Loading master source from {src_path}...')
base = Image.open(src_path).convert('RGBA')
w, h = base.size
print(f'Dimensions: {w}x{h}')

draw = ImageDraw.Draw(base)

# 1. Fill photo inside slot:
# Gold frame border is at x=234..476, y=410..619
# We clear the interior x=239..471, y=415..614 with clean light ivory
draw.rounded_rectangle([239, 415, 471, 614], radius=12, fill=(255, 255, 255, 255))
# Redraw gold outline border around photo frame
draw.rounded_rectangle([234, 410, 476, 619], radius=16, outline=(197, 160, 89, 255), width=2)

# 2. Clean the name area:
# y=630..678, x=110..600 with clean ivory
draw.rectangle([110, 630, 600, 678], fill=(252, 250, 246, 255))

# 3. Clean the text inside the category pill:
# Green pill is at x=197..513, y=688..731. Text is x=260..450, y=696..724
green_pill_color = (11, 67, 51, 255)
for y in range(696, 725):
    for x in range(255, 455):
        p = base.getpixel((x, y))
        # If it's the white text inside the green pill
        if p[0] > 100 or p[1] > 120 or p[2] > 100:
            base.putpixel((x, y), green_pill_color)

# 4. QR Card Container:
# Clean QR slot (x=175..340, y=745..885)
draw.rounded_rectangle([175, 745, 340, 885], radius=10, fill=(255, 255, 255, 255))
draw.rounded_rectangle([178, 748, 337, 882], radius=8, outline=(197, 160, 89, 255), width=2)

# Clean Ticket pill area (x=381..551, y=826..854)
draw.rounded_rectangle([381, 826, 551, 854], radius=6, fill=(253, 246, 226, 255), outline=(197, 160, 89, 255), width=1)

# Clean below QR card: remove any stray blunder '3' or marks around y=908..935
draw.rectangle([100, 908, 610, 928], fill=(252, 250, 246, 255))

# 5. Soften yellowish tone in ivory card body (y=430 to 940)
# Vectorized numpy conversion
arr = np.array(base, dtype=np.float32)
# Ivory mask: where y is in card body, and color is yellowish ivory
y_indices, x_indices = np.indices((h, w))
body_mask = (y_indices >= 430) & (y_indices <= 940)
# Pixels that are ivory/yellowish (high red and green, lower blue)
ivory_mask = body_mask & (arr[:, :, 0] > 220) & (arr[:, :, 1] > 205) & (arr[:, :, 2] > 130)

# Boost blue channel towards 245 to lighten yellowish tone
blue_diff = 245.0 - arr[:, :, 2]
arr[:, :, 2] = np.where(ivory_mask, np.clip(arr[:, :, 2] + blue_diff * 0.45, 0, 255), arr[:, :, 2])
arr[:, :, 0] = np.where(ivory_mask, np.clip(arr[:, :, 0] * 0.99 + 255 * 0.01, 0, 255), arr[:, :, 0])
arr[:, :, 1] = np.where(ivory_mask, np.clip(arr[:, :, 1] * 0.99 + 255 * 0.01, 0, 255), arr[:, :, 1])

arr = arr.astype(np.uint8)
cleaned = Image.fromarray(arr)

# Save to public/branding/master-front-card.png
cleaned.save(dest_path)
print(f'Saved cleaned master front card to {dest_path}')

