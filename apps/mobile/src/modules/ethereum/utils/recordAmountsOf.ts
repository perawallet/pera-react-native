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
    BalanceChange,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'

/**
 * What a history record did to the account's balances, signed. A summary's own
 * `balanceChanges` win; a single `amount` is unsigned, so its sign comes from
 * the direction.
 */
export const recordAmountsOf = (
    summary: TransactionSummary,
): BalanceChange[] => {
    if (summary.balanceChanges) return summary.balanceChanges
    if (!summary.amount) return []
    const { assetRef, value, display } = summary.amount
    return [
        {
            assetRef,
            value: summary.direction === 'out' ? value.negated() : value,
            ...(display && { display }),
        },
    ]
}
