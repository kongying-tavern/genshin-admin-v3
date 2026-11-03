import type { WorkerInput, WorkerSuccessOutput } from './renderer.worker'
import { createWorkerHelper } from '@/utils'
import Worker from './renderer.worker?worker'

export const renderTagSprite = createWorkerHelper<WorkerInput, WorkerSuccessOutput>(
  new Worker({ name: '图标渲染线程' }),
)
