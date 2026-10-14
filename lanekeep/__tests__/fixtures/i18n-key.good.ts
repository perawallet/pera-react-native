declare const i18nKey: (key: string) => string
declare const notI18nKey: (key: string) => string
declare const dynamic: string

export const leaf = i18nKey('common.back_online')
export const pluralBase = i18nKey('messages.inbox.asa_requests')
export const plainTemplate = i18nKey(`common.back_online`)
export const otherCall = notI18nKey(dynamic)
