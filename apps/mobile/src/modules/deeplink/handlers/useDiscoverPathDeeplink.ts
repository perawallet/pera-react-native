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
import { isSafeRelativePath } from '@modules/webview'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useIsNativeDiscover } from '@hooks/useIsNativeDiscover'
import { navigateToScreen } from '../navigateToScreen'
import { discoverPathTarget } from './discoverPathTarget'

export type DiscoverPathDeeplinkHandler = (params: {
    path?: string
    sourceUrl: string
    replaceCurrentScreen: boolean
    onError?: () => void
}) => boolean

/**
 * Validates the discover path against the same safe-relative-path check
 * the Discover screen runs (defense in depth). An Algorand-only build hands
 * the path to the Discover web app in its tab; a multichain build, whose
 * Discover tab is native, routes to native asset details or the Discover
 * home, never to the web app.
 */
export const useDiscoverPathDeeplink = (): DiscoverPathDeeplinkHandler => {
    const { errorToast } = useToast()
    const { t } = useLanguage()
    const isNativeDiscover = useIsNativeDiscover()

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
            if (!isNativeDiscover) {
                navigateToScreen(replaceCurrentScreen, 'TabBar', {
                    screen: 'Discover',
                    params: { path },
                })
                return true
            }
            const target = discoverPathTarget(path)
            if (target.kind === 'asset') {
                navigateToScreen(replaceCurrentScreen, 'TabBar', {
                    screen: 'Home',
                    params: {
                        screen: 'AssetDetails',
                        params: {
                            assetId: target.assetId,
                            chainId: target.chainId,
                        },
                    },
                })
                return true
            }
            // The native Discover never opens the Discover web app; a page it
            // has no screen for lands on its home until one is ported.
            if (target.kind === 'unported') {
                logger.warn('DISCOVER_PATH has no native screen yet', {
                    path: target.path,
                })
            }
            navigateToScreen(replaceCurrentScreen, 'TabBar', {
                screen: 'Discover',
            })
            return true
        },
        [errorToast, t, isNativeDiscover],
    )
}
