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

import { useMemo } from 'react'
import Decimal from 'decimal.js'
import {
    useAssetPricesQuery,
    ALGO_ASSET_ID,
} from '@perawallet/wallet-core-assets'
import {
    useRemoteConfig,
    RemoteConfigKeys,
} from '@perawallet/wallet-core-remote-config'
import {
    useSigningRequest,
    useSigningRequestAnalysis,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'

const ALGO_PRICE_IDS = [ALGO_ASSET_ID]

type UseFeeWarningResult = {
    showWarning: boolean
    fee: Decimal
}

export const useFeeWarning = (): UseFeeWarningResult => {
    const { currentRequest } = useSigningRequest()
    const request = currentRequest as TransactionSignRequest
    const { totalFee, allTransactions, signableAddresses } =
        useSigningRequestAnalysis(request)

    const fee = useMemo(() => new Decimal(totalFee), [totalFee])

    const signableTransactionCount = useMemo(
        () =>
            allTransactions.filter(tx => signableAddresses.has(tx.sender))
                .length,
        [allTransactions, signableAddresses],
    )

    const remoteConfigService = useRemoteConfig()
    const { data: assetPrices } = useAssetPricesQuery(ALGO_PRICE_IDS, true)

    const algoPrice = assetPrices?.get(ALGO_ASSET_ID)?.usdPrice

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
