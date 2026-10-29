// 诊断：列出当前浏览器里的标签页，并打印目标页面开头一段文本。
// 用法: node scripts/status.mjs
import { withPage, log } from './lib.mjs';

await withPage(async (page, context) => {
  const pages = context.pages();
  log('标签页数量:', pages.length);
  for (const [i, p] of pages.entries()) {
    log(i, JSON.stringify({ url: p.url(), title: await p.title().catch(() => '') }));
  }
  const body = await page.locator('body').innerText().catch(() => '');
  log('--- 页面正文（前 1500 字）---');
  log(body.slice(0, 1500));
});
