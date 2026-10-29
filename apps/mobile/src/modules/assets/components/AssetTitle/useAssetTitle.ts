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

import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { nativeAssetInfoOf } from '@modules/chain-ui/icon'
import { getVerificationIcon } from '@modules/assets/utils/verification'

export type UseAssetTitleParams = {
    asset: PeraAsset
    chainId: ChainId
    showId: boolean
}

export type UseAssetTitleResult = {
    displayName: string
    verificationIcon: Nullable<IconName>
    isSuspicious: boolean
    isDeleted: boolean
    isIdVisible: boolean
}

export const useAssetTitle = ({
    asset,
    chainId,
    showId,
}: UseAssetTitleParams): UseAssetTitleResult => {
    const nativeInfo = nativeAssetInfoOf({ chainId, assetId: asset.assetId })
    const tier = asset.peraMetadata?.verificationTier
    const isDeleted = asset.peraMetadata?.isDeleted === true

    return {
        displayName: nativeInfo?.name ?? asset.name ?? '',
        verificationIcon: nativeInfo
            ? 'assets/trusted'
            : getVerificationIcon(tier ?? 'unverified'),
        isSuspicious: tier === 'suspicious',
        isDeleted,
        isIdVisible: showId && !isDeleted && nativeInfo === undefined,
    }
}
