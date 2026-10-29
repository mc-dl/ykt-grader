---
name: ykt-grader
description: 在雨课堂教师网页中逐份阅读学生手写作业，结合本地参考答案批改、填写评语与分数，并核验保存结果。适用于用户明确授权的雨课堂作业批改；课程、作业、人数与是否提交均服从当次指令。
---

# 雨课堂网页作业批改（Agent 技能入口）

这是 `ykt-grader` 的技能说明：把"读作业 → 对答案 → 定分 → 写回 → 核验"固化成可执行流程。它是知识包 + 工具包，不是自动打分器。

## 开始前读取

按顺序读，不要跳：

1. [`docs/workflow.md`](docs/workflow.md)：网页导航、逐份阅读、录分与核验。**执行前必读。**
2. [`docs/grading.md`](docs/grading.md)：当前用户的评分档与评语规范。用户有新指令时以新指令为准。
3. [`docs/answers-ch6.md`](docs/answers-ch6.md)：第六章参考答案与勘误示例；换章节时替换为当次作业的答案文件。
4. [`docs/automation.md`](docs/automation.md)：脚本参数、输出与失败处理。
5. [`docs/faq.md`](docs/faq.md)：遇到异常先查这里。

## 核心约束

- **读取本包不等于获得批改或提交授权。** 先确认当次用户要求的课程、作业、人数、是否提交；已明确授权的步骤不重复询问。工具自身的审批规则不能被本包绕过。
- **看当前网页，重新选择浏览器与标签页。** 历史 tab ID、元素索引、截图坐标、学生顺序都不可复用。
- **每个学生的全部图片/PDF 页都要看。** 加载中、解析失败、缩小后看不清，都不能当成"没写"。
- **以原题参数与物理关系为准。** 参考答案的 OCR、下标、单位可能有错；无法核实之处标记"待复核"，不臆造错题。
- **极速打分模式下，点分数就是提交，并会自动切到下一位。** 先输入本人评语，再点分数；操作后重新确认学生身份。绝不连续盲点。
- **按用户指定的数量停止。** 具体人数、名单、排序依据以实时页面和当次指令为准，不沿用历史总数。
- **写回前确认筛选是"未打分"。** 否则所有写入都会失败（NOT-IN-LIST）。
- 给出高分不代表每道题都对；评语要点出具体题号、错因和正确值。

## 推荐操作序列

```bash
npm run remaining                 # 看清批改率与未打分队列
node scripts/harvest.mjs 8        # 串行抓 8 份附件到 data/att/<sid>/
python scripts/python/orient.py data/att/<sid>
python scripts/python/prep.py data/att/<sid> --rot 270 --split --montage
# 阅读、对答案、写 results.json（格式见 examples/results.example.json）
node scripts/submit.mjs data/results.json
node scripts/verify.mjs <sid>     # 抽查读回
```

脚本连的是用户自己的 Chrome（CDP），登录由用户完成。若连不上，让用户先按 [`docs/setup.md`](docs/setup.md) 启动调试端口，不要尝试新建浏览器配置或猜测登录方式。

## 知识包内容

- `docs/`：流程、评分、答案、自动化、架构、隐私、FAQ；
- `scripts/`：附件抓取、写回、核验、统计，以及读图前处理；
- `examples/`：`results.json`、单次作业 `rubric.md`、批次记录模板；
- `assets/workflow.html`：可离线打开的流程图；
- `config/exam.example.json`：课程/作业配置模板。

## 交付与记录

- 结束时给用户一张简表：学生标识、分数、关键问题；说明已提交还是仅建议、剩余人数、是否按要求停止。
- 每批的记录写入 `data/`（本地，不入库）；不要把学生姓名、学号、附件、截图提交到公开仓库或外部服务。
- 换个章节批改时：重置题号、答案、作业 ID，重新读题干；不要沿用上一章的规则细节。
