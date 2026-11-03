import type { MarkerVo } from '@/api/alova/globals'
import dayjs from 'dayjs'
import { getOrUploadImage } from '@/api/resource/upload'
import { useUserStore } from '@/stores'
import { getDigest } from '@/utils'

/** 图片上传 hook */
export const usePictureUpload = () => {
  const userStore = useUserStore()

  /**
   * 检测 picture 是否为数据地址，是则处理图片上传逻辑
   * @note 该函数可能会修改对象属性值
   */
  const tryUploadPicture = async (form: MarkerVo) => {
    if (!form.picture?.toLowerCase().startsWith('blob:')) return

    const url = new URL(form.picture)

    const folder = `${dayjs().format('YYYY-MM-DD')}`

    // 提取缩略图
    const thumbUrl = `${url.protocol}${url.pathname}`
    const thumbImage = await (await fetch(thumbUrl)).blob()
    const thumbImageName = `${await getDigest(thumbImage, 'SHA-256')}.png`

    const filePath = `${folder}/${thumbImageName}`
    const file = new File([thumbImage], thumbImageName, {
      type: 'image/png',
      lastModified: Date.now(),
    })

    // 资源已存在则复用链接，否则上传新资源
    form.picture = await getOrUploadImage({ file, filePath })
    form.pictureCreatorId = userStore.info?.id
  }

  return { tryUploadPicture }
}
