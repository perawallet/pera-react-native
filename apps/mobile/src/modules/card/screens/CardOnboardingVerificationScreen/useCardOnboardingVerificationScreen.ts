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

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import {
    useCardStore,
    useOnboardingDetailsQuery,
    useStartVerificationMutation,
    VerificationState,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { useWebView } from '@modules/webview'
import { useCardOnboardingLogout } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { isForegroundTransition } from '@utils/app-state'

/** How often we re-check `verificationState` while the user is in Veriff. */
const POLL_INTERVAL_MS = 4000

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
        const { pushWebView } = useWebView()
        const { handleLogout } = useCardOnboardingLogout()
        const onboardingId = useCardStore(state => state.onboardingId)
        // Polling starts only once a Veriff session has been opened.
        const [hasStarted, setHasStarted] = useState(false)

        const startVerification = useStartVerificationMutation()

        const onboardingDetails = useOnboardingDetailsQuery({
            onboardingId,
            enabled: hasStarted,
            refetchInterval: hasStarted ? POLL_INTERVAL_MS : false,
        })

        const handleVerify = useCallback(() => {
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
            startVerification
                .mutateAsync({ onboardingId })
                .then(({ sessionUrl }) => {
                    setHasStarted(true)
                    void Linking.openURL(sessionUrl)
                })
                .catch(() => {
                    errorToast(
                        t('peraCard.verification.error_title'),
                        t('peraCard.verification.error_body'),
                    )
                })
        }, [startVerification, onboardingId, errorToast, navigation, t])

        const handleOpenSupport = useCallback(() => {
            pushWebView({ url: config.supportBaseUrl, id: 'card-support' })
        }, [pushWebView])

        // Veriff reported back (submitted/decided): continue on the setup
        // status checklist. Abandoning the browser leaves the state UNVERIFIED
        // and the user here, with the button still re-tappable.
        const { verificationState } = onboardingDetails
        useEffect(() => {
            if (!hasStarted || !verificationState) return
            if (verificationState !== VerificationState.Unverified) {
                // Veriff reported back — hand off to the status checklist, which
                // takes over polling. Stop ours so it doesn't keep refetching in
                // the background while this screen sits in the stack.
                setHasStarted(false)
                navigation.navigate('CardOnboardingStatus')
            }
        }, [hasStarted, verificationState, navigation])

        // When the user returns from the Veriff browser, refetch immediately
        // rather than waiting for the next poll tick. Refs keep the listener
        // stable so it isn't re-subscribed on every render.
        const previousAppState = useRef<AppStateStatus>(AppState.currentState)
        const isPollingRef = useRef(hasStarted)
        isPollingRef.current = hasStarted
        const refetchRef = useRef(onboardingDetails.refetch)
        refetchRef.current = onboardingDetails.refetch
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
                        refetchRef.current()
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
