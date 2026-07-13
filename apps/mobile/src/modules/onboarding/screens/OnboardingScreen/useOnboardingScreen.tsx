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
import { Platform } from 'react-native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsMounted } from '@hooks/useIsMounted'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useModalState } from '@hooks/useModalState'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useIsOnboarding } from '@modules/onboarding/hooks'
import { useTermsAcceptance } from '../../hooks/useTermsAcceptance'
import { TermsAndConditionsSheet } from '../../components/TermsAndConditionsSheet'
import { useCreateAccount } from '@perawallet/wallet-core-accounts'
import { trackEvent, OnboardingEvent } from '@analytics'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

type UseOnboardingScreenResult = {
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
    const { buildHdWalletAccount } = useCreateAccount()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()
    const { needsAcceptance } = useTermsAcceptance()

    // Terms & Conditions gate. Deferred until the user actually starts onboarding
    // (create or import) rather than auto-popping on mount. Returns whether the
    // user may proceed. The sheet is blocking (no close, not dismissable) and
    // only resolves `true` via "I Agree", so a falsy result means "don't
    // proceed". Skipped entirely once the current terms version is accepted.
    const ensureTermsAccepted = useCallback(async (): Promise<boolean> => {
        // Terms gate deferred on web for M2 (human-approved): the native terms sheet
        // crashes in the extension environment and silently auto-accepting fabricates
        // consent. M3 ships a web terms screen; no acceptance record is written here.
        if (Platform.OS === 'web') return true
        if (!needsAcceptance) return true
        const accepted = await requestBottomSheet<boolean>({
            contents: <TermsAndConditionsSheet />,
            options: {
                size: 'modal',
                // Drag-to-close is allowed: dismissing without agreeing just
                // cancels this action, and the gate re-appears next time the
                // user taps create/import. Backdrop-close stays off (a stricter
                // affordance than the explicit drag handle). There is no close
                // button in the header.
                enablePanDownToClose: true,
                enableCloseOnBackdropPress: false,
                // Fill the sheet (definite height) so the PWScreen body/webview
                // gets real height and the footer pins to the bottom instead of
                // the content collapsing to its intrinsic size.
                autoCreateContainer: false,
            },
        })
        return accepted === true
    }, [needsAcceptance, requestBottomSheet])

    const handlePrivacyPress = useCallback(() => {
        pushWebView({
            url: config.privacyPolicyUrl,
            id: 'privacy-policy',
        })
    }, [pushWebView])

    const handleCreateAccount = useCallback(() => {
        void (async () => {
            if (!(await ensureTermsAccepted())) return
            trackEvent(OnboardingEvent.CreateNewWallet)
            setIsOnboarding(true)
            openCreatingAccount()
            await deferToNextCycle(async () => {
                try {
                    const newAccount = await buildHdWalletAccount({
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
        })()
    }, [
        ensureTermsAccepted,
        isMounted,
        setIsOnboarding,
        openCreatingAccount,
        closeCreatingAccount,
        buildHdWalletAccount,
        navigation,
        showToast,
        t,
    ])

    const handleImportAccount = useCallback(() => {
        void (async () => {
            if (!(await ensureTermsAccepted())) return
            trackEvent(OnboardingEvent.ImportAccount)
            setIsOnboarding(true)
            navigation.push('ImportAccountOptions')
        })()
    }, [ensureTermsAccepted, navigation, setIsOnboarding])

    return {
        handlePrivacyPress,
        handleCreateAccount,
        handleImportAccount,
        isCreatingAccount,
    }
}
