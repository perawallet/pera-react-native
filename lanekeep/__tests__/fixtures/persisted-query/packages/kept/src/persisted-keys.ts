export const MODULE_PREFIX = 'kept'

export const getDatedQueryKey = (id: string) =>
    [MODULE_PREFIX, 'dated', { id }] as const

export const keptQueryKeys = {
    outer: (id: string) => [MODULE_PREFIX, 'outer', { id }] as const,
    set: (id: string) => [MODULE_PREFIX, 'set', { id }] as const,
}

export const getAliasQueryKey = keptQueryKeys.outer

export const getSecretCatalogQueryKey = () => ['secret', 'catalog'] as const

export const getSecretHistoryQueryKey = () => ['secret', 'history'] as const

export const getElsewhereQueryKey = () => ['elsewhere'] as const
