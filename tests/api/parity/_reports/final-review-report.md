# Java → Rust 后端迁移：前端可观测行为对齐测试与代码审查报告

> 审查对象：`genshin-admin-v3`（空荧酒馆地图点位后台「空荧后厨」v4.21.0）前端测试体系
> 审查日期：2026-11-13
> 主理人：软件测试专家团 · 陆谨（测试架构师）
> 团队：`test-map-register-v3`
> **门禁结论：不通过**
> 口径：**Java 实测即唯一基准**（含其已知非理想行为）；业务正确性另设参考栏，不参与对齐判定
> 边界：**仅从前端测试侧验证并暴露差异，未改动任何后端实现，未改动 `src/` 业务代码**

---

## 一、历史审查记录

`memory_keeper recall --project map_register_v3`：**会话摘要 0 条 → 本次为该对象首次审查，无历史审查结论**。

命中 5 条已验证教训（均为专家包工具自测产生，非本项目），其中 **LES-001「描述性文件名被误判为测试资产」** 已作为本次额外检查项执行，并据此修正了 2 处工具假阳性：

| 工具原判 | 实际证据 | 修正判定 |
|---|---|---|
| 无障碍测试 = 已发现（"文件名含 accessib"） | 命中 `src/stores/access.ts`、`src/stores/utils/isAccessible.ts`（权限业务代码）与 `reference/.../AuthorizationServerConfiguration.java` | **未发现** |
| 代码审查与整洁度 = 已发现（依据 `.editorconfig`） | 仓库根目录**无** `.editorconfig`；oxlint/oxfmt 仅为 lint 配置且 CI 未执行 | **待核实** |

另发现 `repo_scanner` 把 `tests/api/_support/*.ts` 计入 test_files（30），实际测试文件少于该数。本节仅作对照，不作为本次结论依据。

---

## 二、项目画像

| 项 | 内容 |
|---|---|
| 业务 | 原神地图点位标记系统后台，Vue 3 + TS 管理端 |
| 技术栈 | Vue 3.5 / Vite 8 / Vitest 5 / alova 3 / pinia / socket.io-client 4.8 / TS 6；Node ≥24（实测用 v26.12.1） |
| 接口层 | `src/api/alova/apiDefinitions.ts` 声明 **117 个端点**；`src/api/oauth/oauth.ts` 独立 OAuth 实例 |
| 关键路径 | 登录 `/oauth/token` → pinia 存 token → alova `beforeRequest` 注入 Bearer → 业务接口 → `responded` 统一处理 → 后端 WS 广播 → `socket.worker.ts:146` 解析 `{event,data,time}` → store 刷新 |
| 测试现状（本次前） | 3 个 vitest project（unit / api-contract / api-integration）；9 个集成文件覆盖 32/117 端点；CI 只跑 `unit + api-contract`；`tests/api/_support/backend.ts:23` 的 `skipIf` 会在后端不可达时整体跳过；断言依赖 alova 抛出的 `Error(statusText)` 文案 |
| 质量目标 | 以 Java 为基准，Rust 在**前端可观测行为**上完全对齐 |
| **关键环境事实** | 副作用探测（Java 建地区 `id=689` 在 Rust 可查、Rust 建 `id=690` 在 Java 可查）证实：**两套后端共享同一个数据库** |

**环境溯源（每条观测快照均带 `env` / `envFile` / `baseUrl` / `capturedAt` / `runId`）**

| 环境 | 授权文件 | 后端地址 | 角色 |
|---|---|---|---|
| Java | `.env.development.local` | `http://ddns.minemc.top:13080` | **基准** |
| Rust | `.env.development.rust.local` | `http://ddns.minemc.top:13085` | 待对齐 |

---

## 三、20 类测试覆盖矩阵

| # | 类型 | 判定 | 证据 / 说明 |
|---|---|---|---|
| 1 | 单元测试 | 已发现 | `tests/utils/formatByteSize.test.ts`、`tests/stores/archive.test.ts`、`tests/components/SettingGroup.test.ts` |
| 2 | 集成测试 | 已发现 | `tests/api/integration/*.test.ts`（9 个）、`vitest.config.ts:89-103` |
| 3 | 契约测试 | 已发现 | `tests/api/contract/*.test.ts`（3 个，均为离线 mock）；本次新增双环境契约比对 |
| 4 | 系统/端到端 | 未发现 | 无 e2e 目录、无 playwright/cypress 配置 |
| 5 | 验收 UAT | 未发现 | 无验收标准文档、`feature_files=0` |
| 6 | 冒烟测试 | 未发现 | 无 smoke 标记；本次 `setup.ts` 探活失败抛错（不 skip） |
| 7 | 回归测试 | 未发现 | 无版本化回归基线；CI 注释明确把集成测试留给本地 |
| 8 | 接口 API 测试 | 已发现 | 本次 130 个双环境场景 + 40 个只读端点清单 |
| 9 | 探索性测试 | 待核实 | 无 charter / session 记录，需人工确认 |
| 10 | 性能测试 | 不适用（方案排除） | 未实测，不得写成达标 |
| 11 | 安全测试 | 已发现（仅鉴权会话子域） | 本次真实取证；SAST/DAST/依赖漏洞/渗透标注「不适用（方案排除）」 |
| 12 | 兼容性测试 | 不适用（方案排除） | 未实测 |
| 13 | 可用性测试 | 待核实 | 无真实用户证据 |
| 14 | 无障碍测试 | **未发现**（修正工具假阳性） | 命中项均为业务代码，见「历史审查记录」 |
| 15 | 可靠性测试 | 不适用（方案排除） | 未实测 |
| 16 | 测试覆盖率 | 已发现 | `vitest.config.ts:106-111` + `@vitest/coverage-v8`；本次**未实测覆盖率数据** |
| 17 | 变异测试 | 不适用（方案排除） | 未实测 |
| 18 | QA 流程 | 未发现 | `process_documents=0`，缺 CONTRIBUTING/TESTING/SECURITY |
| 19 | 质量指标 | 未发现 | 无阈值 / 门禁 / 指标定义 |
| 20 | 代码审查与整洁度 | **待核实**（修正工具假阳性） | 根目录无 `.editorconfig`；本次代码审查由何序域在「无源码读取能力」下完成，抽样范围受限 |

> 「未发现」= 本次只读扫描未命中，**不等于项目没做**。扫描未截断（1845 文件，`truncated=false`）。

---

## 四、测试方案

**选定维度（8 项，参与门禁裁决）**：单元·组件级 / 集成·接口级 / 契约测试 / 接口 API 测试 / 系统·验收级 / 冒烟·回归·探索 / 安全（鉴权会话）/ 流程·度量·代码审查。
> 方案文字原表述为 7 项，执行时把「集成·接口级」细分为 4 个域，故实际裁决维度为 8 项，此处如实说明。

**排除维度（标「不适用（方案排除）」，不算缺失）**：性能压测、兼容性、可用性、无障碍、验收 UAT、BDD/Gherkin、变异、可靠性、SAST/DAST/依赖漏洞/渗透。

| 场景组 | 覆盖内容 | 用例文件 |
|---|---|---|
| P0-0 副作用探测 | Java 建地区 → Rust 查、反向再测，判定共享 DB | 前置探测（已执行） |
| ① 鉴权与会话 | 登录/刷新/无凭据/无效凭据/有效凭据/重新登录 | `01-auth-session.test.ts` (8) |
| ② 业务不变量 | 地区树父子挂钩、isFinal 重算、孤立父级、自环、重复 code、跨实体引用、悬空外键、乐观锁、点位关联建组/组内单删/整组裂解 | `06-business-invariants.test.ts` (19)、`10-parity-invariants.test.ts` (20) |
| ③ REST→WS 联动 | 握手鉴权、`MarkerAdded`/`Updated`/`Deleted`/`Linked`/`MarkerLinkageDeleted` | `07-ws-events.test.ts` (7)、`08-ws-handshake.test.ts` (4)、`10` 中 4 条 |
| ④ 请求参数/响应体/状态码/错误码/响应头 | FormData vs JSON、字段类型、安全响应头 | `09-parity-readonly.test.ts` (12) |
| ⑤ 空值与边界/异常 | 缺字段、空串、null、2048 长串、非法类型、不存在 ID、未知端点 | `09` (13) |
| ⑥ 分页排序 | 默认分页、page=0、size=0、超大 size、越界页、5 类分页端点 | `09` (9) |
| ⑦ 端点清单 | 117 端点中 40 个只读端点批量可达性探测 | `09` (1，逐端点独立快照) |
| ⑧ 前端封装层视角 | 从真实原始响应推导 alova `responded` 可见行为 | `11-frontend-view.test.ts` (9) |

**用例总数**：7 个文件、102 个 `it()`；**全部真实请求，零 mock / msw / skip**（已用静态审计确认）；环境不可达判失败；每条结果标注来源环境。

---

## 五、执行档

**execute 档**（用户显式授权连接两个 `.env` 文件）：真实 HTTP / WebSocket 请求，无模拟数据。

| 项 | 结果 |
|---|---|
| 命令 | `pnpm run test:parity`（两端**串行**，因共享 DB） |
| Java | **76/76 通过**，106+ 份快照 |
| Rust | **102/102 通过**（含 06/07 补充用例） |
| 双端匹配场景 | **130 / 130**（无缺失） |
| 完全一致的场景 | **0** |
| 不一致项 | **805 项**，聚合为 **149 类差异模式**；其中 **P0 293 项** |
| 清理 | `cleanup-java.json` / `cleanup-rust.json`：**0 项残留** |
| 未实测项 | 见下节 |

> 用例只做「采集有效性与溯源正确性」自洽断言，**不能以 76/76、102/102 绿灯理解为对齐通过**；跨环境裁决全部由离线 diff 完成。

> **数据口径说明**：闻朔（测试保障级）的静态复核基于**中间轮次**快照（106 场景 / 2108 差异 / P0 1871 / 2 项清理残留）；本报告统计以**最终重跑**为准（130 场景 / 805 差异 / P0 293 / **0 项残留**）——两轮之间修正了 `semanticOf` 的动态字典折叠与差异严重度分级。专家关于「基准未版本化」「残留仅 warn」「strict 首日必红」的结构性结论不受统计口径变化影响；最终轮次残留为 0 也不消除「无测前预清理 / 残留不阻断」这一机制性缺口。

---

## 六、覆盖缺口清单

| # | 缺口类型 | 现状 | 风险 | 建议测试设计 | 优先级 | 闭环方式 |
|---|---|---|---|---|---|---|
| G1 | 验收判定式 | 无「完全对齐」布尔判定式、确认人、归档 | 无法判定放行 | 采用白樾建议：`aligned = 双端匹配数=场景总数 ∧ P0差异=0 ∧ 无阻断项 ∧ 未实测项=0` | P0 | 写入 CI 门禁，人工确认后复评 |
| G2 | E2E 载体 | 无 playwright/cypress、UI 层与前端状态刷新链路未覆盖 | REST 对齐 ≠ 前端可用 | 增加浏览器级 E2E：登录→写操作→WS 事件→store 刷新 | P0 | 复跑并纳入 strict |
| G3 | 覆盖率口径错配 | 代码覆盖率无法反映接口对齐 | 达标数字失真 | 以「对齐覆盖矩阵」替代代码覆盖率作为本任务达标口径 | P1 | 定义指标并复评 |
| G4 | 回归基线 | Java 基线快照未版本化 | 基线漂移、差异不可追溯 | 基线快照入库 + 版本号 + 变更范围选择回归集 | P1 | `test:parity:strict` 接入 CI |
| G5 | WS 契约 | Rust `/ws/` 501，候选侧 WS 联动**未实测**；前端 `WSEventMap` 缺 `MarkerLinkageDeleted` | 实时刷新逻辑失效且无法验证 | 待 Rust WS 服务可用后补跑 `07/08/10` WS 组 | P0 | 服务可用后复跑，逐事件比对 |
| G6 | 端点覆盖 | 117 端点仅安全探测 40 个只读端点 | 写端点 / 二进制端点未比对 | 分批扩展至写端点与 protobuf 二进制端点 | P1 | 逐批补跑 |
| G7 | 共享 DB 归因 | 两端共享同一数据库 | 差异可能来自执行顺序 / 状态残留 | 独立 runId 前缀 + 串行 + 幂等清理（已实施）；仍需按接口重放复核 | P1 | 对 P0 差异逐条双端重放 |
| G8 | 探索性/QA 流程 | 无 charter、无 TESTING 文档、CI 与本地双环境执行断裂 | 流程不可复现 | 补 QA 流程文档并把 `test:parity` 接入流水线 | P2 | 文档评审 + CI 验证 |
| G9 | 冒烟分层与版本化基线 | 闻朔复核确认：无 `test:smoke`、Java 基准每轮重采、无按标签选择回归子集 | 基准漂移不可发现、任何改动都必须全量跑 | 固化 `baselines/java/*.json` 入库 + 基线自检；`--tag` 分组选择；冒烟 L0/L1 分层 + fail-fast | P0 | CI 冒烟先行 + PR 基线评审 |

---

## 七、域结论表

| 审查维度 | 负责专家 | 结论 | 关键证据 |
|---|---|---|---|
| 单元·组件级 | 苏雅 | **有条件通过** | 认可「单端自洽断言 + 离线 diff 分层裁决」方向；断言强度不足；8 条五要素；覆盖率/变异/执行日志未实测 |
| 集成·接口级 | 柯砚 | **不通过（阻断）** | 9 条五要素：会话有效期、Basic 鉴权缺失、403/401、错误体格式、共享 DB 归因污染 |
| 契约测试 | 柯砚 | **不通过（阻断）** | 无消费者驱动契约锁定；基线快照未版本化；WS 事件契约缺项 |
| 接口 API 测试 | 柯砚 | **不通过（阻断）** | 130 场景 805 项差异、P0 293；57 处状态码 / 118 处错误码 / 222 处响应头差异 |
| 系统·验收级 | 白樾 | **不通过（阻断）** | 完整用户路径断在 UI 层；无「完全对齐」判定式；无 .feature 追溯；5 条五要素、10 条未实测 |
| 冒烟·回归·探索 | 闻朔 | **不通过（阻断）** | 7 条五要素（阻断 1/严重 4/一般 2）、14 条精确行号证据、12 条未实测项：`ci.yml:42-44` 无冒烟/回归/parity job；`setup.ts:15-34` 冒烟退化为探活；9 处 `describe.skipIf` 整体掩盖；Java 基准每轮重采未版本化；残留仅 warn 不阻断；strict 从首日必红 |
| 安全（鉴权会话） | 关屿 | **不通过（阻断）** | 6 条五要素：Basic 鉴权缺失、会话有效期 15 倍差、refresh 后旧 token 处置、安全响应头、错误体信息泄漏面、WS 501 |
| 流程·度量·代码审查 | 何序 | **不通过（阻断）** | 8 条五要素：CI 断裂、无质量阈值、无版本化回归基线、无 QA 文档；代码审查抽样范围受限 |
| 性能 / 兼容体验 | 骆骋 / 阮清 | 不适用（方案排除） | 未实测，不得写成达标 |

---

## 八、五要素问题清单

> 以下条目由主理人依据各域专家回传结论与本次真实观测汇编，未新增任何专项判断。

**F-01｜OAuth 客户端 Basic 鉴权在 Rust 缺失**
① 问题描述：不带 Basic 头请求 `POST /oauth/token`，Java 返回 401 拒绝，Rust 返回 200 且正常发放 access_token。
② 测试 bug 点：`auth.login.no-basic`、`frontend.login.no-basic`；`src/api/oauth/oauth.ts:68` 构造 Basic 头但后端未校验。
③ 最优修改方案：在双环境断言中锁定 Java 基准 `status=401 + error body`，把该差异列为 P0 不一致项，推动后端补齐 Basic 校验；前端断言不迁就 Rust。
④ 修改目的：保证鉴权链路在前端可观测行为上对齐，避免前端误认为「无需客户端凭据也可登录」。
⑤ 能否闭环：**能**。复测方式：`pnpm test:parity:java && pnpm test:parity:rust && pnpm test:parity:diff`；通过标准 = 两场景 `response.status` 与 `errorFlag` 与 Java 基线一致。

**F-02｜会话有效期差异 15 倍**
① 问题描述：`expires_in` Java `1799`，Rust `1296000`。
② 测试 bug 点：`auth.login.password`、`auth.refresh`；`src/stores/user.ts` 的过期判断依赖该值。
③ 最优修改方案：把 `expires_in` 纳入前端契约断言（Java 基准值），并补充 token 刷新时机用例。
④ 修改目的：避免前端刷新/登出时机漂移。
⑤ 能否闭环：**能**。复测方式同上；通过标准 = `response.semantic.expires_in` 双端一致。

**F-03｜无凭据状态码 403 vs 401**
① 问题描述：`GET /system/role/list` 无凭据时 Java 403、Rust 401。
② 测试 bug 点：`auth.protected.no-token`；现有断言 `tests/api/integration/auth-ladder.test.ts:31` 写死 `'Forbidden'`。
③ 最优修改方案：改用原始 `status + errorStatus + message` 断言，不再依赖 `statusText` 文案。
④ 修改目的：消除因状态码差异走错登出分支的风险。
⑤ 能否闭环：**能**。通过标准 = 现有集成测试在 Java 基线值下通过，Rust 差异由 diff 清单暴露而非静默通过。

**F-04｜错误体格式：纯文本 vs JSON**
① 问题描述：无效 token 时 Java 返回纯文本非 JSON，Rust 返回结构化 JSON 错误对象。
② 测试 bug 点：`frontend.role-list.invalid-token`（`frontend.bodyWasJson` Java false / Rust true）。
③ 最优修改方案：在前端封装层视图断言中锁定 `bodyWasJson`、`outcome`、`errorText` 的 Java 基线。
④ 修改目的：保证前端异常提示与解析路径一致。
⑤ 能否闭环：**能**。通过标准 = `frontend.*` 字段双端一致。

**F-05｜refresh 后旧 access token 处置不同**
① 问题描述：Java 刷新后原 token 仍可用（200），Rust 变 401；重新登录后恢复。
② 测试 bug 点：`auth.protected.valid-token`、`auth.session.relogin`。
③ 最优修改方案：增加「刷新后旧 token 是否仍有效」的显式契约用例并锁定 Java 基线。
④ 修改目的：避免前端并发请求在刷新窗口内被批量登出。
⑤ 能否闭环：**能**。通过标准 = 两场景状态码与封装层行为与 Java 一致。

**F-06｜安全响应头缺失**
① 问题描述：Java 有 `cache-control: no-store`、`x-content-type-options`、`x-frame-options`、`x-xss-protection`；Rust 仅 `content-type + date`。130 个场景全部命中 `response.headers.<keys>` 差异。
② 测试 bug 点：`response.headers` 归一化比对；`observer.ts::normalizeHeaders`。
③ 最优修改方案：把安全响应头列为响应头契约基线，逐端点比对键集合与取值。
④ 修改目的：缓存与安全策略在前端可观测层对齐。
⑤ 能否闭环：**能**。通过标准 = 安全头键集合与值双端一致。

**F-07｜响应体字段集合与类型差异**
① 问题描述：Java 返回 `users` 用户字典、Rust 恒空；Rust 多 `iconTag:string`；`data[].sort` Java `null` / Rust `number`；字段顺序不同。
② 测试 bug 点：`scenario.schema.*`、`response.semantic.users.<keys>`、`response.semantic.data.__array__.sort`。
③ 最优修改方案：字段路径→类型签名快照比对（已实施），新增字段一律列为不一致项。
④ 修改目的：保证前端渲染数据结构不因迁移变形。
⑤ 能否闭环：**能**。通过标准 = `semantic` 键集合与类型双端一致（顺序差异归信息级）。

**F-08｜Rust 大量端点返回 422 / 501**
① 问题描述：端点清单中多个只读端点 Java 200、Rust 422/501；`/v3/api-docs` Java 200 / Rust 501；写操作（点位新增/更新、地区校验）Java 200/500、Rust 422。
② 测试 bug 点：`inventory.*`、`ws.marker-*`、`invariant.marker.version-conflict`、`bi.area.missing-parentId-rejected`。
③ 最优修改方案：按端点建立「Java 状态码 → Rust 状态码」映射清单，逐项判定「未实现」还是「参数校验口径不同」。
④ 修改目的：区分迁移未完成与行为差异，避免误判。
⑤ 能否闭环：**能（需后端补齐后复跑）**。通过标准 = 每个端点状态双端一致或明确登记为「已确认豁免」并附确认人。

**F-09｜Rust WebSocket 服务未实现**
① 问题描述：Java `/ws/` 可连接并实测捕获 `MarkerAdded` / `MarkerUpdated` / `MarkerDeleted` / `MarkerLinked`；Rust `/ws/` 返回 **501 Not Implemented**，两种握手均 `connect_error`，12 个场景 `ws.connected` 为 false。
② 测试 bug 点：`ws.handshake.*`、`ws.marker-*`；`src/api/ws/typings.d.ts` 的 `WSEventMap` 缺 `MarkerLinkageDeleted`。
③ 最优修改方案：补齐前端 WS 事件类型；Rust WS 服务可用后复跑全部 WS 组，逐事件比对事件名与 payload 结构。
④ 修改目的：保证「RESTful 写操作触发对应 WS 事件」这条用户明确关注的链路对齐。
⑤ 能否闭环：**当前不能（Rust 侧服务未实现，标未实测）**。复测方式 = Rust WS 可用后 `pnpm test:parity:rust`；通过标准 = 事件名、payload 结构、触发顺序与 Java 一致。

**F-10｜skipIf 掩盖环境不可达 + 无验收判定式**
① 问题描述：既有 `tests/api/_support/backend.ts:23` 的 `describe.skipIf` 会让后端不可达时整体跳过；且项目无「完全对齐」判定式与归档。
② 测试 bug 点：`tests/api/_support/backend.ts:23`、`.github/workflows/ci.yml`（只跑 unit+api-contract）。
③ 最优修改方案：双环境运行改用 `setup.ts` 探活失败抛错（已实施）；把 `aligned = 双端匹配 ∧ P0=0 ∧ 无阻断 ∧ 未实测=0` 写进 CI 门禁，`test:parity:strict` 提供非零退出。
④ 修改目的：防止「Rust 没起来」被误读成「已对齐」。
⑤ 能否闭环：**能**。通过标准 = strict 模式在有 P0 差异时退出码 1，且 CI 记录归档。

**F-11｜CI 无冒烟/回归/parity job，冒烟退化为探活**（闻朔 P1，阻断）
① 问题描述：`ci.yml:42-44` 唯一 job 只跑 unit + api-contract；`setup.ts:15-34` 仅判断能否拿到 HTTP 响应，Rust 端可达却 `/ws/` 501、无 Basic 登录返回 200，证明「连通 ≠ 可测」。
② 测试 bug 点：`.github/workflows/ci.yml:42-44`、`tests/api/parity/_support/setup.ts:15-34`、`package.json`（无 `test:smoke`）。
③ 最优修改方案：新增 smoke project / `test:smoke`，L0 三条最小链路（Basic 登录换 token → 带 token 读受保护接口 → docs 可达）每端跑一遍，L0 红即 fail-fast 阻断下游；WS 等增强项归 L1 单独出报告。
④ 修改目的：数分钟内判定「系统是否可测」，区分环境不可测与真回归。
⑤ 能否闭环：**能**。复测：制造停服 / docs 501 / WS 未实现三种故障跑 `test:smoke`；通过标准 = 前两种 ≤5 分钟非零退出且下游 0 用例执行，第三种 L0 全绿而 L1 单列未实现。

**F-12｜旧集成回归集被 `skipIf` 整体掩盖**（闻朔 P2）
① 问题描述：9 个 `tests/api/integration/*.test.ts` 全部 `describe.skipIf(!enabled)`，后端不可达时整组转 skipped（绿）；且不在 CI。
② 测试 bug 点：`tests/api/_support/backend.ts:23`；`area.test.ts:42`、`marker.test.ts:55`、`user.test.ts:20` 等 9 处；`ci.yml:42-44`。
③ 最优修改方案：把 `probeIntegration` 语义改为「不可达 → 显式抛错」，统一打 `@regression` 标记，冒烟子集纳入 CI。
④ 修改目的：消除环境依赖失败被掩盖，使回归红灯可信。
⑤ 能否闭环：**能**。复测：断开后端跑 `--project api-integration`；通过标准 = skipped 数 0、failed ≥1、CI 不显示全绿。

**F-13｜无版本化 Java 基线、无按影响面选择回归集**（闻朔 P3/P5）
① 问题描述：Java 基准每轮重新采集，不是入库锁定的期望基线，无法发现基准侧自身回归；`strict` 判据 `p0 > 0` 在迁移期从首日必红；已有 `tags` 元数据但无 `--tag` 选择入口。
② 测试 bug 点：`tests/api/parity/diff-report.mjs:21-34`、`run-parity.mjs:21,62`、`01-auth-session.test.ts:17,30,46`。
③ 最优修改方案：固化 `baselines/java/*.json` 入库并加「Java 当次采集 vs 锁定基线」自检；`--tag` 分 4 组按改动路径选择；引入已知差异白名单，strict 只对新红灯 / 新 P0 / 残留 / 单端缺失判失败并接入 CI。
④ 修改目的：使「改动后旧功能不被破坏」可被持续、可信判定。
⑤ 能否闭环：**能**。复测：改鉴权模块仅跑 `--tag @auth-session`、篡改基线未走 PR 应被拦截、同版本连跑两轮 Java 零差异；通过标准 = 分组命中率 100%、白名单变更 100% 关联 PR、三种 strict 场景判定 100% 正确。

**F-14｜清理残留仅 warn、无失败隔离**（闻朔 P4）
① 问题描述：中间轮次 Java 侧曾出现 2 项清理残留（marker / area 删除 500），`cleanup.ts:103-105` 仅 `console.warn`，不影响退出码也不被下一轮消费；共享 DB 下无测前预清理与初始状态校验。
② 测试 bug 点：`tests/api/parity/_support/cleanup.ts:97-105`、`setup.ts:36-38`、`run-parity.mjs:62`。
③ 最优修改方案：`beforeAll` 增测前预清理 + 初始状态校验，残留 >0 接入 strict 判据并 fail-fast；失败用例自动重跑 1 次，二次通过者打 `@quarantine`。每端独立 DB 属环境侧长期项，超出本次「不改后端实现」范围。
④ 修改目的：让回归可重复执行，避免环境噪声制造假红灯。
⑤ 能否闭环：**能（前三项）**。复测：同版本连跑 3 轮比对差异一致性、人为注入 1 项残留验证 strict 非零退出；通过标准 = 3 轮结果一致、残留 >0 时 100% fail-fast。

---

## 九、门禁结论

`gate_evaluator` 按**方案选定的 8 个维度**裁决：

```text
结论：不通过
维度统计：通过 0 / 有条件通过 1 / 不通过 7 / 待核实 0
阻断项：7（集成·接口级、契约测试、接口 API 测试、系统·验收级、冒烟·回归·探索、安全、流程·度量）
方案排除维度：9（不参与裁决，不计为缺失）
缺失维度：0
```

**裁决依据**：存在阻断级问题一票否决；且 7 个维度判定不通过。八域结论全部回传，无「待核实」维度；各专家独立标注的未实测子项见各域结论，不影响从严裁决。

### 核心结论（以 Java 为基准）

| 观测项 | Java（`.env.development.local`） | Rust（`.env.development.rust.local`） |
|---|---|---|
| 无凭据访问受保护接口 | 403 | 401 |
| 无 Basic 登录 | 401 拒绝 | **200 且发放 token** |
| `expires_in` | 1799 | 1296000 |
| refresh 后旧 token | 仍可用 200 | 401 |
| 安全响应头 | 4 项安全头齐全 | 仅 content-type + date |
| 业务响应 `users` 字典 | 有用户字典 | 恒空 `{}` |
| `/v3/api-docs` | 200 | 501 |
| `/ws/` 与 REST→WS 事件 | 可连接，事件齐备 | **501，事件全部缺失** |
| 只读端点批量探测 | 多数 200 | 多处 422 / 501 |

> **130 个场景没有一个完全一致**。Rust 后端当前**未达成**「在前端可观测行为上完全对齐」的目标。

### 复评条件（全部满足才可能改判）

1. 149 类差异模式中 P0 全部闭环或经人工确认豁免并登记 `waiverId / confirmedBy`；
2. Rust WS 服务可用，REST→WS 联动 12 个场景在候选侧完成实测；
3. 补齐「完全对齐」布尔判定式并接入 CI（`test:parity:strict`）；
4. 补齐冒烟分层（`test:smoke` L0/L1）与版本化 Java 基线，把 `test:parity:strict` 接入 CI 并建立已知差异白名单；
5. 共享 DB 下对 P0 差异逐条做双端重放，排除执行顺序与状态残留造成的归因污染。

### 交付物

| 类别 | 文件 |
|---|---|
| 双环境切换配置 | `vitest.parity.config.ts`、`package.json`（新增 5 个 `test:parity*` 脚本） |
| 支持层 | `tests/api/parity/_support/{env,client,observer,session,cleanup,ws,frontendView,setup}.ts` |
| 测试用例 | `tests/api/parity/cases/01,06,07,08,09,10,11-*.test.ts`（7 文件 / 102 用例） |
| 运行与比对引擎 | `tests/api/parity/run-parity.mjs`、`diff-report.mjs` |
| 双环境比对结果 | `_reports/parity-result.md`、`parity-result.json`、`snapshots/<env>/*.json`（260 份） |
| 不一致项清单 | `_reports/diff-list.md`（149 类差异模式 + P0 明细） |
| 前端断言修正项 | `_reports/assertion-fixes.md` |
| Java 基线偏差参考栏 | `_reports/java-baseline-deviations.md`（不参与对齐判定） |
| 门禁裁决 | `_reports/gate-findings.json`、`gate-verdict.json` |
| 环境溯源 | `_reports/env-java.json`、`env-rust.json`、`cleanup-*.json` |

### 未改动声明

本次**未修改任何后端实现**、未修改 `src/` 下业务代码、未修改既有 `vitest.config.ts` 与既有测试文件；仅新增前端测试侧资产，并在 `package.json` 追加脚本。凭据仅在进程内注入，未写入任何产物、未在报告中输出。
