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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { DiscoverEvent, trackEvent } from '@analytics'
import { bottomSheetNotifier } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AddToFolderSheet } from '../components/AddToFolderSheet'
import { useDiscoverFavoritesStore } from '../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../types'
import { dappEventPayload } from '../utils/discoverAnalytics'

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: a duration in ms, not a size
const FOLDER_TOAST_DURATION_MS = 5000

export type UseToggleDiscoverFavoriteResult = (
    dapp: DiscoverDapp,
    chain: Nullable<ChainId>,
) => boolean

export const useToggleDiscoverFavorite =
    (): UseToggleDiscoverFavoriteResult => {
        const toggleFavorite = useDiscoverFavoritesStore(s => s.toggleFavorite)
        const { successToast } = useToast()
        const { request } = useBottomSheet()
        const { t } = useLanguage()

        // Starring stays one tap; the toast is the optional way into folders.
        const offerFolders = useCallback(
            (url: string) => {
                successToast(
                    t('discover.favorites.added_toast.title'),
                    t('discover.favorites.added_toast.body'),
                    {
                        // Long enough to read and reach: the toast is the way into folders.
                        duration: FOLDER_TOAST_DURATION_MS,
                        // Shows above an open sheet, such as the in-app browser.
                        notifier: bottomSheetNotifier.current ?? undefined,
                        onPress: () => {
                            trackEvent(DiscoverEvent.FavoriteToastTap)
                            // Unstarred again before the tap: nothing to file.
                            if (
                                !useDiscoverFavoritesStore
                                    .getState()
                                    .isFavorite(url)
                            ) {
                                return
                            }
                            void request({
                                contents: <AddToFolderSheet url={url} />,
                                options: {
                                    size: 'auto',
                                    enablePanDownToClose: true,
                                },
                            })
                        },
                    },
                )
            },
            [successToast, request, t],
        )

        return useCallback(
            (dapp, chain) => {
                const isNowFavorite = toggleFavorite(dapp)
                trackEvent(
                    isNowFavorite
                        ? DiscoverEvent.DappFavoriteTap
                        : DiscoverEvent.DappUnfavoriteTap,
                    dappEventPayload(dapp, chain),
                )
                if (isNowFavorite) offerFolders(dapp.url)
                return isNowFavorite
            },
            [toggleFavorite, offerFolders],
        )
    }
