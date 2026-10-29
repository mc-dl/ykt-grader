// 公共工具：通过 CDP 连接一个已登录的 Chrome，并复用其中的雨课堂批改页。
//
// 环境变量：
//   YKT_CDP_URL    Chrome 远程调试地址，默认 http://127.0.0.1:9222
//   YKT_DATA_DIR   本地数据目录（附件、清单、日志），默认 ./data
//
// 设计约定：
//   1. 脚本不负责登录，登录态完全交给用户的 Chrome 配置；
//   2. 不缓存页面元素索引，每次操作前重新读取当前页面；
//   3. 所有会写网页的操作（submit/fixscores）都在写之前核对学生身份。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  throw new Error(
    '缺少依赖 playwright。请在项目根目录执行 `npm install`（或 `npm i -D playwright`）后重试。',
  );
}

export const CDP_URL = process.env.YKT_CDP_URL || 'http://127.0.0.1:9222';
export const DATA_DIR = path.resolve(process.env.YKT_DATA_DIR || 'data');
export const ATT_DIR = path.join(DATA_DIR, 'att');
export const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');

export function log(...args) {
  console.log(...args);
}

export function ensureDataDir() {
  fs.mkdirSync(ATT_DIR, { recursive: true });
}

/** 连接 CDP，找到雨课堂标签页，执行 fn(page, context)，结束后断开连接（不关闭浏览器）。 */
export async function withPage(fn) {
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL, { timeout: 20000 });
  } catch (err) {
    throw new Error(
      `无法连接 ${CDP_URL}。请确认 Chrome 以 --remote-debugging-port=9222 启动，且已登录雨课堂。\n原始错误：${err.message}`,
    );
  }
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error('CDP 连接成功，但没有可用的浏览器上下文');
    const pages = context.pages();
    const page =
      pages.find((p) => p.url().includes('yuketang.cn')) ||
      pages.find((p) => !p.url().startsWith('devtools://')) ||
      pages[0];
    if (!page) throw new Error('没有可用的标签页');
    page.setDefaultTimeout(30000);
    return await fn(page, context, browser);
  } finally {
    await browser.close().catch(() => {});
  }
}

/** 读取“批改率: a / b”。 */
export function readRate(page) {
  return page.evaluate(() => {
    const m = document.body.innerText.match(/批改率:\s*\d+\s*\/\s*\d+/);
    return m ? m[0] : '';
  });
}

/** 当前选中的学生（姓名/标识/提交时间）。 */
export function readActive(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.student-item.active, .student-item.is-active');
    if (!el) return null;
    const lines = el.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    return { name: lines[0] || '', sid: lines[1] || '', raw: lines.join(' | ') };
  });
}

/** 左侧学生列表（当前筛选条件下的可见项）。 */
export function listStudents(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.student-item')).map((el) => {
      const lines = el.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
      return {
        name: lines[0] || '',
        sid: lines[1] || '',
        time: lines.find((l) => /\d{2}-\d{2}\/\d{2}:\d{2}/.test(l)) || '',
        raw: lines.join(' | '),
      };
    }),
  );
}

/** 切换“未打分 / 已打分”筛选。 */
export async function selectFilter(page, label) {
  const target = page.getByText(new RegExp(`^${label}`)).first();
  await target.click();
  await page.waitForTimeout(1800);
}

/** 把左侧列表滚动到底，边滚边收集，返回去重后的学生数组。 */
export async function collectAllStudents(page) {
  const rows = new Map();
  const collect = async () => {
    for (const row of await listStudents(page)) {
      if (row.sid) rows.set(row.sid, row);
    }
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
  return Array.from(rows.values());
}
