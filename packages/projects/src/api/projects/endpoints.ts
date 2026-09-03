/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
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

    // No Pera backend on betanet/custom: fall back to no projects, so the
    // trust badge simply renders nothing instead of throwing.
    if (!isPeraBackedNetwork(network)) return []

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
