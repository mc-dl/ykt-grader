// 抓取当前选中学生的全部作答图片（含正文内嵌图与 PDF 画布）。
// 输出: data/att/<sid>/00.jpg ...
// 用法: node scripts/grab.mjs <网页学生标识>
import fs from 'node:fs';
import path from 'node:path';
import { withPage, log, ATT_DIR } from './lib.mjs';

const sid = process.argv[2];
if (!sid) throw new Error('用法: node scripts/grab.mjs <网页学生标识>');

const outDir = path.join(ATT_DIR, sid);
fs.mkdirSync(outDir, { recursive: true });

await withPage(async (page) => {
  const card = page.locator('.student-item', { hasText: sid }).first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.click();
  await page.waitForTimeout(3500);

  const active = await page.evaluate(() => {
    const el = document.querySelector('.student-item.active, .student-item.is-active');
    return el ? el.innerText.replace(/\n+/g, ' | ') : null;
  });
  log('当前学生:', active);
  if (!active || !active.includes(String(sid))) throw new Error('选中学生与目标不一致，已中止');

  // .anwser 是站点的类名（原文如此拼写），不要改成 .answer
  const srcs = await page.evaluate(() => {
    const root = document.querySelector('.anwser') || document.body;
    const urls = new Set();
    for (const img of root.querySelectorAll('img')) {
      const u = img.currentSrc || img.src;
      if (u && !u.startsWith('data:')) urls.add(u);
    }
    return Array.from(urls);
  });
  log('图片:', srcs.length);

  let index = 0;
  for (const url of srcs) {
    const ext = (url.match(/\.(png|jpe?g|webp)/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
    const file = path.join(outDir, String(index).padStart(2, '0') + '.' + ext);
    try {
      const resp = await page.request.get(url, { timeout: 60000 });
      const buf = await resp.body();
      if (buf.length > 5000) {
        fs.writeFileSync(file, buf);
        log('saved', file, buf.length);
        index += 1;
      }
    } catch (err) {
      log('fail', url.slice(0, 100), err.message);
    }
  }

  const canvases = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.anwser canvas')).map((c) => c.toDataURL('image/png')),
  );
  for (const [i, data] of canvases.entries()) {
    if (!data || data.length < 5000) continue;
    const file = path.join(outDir, `c${i}.png`);
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    log('saved canvas', file);
  }

  log('完成，共', index, '张图片 +', canvases.length, '个画布');
});
