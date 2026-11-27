# 底图瓦片读取与 OPFS 缓存迁移计划

在 `dev@85e7cbe8`，主地图和选址小地图都通过 `GSTileLayer.getTileData` 读取当前视口的瓦片。先抽出这个入口里的网络请求，再把按 URL 命中的磁盘缓存从 Service Worker 的 Cache Storage 迁到 OPFS。完成后，首次浏览从资源服务器取图，重新打开已浏览的区域可以直接读本机文件。[地形图层入口](../../src/hooks/useMapLayers/index.ts) · [选址小地图](../../src/components/MapContextMenu/PlacementMinimap.vue)

## 一、抽离瓦片的直接 fetch

在地图包的 `src/packages/map/src/utils/` 下新增 `tileSource.ts`。图层将 `code`、`extension`、deck.gl 的 `{ x, y, z }` 和可选的 `signal` 传给 `loadTile`。模块内部用 `fetchTile(url, signal)` 发起 CORS 请求，保留原始响应的状态和图片类型，供下一步判断是否缓存。[当前瓦片实现](../../src/packages/map/src/core/gsTileLayer.ts)

- URL 沿用 `${VITE_ASSETS_BASE}/tiles_${code}/${z + 13}/${x}_${y}.${extension}`，扩展名默认 `png`。例如 `z = -3`、`x = -1`、`y = 2` 对应 `tiles_<code>/10/-1_2.png`。坐标和资源层级只在此处拼接一次。
- `loadTile` 解码图片，返回图层现有的 `{ url, image, byteLength }`，其中 `byteLength` 取原始 Blob 的大小。网络或解码失败返回 `null`。请求前和解码后检查取消信号，释放刚解码但已取消的 `ImageBitmap`。两个画布分别持有位图和取消信号。
- 这一步可独立验收。用可控的 `fetch` 核对层级 10 和 13、负坐标、自定义扩展名、CORS 及信号传递，再用现有 WebGL 恢复测试检查图层克隆。[图层恢复测试](../../tests/map/GenshinMapDeck.test.ts)

## 二、把按需缓存迁到 OPFS

在 `tileSource.ts` 旁新增 `tileCache.ts`，封装文件读取、写入和按底图清理。通过 `navigator.storage.getDirectory()` 延迟打开目录，在页面中使用异步文件 API。每张瓦片保存一份原始图片，路径为 `map-tiles/<图源键>/tiles_<编码后的 code>/<资源层级>/<x>_<y>.<扩展名>`。图源键取规范化资源基址（含主机和路径）的摘要，同源应用切换资源服务器时也能区分同名底图。[OPFS 文件接口](https://fs.spec.whatwg.org/)

### 读取与落盘

1. `loadTile` 先查 OPFS。文件非空且能解码，即返回原资源 URL 和解码结果。缺文件或空文件按未命中处理。遇到解码失败的本地文件，跳过旧缓存，向资源服务器重取一次，成功后用有效图片覆盖坏文件。
2. 升级过渡期按完整 URL 查该底图的旧缓存。命中有效图片就用它绘制并写入 OPFS。两处都取不到有效图片时才调用 `fetchTile`。网络响应沿用现有解码行为。只有完整的 HTTP 200、`Content-Type` 为 `image/*`、非空且已成功解码的图片才写入 OPFS。
3. 用 `createWritable()` 写 Blob，以 `close()` 成功作为落盘完成条件。写入中断时终止写流，下次读取按上述规则处理。OPFS 不可用时走在线读取，配额不足或写入失败时仍把已解码的图片交给图层。并发读取同一瓦片时，一张地图取消请求只结束自己的读取。[文件写入语义](https://fs.spec.whatwg.org/#dom-filesystemfilehandle-createwritable)

### Service Worker 和旧缓存交接

- 新 SW 在 `fetch` 监听器中，按资源基址及 `tiles_<code>/<层级>/<x>_<y>.<扩展名>` 路径识别瓦片并直接放行。判断放在通用 `oss.` 图标匹配之前，防止瓦片被写进图标库。移除原有 `tiles-<code>` 写缓存分支。[SW 匹配与写入](../../src/worker/service/service.worker.ts)
- 新页面向当前控制页面的 SW 发一次消息确认瓦片已放行，确认前直接调用 `fetchTile`。无控制器或收到确认时启用 OPFS，收到 `controllerchange` 后重新判断。仍运行旧页面代码的标签页被新 SW 接管后按原 URL 在线取图，刷新后使用 OPFS。[SW 注册入口](../../src/plugin/createPWA.ts)
- 旧瓦片按访问迁移。用 `CacheMeta` 定位现有的 `n=tiles-<code>&v=3&t=image&m=cors`，只有图片校验通过且 OPFS 写入成功后，才删除对应旧条目。保留 SW 的全局缓存格式号，避免激活时连带清除字体等资源。[缓存名编码](../../src/worker/service/utils/cache-meta.ts)
- 「设置 → 基本信息 → 本地存储」已有按库删除入口。瓦片项列举 OPFS 底图目录和过渡期旧瓦片库。清理前让选中底图的在途写入结束或失效，再删除目录及旧库中属于该图源和底图的条目。资源服务器原址换图时，可通过这个入口重新取图。[现有缓存清理入口](../../src/components/AppSettings/modules/dashboard/ModuleDashboard.vue)

### 迁移验收

| 场景 | 通过条件 |
| --- | --- |
| 首次访问后重建图层，在已启动的页面阻断瓦片网络请求 | 首次取得图片并写入 OPFS。重建后主地图和选址小地图均能显示同一片，瓦片网络请求为零。 |
| 旧库有瓦片，或仍由旧 SW 控制页面 | 切换控制器后，有效旧条目可在断网时迁移，成功落盘才移除。针对 `oss.` 主机的瓦片请求，新版 SW 的 `respondWith` 调用数为零。字体请求能命中原库。[现有 SW 字体测试](../../tests/worker/serviceWorkerFontCache.test.ts) |
| 注入坏文件、HTML 错误页、取消请求或写盘失败 | 坏文件只回源一次。错误页和中断请求产生的有效缓存条目数为零。写盘失败的有效网络图片仍可绘制。 |
| 清理一张底图，随后重新打开 | 清理完成后重建图层，该底图再次从网络读取。另一张底图仍能从 OPFS 命中。 |

实施时用 Vitest 的存储替身覆盖命中、回源、取消和 SW 分流，再用真实浏览器覆盖文件写入、离线重读和旧缓存交接。
