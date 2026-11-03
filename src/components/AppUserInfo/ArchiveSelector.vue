<script lang="ts" setup>
import { Flag } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useArchiveStore, useAreaStore, useItemStore, useMarkerStore } from '@/stores'
import { ArchiveCreator, ArchiveViewer } from '.'

const areaStore = useAreaStore()
const archiveStore = useArchiveStore()
const itemStore = useItemStore()
const markerStore = useMarkerStore()

const { archiveSlots } = storeToRefs(archiveStore)

// 从米忽悠白嫖背景图
const AREA_IMG_URLS: Record<string, string> = {
  NA: 'https://uploadstatic.mihoyo.com/contentweb/20200928/2020092810263982019.jpg',
  MD: 'https://uploadstatic.mihoyo.com/contentweb/20200319/2020031921550320292.jpg',
  LY: 'https://uploadstatic.mihoyo.com/contentweb/20200319/2020031921552395638.jpg',
  DQ: 'https://uploadstatic.mihoyo.com/contentweb/20210719/2021071918001232800.jpg',
  XM: 'https://webstatic.mihoyo.com/upload/contentweb/2022/08/15/8969f683b92839ac427c875d0d742be2_4825576482548821743.jpg',
  FD: 'https://act-webstatic.mihoyo.com/upload/contentweb/hk4e/721a74c43614d7aeb25b046cabfb57be_2012964858524199390.jpg',
  NT: 'https://fastcdn.mihoyo.com/content-v2/hk4e/125133/b86e153b41b5106f287d7bcb0e801a14_1435745599367653211.jpg',
  NDKL: 'https://fastcdn.mihoyo.com/content-v2/hk4e/159347/cbfdfee5c271ee8fa07a121b1809982f_4021873944712892023.jpg',
}

const lastestMarkerArea = computed(() => {
  const areas: Record<number, string> = {}
  const setUrl = (slotIndex?: number, url = AREA_IMG_URLS.NA) => {
    if (slotIndex === undefined) return
    areas[slotIndex] = url
  }
  for (const key in archiveStore.archiveSlots) {
    const archiveSlot = archiveStore.archiveSlots[key]
    const latestArchive = archiveSlot?.archiveList[0]
    const latestMarkerId = latestArchive ? [...latestArchive.body.Data_KYJG].at(-1) : undefined
    if (!latestMarkerId) {
      setUrl(archiveSlot?.slotIndex)
      continue
    }
    const marker = markerStore.idMap.get(latestMarkerId)
    if (!marker) {
      setUrl(archiveSlot?.slotIndex)
      continue
    }
    const firstItemId = marker.itemList?.[0]?.itemId
    if (!firstItemId) continue
    const item = itemStore.idMap.get(firstItemId)
    if (!item) {
      setUrl(archiveSlot?.slotIndex)
      continue
    }
    const area = areaStore.areaIdMap.get(item.areaId!)
    if (!area) {
      setUrl(archiveSlot?.slotIndex)
      continue
    }
    setUrl(archiveSlot?.slotIndex, AREA_IMG_URLS[(area.code as string).split(':')[1]])
  }
  return areas
})

const archiveCreateIndex = ref<number>()
const archiveViewIndex = ref<number>()

const timeFormater = (time?: string) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '')
</script>

<template>
  <div class="flex h-full flex-col justify-between py-2 px-4">
    <div v-if="archiveStore.fetchLoading">正在加载存档...</div>

    <template v-else>
      <template v-for="(archiveSlot, index) of archiveSlots">
        <div
          v-if="archiveSlot"
          :key="archiveSlot.id"
          :class="{
            'has-slot': archiveSlot !== undefined,
            actived: `${index}` === `${archiveStore.currentArchive.slotIndex}`,
          }"
          class="archive-item outline-card item-enter-anime"
          @click="archiveViewIndex = archiveSlot.slotIndex"
        >
          <div class="archive-banner items-center text-lg grid place-items-start">
            <el-image
              :src="lastestMarkerArea[archiveSlot.slotIndex as number]"
              class="absolute w-full h-full left-0 top-0 object-center"
              fit="cover"
              style="z-index: -1"
              crossorigin=""
            >
              <template #placeholder>
                <el-skeleton style="width: 536px; height: 99px" animated>
                  <template #template>
                    <el-skeleton-item variant="image" style="width: 100%; height: 100%" />
                  </template>
                </el-skeleton>
              </template>
              <template #error>
                <div style="width: 536px; height: 99px" />
              </template>
            </el-image>
            <div
              v-show="`${index}` === `${archiveStore.currentArchive.slotIndex}`"
              class="absolute left-3 top-3 w-10 h-10 rounded-full border-2 grid place-items-center"
              style="border-color: #5dffa3"
            >
              <el-icon :size="32" color="#5dffa3">
                <Flag />
              </el-icon>
            </div>
          </div>

          <div
            class="archive-name flex justify-between items-center gap-4 whitespace-nowrap overflow-hidden"
          >
            <div class="text-ellipsis overflow-hidden" :title="archiveSlot.name">
              {{ index }}. {{ archiveSlot.name }}
            </div>
            <div>更新时间 {{ timeFormater(archiveSlot.updateTime) }}</div>
          </div>
        </div>

        <div
          v-else
          :key="`empty-${Number(index)}`"
          class="archive-item outline-card item-enter-anime empty"
          @click="archiveCreateIndex = Number(index)"
        >
          <div class="archive-banner" />
          <div class="archive-name">{{ index }}. &lt;新建存档&gt;</div>
        </div>
      </template>
    </template>

    <ArchiveCreator v-model:slot-index="archiveCreateIndex" />
    <ArchiveViewer v-model:slot-index="archiveViewIndex" />
  </div>
</template>

<style lang="scss" scoped>
.outline-card {
  outline: 2px solid transparent;
  transition: all 100ms ease;
  border-radius: 8px;
}

@keyframes gs-slide-in {
  from {
    translate: -30px 0;
    opacity: 0;
  }
  to {
    translate: 0 0;
    opacity: 1;
  }
}

.item-enter-anime {
  opacity: 0;
  translate: -30px 0;
  animation: gs-slide-in 200ms ease forwards;
  @for $i from 1 through 5 {
    &:nth-of-type(#{$i}) {
      animation-delay: #{$i * 50}ms;
    }
  }
}

@property --bg-color-right {
  syntax: '<color>';
  inherits: false;
  initial-value: #fff;
}

@property --bg-color-left {
  syntax: '<color>';
  inherits: false;
  initial-value: #fff;
}

// TODO active 效果不是很好看，待优化
.archive-item {
  --bg-color-left: #d99242;
  --bg-color-right: #ad7e4d;
  --banner-background: linear-gradient(to right, var(--bg-color-left), var(--bg-color-right));
  --add-icon-visible: none;
  --title-bg-color: #e9e5dc;

  user-select: none;
  overflow: hidden;
  cursor: pointer;
  filter: drop-shadow(0 0 2px rgba(128 128 128 / 0.7));
  transition:
    --bg-color-right ease 500ms,
    --bg-color-left ease 500ms,
    background-color ease 300ms,
    color ease 300ms,
    scale linear 100ms;
  position: relative;

  &:hover {
    scale: 1.02;
    outline-color: #fff;
  }
  &:active {
    scale: 1;
  }

  &.empty {
    --banner-background: #7a7b7e;
    --add-icon-visible: block;
  }
  &.actived {
    outline: 2px solid #26cd6f;
  }
  &.has-slot {
    --title-bg-color: #e9e5dc;
  }
}

// 加号的剪切图案
@mixin clip-shape-plus() {
  clip-path: path(
    'M 2 19 \
    L 19 19 \
    L 19 2 \
    Q 19 0 21 0 \
    L 29 0 \
    Q 31 0 31 2 \
    L 31 19 \
    L 48 19 \
    Q 50 19 50 21 \
    L 50 29 \
    Q 50 31 48 31 \
    L 31 31 \
    L 31 48 \
    Q 31 50 29 50 \
    L 21 50 \
    Q 19 50 19 48 \
    L 19 31 \
    L 2 31 \
    Q 0 31 0 29 \
    L 0 21 \
    Q 0 19 2 19 \
    Z \
  '
  );
}

.archive-banner {
  background: var(--banner-background);
  height: 99px;
  clip-path: inset(0 round 0 0 8px 0);
  &::before {
    scale: 0.8;
    display: var(--add-icon-visible);
    content: '';
    width: 50px;
    height: 50px;
    background: #cccccd;
    position: absolute;
    left: calc(50% - 25px);
    top: 5px;
    @include clip-shape-plus();
  }
}

.archive-name {
  width: 100%;
  padding: 6px 16px;
  font-size: 16px;
  position: absolute;
  bottom: 0;
  background: var(--title-bg-color);
}
</style>
