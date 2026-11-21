import { describe, expect, it, vi } from 'vitest'
import { createMarkerCommands } from '@/ai/commands/markers'

const create = vi.hoisted(() => ({
  marker: { createMarker: async (_form: unknown) => ({ id: 12, syncing: true }) },
}))
vi.mock('@/api/alova', () => ({ default: {} }))
vi.mock('@/hooks/useMarkerControl', () => ({}))
vi.mock('@/stores/access', () => ({ useAccessStore: () => ({ get: () => true }) }))
vi.mock('@/stores/area', () => ({}))
vi.mock('@/stores/item', () => ({}))
vi.mock('@/stores/mapState', () => ({}))
vi.mock('@/stores/marker', () => ({ useMarkerStore: () => create.marker }))
vi.mock('@/stores/user', () => ({ useUserStore: () => ({ isLogin: true, info: { roleId: 1 } }) }))

describe('markers.create', () => {
  it('创建回执提供已确认的 ID 和详情同步状态', async () => {
    const command = createMarkerCommands().find(command => command.id === 'markers.create')!
    const result = await command.handler({ data: { markerTitle: '新点位' } }, {} as never)
    expect(result).toEqual({ marker: { id: 12 }, syncing: true })
  })
})
