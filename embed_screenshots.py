#!/usr/bin/env python3
"""
Replace base64 screenshots in demo.html with new ones from client/public/screenshots/.

Mapping: slide-N in demo.html corresponds to slide-NN.png in screenshots dir.
Slides with images: 1, 4, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27
Screenshots available: 01, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
"""
import re
import base64
import os

DEMO_PATH = "client/public/demo.html"
SCREENSHOTS_DIR = "client/public/screenshots"

# Mapping: slide number (1-based) -> screenshot filename
# Slides that have images in demo.html: 1, 4, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27
# Available screenshots: slide-01 through slide-27 (skipping 02, 03)
SLIDE_TO_SCREENSHOT = {
    1: "slide-01.png",
    4: "slide-04.png",
    6: "slide-06.png",
    7: "slide-07.png",
    8: "slide-08.png",
    9: "slide-09.png",
    13: "slide-13.png",
    14: "slide-14.png",
    15: "slide-15.png",
    16: "slide-16.png",
    17: "slide-17.png",
    18: "slide-18.png",
    19: "slide-19.png",
    20: "slide-20.png",
    21: "slide-21.png",
    22: "slide-22.png",
    24: "slide-24.png",
    25: "slide-25.png",
    26: "slide-26.png",
    27: "slide-27.png",
}

def load_screenshot_b64(filename):
    path = os.path.join(SCREENSHOTS_DIR, filename)
    if not os.path.exists(path):
        print(f"  WARNING: {path} not found, skipping")
        return None
    with open(path, "rb") as f:
        data = f.read()
    b64 = base64.b64encode(data).decode("ascii")
    # PNG files
    return f"data:image/png;base64,{b64}"

with open(DEMO_PATH, "r", encoding="utf-8") as f:
    html = f.read()

print(f"Original demo.html size: {len(html):,} bytes")

# Find all slide containers with id
slide_positions = [(m.start(), int(m.group(1))) for m in re.finditer(r'<div class="slide(?: active)?" id="slide-(\d+)">', html)]
print(f"Found {len(slide_positions)} slides")

# For each slide that needs a screenshot replacement, find the img tag and replace it
replacements = 0
new_html = html
offset = 0  # track position shift as we replace

for slide_idx, (orig_pos, slide_num) in enumerate(slide_positions):
    if slide_num not in SLIDE_TO_SCREENSHOT:
        continue
    
    screenshot_file = SLIDE_TO_SCREENSHOT[slide_num]
    new_src = load_screenshot_b64(screenshot_file)
    if new_src is None:
        continue
    
    # Find the next slide position
    next_slide_orig_pos = slide_positions[slide_idx + 1][0] if slide_idx + 1 < len(slide_positions) else len(html)
    
    # Work on the current html with offset
    pos = orig_pos + offset
    next_pos = next_slide_orig_pos + offset
    
    slide_chunk = new_html[pos:next_pos]
    
    # Find the img tag in this chunk
    img_match = re.search(r'(<img\s[^>]*src=")([^"]+)(")', slide_chunk)
    if not img_match:
        print(f"  Slide {slide_num}: no img tag found, skipping")
        continue
    
    old_src = img_match.group(2)
    old_len = len(old_src)
    new_len = len(new_src)
    
    # Replace in the full html
    img_start_in_chunk = img_match.start(2)
    img_end_in_chunk = img_match.end(2)
    
    abs_start = pos + img_start_in_chunk
    abs_end = pos + img_end_in_chunk
    
    new_html = new_html[:abs_start] + new_src + new_html[abs_end:]
    offset += new_len - old_len
    
    print(f"  Slide {slide_num}: replaced with {screenshot_file} ({len(new_src):,} chars b64)")
    replacements += 1

print(f"\nTotal replacements: {replacements}")
print(f"New demo.html size: {len(new_html):,} bytes")

with open(DEMO_PATH, "w", encoding="utf-8") as f:
    f.write(new_html)

print("Done! demo.html updated.")
