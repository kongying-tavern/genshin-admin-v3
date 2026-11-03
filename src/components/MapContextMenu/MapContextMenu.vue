<script lang="ts" setup>
import { Plus, Setting } from '@element-plus/icons-vue'
import { useSubscription } from '@vueuse/rxjs'
import { storeToRefs } from 'pinia'
import { AppSettings, GSButton } from '@/components'
import { useGlobalDialog } from '@/hooks'
import { MapSubject } from '@/shared'
import {
  useAccessStore,
  useItemStore,
  useMapStateStore,
  usePreferenceStore,
  useTileStore,
} from '@/stores'
import { MapAffix } from '../MapAffix'
import { MarkerCreator } from '../MarkerModifyer'

const isDev = import.meta.env.DEV

const accessStore = useAccessStore()
const mapStateStore = useMapStateStore()
const tileStore = useTileStore()
const preferenceStore = usePreferenceStore()
const { itemIdMap } = storeToRefs(useItemStore())

const markingItem = computed(() => itemIdMap.value.get(preferenceStore.defaultMarkingItemId))

const coordinate = shallowRef<DTO.Coordinate2D | null>(null)

const closeContextmenu = () => {
  coordinate.value = null
}

watch(() => mapStateStore.mission, closeContextmenu)

useSubscription(
  MapSubject.click.subscribe(({ info, event }) => {
    if (!event.rightButton || mapStateStore.mission) return closeContextmenu()
    coordinate.value = info.coordinate as DTO.Coordinate2D
  }),
)

const { DialogService } = useGlobalDialog()

const openMarkerCreator = async () => {
  DialogService.config({
    width: 'fit-content',
    alignCenter: true,
    showClose: false,
    closeOnClickModal: false,
    closeOnPressEscape: false,
  })
    .props({
      coordinate: tileStore.toMarkerCoordinate(coordinate.value as DTO.Coordinate2D),
      defaultItem: markingItem.value,
    })
    .open(MarkerCreator)
  closeContextmenu()
}

const copyCoordinate = (coord: DTO.Coordinate2D) => {
  const text = `[${coord.map(x => x.toFixed(0)).join(', ')}]`
  navigator.clipboard.writeText(text)
}

const openSettingDialog = () => {
  DialogService.config({
    alignCenter: true,
    width: 'fit-content',
  }).open(AppSettings)
  closeContextmenu()
}
</script>

<template>
  <Transition name="fade">
    <MapAffix v-if="coordinate" :pos="coordinate" pickable no-covert-coord>
      <div class="context-menu ml-2 mt-2 flex flex-col gap-1 relative" @contextmenu.prevent="">
        <GSButton v-if="accessStore.get('MARKER_CREATE')" @click="openMarkerCreator">
          <template #icon>
            <el-icon color="var(--gs-color-confirm)">
              <Plus />
            </el-icon>
          </template>
          添加点位
        </GSButton>

        <GSButton v-if="isDev" @click="copyCoordinate(coordinate!)">
          原始坐标: [{{ coordinate[0].toFixed(0) }}, {{ coordinate[1].toFixed(0) }}]
        </GSButton>

        <GSButton v-if="isDev" @click="copyCoordinate(tileStore.toMarkerCoordinate(coordinate!))">
          标记坐标:
          {{
            `[${tileStore
              .toMarkerCoordinate(coordinate)
              .map(x => x.toFixed(0))
              .join(', ')}]`
          }}
        </GSButton>

        <GSButton @click="openSettingDialog">
          <template #icon>
            <el-icon color="var(--el-color-primary)">
              <Setting />
            </el-icon>
          </template>
          系统设置
        </GSButton>
      </div>
    </MapAffix>
  </Transition>
</template>

<style lang="scss" scoped>
.context-menu {
  border-radius: 6px;
  filter: drop-shadow(0 0 6px #333);
  background: transparent;

  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -8px;
    width: 100px;
    height: 100px;
    background:
      linear-gradient(
        to bottom,
        transparent calc(50% - 0.5px),
        red calc(50% - 0.5px),
        red calc(50% + 0.5px),
        transparent calc(50% + 0.5px)
      ),
      linear-gradient(
        to right,
        transparent calc(50% - 0.5px),
        red calc(50% - 0.5px),
        red calc(50% + 0.5px),
        transparent calc(50% + 0.5px)
      );
    translate: -50% -50%;
    pointer-events: none;
    z-index: -1;
  }
}
</style>
