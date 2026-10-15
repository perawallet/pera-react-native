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
import type { AssetAboutParams, AssetAboutDisplay } from '@modules/assets'
import type { ChainUi } from '@modules/chain-ui'
import { AlgorandTransactionDetailBody } from './components/AlgorandTransactionDetailBody'
import { AlgorandTransactionPreviewRow } from './components/AlgorandTransactionPreviewRow'
import { AlgorandTransactionReviewBody } from './components/AlgorandTransactionReviewBody'
import { AssetSecurityTags } from './components/AssetSecurityTags'
import { AssetVerificationCard } from './components/AssetVerificationCard'

// ALGO's backend link points at Algoscan, which the descriptor's explorer builders can't express.
export const resolveAlgorandAssetAbout = ({
    asset,
    isNativeAsset,
}: AssetAboutParams): AssetAboutDisplay => {
    const explorerUrl = asset.peraMetadata?.explorerUrl
    return {
        idLabelKey: isNativeAsset
            ? null
            : i18nKey('asset_details.about.asa_id'),
        urlLabelKey: isNativeAsset
            ? i18nKey('asset_details.about.url')
            : i18nKey('asset_details.about.asa_url'),
        explorerLink: explorerUrl?.length
            ? {
                  url: explorerUrl,
                  label: isNativeAsset ? 'Algoscan' : 'Pera Explorer',
              }
            : null,
    }
}

export const algorandChainUi: ChainUi = {
    transactionDetails: {
        ReviewBody: AlgorandTransactionReviewBody,
        DetailBody: AlgorandTransactionDetailBody,
        PreviewRow: AlgorandTransactionPreviewRow,
    },
    assetDetails: {
        VerificationSection: AssetVerificationCard,
        IssuerControlsSection: AssetSecurityTags,
        resolveAbout: resolveAlgorandAssetAbout,
    },
}
