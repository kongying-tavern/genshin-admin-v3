import { describe, expect, it, vi } from 'vitest'
import { createArchiveCommands } from '@/ai/commands/archive'

const archive = vi.hoisted(() => ({
  currentArchive: { slotIndex: 2, timestamp: 30, body: { Data_KYJG: new Set([3, 4]) } },
  flush: vi.fn(),
}))
vi.mock('@/stores/archive', () => ({ useArchiveStore: () => archive }))
vi.mock('@/stores/marker', () => ({}))
vi.mock('@/stores/user', () => ({}))

describe('AI 存档命令', () => {
  it('状态反映激活的点位进度，同步须等待设置和进度都写入成功', async () => {
    const commands = createArchiveCommands()
    const call = (id: string) => commands.find(cmd => cmd.id === id)!.handler({}, {} as never)
    expect(call('archive.state')).toEqual({ slotIndex: 2, timestamp: 30, markedCount: 2 })
    archive.flush.mockRejectedValueOnce(new Error('账号设置同步失败'))
    await expect(call('archive.flush')).rejects.toThrow('账号设置同步失败')
    await expect(call('archive.flush')).resolves.toEqual({ synced: true })
  })
})
