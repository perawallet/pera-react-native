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
import { routeCapabilities } from '@routes/capabilities'
import { isSafeRelativePath } from '@modules/webview/hooks/handlers'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { navigateToScreen } from '../navigateToScreen'

export type DiscoverPathDeeplinkHandler = (params: {
    path?: string
    sourceUrl: string
    replaceCurrentScreen: boolean
    onError?: () => void
}) => boolean

/**
 * Validates the discover path against the same safe-relative-path check
 * the Discover screen runs (defense in depth) before navigating into the
 * Discover tab with the path forwarded as a route param.
 */
export const useDiscoverPathDeeplink = (): DiscoverPathDeeplinkHandler => {
    const { errorToast } = useToast()
    const { t } = useLanguage()

    return useCallback(
        ({ path, sourceUrl, replaceCurrentScreen, onError }) => {
            if (path !== undefined && !isSafeRelativePath(path)) {
                logger.warn('Blocked DISCOVER_PATH deeplink with unsafe path', {
                    path,
                    sourceUrl,
                })
                errorToast(
                    t('errors.deeplink.invalid_url_title'),
                    t('errors.deeplink.invalid_url_body'),
                )
                onError?.()
                return false
            }
            if (!routeCapabilities.discoverTab) {
                // The Discover tab isn't registered on this platform (web:
                // Discover's feature-gate map has no 'web' key and throws
                // mid-render — see routes/capabilities.web.ts's discoverTab comment). navigateToScreen would be a
                // silent no-op, and the paste-a-link sheet locks until one of
                // its callbacks fires, so fail loudly instead.
                logger.warn(
                    'Blocked DISCOVER_PATH deeplink: tab not registered',
                    {
                        path,
                        sourceUrl,
                    },
                )
                errorToast(
                    t('errors.deeplink.invalid_url_title'),
                    t('errors.deeplink.invalid_url_body'),
                )
                onError?.()
                return false
            }
            navigateToScreen(replaceCurrentScreen, 'TabBar', {
                screen: 'Discover',
                params: { path },
            })
            return true
        },
        [errorToast, t],
    )
}
