# 仓库协作约定（给 Agent 的说明）

`ykt-grader` 是一个雨课堂网页批改工具箱：知识文档 + Playwright/CDP 脚本。先读 [`SKILL.md`](SKILL.md)，再按其中链接读 `docs/`。

## 目录约定

- `docs/` 只放**通用**流程与规则；课程/作业相关的临时信息放 `config/` 或 `data/`。
- `scripts/` 里的脚本必须保持"可诊断"：失败时打印明确原因，不吞异常。
- `examples/` 里的内容一律使用虚构学生（`示例学生A`、`105000001`），不得放真实数据。

## 修改规则

- 评分档的唯一来源是 `docs/grading.md`；单次作业的细则写进该次作业的 `rubric.md`，不要改公共档位来迁就一次批改。
- 改页面选择器前，先用 `node scripts/pdfinfo.mjs` 和 `node scripts/status.mjs` 看真实 DOM，小样本验证后再批量跑。
- 不要把某位学生的特批分数写成通用规则；案例只作历史记录。
- 提交前跑一遍 `node --check scripts/*.mjs` 与 `python -m py_compile scripts/python/*.py`。

## 隐私红线

任何情况下都不要提交：学生姓名/学号/网页标识、作业附件与截图、课程或考试的内部 ID、本机绝对路径、Chrome 用户目录、Cookie/Token。`data/` 与 `*.submitted.json` 已在 `.gitignore` 中，不要用 `git add -f` 绕过。
