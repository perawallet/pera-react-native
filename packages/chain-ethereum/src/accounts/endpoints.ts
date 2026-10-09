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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { queryClient } from '@perawallet/wallet-core-shared'

export const BLOCK_FOLLOWING_SERVICE = 'blockFollowing'

// Provisional: the backend has no agreed Ethereum spec yet. The shape mirrors
// Algorand's /v1/accounts/should-refresh/ with blocks in place of rounds.
export const SHOULD_REFRESH_PATH = '/v1/ethereum/accounts/should-refresh/'

export const shouldRefreshResponseSchema = z.object({
    refresh: z.boolean(),
    block: z.number().int().nonnegative(),
})

export type ShouldRefreshResponse = z.infer<typeof shouldRefreshResponseSchema>

/** `lastBlock` is null when the scope has never synced. Rejects with a `PeraNetworkError` on a failed request. */
export const fetchShouldRefresh = async (
    scope: ChainScope,
    addresses: string[],
    lastBlock: number | null,
): Promise<ShouldRefreshResponse> => {
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: BLOCK_FOLLOWING_SERVICE,
        scope,
        method: 'POST',
        url: SHOULD_REFRESH_PATH,
        data: {
            account_addresses: addresses,
            last_refreshed_block: lastBlock,
        },
    })
    return shouldRefreshResponseSchema.parse(data)
}
