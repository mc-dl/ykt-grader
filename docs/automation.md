# 脚本手册

所有 Node 脚本都通过 [`scripts/lib.mjs`](../scripts/lib.mjs) 连接 Chrome，遵循同一套约定：

- 连接地址：`YKT_CDP_URL`（默认 `http://127.0.0.1:9222`）；
- 数据目录：`YKT_DATA_DIR`（默认 `./data`）；
- 出错时抛异常并以非 0 退出，不做静默重试；
- 不缓存元素索引，每次操作前重新读页面。

## 环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `YKT_CDP_URL` | `http://127.0.0.1:9222` | Chrome 调试地址 |
| `YKT_DATA_DIR` | `./data` | 附件、清单、日志根目录 |

## 总览

| 脚本 | 作用 | 读 | 写 |
|---|---|---|---|
| `status.mjs` | 列标签页、打印页面正文 | 页面 | 无 |
| `remaining.mjs` | 未打分队列与批改率 | 页面 | 无 |
| `roster.mjs` | 已打分名单 + 分布 | 页面 | `data/roster.json` |
| `harvest.mjs` | 批量抓取附件 | 页面 | `data/att/`、`data/manifest.json` |
| `grab.mjs` | 抓单个学生附件 | 页面 | `data/att/<sid>/` |
| `dlpdf.mjs` | 下载原始附件 | 页面 | `data/att/<sid>/src.*` |
| `pdfinfo.mjs` | 诊断作答区 DOM | 页面 | 无 |
| `submit.mjs` | 写评语 + 分数 | 页面、结果 JSON | `.submitted.json`、页面 |
| `verify.mjs` | 读回分数与评语 | 页面 | 无 |
| `fixscores.mjs` | 批量改分 | 页面、fixlist | 页面 |
| `report.mjs` | 聚合统计 | `.submitted.json` | `data/report.json` |

## Node 脚本

### `status.mjs`

```bash
node scripts/status.mjs
```

打印标签页清单与当前页面正文前 1500 字。**每次开工第一条命令**，用来确认连的是哪个页面、是否登录、批改率是多少。

### `remaining.mjs`

```bash
node scripts/remaining.mjs [--limit N]
```

会先点"未打分"筛选，再滚动收集全部可见学生。输出格式：

```
批改率: 43 / 167 未打分: 124
105000001   示例学生A   10-19/19:16
...
```

注意：切换筛选后列表内容会变，采集前必须确保筛选状态正确。

### `roster.mjs`

```bash
node scripts/roster.mjs
```

切到"已打分"，滚动收集姓名 / 网页标识 / 分数，写 `data/roster.json` 并打印分布。用于最后核对"操作次数 = 已改人数"。

`data/roster.json` 含个人信息，`.gitignore` 已覆盖，不要提交。

### `harvest.mjs`

```bash
node scripts/harvest.mjs [N=16] [skip=0]
```

从当前列表里取接下来 N 个**尚未在 manifest 中**的学生，串行点击、抓附件。支持三类形态：

1. `image`：`.answer__images img` / `.answer__text img` / `li.pic-view img` 的原图；
2. `pdf-canvas`：PDF 查看器画布，先把缩放调到 200% 再 `toDataURL`；
3. `iframe`：内嵌查看器，记录 URL，后续用 `dlpdf.mjs` 下载原文件。

每个学生写入一条 manifest 记录（姓名、标识、时间、目录、kind、文件列表）。重复运行会跳过已抓过的学生，中断可续。

### `grab.mjs`

```bash
node scripts/grab.mjs 105000001
```

单个学生的完整抓取（图片 + 画布）。会先核对当前选中学生，身份不一致直接中止。

### `dlpdf.mjs`

```bash
node scripts/dlpdf.mjs 105000001
```

点"下载原文件"并保存为 `data/att/<sid>/src.pdf`（或原扩展名）。配合：

```bash
python scripts/python/pdfrender.py data/att/105000001/src.pdf data/att/105000001
```

### `pdfinfo.mjs`

```bash
node scripts/pdfinfo.mjs
```

打印 `.anwser` 区域里的 iframe、canvas、链接、输入框、按钮。页面改版或附件读不出来时，用它找新的选择器，不要在 `harvest.mjs` 里盲改。

### `submit.mjs`

```bash
node scripts/submit.mjs data/results.json [--limit N]
```

流程（逐条）：

1. 切到"未打分"；
2. 跳过日志中已成功的 `sid`；
3. 校验分数 0–10、评语非空；
4. 隐藏残留的题干弹层；
5. 点击学生卡片，**核对当前选中学生的 `sid`**；
6. 填评语；
7. 精确写入分数（`.score-panel input` 或 `input[placeholder="请输入"]` + Enter），找不到输入框才退回按钮；
8. 读取批改率与"批改成功"提示；
9. 写 `<results>.submitted.json`。

判定成功的条件：出现"批改成功"**或**批改率变化。只满足其一也会标记为成功，但日志里保留 `toast` 与 `rate` 供复核。

> 为什么坚持用输入框而不是点按钮：按钮是文本匹配，`9` 会命中 `9.5`。历史批次就因此多给过 0.5 分。

### `verify.mjs`

```bash
node scripts/verify.mjs 105000001 105000002
```

切到"已打分"，逐个打开并打印当前学生、分数输入框的值、评语全文与长度。用来抽查"网页确实保存了"，而不是只看写回日志。

### `fixscores.mjs`

```bash
node scripts/fixscores.mjs fixlist.json
```

`fixlist.json` 形如 `[{"sid":"105000001","name":"示例学生A","score":9}]`。只在发现分数写错时使用；脚本会读当前分数，相同则跳过，不同才改。

### `report.mjs`

```bash
node scripts/report.mjs [--with-names] [--out data/report.json]
```

递归扫描 `data/` 下所有 `*.submitted.json`，输出总分、成功/失败数、分数分布。默认**不含姓名**；只有加 `--with-names` 才导出逐人明细（此时不要提交）。

## Python 脚本

需要 `pip install -r requirements.txt`。

### `orient.py`

```bash
python scripts/python/orient.py data/att/105000001
```

生成 `orient.jpg`：每页 × 0/90/180/270 度缩略图。先看它，确定每页该转多少度。

### `prep.py`

```bash
python scripts/python/prep.py data/att/105000001 \
  --rot-file "01=270,02=90" --split --width 1600 --montage
```

- `--rot`：全局顺时针角度；
- `--rot-file "页=角度,..."`：逐页覆盖；
- `--split`：上下切半，生成 `00_a.jpg` / `00_b.jpg`（可读性最好）；
- 不加 `--split`：生成 `00_norm.jpg`，供 `crop2.py` 裁剪；
- `--montage`：生成带页码的拼版，便于快速浏览。

### `crop2.py`

```bash
python scripts/python/crop2.py data/att/105000001 00 0.05 0.05 0.95 0.4 --out top
```

坐标是 0–1 的相对值；从 `00_norm.jpg` 裁剪并放大，输出 `00_z_top.jpg`。看不清指数、下标、单位时用它。

### `pdfrender.py`

```bash
python scripts/python/pdfrender.py src.pdf outdir --dpi 150
```

PDF → `00.png`、`01.png`…，默认 150 dpi。放大后可再走 `prep.py` / `crop2.py`。

## 推荐顺序

```bash
node scripts/status.mjs
node scripts/remaining.mjs --limit 10
node scripts/harvest.mjs 8
# 对每个 sid：orient → prep → crop（按需）
# 产出 data/results.json
node scripts/submit.mjs data/results.json
node scripts/verify.mjs <抽查的 sid>
node scripts/report.mjs
```

## 失败处理原则

- **NOT-IN-LIST**：当前筛选不是"未打分"，或该生已不在列表；先查筛选，再查是否已批。
- **身份不一致**：页面切人没完成或列表被重排；重新读页面，不要重试点击同一坐标。
- **找不到分数控件**：页面结构变了；用 `pdfinfo.mjs` 看输入框/按钮，改选择器后小样本验证。
- **批改率没变**：可能只是提示延迟；`verify.mjs` 读回确认，不要立刻重复提交。
- **manifest 有记录但目录为空**：抓取失败被记为 `error`；删掉 manifest 里该条记录后重跑，即可重新抓取。
