/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { config } from '@perawallet/wallet-core-config'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'

type UsePeraCardIntroScreenResult = {
    handleCreateAccount: () => void
    handleAlreadyHaveAccount: () => void
    handleLearnMore: () => void
}

export const usePeraCardIntroScreen = (): UsePeraCardIntroScreenResult => {
    const { infoToast } = useToast()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const navigation = useAppNavigation()

    const handleCreateAccount = useCallback(() => {
        navigation.navigate('PeraCard', {
            screen: 'CardOnboarding',
            params: { screen: 'CardOnboardingEmail' },
        })
    }, [navigation])

    // TODO(card): wire to the Baanx login flow
    const showComingSoon = useCallback(() => {
        infoToast(
            t('peraCard.intro.coming_soon_title'),
            t('peraCard.intro.coming_soon_body'),
        )
    }, [infoToast, t])

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.peraCardLearnMoreUrl })
    }, [pushWebView])

    return {
        handleCreateAccount,
        handleAlreadyHaveAccount: showComingSoon,
        handleLearnMore,
    }
}
