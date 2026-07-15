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

import { useMemo } from 'react'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'

import {
    type AmountDisplay,
    MAX_VISIBLE_AMOUNTS,
    createAlgoAmount,
    createAssetAmount,
    createBalanceImpactAmount,
    createSwapAmount,
} from './amounts'

import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

export type UseTransactionAmountsResult = {
    /** Amounts to display, capped at {@link MAX_VISIBLE_AMOUNTS}. */
    amounts: AmountDisplay[]
    /** Number of amounts hidden beyond the cap, for the "Show N more" line. */
    amountsOverflowCount: number
}

/**
 * Computes the right-column amounts for a transaction list row.
 *
 * Payments and transfers show a single signed amount; swaps show the output
 * amount; application calls surface the account's net per-asset balance impact
 * (sent/received) across the call and its inner transactions, stacked and
 * capped with an overflow count.
 */
export const useTransactionAmounts = (
    transaction: TransactionHistoryItem,
): UseTransactionAmountsResult => {
    const account = useSelectedAccount()
    const userAddress = account?.address ?? ''
    const assetId = transaction.asset?.assetId?.toString() ?? ''
    const { data: assetDetails } = useSingleAssetDetailsQuery(assetId)
    const isOutgoing = transaction.sender === userAddress

    const allAmounts = useMemo((): AmountDisplay[] => {
        const result: AmountDisplay[] = []

        // Handle swap transactions
        if (transaction.swapGroupDetail) {
            const { amountOut, assetOutUnitName } = transaction.swapGroupDetail
            result.push(createSwapAmount(amountOut, assetOutUnitName))
            return result
        }

        // Handle payment transactions
        if (transaction.txType === 'pay' && transaction.amount) {
            result.push(createAlgoAmount(transaction.amount, isOutgoing))
        }

        // Handle asset transfers
        if (
            transaction.txType === 'axfer' &&
            transaction.asset &&
            transaction.amount
        ) {
            const decimals =
                assetDetails?.decimals ?? transaction.asset.decimals
            const unitName =
                assetDetails?.unitName ?? transaction.asset.unitName
            result.push(
                createAssetAmount(
                    transaction.amount,
                    decimals,
                    unitName,
                    isOutgoing,
                ),
            )
        }

        // For app calls, surface the account's net per-asset balance impact
        // (sent/received) across the call and its inner transactions. The
        // backend already nets these, so we render them directly with the sign
        // determining direction.
        if (transaction.txType === 'appl') {
            transaction.balanceImpacts.forEach(impact => {
                result.push(createBalanceImpactAmount(impact))
            })
        }

        return result
    }, [transaction, isOutgoing, assetDetails])

    const amounts = useMemo(
        () => allAmounts.slice(0, MAX_VISIBLE_AMOUNTS),
        [allAmounts],
    )

    const amountsOverflowCount = Math.max(
        0,
        allAmounts.length - MAX_VISIBLE_AMOUNTS,
    )

    return { amounts, amountsOverflowCount }
}
