<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { GSButton, GSDivider, GSInput } from '@/components'
import { usePresetImport, usePresetLoad, usePresetName } from '../hooks'

const emit = defineEmits<{
  load: []
}>()

const presetName = usePresetName()
const code = shallowRef<string>('')

const importCallback = (success: boolean) => {
  if (success) {
    ElMessage.success({
      message: '导入成功',
    })
    code.value = ''
    presetName.value = ''
  } else {
    ElMessage.error({
      message: '导入失败，分享码无效',
    })
  }
}

const { importCode, importConditions } = usePresetImport({
  code,
  name: presetName,
  importCallback,
})

const loadCallback = (success: boolean) => {
  if (success) {
    ElMessage.success({
      message: '加载成功',
    })
    code.value = ''
    presetName.value = ''
    emit('load')
  } else {
    ElMessage.error({
      message: '加载失败，分享码无效',
    })
  }
}

const { loadPreset } = usePresetLoad({
  name: presetName,
  loadCallback,
})
</script>

<template>
  <div class="flex flex-col h-full gap-3 pt-1">
    <el-input
      v-model="code"
      class="share-code-input flex-1 min-h-0"
      type="textarea"
      resize="none"
      placeholder="请输入分享码"
    />
    <GSInput v-model="presetName" class="box-border" placeholder="请输入预设名称" />

    <GSDivider :height="24" color="#76716A" />

    <div class="flex gap-3">
      <GSButton
        :disabled="!code"
        class="flex-1 box-border"
        icon="submit"
        :style="{ '--icon-color': 'var(--gs-color-success)' }"
        @click="loadPreset(importConditions)"
      >
        加载
      </GSButton>
      <GSButton
        :disabled="!code || !presetName"
        class="flex-1 box-border"
        icon="submit"
        @click="importCode()"
      >
        导入
      </GSButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.share-code-input {
  // 该 class 直接落在 el-input(type="textarea") 的根节点上，
  // 根节点自身就是 .el-textarea，因此不能用后代选择器 `:deep(.el-textarea)`。
  height: 100%;

  :deep(.el-textarea__inner) {
    height: 100%;
    padding: 12px;
    border-radius: 8px;
    background: #2a3444;
    border: 1px solid #6b7a92;
    box-shadow: none;
    color: #d3bc8e;
    font-family: 'HYWenHei-85W';
    font-size: 14px;
    line-height: 1.6;
    font-variant-emoji: text;

    &::placeholder {
      color: #6b7a92;
    }

    &:focus {
      border-color: #6b7a92;
      box-shadow: none;
    }
  }
}
</style>
