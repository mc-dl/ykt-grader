// 导出“已打分”花名册（姓名 / 网页学生标识 / 分数），并统计分数分布。
// 输出: data/roster.json
// 用法: node scripts/roster.mjs
//
// 说明：雨课堂姓名下方的数字是“网页学生标识”，不一定是学校学号。
// 该文件包含学生个人信息，已列入 .gitignore，不要提交到公开仓库。
import fs from 'node:fs';
import path from 'node:path';
import { withPage, log, selectFilter, readRate, DATA_DIR } from './lib.mjs';

await withPage(async (page) => {
  await selectFilter(page, '已打分');

  const rows = new Map();
  const collect = async () => {
    const batch = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.student-item')).map((el) => {
        const lines = el.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
        const scoreLine = [...lines].reverse().find((l) => /^\d{1,2}(\.\d+)?$/.test(l));
        return {
          name: lines[0] || '',
          sid: lines[1] || '',
          score: scoreLine ? Number(scoreLine) : null,
        };
      }),
    );
    for (const row of batch) if (row.sid) rows.set(row.sid, row);
  };

  await collect();
  for (let i = 0; i < 40; i += 1) {
    const atBottom = await page.evaluate(() => {
      const el = document.querySelector('.student-list');
      if (!el) return true;
      const before = el.scrollTop;
      el.scrollTop = Math.min(el.scrollTop + 600, el.scrollHeight);
      return el.scrollTop === before;
    });
    await page.waitForTimeout(350);
    await collect();
    if (atBottom) break;
  }

  const roster = Array.from(rows.values()).filter((r) => r.score !== null && r.score <= 10);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const out = path.join(DATA_DIR, 'roster.json');
  fs.writeFileSync(out, JSON.stringify(roster, null, 1), 'utf8');

  const dist = {};
  for (const r of roster) dist[r.score] = (dist[r.score] || 0) + 1;
  log(await readRate(page), '已收集:', roster.length);
  log('分数分布:', JSON.stringify(dist));
  log('写入:', out, '（含个人信息，勿提交）');
});
