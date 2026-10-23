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

import { useCallback, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    OnboardingStep,
    useCardSession,
    useCardStore,
    useOnboardingDetailsQuery,
    useOnboardingKycPoll,
    type FundingType,
} from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import {
    useCardOnboardingLogout,
    useCardOnboardingRouter,
    useOpenCardSupport,
} from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCardScope } from '../../hooks/useCardScope'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'
import { getOnboardingNextRoute } from '../../utils/onboardingRoute'
import { useFinishRegistrationOnVerified } from './useFinishRegistrationOnVerified'
import { resolveDocumentsState, type DocumentsState } from './documentsState'
import { useStatusFundingSource } from './useStatusFundingSource'
import { useStatusFundingType } from './useStatusFundingType'

export type UseCardOnboardingStatusScreenResult = {
    documentsState: DocumentsState
    /** Every form Baanx asks for is in, so KYC can start. */
    areDetailsSubmitted: boolean
    /** The account and session exist (KYC verified) — gates the later steps. */
    isRegistrationComplete: boolean
    /** A Pera account has been linked as the funding source. */
    isFundsConnected: boolean
    /** The connected account, resolved from the wallet (undefined if removed). */
    connectedAccount: Optional<WalletAccount>
    /** Persisted funding-source address; the display fallback when no account. */
    connectedAddress: Nullable<string>
    /** The funding type chosen on the final step (defaults to Auto). */
    selectedFundingType: FundingType
    /** Selects a funding type — local state until "Create Pera Card" commits it. */
    handleSelectFundingType: (type: FundingType) => void
    /** True when Auto can't be picked (kill-switch off, or account can't sign). */
    isAutoFundingUnavailable: boolean
    /** False when the auto-funding kill-switch is off — Auto is "coming soon". */
    isAutoFundingEnabled: boolean
    /** True when the connected account is a Ledger — Auto is unsupported there. */
    isLedgerAccount: boolean
    /** Navigates to the signing screen, which runs the actual create sequence. */
    handleCreatePeraCard: () => void
    /** Opens the form Baanx still expects. */
    handleEnterDetails: () => void
    /** Resumes KYC from the unverified documents row. */
    handleVerifyIdentity: () => void
    /** One login, while the account is being set up and the spacing allows. */
    canTryAgain: boolean
    handleTryAgain: () => void
    /** Recovers the documents-row error state (PENDING review) by re-polling. */
    handleRetryStatus: () => void
    /** Opens the account picker and links the chosen account as funding source. */
    handleConnectAccount: (source: 'connect' | 'change') => void
    handleLogout: () => void
    handleOpenSupport: () => void
}

export const useCardOnboardingStatusScreen =
    (): UseCardOnboardingStatusScreenResult => {
        const scope = useCardScope()
        const navigation = useAppNavigation()
        const { handleLogout } = useCardOnboardingLogout()
        const { goToNextStep } = useCardOnboardingRouter()
        const { isAuthenticated } = useCardSession()

        // The shared poll keeps the documents row live until a decision (or
        // gives up); only the initial in-flight fetch shows 'pending'.
        const {
            verificationState,
            isLoading,
            hasPollTimedOut,
            hasAccountSignal,
            restartPolling,
        } = useOnboardingKycPoll(scope)

        // Completed is written once the session exists, which Baanx only
        // allows after KYC verifies; it unlocks Connect Funds.
        const onboardingStep = useCardStore(state => state.onboardingStep)
        const isRegistrationComplete =
            onboardingStep === OnboardingStep.Completed
        const onboardingId = useCardStore(state => state.onboardingId)
        const storedCountryIso = useCardStore(state => state.countryIso)
        const hasContactVerificationId = useCardStore(
            state => state.contactVerificationId !== null,
        )
        const { data: onboardingRecord } = useOnboardingDetailsQuery(scope, {
            onboardingId,
            enabled: !isAuthenticated && !isRegistrationComplete,
        })
        const phase = onboardingRecord?.phase ?? null

        // The same router the forms use answers whether a form is still owed.
        const { screen: nextScreen } = getOnboardingNextRoute({
            phase,
            verificationState,
            // Another device or a reinstall holds no residence of its own.
            countryIso:
                storedCountryIso ??
                onboardingRecord?.countryOfResidence ??
                null,
            localStep: onboardingStep,
            hasSession: isAuthenticated,
            hasContactVerificationId,
        })
        const areDetailsSubmitted =
            nextScreen === 'CardOnboardingVerification' ||
            nextScreen === 'CardOnboardingStatus'

        const storedEmail = useCardStore(state => state.email)
        const {
            accountPreparation,
            isLoginLocked,
            canTryAgain,
            handleTryAgain,
        } = useFinishRegistrationOnVerified(scope, {
            hasAccountSignal,
            verificationState,
            isRegistrationComplete,
            isAuthenticated,
            email: onboardingRecord?.email ?? storedEmail ?? null,
        })

        const documentsState = resolveDocumentsState(
            isLoading,
            verificationState,
            hasPollTimedOut,
            isRegistrationComplete,
            areDetailsSubmitted,
            accountPreparation,
            isLoginLocked,
        )
        const isIdentityVerified =
            documentsState === 'verified' ||
            documentsState === 'preparing' ||
            documentsState === 'preparing-slow'

        const handleVerifyIdentity = useCallback(() => {
            trackEvent(CardEvent.CreateVerifyAccount)
            navigation.navigate('CardOnboardingVerification')
        }, [navigation])

        // Only reachable from the PENDING error row (repeated poll failures);
        // re-arm polling to wait for Baanx's decision again.
        const handleRetryStatus = useCallback(() => {
            restartPolling()
        }, [restartPolling])

        const stackNavigation =
            useNavigation<
                NativeStackNavigationProp<
                    CardOnboardingStackParamList,
                    'CardOnboardingStatus'
                >
            >()
        const {
            connectedAddress,
            isFundsConnected,
            connectedAccount,
            handleConnectAccount,
        } = useStatusFundingSource(scope)

        // Once KYC is approved this screen becomes the card hub, so a back
        // action (header arrow, swipe, or Android hardware back) exits to the
        // wallet home instead of returning into the onboarding flow. Forward
        // navigation (Enter Details, Create Pera Card) isn't a back action, so
        // it stays unaffected.
        useEffect(() => {
            if (!isIdentityVerified) return
            const unsubscribe = stackNavigation.addListener(
                'beforeRemove',
                event => {
                    const { type } = event.data.action
                    if (type !== 'GO_BACK' && type !== 'POP') return
                    event.preventDefault()
                    navigation.navigate('TabBar', { screen: 'Home' })
                },
            )
            return unsubscribe
        }, [isIdentityVerified, stackNavigation, navigation])

        const handleEnterDetails = useCallback(() => {
            goToNextStep({
                phase,
                localStep: onboardingStep,
                verificationState,
            })
        }, [goToNextStep, phase, onboardingStep, verificationState])

        const {
            selectedFundingType,
            handleSelectFundingType,
            isAutoFundingUnavailable,
            isAutoFundingEnabled,
            isConnectedLedger,
            handleCreatePeraCard,
        } = useStatusFundingType(scope, connectedAccount)

        const handleOpenSupport = useOpenCardSupport()

        return {
            documentsState,
            areDetailsSubmitted,
            isRegistrationComplete,
            isFundsConnected,
            connectedAccount,
            connectedAddress,
            selectedFundingType,
            handleSelectFundingType,
            isAutoFundingUnavailable,
            isAutoFundingEnabled,
            isLedgerAccount: isConnectedLedger,
            handleCreatePeraCard,
            handleEnterDetails,
            handleVerifyIdentity,
            handleRetryStatus,
            canTryAgain,
            handleTryAgain,
            handleConnectAccount,
            handleLogout,
            handleOpenSupport,
        }
    }
