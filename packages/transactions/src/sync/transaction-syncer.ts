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
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    fetchTransactionHistory,
    hasCachedHistoryRows,
    healCachedRows,
} from '../history-adapter'
import { getLatestTransactionRoundTime, upsertTransactions } from '../db'

export async function fetchAndPersistTransactions(
    address: string,
    scope: ChainScope,
): Promise<void> {
    // Such a chain's History reads the backend on demand; there is no cache to fill.
    if (!hasCachedHistoryRows(scope.chainId)) return

    const latestRoundTime = await getLatestTransactionRoundTime({
        accountAddress: address,
        scope,
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
        scope,
        afterTime,
    })

    if (result.transactions.length > 0) {
        await upsertTransactions({
            items: result.transactions,
            accountAddress: address,
            scope,
        })
    }

    await healCachedRows(address, scope)
}
