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

import {
    stripUrlScheme,
    generateUniqueId,
} from '@perawallet/wallet-core-shared'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
} from '@perawallet/wallet-core-projects'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview/hooks'
import { toValidatedBrowserUrl } from '@modules/webview/hooks/handlers'

// Compared as origins: a peer url routinely carries a path or trailing slash
// where the observed origin is bare. An unparseable claim counts as distinct
// rather than being vouched for.
const isOriginDistinct = (
    verifiedOrigin: string | undefined,
    claimedUrl: string | undefined,
): verifiedOrigin is string => {
    if (!verifiedOrigin) return false
    try {
        return new URL(claimedUrl ?? '').origin !== verifiedOrigin
    } catch {
        return true
    }
}

export const useSourceMetadataView = (
    metadata: SignRequestSource,
    verifiedOrigin?: string,
) => {
    const { t } = useLanguage()
    const { data: project } = useProjectByUrlQuery({
        url: metadata.url,
        isEnabled: !!metadata.url,
    })

    const preferredIcon =
        metadata.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? metadata.icons?.at(0)

    const displayIcon = preferredIcon ?? project?.logoPng
    const displayName = metadata.name ?? project?.name

    // The lookup key (metadata.url) is peer-asserted, so a `verified` tier is
    // trusted only against the platform-observed origin.
    const verificationTier = resolveDisplayableVerificationTier(
        project,
        verifiedOrigin,
    )

    const url = useMemo(() => stripUrlScheme(metadata.url), [metadata.url])

    const { pushWebView } = useWebView()

    const handlePressUrl = () => {
        // metadata.url is dApp-asserted peerMeta, never validated upstream;
        // gate it to https:// before it reaches the WebView.
        const validatedUrl = toValidatedBrowserUrl(metadata.url)
        if (!validatedUrl) return
        pushWebView({ id: generateUniqueId(), url: validatedUrl })
    }

    // The name and url above are what the dApp claims about itself. When the
    // platform observed a different origin, say so: the connect screen already
    // does, and without it a pairing from one site dressed as another reads as
    // the impersonated site on every later transaction review.
    const requestOriginLabel = isOriginDistinct(verifiedOrigin, metadata.url)
        ? t('dapp.enable.request_origin', {
              origin: stripUrlScheme(verifiedOrigin),
          })
        : undefined

    return {
        displayIcon,
        displayName,
        url,
        verificationTier,
        requestOriginLabel,
        handlePressUrl,
    }
}
