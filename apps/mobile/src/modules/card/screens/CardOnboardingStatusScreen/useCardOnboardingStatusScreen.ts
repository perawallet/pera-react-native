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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    FundingType,
    isKycSubmitted as isKycStateSubmitted,
    OnboardingStep,
    useCardStore,
    useOnboardingKycPoll,
    VerificationState,
} from '@perawallet/wallet-core-card'
import {
    isLedgerAccount,
    useAllAccounts,
    useSelectedAccountAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import {
    canAutoFund,
    useCardFundingSourcePicker,
    useCardOnboardingLogout,
    useEscrowCardCreation,
    useOpenCardSupport,
    isSigningCapableFundingSource,
} from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsCardAutoFundingEnabled } from '@hooks/useIsCardAutoFundingEnabled'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'

/**
 * The "Submit Your Documents" checklist row's visual state.
 * - `unverified`: KYC not submitted yet (or state unknown) — the user must
 *   still complete Veriff; the later steps stay locked.
 * - `pending`: submitted and under review — Baanx reviews async, so the later
 *   steps unlock.
 */
export type DocumentsState =
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'rejected'
    | 'error'

/**
 * Maps the polled KYC state to the documents row. Loading shows a neutral
 * pending row (no actionable CTA) so a cold entry can't flash "verify" at an
 * already-decided user. Only a submitted-but-unconfirmed review (PENDING) that
 * the poll gave up on escalates to the retry 'error' row; UNVERIFIED and
 * unmodelled/unfetched states surface the actionable 'unverified' row —
 * UNLESS registration has already completed. The KYC verification step is
 * only reachable before Personal Details/Address, so `Completed` is itself
 * proof documents were already submitted and decided; this makes the screen
 * re-entrant when the poll has no data (e.g. `onboardingId` was lost on a
 * cold resume) instead of wrongly asking an already-approved user to redo it.
 */
const resolveDocumentsState = (
    isLoading: boolean,
    verificationState: Nullable<VerificationState>,
    hasPollTimedOut: boolean,
    isRegistrationComplete: boolean,
): DocumentsState => {
    if (isLoading) return 'pending'
    switch (verificationState) {
        case VerificationState.Verified: {
            return 'verified'
        }
        case VerificationState.Rejected: {
            return 'rejected'
        }
        case VerificationState.Pending: {
            return hasPollTimedOut ? 'error' : 'pending'
        }
        default: {
            return isRegistrationComplete ? 'verified' : 'unverified'
        }
    }
}

export type UseCardOnboardingStatusScreenResult = {
    documentsState: DocumentsState
    /**
     * KYC is submitted (PENDING under review, or VERIFIED) — the only states
     * that unlock the details/address step. UNVERIFIED, rejected, and unknown
     * states keep it locked behind the "verify" prompt.
     */
    isKycSubmitted: boolean
    /** Registration (details + address) is finalized — gates the later steps. */
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
    /** Continues to the personal-details step (allowed while Baanx reviews). */
    handleEnterDetails: () => void
    /** Resumes KYC from the unverified documents row (reopens the Veriff entry). */
    handleVerifyIdentity: () => void
    /** Recovers the documents-row error state (PENDING review) by re-polling. */
    handleRetryStatus: () => void
    /** Opens the account picker and links the chosen account as funding source. */
    handleConnectAccount: (source: 'connect' | 'change') => void
    handleLogout: () => void
    handleOpenSupport: () => void
}

export const useCardOnboardingStatusScreen =
    (): UseCardOnboardingStatusScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { handleLogout } = useCardOnboardingLogout()

        // You land here once Veriff has reported back (PENDING or a decision).
        // The shared poll keeps the row live until a decision (or gives up);
        // UNVERIFIED (cold resume) and unmodelled states render the actionable
        // 'unverified' row, and only the initial in-flight fetch shows 'pending'.
        const {
            verificationState,
            isLoading,
            hasPollTimedOut,
            restartPolling,
        } = useOnboardingKycPoll()

        // The address step sets Completed, so it doubles as the "details done"
        // signal that unlocks the Connect Funds step — and as proof documents
        // were already submitted (see resolveDocumentsState).
        const isRegistrationComplete = useCardStore(
            state => state.onboardingStep === OnboardingStep.Completed,
        )

        const documentsState = resolveDocumentsState(
            isLoading,
            verificationState,
            hasPollTimedOut,
            isRegistrationComplete,
        )

        // Submitted (PENDING/VERIFIED) gates the later steps — the shared
        // predicate keeps this in lockstep with the sign-in resume route. Read
        // from the KYC state, not the row state, so a poll hiccup on a submitted
        // review (documentsState 'error') doesn't relock the step.
        const isKycSubmitted = isKycStateSubmitted(verificationState)

        // The documents row's "Verify your Account" CTA — resumes KYC by
        // reopening the Veriff entry screen.
        const handleVerifyIdentity = useCallback(() => {
            trackEvent(CardEvent.CreateVerifyAccount)
            navigation.navigate('CardOnboardingVerification')
        }, [navigation])

        // Only reachable from the PENDING error row (repeated poll failures);
        // re-arm polling to wait for Baanx's decision again.
        const handleRetryStatus = useCallback(() => {
            restartPolling()
        }, [restartPolling])

        const connectedAddress = useCardStore(
            state => state.connectedFundingSourceAddress,
        )
        const isFundsConnected = connectedAddress !== null

        const accounts = useAllAccounts()
        const connectedAccount = useMemo<Optional<WalletAccount>>(
            () =>
                accounts.find(account => account.address === connectedAddress),
            [accounts, connectedAddress],
        )

        // Funding type is chosen locally and committed by the creation of an lsig.
        // Seed from the persisted choice (so a prior selection survives a
        // re-entry/cold resume); default to Auto to match the design.
        const [selectedFundingType, setSelectedFundingType] =
            useState<FundingType>(
                () =>
                    useCardStore.getState().selectedFundingType ??
                    FundingType.Auto,
            )
        const handleSelectFundingType = useCallback((type: FundingType) => {
            trackEvent(
                type === FundingType.Auto
                    ? CardEvent.CreateCardAutoFunding
                    : CardEvent.CreateCardManualFunding,
            )
            setSelectedFundingType(type)
        }, [])

        // After the add-account flow finishes it returns here with this one-shot
        // flag; the new account is the globally selected one, so link it as the
        // funding source.
        const route =
            useRoute<
                RouteProp<CardOnboardingStackParamList, 'CardOnboardingStatus'>
            >()
        const autoConnectSelected = route.params?.autoConnectSelected ?? false
        const stackNavigation =
            useNavigation<
                NativeStackNavigationProp<
                    CardOnboardingStackParamList,
                    'CardOnboardingStatus'
                >
            >()
        const { setParams } = stackNavigation
        const { selectedAccountAddress } = useSelectedAccountAddress()

        useEffect(() => {
            if (
                !autoConnectSelected ||
                !selectedAccountAddress ||
                selectedAccountAddress === connectedAddress
            ) {
                return
            }
            // Consume the one-shot flag so it can't re-fire on later focuses.
            setParams({ autoConnectSelected: undefined })
            // Purely local, the card gets created and linked to this account by the Pera backend
            useCardStore
                .getState()
                .setConnectedFundingSourceAddress(selectedAccountAddress)
        }, [
            autoConnectSelected,
            selectedAccountAddress,
            connectedAddress,
            setParams,
        ])

        // Once KYC is approved this screen becomes the card hub, so a back
        // action (header arrow, swipe, or Android hardware back) exits to the
        // wallet home instead of returning into the onboarding flow. Forward
        // navigation (Enter Details, Create Pera Card) isn't a back action, so
        // it stays unaffected.
        useEffect(() => {
            if (documentsState !== 'verified') return
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
        }, [documentsState, stackNavigation, navigation])

        const handleEnterDetails = useCallback(() => {
            // Defence in depth: the CTA is already hidden unless KYC is
            // submitted, but a future entry point (or a state flip between
            // render and tap) must not persist a step Baanx will refuse.
            if (!isKycSubmitted) {
                handleVerifyIdentity()
                return
            }
            useCardStore
                .getState()
                .setOnboardingStep(OnboardingStep.PersonalDetails)
            navigation.navigate('CardOnboardingPersonalDetails')
        }, [isKycSubmitted, handleVerifyIdentity, navigation])

        // Onboarding creation always needs a signature, so only offer accounts
        // that can sign (excludes Ledger, which is otherwise fundable).
        const { pickFundingSource } = useCardFundingSourcePicker({
            accountFilter: isSigningCapableFundingSource,
        })
        const handleConnectAccount = useCallback(
            (source: 'connect' | 'change') => {
                trackEvent(
                    source === 'change'
                        ? CardEvent.CreateCardChangeAccount
                        : CardEvent.CreateConnectWallet,
                )
                void (async () => {
                    const account = await pickFundingSource()
                    if (!account) return
                    trackEvent(CardEvent.CreateVerifyAccountSelect)
                    // Purely local, the card gets created and linked to this account by the Pera backend
                    useCardStore
                        .getState()
                        .setConnectedFundingSourceAddress(account.address)
                })()
            },
            [pickFundingSource],
        )

        // Only `canCreateCard` is needed here — the actual creation sequence
        // (sign → create → optional LSig) now runs on CardCreateSigningScreen.
        const { canCreateCard } = useEscrowCardCreation()
        const isAutoFundingEnabled = useIsCardAutoFundingEnabled()
        // Auto availability keys off the auto-funding capability (LSig signing),
        // NOT card creation: Ledger will create cards once ARC-60 lands but can
        // never sign the AutoDraw LSig, so Auto must stay disabled for it.
        const isConnectedLedger =
            connectedAccount != null && isLedgerAccount(connectedAccount)
        const isAutoFundingUnavailable =
            !isAutoFundingEnabled ||
            (connectedAccount != null && !canAutoFund(connectedAccount))

        // A connected account that can't sign an LSig (e.g. Ledger) can't use Auto, so
        // fall back to Manual. Without this the Auto option stays selected but
        // disabled, and "Create Pera Card" dead-ends trying to sign a
        // delegation the account can't produce.
        useEffect(() => {
            if (
                isAutoFundingUnavailable &&
                selectedFundingType === FundingType.Auto
            ) {
                setSelectedFundingType(FundingType.Manual)
            }
        }, [isAutoFundingUnavailable, selectedFundingType])

        // Both paths sign (ARC-60 for creation; +LSig for Auto), so a
        // signing-capable connected account is required before handing off to
        // the signing screen, which runs the actual create sequence.
        const handleCreatePeraCard = useCallback(() => {
            trackEvent(CardEvent.CreateCard)
            if (!connectedAccount || !canCreateCard(connectedAccount)) {
                errorToast(
                    t('peraCard.setup_status.create_card_account_error_title'),
                    t('peraCard.setup_status.create_card_account_error_body'),
                )
                return
            }
            navigation.navigate('CardOnboardingSigning', {
                fundingType: selectedFundingType,
            })
        }, [
            connectedAccount,
            canCreateCard,
            errorToast,
            navigation,
            selectedFundingType,
            t,
        ])

        const handleOpenSupport = useOpenCardSupport()

        return {
            documentsState,
            isKycSubmitted,
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
            handleConnectAccount,
            handleLogout,
            handleOpenSupport,
        }
    }
