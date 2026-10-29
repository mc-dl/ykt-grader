// 把评分结果逐条写回雨课堂：填评语 → 输入分数 → 回车 → 核验“批改成功”。
//
// 输入 JSON: [{ "sid": "...", "name": "...", "score": 9.5, "comment": "..." }, ...]
// 输出日志: 同目录 <输入文件名>.submitted.json（已在其中成功的条目会自动跳过）
//
// 用法: node scripts/submit.mjs data/results.json [--limit N]
//
// 安全约定：
//   - 只处理“未打分”筛选下的学生；找不到就跳过，绝不盲点分数；
//   - 写之前核对当前选中学生的 sid；
//   - 分数通过“得分”输入框精确写入，避免 :has-text("9") 命中 9.5 的经典坑。
import fs from 'node:fs';
import path from 'node:path';
import { withPage, log, readRate, selectFilter } from './lib.mjs';

const file = process.argv[2];
if (!file) throw new Error('用法: node scripts/submit.mjs <results.json> [--limit N]');

const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex > -1 ? Number(process.argv[limitIndex + 1]) : Infinity;

const items = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
if (!Array.isArray(items) || !items.length) throw new Error('结果文件应为非空数组');

const logPath = file.replace(/\.json$/i, '') + '.submitted.json';
const done = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
let lastRate = '';

await withPage(async (page) => {
  await selectFilter(page, '未打分');
  lastRate = await readRate(page);

  let handled = 0;
  for (const item of items) {
    if (handled >= limit) break;
    const sid = String(item.sid);
    if (done.some((d) => String(d.sid) === sid && d.ok)) {
      log('skip (已提交)', sid, item.name);
      continue;
    }
    if (!item.comment || !String(item.comment).trim()) {
      log('SKIP 空评语', sid, item.name);
      continue;
    }
    const score = Number(item.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      log('SKIP 非法分数', sid, item.name, item.score);
      continue;
    }

    try {
      // 题干/批注浮层会拦截点击，先隐藏
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('.dialog-problem')) {
          el.style.pointerEvents = 'none';
          el.style.display = 'none';
        }
      });

      const card = page.locator('.student-item', { hasText: sid }).first();
      if (!(await card.count())) {
        log('NOT-IN-LIST', sid, item.name);
        continue;
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.click();
      await page.waitForTimeout(1600);

      const active = await page.evaluate(() => {
        const el = document.querySelector('.student-item.active, .student-item.is-active');
        return el ? el.innerText.replace(/\n+/g, ' | ') : '';
      });
      if (!active.includes(sid)) throw new Error('学生身份不一致: ' + active);

      const textarea = page.locator('textarea[placeholder="请输入评语"]').first();
      await textarea.fill(item.comment);
      await page.waitForTimeout(300);

      // 优先精确输入分数；找不到输入框时退回“满分/9.5”等按钮
      let input = page.locator('.score-panel input[placeholder="请输入"], input[placeholder="请输入"]').first();
      if (!(await input.count())) {
        await page.locator('.score-panel__display').first().click();
        await page.waitForTimeout(600);
        input = page.locator('input[placeholder="请输入"]').first();
      }
      if (await input.count()) {
        await input.click();
        await input.fill(String(score));
        await page.keyboard.press('Enter');
      } else {
        const label = score === 10 ? '满分' : String(score);
        const btn = page.getByRole('button', { name: label, exact: true }).first();
        if (!(await btn.count())) throw new Error('找不到分数控件: ' + label);
        await btn.click();
      }
      await page.waitForTimeout(2200);

      const rate = await readRate(page);
      const toast = await page.evaluate(() =>
        (document.body.innerText.match(/批改成功|保存失败|失败/g) || []).slice(0, 2),
      );
      const ok = toast.includes('批改成功') || rate !== lastRate;
      done.push({ ...item, ok, rate, toast, at: new Date().toISOString() });
      fs.writeFileSync(logPath, JSON.stringify(done, null, 1), 'utf8');
      log(ok ? 'SUBMIT' : 'CHECK', sid, item.name, score, '=>', rate, toast.join(','));
      lastRate = rate;
      handled += 1;
    } catch (err) {
      log('FAIL', sid, item.name, err.message);
      done.push({ ...item, ok: false, error: err.message, at: new Date().toISOString() });
      fs.writeFileSync(logPath, JSON.stringify(done, null, 1), 'utf8');
    }
  }
  log('处理结束，日志:', logPath);
});
