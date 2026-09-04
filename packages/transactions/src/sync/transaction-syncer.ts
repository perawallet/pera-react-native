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

import type { Network, Optional } from '@perawallet/wallet-core-shared'
import { fetchTransactionHistory } from '../api/history'
import { getLatestTransactionRoundTime, upsertTransactions } from '../db'
import { backfillMissingCloseAmounts } from './close-amount-backfill'
import { backfillSwapAssetFacts } from './swap-asset-facts-backfill'

export async function fetchAndPersistTransactions(
    address: string,
    network: Network,
): Promise<void> {
    const latestRoundTime = await getLatestTransactionRoundTime({
        accountAddress: address,
        network,
    })

    let afterTime: Optional<string>
    if (latestRoundTime !== null) {
        // Fetch only transactions newer than what we have
        // Add 1 second to avoid re-fetching the latest transaction
        afterTime = new Date((latestRoundTime + 1) * 1000)
            .toISOString()
            .split('T')[0]
    }

    const result = await fetchTransactionHistory({
        accountAddress: address,
        network,
        afterTime,
    })

    if (result.transactions.length > 0) {
        await upsertTransactions({
            items: result.transactions,
            accountAddress: address,
            network,
        })
    }

    // Heal close rows whose swept amount the backend/derivation couldn't
    // provide (rows cached before the close_amount column, receiver-only
    // perspectives). Best-effort and bounded; never fails the sync.
    await backfillMissingCloseAmounts({ network })

    // Likewise for swap rows cached without their per-side asset facts. The
    // fetch above only asks for transactions newer than the newest cached one,
    // so nothing else ever revisits them.
    await backfillSwapAssetFacts({ network, accountAddress: address })
}
