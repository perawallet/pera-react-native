declare const i18nKey: (key: string) => string
declare const dynamic: string
declare const code: string

export const missing = i18nKey('this.key.does.not.exist')
export const object = i18nKey('common')
export const variable = i18nKey(dynamic)
export const template = i18nKey(`errors.${code}.title`)
export const concatenated = i18nKey('common.' + dynamic)
export const empty = i18nKey()
