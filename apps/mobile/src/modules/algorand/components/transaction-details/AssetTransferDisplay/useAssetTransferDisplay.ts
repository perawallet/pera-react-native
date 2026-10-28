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
import {
    getAssetTransferType,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'

export const useAssetTransferDisplay = (
    transaction: AlgorandTransactionView,
    referenceAddress?: string,
) => {
    const styles = useStyles()

    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )
    const showWarnings = useMemo(() => !transaction.id, [transaction])
    const assetId = transaction.assetTransferTransaction?.assetId?.toString()

    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { data: asset, isPending: isAssetPending } =
        useSingleAssetDetailsQuery(assetId ?? '', scope)

    const assetTransfer = transaction.assetTransferTransaction

    const senderAddress = transaction.sender
    const receiverAddress = assetTransfer?.receiver
    const closeToAddress = assetTransfer?.closeTo
    const closeAmountValue = useMemo(() => {
        if (assetTransfer?.closeAmount === undefined) return null
        return baseUnitsToDisplayUnits(
            assetTransfer.closeAmount,
            asset?.decimals ?? 6,
        )
    }, [assetTransfer?.closeAmount, asset?.decimals])
    // The paid leg only — an opt-out's swept holding renders in its own
    // Remainder Amount row (closeAmountValue), so the two never double-count.
    const amount = useMemo(() => {
        return baseUnitsToDisplayUnits(
            assetTransfer?.amount ?? 0n,
            asset?.decimals ?? 6,
        ).mul(referenceAddress === assetTransfer?.receiver ? -1 : 1)
    }, [
        assetTransfer?.amount,
        asset?.decimals,
        referenceAddress,
        assetTransfer?.receiver,
    ])

    const amountStyle = useMemo(() => {
        if (senderAddress === referenceAddress) {
            return styles.amountNegative
        } else if (receiverAddress === referenceAddress) {
            return styles.amountPositive
        }
        return undefined
    }, [
        styles.amountNegative,
        receiverAddress,
        senderAddress,
        referenceAddress,
        styles.amountPositive,
    ])

    const metadataHash = useMemo(() => asset?.metadata, [asset])

    return {
        transferType,
        showWarnings,
        assetId,
        asset,
        isAssetPending,
        assetTransfer,
        senderAddress,
        receiverAddress,
        closeToAddress,
        closeAmountValue,
        amount,
        amountStyle,
        metadataHash,
    }
}
