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

import React, { useCallback } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsMounted } from '@hooks/useIsMounted'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useModalState } from '@hooks/useModalState'
import { useIsOnboarding } from '@modules/onboarding/hooks'
import { useCreateAccount } from '@perawallet/wallet-core-accounts'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    ImportOptionsContent,
    type ImportOptionsContentResult,
} from '../../components/ImportOptionsContent'

type UseOnboardingScreenResult = {
    handleTermsPress: () => void
    handlePrivacyPress: () => void
    handleCreateAccount: () => void
    handleImportAccount: () => void
    isCreatingAccount: boolean
}

export const useOnboardingScreen = (): UseOnboardingScreenResult => {
    const navigation = useAppNavigation()
    const isMounted = useIsMounted()
    const { pushWebView } = useWebView()
    const {
        isOpen: isCreatingAccount,
        open: openCreatingAccount,
        close: closeCreatingAccount,
    } = useModalState()
    const { setIsOnboarding } = useIsOnboarding()
    const { createHdWalletAccount } = useCreateAccount()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()

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
        setIsOnboarding(true)
        openCreatingAccount()
        deferToNextCycle(async () => {
            try {
                const newAccount = await createHdWalletAccount({
                    account: 0,
                    keyIndex: 0,
                })
                if (!isMounted()) return
                navigation.push('NameAccount', { account: newAccount })
            } catch (error) {
                if (!isMounted()) return
                // guardrails-ignore-next-line no-error-toast-in-catch reason: localized create_account.error_message wraps the raw error; preserved verbatim
                showToast({
                    title: t('onboarding.create_account.error_title'),
                    body: t('onboarding.create_account.error_message', {
                        error: `${error}`,
                    }),
                    type: 'error',
                })
                setIsOnboarding(false)
            } finally {
                if (isMounted()) closeCreatingAccount()
            }
        })
    }, [
        isMounted,
        setIsOnboarding,
        openCreatingAccount,
        closeCreatingAccount,
        createHdWalletAccount,
        navigation,
        showToast,
        t,
    ])

    const handleImportAccount = useCallback(() => {
        setIsOnboarding(true)
        navigation.push('ImportAccountOptions')
    }, [navigation, setIsOnboarding])

    return {
        handleTermsPress,
        handlePrivacyPress,
        handleCreateAccount,
        handleImportAccount,
        isCreatingAccount,
    }
}
