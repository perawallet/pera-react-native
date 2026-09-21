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
import { isPushAllowedDeeplinkType } from '@hooks/deeplink/page-initiated-policy'
import { useDeepLink } from '@hooks/useDeepLink'

type RouteInput = {
    url: string | null
}

type UseBannerLinkRouterResult = {
    route: (input: RouteInput) => void
}

/**
 * What a marketing CTA legitimately opens outside the app: a web page, a store
 * listing, a support mail, a phone number. `pera://` is absent on purpose — a
 * banner URL marked external would otherwise re-enter the app through the OS
 * as a full-trust deeplink. Not `isSafeBrowserUrl`, which is https-only for
 * its webview callers and stays that way.
 */
const BANNER_URL_SCHEMES = [
    'https:',
    'itms-apps:',
    'itms-beta:',
    'mailto:',
    'tel:',
]

const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i

const toValidatedBannerUrl = (url: string): string | null => {
    const trimmed = url.trim()
    // Nothing legitimate is scheme-relative; the CMS field is a plain string
    // and may hold a bare domain, which means https.
    if (!trimmed || trimmed.startsWith('//')) return null
    const normalized = SCHEME_PATTERN.test(trimmed)
        ? trimmed
        : `https://${trimmed}`
    try {
        return BANNER_URL_SCHEMES.includes(new URL(normalized).protocol)
            ? normalized
            : null
    } catch {
        return null
    }
}

export const useBannerLinkRouter = (): UseBannerLinkRouterResult => {
    const { parseDeeplink, handleDeepLink } = useDeepLink()

    const route = useCallback(
        ({ url }: RouteInput) => {
            if (!url) return
            // Normalized BEFORE it is classified, because adding the `https://`
            // is what can turn a bare `perawallet.app/qr/…` string into a
            // recognized universal link. Classifying the raw string and opening
            // the normalized one would hand that link to the OS, which routes it
            // straight back in as a full-trust deeplink.
            const externalUrl = toValidatedBannerUrl(url)
            const candidate = externalUrl ?? url

            // Parsed regardless of `isExternal`: that flag is CMS content, so
            // letting it choose the path lets the server skip the gate.
            const parsed = parseDeeplink(candidate)
            if (parsed) {
                // CMS content sits in the same trust class as a push payload:
                // the server picks the destination, the user navigated nowhere.
                if (!isPushAllowedDeeplinkType(parsed.type)) {
                    logger.warn('Blocked banner-initiated deeplink', {
                        type: parsed.type,
                    })
                    return
                }
                void handleDeepLink(candidate, false, 'in-app')
                return
            }

            if (!externalUrl) {
                // Scheme only: a refused `pera://…` CTA can carry a mnemonic.
                logger.warn('Blocked banner URL with an unsupported scheme', {
                    scheme: SCHEME_PATTERN.exec(url)?.[0] ?? '(none)',
                })
                return
            }
            // No OS handler for the URL is a device condition, not our bug.
            Linking.openURL(externalUrl).catch(err =>
                logger.warn('Failed to open banner URL', {
                    url: externalUrl,
                    err,
                }),
            )
        },
        [parseDeeplink, handleDeepLink],
    )

    return { route }
}
