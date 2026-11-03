<script
  lang="ts"
  setup
  generic="
    T extends { [key: string]: string | number } | unknown,
    K extends string,
    V extends unknown
  "
>
import MultiDialog from './MarkerFilterSelectMultiDialog.vue'
import SingleDialog from './MarkerFilterSelectSingleDialog.vue'

const props = defineProps<{
  multiple?: boolean
  list: T[]
  labelKey: K
  valueKey: K
  dialogTitle?: string
  dialogListClass?: string
}>()

const emits = defineEmits<{
  change: [V | V[]]
  cancel: []
}>()

const modelValue = defineModel<V | V[]>('modelValue', {
  required: false,
  default: null,
})

const dialogValue: Ref<V | V[] | undefined> = ref(undefined)

const dialogTemplate = computed<Component>(() => (props.multiple ? MultiDialog : SingleDialog))

const dialogVisible = ref<boolean>(false)

const openDialog = () => {
  dialogValue.value = modelValue.value
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
}

const confirm = (v: V | V[]) => {
  modelValue.value = v
  emits('change', v)
  closeDialog()
}

const cancel = () => {
  emits('cancel')
  closeDialog()
}
</script>

<template>
  <div class="inline-block" @click="openDialog()">
    <slot />
  </div>

  <el-dialog
    v-model="dialogVisible"
    width="fit-content"
    append-to-body
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="custom-dialog hidden-header bg-transparent"
  >
    <component
      :is="dialogTemplate"
      v-model="dialogValue"
      v-bind="{
        title: dialogTitle,
        listClass: dialogListClass,
        list,
        labelKey,
        valueKey,
      }"
      @confirm="confirm"
      @cancel="cancel"
    >
      <template v-if="$slots.list" #list="slotProps">
        <slot name="list" v-bind="slotProps" />
      </template>
    </component>
  </el-dialog>
</template>
