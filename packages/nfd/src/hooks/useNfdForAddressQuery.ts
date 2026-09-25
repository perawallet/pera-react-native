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

import { useQuery } from '@tanstack/react-query'
import {
    useNetwork,
    isValidAlgorandAddress,
} from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import { nfdBatchQueue } from '../services/nfdBatchQueue'
import { nfdQueryKeys } from './querykeys'
import type { NfdName } from '../models'

/**
 * The batch queue coalesces enqueues that land in the same microtask.
 * Putting an `await` (e.g. an SQLite cache check) BEFORE `enqueue` would
 * yield to the event loop, which causes the microtask flush to fire between
 * each row's enqueue → each address ends up in its own bulk request →
 * the whole batching benefit disappears.
 *
 * The cache check is intentionally pushed down into the executor itself
 * (`fetchAndPersistNfds` calls `getStaleOrMissingAddresses` against SQL),
 * so cached/fresh addresses are skipped at the bulk-fetch step. Cached
 * results still flow back through the executor's `getNfdsByAddresses`
 * re-read, so the hook gets the right value either way.
 */
export type UseNfdForAddressQueryResult = {
    data: NfdName[]
    isPending: boolean
}

// One stable empty array, so memos that depend on `data` don't re-run every render.
const NO_RESULTS: NfdName[] = []

export const useNfdForAddressQuery = (
    address: string,
    options?: { enabled?: boolean },
): UseNfdForAddressQueryResult => {
    const { network } = useNetwork()
    const enabled =
        (options?.enabled ?? true) && isValidAlgorandAddress(address)

    const query = useQuery({
        queryKey: nfdQueryKeys.forAddress(address, network),
        queryFn: () => {
            const valuePromise = nfdBatchQueue.enqueue(address, network)
            return valuePromise.then(value => (value ? [value] : []))
        },
        enabled,
        staleTime: config.reactQueryLongLivedStaleTime,
        gcTime: config.reactQueryLongLivedGCTime,
    })

    return {
        data: query.data ?? NO_RESULTS,
        isPending: query.isPending,
    }
}
