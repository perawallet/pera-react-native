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
    getUniversalLinkPath,
    isNotificationAllowedDeeplinkType,
    useDeepLink,
} from '@modules/deeplink'
import {
    openValidatedBrowserUrl,
    toValidatedBrowserUrl,
} from '@modules/webview'

type RouteInput = {
    url: string | null
}

type UseBannerLinkRouterResult = {
    route: (input: RouteInput) => void
}

export const useBannerLinkRouter = (): UseBannerLinkRouterResult => {
    const { parseDeeplink, handleDeepLink, isDeepLinkAvailable } = useDeepLink()

    const route = useCallback(
        ({ url }: RouteInput) => {
            if (!url) return
            // Classify the canonical form that is then dispatched or opened: a
            // bare or `HTTPS://` Pera link must not pass as an external URL.
            const externalUrl = toValidatedBrowserUrl(url)
            const candidate = externalUrl ?? url

            const parsed = parseDeeplink(candidate)
            if (parsed) {
                // CMS content sits in the same trust class as a push payload:
                // the server picks the destination, the user navigated nowhere.
                // Refusals stay silent, like a notification's.
                if (
                    !isNotificationAllowedDeeplinkType(parsed.type) ||
                    !isDeepLinkAvailable(candidate)
                ) {
                    logger.warn('Blocked banner-initiated deeplink', {
                        type: parsed.type,
                    })
                    return
                }
                void handleDeepLink(candidate, false, 'in-app')
                return
            }

            // Unparsed, but under the app's own App Link paths: the OS would
            // route it back in as a full-trust deeplink.
            if (
                externalUrl &&
                getUniversalLinkPath(externalUrl)?.startsWith('/qr/')
            ) {
                logger.warn(
                    'Blocked unparsed banner URL under an App Link path',
                )
                return
            }
            openValidatedBrowserUrl(url)
        },
        [parseDeeplink, handleDeepLink, isDeepLinkAvailable],
    )

    return { route }
}
