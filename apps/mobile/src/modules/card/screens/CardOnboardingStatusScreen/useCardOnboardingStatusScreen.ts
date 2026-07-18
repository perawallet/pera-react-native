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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking } from 'react-native'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    FundingType,
    isKycSubmitted as isKycStateSubmitted,
    OnboardingStep,
    useCardStore,
    useConnectFundingSourceMutation,
    useOnboardingKycPoll,
    VerificationState,
} from '@perawallet/wallet-core-card'
import {
    useAllAccounts,
    useSelectedAccountAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useWebView } from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'
import {
    useAuthorizeCardDelegation,
    useCardErrorToast,
    useCardFundingDelegation,
    useCardFundingSourcePicker,
    useCardOnboardingLogout,
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
 * unmodelled/unfetched states surface the actionable 'unverified' row.
 */
const resolveDocumentsState = (
    isLoading: boolean,
    verificationState: Nullable<VerificationState>,
    hasPollTimedOut: boolean,
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
            return 'unverified'
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
    /** True while the connect-funding-source request is in flight. */
    isConnecting: boolean
    /** The funding type chosen on the final step (defaults to Auto). */
    selectedFundingType: FundingType
    /** Selects a funding type — local state until "Create Pera Card" commits it. */
    handleSelectFundingType: (type: FundingType) => void
    /** True when Auto can't be picked (kill-switch off, or account can't sign). */
    isAutoFundingUnavailable: boolean
    /** False when the auto-funding kill-switch is off — Auto is "coming soon". */
    isAutoFundingEnabled: boolean
    /** True while the auto-funding delegation is being signed and submitted. */
    isCreatingCard: boolean
    /** Persists the funding type and finishes onboarding (card creation deferred). */
    handleCreatePeraCard: () => void
    /** Continues to the personal-details step (allowed while Baanx reviews). */
    handleEnterDetails: () => void
    /** Resumes KYC from the unverified documents row (reopens the Veriff entry). */
    handleVerifyIdentity: () => void
    /** Recovers the documents-row error state (PENDING review) by re-polling. */
    handleRetryStatus: () => void
    /** Opens the account picker and links the chosen account as funding source. */
    handleConnectAccount: () => void
    handleLogout: () => void
    handleOpenSupport: () => void
}

export const useCardOnboardingStatusScreen =
    (): UseCardOnboardingStatusScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { successToast, errorToast } = useToast()
        const { pushWebView } = useWebView()
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

        const documentsState = resolveDocumentsState(
            isLoading,
            verificationState,
            hasPollTimedOut,
        )

        // Submitted (PENDING/VERIFIED) gates the later steps — the shared
        // predicate keeps this in lockstep with the sign-in resume route. Read
        // from the KYC state, not the row state, so a poll hiccup on a submitted
        // review (documentsState 'error') doesn't relock the step.
        const isKycSubmitted = isKycStateSubmitted(verificationState)

        // The documents row's "Verify your Account" CTA — resumes KYC by
        // reopening the Veriff entry screen.
        const handleVerifyIdentity = useCallback(() => {
            navigation.navigate('CardOnboardingVerification')
        }, [navigation])

        // Only reachable from the PENDING error row (repeated poll failures);
        // re-arm polling to wait for Baanx's decision again.
        const handleRetryStatus = useCallback(() => {
            restartPolling()
        }, [restartPolling])

        // The address step sets Completed, so it doubles as the "details done"
        // signal that unlocks the Connect Funds step.
        const isRegistrationComplete = useCardStore(
            state => state.onboardingStep === OnboardingStep.Completed,
        )
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

        const {
            mutateAsync: connectFundingSourceAsync,
            isPending: isConnecting,
        } = useConnectFundingSourceMutation()

        // Funding type is chosen locally and committed by "Create Pera Card".
        // Seed from the persisted choice (so a prior selection survives a
        // re-entry/cold resume); default to Auto to match the design.
        const [selectedFundingType, setSelectedFundingType] =
            useState<FundingType>(
                () =>
                    useCardStore.getState().selectedFundingType ??
                    FundingType.Auto,
            )
        const handleSelectFundingType = useCallback((type: FundingType) => {
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
            const address = selectedAccountAddress
            void (async () => {
                try {
                    await connectFundingSourceAsync({ address })
                } catch {
                    errorToast(
                        t('peraCard.setup_status.connect_error_title'),
                        t('peraCard.setup_status.connect_error_body'),
                    )
                }
            })()
        }, [
            autoConnectSelected,
            selectedAccountAddress,
            connectedAddress,
            setParams,
            connectFundingSourceAsync,
            errorToast,
            t,
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
            useCardStore
                .getState()
                .setOnboardingStep(OnboardingStep.PersonalDetails)
            navigation.navigate('CardOnboardingPersonalDetails')
        }, [navigation])

        const { pickFundingSource } = useCardFundingSourcePicker()
        const handleConnectAccount = useCallback(() => {
            void (async () => {
                const account = await pickFundingSource()
                if (!account) return
                try {
                    await connectFundingSourceAsync({
                        address: account.address,
                    })
                } catch {
                    errorToast(
                        t('peraCard.setup_status.connect_error_title'),
                        t('peraCard.setup_status.connect_error_body'),
                    )
                }
            })()
        }, [pickFundingSource, connectFundingSourceAsync, errorToast, t])

        const {
            delegateTo,
            canDelegate,
            isPending: isCreatingCard,
        } = useCardFundingDelegation()
        const { authorizeDelegation } = useAuthorizeCardDelegation()
        const showError = useCardErrorToast()
        const isAutoFundingEnabled = useIsCardAutoFundingEnabled()
        const isAutoFundingUnavailable =
            !isAutoFundingEnabled ||
            (connectedAccount != null && !canDelegate(connectedAccount))

        // A connected account that can't sign (e.g. Ledger) can't use Auto, so
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

        // One-shot guard so a fast double-tap can't fire the toast + navigation
        // twice before the screen unmounts; reset on failure so retry works.
        const hasCreatedRef = useRef(false)
        const createPeraCard = useCallback(async () => {
            if (hasCreatedRef.current) return
            hasCreatedRef.current = true
            // Auto funding only takes effect once Baanx holds the signed
            // delegation, so it is created here, before finishing onboarding.
            if (selectedFundingType === FundingType.Auto) {
                if (!connectedAccount) {
                    hasCreatedRef.current = false
                    await showError(null)
                    return
                }
                try {
                    // Consent + live PIN/biometric before signing the grant.
                    const authorized = await authorizeDelegation(
                        connectedAccount,
                        delegateTo,
                    )
                    if (!authorized) {
                        hasCreatedRef.current = false
                        return
                    }
                } catch (error) {
                    hasCreatedRef.current = false
                    await showError(error)
                    return
                }
            }
            useCardStore.getState().setSelectedFundingType(selectedFundingType)
            successToast(
                t('peraCard.setup_status.create_card_success_title'),
                t('peraCard.setup_status.create_card_success_body'),
            )
            // TODO(card): call the Baanx card-creation API and route to the card
            // dashboard once that slice lands; for now Home is the terminus.
            navigation.navigate('TabBar', { screen: 'Home' })
        }, [
            selectedFundingType,
            connectedAccount,
            delegateTo,
            authorizeDelegation,
            showError,
            successToast,
            navigation,
            t,
        ])
        const handleCreatePeraCard = useCallback(() => {
            void createPeraCard()
        }, [createPeraCard])

        const handleOpenSupport = useCallback(() => {
            if (!routeCapabilities.inAppWebView) {
                void Linking.openURL(config.supportBaseUrl)
                return
            }
            pushWebView({ url: config.supportBaseUrl, id: 'card-support' })
        }, [pushWebView])

        return {
            documentsState,
            isKycSubmitted,
            isRegistrationComplete,
            isFundsConnected,
            connectedAccount,
            connectedAddress,
            isConnecting,
            selectedFundingType,
            handleSelectFundingType,
            isAutoFundingUnavailable,
            isAutoFundingEnabled,
            isCreatingCard,
            handleCreatePeraCard,
            handleEnterDetails,
            handleVerifyIdentity,
            handleRetryStatus,
            handleConnectAccount,
            handleLogout,
            handleOpenSupport,
        }
    }
