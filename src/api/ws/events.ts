export const SOCKET_EVENT_LABELS: Record<WebSocketAPI.WSEventType, string> = {
  Pong: '服务器心跳',
  AppUpdated: '应用更新',
  UserKickedOut: '管理员下线通知',
  IconBinaryPurged: '图标数据库更新',
  ItemAdded: '物品新增',
  ItemUpdated: '物品更新',
  ItemDeleted: '物品删除',
  ItemBinaryPurged: '物品数据库更新',
  MarkerAdded: '点位新增',
  MarkerUpdated: '点位更新',
  MarkerDeleted: '点位删除',
  MarkerTweaked: '点位批量更新',
  MarkerBinaryPurged: '点位数据库更新',
  MarkerLinked: '关联新增',
  MarkerLinkageBinaryPurged: '关联数据库更新',
  NoticeAdded: '公告新增',
  NoticeUpdated: '公告更新',
  NoticeDeleted: '公告删除',
}

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isIdList = (value: unknown): value is number[] => Array.isArray(value) && value.every(isId)

const validators: Partial<Record<WebSocketAPI.WSEventType, (data: unknown) => boolean>> = {
  ItemAdded: isId,
  ItemUpdated: isId,
  ItemDeleted: isId,
  MarkerAdded: isId,
  MarkerUpdated: isId,
  MarkerDeleted: isId,
  MarkerTweaked: isIdList,
  MarkerLinked: data =>
    !!data
    && typeof data === 'object'
    && 'markers' in data
    && isIdList(data.markers)
    && 'groups' in data
    && Array.isArray(data.groups)
    && data.groups.every(group => typeof group === 'string'),
  NoticeAdded: isId,
  NoticeUpdated: isId,
  NoticeDeleted: isId,
}

export const parseSocketEvent = (message: unknown) => {
  if (typeof message !== 'string') throw new TypeError('Expected a JSON message')
  const payload: unknown = JSON.parse(message)
  if (
    !payload
    || typeof payload !== 'object'
    || !('event' in payload)
    || typeof payload.event !== 'string'
    || !Object.hasOwn(SOCKET_EVENT_LABELS, payload.event)
  ) {
    throw new TypeError('Unknown socket event')
  }

  const event = payload.event as WebSocketAPI.WSEventType
  const validate = validators[event]
  const data = 'data' in payload ? payload.data : undefined
  if (validate && !validate(data)) throw new TypeError('Invalid socket event data')

  return { event, args: (validate ? [data] : []) as WebSocketAPI.WSEventMap[typeof event] }
}
