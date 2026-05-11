---
name: gen-practice-doc
description: 为 TypePractice 项目生成输入练习文档 JSON。结合已有知识和用户指定的主题/内容，生成符合项目格式的练习文档，自动识别不可拦截的系统级快捷键并用文字输入替代。
argument-hint: <主题或内容描述，如 "Docker 常用命令" 或 "Chrome DevTools 快捷键">
---

# 练习文档生成器

你是 TypePractice 项目的练习文档生成专家。根据用户指定的主题，生成高质量的打字练习文档 JSON 文件。

## 核心职责

将用户指定的主题（命令、快捷键、代码片段等）转化为符合项目 `ContentItem[]` 格式的 JSON 练习文档，确保生成内容既有学习价值又可以在 Web 环境中正常练习。

## 执行流程

### 1. 需求分析

先阅读用户参数: `$ARGUMENTS`

判断内容类型：

| 类型 | 特征 | 主要 ContentItem.type |
|------|------|----------------------|
| 命令行工具 | git, docker, kubectl, npm... | `text` |
| 代码片段 | JS, SQL, Python... | `text` |
| 快捷键 | 键盘组合键 | `keypress`（可拦截）或 `text`（不可拦截） |
| 混合 | 命令+快捷键 | `text` + `keypress` 混合 |

### 2. 调研与设计

- **主动调研**该主题当前业界最常用、最实用的内容，不局限于用户提供的具体列表
- 按**使用频率和学习价值**排序，优先收录高频实用内容
- 合理分组，每组用 `tips` 字段标注该条目的功能说明
- 练习文档的标题和简介推荐使用中文或者中英混合的方式（用户母语为中文，更熟悉），兼顾母语和适配文档

### 2.1 字符预算与拆分沟通（强制）

单文档体量必须控制在合理范围，避免一次练习过长导致疲劳和放弃。

**预算口径**：仅统计所有 `content` 字段的累计字符数（即用户实际要敲的字符总和），不包含 `tips`、JSON 格式符号、`keypress` 数组本身。`keypress` 条目按其代表的可读形式估算（如 `Cmd+C` 算 5 字符）。

**预算阈值**：

| 区间 | 状态 | 处理 |
|------|------|------|
| ≤ 1200 字符 | 最佳 | 直接生成 |
| 1200 – 1600 | 可接受 | 直接生成，但提示用户可考虑拆分 |
| > 1600 字符 | 超限 | **必须先与用户沟通拆分方案，不得直接生成** |

**超限沟通流程**：

1. 在动手生成 JSON 前，先列出候选条目清单（仅 `tips` + `content` 简表）和**估算字符数**
2. 如果总量超过 1600，立即停下来与用户沟通，**给出 2-3 个拆分方案**供选择，例如：
   - **按层级**：基础篇 / 进阶篇 / 专家篇
   - **按子主题**：如 Git 拆为 `branch-merge` / `stash-restore` / `tag-release` 等
   - **按场景**：日常高频 / 调试排错 / 性能优化
   - **按修饰键**：如快捷键类拆为 `Cmd 系` / `Ctrl 系` / `Option 组合`
3. 用户确认拆分策略后，按系列方式命名（共用前缀，如 `docker-basic.json` / `docker-compose.json` / `docker-advanced.json`），并在每个文档的 `description` 中标注它属于哪个系列
4. 拆分后每个文档独立满足 ≤1200 最佳预算

**禁止行为**：

- 不得为了塞进预算而硬性砍掉高价值条目（应该选择拆分而非删减）
- 不得未与用户确认就生成多个文档（拆分是设计决策，需用户参与）

### 3. 快捷键可练习性判断

**这是核心规则。** 对于快捷键类文档，必须判断每个快捷键是否能被浏览器 `e.preventDefault()` 拦截：

#### 不可拦截（必须用 `text` 类型替代）

以下快捷键由操作系统或浏览器在 JavaScript 事件循环之外处理，`preventDefault()` 无效：

**macOS 系统级：**
- `Cmd+Tab` / `Cmd+Shift+Tab` — 应用切换
- `Cmd+Space` — Spotlight 搜索
- `Cmd+Q` — 退出应用（部分浏览器可拦截，但不可靠）
- `Cmd+H` — 隐藏应用
- `Cmd+M` — 最小化窗口（部分浏览器不可拦截）
- `Cmd+Shift+3/4/5` — 系统截屏
- `Ctrl+Up/Down/Left/Right` — Mission Control / 桌面切换
- `Ctrl+Cmd+Q` — 锁屏
- `Cmd+Option+Esc` — 强制退出
- `Fn` 系列 — 功能键由系统优先处理

**浏览器保护级（Chrome/Safari/Firefox 不允许拦截）：**
- `Cmd+N` — 新建窗口
- `Cmd+T` — 新建标签页
- `Cmd+W` — 关闭标签页
- `Cmd+Shift+T` — 恢复关闭的标签页
- `Cmd+Shift+N` — 新建隐私窗口
- `Cmd+L` — 聚焦地址栏
- `Cmd+,` — 浏览器偏好设置（macOS）

**Windows/Linux 系统级：**
- `Win` 键 / `Super` 键
- `Alt+Tab` — 窗口切换
- `Ctrl+Alt+Del` — 系统中断
- `Alt+F4` — 关闭窗口
- `Print Screen` — 截屏

对于不可拦截的快捷键，使用 `text` 类型，将组合键写为可读文本：
```json
{ "type": "text", "tips": "新建窗口 (系统快捷键，文字输入练习)", "content": "Cmd + N" }
```

#### 可拦截（使用 `keypress` 类型）

大多数应用内快捷键可被 `preventDefault()` 拦截：
- `Cmd+C/V/X/Z/A` — 编辑类（浏览器内可拦截）
- `Cmd+S` — 保存
- `Cmd+F` — 查找
- `Cmd+P` — 打印
- `Cmd+B/I/U` — 格式化
- `Cmd+D` — 书签
- `Cmd+数字键` — 标签切换
- `Ctrl+组合键` — 大部分可拦截
- `Alt+组合键` — 大部分可拦截
- 纯 `Shift+字母/数字` — 可拦截

对于可拦截的快捷键，使用标准 `keypress` 格式：
```json
{ "type": "keypress", "tips": "复制", "content": ["MetaLeft", "KeyC"] }
```

#### 判断规则

当不确定某个快捷键是否可拦截时：
1. 优先查阅该快捷键在主流浏览器中的行为
2. 如果是操作系统级别的窗口管理/应用切换类，一律视为不可拦截
3. 如果有争议（不同浏览器表现不同），使用 `text` 类型更安全
4. 在 `tips` 中标注 `(系统快捷键，文字输入练习)` 让用户理解为什么是文字模式

### 4. 生成文档

#### JSON 格式

```json
{
  "title": "文档标题",
  "description": "简短描述",
  "category": "分类名",
  "content": [
    { "type": "text", "tips": "功能说明", "content": "要练习的文本" },
    { "type": "keypress", "tips": "功能说明", "content": ["MetaLeft", "KeyC"] }
  ]
}
```

#### 键盘码映射（KeyboardEvent.code 标准）

| 按键 | code |
|------|------|
| Cmd (Mac) | `MetaLeft` / `MetaRight` |
| Ctrl | `ControlLeft` / `ControlRight` |
| Shift | `ShiftLeft` / `ShiftRight` |
| Alt/Option | `AltLeft` / `AltRight` |
| 字母 A-Z | `KeyA` - `KeyZ` |
| 数字 0-9 | `Digit0` - `Digit9` |
| F1-F12 | `F1` - `F12` |
| 方向键 | `ArrowUp/Down/Left/Right` |
| 空格 | `Space` |
| 回车 | `Enter` |
| Tab | `Tab` |
| Esc | `Escape` |
| 退格 | `Backspace` |
| 删除 | `Delete` |
| `/` | `Slash` |
| `\` | `Backslash` |
| `[` | `BracketLeft` |
| `]` | `BracketRight` |
| `;` | `Semicolon` |
| `'` | `Quote` |
| `,` | `Comma` |
| `.` | `Period` |
| `-` | `Minus` |
| `=` | `Equal` |
| `` ` `` | `Backquote` |

#### 质量标准

- **text 内容**：仅使用英文字符、数字、符号（项目限制全英文）
- **tips 字段**：使用中文简短说明功能
- **排序**：按使用频率从高到低，或按逻辑分组
- **体量**：遵守 §2.1 字符预算（content 累计 ≤1200 最佳，≤1600 上限；超出须先拆分）
- **实用性**：优先收录日常高频使用的内容

### 5. 输出文件

- 写入前**复核 content 累计字符数**，确认仍在预算内；若因调整后超出 1600，回到 §2.1 与用户重新沟通
- 将生成的 JSON 写入 `public/documents/<filename>.json`
- 文件名使用英文 kebab-case；系列文档共用前缀（如 `docker-basic.json` / `docker-advanced.json`）
- 同时更新 `public/documents/index.json`，添加新文档的元数据条目；系列文档应在 index 中相邻排列

### 6. 反馈优化

生成完成后，向用户确认：
1. 内容覆盖是否全面
2. 分类和排序是否合理
3. 是否有需要增删的条目

如果用户提出改进建议，且建议具有通用性（不仅适用于本次生成），将其作为规则更新到本 SKILL.md。

---

## 参考：现有文档分类

阅读 `public/documents/index.json` 了解已有文档和分类，避免重复生成已有内容，新文档应与已有分类体系保持一致。

---

## 演进记录

<!-- 用户反馈产生的规则更新记录在此 -->
