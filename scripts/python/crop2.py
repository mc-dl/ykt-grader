"""从已规整的页面（<page>_norm.jpg）裁剪并放大局部。

用法: python scripts/python/crop2.py <folder> <page> <x0> <y0> <x1> <y1> [--width 1500] [--out name]
坐标是 0–1 的相对值，例如 0.1 0.05 0.9 0.4 表示左上角 10%/5% 到 90%/40% 的区域。
输出: <folder>/<page>_z_<name>.jpg
"""
import argparse
import os

from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder")
    parser.add_argument("page")
    parser.add_argument("x0", type=float)
    parser.add_argument("y0", type=float)
    parser.add_argument("x1", type=float)
    parser.add_argument("y1", type=float)
    parser.add_argument("--width", type=int, default=1500)
    parser.add_argument("--out", default="a")
    args = parser.parse_args()

    source = os.path.join(args.folder, f"{args.page}_norm.jpg")
    image = Image.open(source)
    width, height = image.size
    box = (
        int(width * args.x0),
        int(height * args.y0),
        int(width * args.x1),
        int(height * args.y1),
    )
    cropped = image.crop(box)
    ratio = args.width / cropped.width
    cropped = cropped.resize((args.width, int(cropped.height * ratio)), Image.LANCZOS)
    out = os.path.join(args.folder, f"{args.page}_z_{args.out}.jpg")
    cropped.save(out, quality=90)
    print(out, cropped.size)


if __name__ == "__main__":
    main()
