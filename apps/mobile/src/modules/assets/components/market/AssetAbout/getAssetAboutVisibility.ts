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
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    AssetAboutDisplay,
    AssetExplorerLink,
} from '@modules/assets/types/asset-details-display'

/** The links that passed the browser gate; one that failed is null, and its row hides. */
export type AssetAboutLinks = {
    assetLink: Nullable<AssetExplorerLink>
    explorerLink: Nullable<AssetExplorerLink>
    projectUrl: Nullable<string>
}

export type AssetAboutVisibility = {
    isVisible: boolean
    hasIdRow: boolean
    hasCreatorRow: boolean
    hasUrlRow: boolean
    hasExplorerRow: boolean
    hasProjectWebsiteRow: boolean
}

export const getAssetAboutVisibility = (
    asset: PeraAsset,
    about: AssetAboutDisplay,
    { assetLink, explorerLink, projectUrl }: AssetAboutLinks,
): AssetAboutVisibility => {
    const hasIdRow = !!asset.assetId && !!about.idLabelKey
    const hasCreatorRow = !!asset.creator?.address
    const hasUrlRow = !!assetLink
    const hasExplorerRow = !!explorerLink
    const hasProjectWebsiteRow = !!projectUrl
    return {
        isVisible:
            hasIdRow ||
            hasCreatorRow ||
            hasUrlRow ||
            hasExplorerRow ||
            hasProjectWebsiteRow,
        hasIdRow,
        hasCreatorRow,
        hasUrlRow,
        hasExplorerRow,
        hasProjectWebsiteRow,
    }
}
