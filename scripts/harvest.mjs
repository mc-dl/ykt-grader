// 批量抓取“未打分”队列里接下来 N 位学生的作答附件（串行，避免并发切人）。
// 输出:
//   data/att/<sid>/00.jpg|png ...
//   data/manifest.json  （追加式清单，记录 kind/files/时间）
// 用法: node scripts/harvest.mjs [N=16] [skip=0]
import fs from 'node:fs';
import path from 'node:path';
import { withPage, log, listStudents, selectFilter, ensureDataDir, ATT_DIR, MANIFEST_PATH } from './lib.mjs';

const limit = Number(process.argv[2] || 16);
const skip = Number(process.argv[3] || 0);

ensureDataDir();

await withPage(async (page) => {
  await selectFilter(page, '未打分');
  const students = await listStudents(page);
  log('列表人数:', students.length);

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    : { students: [] };
  const done = new Set(manifest.students.map((s) => s.sid));

  const batch = students.filter((s) => s.sid && !done.has(s.sid)).slice(skip, skip + limit);
  log('本次抓取:', batch.length);

  for (const student of batch) {
    const outDir = path.join(ATT_DIR, student.sid);
    fs.mkdirSync(outDir, { recursive: true });
    const entry = { ...student, dir: outDir, kind: 'none', files: [] };
    try {
      const card = page.locator('.student-item', { hasText: student.sid }).first();
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.click();
      await page.waitForTimeout(1800);

      const active = await page.evaluate(() => {
        const el = document.querySelector('.student-item.active, .student-item.is-active');
        return el ? el.innerText.replace(/\n+/g, ' | ') : '';
      });
      if (!active.includes(String(student.sid))) throw new Error('学生身份不一致: ' + active);

      const probe = await page.evaluate(() => {
        const root = document.querySelector('.anwser') || document.body;
        const imgs = Array.from(
          root.querySelectorAll('.answer__images img, .answer__text img, li.pic-view img'),
        ).map((i) => i.currentSrc || i.src);
        const canvases = Array.from(root.querySelectorAll('canvas')).map((c) => `${c.width}x${c.height}`);
        const zoom = (root.innerText.match(/\b(\d{2,3})%/) || [])[1] || '';
        const frames = Array.from(root.querySelectorAll('iframe, embed, object')).map((f) => f.src || f.data || '');
        return { imgs, canvases, zoom, frames };
      });

      if (probe.imgs.length) {
        entry.kind = 'image';
        for (const [i, src] of probe.imgs.entries()) {
          if (!src || src.startsWith('data:')) continue;
          const ext = (src.match(/\.(png|jpe?g|webp)/i) || [, 'jpg'])[1];
          const file = path.join(outDir, String(i).padStart(2, '0') + '.' + ext);
          const resp = await page.request.get(src, { timeout: 60000 });
          fs.writeFileSync(file, await resp.body());
          entry.files.push(path.basename(file));
        }
      } else if (probe.canvases.length) {
        entry.kind = 'pdf-canvas';
        // PDF 查看器默认缩放偏低，先调到 200% 再导出画布
        if (probe.zoom !== '200') {
          try {
            await page.locator('.anwser button', { hasText: /%$/ }).first().click();
            await page.waitForTimeout(600);
            await page.getByText('200%', { exact: true }).first().click();
            await page.waitForTimeout(3000);
          } catch (err) {
            log('zoom warn', err.message);
          }
        }
        const data = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.anwser canvas')).map((c) => c.toDataURL('image/png')),
        );
        for (const [i, d] of data.entries()) {
          const file = path.join(outDir, String(i).padStart(2, '0') + '.png');
          fs.writeFileSync(file, Buffer.from(d.split(',')[1], 'base64'));
          entry.files.push(path.basename(file));
        }
      } else if (probe.frames.length) {
        // 内嵌查看器：交给 dlpdf.mjs 下载原文件后本地渲染
        entry.kind = 'iframe';
        entry.frames = probe.frames.slice(0, 3);
      }

      entry.harvestedAt = new Date().toISOString();
      log('OK', student.sid, student.name, entry.kind, entry.files.length);
    } catch (err) {
      entry.kind = 'error';
      entry.error = err.message;
      log('FAIL', student.sid, student.name, err.message);
    }
    manifest.students.push(entry);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1), 'utf8');
  }
});
