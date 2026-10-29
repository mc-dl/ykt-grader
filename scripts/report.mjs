// 汇总 data/ 下所有 *.submitted.json，生成批次统计。
// 默认只输出匿名聚合（分数分布、成功/失败数），加 --with-names 才导出逐人明细。
// 用法: node scripts/report.mjs [--with-names] [--out data/report.json]
import fs from 'node:fs';
import path from 'node:path';
import { log, DATA_DIR } from './lib.mjs';

const withNames = process.argv.includes('--with-names');
const outIndex = process.argv.indexOf('--out');
const outFile = outIndex > -1 ? process.argv[outIndex + 1] : path.join(DATA_DIR, 'report.json');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.submitted\.json$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(DATA_DIR);
const rows = [];
for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    for (const row of data) rows.push({ ...row, source: path.relative(DATA_DIR, file) });
  } catch (err) {
    log('跳过损坏的日志', file, err.message);
  }
}

const byScore = {};
let saved = 0;
let failed = 0;
for (const row of rows) {
  if (row.ok) saved += 1;
  else if (row.ok === false) failed += 1;
  if (row.ok) byScore[row.score] = (byScore[row.score] || 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  sources: files.length,
  total: rows.length,
  saved,
  failedOrUnverified: failed,
  scoreDistribution: byScore,
  ...(withNames ? { students: rows } : {}),
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(report, null, 1), 'utf8');
log(JSON.stringify({ ...report, students: undefined }, null, 1));
log('写入:', outFile, withNames ? '（含逐人明细，勿提交）' : '（匿名聚合）');
