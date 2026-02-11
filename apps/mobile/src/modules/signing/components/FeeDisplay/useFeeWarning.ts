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

import Decimal from 'decimal.js'
import {
    useAssetFiatPricesQuery,
    ALGO_ASSET_ID,
} from '@perawallet/wallet-core-assets'
import {
    useRemoteConfigService,
    RemoteConfigKeys,
} from '@perawallet/wallet-core-platform-integration'

type UseFeeWarningParams = {
    fee: Decimal
    signableTransactionCount: number
}

type UseFeeWarningResult = {
    showWarning: boolean
}

export const useFeeWarning = ({
    fee,
    signableTransactionCount,
}: UseFeeWarningParams): UseFeeWarningResult => {
    const remoteConfigService = useRemoteConfigService()
    const { data: assetPrices } = useAssetFiatPricesQuery(true)

    if (signableTransactionCount === 0) {
        return { showWarning: false }
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

    const algoPrice = assetPrices?.get(ALGO_ASSET_ID)?.fiatPrice

    if (!algoPrice) {
        return { showWarning: false }
    }

    const feeUsdValue = fee.mul(algoPrice)
    const showWarning = isNonStandard && feeUsdValue.greaterThan(usdThreshold)

    return { showWarning }
}
