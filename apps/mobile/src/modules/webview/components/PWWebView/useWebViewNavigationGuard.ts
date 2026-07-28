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

import { logger } from '@perawallet/wallet-core-shared'

import { PERAWALLET_UNIVERSAL_LINK_HOST } from '@hooks/deeplink/constants'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { useDeepLink } from '@hooks/useDeepLink'

import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

type UseWebViewNavigationGuardResult = {
    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean
}

// Everyday schemes a page may legitimately link to and that only the OS can
// service. WalletConnect wake links are deliberately absent — we ARE the
// wallet, so they're swallowed rather than bounced through the app chooser.
const OS_HANDLED_SCHEMES = ['mailto:', 'tel:', 'sms:'] as const

const isOsHandledScheme = (url: string): boolean =>
    OS_HANDLED_SCHEMES.some(scheme => url.toLowerCase().startsWith(scheme))

// Trailing slash is load-bearing: it pins the match to the perawallet.app
// origin so a look-alike host (`perawallet.app.evil.com`) can't spoof it.
const isPeraUniversalLink = (url: string): boolean =>
    url.startsWith(`${PERAWALLET_UNIVERSAL_LINK_HOST}/`)

/**
 * Decides whether the WebView should follow a navigation. A dApp running in
 * Pera's own browser sometimes fires a custom-scheme deep link to hand off to
 * a wallet — e.g. during a sign request the @perawallet/connect SDK navigates
 * to a WalletConnect wake link to foreground the app. With
 * react-native-webview's default `originWhitelist`, that navigation escapes to
 * the OS, which shows the "OPEN WITH" app chooser. We ARE the wallet, so that
 * prompt is always redundant.
 *
 * Routing rules:
 * - Pera universal links (`https://perawallet.app/qr/…` applinks) are deeplinks
 *   dressed as https — route them in-app when they parse. Scoped strictly to
 *   the perawallet.app origin: the applink parser keys off a permissive `/app/`
 *   substring, so running every https navigation through it would hijack
 *   ordinary dApp routes like `https://dapp.com/app/swap`.
 * - Other standard web navigations load in the WebView untouched.
 * - Any custom-scheme URL Pera recognises as a deeplink is routed in-app.
 * - WalletConnect wake/focus links carry no actionable URI (no bridge param) so
 *   they don't parse as a deeplink — they're swallowed to keep them off the OS
 *   chooser.
 * - Everything else non-http(s) is refused rather than handed to the WebView,
 *   which can't load a foreign scheme (Android raises
 *   `ERR_UNKNOWN_URL_SCHEME` and swaps the page for the error view). The
 *   handful of user-facing OS schemes below are explicitly opened instead:
 *   PWWebView sets `originWhitelist={['*']}` so this hook is the only decision
 *   point, and react-native-webview's own `Linking.openURL` fallback — which
 *   used to handle them — no longer runs (PERA-4717).
 *
 * Deeplink dispatch is gated on {@link isTrustedOrigin}: only the pinned
 * Discover origin may hand a navigation to the app's deeplink dispatcher.
 * Arbitrary web content in the in-app browser must NOT be able to enqueue a
 * (keyreg, contact, account-switch, …) deeplink with no origin attribution —
 * every other dApp-initiated sign request carries a source badge (PERA-4717).
 */
export const useWebViewNavigationGuard = (
    isTrustedOrigin: boolean,
): UseWebViewNavigationGuardResult => {
    const { handleDeepLink } = useDeepLink()

    const onShouldStartLoadWithRequest = useCallback(
        (request: ShouldStartLoadRequest): boolean => {
            const { url } = request

            // iOS reports subframe navigations here and sets isTopFrame; Android
            // hardcodes it true (or omits it), so this predicate can only ever
            // tighten the gate, never loosen it.
            const mayDispatch = isTrustedOrigin && request.isTopFrame !== false

            if (isPeraUniversalLink(url) && parseDeeplink(url)) {
                // A dApp navigating to perawallet.app/qr/… is never legitimate:
                // drop it rather than loading the page or dispatching it.
                if (mayDispatch) {
                    void handleDeepLink(url, false, 'deeplink')
                }
                return false
            }

            if (/^https?:/i.test(url)) {
                return true
            }

            if (mayDispatch && parseDeeplink(url)) {
                void handleDeepLink(url, false, 'deeplink')
                return false
            }

            // Hand the everyday OS schemes to the system, then refuse the
            // navigation either way — the WebView cannot load a non-http(s)
            // scheme itself.
            if (isOsHandledScheme(url)) {
                void Linking.openURL(url).catch(() => {
                    logger.warn('No OS handler for webview navigation', { url })
                })
            }

            return false
        },
        [handleDeepLink, isTrustedOrigin],
    )

    return { onShouldStartLoadWithRequest }
}
