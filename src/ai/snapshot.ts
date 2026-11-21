import type {
  SnapshotContext,
  SnapshotOptions,
  SnapshotResult,
  SnapshotSection,
  SnapshotSectionKey,
} from './types'
import { AI_BRIDGE_SCHEMA_VERSION } from './constants'
import { sanitize } from './sanitize'

export interface SnapshotBuilderOptions {
  now?: () => number
}

/**
 * 创建快照构建器。
 *
 * 每个 section 独立执行，单个 section 失败只记录在 meta.failedSections，不影响其余 section。
 */
export const createSnapshotBuilder = (
  sections: SnapshotSection[],
  options: SnapshotBuilderOptions = {},
) => {
  const now = options.now ?? Date.now

  return async (snapshotOptions: SnapshotOptions = {}): Promise<SnapshotResult> => {
    const startedAt = now()
    const requested =
      snapshotOptions.sections && snapshotOptions.sections.length
        ? new Set<SnapshotSectionKey>(snapshotOptions.sections)
        : undefined

    const context: SnapshotContext = {
      includeSurfaceStates: snapshotOptions.includeSurfaceStates ?? true,
      includeWindowStates: snapshotOptions.includeWindowStates ?? true,
      maxStringLength: snapshotOptions.maxStringLength ?? 20000,
      now,
    }

    const result: SnapshotResult = {
      meta: {
        schemaVersion: AI_BRIDGE_SCHEMA_VERSION,
        capturedAt: startedAt,
        durationMs: 0,
        requestedSections: [],
        failedSections: [],
      },
    }

    for (const section of sections) {
      if (requested && !requested.has(section.key)) continue
      result.meta.requestedSections.push(section.key)
      try {
        result[section.key] = await section.build(context)
      } catch (error) {
        result.meta.failedSections.push({
          section: section.key,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    result.meta.durationMs = Math.max(0, now() - startedAt)
    return sanitize<SnapshotResult>(result, {
      maxStringLength: context.maxStringLength,
    })
  }
}
