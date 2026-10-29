# 环境准备

## 1. 需要什么

| 组件 | 版本 | 用途 |
|---|---|---|
| Chrome / Edge | 任意较新版本 | 承载雨课堂页面，提供 CDP 调试端口 |
| Node.js | ≥ 18 | 运行 `scripts/*.mjs` |
| Python | ≥ 3.10 | 读图前处理、PDF 渲染 |
| Playwright（Node 包） | 随 `npm install` | 通过 CDP 操作页面 |
| Pillow / PyMuPDF | 随 `pip install` | 图片旋转切页、PDF 转图 |

不需要安装浏览器驱动：脚本用 `connectOverCDP` 附着到你手动启动的 Chrome 上，不下载额外内核。

## 2. 启动带调试端口的 Chrome

关键点：**必须用独立的 `--user-data-dir`**。直接在已开的 Chrome 上加参数通常不生效，因为新进程会复用旧实例。

```powershell
# Windows PowerShell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\ykt-chrome"
```

```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir=/tmp/ykt-chrome

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/ykt-chrome
```

在这个窗口里登录雨课堂。**这个配置目录里有登录 Cookie，属于敏感数据**：不要提交，不要拷进仓库；不用时可以直接删掉整个目录。

验证端口是否可用：

```bash
curl http://127.0.0.1:9222/json/version
```

返回 JSON（含 `Browser` / `webSocketDebuggerUrl`）即成功。

> 端口冲突就换，例如 `9333`，然后设置 `YKT_CDP_URL=http://127.0.0.1:9333`。

## 3. 安装依赖

```bash
npm install
pip install -r requirements.txt
```

Node 依赖只有 `playwright` 一个。它默认会尝试下载浏览器；本项目的脚本**不需要**它下载的浏览器，如果下载很慢可以跳过：

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

## 4. 自检

```bash
node scripts/status.mjs
```

正常输出类似：

```
标签页数量: 2
0 {"url":"https://www.yuketang.cn/v2/web/index...","title":"雨课堂"}
1 {"url":"https://www.yuketang.cn/subject?...","title":"雨课堂-主观题批改"}
--- 页面正文（前 1500 字）---
批改率: 0 / 167
...
```

接着：

```bash
node scripts/remaining.mjs --limit 5
```

能打印出未打分学生即链路正常。若报"无法连接"，按 [`faq.md`](faq.md) 的"连不上 Chrome"逐项排查。

## 5. 数据目录

默认在项目根的 `data/`：

```
data/
├── att/<sid>/00.jpg ...   # 抓下来的作答附件
├── manifest.json          # 已抓取清单
├── roster.json            # 花名册（含个人信息）
├── results.json           # 你/Agent 产出的评分结果
├── results.submitted.json # 写回日志
└── report.json            # 匿名统计
```

想放到别处（例如加密盘）：

```powershell
$env:YKT_DATA_DIR = "D:\ykt-data"
```

`data/` 已在 `.gitignore` 中，任何时候都不要强制添加。

## 6. 每次开工前

1. Chrome 调试窗口还开着，雨课堂仍处于登录状态；
2. 批改页已打开，左侧能看到学生列表；
3. 运行 `node scripts/status.mjs` 确认选中的是批改页而不是首页；
4. 确认当次任务的人数、课程、作业与是否提交。
