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
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import { fetchAndPersistNfds } from '../sync/nfd-syncer'
import { getNfdsByAddresses } from '../db'
import {
    NFD_BATCH_DEBOUNCE_MS,
    NFD_BATCH_MAX_SIZE,
    NFD_BATCH_MAX_WAIT_MS,
} from '../constants'
import type { NfdName } from '../models'

/**
 * On-demand NFD batch queue. Used by `useNfdForAddressQuery` to coalesce
 * address lookups into a single bulk-read HTTP call.
 *
 * Debounced rather than a fixed window: a list being scrolled mounts rows
 * continuously, and a fixed window dispatches once per window for as long as
 * that lasts. Deferring until the scroll settles collapses it to one request.
 * Names are decorative, so the added latency costs nothing a user would call
 * broken — a row renders its truncated address until its name arrives.
 */
export const nfdBatchQueue = new BatchQueue<string, Nullable<NfdName>, Network>(
    async (addresses, network) => {
        await fetchAndPersistNfds(addresses, network)

        const rows = await getNfdsByAddresses({ addresses, network })
        const map = new Map<string, Nullable<NfdName>>()
        for (const row of rows) {
            map.set(row.address, row.name)
        }
        return map
    },
    {
        delayMs: NFD_BATCH_DEBOUNCE_MS,
        debounce: true,
        maxBatchSize: NFD_BATCH_MAX_SIZE,
        maxWaitMs: NFD_BATCH_MAX_WAIT_MS,
    },
)
