import { skipToken, useQuery } from '@tanstack/react-query'
import {
    getElsewhereQueryKey,
    getSecretHistoryQueryKey,
} from './persisted-keys'
import type {
    Checked,
    Consumed,
    Item,
    RawWithIso,
    Tagged,
    WithDate,
    WithFormatter,
} from './persisted-models'

export const useTagged = () =>
    useQuery({
        queryKey: ['kept', 'tagged'],
        queryFn: (): Promise<Tagged> => fetchThing('x'),
    })

export const useConsumedInTransform = () =>
    useQuery({
        queryKey: ['kept', 'consumed'],
        queryFn: (): Promise<Consumed> => fetchThing('x'),
    })

export const useRawIsoBuiltInSelect = () =>
    useQuery({
        queryKey: ['kept', 'raw'],
        queryFn: (): Promise<RawWithIso> => fetchThing('x'),
        select: raw => ({ createdAt: new Date(raw.createdAt) }),
    })

export const useNeverSibling = () =>
    useQuery({
        queryKey: getSecretHistoryQueryKey(),
        queryFn: (): Promise<WithDate> => fetchThing('x'),
    })

export const useUnlistedPrefix = () =>
    useQuery({
        queryKey: getElsewhereQueryKey(),
        queryFn: (): Promise<WithDate> => fetchThing('x'),
    })

export const useUnannotatedNeverKey = () =>
    useQuery({
        queryKey: ['secret', 'history', 'raw'],
        queryFn: () => fetchThing('x'),
    })

export const useFunctionField = () =>
    useQuery({
        queryKey: ['kept', 'formatter'],
        queryFn: (): Promise<WithFormatter> => fetchThing('x'),
    })

export const useSkipToken = () =>
    useQuery({
        queryKey: ['kept', 'skipped'],
        queryFn: skipToken,
    })

export const useRefineOnly = () =>
    useQuery({
        queryKey: ['kept', 'checked'],
        queryFn: (): Promise<Checked> => fetchThing('x'),
    })

export const useSamePackageItem = () =>
    useQuery({
        queryKey: ['kept', 'item'],
        queryFn: (): Promise<Item> => fetchThing('x'),
    })
