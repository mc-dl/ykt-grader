# 常见问题

## 连接与环境

### 连不上 Chrome（`无法连接 http://127.0.0.1:9222`）

按顺序查：

1. Chrome 是否带 `--remote-debugging-port=9222` 启动？普通方式打开的 Chrome 没有调试端口。
2. 是否用了**新的** `--user-data-dir`？在已运行的 Chrome 上追加参数不会生效，新进程会复用旧实例。
3. 端口是否被占用或改了？`curl http://127.0.0.1:9222/json/version` 有 JSON 才通。
4. 改了端口的话，设置 `YKT_CDP_URL` 后重试。

### 脚本打开的是登录页

调试用的 Chrome 配置目录是独立的，需要在**这个窗口**里重新登录一次雨课堂。不要尝试复制日常浏览器的 Cookie——那既不安全也容易失效。

### 有两个一模一样的批改页

重复点"去批改"会开新标签。`status.mjs` 会列出所有标签；关掉多余的，只留一个批改页，避免脚本在错误页面操作。

### `npm install` 卡在下载浏览器

脚本用 `connectOverCDP`，不需要 Playwright 自带的浏览器：

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

Windows PowerShell：

```powershell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"; npm install
```

## 页面操作

### 点课程后页面没变化

路由可能还没刷新。先读页面状态或截图确认，不要反复点。必要时刷新一次。

### "去批改"后原页面没变化

它通常**新开标签**。重新列标签页，找"主观题批改"，而不是在原页反复点。

### `NOT-IN-LIST`

脚本在"未打分"列表里找不到这个 `sid`。常见原因：

- 左侧筛选不是"未打分"（切一下再跑）；
- 该生已被批过（去"已打分"里找）；
- 列表只加载了一部分（`remaining.mjs` 会滚动，但网络慢时可能不够）；
- `results.json` 里的 `sid` 写错（用了学校学号而不是网页标识）。

### 找不到分数输入框

页面结构变了。运行 `node scripts/pdfinfo.mjs`，看当前页面有没有 `input[placeholder="请输入"]` / `.score-panel` 相关节点，再调整 `submit.mjs` 的选择器。改完先拿 1 个学生验证。

### 输入评语时提示"尚未打分，评语无法保存"

这是暂存状态，不是错误。按顺序：先填评语，再写分数并提交。

### 点完分数页面跳到另一个人

"极速打分"的正常行为：点分数即提交并自动切下一位。**不要**在新学生名下重输评语；先确认新学生是谁，再继续。

### 保存状态不明确

不要立刻重复提交。先看：学生卡片是否显示分数、批改人数是否 +1、批改率是否变化。必要时用 `node scripts/verify.mjs <sid>` 读回。

## 附件与 PDF

### PDF 显示 0% 或"加载中"

等它解析完再看。加载中不是空白作业，不能据此判缺答。

### PDF 里大片白色

可能是页边距。继续往下滚，并核对总页数；也可以 `dlpdf.mjs` 下载后本地渲染。

### PDF 在网页里不产生画布

部分查看器不暴露 canvas。用：

```bash
node scripts/dlpdf.mjs <sid>
python scripts/python/pdfrender.py data/att/<sid>/src.pdf data/att/<sid>
```

### 点击图片只弹出"圈画/批注"

这是批注菜单，不是放大。用 `prep.py` 切半页或 `crop2.py` 裁剪放大。

### 附件旋转了 90°

先 `orient.py` 生成方向拼版，确定每页角度，再：

```bash
python scripts/python/prep.py data/att/<sid> --rot-file "01=270,02=90" --split
```

### 抓下来的图片是缩略图

检查 `harvest.mjs` 是否命中了原图节点；`img.currentSrc` 通常比 `src` 更准。必要时用 `pdfinfo.mjs` 看真实 DOM，或 `dlpdf.mjs` 下载原文件。

## 评分与答案

### 参考答案和学生题纸参数不一致

以学生题纸为准。按题纸参数推导且自洽，就不判错，只在评语提醒核对参数。详见 [`answers-ch6.md`](answers-ch6.md) 第 4 节。

### 学生答案和参考答案标号相反

先看题图的实际标注，再判断。参考答案的 OCR 下标可能错位，不要机械照抄。

### 某些题看不清

标记"待复核"或请学生补拍，不要臆造对错，也不要写"全部正确"。

## 数据与仓库

### `data/` 会被提交吗

不会，`.gitignore` 已忽略。不要用 `git add -f` 绕过。

### 报告里能带姓名吗

`report.mjs` 默认只输出匿名聚合；`--with-names` 才导出明细，导出后不要提交。

### 怎么换章节

按 [`workflow.md`](workflow.md) 第 9 节的清单：重读题干、换答案文件、新建 `rubric.md`、清空/另建 `results.json`。
