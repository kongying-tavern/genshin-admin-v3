import type { _ActionsTree, _GettersTree, StateTree, Store, StoreDefinition } from 'pinia'

export class CustomHook<T extends string> {
  #callbackMap: Record<
    string,
    {
      id: string
      storeDefinition: StoreDefinition
      callback: (store: Store) => void | Promise<void>
    }[]
  > = {}

  protected on = <
    Id extends string = string,
    S extends StateTree = StateTree,
    G = _GettersTree<S>,
    A = _ActionsTree,
  >(
    type: T,
    storeDefinition: StoreDefinition<Id, S, G, A>,
    callback: (store: Store<Id, S, G, A>) => void | Promise<void>,
  ) => {
    if (!this.#callbackMap[type]) this.#callbackMap[type] = []
    const id = crypto.randomUUID()
    this.#callbackMap[type].push({
      id,
      storeDefinition: storeDefinition as unknown as StoreDefinition,
      callback: callback as unknown as (store: Store) => void | Promise<void>,
    })

    /** 返回取消函数 */
    return () => {
      if (!this.#callbackMap[type]) return
      const index = this.#callbackMap[type].findIndex(mission => mission.id === id) ?? -1
      if (index < 0) return
      this.#callbackMap[type].splice(index, 1)
    }
  }

  protected registerHook =
    (type: T) =>
    <
      Id extends string = string,
      S extends StateTree = StateTree,
      G = _GettersTree<S>,
      A = _ActionsTree,
    >(
      storeDefinition: StoreDefinition<Id, S, G, A>,
      callback: (store: Store<Id, S, G, A>) => void | Promise<void>,
    ) =>
      this.on(type, storeDefinition, callback)

  applyCallbacks = (type: T) =>
    Promise.all(
      this.#callbackMap[type]?.map(async ({ storeDefinition, callback }) => {
        const store = storeDefinition()
        await callback(store)
      }) ?? [],
    )
}
