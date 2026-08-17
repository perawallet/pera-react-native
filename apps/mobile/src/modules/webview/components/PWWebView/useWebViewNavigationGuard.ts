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

import { useCallback, useEffect, useRef } from 'react'
import { Linking } from 'react-native'

import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { PERAWALLET_UNIVERSAL_LINK_HOST } from '@hooks/deeplink/constants'
import { isOriginGatedDeeplinkType } from '@hooks/deeplink/page-initiated-policy'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { useDeepLink } from '@hooks/useDeepLink'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { isTrustedWebviewOrigin } from '@modules/webview/hooks/handlers'
import { getDisplayHost } from './getDisplayHost'
import {
    SOCIAL_MEDIA_APP_PROBES,
    getSocialMediaDeeplink,
    type SocialMediaService,
} from './social-media-deeplinks'

import type WebView from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

/**
 * Opt-in handoff for a host WebView that renders no controls of its own (the
 * Discover tab): a navigation off `hostUrl`'s origin is sent to
 * `onExternalNavigation` instead of loading in place.
 */
type ExternalNavigationHandoff = {
    hostUrl: string
    onExternalNavigation: (url: string) => void
}

type UseWebViewNavigationGuardOptions = {
    isTrustedOrigin: boolean
    /** Live page URL — logged (host only) when a dispatch is refused. */
    pageUrl: string
    /**
     * Drives the web load itself when a social-app handoff fails despite a
     * positive install probe — otherwise the tap dead-ends.
     */
    webviewRef?: React.RefObject<Nullable<WebView>>
    externalNavigation?: ExternalNavigationHandoff
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
 * Decides whether the WebView follows a navigation. A dApp in Pera's own browser
 * sometimes fires a custom-scheme link to hand off to a wallet — under the
 * default `originWhitelist` that escapes to the OS "OPEN WITH" chooser, which is
 * always redundant here since we ARE the wallet.
 *
 * Routing rules:
 * - Pera universal links are deeplinks dressed as https, routed in-app when they
 *   parse. Scoped strictly to the perawallet.app origin: the applink parser keys
 *   off a permissive `/app/` substring, so running every https navigation
 *   through it would hijack dApp routes like `https://dapp.com/app/swap`.
 * - Social-media links open the native app when installed, matching pera-ios.
 *   The installed-app checks are pre-warmed on mount, because `canOpenURL` is
 *   async while this guard answers synchronously.
 * - Value-bearing deeplinks (transfers, keyreg, import, WC pairing) route only
 *   from the trusted Discover origin, and are blocked outright elsewhere.
 *   OS/QR-sourced deeplinks come through a different path and are unaffected.
 * - WC wake links carry no actionable URI, so they don't parse as deeplinks and
 *   are swallowed to keep them off the OS chooser.
 * - blob: URLs backed by http(s), like Vestige's chart iframes, load in place
 *   and are never handed off; a blob only resolves in its creating page.
 * - Other non-http(s) is refused rather than handed to a WebView that can't load
 *   a foreign scheme. `mailto:`/`tel:`/`sms:` go through `Linking` first, since
 *   `originWhitelist={['*']}` disables react-native-webview's own fallback.
 */
export const useWebViewNavigationGuard = ({
    isTrustedOrigin,
    pageUrl,
    webviewRef,
    externalNavigation,
}: UseWebViewNavigationGuardOptions): UseWebViewNavigationGuardResult => {
    const { handleDeepLink } = useDeepLink()
    const { t } = useLanguage()
    const { errorToast } = useToast()

    const installedSocialApps = useRef<Record<SocialMediaService, boolean>>({
        twitter: false,
        telegram: false,
        discord: false,
    })

    useEffect(() => {
        const probes = Object.entries(SOCIAL_MEDIA_APP_PROBES) as [
            SocialMediaService,
            string,
        ][]
        probes.forEach(([service, probeUrl]) => {
            void Linking.canOpenURL(probeUrl)
                .then(isInstalled => {
                    installedSocialApps.current[service] = isInstalled
                })
                .catch(() => {
                    installedSocialApps.current[service] = false
                })
        })
    }, [])

    const onShouldStartLoadWithRequest = useCallback(
        (request: ShouldStartLoadRequest): boolean => {
            const { url } = request
            const isWebUrl = /^https?:/i.test(url)

            // Vestige's charts live in iframes with blob:https://... sources
            // (see pera-ios #135). A blob URL only resolves in the page
            // context that created it, so it loads in place; no handoff to
            // the in-app browser or the OS could ever render it.
            if (/^blob:https?:/i.test(url)) {
                return true
            }

            // Ahead of the plain-web early return below: social links ARE
            // ordinary https URLs, so checking them after it would never run.
            // Handing one to X/Telegram/Discord is an outward OS handoff, not a
            // wallet capability, so it stays ungated like the OS schemes.
            const socialDeeplink = getSocialMediaDeeplink(url)
            if (
                socialDeeplink &&
                installedSocialApps.current[socialDeeplink.service]
            ) {
                void Linking.openURL(socialDeeplink.url).catch(() => {
                    // The pre-warmed check said installed but the OS refused.
                    // This navigation was already blocked, so drive the web
                    // load ourselves and stop trusting the probe.
                    installedSocialApps.current[socialDeeplink.service] = false
                    if (isWebUrl) {
                        webviewRef?.current?.injectJavaScript(
                            `window.location.assign(${JSON.stringify(url)});true;`,
                        )
                    }
                })
                return false
            }

            // A host WebView with no controls of its own has no back or close
            // affordance, so navigating it to a third-party site strands the
            // user until force-kill. Hand off to the in-app browser, which
            // brings its own chrome, and leave the host page to return to.
            const isExternalToHost =
                externalNavigation !== undefined &&
                request.isTopFrame !== false &&
                !isTrustedWebviewOrigin(url, [externalNavigation.hostUrl])

            if (isWebUrl && !isPeraUniversalLink(url)) {
                if (isExternalToHost) {
                    externalNavigation?.onExternalNavigation(url)
                    return false
                }
                return true
            }

            // `isTrustedOrigin` derives from the TOP frame, so without this a
            // cross-origin iframe on Discover inherits Discover's trust. Only
            // iOS reports subframes (Android hardcodes true), so this can only
            // tighten the gate.
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
                void handleDeepLink(url, false, 'in-app')
                return false
            }

            if (isWebUrl) {
                if (isExternalToHost) {
                    externalNavigation?.onExternalNavigation(url)
                    return false
                }
                return true
            }

            // `originWhitelist={['*']}` disables react-native-webview's own
            // openURL fallback, and the WebView can't load a foreign scheme
            // (Android swaps the page for its error view). So hand the everyday
            // OS schemes over explicitly, then refuse either way. WC wake links
            // are deliberately absent — we ARE the wallet.
            if (isOsHandledScheme(url)) {
                void Linking.openURL(url).catch(() => {
                    logger.warn('No OS handler for webview navigation', { url })
                })
            }

            return false
        },
        [
            handleDeepLink,
            isTrustedOrigin,
            pageUrl,
            webviewRef,
            externalNavigation,
            errorToast,
            t,
        ],
    )

    return { onShouldStartLoadWithRequest }
}
