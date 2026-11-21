# Element Plus → Reka UI 组件层重构与美术分层方案

- 文档状态：团队评审稿
- 编写日期：2026-11-21
- 适用范围：全站组件层、样式层、构建配置；不涉及地图渲染、数据同步、API 协议
- 阶段划分：P0 = 组件替换 + 中性现代化皮肤；P1 = 原神风格化皮肤
- 依赖版本：`reka-ui@2.11.x`（`Field` / `Form` 为 v2 新增能力，需锁定下限）

## 1. 问题定性

### 1.1 表层现象

同一屏内，外壳（侧边栏、标题栏、按钮）是原神美术，表单内容（`el-form` / `el-input` / `el-select`）是 Element Plus 默认视觉。用户感知为"两个产品拼在一起"。

### 1.2 真实原因（与直觉不同）

经全量扫描，实际情况不是"一半原神、一半 EP"，而是：

| 指标 | 数值 |
| --- | --- |
| `.vue` 文件总数 | 356 |
| 引用 `element-plus` 或 `<el-*>` 的 `.vue` 文件 | 194（54%） |
| `<el-*>` 标签总数 / 种类 | 835 / 48 |
| `from 'element-plus'` 语句 | 105 |
| 引用 `--el-*` CSS 变量的文件 | **139** |
| `--el-*` 引用总处数 / 不同变量数 | **506 / 83** |
| `ElMessage` / `ElMessageBox` / `ElNotification` 调用 | 155 / 10 / 5 |
| `@element-plus/icons-vue` 引入语句 / 不同图标 | 118 / 67 |

结论：**整个应用的配色、边框、文字层级，都建立在 Element Plus 的语义变量之上**。`GenshinUI` 的 11 个组件（共 1476 行）只是在这层变量上做二次上色；其中 `GSSegmented.vue` 甚至直接是 `ElSegmented` 的包装（覆盖 `--el-segmented-*`）。`WinDialog` 的底色同样取自 `--el-fill-color-light` 与 `--el-color-primary-light-9`。

因此不存在"两套 UI"。存在的是**一套 UI + 一层局部换皮**。

### 1.3 为什么换皮在表单上失效

Element Plus 的组件同时输出「行为」和「视觉结构」。换皮只能改最外层容器，无法改内部结构：

- `el-select` 的下拉浮层、选项高亮、多选 tag 排布在 EP 内部固定；
- `el-table` 的行列、斑马纹、固定列、border 由内部 DOM 结构决定；
- `el-form-item` 的 label 宽度、必填星号、错误信息插入位置是硬布局；
- `el-date-picker` 的面板与输入框绑定为一个整体组件。

表单与表格恰好是用户停留最久、内部结构最多的两类组件，所以割裂感在这两处最强。这不是美术资源问题，是**行为与结构没有分离**造成的架构问题。

### 1.4 对目标方案的直接约束

1. P0 不能只是"换一个组件库"。若继续让组件库决定 DOM 结构，P1 仍然只能换外皮，同一个问题会以新形式复发。
2. P1 必须是**纯 CSS 变更**。如果 P1 阶段还需要打开 `.vue` 文件改模板，说明 P0 的分层没有做对。
3. 因此本方案的核心不是"EP → reka-ui"，而是**建立三层契约：Token / 行为 / 皮肤**。reka-ui 只是让"行为"层不再携带视觉结构。

## 2. 目标与非目标

### 2.1 目标

- 移除 `element-plus` 与 `@element-plus/icons-vue` 两个依赖，以及围绕它们的所有样式覆盖、构建配置与类型定义。
- 建立 `src/ui` 组件层，行为由 reka-ui 提供，结构由本项目掌控。
- 皮肤可切换（`data-skin`），P0/P1 可在同一构建内并存、逐页灰度、随时回退。
- 保留现有 25 处 `formRef.validate()` 调用语义，不改业务提交流程。
- 保留现有 `--gs-*` 主题色与暗色模式机制（`useDark` → `html.dark`）。

### 2.2 非目标

- 不在 P0 追求视觉精致度。P0 的皮肤刻意做成**中性、克制、可抛弃**。
- 不重写地图渲染、筛选器数据流、Marker/Item 业务组件。
- 不引入 Storybook、不引入 Tailwind 之外的样式方案、不做 RTL。
- 不在 P0 更换图标视觉风格（见 7.6：沿用同源图标集，保证零视觉变化）。
- 不追求一次性切换。允许 EP 与 `src/ui` 在迁移期内共存，但**不允许新增 EP 用法**。

## 3. 目标架构

### 3.1 目录与分层

```text
src/ui/
├─ tokens/                    # 契约层：唯一允许被皮肤覆盖的接口
│  ├─ contract.scss           # --ui-* 语义变量（明/暗两套）
│  ├─ scale.scss              # 间距、字号、动效、层级标尺
│  └─ bridge.scss             # 【过渡期专用】--el-* → --ui-* 别名映射
├─ skins/
│  ├─ modern/index.scss       # P0 皮肤
│  └─ genshin/                # P1 皮肤
│     ├─ index.scss
│     └─ ornaments.scss       # 九宫格边框、角花、纹理
├─ primitives/                # 行为层：reka-ui 包装，一个组件一个目录
│  ├─ button/UiButton.vue
│  ├─ input/UiInput.vue
│  ├─ select/UiSelect.vue
│  └─ …
├─ compose/                   # 组合层：跨组件的项目级模式
│  ├─ form/                   # UiForm / UiFormItem / useFormRules
│  ├─ table/UiTable.vue
│  ├─ dialog/                 # 与既有 AppDialog / GlobalDialogService 合流
│  └─ toast/
├─ gallery/                   # 组件画廊（开发态专用，见 6.4）
└─ index.ts                   # 统一出口
```

### 3.2 依赖方向（强约束）

```text
skins/  ──CSS──▶  tokens/          （皮肤只写 CSS，不写 TS）
primitives/ ──▶ tokens/（读变量）、reka-ui
compose/ ──▶ primitives/
业务代码 ──▶ ui/index.ts
```

四条不可违反的规则：

1. `src/ui/**` 不得 import `@/components`、`@/stores`、`@/api`。UI 层不认识业务。
2. `src/ui/**` 不得 import `element-plus`（任何形式，含类型）。
3. 业务代码不得 import `reka-ui` 原始组件，只能经由 `src/ui`。否则 P1 时无法统一加装饰。
4. 组件内不得出现皮肤判断分支（`if (skin === 'genshin')`）。皮肤差异只能存在于 CSS。

规则 1–3 由自动化守卫测试保障（见 6.3）。

### 3.3 为什么不复用 `GenshinUI` 作为基座

`GSButton` / `GSInput` / `GSSwitch` 是手工实现的原神视觉，它们把视觉决策（`--bg`、`--border-color`、`--filter`、`--outline-color` 各状态值）直接写进了组件。

如果把 `UiButton` 建在 `GSButton` 之上，等于把 P1 皮肤固化进 P0 基座，P0 的"中性皮肤"就无处安放；且 `GSButton` 的图标圆形底、`GSInput` 的胶囊内阴影等细节并非所有场景都适用。

正确定位：**`GenshinUI` 是 P1 美术决策的参考实现，不是基座**。它已经把 P1 皮肤需要的变量契约试出来了（见 4.4），这部分经验直接转化为 token 设计。迁移完成后 `GenshinUI` 目录整体退役，其视觉意图并入 `skins/genshin`。

## 4. Token 契约

### 4.1 三层变量

| 层 | 前缀 | 谁可以改 | 说明 |
| --- | --- | --- | --- |
| T1 原始量 | `--ui-scale-*`、`--ui-palette-*` | 一般不覆盖 | 间距梯度、字号、色板原值 |
| T2 语义量 | `--ui-color-*`、`--ui-radius-*`、`--ui-font-*` | **皮肤主战场** | 组件只读这一层 |
| T3 组件量 | `--ui-button-*`、`--ui-input-*` | 皮肤按需覆盖 | 默认由 T2 派生 |

规则：组件 CSS **只允许引用 T2/T3**，禁止硬编码颜色、圆角、字体、阴影。这一条是 P1 能只改 CSS 的前提，需靠 code review 与 grep 守卫共同保障。

### 4.2 契约清单（P0 / P1 取值对照）

| Token | P0 modern | P1 genshin | 来源依据 |
| --- | --- | --- | --- |
| `--ui-color-canvas` | `#f6f7f9` / 暗 `#171a21` | `#263240` | `--gs-bg-color-dark` |
| `--ui-color-surface` | `#ffffff` / 暗 `#20242e` | `#ece5d8`（96%） | `GSButton --bg` |
| `--ui-color-surface-sunken` | `#f3f4f6` / 暗 `#1b2029` | `#dcd3c4` | — |
| `--ui-color-border` | `#e5e7eb` / 暗 `#2f3542` | `#bfbfbf` | `GSInput --gs-input-border-color` |
| `--ui-color-border-strong` | `#d1d5db` / 暗 `#3d4552` | `#ece5d8` @34% | `GSButton --outline-color` |
| `--ui-color-text` | `#111827` / 暗 `#e5e7eb` | `#4a5366` | `GSButton --text-color` |
| `--ui-color-text-muted` | `#6b7280` / 暗 `#9ca3af` | `#959597` | `GSButton 禁用态文字` |
| `--ui-color-accent` | `#2563eb` / 暗 `#60a5fa` | `#fac732` | `GSButton --icon-color` |
| `--ui-color-accent-contrast` | `#ffffff` | `#4a5366` | — |
| `--ui-color-danger` | `#dc2626` | `#cf5945` | `--gs-color-danger` |
| `--ui-color-success` | `#16a34a` | `#99cc33` | `--gs-color-success` |
| `--ui-color-warning` | `#d97706` | `#f7ba3f` | `--gs-color-confirm` |
| `--ui-radius-control` | `6px` | `999px` | `GSButton height/2` |
| `--ui-radius-surface` | `10px` | `6px` | — |
| `--ui-border-width-control` | `1px` | `2px` | `GSInput border: 2px` |
| `--ui-font-ui` | `ui-sans-serif, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` | `"HYWenHei-85W", sans-serif` | 现有 `font-['HYWenHei-85W']` |
| `--ui-font-numeric` | `ui-monospace, "SF Mono", monospace` | `"HYWenHei-85W"` | — |
| `--ui-shadow-1` | `0 1px 2px rgb(0 0 0 / 6%)` | `0` | `GSButton filter` |
| `--ui-control-elevation` | `0 1px 2px rgb(0 0 0 / 5%)` | `drop-shadow(0 0 2px rgb(128 128 128 / 40%))` | `GSButton --filter` |
| `--ui-focus-ring` | `0 0 0 3px rgb(37 99 235 / 25%)` | `0 0 0 2px #fff, 0 0 6px rgb(128 128 128 / 40%)` | `GSButton 悬停描边` |
| `--ui-motion-fast` | `120ms` | `150ms` | `GSButton --transition` |
| `--ui-motion-base` | `200ms` | `220ms` | — |

`--ui-control-elevation` 与 `--ui-focus-ring` 两行为什么必须存在：`GSButton` 的每个状态都同时调 `--filter`、`--outline-color`、`--border-color`、`--bg`，若契约只暴露颜色，P1 阶段的"描边 + 投影"双态就无法表达，必然要回去改组件。

### 4.3 结构契约（DOM 钩子）

皮肤能改到什么，取决于组件对外承诺了哪些稳定钩子。每个 `Ui*` 组件必须在文档头声明：

```text
UiButton 结构契约
  .ui-button                     根节点；::before / ::after 保留给皮肤，组件自身不占用
  .ui-button__icon               图标槽容器
  .ui-button__label              文本容器
  data-ui="button"
  data-variant="solid|outline|ghost|text|danger"
  data-size="sm|md|lg"
  data-state="default|loading|disabled"   （复制到 DOM，供 CSS 选择）
```

`::before` / `::after` 的**预留约定**是 P1 九宫格边框、角花、扫光动画的落点。这是整份方案里最容易做错的细节：一旦 P0 组件把伪元素用掉（例如 `GSSwitch` 的滑块就是伪元素），P1 就只能改模板。

reka-ui 已原生输出 `data-state="open|closed|checked"`、`data-highlighted`、`data-side`、`data-align`、`data-disabled`，包装时**原样透传，不要吞掉**，皮肤直接依赖这些属性编写状态样式。

### 4.4 契约充分性验证：用 `GSButton` 反推

| `GSButton` 现有变量 | 契约对应 |
| --- | --- |
| `--bg` / `--bg-hover` / `--bg-active` | `--ui-button-bg` 及 `--ui-button-bg-hover/-active` |
| `--text-color` / `--text-active-color` | `--ui-button-fg` / `-fg-active` |
| `--outline-color` / `-hover` / `-active` | `--ui-button-ring` / `-ring-hover` / `-ring-active` |
| `--border-color` / `-hover` / `-active` | `--ui-button-border` / `-border-hover` / `-border-active` |
| `--filter` / `--filter-active` | `--ui-button-elevation` / `-elevation-active` |
| `--height` / `--padding` / `--text-size` | `--ui-control-h-{sm,md,lg}` + `data-size` |
| `--icon-bg` / `--icon-color` | `--ui-button-icon-bg` / `-icon-fg` |

七个维度全部可表达，说明契约够用。这套"每个交互态一组 shadow tokens"的写法应作为 T3 的模板沿用。

### 4.5 皮肤装载

```html
<!-- P0 -->
<html data-skin="modern" class="dark">
<!-- P1 灰度：按路由/用户偏好切换，无需重新构建 -->
<html data-skin="genshin">
```

```scss
// skins/genshin/index.scss
[data-skin='genshin'] {
  --ui-color-surface: rgb(236 229 216 / 96%);
  --ui-radius-control: 999px;
  --ui-font-ui: 'HYWenHei-85W', sans-serif;
  /* …T2 全覆盖… */
}

[data-skin='genshin'] .ui-button::before {
  /* 九宫格角饰，纯 CSS，不触碰模板 */
}
```

## 5. 组件映射

### 5.1 映射总表

按使用量降序，直接决定迁移顺序。

| Element Plus | 次数 | reka-ui 基元 | 目标组件 | 风险 |
| --- | --- | --- | --- | --- |
| `el-button` | 149 | 无（原生 button） | `UiButton` | 低 |
| `el-icon` | 106 | 无 | `UiIcon` + Iconify | 低 |
| `el-form-item` | 104 | `FieldRoot` + `FieldLabel` + `FieldError` | `UiFormItem` | **高**（见 7.1） |
| `el-table-column` | 93 | 无 | `UiTable` 列描述 | **高**（见 7.3） |
| `el-input` | 55 | 无（原生）+ `FieldControl` 接线 | `UiInput` / `UiTextarea` | 中 |
| `el-divider` | 33 | `Separator` | `UiSeparator` | 低 |
| `el-select-v2` | 30 | `Combobox` + `@tanstack/vue-virtual` | `UiCombobox` | **高**（见 7.2） |
| `el-text` | 29 | 无 | 语义排版类，直接替换为 `span/p` + `.ui-text-*` | 低 |
| `el-tag` | 23 | 无 | `UiTag` | 低 |
| `el-scrollbar` | 23 | `ScrollArea` | `UiScrollArea` | 中（见 8.2） |
| `el-form` | 21 | `FormRoot` | `UiForm` | **高**（见 7.1） |
| `el-input-number` | 14 | `NumberField` | `UiNumberField` | 低 |
| `el-switch` | 12 | `Switch` | `UiSwitch` | 低 |
| `el-dialog` | 10 | `Dialog` | `UiDialog`（与 `AppDialog` 服务合流） | 中 |
| `el-pagination` | 9 | `Pagination` | `UiPagination` | 中 |
| `el-tooltip` | 8 | `Tooltip` | `UiTooltip` | 低 |
| `el-table` | 8 | 无 | `UiTable` | **高** |
| `el-image` | 7 | `Avatar`（仅头像场景） | `UiImage` | 低 |
| `el-checkbox(-group)` | 12 | `Checkbox` / `CheckboxGroup` | `UiCheckbox` | 低 |
| `el-skeleton(-item)` | 11 | 无 | `UiSkeleton` | 低 |
| `el-radio-button` / `-group` | 8 | `RadioGroup` / `ToggleGroup` | `UiRadioGroup` / `UiSegmented` | 低 |
| `el-date-picker` | 5 | `DatePicker` / `DateField` / `TimeField` | `UiDatePicker` | 中 |
| `el-avatar` | 5 | `Avatar` | `UiAvatar` | 低 |
| `el-tabs` / `-tab-pane` | 8 | `Tabs` | `UiTabs` | 低 |
| `el-cascader` / `-panel` | 5 | **无** | `UiCascader`（自建面板） | **高**（见 7.4） |
| `el-dropdown(-menu/-item)` | 11 | `DropdownMenu` | `UiDropdown` | 低 |
| `el-link` / `el-breadcrumb` | 5 | 无 | `UiLink` / `UiBreadcrumb` | 低 |
| `el-alert` / `el-badge` / `el-progress` / `el-card` | 7 | `Progress` 可用，其余无 | `UiAlert` / `UiBadge` / `UiProgress` / `UiCard` | 低 |
| `el-popover` | 2 | `Popover` | `UiPopover` | 低 |
| `el-tree-select` | 2 | `Tree` + `Combobox` | `UiTreeSelect` | 中 |
| `el-descriptions` | 2 | 无 | `UiDescriptions` | 低 |
| `ElMessage` | 155 | `Toast` | `useToast()` | 低（机械） |
| `ElMessageBox` | 10 | `AlertDialog` | `useConfirm()` | 低 |
| `ElNotification` | 5 | `Toast`（多位置变体） | `useNotify()` | 低 |
| `v-loading` 指令 | 17 | 无 | `v-ui-loading` 指令 | 低 |

### 5.2 reka-ui 不提供的能力（必须自建）

`Table`、`Cascader`、`Tag`、`Badge`、`Skeleton`、`Alert`、`Empty`、`Descriptions`、虚拟化下拉、loading 指令、`el-text` 类排版。

其中只有三项有真实工作量：表格、虚拟化下拉、级联面板。其余都是无行为的呈现组件，单文件即可完成。

## 6. 工程机制

### 6.1 过渡期变量桥（关键，勿跳过）

139 个文件、506 处 `--el-*` 引用。如果要求这些文件与组件替换同步改动，任何一个 PR 都会变成不可评审的巨型改动，且无法定位视觉回归来源。

做法：`src/ui/tokens/bridge.scss` 在迁移期内提供别名，**保留 EP 的变量名，但值改由 `--ui-*` 供给**：

```scss
/* 临时脚手架：EP 卸载后删除 */
:root {
  --el-bg-color: var(--ui-color-surface);
  --el-border-color: var(--ui-color-border);
  --el-text-color-primary: var(--ui-color-text);
  --el-text-color-secondary: var(--ui-color-text-muted);
  --el-color-primary: var(--ui-color-accent);
  --el-color-danger: var(--ui-color-danger);
  --el-fill-color-light: var(--ui-color-surface-sunken);
  --el-border-radius-base: var(--ui-radius-control);
  /* …按 83 个变量清单逐个映射… */
}
```

收益：

- 卸掉 `element-plus/dist/index.css` 的当天，这 139 个文件立刻改用 `--ui-*` 的值，**不会变成透明或黑色**（否则整个应用会白屏式崩坏，无法分批验收）。
- 这些文件的视觉随皮肤切换自动跟随，P1 不需要二次改它们。
- 之后按模块逐步把 `--el-*` 改写为 `--ui-*`，改完一个删一个别名，bridge 文件体积单调递减，可作为迁移进度指标。

bridge 必须在 P0 收尾阶段**整体删除**，并在守卫测试中禁止其重新出现。

### 6.2 皮肤切换与灰度

`data-skin` 挂在 `<html>`，由 `useSkin()` 维护，持久化到 `useDark` 同一套 storage 策略。灰度维度：全局默认 → 按路由 → 按用户偏好。P1 上线期间两种皮肤同时可构建、可对比、可一键回退，不需要回滚发布。

### 6.3 守卫测试

新增 `tests/architecture/ui-kit.test.ts`，与既有 `tests/style/scoped-deep.test.ts` 同一套路（源码扫描断言）：

| 断言 | 生效时点 |
| --- | --- |
| `src/ui/**` 不出现 `element-plus`、`@/components`、`@/api`、`@/stores` | 立即 |
| 除 `src/ui/**` 外不出现 `from 'reka-ui'` | 立即 |
| `src/**/*.vue` 不出现 `<el-` | 迁移期内 warn，P0 收尾转 fail |
| `src/**` 不出现 `--el-` | 迁移期内 warn，P0 收尾转 fail |
| `package.json` 不含 `element-plus` | P0 收尾 |
| `bridge.scss` 不存在 | P0 收尾 |

分期把 warn 改 fail，避免"迁移完成但残留"的常见结局。

### 6.4 组件画廊

新增开发态路由 `/__ui`（生产构建剔除），一页渲染全部 `Ui*` 组件 × 全部状态（default / hover / focus / active / disabled / loading / invalid / open）× 两种皮肤 × 明暗两套。

这是本方案里投入产出比最高的一个动作：设计评审、P1 美术验收、回归对比都在同一页完成，不需要 Storybook，也不需要在业务页面里到处找边界状态。

### 6.5 基线测量

`vite.config.ts` 已把 `element-plus` 与 `element-plus-icons` 拆成独立 chunk，因此体积收益可直接读出：迁移前记录一次 `vite build` 产物，迁移后对比该 chunk 归零、`ui` chunk 实际体积。不预设数字，只记录实测值。

## 7. 四个高难点

### 7.1 表单与校验

**现状**：21 个 `el-form`、104 个 `el-form-item`、13 个文件以 `ElFormType` 标注 ref、25 处调用 `validate()`、6 个 `formRules` 文件依赖 `FormItemRule` 类型。

**关键风险（最容易被低估）**：现有代码存在两种 `validate()` 用法，语义相反。

```ts
// 用法 A：依赖「校验失败时 reject」来中断提交（10+ 处）
await formRef.value?.validate()      // 失败必须抛错，后续代码才不执行

// 用法 B：依赖返回值（10+ 处）
const ok = await formRef.value?.validate().catch(() => false)
```

reka-ui 的 `FormRoot.validate()` 返回 `boolean`，**失败不抛错**。若直接映射，用法 A 的十多个提交路径会在校验失败时继续执行，属于会写入脏数据的静默 bug。

**方案**：`UiForm` 包装 `FormRoot`，`validate()` 保留 EP 契约：成功 resolve `true`，失败 reject（携带 `{ errors }`）。这样 A、B 两种写法都无需改动，25 处调用点全部保持原样。

```ts
// src/ui/compose/form/UiForm.vue
const formRef = ref<InstanceType<typeof FormRoot>>()
defineExpose({
  validate: async () => {
    const ok = formRef.value?.validate() ?? true
    if (!ok) throw { valid: false, errors: collectErrors() }
    return true
  },
  clearValidate: () => resetValidity(),
})
```

`UiFormItem` = `FieldRoot` + `FieldLabel` + `FieldError`，保留 `label` / `prop` / `label-width` 三件套，label 宽度用 CSS 变量实现（`--ui-form-label-width`），不引入 grid 重排。

规则转换器把现有 `formRules.ts` 的 EP 风格规则编译为 reka 的 `validate` 函数（返回错误信息或 `null`）：

```ts
// 现有写法保持不变
const rules = { name: [lengthCheck('blur', '名称', 10)] }

// 内部编译
type UiRule = {
  required?: boolean
  message?: string
  pattern?: RegExp
  validator?: (value: unknown, values: Record<string, unknown>) => boolean | Promise<boolean>
  trigger?: 'blur' | 'change'
}
compileRules(rules) → (value, values) => string | string[] | null
```

`requireCheck` / `lengthCheck` / `qqCheck` / `passwordCheck` 等 6 个 helper 保留函数名与参数，只改返回类型。6 个 `formRules` 文件的业务语义零改动。

`validation-mode` 默认 `onBlur`（对齐现有绝大多数规则的 `trigger: 'blur'`），`change` 类规则用 `onChange` 覆盖。

### 7.2 虚拟化下拉（`el-select-v2`）

30 处、15 个文件，其中图标选择器的选项数量级最大，必须虚拟滚动。

reka-ui `Combobox` 本身不虚拟化，但官方 Virtualization 指南基于 `@tanstack/vue-virtual`，两者可组合。`UiCombobox` 需要覆盖的能力：

- 单选 / 多选（`collapse-tags` 对应自有 tag 溢出折叠，用 `+N` 计数实现）
- `filterable` → 内置 `useFilter`，中文分词场景需本地化比较器
- 自定义选项插槽（现有图标选择器在选项内渲染缩略图）
- 键盘导航、`aria-activedescendant`（reka 已提供，不得破坏）

风险点：EP 的 `el-select-v2` 支持 `props: { label, value }` 字段映射与 `filterable` 组合下的性能优化。`UiCombobox` 需保留 `labelKey` / `valueKey` 以降低调用点改动量。

### 7.3 表格

9 张表、93 个 `el-table-column`。**但实际用到的特性面很小**：

| 特性 | 使用次数 | 处理方式 |
| --- | --- | --- |
| `type="selection"` | 2 | 首列 checkbox，行状态由 `Set<id>` 维护 |
| `sortable` | 3 | 表头点击 → 排序函数，无内置排序算法 |
| `fixed="right"` | 3 | `position: sticky; right: 0` + 阴影，纯 CSS |
| `show-overflow-tooltip` | 7 | CSS `text-overflow: ellipsis` + `title` 属性 |
| `type="expand"` | 1 | 展开行 slot |
| `formatter` | 少量 | 列描述里传函数 |

结论：**不引入 TanStack Table，也不引入任何 Grid 库**。`UiTable` 用原生 `<table>` + 列描述数组 + 具名插槽即可，列宽固定（现有列几乎全部写死 `width`），无需自动布局算法。

```ts
const columns: UiColumn<ItemVo>[] = [
  { key: 'id', label: 'ID', width: 70 },
  { key: 'icon', label: '图标', width: 60, cell: 'icon' },
  { key: 'name', label: '物品名称', width: 150, clickable: true },
]
```

`v-loading` 的 17 处调用改为 `v-ui-loading` 指令（自建，约 30 行：插入遮罩节点 + 计数 + `aria-busy`），调用点改一个前缀，`element-loading-text` 改为 `ui-loading-text`。

### 7.4 级联面板

reka-ui v2 **未提供 Cascader**。5 处使用集中在地区代码选择（`AppAreaCodeSelecter` 已是封装，实际调用点 1 处 + 岛屿表单 3 处 + `el-cascader-panel` 1 处）。

`UiCascader` 自建：多列面板 + `Listbox` 语义 + 键盘左右导航。地区树是静态三级结构，列数固定，无需递归布局。预计 150–200 行，风险可控，但**不要试图做成通用级联组件**。

### 7.5 浮层共存期

迁移期间 EP 浮层（`z-index` 2000+）与 `Ui*` 浮层（reka Portal 默认挂 body 末尾）会并存。策略：

- `tokens/scale.scss` 定义 `--ui-z-dropdown: 2100`、`--ui-z-overlay: 2200`、`--ui-z-toast: 2300`，全部高于 EP。
- 迁移期内禁止在 EP 弹窗内部打开 `Ui*` 浮层、反之亦然；跨栈嵌套的组件放到同一批迁移。
- `el-dialog` 与 `AppDialog` / `GlobalDialogService` 合流为单一 `UiDialog`，不留两套弹窗服务。

## 8. 实施路线

### 8.1 P0 分步（每步可独立合并、独立验收）

| 步骤 | 内容 | 主要改动面 | 出口条件 |
| --- | --- | --- | --- |
| **P0-0 脚手架** | `src/ui` 骨架、tokens、modern 皮肤、bridge.scss、守卫测试、`/__ui` 画廊、reka-ui 依赖 | 新增 12–15 文件，无业务改动 | 画廊可渲染空壳；守卫测试全绿；构建体积 baseline 已记录 |
| **P0-1 消息与确认** | `useToast` / `useConfirm` / `useNotify`，迁移 155 + 10 + 5 处调用 | 全站机械替换，可用脚本 | 无 `ElMessage` 残留；toast 在两种皮肤下可读 |
| **P0-2 呈现层** | Button、Icon、Tag、Separator、Text、Link、Breadcrumb、Avatar、Badge、Skeleton、Progress、Card、Alert、Empty | ~330 个标签；按钮图标 67 个改 Iconify | 所有按钮/标签视觉一致；`@element-plus/icons-vue` 引入清零 |
| **P0-3 表单区** | Input、Textarea、NumberField、Switch、Checkbox、Radio、Segmented、Form/FormItem、规则编译器 | 21 表单 + 104 表单项 + 13 个 ref 类型 | 25 处 `validate()` 语义不变；6 个 formRules 文件仅改类型 |
| **P0-4 选择器** | Select、Combobox（虚拟化）、Cascader、TreeSelect、DatePicker | 15 个文件、30 处 select-v2、5 处级联 | 图标选择器 1 万级选项可流畅滚动；键盘可用 |
| **P0-5 容器与浮层** | Dialog、Tooltip、Popover、Dropdown、ContextMenu、ScrollArea | 10 处 dialog + 21 处 scrollbar | 无双 overlay 栈问题；`AppDialog` 服务收敛为单一实现 |
| **P0-6 数据展示** | UiTable、Pagination、`v-ui-loading`、`usePagination` 重写 | 9 张表、93 列、9 处分页、17 处 loading | 固定列、多选、排序、展开行行为对齐 |
| **P0-7 清场** | 删依赖、删样式覆盖、删构建配置、删 bridge、守卫生效 | 见第 9 节 | 见第 10 节验收 |

顺序依据：先做**调用点最多、结构风险最低**的（消息、呈现层），快速削掉 500+ 引用与两个依赖中的图标包；把表单与选择器放在中段，因为它们是割裂感的根源、也是最需要设计评审的部分；表格放最后，因为它只影响 9 个页面且可独立回退。

`P0-2` 结束后应用整体外观会明显"变平"——这是预期内的中间状态，不是回归。应提前与使用方沟通，避免被误判为线上事故。

### 8.2 P1 皮肤改造

P1 不应包含任何 `.vue` 文件改动。工作内容全部在 `skins/genshin/`：

1. T2 全覆盖（上表 P1 列）。
2. 结构装饰：`::before` / `::after` 角花与九宫格边框（`border-image` 或 `clip-path`）。
3. 状态动效：`GSButton` 的圆形裁切与辉光（`--ui-button-*` 状态组）。
4. 字体落地：`HYWenHei-85W` 通过 `--ui-font-ui` 注入，需补 `font-display: swap` 与中文子集（现有 `font-['HYWenHei-85W']` 散落在组件 class 里，迁移后集中到 token）。
5. 在 `/__ui` 画廊逐项验收，再按路由灰度。

若 P1 过程中发现需要改 `.vue`，一律回退到 P0 层补 token 或钩子，不允许在 P1 分支打补丁——否则分层失效，下一种皮肤又要重来。

## 9. 清场清单

| 位置 | 动作 |
| --- | --- |
| `package.json` | 移除 `element-plus`、`@element-plus/icons-vue` |
| `src/main.ts` | 移除 `ElementPlus`、`zhCn` locale、两行 EP CSS 引入、`.use(ElementIcons)` |
| `src/plugin/elementIcons.ts` | 删除，并从 `src/plugin/index.ts` 摘除导出 |
| `src/style/element-plus/` | 整目录删除（6 文件），`app.scss` 中的 `@import` 同步移除 |
| `src/style/app.scss` | 移除 EP 样式链；`transition/` 保留 |
| `vite.config.ts` | 删除 `element-plus`、`element-plus-icons` 两个 codeSplitting 分组；`__VUE_OPTIONS_API__` 改回 `false`（该开关仅为 `el-tree-select` 保留，注释需同步删除；改前须确认无其他 Options API 组件） |
| `uno.config.ts` | 删除为 `.el-button` 背景色打的 preflight 补丁 |
| `src/shared/types.ts` | 删除 `ElFormType` |
| `src/utils/formRules.ts` + 5 个页面级 `formRules.ts` | `FormItemRule` → `UiRule` |
| `src/hooks/usePagination.ts` | `PgUnit` 枚举基于 EP 的 layout 字符串，需重写为自有布局模型 |
| `src/components/AppDialog/types.ts` | 移除 `DialogProps` 依赖（`GlobalDialogPropsHack` 的 `Partial<DialogProps>`） |
| 139 个文件中的 506 处 `--el-*` | 逐模块改写为 `--ui-*`，bridge 别名随之删除 |

最后一项是最容易被漏掉的：它不是"样式微调"，而是**全站配色的所有权交接**。建议按模块分批（每个 `src/pages/*` 一批），每批附 `--el-*` 计数下降数据。

## 10. 验收标准

### 10.1 单组件完成定义（DoD）

- 状态齐全：default / hover / focus-visible / active / disabled / loading / invalid / open
- 键盘：Tab 可进、Esc 可退、方向键可导航（浮层类）
- 无障碍：`aria-*` 由 reka 提供且未被覆盖；焦点环可见；`prefers-reduced-motion` 下动效降级
- 受控/非受控双模式可用
- 明暗 × 双皮肤四象限在 `/__ui` 均正常
- 结构契约（4.3）已声明；`::before` / `::after` 未被占用
- 无硬编码颜色/圆角/字体（可由 grep 校验）

### 10.2 P0 退出门禁

- `package.json` 不含 EP 两个依赖；`node_modules` 重装后可正常构建
- 守卫测试 6 条断言全部为 fail 级且通过
- `--el-*` 引用为 0，`bridge.scss` 已删除
- 25 处 `validate()` 行为与迁移前逐条对照通过（尤其用法 A 的 10+ 处）
- `vite build` 产物中无 EP 相关 chunk，产物体积已记录
- 全站页面走查：登录、注册、8 个管理页、地图标注流程、设置面板

### 10.3 P1 退出门禁

- `git diff --stat` 中不含 `.vue` 文件
- 双皮肤可运行时切换，无刷新
- 画廊四象限通过美术验收

## 11. 风险登记

| 风险 | 影响 | 处置 |
| --- | --- | --- |
| `validate()` 契约不一致 | 校验失败仍提交，写入脏数据 | 保留 reject 语义；10+ 处用法 A 逐条回归（7.1） |
| 表单校验异步语义差异 | EP callback 风格 → reka 返回信息风格，适配层出错 | 规则编译器单测覆盖 6 个 helper 全部分支 |
| 卸掉 EP CSS 后 139 个文件变色/塌陷 | 全站视觉崩坏，无法分批验收 | bridge.scss 先接管变量，再逐个模块交接（6.1） |
| `ScrollArea` 尺寸语义 | reka 需显式尺寸，现有 21 处依赖 `max-height: auto` | `UiScrollArea` 提供 `native` 降级，优先原生滚动条 + 自定义样式 |
| 级联/树选择自建 | 交互细节回归（展开、清空、路径显示） | 限定为地区场景专用件，不做通用化 |
| 双浮层栈 z-index 冲突 | 下拉被弹窗遮挡或反向 | 统一 z 标尺；跨栈组件同批迁移（7.5） |
| 无视觉回归基线 | P0-2 后"变平"被误判为 bug | 迁移前对 12 个关键页面截图存档；主动沟通中间态 |
| 关闭 `__VUE_OPTIONS_API__` | 若有 Options API 组件将白屏 | 改前全局 grep + 构建后全页面走查 |
| 迁移期新增 EP 用法 | 收尾时残留，反复返工 | P0-0 即上线守卫（warn），并在 PR 模板中加检查项 |

## 12. 需要评审确认的三个决策

1. **P0 皮肤是否采用中性蓝灰**（本文 4.2 取值），还是直接沿用现有 `--gs-*` 色系做一版"半原神"过渡？前者 P1 改动更大但 P0 更干净；后者割裂感更小但 P1 会变成"改已有皮肤"而非"新建皮肤"。建议前者。
2. **是否接受 P0-2 之后的全站"变平"中间态**（约 1 个发布周期）。若不接受，需把 P0-2 与 P1 合并发布，工期与风险都会上升。
3. **`Ui` 前缀与 `src/ui` 目录**是否与团队既有命名习惯冲突（现有为 `App*` 业务组合件、`GS*` 原神件、`Win*` 窗口件）。
