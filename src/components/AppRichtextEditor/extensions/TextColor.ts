import { Extension } from '@tiptap/core'

export interface ColorOptions {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    color: {
      setColor: (color: string) => ReturnType
      unsetColor: () => ReturnType
    }
  }
}

export const TextColor = Extension.create<ColorOptions>({
  name: 'textColor',
  addOptions() {
    return {
      types: ['color'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: element => {
              return element.style.getPropertyValue('--color')
            },
            renderHTML: attributes => {
              return !attributes.color
                ? {}
                : {
                    style: `--color: ${attributes.color}`,
                  }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setColor:
        color =>
        ({ chain }) => {
          return chain().setMark('color', { color }).run()
        },
      unsetColor:
        () =>
        ({ chain }) => {
          return chain().setMark('color', { color: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
