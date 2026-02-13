/*
 Copyright 2022-2025 Pera Wallet, LDA
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
