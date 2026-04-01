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

import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import {
    getAssetTransferType,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'
import { useMemo } from 'react'

export const useAssetTransferSummaryHeader = (
    transaction: PeraDisplayableTransaction,
) => {
    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )

    const label = useMemo(() => {
        switch (transferType) {
            case 'opt-in':
                return 'transactions.summary.opt_in'
            case 'opt-out':
                return 'transactions.summary.opt_out'
            case 'clawback':
                return 'transactions.summary.clawback'
            default:
                return 'transactions.summary.transfer'
        }
    }, [transferType])

    const receiver = useMemo(() => {
        return transaction.assetTransferTransaction?.receiver ?? ''
    }, [transaction])

    const assetId = useMemo(() => {
        return transaction.assetTransferTransaction?.assetId?.toString() ?? ''
    }, [transaction])

    const microAmount = useMemo(() => {
        return transaction.assetTransferTransaction?.amount ?? 0n
    }, [transaction])

    const { data: asset } = useSingleAssetDetailsQuery(assetId)

    const amount = useMemo(() => {
        return Decimal(microAmount).div(10 ** (asset?.decimals ?? 0))
    }, [transaction])

    return {
        label,
        asset,
        assetId,
        receiver,
        amount,
    }
}
