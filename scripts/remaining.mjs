// 列出“未打分”学生，并显示当前批改率。
// 用法: node scripts/remaining.mjs [--limit N]
import { withPage, log, selectFilter, collectAllStudents, readRate } from './lib.mjs';

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) || Infinity : Infinity;

await withPage(async (page) => {
  await selectFilter(page, '未打分');
  const rate = await readRate(page);
  const rows = await collectAllStudents(page);
  log(rate, '未打分:', rows.length);
  for (const row of rows.slice(0, limit)) {
    log(`${row.sid}\t${row.name}\t${row.time}`);
  }
});
