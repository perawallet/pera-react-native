import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { projectListResponseSchema, type ProjectApiResponse } from './schema'
import { transformProjectList } from './transformers'
import type { PeraProject } from '../../models/types'

export type FetchProjectByUrlParams = {
    sourceUrl: string
    network: Network
    signal?: AbortSignal
}

export const fetchProjectByUrl = async (
    params: FetchProjectByUrlParams,
): Promise<PeraProject[]> => {
    const { sourceUrl, network, signal } = params

    const response = await queryClient<ProjectApiResponse[]>({
        backend: 'pera',
        network,
        method: 'GET',
        url: '/v1/projects/',
        params: { url: sourceUrl },
        signal,
    })

    const validated = projectListResponseSchema.parse(response.data)
    return transformProjectList(validated)
}
