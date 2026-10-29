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

import { useHeldAssetDetailsQuery } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { MAX_WIDGET_NFTS, type WidgetNftCandidate } from '../snapshot'

export type UseWidgetNftCandidatesQueryResult = {
    /** `undefined` while loading, disabled or errored. */
    candidates: WidgetNftCandidate[] | undefined
}

// Some collectibles have no image (audio, 3D), so read past the cap to still fill it.
const LOOKUP_HEADROOM = 3

const toCandidate = (asset: PeraAsset): WidgetNftCandidate | undefined => {
    const collectible = asset.peraMetadata?.collectible
    const imageUrl =
        collectible?.primaryImage ??
        collectible?.media?.find(media => media.type === 'image')?.previewUrl
    if (!imageUrl) return undefined
    const collectionName = collectible?.collection?.name
    return {
        assetId: asset.assetId,
        title: collectible?.title ?? asset.name ?? asset.assetId,
        ...(collectionName ? { collectionName } : {}),
        imageUrl,
    }
}

export const useWidgetNftCandidatesQuery = (
    addresses: string[],
    scope: ChainScope,
    enabled: boolean,
): UseWidgetNftCandidatesQueryResult => {
    const { assets, isError } = useHeldAssetDetailsQuery(addresses, scope, {
        kind: 'collectible',
        maxAssetIds: MAX_WIDGET_NFTS * LOOKUP_HEADROOM,
        enabled,
    })
    if (!enabled) return { candidates: undefined }
    // "Loading" holds back the whole snapshot, so a failed or empty read must
    // resolve to no NFTs rather than leave every widget waiting.
    if (addresses.length === 0 || isError) return { candidates: [] }
    return {
        candidates: assets
            ?.map(toCandidate)
            .filter((candidate): candidate is WidgetNftCandidate => !!candidate)
            .slice(0, MAX_WIDGET_NFTS),
    }
}
