# 空荧酒馆地图点位标记系统

<div align="center" />
![空荧后厨](./public/favicon.ico)

## 空荧后厨

[![typescript](https://img.shields.io/badge/typescript-6-blue)](https://www.typescriptlang.org)
[![node.js](https://img.shields.io/badge/node.js-24-green)](https://nodejs.org)
[![vite.js](https://img.shields.io/badge/vite.js-8-green)](https://cn.vitejs.dev)
[![vue.js](https://img.shields.io/badge/vue.js-3-green)](https://cn.vuejs.org)
[![deck.gl](https://img.shields.io/badge/deck.gl-9-B77546)](https://deck.gl)
[![tiptap](https://img.shields.io/badge/tiptap-3-B77546)](https://tiptap.dev)
[![dexie.js](https://img.shields.io/badge/dexie.js-3-B77546)](https://dexie.org)

<div align="left" />

## 项目简介

空荧酒馆原神地图前后台一体应用。

## 项目数据与版权声明

本项目为**非官方**的第三方项目，特此就数据来源与美术资产版权作出如下声明：

1. 项目所展示的全部地图数据、点位信息、内容标注等，均由社区玩家自愿整理、分享与共同维护，数据来源于玩家日常游戏经验总结与集体贡献，**并非源自游戏官方数据源，亦未通过逆向解析、直接读取游戏客户端 / 服务端数据等方式获取**。

2. 项目中所使用的游戏图标、场景素材、角色形象、界面样式等全部美术资产，其知识产权、著作权、商标权等一切合法权利，**均归属于对应游戏开发商所有**。本项目仅出于内容展示与玩家交流目的进行非商业性使用，不用于任何盈利场景，亦不主张对上述资产拥有任何权利。

3. 本项目严格遵守相关知识产权法律法规及游戏用户协议，仅为玩家提供便利化参考工具，无意侵犯任何方合法权益。若涉及版权争议，相关权利方可与项目方联系，我们将第一时间配合整改或移除相关内容。

## 相关项目

1. [地图标记系统后端 (Java)](https://github.com/kongying-tavern/genshin-cloud-api)
2. [地图标记系统后端 (Rust)](https://github.com/kongying-tavern/genshin-cloud-rust)
3. [地图文档 (VitePress)](https://github.com/kongying-tavern/docs)

## 应用预览

![map-preview](https://github.com/user-attachments/assets/129aab31-8d89-41e5-b306-d8410517f14c)

地图主界面

---

![map-marker](https://github.com/user-attachments/assets/7986c08c-aa0d-4557-b577-09fce239f2d1)

点位详情与关联网络

---

![个人中心](https://github.com/user-attachments/assets/c975482b-6c18-450f-8509-eb6620697a63)

基于 CSS Houdini 实现的原神风格化个人中心面板

---

![窗口化管理组件](https://github.com/user-attachments/assets/371962b1-fdf2-4552-aa23-36965b376dbe)

窗口化管理组件

## 开发手册

### 环境变量校验

从模板复制并填写对应的 `.env.<mode>.local` 文件。`dev`、`preview` 和 `build` 会自动校验，也可以单独运行以下命令。 [环境变量模板](./.env.example)

```bash
pnpm check:env
pnpm check:env --command build
pnpm check:env --mode stage --command preview
```

`check:env` 默认按开发服务校验 `development`，`--command build` 默认使用 `production`。`--mode` 可覆盖模式。检查覆盖未知键、必填项以及 Vite 加载后的值格式，失败时退出码为 `1`。

### 标签页恢复后重新加载

`pnpm dev` 使用 Vite 热更新。浏览器冻结后台标签页时，热更新连接可能断开。连接恢复后 Vite 会刷新整页，控制台可看到 `[vite] server connection lost`。

本地需要长时间打开地图时，可以用开发环境配置打包并预览。预览服务提供静态构建产物，修改源码后需要重新构建。

```bash
pnpm build:dev
pnpm preview
```

如果生产预览也发生整页重载，可以在桌面 Chrome 控制台检查 `document.wasDiscarded`。值为 `true` 表示浏览器回收了整个标签页，返回时重新创建了文档。[Chrome 页面生命周期说明](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

### 地图实体同步

点位、物品和点位关联按后端实例、账号与可见权限保存独立的 IndexedDB 基线。设置中的「数据库」页可查看最近在线核对时间、待核对范围和待确认的点位创建。升级时会重建这三类实体的旧缓存，用户存档继续使用原表。

验证目标后端与角色的归档清单、正文摘要、字段和可见范围后，可设置 `VITE_MAP_ENTITY_ARCHIVES=marker,item,markerLink`，也可只填写已验证的资源。默认采用点位完整二进制包和在线差异、物品地区分页以及关联整表读取。移除对应配置可以切回在线路径，已经提交的作用域缓存继续作为核对基线。

详见 [空荧后厨 Wiki](https://github.com/kongying-tavern/genshin-admin-v3/wiki)

## AI 页面句柄

应用内置 `window.__MAP_AI__` 桥接层，让 AI 在不截图、不模拟点击的情况下读取页面状态、打开弹窗/窗口/表单并调用页面能力。

- 详细说明：[docs/ai-bridge.md](./docs/ai-bridge.md)
- 开发环境默认启用（`write`）；生产构建默认关闭，可通过 `?aiBridge=read|write|off`、`localStorage['__map_ai_bridge']` 或 `VITE_AI_BRIDGE` 显式开启。
- 控制台输入 `__MAP_AI__.help()` 查看命令、页面句柄、事件与错误码。


## 项目贡献

![项目贡献统计图](https://repobeats.axiom.co/api/embed/7910e599e7842fa48c48295b7fcbf0d4e39a9c6b.svg)
