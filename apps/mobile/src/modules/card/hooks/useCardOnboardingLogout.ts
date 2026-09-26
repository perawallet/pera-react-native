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
import { useCardLogout, useCardStore } from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'

export type UseCardOnboardingLogoutResult = {
    /** Abandons onboarding: clears the session, wipes the flow state, exits. */
    handleLogout: () => void
}

export const useCardOnboardingLogout = (): UseCardOnboardingLogoutResult => {
    const navigation = useAppNavigation()
    const { logout } = useCardLogout()

    const handleLogout = useCallback(() => {
        trackEvent(CardEvent.CreateLogout)
        const run = async () => {
            await logout()
            useCardStore.getState().resetState()
            navigation.navigate('PeraCardIntro')
        }
        void run()
    }, [logout, navigation])

    return { handleLogout }
}
