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
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import type { TransactionIconType } from '@modules/transactions/components/TransactionIcon'

export type AmountDisplay = {
    text: string
    isPositive: boolean
    isNegative: boolean
    hasAlgoIcon?: boolean
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

const ALGO_DECIMALS = 6

/**
 * Truncates an address to show first and last characters.
 */
const truncateAddress = (address: string): string => {
    if (address.length <= 13) return address
    return `${address.slice(0, 6)}..${address.slice(-6)}`
}

/**
 * Formats a microAlgo amount to a display string.
 */
const formatAlgoAmount = (
    microAlgos: string,
    isOutgoing: boolean,
): AmountDisplay => {
    const amount = (Number(microAlgos) || 0) / Math.pow(10, ALGO_DECIMALS)
    const prefix = isOutgoing ? '-' : ''
    const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    })

    return {
        text: `${prefix}${formatted}`,
        isPositive: !isOutgoing && amount > 0,
        isNegative: isOutgoing,
        hasAlgoIcon: true,
    }
}

/**
 * Formats an asset amount with proper decimals.
 */
const formatAssetAmount = (
    amount: string,
    decimals: number,
    unitName: string,
    isOutgoing: boolean,
): AmountDisplay => {
    const safeDecimals = isNaN(decimals) ? 0 : Math.max(0, Math.min(19, decimals))
    const numAmount = (Number(amount) || 0) / Math.pow(10, safeDecimals)
    const prefix = isOutgoing ? '- ' : '+ '

    const maxDigits = safeDecimals
    const minDigits = Math.min(2, maxDigits)

    const formatted = numAmount.toLocaleString('en-US', {
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
    })

    const isAlgo = unitName === 'ALGO'

    return {
        text: isAlgo ? `${prefix}${formatted}` : `${prefix}${formatted} ${unitName}`,
        isPositive: !isOutgoing && numAmount > 0,
        isNegative: isOutgoing,
        hasAlgoIcon: isAlgo,
    }
}

/**
 * Maps transaction type to icon type.
 */
const getIconType = (tx: TransactionHistoryItem): TransactionIconType => {
    if (tx.swapGroupDetail) return 'asset-transfer'

    switch (tx.txType) {
        case 'pay':
            return 'payment'
        case 'axfer':
            // Check if it's an opt-in (sender === receiver)
            if (tx.sender === tx.receiver && tx.amount === '0') {
                return 'asset-opt-in'
            }
            return 'asset-transfer'
        case 'acfg':
            return 'asset-config'
        case 'afrz':
            return 'asset-freeze'
        case 'appl':
            return 'app-call'
        case 'keyreg':
            return 'key-registration'
        default:
            return 'unknown'
    }
}

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

    const iconType = useMemo(() => getIconType(transaction), [transaction])

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
            return `${transaction.innerTransactionCount}inner txns`
        }

        // For payments and transfers, show the counterparty
        if (transaction.txType === 'pay' || transaction.txType === 'axfer') {
            const isOutgoing = transaction.sender === userAddress
            const counterparty = isOutgoing
                ? transaction.receiver
                : transaction.sender

            if (counterparty) {
                return truncateAddress(counterparty)
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
            const formattedAmount = (
                Number(amountOut) / Math.pow(10, 6)
            ).toFixed(2)
            // For swaps, show what user receives
            result.push({
                text:
                    assetOutUnitName === 'ALGO'
                        ? `${formattedAmount}`
                        : `+ ${formattedAmount} ${assetOutUnitName}`,
                isPositive: true,
                isNegative: false,
                hasAlgoIcon: assetOutUnitName === 'ALGO',
            })
            return result
        }

        // Handle payment transactions
        if (transaction.txType === 'pay' && transaction.amount) {
            result.push(formatAlgoAmount(transaction.amount, isOutgoing))
            return result
        }

        // Handle asset transfers
        if (transaction.txType === 'axfer' && transaction.asset) {
            const { decimals, unitName } = transaction.asset
            if (transaction.amount) {
                result.push(
                    formatAssetAmount(
                        transaction.amount,
                        decimals,
                        unitName,
                        isOutgoing,
                    ),
                )
            }
            return result
        }

        // Handle app calls with inner transactions (may have asset result)
        if (
            transaction.txType === 'appl' &&
            transaction.asset &&
            transaction.amount
        ) {
            const { decimals, unitName } = transaction.asset
            result.push(
                formatAssetAmount(
                    transaction.amount,
                    decimals,
                    unitName,
                    false,
                ),
            )
        }

        // Always show fee for transactions that cost the user
        if (isOutgoing || transaction.txType === 'acfg') {
            result.push({
                text: `-${(Number(transaction.fee) / Math.pow(10, ALGO_DECIMALS)).toFixed(3)}`,
                isPositive: false,
                isNegative: true,
                hasAlgoIcon: true,
            })
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
