import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { HTTPError } from 'ky'
import {
    applicationResponseSchema,
    type ApplicationApiResponse,
} from './schema'
import { transformApplication } from './transformers'
import type { PeraApplication } from '../../models/types'

export type FetchApplicationParams = {
    applicationId: string
    network: Network
    signal?: AbortSignal
}

export const fetchApplication = async (
    params: FetchApplicationParams,
): Promise<PeraApplication | null> => {
    const { applicationId, network, signal } = params

    try {
        const response = await queryClient<ApplicationApiResponse>({
            backend: 'pera',
            network,
            method: 'GET',
            url: `/v1/applications/${encodeURIComponent(String(applicationId))}/`,
            signal,
        })

        const validated = applicationResponseSchema.parse(response.data)
        return transformApplication(validated)
    } catch (error) {
        if (error instanceof HTTPError && error.response.status === 404) {
            return null
        }
        throw error
    }
}
