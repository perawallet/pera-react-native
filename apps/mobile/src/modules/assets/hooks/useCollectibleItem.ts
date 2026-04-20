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
import { isPureNft } from '@perawallet/wallet-core-assets'
import type { IconName } from '@components/core'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import type { CollectibleItemProps } from '@modules/assets/types/collectible'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'

type UseCollectibleItemResult = {
    thumbnailUrl: Maybe<string>
    showAmount: boolean
    hasBalance: boolean
    verificationIconName: Nullable<IconName>
    title: string
    collectionName: string | undefined
}

export const useCollectibleItem = ({
    item,
}: CollectibleItemProps): UseCollectibleItemResult => {
    const { asset, amount, collectible } = item

    const thumbnailUrl = collectible?.primaryImage ?? asset.peraMetadata?.logo
    const showAmount = !isPureNft(asset) && !amount.isZero()
    const hasBalance = amount.greaterThan(0)
    const collectionName = collectible?.collection?.name
    const title = collectible?.title ?? asset.name ?? `#${asset.assetId}`

    const verificationIconName = useMemo<Nullable<IconName>>(() => {
        const tier = asset.peraMetadata?.verificationTier
        return tier ? getVerificationIcon(tier) : null
    }, [asset.peraMetadata?.verificationTier])

    return {
        thumbnailUrl,
        showAmount,
        hasBalance,
        verificationIconName,
        title,
        collectionName,
    }
}
