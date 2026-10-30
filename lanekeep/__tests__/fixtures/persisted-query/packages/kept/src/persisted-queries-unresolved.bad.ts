import { useQuery } from '@tanstack/react-query'
import { KEPT_ROOT, MODULE_PREFIX, getDatedQueryKey } from './persisted-keys'
import type * as models from './persisted-models'
import type { WithDate } from './persisted-models'

export const useTernaryKey = (id?: string) =>
    useQuery({
        queryKey: id ? getDatedQueryKey(id) : [MODULE_PREFIX, 'fallback'],
        queryFn: (): Promise<WithDate> => fetchThing('x'),
    })

export const useSpreadKey = () =>
    useQuery({
        queryKey: [...KEPT_ROOT, 'spread'],
        queryFn: (): Promise<WithDate> => fetchThing('x'),
    })

export const useOpaqueArray = () =>
    useQuery({
        queryKey: ['kept', 'opaque-array'],
        queryFn: (): Promise<unknown[]> => fetchThing('x'),
    })

export const useQualifiedType = () =>
    useQuery({
        queryKey: ['kept', 'qualified'],
        queryFn: (): Promise<models.WithDate> => fetchThing('x'),
    })
