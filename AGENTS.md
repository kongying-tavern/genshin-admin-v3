# AGENTS.md

面向 AI 编码代理的仓库工作指南。人类贡献者请先阅读 [README.md](./README.md)。

本文件适用于仓库根目录及全部子目录；若后续在子目录新增 `AGENTS.md`，以更具体的那份为准。改动代码前先阅读本文件、[docs/ai-bridge.md](./docs/ai-bridge.md) 以及目标文件所在目录的现有实现。

***

## 0. 实施前核对 Git 基线

1. 用 `git status --short --branch` 核对当前分支和工作区。以开发者指定的远端分支为目标，默认使用当前分支的上游（`@{upstream}`）。执行 `git fetch --no-tags <远端> refs/heads/<分支>` 抓取目标分支，成功后立即用 `git rev-list --left-right --count HEAD...FETCH_HEAD` 核对本地领先和落后的提交数。
2. 本地 `HEAD` 与目标分支最新提交不一致时，包括领先、落后或分叉，先向开发者报告双方的分支名、短提交号和领先或落后的数量。等开发者确认以哪个提交为基准，再修改文件或更新本地分支。开发者已明确指定实施基线时，沿用该确认。
3. 无法确定目标分支或抓取失败时，说明远端 `HEAD` 尚未验证，等开发者确认实施基线。

***

## 1. 项目速览

- **项目**：空荧酒馆原神地图点位后台（`genshin-admin-v3`，产品名「空荧后厨」）。
- **形态**：单入口 SPA，没有路由拆分。登录、点位弹窗、点位表单、设置、系统管理页均以弹窗、窗口、侧边栏形式挂在 [src/HomePage.vue](./src/HomePage.vue)。
- **技术栈**：Vue 3.5、TypeScript 6、Vite 8、Pinia 2、Element Plus 2、deck.gl 9、Dexie 3、rxjs、alova。
- **运行要求**：Node.js >= 24，pnpm >= 10。
- **包管理**：只使用 pnpm，仓库包含 `pnpm-lock.yaml`；不要改用 npm/yarn。

***

## 2. 常用命令

| 命令                                                    | 用途                         | 注意                           |
| ----------------------------------------------------- | -------------------------- | ---------------------------- |
| `pnpm install --frozen-lockfile`                      | 按锁文件安装依赖                   | CI 同款                        |
| `pnpm dev`                                            | 启动 Vite 开发服务器              | 默认 `http://localhost:9000/`  |
| `pnpm build`                                          | 生产构建                       | 构建前建议先跑 typecheck            |
| `pnpm build:stage` / `pnpm build:dev`                 | stage / development 模式构建   | 视任务需要                        |
| `pnpm preview` / `pnpm preview:stage`                 | 预览构建产物                     | 默认 `http://localhost:13101/` |
| `pnpm typecheck`                                      | `vue-tsc --build --force`  | 提交前必须通过                      |
| `pnpm lint`                                           | oxlint                     | 仓库存在历史 warning，关注 **error**  |
| `pnpm format`                                         | oxfmt 全仓库格式化               | 见下方「格式化注意事项」                 |
| `pnpm format:check`                                   | 格式检查                       | 仓库存在历史不通过文件，勿顺手全量格式化         |
| `pnpm test:run --project unit`                        | 快速单元测试                     | 本地首选                         |
| `pnpm test:run --project unit --project api-contract` | CI 同款安全测试                  | 不发起真实后端写操作                   |
| `pnpm test:api`                                       | API contract + integration | **会连接 dev 后端并写入/清理真实数据**     |
| `pnpm test:parity*`                                   | Java/Rust 后端协议对齐专项         | 依赖外部环境，非日常必跑                 |

### 格式化注意事项

- `pnpm format:check` 当前存在**历史遗留**不通过文件（如 `tests/api/parity/**`、`vitest.parity.config.ts` 等）。不要为了“修格式”而全仓库重格式化或修改与任务无关的文件。
- 只格式化本次改动文件：
  ```bash
  pnpm exec oxfmt --write <changed-files...>
  pnpm exec oxfmt --check <changed-files...>
  ```

### 环境变量

- 仓库只提交模板 `.env.example`，不再提交 `.env` / `.env.<环境>` 实体配置。
- 所有配置由 `.env.<环境>.local` 提供，例如 `.env.development.local`、`.env.test.local`、`.env.production.local`；按 `.env.example` 复制后填写，**不要提交**。
- 后端前置账号、接口地址、WebSocket 地址等敏感值不要写入源码、测试快照或文档。

***

## 3. 架构地图

| 区域         | 入口/关键文件                                                                | 说明                                                             |
| ---------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| 应用启动       | [src/main.ts](./src/main.ts)                                           | 创建 Pinia、安装插件、初始化用户/系统配置/存档、挂载应用；AI 桥接在此动态加载                   |
| 根组件        | [src/App.vue](./src/App.vue)                                           | 路由出口、启动时处理邀请码 query                                            |
| 主页面        | [src/HomePage.vue](./src/HomePage.vue)                                 | 地图、弹窗 Provider、窗口 Provider、侧边栏、点位弹窗/控制器、登录弹窗                   |
| 路由         | [src/router/index.ts](./src/router/index.ts)                           | 只有 `/:pathMatch(.*)` 兜底路由，**不要擅自拆分路由**                         |
| 全局弹窗       | `src/components/AppDialog/`                                            | `GlobalDialogService` + `context` + Provider；队列/afterClosed 语义 |
| 窗口系统       | `src/components/AppWindow/`                                            | 应用注入 `WindowContext`，地图宿主测量边界并注册 Teleport 挂点                    |
| 设置/用户中心/公告 | `src/components/AppSettings/`、`AppUserInfo/`、`AppNotice/`              | 设置页签由 `preferenceStore.settingActivedKey` 控制                   |
| 点位 UI      | `src/components/MapMarkerPopover/`、`MarkerModifyer/`、`MapContextMenu/` | 点位弹窗、编辑/新增表单、右键菜单                                              |
| 地图包        | `src/packages/map/`                                                    | deck.gl 图层、视口、地图交互                                             |
| 状态         | `src/stores/`                                                          | Pinia setup stores；管理器统一用 `useManager`（进度/阶段/定时更新）             |
| 本地数据库      | `src/database/`、`src/worker/`                                          | Dexie、IDB/Service Worker、Socket Worker                         |
| API        | `src/api/`                                                             | alova 生成客户端、oauth、protobuf、资源上传；生成文件不要手改                       |
| 共享层        | `src/shared/`                                                          | 枚举、injection key、MapSubject、权限、localStorage key                |
| 工具         | `src/utils/`                                                           | Logger、EventBus、Zip、Worker helper 等                            |
| 测试         | `tests/`                                                               | Vitest `unit` / `api-contract` / `api-integration` 三个 project  |
| AI 桥接      | `src/ai/`                                                              | 见下方「AI 页面句柄能力索引」                                               |

### 不要随手修改的生成文件

- `src/api/alova/apiDefinitions.ts`
- `src/api/alova/createApis.ts`
- `src/api/alova/globals.d.ts`
- `src/api/protobuf/compiled.js` / `compiled.d.ts`

需要更新时运行 `pnpm proto:build` 或按接口生成流程处理，并核对生成命令。

***

## 4. 代码约定

- 使用 `@/` 别名指向 `src/`；`types/*` 指向 `types/`。
- Vue/Pinia 组合式 API 通过 `unplugin-auto-import` 自动导入；新 `.ts` 模块也可直接使用 `ref/computed/watch/onMounted` 等。类型导入使用 `import type`（`verbatimModuleSyntax` 开启）。
- TypeScript：`strictNullChecks`、`noUnusedLocals`、`checkJs`；避免 `any`，优先 `unknown` + 收窄。
- 代码风格：oxfmt（100 列、2 空格、无分号、单引号、尾逗号）；跟随文件现有风格。
- 注释、用户可见文案、文档使用中文；标识符/命令 id 使用英文。
- 新增依赖前先确认是否已有可复用依赖；本项目已包含 lodash、rxjs、ajv、dayjs 等。
- 不要引入路由拆分、全局状态框架替换、UI 框架替换等大改动，除非任务明确要求。

### 提交约定

- AI 每次完成修改并通过必要检查后，应在回复前自动创建本地 Git 提交。用户指定提交安排时，以用户要求为准。
- 提交前核对工作区和暂存区。提交范围仅包含本次任务的改动，独立主题可以分别提交。
- 提交信息遵循 [Git 提交信息规范](./.trae/rules/git-commit-message.md)，使用 `type(scope): emoji 中文说明` 格式，按类型选择 emoji，并遵守中英、中数混排的间距规则。
- 默认在当前工作分支提交。推送需用户另行授权。

### 测试约定

- 单元测试放在 `tests/`，文件名 `*.test.ts`，由 `unit` project 收集。
- `tests/setup.ts` 已补齐 jsdom 缺失的 `ResizeObserver`、`matchMedia`、`Worker` 等；不要重复 mock。
- 纯逻辑（模式解析、序列化、校验、事件、注册表）优先做成可注入依赖的工厂，避免在单测里启动真实 Pinia/Dexie/Worker/网络。
- 接口集成测试会真实读写 dev 后端，默认不要执行；需要时确认环境变量和清理逻辑。
- 修改 AI 桥接时，同步补 `tests/ai/*.test.ts`。
- **后端迁移至 Rust 的工作尚未完整**：运行时行为以 Java 后端为准。`tests/api/parity/**`、`pnpm test:parity*` 等 Java/Rust 差异对比属于后端专项，与前端业务无关；改前端功能时**不要**去验证 Java 与 Rust 的差异性，只有在任务明确涉及后端协议/迁移时才执行。

***

## 5. AI 页面句柄能力索引（新增）

> 目标：让 AI 不依赖截图、点击模拟，直接读取页面状态、打开弹窗/窗口/表单、调用页面能力。
> 对外文档：[docs/ai-bridge.md](./docs/ai-bridge.md)。

### 5.1 入口与启用

- 全局对象：`window.__MAP_AI__`
- 启动状态：`document.documentElement.dataset.aiBridge`（`booting` / `read` / `write` / `error`；关闭时无属性）
- 协议：`1.0.0`，schemaVersion `1`
- 模式优先级：`?aiBridge=...` > `localStorage['__map_ai_bridge']` > `VITE_AI_BRIDGE` > DEV 默认 `write` / 生产默认 `off`
- 入口命令：
  ```js
  __MAP_AI__.help()
  __MAP_AI__.manifest()
  await __MAP_AI__.call('app.snapshot', { sections: ['auth', 'ui', 'datasets'] })
  ```
- 两种调用方式：
  - `call(command, params)`：返回 `{ ok, data | error, meta }`，不抛业务异常。
  - 命名空间直调：`await __MAP_AI__.datasets.list()`，失败抛 `MapAiError`。

### 5.2 源码索引

| 能力                     | 关键文件                                                                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 安装入口 / 全局挂载            | [src/ai/install.ts](./src/ai/install.ts)、[src/main.ts](./src/main.ts)                                                                                                                                                                        |
| 全局契约 / 类型              | [src/ai/types.ts](./src/ai/types.ts)、[types/ai-bridge.d.ts](./types/ai-bridge.d.ts)                                                                                                                                                          |
| 命令执行 / envelope / 命名空间 | [src/ai/registry.ts](./src/ai/registry.ts)                                                                                                                                                                                                   |
| 模式解析                   | [src/ai/mode.ts](./src/ai/mode.ts)                                                                                                                                                                                                           |
| 参数校验 / JSON Schema     | [src/ai/validate.ts](./src/ai/validate.ts)                                                                                                                                                                                                   |
| 安全序列化 / 脱敏             | [src/ai/sanitize.ts](./src/ai/sanitize.ts)                                                                                                                                                                                                   |
| 事件缓冲 / waitFor         | [src/ai/events.ts](./src/ai/events.ts)                                                                                                                                                                                                       |
| 句柄/表单注册表               | [src/ai/bindings.ts](./src/ai/bindings.ts)                                                                                                                                                                                                   |
| 静态句柄实现                 | [src/ai/capabilities.ts](./src/ai/capabilities.ts)                                                                                                                                                                                           |
| 快照构建                   | [src/ai/snapshot.ts](./src/ai/snapshot.ts)、[src/ai/appSnapshot.ts](./src/ai/appSnapshot.ts)                                                                                                                                                  |
| help / manifest        | [src/ai/help.ts](./src/ai/help.ts)                                                                                                                                                                                                           |
| 命令组装                   | [src/ai/commands/index.ts](./src/ai/commands/index.ts)                                                                                                                                                                                       |
| 数据库状态同源                | [src/stores/datasetStatus.ts](./src/stores/datasetStatus.ts)                                                                                                                                                                                 |
| 设置/用户中心/点位表单打开         | [src/components/AppSettings/open.ts](./src/components/AppSettings/open.ts)、[src/components/AppUserInfo/open.ts](./src/components/AppUserInfo/open.ts)、[src/components/MarkerModifyer/actions.ts](./src/components/MarkerModifyer/actions.ts) |
| 窗口定义与句柄                | [windowOptions.ts](./src/components/AppSiderMenu/windowOptions.ts)、[windowCapabilities.ts](./src/components/AppSiderMenu/windowCapabilities.ts)                                                                    |
| 弹窗状态读取                 | [src/components/AppDialog/state.ts](./src/components/AppDialog/state.ts)                                                                                                                                                                     |
| 单元测试                   | [tests/ai](./tests/ai)                                                                                                                                                                                                                       |

### 5.3 命令组索引

完整参数/返回值以 `__MAP_AI__.manifest().commands` 为准，`app.help()` 生成 Markdown。

| 组           | 命令                                                                                                              | 源码                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `app`       | `app.info`、`app.help`、`app.manifest`、`app.snapshot`、`app.ping`                                                  | [commands/app.ts](./src/ai/commands/app.ts)             |
| `ui`        | `ui.surfaces.list/get/open/close`、`ui.notices.list/read`                                                        | [commands/ui.ts](./src/ai/commands/ui.ts)               |
| `auth`      | `auth.status`、`auth.login`、`auth.logout`                                                                        | [commands/auth.ts](./src/ai/commands/auth.ts)           |
| `datasets`  | `datasets.list`、`datasets.get`、`datasets.update`、`datasets.waitIdle`                                            | [commands/datasets.ts](./src/ai/commands/datasets.ts)   |
| `markers`   | `markers.list`、`markers.get`、`markers.focus`、`markers.create`、`markers.update`、`markers.delete`、`markers.tweak` | [commands/markers.ts](./src/ai/commands/markers.ts)     |
| `resources` | `resources.areas`、`resources.items`、`resources.itemTypes`、`resources.icons`、`resources.links`                   | [commands/resources.ts](./src/ai/commands/resources.ts) |
| `map`       | `map.state`、`map.setView`、`map.setArea`、`map.filter.get`、`map.filter.setBasic`                                  | [commands/map.ts](./src/ai/commands/map.ts)             |
| `archive`   | `archive.state`、`archive.mark`、`archive.unmark`、`archive.flush`                                                 | [commands/archive.ts](./src/ai/commands/archive.ts)     |
| `forms`     | `forms.list`、`forms.get`、`forms.set`、`forms.validate`、`forms.submit`、`forms.close`                              | [commands/forms.ts](./src/ai/commands/forms.ts)         |
| `events`    | `events.list`、`events.waitFor`                                                                                  | [commands/events.ts](./src/ai/commands/events.ts)       |
| `dev`       | `dev.logs`、`dev.clearLogs`                                                                                      | [commands/dev.ts](./src/ai/commands/dev.ts)             |

### 5.4 页面句柄索引

通过 `ui.surfaces.open/close/get` 使用。

| id                         | 类型            | 打开参数                                     | 说明                                                                             |
| -------------------------- | ------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `settings`                 | dialog        | `{ section? }`                           | 设置；section：`dashboard/appearance/app/mapsetting/manager/database/network/developer/about` |
| `userInfo`                 | dialog        | —                                        | 用户中心，需要登录                                                                      |
| `notices`                  | dialog        | —                                        | 公告弹窗                                                                           |
| `siderMenu`                | panel         | `{ tab?, collapsed? }`                   | 侧边栏；tab：`filter/marker-table/features`                                         |
| `markerPopover`            | popover       | `{ markerId }`                           | 点位详情弹层，开启「高新鲜度模式」时异步核对，核对中 `state.loading` 为 true                            |
| `markerEditor`             | dialog + form | `{ markerId }`                           | 点位编辑，需 `MARKER_EDIT`                                                           |
| `markerCreator`            | dialog + form | `{ coordinate, space?, defaultItemId? }` | 新增点位，需 `MARKER_CREATE`；`space:'map'` 时转换地图坐标                                   |
| `window.itemManager`       | window        | —                                        | 物品管理                                                                           |
| `window.areaManager`       | window        | —                                        | 地区管理                                                                           |
| `window.markerManager`     | window        | —                                        | 点位管理                                                                           |
| `window.typeManager`       | window        | —                                        | 类型管理                                                                           |
| `window.iconManager`       | window        | —                                        | 图标管理                                                                           |
| `window.noticeManager`     | window        | —                                        | 公告管理                                                                           |
| `window.contribution`      | window        | —                                        | 用户统计                                                                           |
| `window.userManager`       | window        | —                                        | 用户管理                                                                           |
| `window.invitationManager` | window        | —                                        | 用户邀请                                                                           |
| `window.history`           | window        | —                                        | 历史记录                                                                           |
| `window.userManual`        | window        | —                                        | 用户手册                                                                           |
| `login`                    | form only     | —                                        | 登录表单；未登录时自动挂载，不支持主动打开/关闭                                                       |

### 5.5 表单索引

| id              | 来源                                                                     | 说明                                                                                           |
| --------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `login`         | [LoginPanel.vue](./src/components/AppLogin/components/LoginPanel.vue)  | `values` 含 `username/passwordSet`；`forms.set` 接受 `username/password`；提交成功后额外等待用户信息加载（最多 10s） |
| `markerEditor`  | [MarkerEditor.vue](./src/components/MarkerModifyer/MarkerEditor.vue)   | 完整 `MarkerVo`；只读 `id/version/createTime/updateTime/updaterId`；返回 dirtyFields                 |
| `markerCreator` | [MarkerCreator.vue](./src/components/MarkerModifyer/MarkerCreator.vue) | 完整 `MarkerVo`；只读 `id/createTime/updateTime/updaterId`                                        |

### 5.6 事件索引

`events.list` / `events.waitFor`：

`bridge:ready`、`command:end`、`surface:open`、`surface:close`、`form:submitted`、`form:succeeded`、`form:failed`、`auth:login`、`auth:logout`、`dataset:update-start`、`dataset:update-phase`、`dataset:update-end`、`socket:status`、`notice:open`、`notice:close`、`window:change`、`runtime:error`。

异步启动类命令返回 `sinceSeq`，推荐：

```js
const started = await __MAP_AI__.call('datasets.update', { key: 'marker' })
await __MAP_AI__.events.waitFor({
  type: 'dataset:update-end',
  match: { key: 'marker' },
  sinceSeq: started.data.sinceSeq,
  timeoutMs: 120000,
})
```

### 5.7 快照 section

`app.snapshot` 支持：`app`、`auth`、`ui`、`map`、`resources`、`datasets`、`archive`、`socket`、`forms`。

单 section 失败只写入 `meta.failedSections`，不影响其他 section。快照不输出 access token / refresh token / 密码。

### 5.8 新增能力时的扩展点

| 需求      | 做法                                                                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新增命令    | 在 `src/ai/commands/<group>.ts` 增加带 `id/title/description/access/params/returns/examples/handler` 的命令；在 [commands/index.ts](./src/ai/commands/index.ts) 注册；写命令必须 `access: 'write'` |
| 新增页面句柄  | 在常驻组件 setup 中 `registerCapability`，提供 `enabled/open/close/getState`，并在 `onUnmounted` 注销；参考 [AppSiderMenu.vue](./src/components/AppSiderMenu/AppSiderMenu.vue)                     |
| 新增表单    | 在表单组件中 `registerForm`，提供 `getValues/setValues/validate/submit/close/events`；只读/敏感字段显式声明；参考 [MarkerEditor.vue](./src/components/MarkerModifyer/MarkerEditor.vue)                   |
| 新增管理窗口  | 在 [windowOptions.ts](./src/components/AppSiderMenu/windowOptions.ts) 增加 key/name/icon/comp/role。`AppSiderMenu` 创建窗口句柄并注册 `window.<key>`，打开和撤权处置共用同一权限判断 |
| 新增设置页签  | 同时改 [sectionKeys.ts](./src/components/AppSettings/sectionKeys.ts) 与 [AppSettings.vue](./src/components/AppSettings/AppSettings.vue)                                               |
| 新增数据集状态 | 在 [datasetStatus.ts](./src/stores/datasetStatus.ts) 增加 key/label/store resolver；[ModuleDatabase.vue](./src/components/AppSettings/modules/ModuleDatabase.vue) 与桥接自动复用             |

**依赖方向**：

- `src/ai/bindings.ts` 是叶子模块，只含注册表与类型，**禁止** import stores / components。
- 组件只允许 `import { registerCapability, registerForm } from '@/ai/bindings'`；不要 import `install.ts`。
- `commands/*`、`appSnapshot.ts`、`capabilities.ts` 只由 `install.ts` 加载。
- AI 内部使用深路径 import，避免把整个 `@/components` barrel 拉入桥接 chunk 或造成循环依赖。

### 5.9 安全与边界

- 桥接是**页面内开发能力，不是认证/授权边界**；生产构建默认 `off`。
- 只读模式拒绝所有写命令；写命令清单可通过 `manifest().commands` 按 `access` 过滤。
- 高风险写命令：`markers.create/update/delete/tweak`、`forms.set/submit`、`archive.mark/unmark`；不要在未确认的环境中批量调用。`markers.create` 返回已确认的 ID，详情异步回读。
- 快照、事件、错误日志已对 `password/token/secret/authorization` 等键脱敏。
- 不要为了图省事直接暴露原始 Pinia store、token 或任意 JS eval 入口。
- 不要用桥接绕过权限；匿名用户无法打开需要业务权限的句柄。

### 5.10 修改后的验证清单

```bash
pnpm typecheck
pnpm test:run --project unit
pnpm lint
pnpm build
pnpm exec oxfmt --check <changed-files...>
```

浏览器冒烟（`pnpm dev` 后）：

```js
await __MAP_AI__.call('app.info')
await __MAP_AI__.call('auth.login')
await __MAP_AI__.call('app.snapshot', { sections: ['auth', 'ui', 'datasets'] })
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'settings',
  params: { section: 'database' },
})
await __MAP_AI__.call('datasets.list')
await __MAP_AI__.call('ui.surfaces.close', { id: 'settings' })
```

只读冒烟：使用 `?aiBridge=read`，确认写命令返回 `E_FORBIDDEN`、读命令正常。
生产关闭冒烟：生产构建无 query 时 `window.__MAP_AI__` 不存在、`data-ai-bridge` 无属性。

***

## 6. 改动检查清单

1. 是否先阅读了目标目录现有实现与相关文档？
2. 是否保持单页 + 弹窗/窗口架构，没有擅自拆路由？
3. 是否只改任务相关文件，没有全仓库重格式化？
4. 新增/修改业务逻辑是否有对应测试？
5. 是否运行了 `typecheck`、相关 `unit` 测试、`lint`、`build`？
6. 若新增/修改 AI 桥接能力：是否同步更新 [docs/ai-bridge.md](./docs/ai-bridge.md) 与本文件索引？
7. 是否检查只读模式、登录态、权限、弹窗队列、地图任务等边界？
8. 是否避免提交 `.env.*.local`、token、密码、真实用户数据？
9. 是否核对了生成文件没有被手改或误改？
10. 是否按提交约定自动提交了本次改动？

***

## 7. 常见坑

- 通信诊断曾从落后 `origin/dev` 93 个提交的本地分支开始实施，合入时需要适配令牌握手、实体批量同步和环境变量配置迁移。确认 Git 基线后，按该版本的 API、业务入口和环境变量模板实施。
- `pnpm format:check` 全仓库不通过属于**既有问题**；只检查本次改动文件，勿全量格式化。
- `pnpm lint` 的 warning 多来自 `tests/api/parity/**` 历史代码；以 0 error 为准，不要顺手重写无关测试。
- `pnpm test:api` / `test:parity*` 可能连接 dev 后端并写入数据，默认不要跑。
- `marker` 首次冷数据更新可能超过 60 秒；等待时使用 `datasets.waitIdle` 120 秒或 `events.waitFor`。
- 全局弹窗有队列：已有弹窗关闭动画未结束时，`ui.surfaces.open` 可能返回 `queued: true`，先关闭当前弹窗或等待。
- 设置弹窗通过 `preferenceStore.settingActivedKey` 定位页签；打开数据库页签会持久化该 UI preference，这是预期行为。
- 登录后的账号设置统一由 1 号云存档槽位保存。通过 `usePreferenceStore()` 或 `archiveStore.preference` 读写设置，`currentArchive.body` 只含当前槽位的点位进度和刷新时间。前端自动补建 1 号槽位，并禁用其删除和历史读取。
- `forms.submit('login')` 会等待用户信息加载（最多 10 秒）；需要更可控登录时优先用 `auth.login`。
- `useAppWindow({ key, ... })` 按组件所有者分配实例 id。`open()` 等待挂点可用，明确要展开并聚焦时用 `show(event)`。业务状态收尾写在 `onClosed(reason)`，同步或异步的 `beforeClose` 负责守卫。登出、撤权和卸载通过处置路径释放窗口，普通关闭在当前会话记住布局。
