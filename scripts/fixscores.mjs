// 批量修正已保存的分数（用于发现分数写错后的返工）。
// 输入: fixlist.json = [{ "sid": "...", "name": "...", "score": 9 }, ...]
// 用法: node scripts/fixscores.mjs fixlist.json
import fs from 'node:fs';
import { withPage, log, selectFilter } from './lib.mjs';

const file = process.argv[2] || 'fixlist.json';
const list = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

await withPage(async (page) => {
  await selectFilter(page, '已打分');

  for (const item of list) {
    try {
      const card = page.locator('.student-item', { hasText: String(item.sid) }).first();
      if (!(await card.count())) {
        log('MISSING', item.sid, item.name);
        continue;
      }
      await card.click();
      await page.waitForTimeout(1200);
      const active = await page.evaluate(() => {
        const el = document.querySelector('.student-item.active, .student-item.is-active');
        return el ? el.innerText.replace(/\n+/g, ' | ') : '';
      });
      if (!active.includes(String(item.sid))) {
        log('MISMATCH', item.sid, active);
        continue;
      }
      const current = await page.evaluate(
        () => document.querySelector('.score-panel__value')?.innerText ?? null,
      );
      if (Number(current) === Number(item.score)) {
        log('OK-ALREADY', item.sid, item.name, current);
        continue;
      }
      await page.locator('.score-panel__display').first().click();
      await page.waitForTimeout(600);
      const input = page.locator('.score-panel__input, input[placeholder="请输入"]').first();
      await input.fill(String(item.score));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1600);
      log('FIXED', item.sid, item.name, current, '->', item.score);
    } catch (err) {
      log('FAIL', item.sid, item.name, err.message);
    }
  }

  await selectFilter(page, '未打分');
});
