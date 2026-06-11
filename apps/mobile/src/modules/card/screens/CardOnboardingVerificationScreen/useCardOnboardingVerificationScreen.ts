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
    OnboardingStep,
    useCardStore,
    useCardUserQuery,
    useStartVerificationMutation,
    VerificationState,
} from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { isForegroundTransition } from '@utils/app-state'

/** How often we re-check `verificationState` while the user is in Veriff. */
const POLL_INTERVAL_MS = 4000

export const VerificationPhase = {
    Idle: 'IDLE', // not started — CTA opens Veriff
    Starting: 'STARTING', // fetching the session URL
    InProgress: 'IN_PROGRESS', // Veriff opened (or closed early); polling
    Submitted: 'SUBMITTED', // PENDING — submitted, Veriff still processing
    Verified: 'VERIFIED', // terminal success
    Rejected: 'REJECTED', // terminal failure
    Error: 'ERROR', // start failed — CTA retries
} as const
export type VerificationPhase =
    (typeof VerificationPhase)[keyof typeof VerificationPhase]

export type UseCardOnboardingVerificationScreenResult = {
    phase: VerificationPhase
    /** Start request in flight — disables the CTA and shows its spinner. */
    isBusy: boolean
    /** Starts (Idle), re-opens with a fresh session (InProgress), or retries (Error). */
    handleStartVerification: () => void
    /** Leaves onboarding from a terminal state (submitted/rejected/verified). */
    handleDone: () => void
}

export const useCardOnboardingVerificationScreen =
    (): UseCardOnboardingVerificationScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { successToast } = useToast()
        const [phase, setPhase] = useState<VerificationPhase>(
            VerificationPhase.Idle,
        )

        const startVerification = useStartVerificationMutation()

        const isPolling = phase === VerificationPhase.InProgress
        const userQuery = useCardUserQuery({
            enabled: isPolling,
            refetchInterval: isPolling ? POLL_INTERVAL_MS : false,
        })

        const handleStartVerification = useCallback(() => {
            setPhase(VerificationPhase.Starting)
            // The session URL is single-use/time-limited, so "Continue" and
            // "Try again" both fetch a fresh one rather than reopening the old.
            startVerification
                .mutateAsync()
                .then(({ sessionUrl }) => {
                    setPhase(VerificationPhase.InProgress)
                    void Linking.openURL(sessionUrl)
                })
                .catch(() => {
                    setPhase(VerificationPhase.Error)
                })
        }, [startVerification])

        const handleDone = useCallback(() => {
            navigation.navigate('PeraCardIntro')
        }, [navigation])

        // React to the polled verificationState while the user is mid-flow.
        const verificationState = userQuery.data?.verificationState
        useEffect(() => {
            if (phase !== VerificationPhase.InProgress || !verificationState) {
                return
            }
            switch (verificationState) {
                case VerificationState.Verified: {
                    useCardStore
                        .getState()
                        .setOnboardingStep(OnboardingStep.Completed)
                    setPhase(VerificationPhase.Verified)
                    successToast(
                        t('peraCard.verification.success_title'),
                        t('peraCard.verification.success_body'),
                    )
                    // TODO(card): route into card creation once that slice lands.
                    navigation.navigate('PeraCardIntro')
                    break
                }
                case VerificationState.Pending: {
                    setPhase(VerificationPhase.Submitted)
                    break
                }
                case VerificationState.Rejected: {
                    setPhase(VerificationPhase.Rejected)
                    break
                }
                default: {
                    // Unverified — keep polling.
                    break
                }
            }
        }, [phase, verificationState, navigation, successToast, t])

        // When the user returns from the Veriff browser, refetch immediately
        // rather than waiting for the next poll tick. Refs keep the listener
        // stable so it isn't re-subscribed on every render.
        const previousAppState = useRef<AppStateStatus>(AppState.currentState)
        const isPollingRef = useRef(isPolling)
        isPollingRef.current = isPolling
        const refetchRef = useRef(userQuery.refetch)
        refetchRef.current = userQuery.refetch
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
            phase,
            isBusy: phase === VerificationPhase.Starting,
            handleStartVerification,
            handleDone,
        }
    }
