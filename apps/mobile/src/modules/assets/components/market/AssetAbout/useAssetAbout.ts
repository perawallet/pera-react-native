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

import { useCallback } from 'react'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { toValidatedBrowserUrl, useWebView } from '@modules/webview'
import type {
    AssetAboutDisplay,
    AssetExplorerLink,
} from '@modules/assets/types/asset-details-display'
import { extractDomain } from '@modules/assets/utils/extractDomain'

type UseAssetAboutResult = {
    creatorDisplayName: string
    /** Null when the asset URL fails the browser gate, so its row is hidden. */
    assetLink: Nullable<AssetExplorerLink>
    explorerLink: Nullable<AssetExplorerLink>
    projectUrl: Nullable<string>
    copyToClipboard: (text: string) => Promise<void>
    openLink: (url: string) => void
}

export const useAssetAbout = (
    assetDetails: PeraAsset,
    about: AssetAboutDisplay,
): UseAssetAboutResult => {
    const { pushWebView } = useWebView()
    const { copyToClipboard } = useClipboard()
    const { displayName: creatorDisplayName } = useResolvedAddress(
        assetDetails.creator?.address ?? '',
        { enabled: !!assetDetails.creator?.address },
    )

    // Asset metadata URLs are often http or ipfs://, which the webview refuses;
    // validating here hides the row instead of rendering a link that does nothing.
    const assetUrl = toValidatedBrowserUrl(assetDetails.url)
    const assetLink = assetUrl
        ? { url: assetUrl, label: extractDomain(assetUrl) }
        : null

    const explorerUrl = toValidatedBrowserUrl(about.explorerLink?.url)
    const explorerLink =
        explorerUrl && about.explorerLink
            ? { url: explorerUrl, label: about.explorerLink.label }
            : null

    const projectUrl = toValidatedBrowserUrl(
        assetDetails.peraMetadata?.projectUrl,
    )

    const openLink = useCallback(
        (url: string) => {
            const validatedUrl = toValidatedBrowserUrl(url)
            if (!validatedUrl) return
            pushWebView({
                id: generateOrderedUniqueId(),
                url: validatedUrl,
            })
        },
        [pushWebView],
    )

    return {
        creatorDisplayName,
        assetLink,
        explorerLink,
        projectUrl,
        copyToClipboard,
        openLink,
    }
}
