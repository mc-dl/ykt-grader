"""生成方向判断拼版：每页按 0/90/180/270 度各出一张缩略图。

用法: python scripts/python/orient.py <folder> [--thumb 300]
输出: <folder>/orient.jpg —— 行是页，列是顺时针旋转角度。
先看它，再决定 prep.py 的 --rot / --rot-file。
"""
import argparse
import os
import re

from PIL import Image, ImageDraw, ImageOps

ANGLES = [0, 90, 180, 270]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder")
    parser.add_argument("--thumb", type=int, default=300)
    args = parser.parse_args()

    folder = args.folder
    files = [
        f
        for f in sorted(os.listdir(folder))
        if re.match(r"^\d\d\.(jpg|jpeg|png)$", f, re.I)
    ]
    rows = []
    for name in files:
        image = ImageOps.exif_transpose(Image.open(os.path.join(folder, name))).convert("RGB")
        thumbs = []
        for angle in ANGLES:
            thumb = image.rotate(-angle, expand=True)
            thumb.thumbnail((args.thumb, args.thumb), Image.LANCZOS)
            thumbs.append(thumb)
        rows.append((os.path.splitext(name)[0], thumbs))

    if not rows:
        print("没有可用的页面（期望 00.jpg/01.png…）")
        return

    cell_w = max(t.width for _, row in rows for t in row) + 14
    cell_h = max(t.height for _, row in rows for t in row) + 26
    sheet = Image.new("RGB", (4 * cell_w, len(rows) * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    for col, angle in enumerate(ANGLES):
        draw.text((col * cell_w + 6, 4), f"{angle} deg", fill="black")
    for row_index, (name, row) in enumerate(rows):
        for col, thumb in enumerate(row):
            x = col * cell_w + 7
            y = row_index * cell_h + 22
            sheet.paste(thumb, (x, y))
            draw.text((x, y - 13), f"p{name}", fill="black")
    sheet.save(os.path.join(folder, "orient.jpg"), quality=85)
    print("orient.jpg", sheet.size)


if __name__ == "__main__":
    main()
