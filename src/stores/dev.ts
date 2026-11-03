/* oxlint-disable no-console */
import type { LogInfo } from '@/utils'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { Logger } from '@/utils'
import { usePreferenceStore } from '.'

/** 开发者工具 store */
export const useDevStore = defineStore('global-dev', () => {
  const preferenceStore = usePreferenceStore()

  const enableLoggers = computed(() => new Set(preferenceStore.enableLoggers))

  const loggerLabels = ref(new Set<string>())

  const logList = ref<LogInfo[]>([])

  const visibleLogList = computed(() =>
    logList.value.filter(({ label }) => enableLoggers.value.has(label)),
  )

  const preLogList = ref<LogInfo[]>([])

  const handleLog = (logInfo: LogInfo) => {
    const maxLogs = preferenceStore.maxLogs

    preLogList.value = preLogList.value.slice(0, maxLogs - 1)

    if (preferenceStore.enableLoggers === undefined) {
      preLogList.value.push(logInfo)
      return
    }

    logList.value.push(logInfo)

    if (!enableLoggers.value.has(logInfo.label)) return

    const { type, args } = logInfo
    console[type](...args)
  }

  watch(
    () => preferenceStore.enableLoggers,
    () => {
      preLogList.value.forEach(handleLog)
      preLogList.value = []
    },
  )

  const registerLogger = (label: string) => {
    if (loggerLabels.value.has(label)) return
    loggerLabels.value.add(label)
  }

  const initLogger = () => {
    if (Logger.isInit) return
    Logger.loggerLabelsCache.forEach(registerLogger)
    Logger.logsCache.forEach(handleLog)
    Logger.init()
    Logger.event.on('register', registerLogger)
    Logger.event.on('log', handleLog)
  }

  const clearLogs = () => {
    console.clear()
    logList.value = []
  }

  const refreshLogs = () => {
    console.clear()
    visibleLogList.value.forEach(({ type, args }) => console[type](...args))
  }

  return {
    enableLoggers,
    loggerLabels,
    logList,
    visibleLogList,
    clearLogs,
    refreshLogs,
    initLogger,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDevStore, import.meta.hot))
}
