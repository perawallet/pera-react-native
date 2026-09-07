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
import { useWebView } from '@modules/webview/hooks'
import { toValidatedBrowserUrl } from '@modules/webview/hooks/handlers'

export const useSourceMetadataView = (
    metadata: SignRequestSource,
    verifiedOrigin?: string,
) => {
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

    return {
        displayIcon,
        displayName,
        url,
        verificationTier,
        handlePressUrl,
    }
}
