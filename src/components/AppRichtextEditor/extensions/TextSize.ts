import { Extension } from '@tiptap/core'

export interface SizeOptions {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    size: {
      setSize: (size: number) => ReturnType
      unsetSize: () => ReturnType
    }
  }
}

export const TextSize = Extension.create<SizeOptions>({
  name: 'textSize',
  addOptions() {
    return {
      types: ['size'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          size: {
            default: null,
            parseHTML: element => {
              return element.style.getPropertyValue('--size')
            },
            renderHTML: attributes => {
              return !attributes.size
                ? {}
                : {
                    style: `--size: ${attributes.size}`,
                  }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setSize:
        size =>
        ({ chain }) => {
          return chain().setMark('size', { size }).run()
        },
      unsetSize:
        () =>
        ({ chain }) => {
          return chain().setMark('size', { size: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
