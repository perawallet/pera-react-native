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
import { isOriginGatedDeeplinkType } from '@hooks/deeplink/page-initiated-policy'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { useDeepLink } from '@hooks/useDeepLink'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { getDisplayHost } from './getDisplayHost'

import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

type UseWebViewNavigationGuardOptions = {
    isTrustedOrigin: boolean
    /** Live page URL — logged (host only) when a dispatch is refused. */
    pageUrl: string
}

type UseWebViewNavigationGuardResult = {
    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean
}

// Everyday schemes only the OS can service. WalletConnect wake links are
// deliberately absent — we ARE the wallet, so they're swallowed rather than
// bounced through the app chooser.
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
 * - Value-bearing deeplinks (transfers, keyreg, account import, WC pairing —
 *   whether custom-scheme or perawallet.app universal links) only route when
 *   the firing page is the trusted Discover origin; from any other origin
 *   they are blocked outright. OS/QR-sourced deeplinks enter through a
 *   different path and are unaffected.
 * - WalletConnect wake/focus links carry no actionable URI (no bridge param) so
 *   they don't parse as a deeplink — they're swallowed to keep them off the OS
 *   chooser.
 * - Everything else non-http(s) is refused rather than handed to the WebView,
 *   which can't load a foreign scheme. `mailto:`/`tel:`/`sms:` are opened via
 *   `Linking` first, because PWWebView sets `originWhitelist={['*']}` so
 *   react-native-webview's own openURL fallback no longer runs.
 */
export const useWebViewNavigationGuard = ({
    isTrustedOrigin,
    pageUrl,
}: UseWebViewNavigationGuardOptions): UseWebViewNavigationGuardResult => {
    const { handleDeepLink } = useDeepLink()
    const { t } = useLanguage()
    const { errorToast } = useToast()

    const onShouldStartLoadWithRequest = useCallback(
        (request: ShouldStartLoadRequest): boolean => {
            const { url } = request
            const isWebUrl = /^https?:/i.test(url)

            if (isWebUrl && !isPeraUniversalLink(url)) {
                return true
            }

            // iOS reports subframe navigations here; Android hardcodes
            // isTopFrame true (it discards the WebResourceRequest), so this can
            // only ever tighten the gate. `isTrustedOrigin` is derived from the
            // TOP frame, so without this a cross-origin iframe on Discover
            // inherits Discover's trust — the same forgery the bridge already
            // defends against with its per-mount token.
            const isTopFrameNavigation = request.isTopFrame !== false
            const isTrusted = isTrustedOrigin && isTopFrameNavigation

            const parsed = parseDeeplink(url)
            if (parsed) {
                if (!isTrusted && isOriginGatedDeeplinkType(parsed.type)) {
                    // Don't log the url: a RECOVER_ADDRESS link carries a
                    // mnemonic.
                    logger.warn(
                        'Blocked page-initiated deeplink from untrusted origin',
                        { type: parsed.type, host: getDisplayHost(pageUrl) },
                    )
                    // Silence would read as a broken app on a tap the user
                    // actually made, so say the page was refused.
                    errorToast(
                        t('errors.deeplink.blocked_origin_title'),
                        t('errors.deeplink.blocked_origin_body'),
                    )
                    return false
                }
                void handleDeepLink(url, false, 'deeplink')
                return false
            }

            if (isWebUrl) {
                return true
            }

            // `originWhitelist={['*']}` means react-native-webview no longer
            // Linking.openURL's these itself, and the WebView cannot load a
            // foreign scheme (Android raises ERR_UNKNOWN_URL_SCHEME and swaps
            // the page for the error view). Hand the everyday OS schemes over
            // explicitly, then refuse the navigation either way. WC wake links
            // are deliberately absent — we ARE the wallet.
            if (isOsHandledScheme(url)) {
                void Linking.openURL(url).catch(() => {
                    logger.warn('No OS handler for webview navigation', { url })
                })
            }

            return false
        },
        [handleDeepLink, isTrustedOrigin, pageUrl, errorToast, t],
    )

    return { onShouldStartLoadWithRequest }
}
