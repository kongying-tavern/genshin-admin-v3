<script
  lang="ts"
  setup
  generic="
    T extends { [key: string]: string | number } | unknown,
    K extends string,
    V extends unknown
  "
>
import { useGlobalDialog } from '@/hooks'
import MultiDialog from './MarkerFilterSelectMultiDialog.vue'
import SingleDialog from './MarkerFilterSelectSingleDialog.vue'

const props = withDefaults(
  defineProps<{
    value?: V | V[] | null
    multiple?: boolean
    list: T[]
    labelKey: K
    valueKey: K
    dialogTitle?: string
    dialogListClass?: string
  }>(),
  {
    value: null,
  },
)

const emits = defineEmits<{
  change: [v: V | V[]]
  cancel: []
}>()

const { DialogService } = useGlobalDialog()

const openDialog = () => {
  if (props.multiple) {
    const controller = DialogService.props({
      modelValue: props.value,
      title: props.dialogTitle,
      listClass: props.dialogListClass,
      list: props.list,
      labelKey: props.labelKey,
      valueKey: props.valueKey,
    })
      .listeners({
        confirm: v => {
          emits('change', v as V[])
          controller.close()
        },
        cancel: () => {
          emits('cancel')
          controller.close()
        },
      })
      .open(MultiDialog)
  } else {
    const controller = DialogService.props({
      modelValue: props.value,
      title: props.dialogTitle,
      listClass: props.dialogListClass,
      list: props.list,
      labelKey: props.labelKey,
      valueKey: props.valueKey,
    })
      .listeners({
        confirm: v => {
          emits('change', v as V)
          controller.close()
        },
        cancel: () => {
          emits('cancel')
          controller.close()
        },
      })
      .open(SingleDialog)
  }
}
</script>

<template>
  <div class="inline-block" @click="openDialog">
    <slot />
  </div>
</template>
