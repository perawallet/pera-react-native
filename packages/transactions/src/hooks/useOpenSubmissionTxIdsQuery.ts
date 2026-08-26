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
import type { Network } from '@perawallet/wallet-core-shared'
import { getOpenSubmissionAttempts } from '@perawallet/wallet-core-signing'
import { transactionQueryKeys } from './querykeys'

/** Shared empty result: every transaction row subscribes to this hook. */
const EMPTY_TX_IDS: ReadonlySet<string> = new Set()

export type UseOpenSubmissionTxIdsQueryResult = {
    /** Txids with an open ledger row, empty until the query settles. */
    openTxIds: ReadonlySet<string>
}

/**
 * Txids that were submitted but not yet definitively resolved — the "pending
 * — verifying" badge set (PERA-4588). Invalidated by the sync service when
 * the reconciler settles a row, so a resolved attempt's badge disappears
 * without a manual refresh.
 */
export const useOpenSubmissionTxIdsQuery = ({
    network,
}: {
    network: Network
}): UseOpenSubmissionTxIdsQueryResult => {
    const query = useQuery({
        queryKey: transactionQueryKeys.openSubmissionTxIds(network),
        queryFn: async () => {
            const attempts = await getOpenSubmissionAttempts({ network })
            return new Set(attempts.flatMap(attempt => attempt.txIds))
        },
        staleTime: 30_000,
        // Pure SQLite read — must resolve while offline so the pending
        // badge still renders on a cold offline relaunch.
        networkMode: 'always',
    })

    return { openTxIds: query.data ?? EMPTY_TX_IDS }
}
