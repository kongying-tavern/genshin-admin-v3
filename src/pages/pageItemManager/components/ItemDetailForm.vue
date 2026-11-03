<script lang="ts" setup>
import type { ItemVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { AppTimeSelect } from '@/components'
import { useRefreshTime } from '@/hooks'
import { HIDDEN_FLAG_OPTIONS, ICON_STYLE_META_MAP, SPECIALFLAG_OPTIONS } from '@/shared'
import { useAccessStore, useAreaStore, useIconStore, useItemTypeStore } from '@/stores'
import { lengthCheck, requireCheck } from '@/utils'
import { useSpecialFlag } from '../hooks'

const props = defineProps<{
  modelValue: ItemVo
}>()

const emits = defineEmits<{
  'update:modelValue': [item: ItemVo]
}>()

const accessStore = useAccessStore()
const iconStore = useIconStore()

// ==================== 表单数据 ====================
const formData = ref(props.modelValue)

const isIntarnalChange = ref(false)

// 下行同步
watch(
  () => props.modelValue,
  () => {
    if (isIntarnalChange.value) return (isIntarnalChange.value = false)
    formData.value = props.modelValue
  },
  { deep: true },
)

// 上行同步
watch(
  formData,
  () => {
    isIntarnalChange.value = true
    emits('update:modelValue', formData.value)
  },
  { deep: true },
)

// ==================== 表单校验 ====================
const formRef = ref<ElFormType | null>(null)

const rules: ItemFormRules<ItemVo> = {
  name: [lengthCheck('blur', '名称', 10)],
  areaId: [requireCheck('change', '地区')],
  hiddenFlag: [requireCheck('change', '显示类型')],
  typeIdList: [
    {
      required: true,
      message: '至少需要一个物品类型',
      validator: (_, typeIds) => typeIds.length >= 1,
      trigger: 'change',
    },
  ],
}

// ==================== 物品地区 ====================
const areaStore = useAreaStore()

const areaList = computed(() =>
  areaStore.areaList
    .filter(area => area.isFinal)
    .sort(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia),
)

// ==================== 物品类型 ====================
const itemTypeStore = useItemTypeStore()

const itemTypeList = computed(() =>
  itemTypeStore.itemTypeList
    .filter(itemType => itemType.isFinal)
    .sort(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia),
)

// ==================== 显示类型 ====================
const hiddenFlagOptions = useArrayFilter(HIDDEN_FLAG_OPTIONS, ({ value }) =>
  accessStore.checkHiddenFlag(value),
)

// ==================== 物品图标 ====================
const iconList = computed(() =>
  iconStore.iconList.map(icon => ({
    label: icon.tag ?? '',
    value: icon.id,
    url: icon.url,
  })),
)

// ==================== 图标类型 ====================
const iconStyleOptions = [...ICON_STYLE_META_MAP.entries()].map(([key, meta]) => ({
  label: meta.name,
  value: key,
  disabled: meta.disabled,
}))

// ==================== 刷新时间 ====================
const refreshTime = computed({
  get: () => formData.value.defaultRefreshTime,
  set: v => (formData.value.defaultRefreshTime = v),
})
const { refreshTimeType, refreshTimeTypeOptions, isCustom } = useRefreshTime(refreshTime)

// ==================== 特殊标识 ====================
const { specialFlag } = useSpecialFlag(formData)

// ==================== 其他定义 ====================
defineExpose({
  validate: () => formRef.value?.validate().catch(() => false),
})
</script>

<template>
  <el-form ref="formRef" v-bind="$attrs" label-width="80px" :model="formData" :rules="rules">
    <div class="grid grid-cols-2 gap-x-4">
      <el-form-item label="物品名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入物品名称" />
      </el-form-item>

      <el-form-item label="物品属性" prop="specialFlag">
        <el-select-v2
          v-model="specialFlag"
          :options="SPECIALFLAG_OPTIONS.filter(option => option.value !== 'none')"
          filterable
          collapse-tags
          collapse-tags-tooltip
          multiple
          placeholder="选择物品属性"
          style="width: 100%"
        />
      </el-form-item>
    </div>

    <el-form-item label="描述模板" prop="defaultContent">
      <el-input
        v-model="formData.defaultContent"
        placeholder="例：在此处找到【】接取委托，完成后可获得【冒险阅历+、原石×、大英雄的经验×、摩拉×?0000】"
        type="textarea"
        :rows="3"
      />
    </el-form-item>

    <div class="grid grid-cols-2 gap-x-4">
      <el-form-item label="地区" prop="areaId">
        <el-select-v2
          v-model="formData.areaId"
          :options="areaList"
          :props="{ label: 'name', value: 'id' }"
          filterable
          placeholder="选择地区"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="类型" prop="typeIdList">
        <el-select-v2
          v-model="formData.typeIdList"
          :options="itemTypeList"
          :props="{ label: 'name', value: 'id' }"
          filterable
          collapse-tags
          collapse-tags-tooltip
          multiple
          placeholder="选择类型"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="默认数量" prop="defaultCount">
        <el-input-number v-model="formData.defaultCount" :max="5" :min="1" style="width: 100%" />
      </el-form-item>

      <el-form-item label="显示类型" prop="hiddenFlag">
        <el-select-v2
          v-model="formData.hiddenFlag"
          :options="hiddenFlagOptions"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="图标类型" prop="iconStyleType">
        <el-select-v2
          v-model="formData.iconStyleType"
          :options="iconStyleOptions"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="排序权重" prop="sortIndex">
        <el-input-number
          v-model="formData.sortIndex"
          :min="-65536"
          :max="65535"
          :step="1"
          placeholder="请输入权重"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="物品图标" prop="iconId">
        <el-select-v2
          v-model="formData.iconId"
          :options="iconList"
          filterable
          placeholder="选择图标"
          style="width: 100%"
        >
          <template #default="{ item }">
            <div class="flex items-center gap-2">
              <img
                v-if="Boolean(item.url)"
                :src="item.url"
                class="object-contain p-[2px] w-[34px] h-[34px]"
                loading="lazy"
                crossorigin=""
              />
              <span
                class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                :title="item.label"
                >{{ item.label }}</span
              >
            </div>
          </template>
        </el-select-v2>
      </el-form-item>

      <el-form-item label="图标预览">
        <div v-if="formData.iconId" class="flex items-center gap-4">
          <div class="w-8 h-8 relative" :class="`icon-type-${formData.iconStyleType}`">
            <img
              class="w-8 h-8 object-contain overflow-hidden absolute left-0 top-0"
              :src="iconStore.idMap.get(formData.iconId)?.url"
              draggable="false"
              crossorigin=""
            />
          </div>
          <div class="w-8 h-8 relative is-markered" :class="`icon-type-${formData.iconStyleType}`">
            <img
              class="w-8 h-8 object-contain overflow-hidden absolute left-0 top-0"
              :src="iconStore.idMap.get(formData.iconId)?.url"
              draggable="false"
              crossorigin=""
            />
          </div>
        </div>
      </el-form-item>

      <el-form-item label="刷新时间" prop="defaultRefreshTime">
        <el-select-v2 v-model="refreshTimeType" :options="refreshTimeTypeOptions" style="flex: 1" />
      </el-form-item>

      <el-form-item label-width="0px">
        <AppTimeSelect v-model="refreshTime" :disabled="!isCustom" style="flex: 1" />
      </el-form-item>
    </div>
  </el-form>
</template>

<style scoped>
.icon-type-0 > img {
  border-radius: 50%;
  border: 4px solid #00f5f3;
  outline: 2px solid #cccccc60;
  background-color: #cccccc60;
}
:is(.icon-type-0, .icon-type-1).is-markered::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 60%;
  transform-origin: 50% 50%;
  transform: translateY(20%) rotate(-45deg) scale(0.7);
  border-width: 0 0 6px 6px;
  border-style: solid;
  border-color: #41dfb4;
  filter: drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff);
  z-index: 1;
}
</style>
