import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { fetchApplication } from '../api/applications'
import { projectQueryKeys } from './querykeys'
import type { PeraApplication } from '../models/types'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'

export type UseApplicationQueryParams = {
    applicationId: string
    isEnabled?: boolean
}

export type UseApplicationQueryResult = UseQueryResult<PeraApplication | null>

export const useApplicationQuery = (
    params: UseApplicationQueryParams,
): UseApplicationQueryResult => {
    const { applicationId, isEnabled = true } = params
    const { network } = useNetwork()

    return useQuery({
        queryKey: projectQueryKeys.application(applicationId),
        queryFn: async ({ signal }) =>
            fetchApplication({
                applicationId,
                network,
                signal,
            }),
        enabled: isEnabled && !!applicationId.length,
    })
}
