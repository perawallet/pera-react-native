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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { EvmChain } from '../../chains/types'
import { fetchWhitelist } from './endpoints'
import type { WhitelistRow } from './transformers'

/** The backend's listed tokens for a scope, native first. */
export type ListedTokens = (scope: ChainScope) => Promise<WhitelistRow[]>

// The backend caches the whitelist for the same window, so a fresher read
// would see the same list.
const WHITELIST_TTL_MS = 60_000

type WhitelistEntry = { rows: Promise<WhitelistRow[]>; fetchedAt?: number }

/**
 * Concurrent reads of a scope share one request; a success is reused for the
 * TTL, a failure is not kept. `now` is the clock the cache ages by.
 */
export const cachedWhitelist = (
    chain: EvmChain,
    now: () => number = Date.now,
): ListedTokens => {
    const entries = new Map<string, WhitelistEntry>()
    return scope => {
        const key = `${scope.chainId}/${scope.networkId}`
        const cached = entries.get(key)
        if (
            cached &&
            (cached.fetchedAt === undefined ||
                now() - cached.fetchedAt < WHITELIST_TTL_MS)
        ) {
            return cached.rows
        }
        const entry: WhitelistEntry = { rows: fetchWhitelist(scope, chain) }
        entries.set(key, entry)
        entry.rows.then(
            () => {
                entry.fetchedAt = now()
            },
            () => {
                if (entries.get(key) === entry) entries.delete(key)
            },
        )
        return entry.rows
    }
}
