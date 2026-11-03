import type { JSONSchema7 } from 'json-schema'
import { Ajv } from 'ajv'

const DADIAN_SCHEMA: JSONSchema7 = {
  type: 'object',
  $defs: {
    extraConfig: {
      type: 'object',
      description: 'extra 插件具体配置',
      properties: {
        '1_6_island': {
          type: 'object',
          description: '1.6 版本海岛',
          required: ['stages'],
          properties: {
            stages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['label', 'value'],
                properties: {
                  label: { type: 'string', description: '阶段选项的标签' },
                  value: { type: 'string', description: '阶段选项的值' },
                },
              },
            },
          },
        },
        '2_8_island': {
          type: 'object',
          description: '2.8 版本海岛',
          required: ['stages'],
          properties: {
            stages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['label', 'value'],
                properties: {
                  label: { type: 'string', description: '海岛的名称' },
                  value: { type: 'string', description: '海岛名称标记值' },
                  children: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['label', 'value'],
                      properties: {
                        label: { type: 'string', description: '海岛形态名' },
                        value: { type: 'string', description: '海岛形态标记值' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        underground: {
          type: 'object',
          properties: {
            textActive: { type: 'string', description: '开启附加图层选项时的提示文本' },
            textInactive: { type: 'string', description: '关闭附加图层选项时的提示文本' },
            useDetail: { type: 'boolean', description: '是否使用详细的层级信息' },
            levels: {
              type: 'array',
              description: '层级选项',
              items: {
                type: 'object',
                required: ['label', 'value', 'children'],
                properties: {
                  label: { type: 'string', description: '层级分组' },
                  value: { type: 'string', description: '层级分组标记' },
                  children: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['label', 'value'],
                      properties: {
                        label: { type: 'string', description: '层级名称' },
                        value: { type: 'string', description: '层级标记' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    overlayChunkOption: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        value: { type: 'string' },
        url: { type: 'string' },
        bounds: {
          type: 'array',
          description: '坐标',
          minItems: 2,
          maxItems: 2,
          items: [
            {
              type: 'array',
              description: '最小坐标点',
              minItems: 2,
              maxItems: 2,
              items: { type: 'number' },
            },
            {
              type: 'array',
              description: '最大坐标点',
              minItems: 2,
              maxItems: 2,
              items: { type: 'number' },
            },
          ],
        },
      },
    },
    overlayOption: {
      type: 'object',
      allOf: [
        { $ref: '#/$defs/overlayChunkOption' },
        {
          properties: {
            urlTemplate: { type: 'string', description: '图片地址生成模板' },
            chunks: {
              type: 'array',
              description: '叠层项分片，通常用于一个叠层图由多张图片构成的情况，可选',
              items: { $ref: '#/$defs/overlayChunkOption' },
            },
          },
        },
      ],
    },
    overlayGroupOption: {
      type: 'object',
      description: '叠层分组',
      allOf: [
        {
          $ref: '#/$defs/overlayOption',
          properties: {
            chunks: false,
          },
        },
        {
          properties: {
            multiple: { type: 'boolean', description: '该分组内叠层是否可以同时开启' },
            children: {
              type: 'array',
              description: '叠层项',
              items: { $ref: '#/$defs/overlayOption' },
            },
            role: {
              type: 'string',
              enum: ['default', 'tile'],
            },
          },
        },
      ],
    },
    overlayConfig: {
      type: 'object',
      description: '叠层具体配置',
      properties: {
        panelIcon: {
          type: 'string',
          description: '面板折叠后小图标的图标类（仅 Quasar 图标库，暂不通用）',
        },
        panelIconColor: { type: 'string', description: '面板折叠后小图标的颜色' },
        overlayMask: { type: 'boolean', description: '是否启用暗色遮盖' },
        overlayMaskOnSelected: {
          type: 'boolean',
          description: '是否在有分层层级选中时才进行暗色覆盖',
        },
        overlayMaskOpacity: { type: 'number', description: '在暗色遮盖时遮盖部分的透明度' },
        urlTemplate: { type: 'string', description: '图片地址生成模板' },
        idTemplate: { type: 'string', description: '生成元素 ID 的模板' },
        multiple: { type: 'boolean', description: '同一组内叠层是否可以同时开启' },
        overlays: {
          type: 'array',
          description: '叠层分组',
          items: { $ref: '#/$defs/overlayGroupOption' },
        },
      },
    },
    pluginConfig: {
      type: 'object',
      properties: {
        extra: {
          type: 'array',
          description: '开启的 extra 插件',
          items: { type: 'string' },
        },
        extraConfig: { $ref: '#/$defs/extraConfig' },
        overlay: { type: 'boolean', description: '是否启用叠层' },
        overlayConfig: { $ref: '#/$defs/overlayConfig' },
      },
    },
    coordinate2D: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: { type: 'number' },
    },
    tileConfig: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '区域代码，用于拼接图片 URL' },
        name: { type: 'string', description: '底图名字，用于地区切换' },
        extend: {
          type: 'string',
          description: '继承其他配置，将当前配置与此值表示的配置项合并后的配置作为此项的配置项',
        },
        center: {
          $ref: '#/$defs/coordinate2D',
          description: '坐标系原点所在位置（相对于 tile 定位坐标本身）',
        },
        extension: { type: 'string', description: '文件扩展名' },
        size: { $ref: '#/$defs/coordinate2D', description: '地图图片的总宽高（像素）' },
        settings: {
          type: 'object',
          description:
            'Leaflet.js <Map options> 的配置在新后台中用作初始化视口配置，在新后台中用作初始化视口配置。',
          properties: {
            center: { $ref: '#/$defs/coordinate2D' },
            zoom: { type: 'number' },
          },
        },
        tilesOffset: { $ref: '#/$defs/coordinate2D', description: '瓦片偏移量（像素）' },
      },
    },
  },
  properties: {
    application: {
      type: 'object',
      description: '应用配置',
      properties: {
        avatar: {
          type: 'array',
          description: '头像列表',
          items: {
            type: 'object',
            description: '头像对象',
            properties: {
              label: { type: 'string', description: '头像名称' },
              url: { type: 'string', description: '头像地址' },
            },
          },
        },
        nameCard: {
          type: 'array',
          description: '名片列表',
          items: {
            type: 'object',
            description: '名片对象',
            properties: {
              bg: { type: 'string', description: '名片大图地址' },
              desc: { type: 'string', description: '名片描述' },
              icon: { type: 'string', description: '名片图标地址' },
              label: { type: 'string', description: '名片名称' },
              strip: { type: 'string', description: '列表条带背景地址' },
            },
          },
        },
      },
    },
    editor: {
      type: 'object',
      description: '编辑器配置',
      properties: {
        bannerText: { type: 'string', description: '用于控制显示的通告内容' },
        quickInputSnippets: {
          type: 'array',
          description: '用于控制快捷输入中可选的字符',
          items: { type: 'string', description: '快捷输入字符' },
        },
        refreshTimeSpecial: {
          type: 'array',
          description: '用于提供特殊刷新时间的数据对应',
          items: {
            type: 'object',
            description: '特殊刷新时间对象',
            properties: {
              label: { type: 'string', description: '刷新时间的名称' },
              value: { type: 'number', description: '刷新时间的时间戳' },
            },
            required: ['label', 'value'],
          },
        },
        fontResources: {
          type: 'object',
          description: '字体资源',
          additionalProperties: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '字体地址' },
              type: { type: 'string', description: '字体文件类型' },
            },
            required: ['url', 'type'],
          },
        },
      },
    },
    plugins: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/pluginConfig' },
    },
    pluginsBeta: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/pluginConfig' },
    },
    tiles: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/tileConfig' },
    },
    tilesBeta: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/tileConfig' },
    },
  },
}

export const validateDadianJSON = (obj: unknown) => {
  const ajv = new Ajv()

  const validate = ajv.compile(DADIAN_SCHEMA)

  const valid = validate(obj)

  return { valid, errors: validate.errors }
}
