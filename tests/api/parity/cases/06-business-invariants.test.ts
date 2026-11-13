import { describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import { track } from '../_support/cleanup'
import { testPrefix } from '../_support/env'
import { capture } from '../_support/observer'
import { getToken } from '../_support/session'

/**
 * ⑥ 业务不变量：地区树、跨实体引用、点位关联（单删 / 裂解）、乐观锁的双环境行为对齐。
 *
 * 口径：**Java 实测即唯一基准**，包含其已知的「非理想行为」——孤立 parentId、悬空外键、
 * 删除地区不级联物品、code 不唯一、点位关联删除无需前端事件类型等。这里绝不以理想语义
 * 下断言，只确认「响应确实来自真实后端」；各行为的 Java 基线出处写入 note，跨环境差异
 * 统一由离线 diff-report.mjs 以 Java 为基线裁决。
 *
 * 两套后端共享同一个数据库：所有创建数据以 testPrefix 命名并 track(type, id) 登记，
 * 由 _support/setup.ts 的全局 afterAll → cleanupAll 按引用顺序（叶到根）回收。
 * 前置场景数据一律用 rawRequest 真实创建，禁止任何 mock / msw / 模拟事件。
 */
describe('parity / 业务不变量', () => {
  let seq = 0
  const uniq = () => `${Date.now().toString(36)}_${seq++}`
  const codeTag = () => `${testPrefix}${uniq()}`.toUpperCase().replace(/[^A-Z0-9_.-]/g, '')

  const createArea = async (token: string, overrides: Record<string, unknown> = {}) => {
    const body = {
      name: `${testPrefix}area_${uniq()}`,
      code: `C:${codeTag()}`,
      parentId: -1,
      sortIndex: 0,
      ...overrides,
    }
    const res = await rawRequest({ method: 'PUT', path: '/api/area/add', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('area', id)
    return { id: typeof id === 'number' ? id : -1, body, res }
  }

  const getArea = async (token: string, areaId: number) =>
    await rawRequest({ method: 'POST', path: `/api/area/get/${areaId}`, token })

  const createItem = async (token: string, areaId: number, overrides: Record<string, unknown> = {}) => {
    const body = {
      name: `${testPrefix}item_${uniq()}`,
      areaId,
      defaultCount: 1,
      defaultRefreshTime: 0,
      defaultContent: '',
      iconStyleType: 0,
      hiddenFlag: 0,
      sortIndex: 0,
      specialFlag: 0,
      ...overrides,
    }
    const res = await rawRequest({ method: 'PUT', path: '/api/item/add', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('item', id)
    return { id: typeof id === 'number' ? id : -1, body, res }
  }

  const readItem = async (token: string, itemId: number) =>
    await rawRequest({ method: 'POST', path: '/api/item/get/list_byid', token, body: [itemId] })

  const createMarker = async (token: string, itemList: { itemId: number, count: number }[] = []) => {
    const body = {
      markerTitle: `${testPrefix}marker_${uniq()}`,
      position: '100.5,200.5',
      content: `${testPrefix}content`,
      refreshTime: 0,
      hiddenFlag: 0,
      extra: {},
      itemList,
    }
    const res = await rawRequest({ method: 'PUT', path: '/api/marker/single', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('marker', id)
    return { id: typeof id === 'number' ? id : -1, body, res }
  }

  const readMarker = async (token: string, markerId: number) => {
    const res = await rawRequest({
      method: 'POST',
      path: '/api/marker/get/list_byid',
      token,
      body: { markerIdList: [markerId] },
    })
    const list = Array.isArray(res.body?.data) ? res.body.data : []
    return { res, marker: list[0] as Record<string, unknown> | undefined }
  }

  const createIcon = async (token: string) => {
    const body = {
      tag: `${testPrefix}icon_${uniq()}`,
      url: 'https://example.test/parity/icon.png',
      description: 'parity icon',
      typeIdList: [],
    }
    const res = await rawRequest({ method: 'PUT', path: '/api/icon/add', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('icon', id)
    return { id: typeof id === 'number' ? id : -1, res }
  }

  const createItemType = async (token: string) => {
    const body = {
      name: `${testPrefix}itemtype_${uniq()}`,
      parentId: -1,
      sortIndex: 0,
      hiddenFlag: 0,
    }
    const res = await rawRequest({ method: 'PUT', path: '/api/item_type/add', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('itemType', id)
    return { id: typeof id === 'number' ? id : -1, res }
  }

  const createLinkGroup = async (token: string, fromId: number, toId: number) => {
    const groupId = `${testPrefix}grp_${uniq()}`
    const body = [{ groupId, fromId, toId, linkAction: 'RELATED', linkReverse: false }]
    const res = await rawRequest({ method: 'POST', path: '/api/marker_link/link', token, body })
    const returned = res.body?.data
    const effective = typeof returned === 'string' && returned ? returned : groupId
    track('linkage', effective, effective)
    return { res, body, groupId: effective }
  }

  const readLinkGroup = async (token: string, groupId: string) => {
    const body = { groupIds: [groupId], isTraverse: false }
    const res = await rawRequest({ method: 'POST', path: '/api/marker_link/get/list', token, body })
    const ids: number[] = []
    const data = res.body?.data
    if (data && typeof data === 'object') {
      for (const list of Object.values(data as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue
        for (const item of list) {
          if (item && typeof (item as Record<string, unknown>).id === 'number')
            ids.push((item as Record<string, unknown>).id as number)
        }
      }
    }
    return { res, body, ids }
  }

  // ============================== A. 地区树 ==============================

  it('bi.area.list.direct-children：isTraverse=false 只返回直接子级', async () => {
    const token = await getToken()
    const input = await capture('bi.area.list.direct-children', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const root = await createArea(token)
      await createArea(token, { parentId: root.id })
      await createArea(token, { parentId: root.id })
      const child = await createArea(token, { parentId: root.id })
      await createArea(token, { parentId: child.id })
      const body = { parentId: root.id, isTraverse: false }
      return {
        res: await rawRequest({ method: 'POST', path: '/api/area/get/list', token, body }),
        method: 'POST',
        path: '/api/area/get/list',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：listArea(isTraverse=false) 只取直接子级、不含孙级，出处 tests/api/integration/area.test.ts:99-110、:27',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.list.subtree-traverse：isTraverse=true 返回整棵子树', async () => {
    const token = await getToken()
    const input = await capture('bi.area.list.subtree-traverse', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const root = await createArea(token)
      await createArea(token, { parentId: root.id })
      const child = await createArea(token, { parentId: root.id })
      await createArea(token, { parentId: child.id })
      const body = { parentId: root.id, isTraverse: true }
      return {
        res: await rawRequest({ method: 'POST', path: '/api/area/get/list', token, body }),
        method: 'POST',
        path: '/api/area/get/list',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：listArea(isTraverse=true) 递归取全部后代（不含自身），出处 tests/api/integration/area.test.ts:112-116、:27',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.isFinal.new-forced-true：新建地区强制 isFinal=true（入参被覆盖）', async () => {
    const token = await getToken()
    const input = await capture('bi.area.isFinal.new-forced-true', ['business-invariant', 'response-schema'], async () => {
      const root = await createArea(token, { isFinal: false })
      return {
        res: await getArea(token, root.id),
        method: 'POST',
        path: `/api/area/get/${root.id}`,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：createArea 强制新地区 isFinal=true，入参 false 被覆盖，出处 tests/api/integration/area.test.ts:198-203、:22',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.isFinal.parent-nonfinal：有子级后父级置为非末端', async () => {
    const token = await getToken()
    const input = await capture('bi.area.isFinal.parent-nonfinal', ['business-invariant', 'response-schema'], async () => {
      const root = await createArea(token)
      await createArea(token, { parentId: root.id })
      return {
        res: await getArea(token, root.id),
        method: 'POST',
        path: `/api/area/get/${root.id}`,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：新增子级把父级置为非末端（isFinal=false），出处 tests/api/integration/area.test.ts:204-206、:22-23',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.isFinal.restore-after-delete：删除唯一子级后父级恢复末端', async () => {
    const token = await getToken()
    const input = await capture('bi.area.isFinal.restore-after-delete', ['business-invariant', 'response-schema'], async () => {
      const root = await createArea(token)
      const child = await createArea(token, { parentId: root.id })
      await rawRequest({ method: 'DELETE', path: `/api/area/${child.id}`, token })
      return {
        res: await getArea(token, root.id),
        method: 'POST',
        path: `/api/area/get/${root.id}`,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：删除子级后重算父级末端标志、恢复 isFinal=true；前置 DELETE 子级后采集父级查询响应，出处 tests/api/integration/area.test.ts:209-218、:24',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.parent-change：变更父级并重算原/新父级末端标志', async () => {
    const token = await getToken()
    const input = await capture('bi.area.parent-change', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const oldParent = await createArea(token)
      const newParent = await createArea(token)
      const name = `${testPrefix}area_${uniq()}`
      const code = `C:${codeTag()}`
      const child = await createArea(token, { parentId: oldParent.id, name, code })
      const body = { id: child.id, name, code, parentId: newParent.id }
      return {
        res: await rawRequest({ method: 'POST', path: '/api/area/update', token, body }),
        method: 'POST',
        path: '/api/area/update',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：updateArea 变更父级时原父级恢复末端、新父级变为非末端，本地区 isFinal 按子级数量重算，出处 tests/api/integration/area.test.ts:220-239、:23-24',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.self-loop-rejected：把自身 id 作为 parentId 被拒绝', async () => {
    const token = await getToken()
    const input = await capture('bi.area.self-loop-rejected', ['business-invariant', 'exception', 'error-code', 'request-params'], async () => {
      const area = await createArea(token)
      const body = { id: area.id, name: area.body.name, code: area.body.code, parentId: area.id }
      return {
        res: await rawRequest({ method: 'POST', path: '/api/area/update', token, body }),
        method: 'POST',
        path: '/api/area/update',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：parentId 等于自身 id 触发「指定的父节点无效」守卫；采集原始状态码与业务错误码，出处 tests/api/integration/area.test.ts:164-174、:23',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.missing-parentId-rejected：新增地区缺少 parentId 被拒绝', async () => {
    const token = await getToken()
    const input = await capture('bi.area.missing-parentId-rejected', ['business-invariant', 'exception', 'error-code', 'request-params'], async () => {
      const body = { name: `${testPrefix}area_${uniq()}`, code: `C:${codeTag()}` }
      return {
        res: await rawRequest({ method: 'PUT', path: '/api/area/add', token, body }),
        method: 'PUT',
        path: '/api/area/add',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：createArea 缺 parentId 提示「父节点不能为空」；该被拒请求不产生数据，出处 tests/api/integration/area.test.ts:131-139、:20',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.orphan-parent-allowed：孤立父级（parentId 指向不存在的 id）被允许', async () => {
    const token = await getToken()
    const input = await capture('bi.area.orphan-parent-allowed', ['business-invariant', 'response-schema'], async () => {
      const ghostParentId = 999999999
      const area = await createArea(token, { parentId: ghostParentId })
      return {
        res: area.res,
        method: 'PUT',
        path: '/api/area/add',
        body: area.body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为（非理想）：允许 parentId 指向不存在的父级形成孤立地区、且可按该 parentId 检索到，但无法被 -1 递归检索；出处 tests/api/integration/area.test.ts:275-291、:30、java-baseline-deviations.md 第 1 条。孤立地区已 track、按 id 精确回收。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.duplicate-code-allowed：重复 code 不阻止创建', async () => {
    const token = await getToken()
    const input = await capture('bi.area.duplicate-code-allowed', ['business-invariant', 'response-schema'], async () => {
      const code = `C:${codeTag()}`
      await createArea(token, { code })
      const second = await createArea(token, { code })
      return {
        res: second.res,
        method: 'PUT',
        path: '/api/area/add',
        body: second.body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为（非理想）：code 不唯一、重复 code 仍可创建第二个地区；出处 tests/api/integration/area.test.ts:293-310、:23、java-baseline-deviations.md 第 4 条',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.area.delete-cascade-subtree：删除父级递归删除整棵子树', async () => {
    const token = await getToken()
    const input = await capture('bi.area.delete-cascade-subtree', ['business-invariant', 'response-schema'], async () => {
      const root = await createArea(token)
      const child = await createArea(token, { parentId: root.id })
      await createArea(token, { parentId: child.id })
      return {
        res: await rawRequest({ method: 'DELETE', path: `/api/area/${root.id}`, token }),
        method: 'DELETE',
        path: `/api/area/${root.id}`,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：deleteArea 递归删除整棵子树（子级与孙级均被删），出处 tests/api/integration/area.test.ts:312-327、:25；子级/孙级均已 track，cleanup 再删视为 already-gone',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ============================== B. 跨实体引用 ==============================

  it('bi.cross.marker-area-derived：点位地区归属由 item.areaId 推导并按 areaIdList 检索', async () => {
    const token = await getToken()
    const input = await capture('bi.cross.marker-area-derived', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const area = await createArea(token)
      const item = await createItem(token, area.id)
      await createMarker(token, [{ itemId: item.id, count: 1 }])
      const body = { areaIdList: [area.id] }
      return {
        res: await rawRequest({ method: 'POST', path: '/api/marker/get/id', token, body }),
        method: 'POST',
        path: '/api/marker/get/id',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：点位无 areaId，地区归属完全由 marker_item_link → item.area_id 推导，按 areaIdList 可检索到；物品/点位载荷参考 tests/api/_support/factories.ts:128-146、:212-228，出处 tests/api/integration/cross-entity.test.ts:57-83、:23-24、marker.test.ts:30',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.cross.delete-item-clears-marker：删除物品后点位关联被清理、点位不再可查询', async () => {
    const token = await getToken()
    const input = await capture('bi.cross.delete-item-clears-marker', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const area = await createArea(token)
      const item = await createItem(token, area.id)
      const marker = await createMarker(token, [{ itemId: item.id, count: 1 }])
      await rawRequest({ method: 'DELETE', path: `/api/item/delete/${item.id}`, token })
      const body = { markerIdList: [marker.id] }
      return {
        res: await rawRequest({ method: 'POST', path: '/api/marker/get/list_byid', token, body }),
        method: 'POST',
        path: '/api/marker/get/list_byid',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：删除物品同时删 marker_item_link，点位行仍在但读接口 SQL join 物品后不可见；前置 DELETE 物品后采集点位读回响应，出处 tests/api/integration/cross-entity.test.ts:156-171、:25-26',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.cross.dangling-ref：删除图标/物品分类产生悬空引用（Java 基线）', async () => {
    const token = await getToken()
    const input = await capture('bi.cross.dangling-ref', ['business-invariant', 'response-schema'], async () => {
      const area = await createArea(token)
      const icon = await createIcon(token)
      const itemType = await createItemType(token)
      const item = await createItem(token, area.id, { iconId: icon.id, typeIdList: [itemType.id] })
      await rawRequest({ method: 'DELETE', path: `/api/icon/delete/${icon.id}`, token })
      await rawRequest({ method: 'DELETE', path: `/api/item_type/delete/${itemType.id}`, token })
      const body = [item.id]
      return {
        res: await readItem(token, item.id),
        method: 'POST',
        path: '/api/item/get/list_byid',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为（非理想）：删除被引用图标/分类不校验引用，物品保留悬空 iconId、typeIdList 被清空；前置删除两对象后采集物品读回响应，出处 tests/api/integration/cross-entity.test.ts:174-212、:28、java-baseline-deviations.md 第 3 条',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ============================== C. 点位关联单删与裂解 ==============================

  it('bi.link.create：POST /api/marker_link/link 建组（失败响应亦完整采集）', async () => {
    const token = await getToken()
    const input = await capture('bi.link.create', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const area = await createArea(token)
      const item = await createItem(token, area.id)
      const a = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const b = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const link = await createLinkGroup(token, a.id, b.id)
      return {
        res: link.res,
        method: 'POST',
        path: '/api/marker_link/link',
        body: link.body,
        authMode: 'bearer-valid',
        note: '建组 body 为 MarkerLinkageVo[]（groupId/fromId/toId/linkAction/linkReverse）。待核实：前端 stores/markerLink.ts:101-108 提交时不含 groupId/linkReverse、由后端生成 groupId 并在 data 返回字符串，此处按任务字段构造；若建组失败（如字段契约差异），该失败响应同样完整采集、不跳过。字段出处 globals.d.ts:1432-1488、:1727-1730',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.link.read-back：POST /api/marker_link/get/list 按 groupIds 读回关联组', async () => {
    const token = await getToken()
    const input = await capture('bi.link.read-back', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const area = await createArea(token)
      const item = await createItem(token, area.id)
      const a = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const b = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const link = await createLinkGroup(token, a.id, b.id)
      const read = await readLinkGroup(token, link.groupId)
      return {
        res: read.res,
        method: 'POST',
        path: '/api/marker_link/get/list',
        body: read.body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：get/list 以 groupIds + isTraverse 读回 Record<string, MarkerLinkageVo[]>；groupId 取自建组响应 data（待核实：若建组失败则回退到 testPrefix 占位串，读回响应仍如实采集、不跳过）。出处 globals.d.ts:2271-2276、:1489-1492',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.link.delete-single：DELETE /api/marker_link/delete 用 {ids:[单条id]} 从组内删单条', async () => {
    const token = await getToken()
    const input = await capture('bi.link.delete-single', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const area = await createArea(token)
      const item = await createItem(token, area.id)
      const a = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const b = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const link = await createLinkGroup(token, a.id, b.id)
      const read = await readLinkGroup(token, link.groupId)
      const body = { ids: [read.ids[0] ?? -1] }
      return {
        res: await rawRequest({ method: 'DELETE', path: '/api/marker_link/delete', token, body }),
        method: 'DELETE',
        path: '/api/marker_link/delete',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：{ids:[单条id]} 仅从组内删单条，返回 LinkDeleteVo{groups,markers} 集合结构；采集该结构。待核实：若建组/读回失败取不到单条 id 则回退 -1，删除响应仍如实采集、不跳过。出处 globals.d.ts:2711-2714(LinkDeleteVo)、:1727-1730(LinkDeleteQueryVo)',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('bi.link.delete-group：DELETE /api/marker_link/delete 用 {groupIds:[groupId]} 整组裂解', async () => {
    const token = await getToken()
    const input = await capture('bi.link.delete-group', ['business-invariant', 'request-params', 'response-schema'], async () => {
      const area = await createArea(token)
      const item = await createItem(token, area.id)
      const a = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const b = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const link = await createLinkGroup(token, a.id, b.id)
      const body = { groupIds: [link.groupId] }
      return {
        res: await rawRequest({ method: 'DELETE', path: '/api/marker_link/delete', token, body }),
        method: 'DELETE',
        path: '/api/marker_link/delete',
        body,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：{groupIds:[groupId]} 整组/裂解，返回 LinkDeleteVo{groups,markers} 集合结构；采集该结构。待核实：建组失败时 groupId 为占位串，删除响应仍如实采集、不跳过。出处 globals.d.ts:2711-2714、:1727-1730',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ============================== D. 乐观锁 ==============================

  it('bi.marker.stale-version：用过期 version 更新点位被拒（采集版本字段类型与错误码）', async () => {
    const token = await getToken()
    const input = await capture('bi.marker.stale-version', ['business-invariant', 'exception', 'error-code', 'request-params', 'response-schema'], async () => {
      const area = await createArea(token)
      const item = await createItem(token, area.id)
      const marker = await createMarker(token, [{ itemId: item.id, count: 1 }])
      const { marker: before } = await readMarker(token, marker.id)
      const version = typeof before?.version === 'number' ? before.version : 0
      const base = {
        id: marker.id,
        version,
        markerTitle: marker.body.markerTitle,
        position: '1.5,2.5',
        content: `${testPrefix}first-update`,
        refreshTime: 0,
        extra: {},
        itemList: [{ itemId: item.id, count: 1 }],
      }
      // 先用当前 version 成功更新一次（推进版本），再复用过期 version 更新被拒
      await rawRequest({ method: 'POST', path: '/api/marker/single', token, body: base })
      const staleBody = { ...base, content: `${testPrefix}stale-update` }
      return {
        res: await rawRequest({ method: 'POST', path: '/api/marker/single', token, body: staleBody }),
        method: 'POST',
        path: '/api/marker/single',
        body: staleBody,
        authMode: 'bearer-valid',
        note: 'Java 基线行为：版本号不匹配提示「该点位已更新，请重新提交」；此处采集过期 version 更新的原始状态码、errorStatus、message 与 version 字段类型。出处 tests/api/integration/marker.test.ts:174-212、:25，载荷参考 factories.ts:212-228、globals.d.ts:448-498',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })
})
