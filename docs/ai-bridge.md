# AI 页面句柄与信息反射层（`window.__MAP_AI__`）

> 适用版本：协议 `1.0.0`，schemaVersion `1`。
>
> 目标：让具备页面内 JS 执行能力的 AI（浏览器控制台、CDP `Runtime.evaluate`、Playwright `page.evaluate`）在不截图、不模拟点击的情况下读取页面状态、打开弹窗/窗口/表单并调用页面能力。

## 1. 背景与边界

应用是单入口 SPA，登录、点位弹窗、点位编辑/新增表单、设置、用户中心、系统管理页均以弹窗、窗口、侧边栏形式挂在首页。传统 ComputerUse 需要截图定位、模拟点击，既慢又容易因动画、缩放、遮挡而失败。

`window.__MAP_AI__` 提供三类能力：

1. **信息反射**：`app.snapshot`、`ui.surfaces.list`、`datasets.list`、`markers.list` 等读取当前状态与数据。
2. **页面句柄**：按稳定 id 打开/关闭设置、点位弹窗、点位表单、侧边栏、管理窗口等。
3. **表单反射**：读取/写入表单字段、校验、提交并等待成功/失败结果。

它不是认证或授权边界。任何已能在页面执行 JS 的调用方本来就能以当前用户身份操作；桥接只是把这些操作变成稳定、可发现的接口。生产构建默认关闭，写命令在只读模式下会被拒绝。

## 2. 启用方式

| 场景 | 默认 | 说明 |
| --- | --- | --- |
| `pnpm dev` | `write` | 本地开发完整能力 |
| `pnpm build` / preview / 生产 | `off` | 不定义全局，不加载桥接 chunk |
| `VITE_AI_BRIDGE` | 按配置 | 用于测试/预发构建，值 `off` / `read` / `write` |
| URL `?aiBridge=read\|write\|off\|1\|2\|0` | 覆盖一切 | 仅本次页面加载生效，不持久化 |
| `localStorage['__map_ai_bridge']` | 覆盖 env/默认 | 显式持久开启，适合自动化复用 |

优先级：**URL query > localStorage > `VITE_AI_BRIDGE` > 开发环境 write / 生产 off**。

> `?aiBridge` 只在应用启动时读取，随后 `App.vue` 会清理 query。需要再次切换模式时修改 URL 或 localStorage 后刷新。

启动状态写入 DOM：`document.documentElement.dataset.aiBridge`。

- `booting`：正在加载桥接 chunk
- `read` / `write`：已就绪及模式
- `error`：安装失败
- 属性不存在：未启用

AI 可以轮询：

```js
while (!window.__MAP_AI__) {
  await new Promise(resolve => setTimeout(resolve, 100))
  if (document.documentElement.dataset.aiBridge === 'error') {
    throw new Error('AI 页面句柄安装失败')
  }
}
```

## 3. 快速开始

### 3.1 浏览器控制台 / CDP

```js
// 查看帮助与契约
__MAP_AI__.help()
__MAP_AI__.manifest()

// 读取应用快照（按需选择 section）
await __MAP_AI__.call('app.snapshot', { sections: ['app', 'auth', 'ui', 'datasets'] })

// 命名空间直调（失败抛错）
await __MAP_AI__.datasets.list()
```

CDP `Runtime.evaluate` 建议带 `awaitPromise: true`、`returnByValue: true`，表达式例如：

```js
window.__MAP_AI__.call('app.snapshot', { sections: ['auth', 'ui'] })
```

### 3.2 两种调用方式

- **安全 RPC**：`await __MAP_AI__.call(command, params)`，永不抛业务异常，返回：

  ```ts
  { ok: true, command, data, meta: { durationMs, startedAt, seq, sinceSeq } }
  // 或
  { ok: false, command, error: { code, message, details?, hint? }, meta }
  ```

- **命名空间直调**：`await __MAP_AI__.datasets.list()`，返回原始数据，失败抛 `MapAiError`。

`meta.sinceSeq` 是命令开始前的事件序号，适合配合 `events.waitFor` 精确等待异步结果。

## 4. 命令参考

完整参数 schema 以 `__MAP_AI__.manifest().commands` 为准；`__MAP_AI__.help()` 会生成带参数摘要的 Markdown。

### 4.1 `app`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `app.info` | R | 协议版本、应用版本/分支/commit、URL、模式与来源 |
| `app.help` | R | Markdown 帮助，可传 `{ group }` |
| `app.manifest` | R | 命令、参数 schema、句柄、事件、错误码的完整 JSON 契约 |
| `app.snapshot` | R | 应用快照，可传 `{ sections, includeSurfaceStates, includeWindowStates, maxStringLength }` |
| `app.ping` | R | 连通性检查 |

### 4.2 `ui`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `ui.surfaces.list` | R | 列出当前页面句柄、可用性与状态，可传 `{ kind, includeState }` |
| `ui.surfaces.get` | R | 读取单个句柄，参数 `{ id }` |
| `ui.surfaces.open` | R | 打开句柄，参数 `{ id, params?, timeoutMs? }` |
| `ui.surfaces.close` | R | 关闭句柄，参数 `{ id }` |
| `ui.notices.list` | R | 公告列表与未读状态 |
| `ui.notices.read` | W | 标记公告已读，参数 `{ id }` |

### 4.3 `auth`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `auth.status` | R | 登录态、用户、角色、权限、token 过期时间（不返回 token 原文） |
| `auth.login` | W | 登录并等待用户信息加载完成；开发环境可省略参数使用 `VITE_AUTO_COMPLETE_*` |
| `auth.logout` | W | 登出 |

### 4.4 `datasets`（设置→数据库同源状态）

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `datasets.list` | R | 六类数据的总数、定时更新、进度、下一次更新时间、错误 |
| `datasets.get` | R | 单类数据，参数 `{ key }` |
| `datasets.update` | W | 触发差异/全量更新，参数 `{ key, full? }`；立即返回 |
| `datasets.waitIdle` | R | 等待更新结束，参数 `{ keys?, timeoutMs?, pollMs? }` |

数据集 key：`area`、`icon`、`item`、`itemType`、`marker`、`markerLink`。

`datasets.update` 返回 `sinceSeq`，可用于等待结束事件：

```js
const started = await __MAP_AI__.call('datasets.update', { key: 'marker' })
await __MAP_AI__.events.waitFor({
  type: 'dataset:update-end',
  match: { key: 'marker' },
  sinceSeq: started.data.sinceSeq,
  timeoutMs: 120000,
})
```

### 4.5 `markers`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `markers.list` | R | 分页查询点位，支持 scope/标题/地区/物品/类型/隐藏标记/排序等 |
| `markers.get` | R | 按 id 读取完整点位；本地不存在时回源 |
| `markers.focus` | R | 地图移动到点位并打开点位弹窗 |
| `markers.create` | W | 直接调用 store 创建点位（绕过表单） |
| `markers.update` | W | 直接调用 store 更新点位（需要完整 MarkerVo 与 version） |
| `markers.delete` | W | 直接删除点位（不经过界面确认框） |
| `markers.tweak` | W | 批量修改点位（TweakVo[]） |

`scope`：

- `all`：全部本地点位（已按当前用户 hiddenFlag 过滤）
- `filtered`：当前底图 + 当前筛选器下的静态点位
- `visible`：当前地图可见点位（含临时点位）

### 4.6 `resources`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `resources.areas` | R | 地区列表或地区树，参数 `{ tree? }` |
| `resources.items` | R | 物品分页，支持 `ids/areaId/typeId/keyword` |
| `resources.itemTypes` | R | 物品类型列表 |
| `resources.icons` | R | 图标分页，支持 `keyword` |
| `resources.links` | R | 点位关联分页，支持 `markerId/groupId` |

### 4.7 `map`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `map.state` | R | 地区/底图/视口/任务/交互/计数/筛选/附加图层 |
| `map.setView` | R | 设置视口中心（地图坐标）与缩放 |
| `map.setArea` | W | 切换到末端地区，参数 `{ code }` |
| `map.filter.get` | R | 读取基础/高级筛选 |
| `map.filter.setBasic` | W | 设置地区、物品类型、物品 id、筛选模式 |

### 4.8 `archive`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `archive.state` | R | 当前存档槽位、已完成点位数、时间戳 |
| `archive.mark` | W | 标记点位完成，参数 `{ id }` |
| `archive.unmark` | W | 取消点位完成，参数 `{ id }` |
| `archive.flush` | W | 立即同步存档 |

### 4.9 `forms`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `forms.list` | R | 当前已打开表单摘要 |
| `forms.get` | R | 读取字段、只读字段、敏感字段、busy/dirty |
| `forms.set` | W | 写入字段，参数 `{ id, values }` |
| `forms.validate` | R | 调用组件自身校验 |
| `forms.submit` | W | 校验并提交，默认等待成功/失败事件 |
| `forms.close` | R | 关闭表单（不提交） |

### 4.10 `events` / `dev`

| 命令 | 级别 | 说明 |
| --- | --- | --- |
| `events.list` | R | 读取事件环形缓冲，支持 `afterSeq/limit/type` |
| `events.waitFor` | R | 等待事件，支持 `type/match/sinceSeq/timeoutMs` |
| `dev.logs` | R | 读取 Logger 日志，支持 `limit/label` |
| `dev.clearLogs` | W | 清空日志 |

## 5. 页面句柄

句柄通过 `ui.surfaces.*` 访问。当前 v1：

| id | 类型 | 打开参数 | 说明 |
| --- | --- | --- | --- |
| `settings` | dialog | `{ section? }` | 系统设置，section 可选 `dashboard/app/mapsetting/manager/database/network/developer/about` |
| `userInfo` | dialog | — | 用户中心，需要登录 |
| `notices` | dialog | — | 公告弹窗 |
| `siderMenu` | panel | `{ tab?, collapsed? }` | 侧边栏，tab 可选 `filter/marker-table/features` |
| `markerPopover` | popover | `{ markerId }` | 点位详情弹层 |
| `markerEditor` | dialog + form | `{ markerId }` | 点位编辑表单（需要 `MARKER_EDIT`） |
| `markerCreator` | dialog + form | `{ coordinate, space?, defaultItemId? }` | 新增点位（需要 `MARKER_CREATE`） |
| `window.itemManager` | window | — | 物品管理 |
| `window.areaManager` | window | — | 地区管理 |
| `window.markerManager` | window | — | 点位管理 |
| `window.typeManager` | window | — | 类型管理 |
| `window.iconManager` | window | — | 图标管理 |
| `window.noticeManager` | window | — | 公告管理 |
| `window.contribution` | window | — | 用户统计 |
| `window.userManager` | window | — | 用户管理 |
| `window.invitationManager` | window | — | 用户邀请 |
| `window.history` | window | — | 历史记录 |
| `window.userManual` | window | — | 用户手册 |
| `login` | form only | — | 登录表单（未登录时自动挂载，不支持主动打开/关闭） |

示例：

```js
// 打开设置到数据库页签
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'settings',
  params: { section: 'database' },
})

// 打开点位弹窗
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'markerPopover',
  params: { markerId: 123 },
})

// 打开点位编辑表单
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'markerEditor',
  params: { markerId: 123 },
})

// 打开新增点位表单（coordinate 默认是点位坐标；space:'map' 时按地图坐标转换）
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'markerCreator',
  params: { coordinate: [0, 0], defaultItemId: 1 },
})

// 打开系统管理窗口
await __MAP_AI__.call('ui.surfaces.open', { id: 'window.itemManager' })

// 打开侧边栏筛选页签
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'siderMenu',
  params: { tab: 'filter' },
})
```

`ui.surfaces.open` 返回 `{ id, opened, queued, sinceSeq }`。如果已有其他全局弹窗，新弹窗会排队，`queued: true`。

## 6. 表单反射

### 6.1 当前表单

| id | 字段 | 说明 |
| --- | --- | --- |
| `login` | `username`、`passwordSet` | `forms.set` 可传 `username` / `password`；密码不会出现在返回值中 |
| `markerEditor` | 完整 `MarkerVo` | 只读 `id/version/createTime/updateTime/updaterId`，额外返回 dirtyFields |
| `markerCreator` | 完整 `MarkerVo` | 只读 `id/createTime/updateTime/updaterId` |

### 6.2 典型流程

```js
// 读取
const state = await __MAP_AI__.call('forms.get', { id: 'markerEditor' })

// 写字段（只读字段会被忽略）
await __MAP_AI__.call('forms.set', {
  id: 'markerEditor',
  values: { markerTitle: '测试点位' },
})

// 校验
await __MAP_AI__.call('forms.validate', { id: 'markerEditor' })

// 提交并等待结果（默认 wait:true）
await __MAP_AI__.call('forms.submit', { id: 'markerEditor' })

// 关闭（不提交）
await __MAP_AI__.call('forms.close', { id: 'markerEditor' })
```

`forms.submit` 返回：

```ts
{ success: true }
{ success: false, error: '表单校验失败', validationError: true }
{ success: false, error: '...' }
{ success: null, timedOut: true }
```

同时会发出 `form:submitted`、`form:succeeded` 或 `form:failed` 事件。

> `forms.submit({ id: 'login' })` 成功后额外等待用户信息加载完成（最多 10 秒），避免紧接着查询 `auth.status` 时仍看到 `isLogin: false`。若需要更可控的登录流程，优先使用 `auth.login`。

### 6.3 与直接写命令的差异

- `forms.*` 模拟人工操作，经过组件校验、按钮禁用、远端版本合并等真实逻辑；错误可能先被界面消费，因此依赖返回结果或事件。
- `markers.create/update/delete/tweak` 直接调用 store，错误更直接；适合构造/清理测试数据。
- 验证 UI 流程用 `forms.*`；构造数据用 `markers.*`。

## 7. 快照

`app.snapshot` 默认包含全部 section，可用 `{ sections: [...] }` 裁剪；每个 section 独立 `try/catch`，单个失败不影响其余。

| section | 内容 |
| --- | --- |
| `app` | 版本/分支/commit/URL/模式/协议版本/当前时间 |
| `auth` | 登录态、用户、角色、权限、token 过期时间 |
| `ui` | 视口、主题、页面句柄、窗口、全局弹窗、公告、表单摘要 |
| `map` | 地区/底图/视口、任务、交互、点位计数、筛选、附加图层 |
| `resources` | 地区/图标/物品/类型/点位/关联总数、当前地区、系统配置版本 |
| `datasets` | 与 `datasets.list` 相同 |
| `archive` | 存档槽位、已完成点数、时间戳 |
| `socket` | WebSocket 状态、延迟、消息数 |
| `forms` | 当前打开表单摘要与字段键 |

注意：

- `ui` 与 `map` 的 section 字段会随版本演进，新增字段属于兼容变更。
- 长字符串默认截断到 20000 字符，可通过 `maxStringLength` 调整。
- 不输出 access token / refresh token / 密码。

## 8. 事件与等待

| 事件 | 触发 |
| --- | --- |
| `bridge:ready` | 桥接安装完成 |
| `command:end` | 任意命令结束（含失败，不含参数） |
| `surface:open` / `surface:close` | 通过命令打开/关闭句柄 |
| `form:submitted` | 开始提交表单 |
| `form:succeeded` / `form:failed` | 表单提交成功/失败 |
| `auth:login` / `auth:logout` | 登录态变化（包括人工登录） |
| `dataset:update-start` / `dataset:update-phase` / `dataset:update-end` | 数据更新生命周期 |
| `socket:status` | WebSocket 状态/延迟变化 |
| `notice:open` / `notice:close` | 公告弹窗开关 |
| `window:change` | 窗口列表变化 |
| `runtime:error` | 未捕获异常 / Promise rejection |

`events.waitFor` 语义：

```js
await __MAP_AI__.events.waitFor({
  type: 'dataset:update-end',
  match: { key: 'marker' }, // payload 子集匹配
  sinceSeq: 12,             // 可查历史缓冲
  timeoutMs: 120000,        // 默认 15000
})
```

- 不传 `sinceSeq` 时只等未来事件。
- 超时抛 `E_TIMEOUT`，`details` 包含 `type/sinceSeq/lastSeq/timeoutMs`。
- `events.list({ afterSeq, limit, type })` 可查看已经发生的事件。

## 9. 错误码

| code | 说明 |
| --- | --- |
| `E_UNKNOWN_COMMAND` | 命令不存在 |
| `E_INVALID_PARAMS` | 参数校验失败，`details` 为 `{ path, message }[]` |
| `E_FORBIDDEN` | 只读模式调用写命令，或当前账号无业务权限 |
| `E_UNKNOWN_SURFACE` | 页面句柄不存在 |
| `E_UNSUPPORTED` | 句柄/表单不支持该动作 |
| `E_UNAVAILABLE` | 组件未挂载、未登录或地图任务阻塞 |
| `E_NOT_FOUND` | 点位/资源/表单不存在 |
| `E_BUSY` | 表单正在提交或对话框忙碌 |
| `E_TIMEOUT` | 等待事件/等待空闲/打开句柄超时 |
| `E_DOMAIN` | 业务或网络错误 |
| `E_INTERNAL` | 桥接内部异常 |

## 10. 典型 AI 流程

### 10.1 登录

```js
await __MAP_AI__.call('auth.login') // 开发环境自动填充账号
// 或
await __MAP_AI__.call('auth.login', { username: '...', password: '...' })
await __MAP_AI__.call('auth.status')
```

### 10.2 设置→数据库状态

```js
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'settings',
  params: { section: 'database' },
})
const { data } = await __MAP_AI__.call('datasets.list')
console.table(data.items.map(({ key, label, total, updating, progress }) => ({
  key, label, total, updating, percentage: progress.percentage, phase: progress.phaseLabel,
})))
```

### 10.3 触发点位数据库更新并等待

```js
const started = await __MAP_AI__.call('datasets.update', { key: 'marker' })
await __MAP_AI__.call('datasets.waitIdle', { keys: ['marker'], timeoutMs: 120000 })
// 或
await __MAP_AI__.events.waitFor({
  type: 'dataset:update-end',
  match: { key: 'marker' },
  sinceSeq: started.data.sinceSeq,
  timeoutMs: 120000,
})
```

### 10.4 点位弹窗 / 编辑表单

```js
const page = await __MAP_AI__.call('markers.list', { pageSize: 1 })
const id = page.data.items[0].id

await __MAP_AI__.call('markers.focus', { id })
await __MAP_AI__.call('ui.surfaces.open', { id: 'markerEditor', params: { markerId: id } })
await __MAP_AI__.call('forms.get', { id: 'markerEditor' })
await __MAP_AI__.call('forms.close', { id: 'markerEditor' })
```

### 10.5 只读模式冒烟

打开 `?aiBridge=read` 后：

```js
await __MAP_AI__.call('app.snapshot')       // ok
await __MAP_AI__.call('datasets.update', { key: 'marker' }) // E_FORBIDDEN
```

## 11. 扩展方式

新增一个页面句柄：

```ts
import { registerCapability } from '@/ai/bindings'

const unbind = registerCapability({
  id: 'mySurface',
  kind: 'dialog',
  title: '我的弹窗',
  enabled: () => true,
  open: params => {
    // 调用现有服务/组件打开弹窗
  },
  close: () => {
    // 关闭
  },
  getState: () => ({ open: false }),
})

onUnmounted(unbind)
```

新增一个表单：

```ts
import { registerForm } from '@/ai/bindings'

const unbind = registerForm({
  id: 'myForm',
  title: '我的表单',
  getValues: () => ({ field: value }),
  setValues: patch => Object.assign(model, patch),
  validate: async () => {},
  submit: async () => {},
  close: () => {},
})
onUnmounted(unbind)
```

新增命令：在 `src/ai/commands/*.ts` 中追加带 `id/title/description/params/handler` 的命令，并在 `src/ai/commands/index.ts` 注册。写命令必须声明 `access: 'write'`。

## 12. 排障

| 现象 | 排查 |
| --- | --- |
| `window.__MAP_AI__` 不存在 | 查看 `document.documentElement.dataset.aiBridge`；生产构建需要显式开启；`?aiBridge=off` 会关闭 |
| 一直是 `booting` | 动态 chunk 加载失败；查看控制台 `[AI] 页面句柄安装失败` |
| 写命令返回 `E_FORBIDDEN` | 当前为 `read` 模式或无业务权限；用 `?aiBridge=write` 或 localStorage 切换 |
| 句柄返回 `E_UNAVAILABLE` | 组件未挂载、未登录或地图任务阻塞；先登录/关闭任务再重试 |
| `forms.get` 返回 `E_NOT_FOUND` | 表单未打开；先 `ui.surfaces.open`，再 `forms.list` 确认 |
| `forms.submit` 超时 | 组件未触发成功/失败事件；可用 `markers.*` 直接写，或检查控制台报错 |
| `events.waitFor` 超时 | 检查 `sinceSeq` 是否早于事件；`events.list` 查看已发生事件 |
| 人工登录后也收到 `auth:login` | 事件监听登录态变化，不区分人工/AI |

## 13. 非目标

- 不引入 Playwright/Cypress 等 E2E 依赖。
- 不做 DOM 点击模拟、截图、视觉回归。
- 不暴露原始 Pinia 实例、token、密码或任意 JS eval。
- v1 不提供高级筛选条件树写入、点位拖拽/框选、点位关联编辑、用户/公告管理 CRUD、数据库删除/重建。
