// 核验已保存的成绩与评语：切到“已打分”，逐个打开学生卡片读回分数和评语。
// 用法: node scripts/verify.mjs <sid> [sid...]
import { withPage, log, selectFilter } from './lib.mjs';

const targets = process.argv.slice(2);
if (!targets.length) throw new Error('用法: node scripts/verify.mjs <sid> [sid...]');

await withPage(async (page) => {
  await selectFilter(page, '已打分');

  for (const sid of targets) {
    const card = page.locator('.student-item', { hasText: sid }).first();
    if (!(await card.count())) {
      log(sid, '在“已打分”列表中未找到');
      continue;
    }
    await card.click();
    await page.waitForTimeout(2200);
    const info = await page.evaluate(() => {
      const active = document.querySelector('.student-item.active, .student-item.is-active');
      const input = document.querySelector('.score-panel__input');
      const textarea = document.querySelector('textarea[placeholder="请输入评语"]');
      return {
        active: active ? active.innerText.replace(/\n+/g, ' | ') : null,
        score: input ? input.value : null,
        comment: textarea ? textarea.value : null,
        commentLen: textarea ? textarea.value.length : 0,
      };
    });
    log(JSON.stringify(info));
  }

  await selectFilter(page, '未打分');
});
