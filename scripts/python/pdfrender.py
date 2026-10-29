"""把下载的 PDF 渲染成逐页 PNG，便于逐页阅读与核对。

用法: python scripts/python/pdfrender.py <pdf> <outdir> [--dpi 150]

依赖 PyMuPDF。若环境里只有旧包名 fitz，会自动回退。
"""
import argparse
import os

try:
    import pymupdf
except ImportError:  # 兼容旧版本
    import fitz as pymupdf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("outdir")
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    document = pymupdf.open(args.pdf)
    zoom = args.dpi / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    for index, page in enumerate(document):
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        out = os.path.join(args.outdir, f"{index:02d}.png")
        pixmap.save(out)
        print(out, pixmap.width, pixmap.height)
    print("pages:", document.page_count)


if __name__ == "__main__":
    main()
