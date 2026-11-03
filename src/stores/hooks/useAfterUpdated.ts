export interface AfterUpdatedHookOptions<Key, Data> {
  getData: (keys: Key[]) => Promise<Data[]> | Data[]
  getKey: (data: Data) => Key
  commit: (data: Data[]) => Promise<void> | void
}

/**
 * 等待指定的 id 都被更新一次。
 * 此逻辑用于确保更新被写入数据库后才执行一些临时任务的状态重置，以避免实际状态和显示状态不一致的问题。
 */
export const useAfterUpdated = <Key, Data>(options: AfterUpdatedHookOptions<Key, Data>) => {
  const { getData, getKey, commit } = options

  const updated = createEventHook<void>()

  const waitForUpdate = ref(new Set<Key>()) as Ref<Set<Key>>

  /**
   * 等待指定的 id 都被更新一次。
   * 此逻辑用于确保更新被写入数据库后才执行一些临时任务的状态重置，以避免实际状态和显示状态不一致的问题。
   */
  const afterUpdated = async (ids: Key[]) => {
    if (!ids.length) return

    const { resolve, promise } = Promise.withResolvers<void>()

    const finish = () => {
      resolve()
      updated.off(finish)
    }

    try {
      updated.on(finish)

      const data = await getData(ids)

      ids.forEach(id => {
        waitForUpdate.value.add(id)
      })

      await commit(data)

      data.forEach(data => {
        waitForUpdate.value.delete(getKey(data))
      })

      // TODO 暂时无法处理删除导致数据缺失的问题
      if (!data.length) {
        ids.forEach(id => {
          waitForUpdate.value.delete(id)
        })
      }
    } catch {
      ids.forEach(id => {
        waitForUpdate.value.delete(id)
      })
      updated.off(finish)
    }

    return promise
  }

  return {
    waitForUpdate,
    afterUpdated,
    triggerUpdated: updated.trigger,
  }
}
