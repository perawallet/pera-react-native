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

import {
    type PeraDisplayableTransaction,
    getAssetConfigType,
} from '@perawallet/wallet-core-blockchain'
import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    decodeBytesToText,
    formatNumber,
    formatWithUnits,
} from '@perawallet/wallet-core-shared'

export const useAssetConfigDisplay = (
    transaction: PeraDisplayableTransaction,
) => {
    const assetConfig = transaction.assetConfigTransaction

    const configType = getAssetConfigType(transaction)
    const assetId = assetConfig?.assetId
    const showWarnings = !transaction?.id

    const supply = useMemo(() => {
        const { amount, unit } = assetConfig?.params?.total
            ? formatWithUnits(Decimal(assetConfig?.params?.total.toString()))
            : { amount: undefined, unit: undefined }

        if (!amount) {
            return undefined
        }

        const { integer, fraction } = formatNumber(amount, 2)
        return `${integer}${fraction}${unit}`
    }, [assetConfig?.params?.total])

    const metadataHash = useMemo(
        () => decodeBytesToText(assetConfig?.params?.metadataHash),
        [assetConfig?.params?.metadataHash],
    )

    return {
        assetConfig,
        configType,
        assetId,
        showWarnings,
        supply,
        metadataHash,
    }
}
