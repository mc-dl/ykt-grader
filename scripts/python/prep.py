"""把下载/导出的作答页规整成适合阅读的图片。

用法:
  python scripts/python/prep.py <folder> [--rot 270] [--rot-file "02=90,03=90"] [--split] [--width 1600] [--montage]

逐页：应用 EXIF 方向 → 顺时针旋转该页指定角度 → 缩放到目标宽度 →
切上下两半（--split，生成 00_a.jpg / 00_b.jpg）或写 00_norm.jpg。
--montage 额外生成 montage.jpg（带页码的缩略图拼版，便于快速浏览）。
"""
import argparse
import json
import os
import re

from PIL import Image, ImageDraw, ImageOps


def parse_map(text):
    out = {}
    if not text:
        return out
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        key, value = part.split("=")
        out[key.strip()] = int(value)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder")
    parser.add_argument("--rot", type=int, default=0)
    parser.add_argument("--rot-file", default="")
    parser.add_argument("--split", action="store_true")
    parser.add_argument("--width", type=int, default=1600)
    parser.add_argument("--montage", action="store_true")
    args = parser.parse_args()

    folder = args.folder
    rotmap = parse_map(args.rot_file)
    files = sorted(
        f
        for f in os.listdir(folder)
        if f.lower().endswith((".jpg", ".jpeg", ".png")) and not f.startswith("montage")
    )
    files = [f for f in files if re.match(r"^\d\d\.", f)]

    report = []
    thumbs = []
    for name in files:
        path = os.path.join(folder, name)
        base = os.path.splitext(name)[0]
        rot = rotmap.get(base, args.rot)
        image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        if rot:
            image = image.rotate(-rot, expand=True)
        width, height = image.size
        if width > args.width:
            image = image.resize((args.width, int(height * args.width / width)), Image.LANCZOS)
        report.append({"page": base, "rot": rot, "out_size": list(image.size)})

        if args.split:
            width, height = image.size
            for index, box in enumerate(
                [(0, 0, width, height // 2), (0, height // 2, width, height)]
            ):
                image.crop(box).save(
                    os.path.join(folder, f"{base}_{'ab'[index]}.jpg"), quality=88
                )
        else:
            image.save(os.path.join(folder, f"{base}_norm.jpg"), quality=88)

        thumb = image.copy()
        thumb.thumbnail((470, 470))
        thumbs.append((base, thumb))

    print(json.dumps(report, ensure_ascii=False))

    if args.montage and thumbs:
        cols = 2 if len(thumbs) > 1 else 1
        rows = (len(thumbs) + cols - 1) // cols
        cell_w = max(t.width for _, t in thumbs) + 16
        cell_h = max(t.height for _, t in thumbs) + 34
        sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
        draw = ImageDraw.Draw(sheet)
        for index, (base, thumb) in enumerate(thumbs):
            x = (index % cols) * cell_w + 8
            y = (index // cols) * cell_h + 26
            sheet.paste(thumb, (x, y))
            draw.text((x, y - 20), f"page {base}", fill="black")
        sheet.save(os.path.join(folder, "montage.jpg"), quality=85)
        print("montage", sheet.size)


if __name__ == "__main__":
    main()
