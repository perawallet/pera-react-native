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
import { config } from '@perawallet/wallet-core-config'
import { useCardStore } from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'

type UsePeraCardIntroScreenResult = {
    handleCreateAccount: () => void
    handleAlreadyHaveAccount: () => void
    handleLearnMore: () => void
}

export const usePeraCardIntroScreen = (): UsePeraCardIntroScreenResult => {
    const { pushWebView } = useWebView()
    const navigation = useAppNavigation()

    const handleCreateAccount = useCallback(() => {
        trackEvent(CardEvent.OnboardingCreate)
        // Starting a new sign-up: clear any leftover onboarding progress from a
        // prior run so the setup checklist re-locks until this run completes.
        useCardStore.getState().resetOnboardingProgress()
        navigation.navigate('PeraCard', {
            screen: 'CardOnboarding',
            params: { screen: 'CardOnboardingEmail' },
        })
    }, [navigation])

    const handleAlreadyHaveAccount = useCallback(() => {
        trackEvent(CardEvent.OnboardingRecover)
        navigation.navigate('PeraCard', { screen: 'CardSignIn' })
    }, [navigation])

    const handleLearnMore = useCallback(() => {
        if (!routeCapabilities.inAppWebView) {
            void Linking.openURL(config.peraCardLearnMoreUrl)
            return
        }
        pushWebView({ url: config.peraCardLearnMoreUrl })
    }, [pushWebView])

    return {
        handleCreateAccount,
        handleAlreadyHaveAccount,
        handleLearnMore,
    }
}
