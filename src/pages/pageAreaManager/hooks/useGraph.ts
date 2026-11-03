import type { IG6GraphEvent, TreeGraphData } from '@antv/g6'
import type { AreaVo } from '@/api/alova/globals'
import G6 from '@antv/g6'
import dayjs from 'dayjs'
import { array2Tree } from '@/utils'
import { symbolDelete, symbolMinus, symbolPlus } from '../utils'

const opacityMap = {
  container: 0.6,
  containerHover: 0.5,
  containerClick: 0.4,
  containerBorderHover: 0.9,
  containerBorderClick: 0.2,
  addChildButton: 0.5,
  addChildButtonHover: 0.7,
  addChildButtonClick: 0.6,
  deleteButton: 0.6,
  deleteButtonHover: 0.8,
  deleteButtonClick: 0.7,
  collapseButton: 0.6,
  collapseButtonHover: 0.8,
  collapseButtonClick: 0.7,
}

const colorMap: Record<string, string> = {
  MD: '#8FF3F3',
  LY: '#F7D442',
  DQ: '#D1A1FB',
  XM: '#ABDD54',
  FD: '#0FABF4',
  NT: '#FEA56F',
  NDKL: 'l(45) 0.3:#D6E4EF 1:#EDF3F9',
  APPLE: 'l(45) 0.3:#FFD700 1:#00DAFF',
  VELURIYAM: 'l(45) 0.3:#00DAFF 1:#ABDD54',
  SIMULANKA: 'l(45) 0.3:#C99CC4 1:#81EBD8',
}

export const useGraph = (options: {
  containerRef: Ref<HTMLElement | undefined>
  minimapRef: Ref<HTMLDivElement | undefined>
  data: Ref<AreaVo[]>
}) => {
  const { containerRef, minimapRef, data } = options

  const { width, height } = useElementSize(containerRef)

  const viewState = ref({
    x: 0,
    y: 0,
    zoom: 0,
  })

  const graphData = computed<TreeGraphData>(() => {
    const list = data.value.map(area => ({
      id: `${area.id}`,
      pid: `${area.parentId}`,
      label: `${area.name}`,
      raw: area,
    }))

    const tree = array2Tree(list, {
      childrenKey: 'children',
      getId: item => item.id,
      getPid: item => item.pid,
      rootId: '-1',
    })

    // 默认折叠最后一级节点（子节点全为叶子节点的父节点）
    const setDefaultCollapsed = (node: TreeGraphData) => {
      if (!node.children?.length) return
      const allChildrenAreLeaves = node.children.every(child => !child.children?.length)
      if (allChildrenAreLeaves) node.collapsed = true
      else node.children.forEach(setDefaultCollapsed)
    }
    tree.forEach(setDefaultCollapsed)

    return {
      id: '-1',
      label: '提瓦特',
      children: tree,
    }
  })

  const areaMap = computed(() =>
    data.value.reduce((map, area) => {
      map.set(area.id!, area)
      return map
    }, new Map<number, AreaVo>()),
  )

  const graphRef = shallowRef<InstanceType<typeof G6.TreeGraph> | null>(null)

  watch(graphData, (newGraphData, oldGraphData) => {
    const graph = graphRef.value
    if (!graph) return
    if (!oldGraphData.children?.length) {
      graph.data(newGraphData)
      graph.render()
      graph.fitView(20)
    }
  })

  const reload = () => {
    const graph = graphRef.value
    if (!graph) return
    graph.data(graphData.value)
    graph.render()
    graph.fitView(20)
  }

  useResizeObserver(containerRef, ([entry]) => {
    const { width, height } = entry.contentRect
    graphRef.value?.changeSize(width, height)
  })

  const editHook = createEventHook<[area: AreaVo, parent?: AreaVo]>()
  const addHook = createEventHook<[parent?: AreaVo]>()
  const deleteHook = createEventHook<[area: AreaVo]>()

  const sharedProps = {
    width: 240,
    height: 120,
    radius: 8,
    lineWidth: 4,
    padding: 12,
    textColorPrimary: '#000',
    textColorRegular: '#333',
  }

  const ctx = new OffscreenCanvas(0, 0).getContext('2d')!
  ctx.font = '24px serif'

  G6.registerNode('area-card', {
    draw: (cfg, group) => {
      const { label = '' } = cfg
      const { id, code = '', updateTime = '' } = (cfg.raw ?? {}) as AreaVo
      const { 1: zone = '', length: unitsLength } = code.split(':')

      /** 包围盒 */
      const container = group.addShape('rect', {
        attrs: {
          x: 0,
          y: 0,
          width: sharedProps.width,
          height: sharedProps.height,
          radius: sharedProps.radius,
          fill: colorMap[zone] ?? '#CCC',
          fillOpacity: opacityMap.container,
          cursor: code ? 'pointer' : 'inherit',
        },
        name: 'border-box',
      })

      /** 边框 */
      group.addShape('rect', {
        attrs: {
          x: -(sharedProps.lineWidth / 2),
          y: -(sharedProps.lineWidth / 2),
          width: sharedProps.width + sharedProps.lineWidth,
          height: sharedProps.height + sharedProps.lineWidth,
          radius: sharedProps.radius + sharedProps.lineWidth / 2,
          stroke: colorMap[zone] ?? '#CCC',
          strokeOpacity: opacityMap.containerBorderHover,
          lineWidth: sharedProps.lineWidth,
        },
        name: 'border',
        visible: false,
      })

      /** id */
      group.addShape('text', {
        attrs: {
          x: sharedProps.padding,
          y: sharedProps.padding,
          text: `ID: ${id ?? -1}`,
          fill: sharedProps.textColorRegular,
          fontSize: 14,
          lineHeight: 14,
          textBaseline: 'top',
        },
        name: 'code',
        capture: false,
      })

      /** code */
      group.addShape('text', {
        attrs: {
          x: sharedProps.padding,
          y: sharedProps.padding + 16,
          text: code || 'TEYVAT',
          fill: sharedProps.textColorRegular,
          fontSize: 14,
          lineHeight: 14,
          textBaseline: 'top',
        },
        name: 'code',
        capture: false,
      })

      const text = typeof label === 'string' ? label : (label.text ?? '')
      const { width: textWidth } = ctx.measureText(text)

      /** name */
      group.addShape('text', {
        attrs: {
          x: sharedProps.padding,
          y: sharedProps.padding + 36,
          text:
            textWidth > sharedProps.width - 2 * sharedProps.padding
              ? `${text.slice(0, 8)}...`
              : text,
          fill: sharedProps.textColorPrimary,
          fontSize: 24,
          lineHeight: 14,
          textBaseline: 'top',
        },
        name: 'name',
        capture: false,
      })

      /** updatetime */
      if (updateTime) {
        group.addShape('text', {
          attrs: {
            x: sharedProps.padding,
            y: sharedProps.height - sharedProps.padding - 12,
            text: `更新于: ${dayjs(updateTime).format('YYYY-MM-DD HH:mm:ss')}`,
            fill: sharedProps.textColorRegular,
            fontSize: 14,
            lineHeight: 14,
            textBaseline: 'top',
          },
          name: 'updatetime',
          capture: false,
        })
      }

      /** 添加按钮 */
      if (unitsLength < 3) {
        group.addShape('rect', {
          attrs: {
            x: 0,
            y: sharedProps.height + 8,
            width: 116,
            height: 32,
            fill: '#CCC',
            fillOpacity: opacityMap.addChildButton,
            radius: 8,
            cursor: 'pointer',
          },
          name: 'add-button',
        })

        group.addShape('marker', {
          attrs: {
            x: 16,
            y: sharedProps.height + 24,
            r: 12,
            stroke: '#333',
            lineWidth: 1,
            symbol: symbolPlus,
          },
          name: 'add-icon',
          capture: false,
        })

        group.addShape('text', {
          attrs: {
            x: 32,
            y: sharedProps.height + 32,
            text: '添加子地区',
            fontSize: 14,
            fill: '#333',
            fillOpacity: 1,
          },
          name: 'add-text',
          capture: false,
        })
      }

      /** 删除按钮 */
      if (code) {
        group.addShape('rect', {
          attrs: {
            x: sharedProps.width - 32,
            y: sharedProps.height + 8,
            width: 32,
            height: 32,
            fill: '#fccfcf',
            fillOpacity: opacityMap.deleteButton,
            radius: 8,
            cursor: 'pointer',
          },
          name: 'delete-button',
        })

        group.addShape('marker', {
          attrs: {
            x: sharedProps.width - 16,
            y: sharedProps.height + 24,
            r: 12,
            stroke: '#f53d3d',
            lineWidth: 1,
            symbol: symbolDelete,
          },
          name: 'add-icon',
          capture: false,
        })
      }

      /** 折叠按钮 */
      if (Array.isArray(cfg.children) && cfg.children?.length) {
        const isCollapsed = Boolean(cfg.collapsed)

        group.addShape('rect', {
          attrs: {
            x: 124,
            y: sharedProps.height + 8,
            width: 72,
            height: 32,
            fill: '#CCC',
            fillOpacity: opacityMap.collapseButton,
            radius: 8,
            cursor: 'pointer',
          },
          name: 'collapse-button',
        })

        group.addShape('marker', {
          attrs: {
            x: 140,
            y: sharedProps.height + 24,
            r: 12,
            stroke: '#333',
            lineWidth: 1,
            symbol: isCollapsed ? symbolPlus : symbolMinus,
          },
          name: 'collapse-icon',
          capture: false,
        })

        group.addShape('text', {
          attrs: {
            x: 156,
            y: sharedProps.height + 32,
            text: isCollapsed ? '展开' : '折叠',
            fontSize: 14,
            fill: '#333',
            fillOpacity: 1,
          },
          name: 'collapse-text',
          capture: false,
        })
      }

      return container
    },

    afterDraw: (cfg, group) => {
      const area = cfg?.raw as AreaVo | undefined

      const borderBox = group!.find(element => element.get('name') === 'border-box')!
      const border = group!.find(element => element.get('name') === 'border')!

      // hover
      borderBox.on('mouseenter', () => {
        border.show()
        borderBox.attr({
          fillOpacity: opacityMap.containerHover,
          cursor: 'pointer',
        })
      })
      borderBox.on('mouseleave', () => {
        borderBox.attr('fillOpacity', opacityMap.container)
        border.attr('border', sharedProps.lineWidth)
        border.hide()
      })
      // active
      borderBox.on('mousedown', () => {
        border.attr('lineWidth', 2)
        borderBox.attr('fillOpacity', opacityMap.containerClick)
      })
      borderBox.on('mouseup', () => {
        border.attr('lineWidth', sharedProps.lineWidth)
      })
      // click
      borderBox.on('click', () => {
        borderBox.attr('cursor', 'inherit')
      })

      const addButton = group!.find(element => element.get('name') === 'add-button')
      if (addButton) {
        // hover
        addButton.on('mouseenter', () =>
          addButton.attr({
            fillOpacity: opacityMap.addChildButtonHover,
            cursor: 'pointer',
          }),
        )
        addButton.on('mouseleave', () =>
          addButton.attr({
            fillOpacity: opacityMap.addChildButton,
          }),
        )
        // active
        addButton.on('mousedown', () =>
          addButton.attr({
            fillOpacity: opacityMap.addChildButtonClick,
          }),
        )
        addButton.on('mouseup', () =>
          addButton.attr({
            fillOpacity: opacityMap.addChildButton,
          }),
        )
        // click
        addButton.on('click', () => {
          addHook.trigger([area])
          addButton.attr('cursor', 'inherit')
        })
      }

      const deleteButton = group!.find(element => element.get('name') === 'delete-button')
      if (deleteButton && area) {
        // hover
        deleteButton.on('mouseenter', () =>
          deleteButton.attr({
            fillOpacity: opacityMap.deleteButtonHover,
            cursor: 'pointer',
          }),
        )
        deleteButton.on('mouseleave', () =>
          deleteButton.attr({
            fillOpacity: opacityMap.deleteButton,
          }),
        )
        // active
        deleteButton.on('mousedown', () =>
          deleteButton.attr({
            fillOpacity: opacityMap.deleteButtonClick,
          }),
        )
        deleteButton.on('mouseup', () =>
          deleteButton.attr({
            fillOpacity: opacityMap.deleteButton,
          }),
        )
        // click
        deleteButton.on('click', () => {
          deleteHook.trigger([area])
          deleteButton.attr('cursor', 'inherit')
        })
      }

      const collapseButton = group!.find(element => element.get('name') === 'collapse-button')
      if (collapseButton) {
        // hover
        collapseButton.on('mouseenter', () =>
          collapseButton.attr({
            fillOpacity: opacityMap.collapseButtonHover,
            cursor: 'pointer',
          }),
        )
        collapseButton.on('mouseleave', () =>
          collapseButton.attr({
            fillOpacity: opacityMap.collapseButton,
          }),
        )
        // active
        collapseButton.on('mousedown', () =>
          collapseButton.attr({
            fillOpacity: opacityMap.collapseButtonClick,
          }),
        )
        collapseButton.on('mouseup', () =>
          collapseButton.attr({
            fillOpacity: opacityMap.collapseButton,
          }),
        )
      }
    },
  })

  onMounted(() => {
    if (!containerRef.value || !minimapRef.value) return

    const minimap = new G6.Minimap({
      container: minimapRef.value,
      size: [160, 90],
    })

    const graph = new G6.TreeGraph({
      container: containerRef.value,
      width: width.value,
      height: height.value,
      defaultNode: {
        type: 'area-card',
        anchorPoints: [
          [0, 0.5],
          [1, 0.5],
        ],
      },
      defaultEdge: {
        type: 'cubic-horizontal',
        style: {
          stroke: 'gray',
        },
      },
      layout: {
        type: 'compactBox',
        direction: 'LR',
        getHeight: () => sharedProps.height,
        getWidth: () => sharedProps.width,
        getVGap: () => 40,
        getHGap: () => 150,
      },
      modes: {
        default: ['drag-canvas', 'zoom-canvas'],
      },
      plugins: [minimap],
    })

    graph.on('viewportchange', () => {
      const { x: gx, y: gy } = graph.getViewPortCenterPoint()
      viewState.value = {
        x: gx,
        y: gy,
        zoom: graph.getZoom(),
      }
    })

    const handler = (ev: IG6GraphEvent) => {
      const { item, shape, originalEvent } = ev
      if (!item) return

      const model = item.getModel()

      const shapeName = shape.get('name')

      switch (shapeName) {
        case 'border-box': {
          // 按住 ctrl 点击节点，切换折叠
          if (originalEvent instanceof MouseEvent && originalEvent.ctrlKey) {
            const newCollapsed = !model.collapsed
            graph.updateItem(item, { collapsed: newCollapsed })
            graph.layout()
            break
          }
          const area = model.raw as AreaVo | undefined
          if (!area) break
          editHook.trigger([area, areaMap.value.get(area.parentId!)])
          break
        }
        case 'collapse-button': {
          const newCollapsed = !model.collapsed
          graph.updateItem(item, { collapsed: newCollapsed })
          graph.layout()
          break
        }
      }
    }

    graph.on('node:click', handler)
    graph.on('node:touchend', handler)

    graphRef.value = graph
  })

  onUnmounted(() => {
    graphRef.value?.destroy()
  })

  return {
    graph: graphRef,
    reload,
    onEditClick: editHook.on,
    onAddClick: addHook.on,
    onDeleteClick: deleteHook.on,
  }
}
