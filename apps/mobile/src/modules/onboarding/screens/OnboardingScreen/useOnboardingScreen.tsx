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

import { useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
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

    // Synchronous re-entrancy latch shared by create + import. The button's
    // `disabled` prop is driven by React state (`isCreatingAccount`), which only
    // updates a tick later and after an `await`, so a fast double-tap fires both
    // handlers before the disable renders and pushes the next screen twice. A
    // ref flips synchronously on the first tap, so the second bails in the same
    // tick. Reset on focus so returning via back re-enables onboarding.
    const isStartingRef = useRef(false)
    useFocusEffect(
        useCallback(() => {
            isStartingRef.current = false
        }, []),
    )

    // Terms & Conditions gate. Deferred until the user actually starts onboarding
    // (create or import) rather than auto-popping on mount. Returns whether the
    // user may proceed. The sheet is blocking (no close, not dismissable) and
    // only resolves `true` via "I Agree", so a falsy result means "don't
    // proceed". Skipped entirely once the current terms version is accepted.
    const ensureTermsAccepted = useCallback(async (): Promise<boolean> => {
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
        if (isStartingRef.current) return
        isStartingRef.current = true
        void (async () => {
            if (!(await ensureTermsAccepted())) {
                isStartingRef.current = false
                return
            }
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
                    // Nothing was pushed; release so the user can retry.
                    isStartingRef.current = false
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
        if (isStartingRef.current) return
        isStartingRef.current = true
        void (async () => {
            if (!(await ensureTermsAccepted())) {
                isStartingRef.current = false
                return
            }
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
