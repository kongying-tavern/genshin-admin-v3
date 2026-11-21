declare namespace Socket {
  interface DataEventMap extends WebSocketAPI.WSEventMap {
    ItemAdded: [ItemVo, SysUserSmallVo]
    ItemUpdated: [ItemVo, SysUserSmallVo]
    ItemDeleted: [ItemVo, SysUserSmallVo]

    MarkerAdded: [MarkerVo, SysUserSmallVo]
    MarkerUpdated: [MarkerVo, SysUserSmallVo]
    MarkerDeleted: [MarkerVo, SysUserSmallVo]
    MarkerTweaked: [MarkerVo[], SysUserSmallVo]
    MarkerLinked: [MarkerVo[], SysUserSmallVo]
  }

  interface DataEventRecord<K extends keyof DataEventMap = keyof DataEventMap> {
    key: string
    scope: string
    type: K
    user: SysUserSmallVo & { id?: number }
    args: DataEventMap[K]
    time: number
  }
}
