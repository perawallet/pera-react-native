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

import { logger } from '@perawallet/wallet-core-shared'
import {
    PERAWALLET_UNIVERSAL_LINK_HOST,
    PERAWALLET_WC_SCHEME,
    WC_SCHEME,
} from '@hooks/deeplink/constants'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { DeeplinkType } from '@hooks/deeplink/types'
import { useDeepLink } from '@hooks/useDeepLink'

import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

type UseWebViewNavigationGuardOptions = {
    isTrustedOrigin: boolean
}

type UseWebViewNavigationGuardResult = {
    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean
}

// Value-bearing deeplink types: they pre-fill Send, submit keyreg, import an
// account, or start WC pairing. A page may only fire these when it is the
// trusted Discover origin — from anywhere else they are swallowed so they
// can't reach the router in-app or re-enter via the OS (PERA-4666).
const ORIGIN_GATED_DEEPLINK_TYPES = new Set<DeeplinkType>([
    DeeplinkType.ALGO_TRANSFER,
    DeeplinkType.ASSET_TRANSFER,
    DeeplinkType.KEYREG,
    DeeplinkType.RECOVER_ADDRESS,
    DeeplinkType.WALLET_CONNECT,
])

const isWalletConnectScheme = (url: string): boolean =>
    url.startsWith(`${WC_SCHEME}:`) ||
    url.startsWith(`${PERAWALLET_WC_SCHEME}:`)

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
 *   chooser. Other unrecognised schemes keep their default OS behaviour.
 */
export const useWebViewNavigationGuard = ({
    isTrustedOrigin,
}: UseWebViewNavigationGuardOptions): UseWebViewNavigationGuardResult => {
    const { handleDeepLink } = useDeepLink()

    const onShouldStartLoadWithRequest = useCallback(
        (request: ShouldStartLoadRequest): boolean => {
            const { url } = request
            const isWebUrl = /^https?:/i.test(url)

            if (isWebUrl && !isPeraUniversalLink(url)) {
                return true
            }

            const parsed = parseDeeplink(url)
            if (parsed) {
                if (
                    !isTrustedOrigin &&
                    ORIGIN_GATED_DEEPLINK_TYPES.has(parsed.type)
                ) {
                    // Don't log the url: a RECOVER_ADDRESS link carries a
                    // mnemonic.
                    logger.warn(
                        'Blocked page-initiated deeplink from untrusted origin',
                        { type: parsed.type },
                    )
                    return false
                }
                void handleDeepLink(url, false, 'deeplink')
                return false
            }

            if (isWebUrl) {
                return true
            }

            return !isWalletConnectScheme(url)
        },
        [handleDeepLink, isTrustedOrigin],
    )

    return { onShouldStartLoadWithRequest }
}
