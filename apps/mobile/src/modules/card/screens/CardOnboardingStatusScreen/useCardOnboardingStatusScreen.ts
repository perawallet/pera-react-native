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

import { useCallback, useEffect, useState } from 'react'
import {
    OnboardingStep,
    useCardStore,
    useOnboardingDetailsQuery,
    VerificationState,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { useWebView } from '@modules/webview'
import { useCardOnboardingLogout } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'

/** How often we re-check the KYC state while Veriff is still reviewing. */
const POLL_INTERVAL_MS = 4000

/** The "Submit Your Documents" checklist row's visual state. */
export type DocumentsState = 'pending' | 'verified' | 'rejected'

export type UseCardOnboardingStatusScreenResult = {
    documentsState: DocumentsState
    /** Continues to the personal-details step (allowed while Baanx reviews). */
    handleEnterDetails: () => void
    handleLogout: () => void
    handleOpenSupport: () => void
}

export const useCardOnboardingStatusScreen =
    (): UseCardOnboardingStatusScreenResult => {
        const navigation = useAppNavigation()
        const { pushWebView } = useWebView()
        const { handleLogout } = useCardOnboardingLogout()
        const onboardingId = useCardStore(state => state.onboardingId)

        // You land here once Veriff has reported back (PENDING or a decision).
        // Poll while the review is still running so the row flips to
        // verified/rejected live; UNVERIFIED (cold resume) renders as pending.
        const [isReviewing, setIsReviewing] = useState(true)
        const { verificationState } = useOnboardingDetailsQuery({
            onboardingId,
            refetchInterval: isReviewing ? POLL_INTERVAL_MS : false,
        })

        const documentsState: DocumentsState =
            verificationState === VerificationState.Verified
                ? 'verified'
                : verificationState === VerificationState.Rejected
                  ? 'rejected'
                  : 'pending'

        // Stop polling once Veriff has decided.
        useEffect(() => {
            setIsReviewing(documentsState === 'pending')
        }, [documentsState])

        const handleEnterDetails = useCallback(() => {
            useCardStore
                .getState()
                .setOnboardingStep(OnboardingStep.PersonalDetails)
            navigation.navigate('CardOnboardingPersonalDetails')
        }, [navigation])

        const handleOpenSupport = useCallback(() => {
            pushWebView({ url: config.supportBaseUrl, id: 'card-support' })
        }, [pushWebView])

        return {
            documentsState,
            handleEnterDetails,
            handleLogout,
            handleOpenSupport,
        }
    }
