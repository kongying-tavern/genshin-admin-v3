import Apis from '../alova'
import { upload } from './image'

export interface GetOrUploadImageParams {
  /** 待上传文件的 Blob 封装（文件名需与 fileName 一致） */
  file: File
  /** 目标路径，例如 '2025-09-09/abcdefg.png' */
  filePath: string
}

/**
 * 去重上传图片：若相同 filePath 的资源已存在，则直接复用已存在的访问链接；
 * 否则上传新资源并返回访问地址。
 *
 * 该函数同时用于点位图片、图标等资源的上传，保证「重新上传同一内容」不会触发
 * 后端重复路径(「文件已存在」)报错，也不会产生冗余存储。
 *
 * @note 查询资源时若请求失败（网络/服务端不可用），不会阻断上传流程，
 *       会自动降级为直接上传，由后端对重复路径做最终校验。
 */
export const getOrUploadImage = async ({ file, filePath }: GetOrUploadImageParams) => {
  // 1. 尝试复用已存在的资源
  try {
    const { data: existing } = await Apis.resource.getResource({ params: { filePath } })
    if (existing?.fileUrl) return existing.fileUrl
  } catch {
    // 查询失败不阻断上传流程，直接尝试上传，后端会对重复路径再次校验
  }

  // 2. 资源不存在，上传资源
  const { data: { fileUrl = '' } = {}, message = `上传 ${filePath} 失败` } = await upload({
    file,
    filePath,
  })
  if (!fileUrl) throw new Error(message)

  return fileUrl
}
