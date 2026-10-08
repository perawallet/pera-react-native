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
import { partition, queryClient } from '@perawallet/wallet-core-shared'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'

export const BLOCK_FOLLOWING_SERVICE = 'blockFollowing'

export const SHOULD_REFRESH_PATH = '/api/v4/accounts/should-refresh/'

// The backend rejects a request with more EVM addresses than this (422).
const SHOULD_REFRESH_MAX_ADDRESSES = 1000

/** `round` is the chain tip's block number; it is omitted when `refresh` is false. */
const shouldRefreshResponseSchema = z.union([
    z.object({
        refresh: z.literal(true),
        round: z.number().int().nonnegative().optional(),
    }),
    z.object({ refresh: z.literal(false) }),
])

export type ShouldRefreshResponse = z.infer<typeof shouldRefreshResponseSchema>

const requestShouldRefresh = async (
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
            chain: `eip155:${eip155ChainIdOf(scope)}`,
            account_addresses: addresses,
            last_refreshed_round: lastBlock,
        },
    })
    return shouldRefreshResponseSchema.parse(data)
}

/**
 * `lastBlock` is null when the scope has never synced. Address lists past the
 * backend limit go out in chunks: any refresh wins, with the highest tip. No
 * addresses make no request (the backend rejects an empty list) and no refresh.
 * Rejects with a `PeraNetworkError` on a failed request.
 */
export const fetchShouldRefresh = async (
    scope: ChainScope,
    addresses: string[],
    lastBlock: number | null,
): Promise<ShouldRefreshResponse> => {
    const answers = await Promise.all(
        partition(addresses, SHOULD_REFRESH_MAX_ADDRESSES).map(part =>
            requestShouldRefresh(scope, part, lastBlock),
        ),
    )
    if (!answers.some(answer => answer.refresh)) return { refresh: false }
    const rounds = answers.flatMap(answer =>
        answer.refresh && answer.round !== undefined ? [answer.round] : [],
    )
    return rounds.length > 0
        ? { refresh: true, round: Math.max(...rounds) }
        : { refresh: true }
}
