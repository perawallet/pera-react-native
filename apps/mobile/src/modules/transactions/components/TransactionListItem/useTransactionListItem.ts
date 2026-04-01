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
import { useResolvedAddress } from '@perawallet/wallet-core-nfd'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import {
    microAlgosToAlgos,
    baseUnitsToDisplayUnits,
} from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'

import {
    ALGO_ASSET,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import type { TransactionIconType } from '@modules/transactions/components/TransactionIcon'
import { getTransactionIconType } from './utils'

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
    microAlgos: Decimal,
    isOutgoing: boolean,
): AmountDisplay => {
    const rawAmount = microAlgosToAlgos(microAlgos)
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
    amount: Decimal,
    decimals: number,
    unitName: string,
    isOutgoing: boolean,
): AmountDisplay => {
    const safeDecimals = isNaN(decimals)
        ? 0
        : Math.max(0, Math.min(19, decimals))
    const rawAmount = baseUnitsToDisplayUnits(amount, safeDecimals)
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
const getTitle = (tx: TransactionHistoryItem, userAddress: string): string => {
    if (tx.interpretedMeaning?.title) {
        return tx.interpretedMeaning.title
    }

    if (tx.swapGroupDetail) return 'Swap'

    const isOutgoing = tx.sender === userAddress

    switch (tx.txType) {
        case 'pay':
            return isOutgoing ? 'Send' : 'Receive'
        case 'axfer':
            if (
                tx.sender === tx.receiver &&
                tx.amount !== null &&
                tx.amount.isZero()
            ) {
                return 'Opt-in'
            }
            return isOutgoing ? 'Send' : 'Receive'
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
    const assetId = transaction.asset?.assetId?.toString() ?? ''
    const { data: assetDetails } = useSingleAssetDetailsQuery(assetId)

    const isOutgoing = useMemo(
        () => transaction.sender === userAddress,
        [transaction.sender, userAddress],
    )

    const counterpartyAddress = useMemo(() => {
        if (transaction.txType === 'pay' || transaction.txType === 'axfer') {
            return isOutgoing ? transaction.receiver : transaction.sender
        }
        return undefined
    }, [transaction, isOutgoing])

    const { displayName: counterpartyDisplayName } = useResolvedAddress(
        counterpartyAddress ?? '',
        { enabled: !!counterpartyAddress },
    )

    const iconType = useMemo(
        (): TransactionIconType =>
            getTransactionIconType(transaction, isOutgoing),
        [transaction, isOutgoing],
    )

    const title = useMemo(
        () => getTitle(transaction, userAddress),
        [transaction, userAddress],
    )

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
        if (counterpartyAddress) {
            return counterpartyDisplayName
        }

        return null
    }, [transaction, counterpartyAddress, counterpartyDisplayName])

    const amounts = useMemo((): AmountDisplay[] => {
        const result: AmountDisplay[] = []

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
            const decimals =
                assetDetails?.decimals ?? transaction.asset.decimals
            const unitName =
                assetDetails?.unitName ?? transaction.asset.unitName
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
            const decimals =
                assetDetails?.decimals ?? transaction.asset.decimals
            const unitName =
                assetDetails?.unitName ?? transaction.asset.unitName
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
    }, [transaction, isOutgoing, assetDetails])

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
