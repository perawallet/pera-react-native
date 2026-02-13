import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { fetchProjectByUrl } from '../api/projects'
import { projectQueryKeys } from './querykeys'
import type { PeraProject } from '../models/types'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'

export type UseProjectByUrlQueryParams = {
    url?: string
    isEnabled?: boolean
}

export type UseProjectByUrlQueryResult = UseQueryResult<PeraProject>

export const useProjectByUrlQuery = (
    params: UseProjectByUrlQueryParams,
): UseProjectByUrlQueryResult => {
    const { url, isEnabled = true } = params
    const { network } = useNetwork()

    return useQuery({
        queryKey: projectQueryKeys.byUrl(url ?? ''),
        queryFn: async ({ signal }) => {
            const projects = await fetchProjectByUrl({
                sourceUrl: url!,
                network,
                signal,
            })
            return projects[0] ?? null
        },
        enabled: isEnabled && !!url,
    })
}
