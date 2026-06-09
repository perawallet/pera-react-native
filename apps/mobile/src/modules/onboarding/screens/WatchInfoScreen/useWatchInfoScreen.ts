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
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { trackEvent, OnboardingEvent } from '@analytics'

type UseWatchInfoScreenResult = {
    handleCreateWatchAccount: () => void
    handleInfoPress: () => void
}

export const useWatchInfoScreen = (): UseWatchInfoScreenResult => {
    const navigation = useAppNavigation()
    const { pushWebView } = useWebView()

    const handleCreateWatchAccount = useCallback(() => {
        trackEvent(OnboardingEvent.CreateAccountWatch)
        navigation.push('WatchAccount')
    }, [navigation])

    const handleInfoPress = useCallback(() => {
        pushWebView({ url: config.watchAccountSupportUrl })
    }, [pushWebView])

    return {
        handleCreateWatchAccount,
        handleInfoPress,
    }
}
