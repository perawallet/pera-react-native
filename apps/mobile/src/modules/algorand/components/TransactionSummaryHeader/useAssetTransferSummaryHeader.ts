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

import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    getAssetTransferType,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    LEGACY_CHAIN_ID,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'
import { useMemo } from 'react'

export const useAssetTransferSummaryHeader = (
    transaction: AlgorandTransactionView,
) => {
    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )

    const label = useMemo(() => {
        switch (transferType) {
            case 'opt-in': {
                return i18nKey('transactions.summary.opt_in')
            }
            case 'opt-out': {
                return i18nKey('transactions.summary.opt_out')
            }
            case 'clawback': {
                return i18nKey('transactions.summary.clawback')
            }
            default: {
                return i18nKey('transactions.summary.transfer')
            }
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

    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { data: asset } = useSingleAssetDetailsQuery(assetId, scope)

    const amount = useMemo(() => {
        return baseUnitsToDisplayUnits(microAmount, asset?.decimals ?? 0)
    }, [microAmount, asset?.decimals])

    return {
        label,
        asset,
        assetId,
        receiver,
        amount,
    }
}
