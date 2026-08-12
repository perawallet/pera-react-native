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
import { useDeepLink } from '@hooks/useDeepLink'

type RouteInput = {
    url: string | null
    isExternal: boolean
}

type UseBannerLinkRouterResult = {
    route: (input: RouteInput) => void
}

export const useBannerLinkRouter = (): UseBannerLinkRouterResult => {
    const { isValidDeepLink, handleDeepLink } = useDeepLink()

    const route = useCallback(
        ({ url, isExternal }: RouteInput) => {
            if (!url) return
            if (isExternal) {
                Linking.openURL(url).catch(err =>
                    logger.error('Failed to open banner URL', { url, err }),
                )
                return
            }
            if (isValidDeepLink(url)) {
                void handleDeepLink(url, false, 'in-app')
            } else {
                Linking.openURL(url).catch(err =>
                    logger.error('Failed to open banner URL', { url, err }),
                )
            }
        },
        [isValidDeepLink, handleDeepLink],
    )

    return { route }
}
