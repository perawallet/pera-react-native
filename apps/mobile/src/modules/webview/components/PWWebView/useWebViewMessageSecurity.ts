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

import { useCallback, useRef } from 'react'
import { config } from '@perawallet/wallet-core-config'
import {
    isTrustedWebviewOrigin,
    type WebviewMessageSecurity,
} from '@modules/webview/hooks/handlers'

import type { WebViewMessageEvent } from 'react-native-webview'

type UseWebViewMessageSecurityResult = {
    trackNavigation: (url: string) => void
    resolveMessageSecurity: (
        event: WebViewMessageEvent,
    ) => WebviewMessageSecurity
}

/**
 * Message-time origin trust for the webview bridge. The trust decision for a
 * bridge message is derived from the URL the message event itself carries —
 * iOS reports the posting frame's URL (`WKScriptMessage.frameInfo`), Android
 * the posting frame's origin (`WebMessageListener.onPostMessage`) — never
 * from React state: `currentUrl` only updates after a navigation event
 * re-renders, so a message racing that update would be judged against the
 * previous origin (TOCTOU). The ref tracks the last navigation URL
 * synchronously as a fallback for message events without a URL (e.g.
 * Android's legacy JS-interface bridge path).
 * On that fallback path a subframe inherits the main frame's URL, so the bridge
 * token — not this check — is what rejects subframe messages.
 */
export const useWebViewMessageSecurity = (
    initialUrl: string,
): UseWebViewMessageSecurityResult => {
    const lastNavigationUrlRef = useRef(initialUrl)

    const trackNavigation = useCallback((url: string) => {
        lastNavigationUrlRef.current = url
    }, [])

    const resolveMessageSecurity = useCallback(
        (event: WebViewMessageEvent): WebviewMessageSecurity => {
            const sourceUrl =
                event.nativeEvent.url || lastNavigationUrlRef.current
            return {
                securedConnection: isTrustedWebviewOrigin(sourceUrl, [
                    config.discoverBaseUrl,
                ]),
                sourceUrl,
            }
        },
        [],
    )

    return { trackNavigation, resolveMessageSecurity }
}
