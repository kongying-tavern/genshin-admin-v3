<script setup lang="ts" generic="T">
import { fromEvent as fromRefEvent, useSubscription } from '@vueuse/rxjs'
import { debounceTime, filter, finalize, map, race, switchMap, takeUntil, tap } from 'rxjs'
import { parentDragId } from './shared'

const props = withDefaults(
  defineProps<{
    getKey?: (data: T) => string
    /** 拖拽排序动画的过渡时间 */
    transitionDuration?: number
    /** 是否在 focus-within 状态下进行拖拽（可能会阻止 input 等元素的文本选择操作） */
    draggableInFocusWithin?: boolean
  }>(),
  {
    transitionDuration: 150,
  },
)

const emits = defineEmits<{
  change: [T[]]
}>()

defineSlots<{
  default: (props: {
    item: T
    index: number
    isDragging: boolean
    isGrabbing: boolean
  }) => Component[]
}>()

interface KeyData {
  _raw: T
  key: string
}

const modelValue = defineModel<T[]>('modelValue', {
  required: false,
  default: () => [],
})

const containerRef = ref() as Ref<HTMLElement>

/** 拖拽识别 id */
const DRAG_ID = [...crypto.getRandomValues(new Uint8Array(5))]
  .map(num => num.toString(16).padStart(2, '0'))
  .join('')
provide(parentDragId, DRAG_ID)

/** 用于处理递归场景 */
const parent = inject(parentDragId, undefined)

/** 过渡样式只需要一个 */
if (!parent) {
  const { load, unload } = useStyleTag(
    computed(
      () => `
::view-transition-group(*) {
  animation-duration: ${props.transitionDuration}ms;
  animation-timing-function: ease;
}
`,
    ),
    {
      immediate: false,
    },
  )

  onActivated(load)
  onDeactivated(unload)
}

const pointerdown = fromRefEvent(containerRef, 'pointerdown')
const pointerup = fromRefEvent(containerRef, 'pointerup')
const dragend = fromRefEvent(containerRef, 'dragend')
const dragstart = fromRefEvent(containerRef, 'dragstart')
const dragenter = fromRefEvent(containerRef, 'dragenter')

/** 是否可拖拽 */
const draggable = ref(false)

// 控制列表是否可进行拖拽的逻辑
useSubscription(
  pointerdown
    .pipe(
      filter(() => !props.draggableInFocusWithin),
      tap(ev => {
        const text = ev
          .composedPath()
          .find(el => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
        draggable.value = !text
      }),
      switchMap(() =>
        race(pointerup, dragend).pipe(
          tap(() => {
            draggable.value = false
          }),
        ),
      ),
    )
    .subscribe(),
)

const isDragging = ref(false)

const sourceData = ref<KeyData>()
const targetData = ref<KeyData>()

const initShadowList = (list: T[]): KeyData[] =>
  list.map((value, index) => ({
    _raw: value,
    key: props.getKey ? props.getKey(value) : `${index}`,
  }))

const shadowData = ref(initShadowList(modelValue.value)) as Ref<KeyData[]>

const dataKeyMap = computed(() =>
  shadowData.value.reduce((map, data) => {
    return map.set(data.key, data)
  }, new Map<string, KeyData>()),
)

const isInternalUpdate = ref(false)

watch(
  () => modelValue.value,
  list => {
    if (isInternalUpdate.value) {
      isInternalUpdate.value = false
      return
    }
    shadowData.value = initShadowList(list)
  },
  { deep: true },
)

const getDragWrapper = (target: EventTarget | null): HTMLElement | undefined => {
  if (!target) return

  if (!(target instanceof HTMLElement)) return

  if (target.dataset.dragId === DRAG_ID) return target

  return getDragWrapper(target.parentElement)
}

const move = (fromIndex: number, toIndex: number) => {
  const element = shadowData.value.splice(fromIndex, 1)[0]
  shadowData.value.splice(toIndex, 0, element)
  targetData.value = undefined
}

// 拖拽排序核心逻辑
useSubscription(
  dragstart
    .pipe(
      map(event => {
        const triggerElement = event.composedPath().find(target => {
          return target instanceof HTMLElement && target.dataset.dragId === DRAG_ID
        }) as HTMLElement | undefined
        const data =
          triggerElement === undefined
            ? undefined
            : dataKeyMap.value.get(triggerElement.dataset.key ?? '')
        return { data, event }
      }),

      filter(({ data }) => data !== undefined),

      tap(({ data, event }) => {
        event.stopPropagation()
        sourceData.value = data
        isDragging.value = true
      }),

      switchMap(() =>
        dragenter.pipe(
          debounceTime(props.transitionDuration),

          map(ev => {
            const result = getDragWrapper(ev.target)
            if (!result || !sourceData.value) return {}

            const { key = '' } = result.dataset
            if (key === sourceData.value.key || key === targetData.value?.key) return {}

            const data = dataKeyMap.value.get(key)
            targetData.value = data!

            let fromIndex: number | undefined
            let toIndex: number | undefined
            const { length } = shadowData.value
            for (let index = 0; index < length; index++) {
              const item = shadowData.value[index]
              if (fromIndex === undefined && sourceData.value!.key === item.key) fromIndex = index
              else if (toIndex === undefined && data!.key === item.key) toIndex = index
              if (fromIndex !== undefined && toIndex !== undefined) break
            }

            return { fromIndex, toIndex }
          }),

          filter(({ fromIndex, toIndex }) => fromIndex !== undefined && toIndex !== undefined),

          tap(({ fromIndex, toIndex }) => {
            document.startViewTransition(() => {
              move(fromIndex!, toIndex!)
            })
          }),

          takeUntil(dragend),

          finalize(() => {
            sourceData.value = undefined
            targetData.value = undefined
            isDragging.value = false
            const result = shadowData.value.map(({ _raw }) => _raw)
            modelValue.value = result
            emits('change', result)
          }),
        ),
      ),
    )
    .subscribe(),
)
</script>

<template>
  <div
    ref="containerRef"
    class="sortable-table"
    :class="{
      'is-dragging': isDragging,
    }"
  >
    <template v-for="(item, index) in shadowData" :key="item.key">
      <div
        :data-key="item.key"
        :data-drag-id="DRAG_ID"
        :style="{
          'view-transition-name': `key-${item.key}`,
        }"
        :draggable="draggable"
      >
        <slot
          name="default"
          :item="item._raw"
          :index="index"
          :is-grabbing="sourceData?.key === item.key"
          :is-dragging="isDragging"
        />
      </div>
    </template>
  </div>
</template>
