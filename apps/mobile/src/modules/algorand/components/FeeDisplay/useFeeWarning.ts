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
import { Decimal } from 'decimal.js'
import {
    useAssetPricesQuery,
    useNativeAsset,
} from '@perawallet/wallet-core-assets'
import {
    useRemoteConfig,
    RemoteConfigKeys,
} from '@perawallet/wallet-core-remote-config'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'

type UseFeeWarningResult = {
    showWarning: boolean
    fee: Decimal
}

export const useFeeWarning = (): UseFeeWarningResult => {
    const {
        totalFee: fee,
        allTransactions,
        signableAddresses,
    } = useSigningPipeline()

    const signableTransactionCount = useMemo(
        () =>
            allTransactions.filter(tx => signableAddresses.has(tx.sender))
                .length,
        [allTransactions, signableAddresses],
    )

    const remoteConfigService = useRemoteConfig()
    const nativeAssetId = useNativeAsset().assetId
    const priceIds = useMemo(() => [nativeAssetId], [nativeAssetId])
    const { data: assetPrices } = useAssetPricesQuery(priceIds, true)

    const algoPrice = assetPrices?.get(nativeAssetId)?.usdPrice

    if (signableTransactionCount === 0 || !algoPrice) {
        return { showWarning: false, fee }
    }

    const standardFeePerTx = remoteConfigService.getNumberValue(
        RemoteConfigKeys.fee_warning_standard_fee,
    )
    const usdThreshold = remoteConfigService.getNumberValue(
        RemoteConfigKeys.fee_warning_usd_threshold,
    )

    const standardTotal = new Decimal(signableTransactionCount).mul(
        standardFeePerTx,
    )
    const isNonStandard = fee.greaterThan(standardTotal)

    const feeUsdValue = fee.mul(algoPrice)
    const showWarning = isNonStandard && feeUsdValue.greaterThan(usdThreshold)

    return { showWarning, fee }
}
