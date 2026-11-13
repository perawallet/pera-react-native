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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { DiscoverEvent, trackEvent } from '@analytics'
import { toValidatedBrowserUrl, useWebView } from '@modules/webview'
import { useDiscoverFavoritesStore } from '../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../types'
import { dappEventPayload } from '../utils/discoverAnalytics'
import { useToggleDiscoverFavorite } from './useToggleDiscoverFavorite'

export type UseOpenDappResult = {
    openDapp: (dapp: DiscoverDapp, chain: Nullable<ChainId>) => void
    openWebPage: (rawUrl: string) => void
}

export const useOpenDapp = (): UseOpenDappResult => {
    const { pushWebView } = useWebView()
    const toggle = useToggleDiscoverFavorite()

    const openDapp = useCallback(
        (dapp: DiscoverDapp, chain: Nullable<ChainId>) => {
            const url = toValidatedBrowserUrl(dapp.url)
            if (url === null) {
                logger.warn('Discover refused to open an invalid dApp URL', {
                    url: dapp.url,
                })
                return
            }
            trackEvent(DiscoverEvent.DappOpenTap, dappEventPayload(dapp, chain))
            pushWebView({
                url,
                enablePeraConnect: true,
                favorite: {
                    initialIsFavorite: useDiscoverFavoritesStore
                        .getState()
                        .isFavorite(url),
                    onToggle: () => {
                        toggle({ ...dapp, url }, chain)
                    },
                },
            })
        },
        [pushWebView, toggle],
    )

    // DuckDuckGo and URL recents: no favorite hook and no event.
    const openWebPage = useCallback(
        (rawUrl: string) => {
            const url = toValidatedBrowserUrl(rawUrl)
            if (url === null) {
                logger.warn(
                    'Discover refused to open an invalid web page URL',
                    {
                        url: rawUrl,
                    },
                )
                return
            }
            pushWebView({ url, enablePeraConnect: true })
        },
        [pushWebView],
    )

    return { openDapp, openWebPage }
}
