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

import {
    queryClient,
    logger,
    isNotFoundError,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { ZodError } from 'zod'
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
): Promise<Nullable<PeraApplication>> => {
    const { applicationId, network, signal } = params

    // No Pera backend on betanet/custom: fall back to null, so the
    // application display falls back to showing the raw app ID.
    if (!isPeraBackedNetwork(network)) return null

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
        if (isNotFoundError(error)) {
            return null
        }
        if (error instanceof ZodError) {
            logger.warn('Application response validation failed', {
                applicationId,
                issues: error.issues,
            })
            return null
        }
        throw error
    }
}
