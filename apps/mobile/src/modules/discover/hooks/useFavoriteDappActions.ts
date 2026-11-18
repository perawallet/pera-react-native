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
import { DiscoverEvent, trackEvent } from '@analytics'
import { useDiscoverFavoritesStore } from '../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../types'
import { dappEventPayload } from '../utils/discoverAnalytics'
import { normalizeDappUrl } from '../utils/normalizeDappUrl'
import { useDiscoverDirectory } from './useDiscoverDirectory'
import { useOpenDapp } from './useOpenDapp'

export type UseFavoriteDappActionsResult = {
    isVerified: (url: string) => boolean
    openDapp: (dapp: DiscoverDapp) => void
    /** Removes the favorite everywhere (it leaves every folder too). */
    unfavorite: (dapp: DiscoverDapp) => void
}

/** What a list of favorite dApps can do with a row; favorites carry no chain context. */
export const useFavoriteDappActions = (): UseFavoriteDappActionsResult => {
    const { verifiedUrls } = useDiscoverDirectory()
    const { openDapp: open } = useOpenDapp()
    const removeFavorite = useDiscoverFavoritesStore(s => s.removeFavorite)

    const isVerified = useCallback(
        (url: string) => verifiedUrls.has(normalizeDappUrl(url) ?? ''),
        [verifiedUrls],
    )
    const openDapp = useCallback(
        (dapp: DiscoverDapp) => open(dapp, null),
        [open],
    )
    // Only ever removes: a quick second tap must not star the dApp again.
    const unfavorite = useCallback(
        (dapp: DiscoverDapp) => {
            if (!useDiscoverFavoritesStore.getState().isFavorite(dapp.url)) {
                return
            }
            removeFavorite(dapp.url)
            trackEvent(
                DiscoverEvent.DappUnfavoriteTap,
                dappEventPayload(dapp, null),
            )
        },
        [removeFavorite],
    )
    return { isVerified, openDapp, unfavorite }
}
