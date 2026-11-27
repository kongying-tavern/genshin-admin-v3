import { ElMessage } from 'element-plus'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { getSystemConfig } from '@/api/config'
import { validateDadianJSON } from '@/configs'
import { cache } from '@/database'
import { Zip } from '@/utils'
import { useAccessStore } from './access'
import { useUserStore } from './user'

const getDigest = async (data: ArrayBuffer) => {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return [...new Uint8Array(hash)].map(num => num.toString(16).padStart(2, '0')).join('')
}

const getVersion = (config: DTO.DadianJSON, hasBeta: boolean) => {
  const version = config.tiles?.['提瓦特-base0']?.code ?? '-NA-'
  return hasBeta ? `${version} / ${config.tilesBeta?.['提瓦特-base0']?.code ?? '-NA-'}` : version
}

const quoteCssString = (value: string) =>
  `"${value.replace(/["\\\n\r\f]/g, char => `\\${char.charCodeAt(0).toString(16)} `)}"`

/** 订阅的打点配置 */
export const useDadianStore = defineStore('system-config', () => {
  const userStore = useUserStore()
  const accessStore = useAccessStore()

  const data = shallowRef<{ json: DTO.DadianJSON; hash: string }>({ json: {}, hash: '' })
  const loading = ref(false)
  let revision = 0

  const update = async () => {
    const requestRevision = ++revision
    loading.value = true

    try {
      const archive = await getSystemConfig()
      if (requestRevision !== revision) return
      const json = await Zip.decompressAs<DTO.DadianJSON>(new Uint8Array(archive), {
        name: 'system-config',
      })
      const hash = await getDigest(archive)
      if (requestRevision !== revision) return

      await cache.transaction('rw', cache.systemConfig, async () => {
        await cache.systemConfig.clear()
        await cache.systemConfig.put({ digest: hash, json })
      })
      if (requestRevision !== revision) return
      data.value = { json, hash }
      return data.value
    } catch {
      // 订阅恢复失败时保留当前可用的配置。
    } finally {
      if (requestRevision === revision) loading.value = false
    }
  }

  watch(
    () => userStore.info?.roleId,
    () => update(),
  )

  const raw = computed(() => data.value.json)

  const meta = computed(() => ({
    digest: data.value.hash,
    version: getVersion(data.value.json, accessStore.hasBeta),
  }))

  const loadDadianJSON = async () => {
    const requestRevision = revision
    try {
      const [fileHandle] = await window
        .showOpenFilePicker()
        .catch(() => [] as FileSystemFileHandle[])
      if (!fileHandle || requestRevision !== revision) return
      const file = await fileHandle.getFile()
      if (file.type !== 'application/json' || requestRevision !== revision) return
      const [hash, text] = await Promise.all([file.arrayBuffer().then(getDigest), file.text()])
      if (requestRevision !== revision) return

      const json: DTO.DadianJSON = JSON.parse(text)
      const { valid, errors } = validateDadianJSON(json)
      if (!valid) throw new Error(errors ? errors[0]?.message : 'unknown')

      // 本地配置生效后，忽略仍在加载的上一份订阅。
      revision++
      data.value = { json, hash }
      loading.value = false
      ElMessage.success('加载成功')
    } catch (err) {
      if (requestRevision === revision) {
        ElMessage.error(`无法加载此配置：${err instanceof Error ? err.message : err}`)
      }
    }
  }

  const isInit = ref(false)
  const init = async () => {
    if (isInit.value) return
    await update()
    isInit.value = true
  }

  const fontResources = computed(() => raw.value.editor?.fontResources ?? {})
  const loadedFontFamilies = reactive(new Map<string, string>())
  const fontFaces = new Map<string, { url: string; face: FontFace }>()
  let fontRevision = 0

  const removeFont = (family: string, face: FontFace) => {
    fontFaces.delete(family)
    loadedFontFamilies.delete(family)
    document.fonts.delete(face)
  }

  const loadFont = async (family: string, url: string) => {
    // 注册时使用原始名称，写入 CSS 字体列表时再加引号。
    const face = new FontFace(family, `url(${quoteCssString(url)})`)
    fontFaces.set(family, { url, face })
    try {
      await face.load()
    } catch {
      if (fontFaces.get(family)?.face === face) fontFaces.delete(family)
      return
    }
    if (fontFaces.get(family)?.face !== face) return
    document.fonts.add(face)
    // deck.gl 按字体字符串缓存字形纹理，同名字体换址后需要重新绘制字形。
    loadedFontFamilies.set(family, `${quoteCssString(family)} /* ${++fontRevision} */`)
  }

  watch(fontResources, resources => {
    for (const [family, { url, face }] of fontFaces) {
      if (!Object.hasOwn(resources, family) || resources[family].url !== url) {
        removeFont(family, face)
      }
    }
    for (const [family, { url }] of Object.entries(resources)) {
      if (family && !fontFaces.has(family)) void loadFont(family, url)
    }
  })

  onScopeDispose(() => {
    for (const [family, { face }] of fontFaces) removeFont(family, face)
  })

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
    fontResources,
    loadedFontFamilies,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDadianStore, import.meta.hot))
}
