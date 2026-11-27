# 主 Service Worker 静态资源缓存重构方案

基线为 `dev@ac67f13a`。主 Service Worker（SW）负责字体、图标和地下附加图层的运行时缓存。底图瓦片的加载、OPFS 和旧条目迁移已由地图包接管。两者的接口是现有的瓦片 URL 直通和 `TILE_BYPASS_PROBE` / `TILE_BYPASS_ACK` 握手。直通判断须早于图标匹配和请求日志，旧瓦片库的处置权属于地图包。[主 SW](../../src/worker/service/service.worker.ts) · [瓦片迁移方案](./tile-cache-opfs.md) · [握手协议](../../src/packages/map/src/utils/tileServiceWorkerProtocol.ts)

## 一、先收窄请求和日志

现有 SW 在筛选非瓦片请求前记录完整 URL，再把日志广播到同源窗口，其中也包括未受该 SW 控制的页面。OAuth 刷新请求的查询串含 `refresh_token`，而页面在判断日志是否可见之前就已将记录放进 `logList`。修复应放在消息产生处，同时覆盖命中、写入和错误日志。[刷新请求](../../src/api/oauth/oauth.ts) · [SW 日志](../../src/worker/service/utils/service-worker-logger.ts) · [页面日志](../../src/stores/dev.ts)

- 在 `fetch` 监听器中同步筛选。只接管 HTTP(S) 的公开静态 GET 请求。导航、API、带 `Range` 或 `Authorization` 的请求、携带跨域凭据的请求以及 `cache: 'no-store'`、`'only-if-cached'` 直接交给浏览器。开发地址按请求的 `URL.hostname` 判断，覆盖带端口的 `localhost`、`127.0.0.1` 和 IPv6 回环地址。
- 字体按 `request.destination === 'font'` 识别，保留 WOFF2 使用 `application/octet-stream` 的兼容。图像按 `destination` 或脚本请求的图片扩展名识别，再匹配 `/d/underground/`、现有 OSS 图片地址或 `/icons/`。通用音视频类型和闲置的 WASM 分支可以移除，`7zz.wasm` 已由 `Zip` 通过 IndexedDB 复用。[字体加载](../../src/stores/dadian.ts) · [图标预渲染](../../src/stores/hooks/useIconTextureRender.ts) · [WASM 加载](../../src/utils/Zip.ts)
- 请求诊断只记录资源类别、操作、HTTP 状态或归一化错误名。原始 URL、查询串及可能含 URL 的异常消息都不进入消息体。用 `clients.get(event.clientId)` 找到发起请求的窗口再投递，窗口已关闭或缺少窗口 ID 时跳过。安装和激活只在 SW 本地记录摘要。沿用页面现有 `log(type, message)` 消息格式，让升级时仍打开的页面也能接收。[页面注册和消息入口](../../src/plugin/createPWA.ts) · [消息类型](../../types/service-worker.d.ts)

## 二、让缓存故障只影响复用

在该基线用 Chromium 请求本地图标，服务端返回带 `Vary: *` 的 `200 image/png`，SW 最终交给页面的是空的 404。原因是 `Cache.put` 按规范拒绝该响应，外层的统一异常处理丢弃了已下载的图片。同一轮验证中，普通重复读取和显式 `fetch(..., { cache: 'reload' })` 都命中旧图，三次读取只访问了服务器一次。[现有响应处理](../../src/worker/service/service.worker.ts) · [Cache.put 规范](https://w3c.github.io/ServiceWorker/#cache-put)

| 请求或响应条件 | 目标行为 |
| --- | --- |
| 普通 GET | 用原始 `Request` 做 `match`、`put` 和条目删除，保留完整查询串与 `Vary` 所需的请求头。只复用状态、响应类型及 MIME 均合法的条目。 |
| 显式 `reload` 或 `no-cache` | 跳过本地命中，携带调用方的缓存模式执行一次 `fetch(request)`。符合写入条件的成功响应更新同一条目，网络失败保留其失败语义。 |
| 普通读取的更新策略 | 响应的缓存指令允许时，按内容哈希命名的图标可长期复用。普通图标、字体和附加图层按 `Cache-Control`、可读取的 `Date` 和 `Age` 判断新鲜度。过期或无从判断时交给浏览器 HTTP 缓存重新核对。普通请求断网时可回退到有效旧副本，遵守 `no-cache` 和 `must-revalidate` 的重新验证要求。[图标命名](../../src/pages/pageIconManager/hooks/useIconUpdate.ts) · [HTTP 缓存规则](https://www.rfc-editor.org/rfc/rfc9111.html) |
| 写入资格 | 只存完整的 200 响应。图标和附加图层要求 `image/*`，字体沿用现有 MIME 列表。跳过 opaque 响应、部分内容、`Vary: *` 以及声明 `private` 或 `no-store` 的响应。服务器明确撤回资源或禁止存储时，尽力清掉该请求的旧副本。 |

对符合条件的请求，在事件回调内同步调用 `event.respondWith(...)`。处理函数打开库、读取条目或清理坏条目失败时仍可回源。取得可缓存的网络响应后立即克隆，在响应 Promise 兑现前用 `event.waitUntil(...)` 登记已捕获异常的写入任务，随后返回原响应。缓存写满、图片类型不匹配或后台写入失败均不改变页面拿到的状态和正文。服务器返回的 403、404、5xx 原样传递，取消请求或离线且无可用副本时让原请求失败。

## 三、让激活和设置页识别同一批缓存

当前激活代码会清除同源下所有缺少 `v` 或版本小于 3 的库。设置页在瓦片迁移后通过 `listStorageCaches()` 取得 `tileCaches` 和 `cacheKeys`，后者仍可能包含其他应用的库名。将库名的识别规则提成纯函数，供 SW 和设置页按应用标记、注册作用域、资源类别及格式版本判断能否读取或删除。[缓存名编解码](../../src/worker/service/utils/cache-meta.ts) · [当前列表来源](../../src/packages/map/src/utils/tileCache.ts) · [设置页](../../src/components/AppSettings/modules/dashboard/ModuleDashboard.vue)

1. **新库。** 用 `URLSearchParams` 编码新名称，例如根作用域的 `app=genshin-admin-sw&s=%2F&n=icons&v=4&t=image&m=cors`。保留独立的数值 `v` 字段，使旧版解析器也能识别版本。激活只删除本应用、本作用域、明确支持淘汰的旧格式。未知库、其他作用域和更高版本均跳过。即使枚举或删除失败，仍执行 `clients.claim()`。
2. **已有 v3 用户。** 旧脚本注册在根目录，兼容读取只对根作用域启用。新库未命中时，按原请求查对应的精确旧库名，如 `n=fonts&v=3&t=font&m=cors`。仅接受与当前类别相符、可公开复用的响应。旧代码用 URL 字符串作键，无法确认 `Vary` 变体一致时应重新获取。有效条目按访问迁入，新库写入成功才移除对应旧条目。升级不批量清空无应用标记的旧库。地图包仍使用原有 `CacheMeta` 编解码格式定位自己的历史数据。
3. **手动清理。** 设置页只在通用 `cacheKeys` 分支应用归属判断。新库匹配应用和作用域后可整库删除。对精确匹配的 v3 字体、图标和附加图层库，只按兼容读取规则逐项清除，未知名字不进入通用列表。用户清理时先让同类在途回填结束或失效，再处理旧副本和新库，失败可重试。现有 `tileCaches` 列表继续调用专用清理入口。

## 实施顺序与验收

先交付请求筛选和日志定向，再拆分网络响应与缓存写入，最后切换库名并接入设置页。第三步同时交付旧库读取和归属测试。若升级后出现兼容问题，可先让相关资源直通浏览器，保留日志脱敏与激活清理的归属判断。

| 场景 | 通过条件 |
| --- | --- |
| 两个页面同时打开 | 用带占位查询参数的图标验证只有发起页收到资源诊断，消息中没有参数值。非资源请求产生的 SW 请求日志为零。 |
| 请求直接交给浏览器 | 对非 GET、带 `Range` 或 `Authorization` 的请求、`no-store` 和带端口的回环地址，SW 调用 `respondWith` 和打开缓存库的次数均为零。正常的跨域字体与脚本加载的 OSS 图标仍可缓存。 |
| 缓存或网络单独失败 | 分别令 `open`、`match`、`delete`、`put` 拒绝，核对回源次数至多一次，成功响应的状态及正文可用。延迟写入完成也能先读取正文。真实浏览器中带 `Vary: *` 的 PNG 收到 200，缓存中没有该响应。 |
| 类型、新鲜度和变体 | 对已有字体 MIME 用例补充明确的新鲜度，连续读取只下载一次。HTML 错误页不入库。覆盖同 URL 不同 `Vary` 请求头、`reload` 后内容更新、`no-store` 直通和断网回退。[现有 SW 用例](../../tests/worker/serviceWorkerFontCache.test.ts) |
| 升级、清理和重复激活 | 在同一存储中放入合法 v3 字体、当前库、其他应用库、其他作用域、未来版本和旧瓦片库。验证旧字体仍可使用，自动清理与设置页删除只触及选定的自有资源，多次激活结果一致。[设置页测试](../../tests/components/ModuleDashboard.test.ts) |
| 与既有瓦片接口共存 | 沿用现有直通与握手回归。匹配的请求不调用 `respondWith`、不开 SW 缓存库，探测只回复消息来源。[直通测试](../../tests/worker/serviceWorkerFontCache.test.ts) · [控制器切换测试](../../tests/worker/tileServiceWorker.test.ts) |

单测使用可注入的 Cache Storage、网络和客户端替身。浏览器冒烟用可控的图标与字体响应验证原生 `Vary`、离线读取和多页消息。实施完成后运行 `pnpm typecheck`、`pnpm test:run --project unit`、`pnpm lint` 和 `pnpm build`。
