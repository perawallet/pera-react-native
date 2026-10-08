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
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'

export const BLOCK_FOLLOWING_SERVICE = 'blockFollowing'

// Provisional: the backend has no agreed Ethereum spec yet. The shape mirrors
// Algorand's /v1/accounts/should-refresh/ with blocks in place of rounds.
export const SHOULD_REFRESH_PATH = '/v1/ethereum/accounts/should-refresh/'

export const shouldRefreshResponseSchema = z.object({
    refresh: z.boolean(),
    block: z.number().int().nonnegative(),
})

export type ShouldRefreshResponse = z.infer<typeof shouldRefreshResponseSchema>

export class BlockFollowingRequestError extends Error {
    readonly scope: ChainScope
    readonly status: number

    constructor(scope: ChainScope, status: number) {
        super(
            `Block following for ${scope.chainId}/${scope.networkId} answered ${status}`,
        )
        this.name = 'BlockFollowingRequestError'
        this.scope = scope
        this.status = status
    }
}

/** `lastBlock` is null when the scope has never synced. */
export const fetchShouldRefresh = async (
    ctx: Pick<ChainContext, 'http'>,
    baseUrl: string,
    scope: ChainScope,
    addresses: string[],
    lastBlock: number | null,
): Promise<ShouldRefreshResponse> => {
    const response = await ctx.http.request({
        url: `${baseUrl.replace(/\/+$/, '')}${SHOULD_REFRESH_PATH}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            account_addresses: addresses,
            last_refreshed_block: lastBlock,
        }),
    })
    if (response.status < 200 || response.status >= 300) {
        throw new BlockFollowingRequestError(scope, response.status)
    }
    return shouldRefreshResponseSchema.parse(JSON.parse(response.body))
}
