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

import { BatchQueue } from '@perawallet/wallet-core-shared/queue'
import {
    parseScopeKey,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchAndPersistNames } from '../sync/name-syncer'
import { getNamesByAddresses } from '../db'
import {
    NAME_BATCH_DEBOUNCE_MS,
    NAME_BATCH_MAX_SIZE,
    NAME_BATCH_MAX_WAIT_MS,
} from '../constants'
import type { AddressName } from '../models'

/**
 * On-demand name lookup batch queue. Used by `useNameForAddressQuery` to coalesce
 * address lookups into a single bulk names HTTP call.
 *
 * Debounced rather than a fixed window: a list being scrolled mounts rows
 * continuously, and a fixed window dispatches once per window for as long as
 * that lasts. Deferring until the scroll settles collapses it to one request.
 * Names are decorative, so the added latency costs nothing a user would call
 * broken — a row renders its truncated address until its name arrives.
 */
// Partitioned by the scope key, not the scope: BatchQueue groups by Map identity,
// so equal-but-distinct scope objects would never share a batch.
export const nameBatchQueue = new BatchQueue<
    string,
    Nullable<AddressName>,
    ChainScopeKey
>(
    async (addresses, scopeKey) => {
        const scope = parseScopeKey(scopeKey)
        await fetchAndPersistNames(addresses, scope)

        const rows = await getNamesByAddresses({ addresses, scope })
        const map = new Map<string, Nullable<AddressName>>()
        for (const row of rows) {
            map.set(row.address, row.name)
        }
        return map
    },
    {
        delayMs: NAME_BATCH_DEBOUNCE_MS,
        debounce: true,
        maxBatchSize: NAME_BATCH_MAX_SIZE,
        maxWaitMs: NAME_BATCH_MAX_WAIT_MS,
    },
)
