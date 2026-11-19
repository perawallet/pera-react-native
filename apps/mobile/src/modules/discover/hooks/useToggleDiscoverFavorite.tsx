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
import { useDiscoverFavoritesStore } from '../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../types'
import { dappEventPayload } from '../utils/discoverAnalytics'

export type UseToggleDiscoverFavoriteResult = (
    dapp: DiscoverDapp,
    chain: Nullable<ChainId>,
) => boolean

/** Stars or unstars a dApp; starring confirms with an "Added to favorites" toast. */
export const useToggleDiscoverFavorite =
    (): UseToggleDiscoverFavoriteResult => {
        const toggleFavorite = useDiscoverFavoritesStore(s => s.toggleFavorite)
        const { successToast } = useToast()
        const { t } = useLanguage()

        return useCallback(
            (dapp, chain) => {
                const isNowFavorite = toggleFavorite(dapp)
                trackEvent(
                    isNowFavorite
                        ? DiscoverEvent.DappFavoriteTap
                        : DiscoverEvent.DappUnfavoriteTap,
                    dappEventPayload(dapp, chain),
                )
                if (isNowFavorite) {
                    successToast(
                        t('discover.favorites.added_toast.title'),
                        '',
                        {
                            // Shows above an open sheet, such as the in-app browser.
                            notifier: bottomSheetNotifier.current ?? undefined,
                        },
                    )
                }
                return isNowFavorite
            },
            [toggleFavorite, successToast, t],
        )
    }
