// 诊断：查看当前学生作答区的结构（图片 / PDF 查看器 / 下载链接 / 输入框）。
// 当 harvest 分类为 none 或 PDF 读不出来时使用。
// 用法: node scripts/pdfinfo.mjs
import { withPage, log } from './lib.mjs';

await withPage(async (page) => {
  const info = await page.evaluate(() => {
    const root = document.querySelector('.anwser') || document.body;
    const iframes = Array.from(document.querySelectorAll('iframe, embed, object')).map((f) => ({
      tag: f.tagName,
      src: (f.src || f.data || '').slice(0, 300),
    }));
    const canvases = Array.from(root.querySelectorAll('canvas')).map((c) => ({
      w: c.width,
      h: c.height,
      cls: String(c.className || ''),
    }));
    const links = Array.from(root.querySelectorAll('a')).map((a) => ({
      text: (a.innerText || '').trim().slice(0, 30),
      href: a.href.slice(0, 300),
      download: a.download,
    }));
    const inputs = Array.from(root.querySelectorAll('input')).map((i) => ({
      type: i.type,
      placeholder: i.placeholder,
      value: i.value,
    }));
    const buttons = Array.from(root.querySelectorAll('button, [class*=btn]'))
      .map((b) => (b.innerText || '').trim().slice(0, 16))
      .filter(Boolean)
      .slice(0, 40);
    return { iframes, canvases, links, inputs, buttons, text: root.innerText.slice(0, 600) };
  });
  log(JSON.stringify(info, null, 1));
});
