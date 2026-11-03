import type { WorkerInput, WorkerSuccessOutput } from './renderer.worker'
import { createWorkerHelper } from '@/utils'
import Worker from './renderer.worker?worker'

export const renderMarkerSprite = createWorkerHelper<WorkerInput, WorkerSuccessOutput>(
  new Worker({ name: '点位渲染线程' }),
)
