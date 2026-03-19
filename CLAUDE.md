# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

TypePractice 是一个专注于技术内容的打字练习工具，帮助开发者通过肌肉记忆强化 Git、SQL、JS 等技术命令的掌握。

## 常用命令

```bash
pnpm install    # 安装依赖
pnpm dev        # 启动开发服务器
pnpm build      # 构建生产版本
pnpm test       # 运行测试
```

## 技术栈

- **框架**: React 18 + TypeScript 5
- **UI**: Ant Design 5
- **状态管理**: Zustand
- **存储**: IndexedDB (Dexie.js)
- **构建**: Vite
- **测试**: Vitest + @testing-library/react

## 架构设计

```
UI Layer (pages/components)
        ↓
State Layer (Zustand stores)
        ↓
Service Layer (services/)
        ↓
Data Layer (Dexie/IndexedDB)
```

**数据流**:
- 文档管理: 用户操作 → store action → service → IndexedDB → 更新 store → UI 重渲染
- 打字练习: 键盘输入 → practiceStore.handleInput() → 字符比对 → 更新统计 → 检查完成

## 核心模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 文档管理 | 文档 CRUD、列表展示 | `pages/Documents/`, `stores/documentStore.ts` |
| 打字练习 | 字符对照、输入处理、错误反馈 | `pages/Practice/`, `stores/practiceStore.ts` |
| 数据服务 | IndexedDB 操作封装 | `services/db.ts`, `services/*Service.ts` |
| 统计展示 | KPM、错误率计算 | `components/Stats/`, `utils/stats.ts` |

## 代码规范

- **命名**: 组件 PascalCase，函数/变量 camelCase，常量 UPPER_SNAKE_CASE
- **组件**: 函数组件 + Hooks，单文件不超过 200 行
- **类型**: 优先使用 interface，导出类型统一放 `types/`

## 关键文档

- [产品需求文档](docs/PRD.md) - 功能定义、数据结构、验收标准
- [技术架构文档](docs/技术架构.md) - 技术选型、架构设计、开发规范
- [用户故事索引](docs/user-stories/README.md) - 按优先级分类的用户故事

## 开发注意事项

- 文档内容限制为全英文字符
- 字符输入使用隐藏 input 捕获键盘事件
- KPM = 正确字符数 / 已用时间(分钟)
- 错误率 = 错误次数 / 总击键次数 × 100%
