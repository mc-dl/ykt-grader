// 下载当前选中学生的原始附件（PDF/图片），用于本地渲染核对。
// 用法: node scripts/dlpdf.mjs <网页学生标识>
// 输出: data/att/<sid>/src.pdf（或 src.jpg 等，保持原扩展名）
import fs from 'node:fs';
import path from 'node:path';
import { withPage, log, ATT_DIR } from './lib.mjs';

const sid = process.argv[2];
if (!sid) throw new Error('用法: node scripts/dlpdf.mjs <网页学生标识>');

const outDir = path.join(ATT_DIR, sid);
fs.mkdirSync(outDir, { recursive: true });

await withPage(async (page) => {
  const card = page.locator('.student-item', { hasText: sid }).first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.click({ timeout: 20000 });
  await page.waitForTimeout(3500);

  const active = await page.evaluate(() => {
    const el = document.querySelector('.student-item.active, .student-item.is-active');
    return el ? el.innerText.replace(/\n+/g, ' | ') : null;
  });
  log('当前学生:', active);
  if (!active || !active.includes(String(sid))) throw new Error('选中学生与目标不一致，已中止');

  const btn = page.locator('text=下载原文件').first();
  if (!(await btn.count())) throw new Error('页面上没有“下载原文件”按钮');
  await btn.waitFor({ timeout: 20000 }).catch(() => {});

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    btn.click(),
  ]);
  const suggested = download.suggestedFilename();
  const target = path.join(outDir, 'src' + (path.extname(suggested) || '.pdf'));
  await download.saveAs(target);
  log('saved', target, fs.statSync(target).size, 'bytes');
});
