import type { UserPreference } from './types'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useArchiveStore } from '@/stores'

export const usePreferenceStore = defineStore('global-user-preference', () => {
  const archiveStore = useArchiveStore()

  const model = <K extends keyof UserPreference>(key: K, defaultValue: () => UserPreference[K]) =>
    computed({
      get: () => {
        return archiveStore.currentArchive.body.Preference[key] ?? defaultValue()
      },
      set: v => {
        archiveStore.currentArchive.body.Preference[key] = v
      },
    }) as Ref<NonNullable<UserPreference[K]>>

  return {
    advancedFilter: model('markerFilter.filter.advancedFilter', () => []),
    advancedFilterCache: model('markerFilter.filter.advancedFilterCache', () => []),
    autoNext: model('markerFilter.setting.autoNext', () => false),
    areaCode: model('markerFilter.state.areaCode', () => ''),
    defaultMarkingItemId: model('markerFilter.state.defaultMarkingItemId', () => -1),
    enableLoggers: model('developer.setting.enableLoggers', () => []),
    enableNotice: model('socket.setting.enableNotice', () => false),
    filterType: model('markerFilter.setting.filterType', () => 'basic'),
    itemIds: model('markerFilter.state.itemIds', () => []),
    itemTypeId: model('markerFilter.state.itemTypeId', () => -1),
    maxLogs: model('developer.setting.maxLogs', () => 100),
    noticeEvents: model('socket.setting.noticeEvents', () => []),
    pageSize: model('manager.setting.pageSize', () => []),
    parentAreaCode: model('markerFilter.state.parentAreaCode', () => ''),
    presets: model('markerFilter.setting.presets', () => []),
    settingActivedKey: model('settingPanel.state.activedKey', () => ''),
    showRestrictedArea: model('userCenter.setting.showRestrictedArea', () => false),
    showZoneTag: model('map.setting.showZoneTag', () => true),
    step: model('markerFilter.state.step', () => 0),
    tabName: model('mapSiderMenu.state.tabName', () => 'filter'),
    transparentMarked: model('map.setting.transparentMarked', () => false),
    zoomTransitionDuration: model('map.setting.zoomTransitionDuration', () => 66),
    markerDraggingCount: model('manager.setting.markerDraggingCount', () => 0),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePreferenceStore, import.meta.hot))
}
