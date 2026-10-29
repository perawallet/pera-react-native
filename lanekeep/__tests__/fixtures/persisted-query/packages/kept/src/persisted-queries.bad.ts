import { skipToken, useQuery } from '@tanstack/react-query'
import {
    MODULE_PREFIX,
    getAliasQueryKey,
    getDatedQueryKey,
    getSecretCatalogQueryKey,
    keptQueryKeys,
} from './persisted-keys'
import type {
    Dated,
    Outer,
    Stamped,
    WithDate,
    WithReadonlySet,
    WithSet,
} from './persisted-models'

export const useBuilderKey = (id: string) =>
    useQuery({
        queryKey: getDatedQueryKey(id),
        queryFn: (): Promise<WithDate> => fetchThing(id),
    })

export const useFactoryKey = (id: string) =>
    useQuery({
        queryKey: keptQueryKeys.outer(id),
        queryFn: (): Promise<Outer> => fetchThing(id),
    })

export const useSetPayload = (id: string) =>
    useQuery({
        queryKey: keptQueryKeys.set(id),
        queryFn: (): Promise<WithSet> => fetchThing(id),
    })

export const useReadonlySetPayload = () =>
    useQuery({
        queryKey: ['kept', 'readonly-set'],
        queryFn: (): Promise<WithReadonlySet> => fetchThing('x'),
    })

export const useZodDate = () =>
    useQuery({
        queryKey: ['kept', 'dated-schema'],
        queryFn: (): Promise<Dated> => fetchThing('x'),
    })

export const useZodTransform = () =>
    useQuery({
        queryKey: ['kept', 'stamped-schema'],
        queryFn: (): Promise<Stamped> => fetchThing('x'),
    })

export const useUnannotated = () =>
    useQuery({
        queryKey: ['kept', 'unannotated'],
        queryFn: () => fetchThing('x'),
    })

export const useOpaque = () =>
    useQuery({
        queryKey: ['kept', 'opaque'],
        queryFn: (): Promise<unknown> => fetchThing('x'),
    })

export const useInlineKey = () =>
    useQuery({
        queryKey: ['kept', 'inline'],
        queryFn: (): Promise<Date[]> => fetchThing('x'),
    })

export const useAliasKey = (id: string) =>
    useQuery({
        queryKey: getAliasQueryKey(id),
        queryFn: (): Promise<WithDate> => fetchThing(id),
    })

export const useShorthandKey = (id: string) => {
    const queryKey = getDatedQueryKey(id)
    return useQuery({
        queryKey,
        queryFn: (): Promise<WithDate> => fetchThing(id),
    })
}

export const useSubKeyUnderNeverModule = () =>
    useQuery({
        queryKey: getSecretCatalogQueryKey(),
        queryFn: (): Promise<WithDate> => fetchThing('x'),
    })

export const useSkipTokenArm = (enabled: boolean) =>
    useQuery({
        queryKey: ['kept', 'gated'],
        queryFn: enabled ? (): Promise<WithDate> => fetchThing('x') : skipToken,
    })

export const useImportedPrefix = () =>
    useQuery({
        queryKey: [MODULE_PREFIX, 'imported'],
        queryFn: (): Promise<WithDate> => fetchThing('x'),
    })
