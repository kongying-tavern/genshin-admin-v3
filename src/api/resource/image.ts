import type { RResourceUploadVo } from '../alova/globals'
import { alovaInstance } from '../alova'

/** 上传图片 上传图片至图床并返回访问地址 PUT /api/res/upload/image */
export const upload = (body: ResourceAPI.UploadResourceVo) => {
  const formData = new FormData()

  for (const key in body) {
    const item = body[key as keyof ResourceAPI.UploadResourceVo]
    if (item === undefined) continue
    formData.append(key, item)
  }

  return alovaInstance.Put<RResourceUploadVo>('/api/res/upload/image', formData)
}
