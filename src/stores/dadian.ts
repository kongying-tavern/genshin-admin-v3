import { ElMessage } from 'element-plus'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { getSystemConfig } from '@/api/config'
import { validateDadianJSON } from '@/configs'
import { cache } from '@/database'
import { useFetchHook } from '@/hooks'
import { Zip } from '@/utils'
import { useUserStore } from './user'

const getDigest = async (data: ArrayBuffer) => {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return [...new Uint8Array(hash)].map(num => num.toString(16).padStart(2, '0')).join('')
}

const getVersion = (config: DTO.DadianJSON) => {
  return `${config.tiles?.['提瓦特-base0']?.code ?? '-NA-'} / ${config.tilesBeta?.['提瓦特-base0']?.code ?? '-NA-'}`
}

/** 订阅的打点配置 */
export const useDadianStore = defineStore('system-config', () => {
  const userStore = useUserStore()

  // 直接请求新的配置，当请求失败时回退到本地缓存
  const {
    data,
    refresh: update,
    loading,
  } = useFetchHook({
    initialValue: {
      json: {},
      hash: '',
    },
    onRequest: async () => {
      const currentSystemConfigData = await getSystemConfig()
      const currentSystemConfig = await Zip.decompressAs<DTO.DadianJSON>(
        new Uint8Array(currentSystemConfigData),
        {
          name: 'system-config',
        },
      )
      const currentSystemConfigDigest = await getDigest(currentSystemConfigData)
      await cache.systemConfig.clear()
      await cache.systemConfig.put({
        digest: currentSystemConfigDigest,
        json: currentSystemConfig,
      })
      return {
        json: currentSystemConfig,
        hash: currentSystemConfigDigest,
      }
    },
  })

  watch(
    () => userStore.info?.roleId,
    () => update(),
  )

  const raw = computed(() => data.value.json)

  const meta = computed(() => ({
    digest: data.value.hash,
    version: getVersion(data.value.json),
  }))

  const loadDadianJSON = async () => {
    try {
      const [fileHandle] = await window
        .showOpenFilePicker()
        .catch(() => [] as FileSystemFileHandle[])
      if (!fileHandle) return
      const file = await fileHandle.getFile()
      if (file.type !== 'application/json') return
      const newSystemConfigDigest = await getDigest(await file.arrayBuffer())
      const text = await file.text()
      const json = JSON.parse(text)
      const { valid, errors } = validateDadianJSON(json)
      if (!valid) throw new Error(errors ? errors[0]?.message : 'unknown')
      data.value = {
        json,
        hash: newSystemConfigDigest,
      }
      ElMessage.success('加载成功')
    } catch (err) {
      ElMessage.error(`无法加载此配置：${err instanceof Error ? err.message : err}`)
    }
  }

  const isInit = ref(false)
  const init = async () => {
    if (isInit.value) return
    await update()
    isInit.value = true
  }

  const fontFamilySet = ref(new Set<string>())

  const fontFamilyMission = ref(new Set<string>())

  // 自动加载字体资源
  watch(
    () => raw.value?.editor?.fontResources,
    (fontResources = {}) => {
      Object.entries(fontResources).forEach(([family, { url }]) => {
        if (fontFamilyMission.value.has(family)) return
        fontFamilyMission.value.add(family)
        const fontFace = new FontFace(family, `url(${url})`)
        document.fonts.add(fontFace)
        fontFace.load().then(() => {
          fontFamilySet.value.add(family)
        })
      })
    },
  )

  // 名片
  const nameCardList = computed(() => {
    return raw.value.application?.nameCard ?? []
  })

  const nameCardMap = computed(() =>
    nameCardList.value.reduce((map, nameCard) => {
      if (nameCard.label) map.set(nameCard.label, nameCard)
      return map
    }, new Map<string, DTO.NameCardOption>()),
  )

  return {
    raw,
    meta,
    nameCardList,
    nameCardMap,
    init,
    loadDadianJSON,
    update,
    loading,
    fontFamilySet,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDadianStore, import.meta.hot))
}
