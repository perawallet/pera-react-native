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

import { renderHook, act } from '@test-utils/render'
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FundingType, OnboardingStep } from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { passThroughAuthorizeDelegation } from '@test-utils/cardDelegation'

const mockSetOnboardingStep = vi.fn()
const mockSetSelectedFundingType = vi.fn()
const mockConnectAsync = vi.fn()
const mockPickFundingSource = vi.fn()
const mockCreateCard = vi.fn()
const mockCanCreateCard = vi.fn()
// Hoisted so the `@modules/card/hooks` mock factory (hoisted above imports) can
// reference it without a temporal-dead-zone error.
const { mockCanAutoFund } = vi.hoisted(() => ({ mockCanAutoFund: vi.fn() }))
const mockRequirePin = vi.fn()
let mockVerificationState: string | null = null
let mockOnboardingStep: OnboardingStep = OnboardingStep.Verification
let mockConnectedAddress: string | null = null
let mockStoredFundingType: FundingType | null = null
let mockIsConnecting = false

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        // The poll mechanics (give-up limits, restart) are unit-tested in the
        // card package's useOnboardingKycPoll.test — here only the wiring matters.
        useOnboardingKycPoll: () => ({
            verificationState: mockVerificationState,
            isStateUnknown: mockIsStateUnknown,
            isLoading: mockIsLoading,
            hasPollTimedOut: mockHasPollTimedOut,
            restartPolling: mockRestartPolling,
            refetch: vi.fn(),
        }),
        useConnectFundingSourceMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockConnectAsync,
            isPending: mockIsConnecting,
            isError: false,
            isSuccess: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardStore: Object.assign(
            (
                selector: (state: {
                    onboardingId: string | null
                    onboardingStep: OnboardingStep
                    connectedFundingSourceAddress: string | null
                }) => unknown,
            ) =>
                selector({
                    onboardingId: 'mock-onboarding-id',
                    onboardingStep: mockOnboardingStep,
                    connectedFundingSourceAddress: mockConnectedAddress,
                }),
            {
                getState: () => ({
                    selectedFundingType: mockStoredFundingType,
                    setOnboardingStep: mockSetOnboardingStep,
                    setConnectedFundingSourceAddress: vi.fn(),
                    setSelectedFundingType: mockSetSelectedFundingType,
                }),
            },
        ),
    }
})

// Keep the real account-type helpers (they read `type`/`rekeyAddress` off the
// account) and only stub the accounts list so the eligibility filter is real.
let mockAccounts: WalletAccount[] = []
let mockSelectedAddress: string | null = null
vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () => mockAccounts,
        useSelectedAccountAddress: () => ({
            selectedAccountAddress: mockSelectedAddress,
            setSelectedAccountAddress: vi.fn(),
        }),
    }
})

const mockLogout = vi.fn()
const mockShowCardError = vi.fn()
let mockHasPollTimedOut = false
let mockIsStateUnknown = false
let mockIsLoading = false
const mockRestartPolling = vi.fn()
// Passes through to the delegate fn by default so existing Auto tests still
// observe the delegation; the declined-authorization test overrides it.
const mockAuthorizeDelegation = vi.fn(passThroughAuthorizeDelegation)
vi.mock('@modules/card/hooks', () => ({
    useCardOnboardingLogout: () => ({ handleLogout: mockLogout }),
    useCardErrorToast: () => mockShowCardError,
    useCardFundingSourcePicker: () => ({
        pickFundingSource: mockPickFundingSource,
    }),
    useEscrowCardCreation: () => ({
        createCard: mockCreateCard,
        canCreateCard: mockCanCreateCard,
        isPending: false,
    }),
    useAuthorizeCardDelegation: () => ({
        authorizeDelegation: mockAuthorizeDelegation,
    }),
    // The picker's account filter is exercised elsewhere; here it just needs
    // to be a function the screen can pass through.
    isSigningCapableFundingSource: () => true,
    canAutoFund: mockCanAutoFund,
}))

vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mockRequirePin,
    }),
}))

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

const mockOpenURL = vi.fn()
vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    }
})

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped (inAppWebView: true) and web-shaped (false) route capability
// maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

let mockRouteParams: { autoConnectSelected?: boolean } | undefined
const mockSetParams = vi.fn()

type BeforeRemoveEvent = {
    data: { action: { type: string } }
    preventDefault: () => void
}
let mockBeforeRemoveCallback: ((event: BeforeRemoveEvent) => void) | null = null
const mockAddListener = vi.fn(
    (event: string, callback: (e: BeforeRemoveEvent) => void) => {
        if (event === 'beforeRemove') mockBeforeRemoveCallback = callback
        return vi.fn() // unsubscribe
    },
)
vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
        useNavigation: () => ({
            setParams: mockSetParams,
            addListener: mockAddListener,
        }),
    }
})

const mockSuccessToast = vi.fn()
const mockErrorToast = vi.fn()
const mockInfoToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

let mockIsAutoFundingEnabled = true
vi.mock('@hooks/useIsCardAutoFundingEnabled', () => ({
    useIsCardAutoFundingEnabled: () => mockIsAutoFundingEnabled,
}))

import { useCardOnboardingStatusScreen } from '../useCardOnboardingStatusScreen'

const account = (
    address: string,
    type: WalletAccount['type'],
    extra: Partial<WalletAccount> = {},
): WalletAccount => ({ address, type, ...extra }) as WalletAccount

beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockCapabilities, { inAppWebView: true })
    mockVerificationState = null
    mockHasPollTimedOut = false
    mockIsStateUnknown = false
    mockIsLoading = false
    mockOnboardingStep = OnboardingStep.Verification
    mockConnectedAddress = null
    mockStoredFundingType = null
    mockIsConnecting = false
    mockAccounts = []
    mockRouteParams = undefined
    mockSelectedAddress = null
    mockBeforeRemoveCallback = null
    mockPickFundingSource.mockResolvedValue(null)
    // createCard echoes the requested funding type (no LSig degradation).
    mockCreateCard.mockImplementation(
        async (_account: WalletAccount, fundingType: FundingType) => ({
            cardAddress: 'ESCROW_CARD',
            fundingType,
            autoFundingDegraded: false,
        }),
    )
    mockCanCreateCard.mockReturnValue(true)
    mockCanAutoFund.mockReturnValue(true)
    mockRequirePin.mockResolvedValue(true)
    mockIsAutoFundingEnabled = true
    mockAuthorizeDelegation.mockImplementation(passThroughAuthorizeDelegation)
})

describe('useCardOnboardingStatusScreen', () => {
    it('reports pending while Veriff reviews', () => {
        mockVerificationState = 'PENDING'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('pending')
    })

    it('reports verified once the identity is confirmed', () => {
        mockVerificationState = 'VERIFIED'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('verified')
    })

    it('reports rejected when verification failed', () => {
        mockVerificationState = 'REJECTED'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('rejected')
    })

    it('reports unverified when the KYC was never submitted', () => {
        // The bug: an abandoned KYC (UNVERIFIED) used to render as "pending"
        // (submitted). It must be its own actionable state instead.
        mockVerificationState = 'UNVERIFIED'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('unverified')
    })

    it('reports unverified while the KYC state is unknown', () => {
        mockVerificationState = null
        mockIsStateUnknown = true
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('unverified')
    })

    it('shows a neutral pending row (no verify CTA) while the state is still loading', () => {
        // A cold entry (e.g. a REJECTED sign-in resume) must not flash the
        // "verify" prompt before the first fetch lands.
        mockVerificationState = null
        mockIsLoading = true
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('pending')
        expect(result.current.isKycSubmitted).toBe(false)
    })

    it('keeps an unsubmitted KYC actionable even after the poll gives up', () => {
        // The give-up signal must not turn an unsubmitted KYC into the retry
        // "error" row — the right action is still "verify your account".
        mockVerificationState = 'UNVERIFIED'
        mockHasPollTimedOut = true
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('unverified')
    })

    it('sends the verify CTA to the KYC entry screen', () => {
        mockVerificationState = 'UNVERIFIED'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleVerifyIdentity()
        })

        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingVerification')
    })

    it('unlocks the details step only once KYC is submitted (PENDING/VERIFIED)', () => {
        mockVerificationState = 'UNVERIFIED'
        const { result, rerender } = renderHook(() =>
            useCardOnboardingStatusScreen(),
        )
        expect(result.current.isKycSubmitted).toBe(false)

        mockVerificationState = 'PENDING'
        act(() => rerender())
        expect(result.current.isKycSubmitted).toBe(true)

        mockVerificationState = 'VERIFIED'
        act(() => rerender())
        expect(result.current.isKycSubmitted).toBe(true)

        mockVerificationState = 'REJECTED'
        act(() => rerender())
        expect(result.current.isKycSubmitted).toBe(false)
    })

    it('keeps the details step unlocked when a submitted review poll errors', () => {
        // documentsState becomes 'error' on a PENDING poll failure, but the
        // user has still submitted — the step must stay unlocked.
        mockVerificationState = 'PENDING'
        mockHasPollTimedOut = true
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('error')
        expect(result.current.isKycSubmitted).toBe(true)
    })

    it('redirects a back action to the wallet home once KYC is verified', () => {
        mockVerificationState = 'VERIFIED'
        renderHook(() => useCardOnboardingStatusScreen())

        expect(mockBeforeRemoveCallback).not.toBeNull()
        const preventDefault = vi.fn()
        act(() => {
            mockBeforeRemoveCallback?.({
                data: { action: { type: 'GO_BACK' } },
                preventDefault,
            })
        })

        expect(preventDefault).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('leaves forward navigation untouched while KYC is verified', () => {
        mockVerificationState = 'VERIFIED'
        renderHook(() => useCardOnboardingStatusScreen())

        const preventDefault = vi.fn()
        act(() => {
            mockBeforeRemoveCallback?.({
                data: { action: { type: 'NAVIGATE' } },
                preventDefault,
            })
        })

        expect(preventDefault).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('keeps the default back behavior while KYC is not yet verified', () => {
        mockVerificationState = 'PENDING'
        renderHook(() => useCardOnboardingStatusScreen())

        // No back interceptor is registered, so back falls through to default.
        expect(mockBeforeRemoveCallback).toBeNull()
    })

    describe('timed-out poll handling', () => {
        it('flips a reviewing (PENDING) row to error when the poll gives up', () => {
            // Only a submitted-but-unconfirmed (PENDING) review that stops
            // responding becomes the retry "error" row.
            mockVerificationState = 'PENDING'
            mockHasPollTimedOut = true
            const { result } = renderHook(() => useCardOnboardingStatusScreen())

            expect(result.current.documentsState).toBe('error')
        })

        it('restarts polling on retry after failures', () => {
            mockVerificationState = 'PENDING'
            mockHasPollTimedOut = true
            const { result } = renderHook(() => useCardOnboardingStatusScreen())

            act(() => {
                result.current.handleRetryStatus()
            })

            expect(mockRestartPolling).toHaveBeenCalled()
            expect(mockNavigate).not.toHaveBeenCalled()
        })
    })

    it('continues to personal details and advances the stored step', () => {
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleEnterDetails()
        })

        expect(mockSetOnboardingStep).toHaveBeenCalledWith(
            OnboardingStep.PersonalDetails,
        )
        expect(mockNavigate).toHaveBeenCalledWith(
            'CardOnboardingPersonalDetails',
        )
    })

    it('marks registration complete only at the Completed step', () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingStatusScreen(),
        )
        expect(result.current.isRegistrationComplete).toBe(false)

        mockOnboardingStep = OnboardingStep.Completed
        act(() => rerender())
        expect(result.current.isRegistrationComplete).toBe(true)
    })

    it('resolves the connected funding source from the wallet', () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'algo25', { name: 'Spending' })]
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.isFundsConnected).toBe(true)
        expect(result.current.connectedAccount?.address).toBe('ADDR1')
    })

    it('connects the chosen account and persists it via the mutation', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectAsync.mockResolvedValue({ fundingSourceId: 'fs_1' })
        mockPickFundingSource.mockResolvedValue(account('ADDR1', 'hdWallet'))
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        await waitFor(() =>
            expect(mockConnectAsync).toHaveBeenCalledWith({
                address: 'ADDR1',
            }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('shows an error toast when connecting the account fails', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectAsync.mockRejectedValue(new Error('nope'))
        mockPickFundingSource.mockResolvedValue(account('ADDR1', 'algo25'))
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
    })

    it('does nothing when the picker resolves without an account', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockPickFundingSource.mockResolvedValue(null)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        await act(async () => {})
        expect(mockConnectAsync).not.toHaveBeenCalled()
    })

    it('seeds the funding type from the persisted store on mount', () => {
        mockStoredFundingType = FundingType.Manual
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.selectedFundingType).toBe(FundingType.Manual)
    })

    it('defaults the funding type to Auto and lets the user change it', () => {
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.selectedFundingType).toBe(FundingType.Auto)

        act(() => {
            result.current.handleSelectFundingType(FundingType.Manual)
        })

        expect(result.current.selectedFundingType).toBe(FundingType.Manual)
    })

    it('creates the card via the Manual path (PIN, no delegation) on Create Pera Card', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        const connected = account('ADDR1', 'algo25')
        mockAccounts = [connected]
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleSelectFundingType(FundingType.Manual)
        })
        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() =>
            expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
                FundingType.Manual,
            ),
        )
        // Manual still signs the ownership proof, gated by PIN — but no
        // delegation consent sheet.
        expect(mockRequirePin).toHaveBeenCalled()
        expect(mockCreateCard).toHaveBeenCalledWith(
            connected,
            FundingType.Manual,
        )
        expect(mockAuthorizeDelegation).not.toHaveBeenCalled()
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('rejects Create when there is no signing-capable connected account', async () => {
        // No funds connected → creation can't sign the ownership proof.
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleSelectFundingType(FundingType.Manual)
        })
        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.setup_status.create_card_account_error_title',
                'peraCard.setup_status.create_card_account_error_body',
            ),
        )
        expect(mockCreateCard).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('rejects Create for a connected account that cannot sign (e.g. Ledger)', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'hardware')]
        mockCanCreateCard.mockReturnValue(false)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockCreateCard).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('cancels cleanly and allows retry when the Manual PIN gate is declined', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'algo25')]
        mockRequirePin.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleSelectFundingType(FundingType.Manual)
        })
        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() => expect(mockRequirePin).toHaveBeenCalled())
        expect(mockCreateCard).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()

        // The one-shot guard reset on decline so a retry can go through.
        act(() => {
            result.current.handleCreatePeraCard()
        })
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            }),
        )
    })

    it('creates the card through the consent + auth gate when Auto is selected', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        const connected = account('ADDR1', 'algo25')
        mockAccounts = [connected]
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() =>
            expect(mockAuthorizeDelegation).toHaveBeenCalledWith(
                connected,
                expect.any(Function),
            ),
        )
        // The gate's delegate callback creates the card with Auto funding.
        expect(mockCreateCard).toHaveBeenCalledWith(connected, FundingType.Auto)
        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Auto,
        )
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('stays on the screen and allows retry when card creation fails', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'algo25')]
        mockCreateCard.mockRejectedValueOnce(new Error('escrow down'))
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() => expect(mockShowCardError).toHaveBeenCalled())
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()

        // The one-shot guard resets on failure so a retry can go through.
        act(() => {
            result.current.handleCreatePeraCard()
        })
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            }),
        )
    })

    it('shows the degraded info toast and persists Manual when Auto downgrades', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        const connected = account('ADDR1', 'algo25')
        mockAccounts = [connected]
        // The card is created but the LSig leg failed → Manual, degraded.
        mockCreateCard.mockResolvedValueOnce({
            cardAddress: 'ESCROW_CARD',
            fundingType: FundingType.Manual,
            autoFundingDegraded: true,
        })
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() =>
            expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
                FundingType.Manual,
            ),
        )
        expect(mockInfoToast).toHaveBeenCalledWith(
            'peraCard.setup_status.auto_funding_degraded_title',
            'peraCard.setup_status.auto_funding_degraded_body',
        )
        expect(mockSuccessToast).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('stays on the screen and allows retry when authorization is declined', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'algo25')]
        mockAuthorizeDelegation.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleCreatePeraCard()
        })

        await waitFor(() => expect(mockAuthorizeDelegation).toHaveBeenCalled())
        expect(mockCreateCard).not.toHaveBeenCalled()
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()

        // The one-shot guard reset on decline so a retry can go through.
        act(() => {
            result.current.handleCreatePeraCard()
        })
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            }),
        )
    })

    it('flags auto funding unavailable when the connected account cannot sign', () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'hardware')]
        mockCanAutoFund.mockReturnValue(false)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.isAutoFundingUnavailable).toBe(true)
    })

    it('falls back from Auto to Manual when the connected account cannot sign', () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'hardware')]
        mockCanAutoFund.mockReturnValue(false)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        // Auto is impossible for a non-signing account, so the default Auto
        // selection migrates to Manual instead of staying stuck on the
        // disabled Auto option.
        expect(result.current.selectedFundingType).toBe(FundingType.Manual)
    })

    it('disables Auto for a Ledger account even when it can create a card', () => {
        // Auto availability is decoupled from card creation: once ARC-60 lets
        // Ledger create a card (canCreateCard true), Auto must stay disabled
        // because Ledger can never sign the AutoDraw LSig (canAutoFund false).
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [
            account('ADDR1', 'hardware', {
                hardwareDetails: { manufacturer: 'ledger' },
            } as Partial<WalletAccount>),
        ]
        mockCanCreateCard.mockReturnValue(true)
        mockCanAutoFund.mockReturnValue(false)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.isLedgerAccount).toBe(true)
        expect(result.current.isAutoFundingUnavailable).toBe(true)
        expect(result.current.selectedFundingType).toBe(FundingType.Manual)
    })

    it('flags auto funding unavailable when the kill-switch flag is off', () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'algo25')]
        mockIsAutoFundingEnabled = false
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.isAutoFundingUnavailable).toBe(true)
        expect(result.current.isAutoFundingEnabled).toBe(false)
    })

    it('migrates the Auto default to Manual when the kill-switch flag is off', () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockAccounts = [account('ADDR1', 'algo25')]
        mockIsAutoFundingEnabled = false
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.selectedFundingType).toBe(FundingType.Manual)
    })

    it('wires logout and the support link', () => {
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleLogout()
            result.current.handleOpenSupport()
        })

        expect(mockLogout).toHaveBeenCalled()
        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'card-support' }),
        )
        expect(mockOpenURL).not.toHaveBeenCalled()
    })

    it('opens support in a browser tab when inAppWebView is off (web)', () => {
        Object.assign(mockCapabilities, { inAppWebView: false })
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleOpenSupport()
        })

        expect(mockOpenURL).toHaveBeenCalledWith(config.supportBaseUrl)
        expect(mockPushWebView).not.toHaveBeenCalled()
    })

    describe('auto-connect after add-account', () => {
        it('connects the selected account on return with the flag, then clears it', async () => {
            mockRouteParams = { autoConnectSelected: true }
            mockSelectedAddress = 'NEW_ADDR'
            mockConnectAsync.mockResolvedValue(undefined)

            renderHook(() => useCardOnboardingStatusScreen())

            await waitFor(() =>
                expect(mockConnectAsync).toHaveBeenCalledWith({
                    address: 'NEW_ADDR',
                }),
            )
            expect(mockSetParams).toHaveBeenCalledWith({
                autoConnectSelected: undefined,
            })
        })

        it('does nothing without the flag', async () => {
            mockRouteParams = undefined
            mockSelectedAddress = 'NEW_ADDR'

            renderHook(() => useCardOnboardingStatusScreen())

            await act(async () => {})
            expect(mockConnectAsync).not.toHaveBeenCalled()
        })

        it('does nothing when the selected account is already connected', async () => {
            mockRouteParams = { autoConnectSelected: true }
            mockSelectedAddress = 'ADDR1'
            mockConnectedAddress = 'ADDR1'

            renderHook(() => useCardOnboardingStatusScreen())

            await act(async () => {})
            expect(mockConnectAsync).not.toHaveBeenCalled()
        })
    })
})
