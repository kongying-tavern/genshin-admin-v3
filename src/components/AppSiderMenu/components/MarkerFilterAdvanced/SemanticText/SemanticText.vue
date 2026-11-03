<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'
import { cloneDeep } from 'lodash'
import { storeToRefs } from 'pinia'
import { useMapStateStore } from '@/stores'
import { SemanticBlock } from '.'

const { markerAdvancedComposed, markerAdvancedCacheCount } = storeToRefs(useMapStateStore())

const semUnitLeftParenthesis: MAFSemanticUnit = { type: 'parenthesis', text: '(' }
const semUnitRightParenthesis: MAFSemanticUnit = { type: 'parenthesis', text: ')' }
const semUnitAndLogic: MAFSemanticUnit = { type: 'logic-operator', text: '且' }
const semUnitOrLogic: MAFSemanticUnit = { type: 'logic-operator', text: '或' }
const semUnitNotLogic: MAFSemanticUnit = { type: 'opposite-indicator', text: '非' }

const semanticAppend = (
  blocks: MAFSemanticUnit[],
  ...args: (MAFSemanticUnit | null | undefined)[]
) => {
  const blockSize = blocks.length
  const refinedArgs = args.filter(block => block) as MAFSemanticUnit[]
  blocks.splice(blockSize, 0, ...refinedArgs)
}

const semBlocks = computed<MAFSemanticUnit[]>(() => {
  const blocks: MAFSemanticUnit[] = []

  // 处理分组数据
  markerAdvancedComposed.value.forEach((group, groupIndex) => {
    const { operator: groupOperator = true, opposite: groupOpposite = false, children = [] } = group
    if (groupIndex > 0)
      semanticAppend(blocks, cloneDeep(groupOperator ? semUnitAndLogic : semUnitOrLogic))
    semanticAppend(
      blocks,
      groupOpposite ? cloneDeep(semUnitNotLogic) : null,
      cloneDeep(semUnitLeftParenthesis),
    )

    // 处理子数据
    children.forEach((child, childIndex) => {
      const {
        operator: itemOperator = true,
        opposite: itemOpposite = false,
        value = {},
        option = {},
        meta = {},
        semantic,
      } = child
      if (childIndex > 0)
        semanticAppend(blocks, cloneDeep(itemOperator ? semUnitAndLogic : semUnitOrLogic))
      if (semantic && typeof semantic === 'function') {
        const semanticParts = semantic(value, toValue(option), meta, itemOpposite).filter(v => v)
        semanticAppend(blocks, ...semanticParts)
      }
    })

    semanticAppend(blocks, cloneDeep(semUnitRightParenthesis))
  })
  return blocks
})
</script>

<template>
  <div v-if="markerAdvancedCacheCount > 0" class="semantic-text">
    <SemanticBlock v-for="(block, index) in semBlocks" :key="index" :block="block" />
  </div>
</template>

<style lang="scss" scoped>
.semantic-text {
  --radius: 8px;
  --color-bg: #c6c2ba;
  --color-text: #313131;

  background-color: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--radius);
  padding: 8px;

  :deep(.semantic-block) {
    display: inline;
    word-break: break-all;
  }
}
</style>
