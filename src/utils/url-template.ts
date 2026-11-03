export class UrlTemplate {
  #template: string
  #variables: Record<string, string | null> = {}

  constructor(template: string) {
    this.#template = template
  }

  /** 设置为 null 时，清空对应的变量 */
  compile(variables: Record<string, string | null>) {
    this.#variables = {
      ...this.#variables,
      ...variables,
    }
    return this
  }

  toString() {
    return this.#template.replace(/\{\{([\s\S]+?)\}\}/g, (match, key) => {
      const value = this.#variables[key]
      if (value === undefined || value === null) return match
      return value
    })
  }
}
