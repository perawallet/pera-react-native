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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { AssetDetailsDisplay } from '../../types/asset-details-display'
import { extractDomain } from '../../utils/extractDomain'
import { resolveTotalSupply } from '../../utils/resolveTotalSupply'

/** A chain with no entry in the chain-UI registry gets no sections and its descriptor's explorer link. */
export const neutralAssetDetailsDisplay: AssetDetailsDisplay = {
    resolveSupply: resolveTotalSupply,
    resolveAbout: ({ asset, scope, descriptor, isNativeAsset }) => {
        const url = descriptor.explorer.assetUrl(scope.networkId, asset.assetId)
        return {
            idLabelKey: isNativeAsset
                ? null
                : i18nKey('asset_details.collectible.asset_id'),
            urlLabelKey: i18nKey('asset_details.about.url'),
            explorerLink: url ? { url, label: extractDomain(url) } : null,
        }
    },
}
