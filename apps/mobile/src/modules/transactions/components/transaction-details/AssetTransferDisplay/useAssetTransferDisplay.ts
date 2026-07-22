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
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { Decimal } from 'decimal.js'
import { useStyles } from './styles'

export const useAssetTransferDisplay = (
    transaction: PeraDisplayableTransaction,
    referenceAddress?: string,
) => {
    const styles = useStyles()

    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )
    const showWarnings = useMemo(() => !transaction.id, [transaction])
    const assetId = transaction.assetTransferTransaction?.assetId?.toString()

    const { data: asset, isPending: isAssetPending } =
        useSingleAssetDetailsQuery(assetId ?? '')

    const assetTransfer = transaction.assetTransferTransaction

    const senderAddress = transaction.sender
    const receiverAddress = assetTransfer?.receiver
    const amount = useMemo(() => {
        const amount = new Decimal(assetTransfer?.amount?.toString() ?? '0')
        return amount
            .dividedBy(new Decimal(10 ** (asset?.decimals ?? 6)))
            .mul(referenceAddress === assetTransfer?.receiver ? -1 : 1)
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
        amount,
        amountStyle,
        metadataHash,
    }
}
