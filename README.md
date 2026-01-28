# TypePractice

专注于技术内容的打字练习工具，帮助开发者通过肌肉记忆强化 Git、SQL、JS 等技术命令的掌握。

## 功能特性

- 技术文档管理：创建、编辑、删除练习内容
- 逐字符打字练习：实时对照，错误强制重输
- 实时统计：KPM（击键/分钟）、错误率
- 练习结果汇总：时长、速度、错误字符列表

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8（推荐）

### 安装

```bash
pnpm install
```

### 开发

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

### 测试

```bash
pnpm test
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 |
| 语言 | TypeScript 5 |
| UI | Ant Design 5 |
| 状态 | Zustand |
| 存储 | IndexedDB (Dexie.js) |
| 构建 | Vite |

## 项目结构

```
src/
├── components/   # 通用组件
├── pages/        # 页面 (Documents, Practice)
├── hooks/        # 自定义 Hooks
├── services/     # 数据服务 (IndexedDB)
├── stores/       # 状态管理 (Zustand)
├── types/        # 类型定义
└── utils/        # 工具函数
```

## 文档

- [产品需求文档](docs/PRD.md)
- [技术架构文档](docs/技术架构.md)

## 开发计划

- [ ] MVP 版本：基础文档管理 + 打字练习 + 实时统计
- [ ] V1.0 版本：分类管理、历史记录、智能推荐
- [ ] V1.1 版本：后端服务、多设备同步

## License

MIT
