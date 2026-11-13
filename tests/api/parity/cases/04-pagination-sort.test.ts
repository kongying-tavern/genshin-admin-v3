import { describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import { capture } from '../_support/observer'
import { getToken } from '../_support/session'

/**
 * ④ 分页与排序
 *
 * 覆盖 /api/marker/get/page、/api/route/get/page、/api/punctuate/get/page、
 *       /system/action_log/list、/system/device/list、/api/history/get/list。
 * 载荷一律使用保守的 {current,size,...} / {} 与 globals.d.ts 中的 sort?: string[]，
 * 覆盖默认分页、page=0、page 越界、size=0、size 极大、排序字段与不同页的顺序稳定性。
 * 这些端点均为只读 POST，无任何写操作；差异交由离线 diff 以 Java 为基线裁决。
 */

describe('parity / 分页与排序', () => {
  it('pagination.marker.default', async () => {
    const token = await getToken()
    const body = {}
    const input = await capture('pagination.marker.default', ['pagination-sort', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: '默认分页（空载荷），采集分页元信息与顶层键',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.marker.page0', async () => {
    const token = await getToken()
    const body = { current: 0, size: 10 }
    const input = await capture('pagination.marker.page0', ['pagination-sort', 'null-boundary'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: 'current=0 边界：观察是否被归一化到第一页或报错',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.marker.page-overflow', async () => {
    const token = await getToken()
    const body = { current: 999999, size: 10 }
    const input = await capture('pagination.marker.page-overflow', ['pagination-sort', 'null-boundary'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: '页码越界：观察空页结构与 total 等元信息',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.marker.size0', async () => {
    const token = await getToken()
    const body = { current: 1, size: 0 }
    const input = await capture('pagination.marker.size0', ['pagination-sort', 'null-boundary'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: 'size=0 边界：观察后端默认值或参数校验差异',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.marker.size-huge', async () => {
    const token = await getToken()
    const body = { current: 1, size: 100000 }
    const input = await capture('pagination.marker.size-huge', ['pagination-sort', 'null-boundary'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: 'size 极大值：观察是否被上限截断或全量返回',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.marker.sort-asc', async () => {
    const token = await getToken()
    const body = { current: 1, size: 10, sort: ['id', 'asc'] }
    const input = await capture('pagination.marker.sort-asc', ['pagination-sort', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: 'sort?: string[] 升序排序字段入参，观察是否被接受及返回结构',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.marker.sort-desc', async () => {
    const token = await getToken()
    const body = { current: 1, size: 10, sort: ['id', 'desc'] }
    const input = await capture('pagination.marker.sort-desc', ['pagination-sort', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: '降序排序字段入参；与 sort-asc 对照观察顺序方向处理差异',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.marker.page2-stability', async () => {
    const token = await getToken()
    const body = { current: 2, size: 10 }
    const input = await capture('pagination.marker.page2-stability', ['pagination-sort', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/page', body, token }),
      method: 'POST',
      path: '/api/marker/get/page',
      body,
      authMode: 'bearer-valid',
      note: '第二页结果：与第一页对照观察翻页时分页元信息与记录结构的稳定性',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.route.default', async () => {
    const token = await getToken()
    const body = {}
    const input = await capture('pagination.route.default', ['pagination-sort', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/route/get/page', body, token }),
      method: 'POST',
      path: '/api/route/get/page',
      body,
      authMode: 'bearer-valid',
      note: '路线分页默认行为',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.punctuate.default', async () => {
    const token = await getToken()
    const body = { current: 1, size: 10 }
    const input = await capture('pagination.punctuate.default', ['pagination-sort', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/punctuate/get/page', body, token }),
      method: 'POST',
      path: '/api/punctuate/get/page',
      body,
      authMode: 'bearer-valid',
      note: '标点分页默认行为',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.actionlog.default', async () => {
    const token = await getToken()
    const body = { current: 1, size: 10 }
    const input = await capture('pagination.actionlog.default', ['pagination-sort', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/system/action_log/list', body, token }),
      method: 'POST',
      path: '/system/action_log/list',
      body,
      authMode: 'bearer-valid',
      note: '操作日志分页默认行为',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.device.default', async () => {
    const token = await getToken()
    const body = { current: 1, size: 10 }
    const input = await capture('pagination.device.default', ['pagination-sort', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/system/device/list', body, token }),
      method: 'POST',
      path: '/system/device/list',
      body,
      authMode: 'bearer-valid',
      note: '设备分页默认行为',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('pagination.history.default', async () => {
    const token = await getToken()
    const body = { current: 1, size: 10 }
    const input = await capture('pagination.history.default', ['pagination-sort', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/history/get/list', body, token }),
      method: 'POST',
      path: '/api/history/get/list',
      body,
      authMode: 'bearer-valid',
      note: '历史记录分页默认行为',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })
})
