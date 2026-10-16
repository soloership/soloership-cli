# SoloerShip CLI

[English](README.md) | 简体中文

npm 包名为 `create-soloership`，独立于模板和销售站点，无运行时 npm 依赖。要求 Node.js 22.12+、Git（使用 GitHub 源时）及模板指定的 pnpm 版本，当前为 10.18.2。

## 创建项目

```sh
pnpm create soloership my-project
```

默认源码为私有仓库 `soloership/soloership`。请先接受仓库访问邀请并配置 HTTPS Git 凭据。使用 GitHub CLI 时，可运行 `gh auth login` 和 `gh auth setup-git`。CLI 不提供购买、授权激活或仓库访问权限。

在新项目的父目录运行。CLI 会下载模板、设置项目名称、安装锁定依赖、生成配置和技能链接、调用模板初始化向导并启动开发。站点模式、服务、凭据和管理员创建由模板向导处理。

| 选项 | 用途 |
| --- | --- |
| `--mode saas|corporate|directory` | 预选站点模式 |
| `--no-start` | 初始化后不启动开发服务 |
| `--no-setup` | 安装依赖，不初始化或启动 |
| `--no-install` | 仅复制源码，输出后续命令 |
| `--yes --skip-admin --no-start` | 无交互初始化，不创建管理员或启动服务 |
| `--ref <tag>` | 选择已存在的 Git 分支或版本标签，不支持提交 SHA |
| `--help` | 查看命令帮助 |

无交互初始化后，可在新项目中使用 `pnpm admin:create` 创建管理员。没有默认密码。

## 本地模板

```sh
node /path/to/soloership-cli/bin/create-soloership.mjs my-project \
  --template /path/to/soloership
```

目标目录须位于模板目录之外。使用已发布的 CLI 时，也可在 `pnpm create soloership my-project` 后追加 `--template /path/to/soloership`。

## GitHub 源码

```sh
pnpm create soloership my-project --repo OWNER/REPO --ref EXISTING_TAG
```

`--ref` 未指定时使用仓库默认分支。交付时可选择已存在的版本标签以便复现。仓库参数只接受 GitHub `OWNER/REPO` 格式，使用 HTTPS 和本机 Git 凭据助手，不接受包含凭据的 URL。

可通过 `--repo` 或 `SOLOERSHIP_TEMPLATE_REPO` 覆盖默认仓库，或使用 `--template` 指定本地模板。访问失败时不会回退到其他源码。CLI 不接收、输出或保存令牌。

安装依赖和初始化会执行模板脚本，请仅使用可信源码。CLI 不部署应用或创建云资源。

## 导出与恢复

根目录白名单导出模板源码、配置示例、迁移、技能、测试和文档，排除运行/构建目录、Git 历史、环境密钥、数据库和私钥文件。源码中的符号链接会被拒绝，项目技能链接由 `skills:sync` 重建。文件过滤无法识别硬编码在源码中的凭据，发布模板前仍须审查源码。

新项目使用本地 URL、新资源名称、邮件预览及关闭的支付/AI。云账号标识、发件地址和模型端点会重置，不复制源项目的 `.dev.vars`、管理员或数据库。正常初始化生成独立的认证密钥。

已存在的目标目录一律拒绝，包括空目录。复制失败仅删除本次新建目录；安装或初始化失败保留项目，修复后在该目录继续。不会自动创建 Git 仓库或设置远程地址。

若出现锁文件版本不兼容，检查 `pnpm --version`，使用模板指定版本，不要用旧版 pnpm 重建锁文件。

## 验证

```sh
npm run check
node scripts/smoke.mjs /absolute/path/to/soloership
npm pack --dry-run
```

完整 smoke 测试在临时目录创建项目，验证依赖安装、本地 D1 初始化、配置、类型、构建、产物密钥扫描和管理员登录，结束后删除临时目录，不需要云账号。

现有五项测试覆盖实际 Git 标签检出（隔离的本地传输）、已有目录保护、密钥/运行文件排除等行为。注册表发布与真实 GitHub 权限应单独验证。

## 发布

发布前完成上述检查并审查 `npm pack --dry-run`。npm 包仅包含 CLI 与文档，不包含私有模板源码。使用有权限的 npm 账号运行：

```sh
npm publish --access public --registry=https://registry.npmjs.org/
```

CLI 保留 `UNLICENSED` 标记。公开分发 npm 包不代表授予开源许可或私有模板访问权限。

## 设计约束

CLI 仅包含参数入口和源码导出模块，服务配置交由模板完成。不增加第二套初始化向导、授权服务、插件框架、内置模板副本或自动更新系统。
