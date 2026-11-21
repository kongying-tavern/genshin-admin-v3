import type {
  BridgeAccess,
  BridgeCommand,
  BridgeManifest,
  ModeSource,
  SnapshotOptions,
} from '@/ai/types'
import type { EventLog } from '@/ai/events'
import { createAppCommands } from './app'
import { createArchiveCommands } from './archive'
import { createAuthCommands } from './auth'
import { createDatasetCommands } from './datasets'
import { createDevCommands } from './dev'
import { createEventCommands } from './events'
import { createFormCommands } from './forms'
import { createMapCommands } from './map'
import { createMarkerCommands } from './markers'
import { createResourceCommands } from './resources'
import { createUiCommands } from './ui'

export interface CommandDeps {
  mode: BridgeAccess
  modeSource: ModeSource
  installedAt: number
  eventLog: EventLog
  snapshot: (options?: SnapshotOptions) => Promise<unknown>
  getManifest: () => BridgeManifest
  getHelp: (options?: { group?: string }) => string
}

/** 组装 v1 全部命令 */
export const createCommands = (deps: CommandDeps): BridgeCommand[] => [
  ...createAppCommands(deps),
  ...createUiCommands(),
  ...createAuthCommands(),
  ...createDatasetCommands(),
  ...createMarkerCommands(),
  ...createResourceCommands(),
  ...createMapCommands(),
  ...createArchiveCommands(),
  ...createFormCommands(),
  ...createEventCommands(deps.eventLog),
  ...createDevCommands(),
]
