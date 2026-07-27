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
import { Linking } from 'react-native'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { routeCapabilities } from '@routes/capabilities'
import { isSafeBrowserUrl } from '@modules/webview/hooks/handlers'
import { useWebView } from '@modules/webview/hooks/useWebViewStore'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

export type BrowserDeeplinkHandler = (params: {
    url: string
    sourceUrl: string
    onError?: () => void
}) => boolean

/**
 * Shared handler for INTERNAL_BROWSER and DISCOVER_BROWSER deeplinks. Both
 * just push the URL into the webview stack after running it through the
 * scheme allowlist. Returns true on success, false if the URL was blocked
 * (caller should bail before logging "handled successfully").
 */
export const useBrowserDeeplink = (): BrowserDeeplinkHandler => {
    const { pushWebView } = useWebView()
    const { errorToast } = useToast()
    const { t } = useLanguage()

    return useCallback(
        ({ url, sourceUrl, onError }) => {
            if (!isSafeBrowserUrl(url)) {
                logger.warn('Blocked deeplink WebView push for unsafe URL', {
                    url,
                    sourceUrl,
                })
                errorToast(
                    t('errors.deeplink.invalid_url_title'),
                    t('errors.deeplink.invalid_url_body'),
                )
                onError?.()
                return false
            }
            if (!routeCapabilities.inAppWebView) {
                // Capability contract (capabilities-types.ts): off ⇒
                // Linking.openURL. On web nothing mounts the webview stack,
                // so pushWebView would silently no-op.
                void Linking.openURL(url)
                return true
            }
            pushWebView({ id: generateOrderedUniqueId(), url })
            return true
        },
        [errorToast, pushWebView, t],
    )
}
