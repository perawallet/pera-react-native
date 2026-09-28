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

import { generateUniqueId } from '@perawallet/wallet-core-shared'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useWebView, toValidatedBrowserUrl } from '@modules/webview'
import { useSourceMetadataBadge } from '../SourceMetadataBadge/useSourceMetadataBadge'

export const useSourceMetadataView = (
    metadata: SignRequestSource,
    verifiedOrigin?: string,
) => {
    const badge = useSourceMetadataBadge(metadata, verifiedOrigin)
    const { pushWebView } = useWebView()

    const handlePressUrl = () => {
        // metadata.url is dApp-asserted peerMeta, never validated upstream;
        // gate it to https:// before it reaches the WebView.
        const validatedUrl = toValidatedBrowserUrl(metadata.url)
        if (!validatedUrl) return
        pushWebView({ id: generateUniqueId(), url: validatedUrl })
    }

    return { ...badge, handlePressUrl }
}
