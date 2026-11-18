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

import type {
    ChainScope,
    PageRef,
} from '@perawallet/wallet-core-chain-contract'
import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import {
    createConcurrencyLimit,
    queryClient,
    type ConcurrencyLimit,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { DISCOVERY_LOOKUP_BOUNDS } from '../../accounts/discovery-bounds'
import { eip155ChainIdOf } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import {
    evmHistoryItemSchema,
    evmHistoryPageSchema,
    type EvmHistoryItem,
} from './schema'

export const HISTORY_SERVICE = 'history'
export const HISTORY_MAX_PAGE_SIZE = 50

export const historyPath = (
    eip155ChainId: number | string,
    address: string,
): string => `/api/v3/evm/${eip155ChainId}/accounts/${address}/transactions/`

export type EvmHistoryPage = {
    items: EvmHistoryItem[]
    /** Opaque cursor; a page can be empty and still carry one. */
    next: Nullable<string>
}

// One gate for every EVM chain and every paged reader: each page costs the
// backend several upstream explorer calls under one shared rate limit, so the
// All view asking every chain at once got most of its pages refused.
// Discovery's single-row lookup, `fetchHasHistory`, keeps its own cap.
const HISTORY_PAGES_IN_FLIGHT = 2
let historyPageGate: Optional<ConcurrencyLimit>

// Built on first use, so importing the module runs nothing.
const gatedHistoryPage: ConcurrencyLimit = (task, options) => {
    historyPageGate ??= createConcurrencyLimit(HISTORY_PAGES_IN_FLIGHT)
    return historyPageGate(task, options)
}

export type HistoryPageReadOptions = {
    /** CAIP-19, native or ERC-20 only. The backend binds the cursor to it, so every page must send it. */
    caip19AssetId?: string
    signal?: AbortSignal
    /** No one waits on it, as with a token scan, so it queues behind every other read. */
    isBackground?: boolean
}

/**
 * Newest first; rows this client can't read are dropped. Rejects with
 * `UnknownEvmNetworkError` for a scope that isn't the chain's, and with
 * `PeraNetworkError` or `PeraServiceUnavailableError` from `queryClient`.
 */
export const fetchHistoryPage = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
    page?: PageRef,
    {
        caip19AssetId,
        signal,
        isBackground = false,
    }: HistoryPageReadOptions = {},
): Promise<EvmHistoryPage> => {
    signal?.throwIfAborted()
    const { data } = await gatedHistoryPage(
        async () => {
            // A read can become obsolete while another chain owns the shared slots.
            signal?.throwIfAborted()
            const headers = await buildIntegrityHeadersWhenReady()
            signal?.throwIfAborted()
            return queryClient<unknown>({
                backend: 'pera',
                service: HISTORY_SERVICE,
                scope,
                method: 'GET',
                url: historyPath(
                    eip155ChainIdOf(scope, chain),
                    address.toLowerCase(),
                ),
                params: {
                    ...(page && { cursor: page.cursor }),
                    ...(page?.limit !== undefined && {
                        limit: Math.min(
                            Math.max(page.limit, 1),
                            HISTORY_MAX_PAGE_SIZE,
                        ),
                    }),
                    ...(caip19AssetId !== undefined && {
                        asset_id: caip19AssetId,
                    }),
                },
                headers,
                signal,
            })
        },
        { isPriority: !isBackground },
    )
    const { next, results } = evmHistoryPageSchema.parse(data)
    return {
        items: results.flatMap(row => {
            const parsed = evmHistoryItemSchema.safeParse(row)
            return parsed.success ? parsed.data : []
        }),
        next,
    }
}

/**
 * Whether the backend lists any row for `address`: one GET for the newest row,
 * never a cursor. Raw rows count, since one this client predates still proves
 * history, and a cursor means older rows exist behind an empty page. Rejects
 * the way `fetchHistoryPage` does.
 */
export const fetchHasHistory = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
    signal?: AbortSignal,
): Promise<boolean> => {
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: HISTORY_SERVICE,
        scope,
        method: 'GET',
        url: historyPath(eip155ChainIdOf(scope, chain), address.toLowerCase()),
        params: { limit: 1 },
        headers: await buildIntegrityHeadersWhenReady(),
        signal,
        ...DISCOVERY_LOOKUP_BOUNDS,
    })
    const { next, results } = evmHistoryPageSchema.parse(data)
    return results.length > 0 || next !== null
}
