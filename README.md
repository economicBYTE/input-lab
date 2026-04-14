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

## 部署

生产环境通过 `script/deploy.sh` 一键部署到服务器，使用 Nginx + Let's Encrypt HTTPS。

### 部署架构

| 项 | 值 |
|---|---|
| 服务器 | `124.222.230.225` |
| 登录用户 | `ubuntu`（需 `NOPASSWD` sudo 权限） |
| 远程目录 | `/var/www/type_practice` |
| 脚本目录 | `~/script/type_practice` |
| 域名 | `typinglab.online` / `www.typinglab.online` |
| Web 服务 | Nginx（独立 site 配置 `type_practice`） |
| 证书 | Certbot `certonly --webroot`，独立路径，不影响其他服务 |

### 初次部署前置条件

1. **DNS 解析**：`typinglab.online` 与 `www.typinglab.online` A 记录指向服务器 IP
   ```bash
   dig +short typinglab.online
   ```
2. **SSH 免密登录**
   ```bash
   ssh-copy-id ubuntu@124.222.230.225
   ```
3. **服务器 sudo 免密**：在服务器 `sudo visudo` 加一行
   ```
   ubuntu ALL=(ALL) NOPASSWD:ALL
   ```
   验证：
   ```bash
   ssh ubuntu@124.222.230.225 "sudo -n true && echo OK"
   ```
4. **端口 80 / 443 已开放**，且现有 nginx 不存在 `default_server` 抢占 `typinglab.online`
   ```bash
   ssh ubuntu@124.222.230.225 "nginx -T 2>/dev/null | grep -E 'server_name|listen|default_server'"
   ```

### 执行部署

```bash
./script/deploy.sh
```

脚本流程：本地 `npm install && npm run build` → 通过 sudo 创建并 chown `/var/www/type_practice` → scp 上传 `dist/` 与 `server_setup.sh` → 服务端 `sudo bash server_setup.sh`：

- 自动安装 nginx / certbot（如缺失）
- 首次：先起 HTTP 配置，`certbot certonly --webroot` 签发证书，再切换到完整 HTTP+HTTPS 配置
- 后续：检测到证书已存在，直接写入完整配置并 reload

幂等设计，可重复执行。

### 与其他服务的隔离

服务器上若已部署其他手动签发证书的站点，本脚本不会影响：

- **不使用** `certbot --nginx` 插件，不扫描或改写其他 server 块
- 证书独立存放于 `/etc/letsencrypt/live/typinglab.online/`
- nginx 配置独立为 `/etc/nginx/sites-available/type_practice`，仅创建本站点的 sites-enabled 软链
- `certbot renew` 仅续期 certbot 管理的证书，不会触碰手动证书

### 验证部署

```bash
curl -I https://typinglab.online        # 期望 HTTP/2 200
curl -I http://typinglab.online         # 期望 301 → https
```

### 修改部署目标

编辑 `script/deploy.sh` 顶部变量（`SERVER_IP` / `SERVER_USER` / `REMOTE_DIR`）和 `script/server_setup.sh` 顶部变量（`DOMAIN` / `WEBROOT`）即可。

## 文档

- [产品需求文档](docs/PRD.md)
- [技术架构文档](docs/技术架构.md)

## 开发计划

- [ ] MVP 版本：基础文档管理 + 打字练习 + 实时统计
- [ ] V1.0 版本：分类管理、历史记录、智能推荐
- [ ] V1.1 版本：后端服务、多设备同步

## License

MIT
