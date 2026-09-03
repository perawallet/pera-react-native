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
import { hasCardSession, useCardStore } from '@perawallet/wallet-core-card'
import { trackEvent, HomeEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AccountSortContent } from '@modules/accounts/components/AccountSortContent'

export type UseAccountSwitcherActionsResult = {
    goToAddAccount: () => void
    goToSearch: () => void
    goToPeraCardActivation: () => void
    openPeraCard: () => void
    /** Resolves once the sort sheet closes, so a sheet host can reopen itself. */
    openSort: () => Promise<void>
}

/**
 * Everything the account switcher does other than pick an account. Shared so
 * the bottom-sheet switcher and the drawer switcher can't drift apart — the
 * Pera Card branching below is the part that matters.
 */
export const useAccountSwitcherActions =
    (): UseAccountSwitcherActionsResult => {
        const navigation = useAppNavigation()
        const { request: requestBottomSheet } = useBottomSheet()

        const goToAddAccount = useCallback(() => {
            trackEvent(HomeEvent.AccountAdd)
            navigation.navigate('AddAccount', { screen: 'AddAccountHome' })
        }, [navigation])

        const goToSearch = useCallback(() => {
            navigation.navigate('Search', { screen: 'SearchScreen' })
        }, [navigation])

        const goToPeraCardActivation = useCallback(() => {
            navigation.navigate('PeraCard', { screen: 'PeraCardIntro' })
        }, [navigation])

        const openPeraCard = useCallback(() => {
            // The connected row shows off the persisted auth flag, which can
            // outlive the real session — require a live token, else log in.
            if (!hasCardSession()) {
                navigation.navigate('PeraCard', { screen: 'CardSignIn' })
                return
            }
            // Baanx auth finishing doesn't mean the escrow card itself was
            // ever created/approved — send an authenticated-but-incomplete
            // user back into the setup checklist rather than the dashboard.
            const { escrowCardAddress, escrowCardApproved } =
                useCardStore.getState()
            if (!escrowCardAddress || !escrowCardApproved) {
                navigation.navigate('PeraCard', {
                    screen: 'CardOnboarding',
                    params: { screen: 'CardOnboardingStatus', params: {} },
                })
                return
            }
            navigation.navigate('TabBar', {
                screen: 'Home',
                params: { screen: 'PeraCardAccount' },
            })
        }, [navigation])

        const openSort = useCallback(async () => {
            trackEvent(HomeEvent.Sort)
            await requestBottomSheet<void>({
                contents: <AccountSortContent />,
                options: {
                    size: 'modal',
                    enablePanDownToClose: false,
                    enableContentPanningGesture: false,
                    autoCreateContainer: false,
                },
            })
        }, [requestBottomSheet])

        return {
            goToAddAccount,
            goToSearch,
            goToPeraCardActivation,
            openPeraCard,
            openSort,
        }
    }
