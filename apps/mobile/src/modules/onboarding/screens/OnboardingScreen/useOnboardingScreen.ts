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
import { useModalState } from '@hooks/useModalState'

export const useOnboardingScreen = () => {
    const navigation = useAppNavigation()
    const { pushWebView } = useWebView()
    const {
        isOpen: isImportOptionsVisible,
        open: openImportOptions,
        close: closeImportOptions,
    } = useModalState()

    const handleTermsPress = useCallback(() => {
        pushWebView({
            url: config.termsOfServiceUrl,
            id: 'terms-of-service',
        })
    }, [pushWebView])

    const handlePrivacyPress = useCallback(() => {
        pushWebView({
            url: config.privacyPolicyUrl,
            id: 'privacy-policy',
        })
    }, [pushWebView])

    const handleCreateAccount = useCallback(() => {
        navigation.push('NameAccount')
    }, [navigation])

    const handleImportAccount = useCallback(() => {
        openImportOptions()
    }, [openImportOptions])

    const handleCloseImportOptions = useCallback(() => {
        closeImportOptions()
    }, [closeImportOptions])

    const handleUniversalWalletPress = useCallback(() => {
        closeImportOptions()
        navigation.push('ImportInfo')
    }, [closeImportOptions, navigation])

    const handleAlgo25Press = useCallback(() => {
        closeImportOptions()
        navigation.push('ImportInfo')
    }, [closeImportOptions, navigation])

    return {
        isImportOptionsVisible,
        handleTermsPress,
        handlePrivacyPress,
        handleCreateAccount,
        handleImportAccount,
        handleCloseImportOptions,
        handleUniversalWalletPress,
        handleAlgo25Press,
    }
}
