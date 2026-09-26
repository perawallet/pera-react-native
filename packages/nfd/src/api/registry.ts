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

import { z } from 'zod'
import { logger, type Network } from '@perawallet/wallet-core-shared'
import { NFD_REGISTRY_URLS } from '../constants'

const nfdRegistryRecordSchema = z.object({
    appID: z.number().int().positive(),
})

export type FetchNfdAppIdParams = {
    name: string
    network: Network
    signal?: AbortSignal
}

/**
 * Asks the registry only which application holds `name`; everything a verdict
 * rests on is then read from that application on chain. `null` when the
 * registry knows no such name.
 */
export const fetchNfdAppId = async ({
    name,
    network,
    signal,
}: FetchNfdAppIdParams): Promise<number | null> => {
    const baseUrl = NFD_REGISTRY_URLS[network]
    if (!baseUrl) {
        throw new Error(`NFD registry not configured for ${network}`)
    }

    const response = await fetch(
        `${baseUrl}/nfd/${encodeURIComponent(name)}?view=brief`,
        { signal },
    )
    // 404 is a well-formed name nobody holds; 400 is one the registry will
    // not even parse (too long, malformed). Neither maps to an application.
    if (response.status === 404 || response.status === 400) return null
    if (!response.ok) {
        throw new Error(`NFD registry responded ${response.status}`)
    }

    const result = nfdRegistryRecordSchema.safeParse(await response.json())
    if (!result.success) {
        logger.warn('NFD registry record failed schema validation', {
            error: result.error,
        })
        throw new Error('NFD registry record failed schema validation')
    }
    return result.data.appID
}
