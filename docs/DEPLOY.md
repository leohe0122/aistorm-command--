# 部署说明（自托管）

本文说明如何在任意 Linux 服务器上从空库部署 AIStorm Command，并把 `command.aistorm.com` 从 Manus 切换过来。不依赖任何托管平台；生产数据不迁移，新环境从空库重建。

## 1. 环境要求

| 组件 | 要求 |
|---|---|
| Node.js | 22.x（CI 使用 22） |
| pnpm | 10.4.1（由 `package.json` 的 `packageManager` 字段锁定，`corepack enable` 即可） |
| MySQL | 8.0，字符集 utf8mb4 |
| 反向代理 | Nginx 或 Caddy，负责 HTTPS |
| 文件存储 | 本地磁盘（需备份）或 S3 兼容对象存储 |

## 2. 配置

所有配置都是环境变量，完整列表见仓库根目录的 `.env.example`（只有变量名与说明）。

- **必需**：`NODE_ENV=production`、`DATABASE_URL`、`JWT_SECRET`（≥32 位）、`STORAGE_DRIVER`（`local` 或 `s3`，选 `s3` 时还需 `S3_BUCKET` 等）。
- **推荐**：`PUBLIC_APP_URL=https://command.aistorm.com`、`CRON_SECRET`。
- 服务启动时逐项检查，缺少必需项会直接退出并列出变量名（不打印值）。
- **AI 模型 Key 不走环境变量**：部署后由管理员在“系统设置 → AI 模型配置”中粘贴。每个部署用自己的 Key，服务不会读取 `OPENAI_API_KEY`。

生成随机密钥：

```bash
openssl rand -hex 32
```

## 3. 构建、迁移、启动

构建和数据库迁移需要完整依赖（含 devDependencies）；**运行只需要 dependencies**，`dist/index.js` 不再引用 vite 或任何开发依赖。

### 方式 A：在服务器上构建

```bash
git clone https://github.com/leohe0122/aistorm-command--.git command && cd command
corepack enable
pnpm install --frozen-lockfile
pnpm build                         # 产出 dist/index.js 与 dist/public/

# 迁移：在空库上依次执行 0000–0046 全部迁移
DATABASE_URL=... pnpm drizzle-kit migrate

# 建第一个管理员（只做一次）：密码只打印到当前终端
DATABASE_URL=... pnpm tsx scripts/create-admin.ts --email <管理员邮箱> --name <姓名>

pnpm prune --prod                  # 可选：删掉开发依赖
pnpm start                         # 等价于 NODE_ENV=production node dist/index.js
```

### 方式 B：在 CI 或构建机上构建，服务器只装生产依赖

把 `dist/`、`package.json`、`pnpm-lock.yaml`、`patches/` 拷到服务器：

```bash
pnpm install --prod --frozen-lockfile
NODE_ENV=production node dist/index.js
```

迁移与建管理员需要 `drizzle-kit` 和 `tsx`，在构建机上对生产库执行，或临时在服务器上做一次完整安装。

### 不要做的事

- 不要运行 `pnpm db:baseline` 或 `scripts/apply-migrations.mjs`：它们只用于 Manus 时期没有迁移登记表的旧库，新空库直接 `pnpm drizzle-kit migrate`。
- 不要运行 `pnpm db:push`：它会先 `drizzle-kit generate`，生产环境只需 `migrate`。
- 不要运行 `scripts/` 下的旧导入或种子脚本（`import-data*.mjs`、根目录 `seed_simple.mjs`）。

### 用 systemd 守护进程（示例）

```ini
# /etc/systemd/system/command.service
[Unit]
Description=AIStorm Command
After=network.target

[Service]
User=command
WorkingDirectory=/opt/command
EnvironmentFile=/etc/command/command.env   # 权限 600
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

健康检查：`GET /__startup`（不依赖数据库）、`GET /__version`（返回构建标记）。

## 4. 反向代理

服务监听 `PORT`（默认 3000），只在本机暴露，由反向代理对外提供 HTTPS。

**必须转发 `X-Forwarded-Proto`。**登录 Cookie（`email_session`）为 `SameSite=None; Secure; HttpOnly`；服务根据 `X-Forwarded-Proto: https` 判断请求是否为 HTTPS 并加上 `Secure`。缺少这个头时浏览器会丢弃 Cookie，表现为“登录成功后立刻回到登录页”。

Nginx：

```nginx
server {
    listen 443 ssl http2;
    server_name command.aistorm.com;
    # ssl_certificate / ssl_certificate_key ...

    client_max_body_size 60m;          # 文档上传上限 50MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 180s;       # 部分 AI 生成接口耗时较长
    }
}
server {
    listen 80;
    server_name command.aistorm.com;
    return 301 https://$host$request_uri;
}
```

Caddy（自动签发证书，默认转发 `X-Forwarded-Proto`）：

```caddy
command.aistorm.com {
    request_body {
        max_size 60MB
    }
    reverse_proxy 127.0.0.1:3000
}
```

## 5. 定时任务

每日简报与拜访提醒由服务器 crontab 调用受 `CRON_SECRET` 保护的接口，见 `docs/定时任务.md`。

## 6. 首次上线检查

1. 用 `create-admin.ts` 打印的密码登录，立即在右上角“修改密码”。
2. 系统设置 → AI 模型配置：粘贴本部署的模型 Key，点“测试连接”。
3. 团队管理：逐个新增成员。初始密码随机生成，只显示一次（已配置飞书时同时发飞书）。
4. 武器库上传一个文档，确认能打开、能预览（检验存储配置与 `PUBLIC_APP_URL`）。
5. 手动调用一次定时任务接口（`docs/定时任务.md` 第 3 节）。
6. 备份：每日 `mysqldump --single-transaction`；`STORAGE_DRIVER=local` 时同时备份 `STORAGE_LOCAL_DIR`。

## 7. 迁移产品方案资料

客户、商机等业务数据不迁移；**产品方案资料**（产品覆盖度配置、武器库文档与子文件夹、作战武器及附件、报价）连同原文件单独搬过来：

1. **旧环境导出（由 Manus 执行，只读）**：
   ```bash
   pnpm tsx scripts/export-product-materials.ts                    # 先只统计
   pnpm tsx scripts/export-product-materials.ts --out ./materials  # 导出记录与原文件
   tar czf materials.tar.gz -C ./materials .
   ```
   有文件下载失败时退出码为 2，失败清单写在 `manifest.json` 的 `failures` 中。
2. **把 `materials.tar.gz` 传到新服务器**并解压：`mkdir materials && tar xzf materials.tar.gz -C materials`。资料包含保密资料，传输与存放按内部资料处理，导入完成后删除。
3. **新环境导入**（第 3 节的迁移完成之后）：
   ```bash
   pnpm tsx scripts/import-product-materials.ts --dir ./materials            # 只检查：校验每个文件的 SHA-256，打印计划
   pnpm tsx scripts/import-product-materials.ts --dir ./materials --apply    # 导入并输出对账表
   ```
   - 任何文件校验不通过都会停止，不写入。
   - 中断后直接重跑即可，已导入的记录不会重复（进度记在资料包目录的 `import-state.json`）。
   - 不想要标记为演示数据的武器时加 `--skip-demo`。
   - 结束时逐个读回文件核对 SHA-256，对账表应显示“资料包 = 跳过 + 已导入”。
4. 登录后在武器库随机打开几份文档，确认内容与旧环境一致。

## 8. 域名切换（command.aistorm.com）

1. **提前 24–48 小时**把 `command.aistorm.com` 的 DNS TTL 调到 300 秒。
2. 在新服务器上完成第 3、4、6、7 节，申请好证书（Caddy 会在 DNS 生效后自动申请；Nginx 可先用 DNS 验证方式申请）。
3. 切换前用 `--resolve` 绕过 DNS 直接验证新服务器：
   ```bash
   curl -sS --resolve command.aistorm.com:443:<新服务器IP> https://command.aistorm.com/__version
   ```
   返回的 `build` 应为当前构建标记（本次为 `20261118-selfhost-v1`）。
4. 把 DNS 记录改到新服务器（A/AAAA，或 CNAME 到新负载均衡）。
5. 用 `https://command.aistorm.com/__version` 确认已命中新服务器；部分网络可能在 TTL 内仍访问旧地址。
6. 确认无误后，在 Manus 侧解除该域名绑定、停止旧部署。旧环境的数据不迁移。
7. 观察一周后把 TTL 调回常规值。

切换后所有人需要用邮箱和新密码重新登录：旧环境的会话与账号都不会带过来。

## 9. PWA（手机“添加到主屏幕”）

- 本次把 Service Worker 版本升级为 `20261118-selfhost-v1`。已安装的 PWA 在下次打开时会拉到新的 `index.html`（入口页始终走网络），注册新版本 SW、清理旧缓存，并出现“发现新版本”提示后自动刷新。
- 图标改为仓库内的 `/icons/*`。iOS 主屏幕图标在安装时就固定了，需要的话删除后重新“添加到主屏幕”才会更新图标；Android 通常会在几天内自动更新。
- 如果某台设备一直显示旧页面：在浏览器中打开 `https://command.aistorm.com` 并刷新一次，或删除主屏幕图标后重新添加。
- 以后每次发版若需要强制刷新客户端，同时修改 `server/_core/index.ts` 的 `BUILD_MARKER`、`client/index.html` 中 `sw.js?v=` 和 `client/public/sw.js` 的 `CACHE_NAME`。

## 10. CI

`.github/workflows/ci.yml` 在每个 PR 上：起一个空的 MySQL 8 → `pnpm drizzle-kit migrate` 并核对迁移条数与 `drizzle/meta/_journal.json` 一致 → `pnpm check` → `pnpm build` → `pnpm test` → 只装生产依赖启动打包后的服务，验证首页、图标、管理员登录（Secure Cookie）与定时任务鉴权。
