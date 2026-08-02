#!/usr/bin/env python3
"""
Replace screenshots in demo.html with base64-encoded versions from client/public/screenshots/.
The demo.html uses <img> tags with data:image/... base64 content.
We need to map each slide number to the corresponding screenshot file.
"""
import re
import base64
import os

DEMO_PATH = "client/public/demo.html"
SCREENSHOTS_DIR = "client/public/screenshots"

with open(DEMO_PATH, "r", encoding="utf-8") as f:
    html = f.read()

print(f"demo.html size: {len(html):,} bytes")

# Find all img tags
img_pattern = re.compile(r'(<img\s[^>]*src=["\'])([^"\']+)(["\'][^>]*>)', re.DOTALL)
imgs = img_pattern.findall(html)
print(f"Total img tags found: {len(imgs)}")
for i, (pre, src, post) in enumerate(imgs[:10]):
    print(f"  [{i}] src={src[:80]}")

# Check what screenshots are available
screenshots = sorted(os.listdir(SCREENSHOTS_DIR))
print(f"\nAvailable screenshots: {screenshots}")

# Check slide structure — look for data-index or similar
slide_divs = re.findall(r'<div[^>]+data-index=["\'](\d+)["\']', html)
print(f"\nSlide data-index values: {slide_divs[:10]}")

slide_divs2 = re.findall(r'id=["\']slide-(\d+)["\']', html)
print(f"Slide id values: {slide_divs2[:10]}")

# Check for any existing screenshot references
existing_refs = re.findall(r'screenshots/slide-\d+\.png', html)
print(f"\nExisting screenshot refs: {existing_refs[:10]}")

# Count base64 images
b64_count = html.count("data:image/")
print(f"Base64 image count: {b64_count}")
