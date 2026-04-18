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

import { BatchQueue } from '@perawallet/wallet-core-background/queue'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import { fetchAndPersistNfds } from '../sync/nfd-syncer'
import { getNfdsByAddresses } from '../db'
import type { NfdName } from '../models'

const NFD_BATCH_DELAY_MS = 100

/**
 * On-demand NFD batch queue. Used by `useNfdForAddressQuery` to coalesce
 * concurrent address lookups (e.g. a transaction list mounting 20 rows
 * over a few render commits) into a single bulk-read HTTP call.
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
    NFD_BATCH_DELAY_MS,
)
