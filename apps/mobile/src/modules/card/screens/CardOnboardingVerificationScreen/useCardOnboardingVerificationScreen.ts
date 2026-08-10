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

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import {
    useCardStore,
    useOnboardingKycPoll,
    useStartVerificationMutation,
    VerificationState,
} from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import {
    useCardErrorToast,
    useCardOnboardingLogout,
    useOpenCardSupport,
} from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { isForegroundTransition } from '@utils/app-state'

export type UseCardOnboardingVerificationScreenResult = {
    /** Start request in flight — disables the CTA and shows its spinner. */
    isBusy: boolean
    /** Opens the Veriff session in the system browser and starts polling. */
    handleVerify: () => void
    handleLogout: () => void
    handleOpenSupport: () => void
}

export const useCardOnboardingVerificationScreen =
    (): UseCardOnboardingVerificationScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.verification.error_title',
            bodyKey: 'peraCard.verification.error_body',
        })
        const { handleLogout } = useCardOnboardingLogout()
        const onboardingId = useCardStore(state => state.onboardingId)
        // Polling starts only once a Veriff session has been opened.
        const [hasStarted, setHasStarted] = useState(false)
        // Pause the 4 s poll while another screen covers this one; the
        // AppState listener below already refetches on refocus-from-Veriff.
        const isFocused = useIsFocused()

        const startVerification = useStartVerificationMutation()

        const {
            verificationState,
            isStateUnknown,
            hasPollTimedOut,
            restartPolling,
            refetch,
        } = useOnboardingKycPoll({ enabled: hasStarted && isFocused })

        const handleVerify = useCallback(() => {
            trackEvent(CardEvent.CreateSubmitDocs)
            // Set by email/verify; if missing, re-verify rather than start a
            // KYC session with an empty onboarding id.
            if (onboardingId === null) {
                errorToast(
                    t('peraCard.verification.error_title'),
                    t('peraCard.verification.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            // The session URL is single-use/time-limited, so every tap fetches
            // a fresh one rather than reopening the old.
            const startKyc = async () => {
                try {
                    const { sessionUrl } = await startVerification.mutateAsync({
                        onboardingId,
                    })
                    // Guard before opening: a malformed/unopenable session URL
                    // must not arm the status poll — nothing was opened, so
                    // there is nothing to wait for.
                    const canOpen =
                        sessionUrl.startsWith('https://') &&
                        (await Linking.canOpenURL(sessionUrl))
                    if (!canOpen) {
                        errorToast(
                            t('peraCard.verification.error_title'),
                            t('peraCard.verification.open_link_error_body'),
                        )
                        return
                    }
                    await Linking.openURL(sessionUrl)
                    // A retry after a give-up starts a fresh session, so the
                    // poll budget starts over too.
                    restartPolling()
                    setHasStarted(true)
                } catch (error) {
                    await showError(error)
                }
            }
            void startKyc()
        }, [
            startVerification,
            onboardingId,
            errorToast,
            showError,
            restartPolling,
            navigation,
            t,
        ])

        const handleOpenSupport = useOpenCardSupport()

        // Veriff reported back (submitted/decided — including a state we don't
        // model): continue on the setup status checklist. Abandoning the
        // browser leaves the state UNVERIFIED and the user here, with the
        // button still re-tappable.
        useEffect(() => {
            if (!hasStarted) return
            const hasReportedBack =
                isStateUnknown ||
                (verificationState !== null &&
                    verificationState !== VerificationState.Unverified)
            if (!hasReportedBack) return
            // Hand off to the status checklist, which takes over polling. Stop
            // ours so it doesn't keep refetching in the background while this
            // screen sits in the stack.
            setHasStarted(false)
            navigation.navigate('CardOnboardingStatus')
        }, [hasStarted, verificationState, isStateUnknown, navigation])

        // The poll gave up waiting for Veriff to report back (repeated failures,
        // or a still-processing/abandoned session). Hand off to the setup
        // checklist rather than stranding the user here with a hard error: the
        // checklist keeps polling (so a late PENDING still lands automatically)
        // and, if the session really was abandoned, shows the "verify" row —
        // without forcing a fresh Veriff session the way a re-tap here would.
        useEffect(() => {
            if (!hasStarted || !hasPollTimedOut) return
            setHasStarted(false)
            navigation.navigate('CardOnboardingStatus')
        }, [hasStarted, hasPollTimedOut, navigation])

        // When the user returns from the Veriff browser, refetch immediately
        // rather than waiting for the next poll tick. Refs keep the listener
        // stable so it isn't re-subscribed on every render.
        const previousAppState = useRef<AppStateStatus>(AppState.currentState)
        const isPollingRef = useRef(hasStarted)
        isPollingRef.current = hasStarted
        const refetchRef = useRef(refetch)
        refetchRef.current = refetch
        useEffect(() => {
            const subscription = AppState.addEventListener(
                'change',
                nextAppState => {
                    const wasForeground = isForegroundTransition(
                        previousAppState.current,
                        nextAppState,
                    )
                    previousAppState.current = nextAppState
                    if (isPollingRef.current && wasForeground) {
                        void refetchRef.current()
                    }
                },
            )
            return () => subscription.remove()
        }, [])

        return {
            isBusy: startVerification.isPending,
            handleVerify,
            handleLogout,
            handleOpenSupport,
        }
    }
