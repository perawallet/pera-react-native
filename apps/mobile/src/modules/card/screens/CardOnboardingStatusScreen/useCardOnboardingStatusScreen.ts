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

import {
    createElement,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    FundingType,
    OnboardingStep,
    useCardStore,
    useConnectFundingSourceMutation,
    useOnboardingDetailsQuery,
    VerificationState,
} from '@perawallet/wallet-core-card'
import {
    isAlgo25Account,
    isHardwareWalletAccount,
    isHDWalletAccount,
    isRekeyedAccount,
    useAllAccounts,
    useSelectedAccountAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    AccountMenuContent,
    type AccountMenuContentResult,
} from '@modules/accounts/components/AccountMenuContent'
import { AccountSortContent } from '@modules/accounts/components/AccountSortContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { useCardAddAccount, useCardOnboardingLogout } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'
import { ConnectAccountHeader } from './ConnectAccountHeader'

/** How often we re-check the KYC state while Veriff is still reviewing. */
const POLL_INTERVAL_MS = 4000

/** The "Submit Your Documents" checklist row's visual state. */
export type DocumentsState = 'pending' | 'verified' | 'rejected'

/**
 * Accounts eligible as the card's funding source: standard, HD, and Ledger
 * accounts that can sign — watch-only and multisig (by type) and any rekeyed
 * account are excluded, since they can't act as a funding source.
 */
const isEligibleFundingSource = (account: WalletAccount): boolean =>
    (isAlgo25Account(account) ||
        isHDWalletAccount(account) ||
        isHardwareWalletAccount(account)) &&
    !isRekeyedAccount(account)

export type UseCardOnboardingStatusScreenResult = {
    documentsState: DocumentsState
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
    /** Persists the funding type and finishes onboarding (card creation deferred). */
    handleCreatePeraCard: () => void
    /** Continues to the personal-details step (allowed while Baanx reviews). */
    handleEnterDetails: () => void
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
        const { request } = useBottomSheet()
        const { pushWebView } = useWebView()
        const { handleLogout } = useCardOnboardingLogout()
        const onboardingId = useCardStore(state => state.onboardingId)

        // You land here once Veriff has reported back (PENDING or a decision).
        // Poll while the review is still running so the row flips to
        // verified/rejected live; UNVERIFIED (cold resume) renders as pending.
        const [isReviewing, setIsReviewing] = useState(true)
        const { data } = useOnboardingDetailsQuery({
            onboardingId,
            refetchInterval: isReviewing ? POLL_INTERVAL_MS : false,
        })
        const verificationState = data?.verificationState ?? null

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
        const { handleCreateAccount } = useCardAddAccount()

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

        const handleConnectAccount = useCallback(() => {
            // Reuse the standard account menu as-is, customised only through its
            // existing props: a "Choose Card account" header (via headerContent)
            // and the eligible-funding-source filter. Tapping a row links it;
            // "+" runs the standard add-account flow; Sort opens the sort sheet
            // and reopens the picker.
            const openPicker = async (): Promise<void> => {
                const result = await request<AccountMenuContentResult>({
                    id: 'card-connect-funding-source',
                    contents: createElement(AccountMenuContent, {
                        headerContent: createElement(ConnectAccountHeader),
                        accountFilter: isEligibleFundingSource,
                        // Fresh on first connect (null → nothing highlighted);
                        // the connected source is highlighted on "Change".
                        selectedAddress: connectedAddress,
                    }),
                    options: {
                        size: 'full',
                        enablePanDownToClose: false,
                        enableContentPanningGesture: false,
                        autoCreateContainer: false,
                    },
                })
                if (!result) return
                switch (result.kind) {
                    case 'selected': {
                        try {
                            await connectFundingSourceAsync({
                                address: result.account.address,
                            })
                        } catch {
                            errorToast(
                                t('peraCard.setup_status.connect_error_title'),
                                t('peraCard.setup_status.connect_error_body'),
                            )
                        }
                        return
                    }
                    case 'add-account': {
                        handleCreateAccount()
                        return
                    }
                    case 'sort': {
                        await request<void>({
                            contents: createElement(AccountSortContent),
                            options: {
                                size: 'modal',
                                enablePanDownToClose: false,
                                enableContentPanningGesture: false,
                                autoCreateContainer: false,
                            },
                        })
                        // After sorting, reopen the picker so the user can choose.
                        void openPicker()
                        return
                    }
                    case 'search': {
                        return
                    }
                }
            }
            void openPicker()
        }, [
            request,
            connectFundingSourceAsync,
            handleCreateAccount,
            connectedAddress,
            errorToast,
            t,
        ])

        // One-shot guard so a fast double-tap can't fire the toast + navigation
        // twice before the screen unmounts.
        const hasCreatedRef = useRef(false)
        const handleCreatePeraCard = useCallback(() => {
            if (hasCreatedRef.current) return
            hasCreatedRef.current = true
            useCardStore.getState().setSelectedFundingType(selectedFundingType)
            successToast(
                t('peraCard.setup_status.create_card_success_title'),
                t('peraCard.setup_status.create_card_success_body'),
            )
            // TODO(card): call the Baanx card-creation API and route to the card
            // dashboard once that slice lands; for now Home is the terminus.
            navigation.navigate('TabBar', { screen: 'Home' })
        }, [selectedFundingType, successToast, navigation, t])

        const handleOpenSupport = useCallback(() => {
            pushWebView({ url: config.supportBaseUrl, id: 'card-support' })
        }, [pushWebView])

        return {
            documentsState,
            isRegistrationComplete,
            isFundsConnected,
            connectedAccount,
            connectedAddress,
            isConnecting,
            selectedFundingType,
            handleSelectFundingType,
            handleCreatePeraCard,
            handleEnterDetails,
            handleConnectAccount,
            handleLogout,
            handleOpenSupport,
        }
    }
