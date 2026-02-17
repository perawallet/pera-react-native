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

import { useCallback, useMemo } from 'react'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import {
    getTransactionType,
    microAlgosToAlgos,
    baseUnitsToDisplayUnits,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionIconType } from '@modules/transactions/components/TransactionIcon'
import { Decimal } from 'decimal.js'

import { ALGO_ASSET } from '@perawallet/wallet-core-assets'

export type AmountDisplay = {
    /** Raw amount value for CurrencyDisplay */
    value: Decimal
    /** Currency code (e.g., 'ALGO', 'USDC') */
    currency: string
    /** Number of decimal places for this currency */
    precision: number
    /** Prefix to show (e.g., '+', '-'). Also determines styling: '+' = positive (green), '-' = negative (red). Undefined for zero values. */
    prefix?: '+' | '-'
}

export type UseTransactionListItemParams = {
    transaction: TransactionHistoryItem
    onPress?: (transaction: TransactionHistoryItem) => void
}

export type UseTransactionListItemResult = {
    iconType: TransactionIconType
    title: string
    subtitle: string | null
    amounts: AmountDisplay[]
    handlePress: () => void
}

/**
 * Creates an AmountDisplay for an ALGO amount.
 */
const createAlgoAmount = (
    microAlgos: string,
    isOutgoing: boolean,
): AmountDisplay => {
    const rawAmount = microAlgosToAlgos(microAlgos || 0)
    const absValue = rawAmount.abs()

    return {
        value: absValue,
        currency: 'ALGO',
        precision: ALGO_ASSET.decimals,
        prefix: absValue.isZero() ? undefined : isOutgoing ? '-' : '+',
    }
}

/**
 * Creates an AmountDisplay for an asset amount.
 */
const createAssetAmount = (
    amount: string,
    decimals: number,
    unitName: string,
    isOutgoing: boolean,
): AmountDisplay => {
    const safeDecimals = isNaN(decimals)
        ? 0
        : Math.max(0, Math.min(19, decimals))
    const rawAmount = baseUnitsToDisplayUnits(amount || 0, safeDecimals)
    const absValue = rawAmount.abs()

    return {
        value: absValue,
        currency: unitName,
        precision: safeDecimals,
        prefix: absValue.isZero() ? undefined : isOutgoing ? '-' : '+',
    }
}

/**
 * Maps transaction type to icon type.
 */

/**
 * Gets the display title for a transaction.
 */
const getTitle = (tx: TransactionHistoryItem): string => {
    if (tx.interpretedMeaning?.title) {
        return tx.interpretedMeaning.title
    }

    if (tx.swapGroupDetail) return 'Swap'

    switch (tx.txType) {
        case 'pay':
            return 'Payment'
        case 'axfer':
            if (tx.sender === tx.receiver && tx.amount === '0') {
                return 'Opt-in'
            }
            return 'Asset Transfer'
        case 'acfg':
            return 'Add Asset Fee'
        case 'afrz':
            return 'Asset Freeze'
        case 'appl':
            return 'App Call'
        case 'keyreg':
            return 'Key Registration'
        default:
            return 'Transaction'
    }
}

/**
 * Hook that computes display values for a transaction list item.
 */
export const useTransactionListItem = ({
    transaction,
    onPress,
}: UseTransactionListItemParams): UseTransactionListItemResult => {
    const account = useSelectedAccount()
    const userAddress = account?.address ?? ''

    const iconType = useMemo(() => {
        if (transaction.swapGroupDetail) return 'asset-transfer'

        return getTransactionType(
            transaction as unknown as PeraDisplayableTransaction,
        )
    }, [transaction])

    const title = useMemo(() => getTitle(transaction), [transaction])

    const subtitle = useMemo(() => {
        // For swaps, show the exchange details
        if (transaction.swapGroupDetail) {
            const { amountIn, assetInUnitName, amountOut, assetOutUnitName } =
                transaction.swapGroupDetail
            const inDecimals = 6 // Default for ALGO or parsed from asset
            const outDecimals = 6

            const inAmount = (
                Number(amountIn) / Math.pow(10, inDecimals)
            ).toFixed(2)
            const outAmount = (
                Number(amountOut) / Math.pow(10, outDecimals)
            ).toFixed(2)

            return `${inAmount} ${assetInUnitName} for ${outAmount} ${assetOutUnitName}`
        }

        // For app calls with inner transactions
        if (
            transaction.txType === 'appl' &&
            transaction.innerTransactionCount
        ) {
            return `${transaction.innerTransactionCount} inner txns`
        }

        // For payments and transfers, show the counterparty
        if (transaction.txType === 'pay' || transaction.txType === 'axfer') {
            const isOutgoing = transaction.sender === userAddress
            const counterparty = isOutgoing
                ? transaction.receiver
                : transaction.sender

            if (counterparty) {
                // Use shared util for address truncation (Review comment #3)
                return truncateAlgorandAddress(counterparty)
            }
        }

        return null
    }, [transaction, userAddress])

    const amounts = useMemo((): AmountDisplay[] => {
        const result: AmountDisplay[] = []
        const isOutgoing = transaction.sender === userAddress

        // Handle swap transactions
        if (transaction.swapGroupDetail) {
            const { amountOut, assetOutUnitName } = transaction.swapGroupDetail
            const rawAmount = baseUnitsToDisplayUnits(amountOut || 0, 6)
            const absValue = rawAmount.abs()

            result.push({
                value: absValue,
                currency: assetOutUnitName,
                precision: 6,
                prefix: absValue.isZero() ? undefined : '+',
            })
            return result
        }

        // Handle payment transactions
        if (transaction.txType === 'pay' && transaction.amount) {
            result.push(createAlgoAmount(transaction.amount, isOutgoing))
        }

        // Handle asset transfers
        if (transaction.txType === 'axfer' && transaction.asset) {
            const { decimals, unitName } = transaction.asset
            if (transaction.amount) {
                result.push(
                    createAssetAmount(
                        transaction.amount,
                        decimals,
                        unitName,
                        isOutgoing,
                    ),
                )
            }
        }

        // Handle app calls with inner transactions (may have asset result)
        if (
            transaction.txType === 'appl' &&
            transaction.asset &&
            transaction.amount
        ) {
            const { decimals, unitName } = transaction.asset
            result.push(
                createAssetAmount(
                    transaction.amount,
                    decimals,
                    unitName,
                    false,
                ),
            )
        }

        return result
    }, [transaction, userAddress])

    const handlePress = useCallback(() => {
        onPress?.(transaction)
    }, [onPress, transaction])

    return {
        iconType,
        title,
        subtitle,
        amounts,
        handlePress,
    }
}
