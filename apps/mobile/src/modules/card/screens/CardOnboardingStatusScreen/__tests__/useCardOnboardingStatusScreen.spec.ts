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

import { renderHook, act } from '@test-utils/render'
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FundingType, OnboardingStep } from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockSetOnboardingStep = vi.fn()
const mockSetSelectedFundingType = vi.fn()
const mockConnectAsync = vi.fn()
const mockHandleCreateAccount = vi.fn()
let mockVerificationState: string | null = null
let mockQueryOptions: { refetchInterval?: number | false } | undefined
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
        useOnboardingDetailsQuery: (options: {
            refetchInterval?: number | false
        }) => {
            mockQueryOptions = options
            return {
                data: { verificationState: mockVerificationState },
                isLoading: false,
                refetch: vi.fn(),
            }
        },
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

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequest,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@modules/accounts/components/AccountMenuContent', () => ({
    AccountMenuContent: () => null,
}))

vi.mock('@modules/accounts/components/AccountSortContent', () => ({
    AccountSortContent: () => null,
}))

vi.mock('../ConnectAccountHeader', () => ({
    ConnectAccountHeader: () => null,
}))

const mockLogout = vi.fn()
vi.mock('@modules/card/hooks', () => ({
    useCardOnboardingLogout: () => ({ handleLogout: mockLogout }),
    useCardAddAccount: () => ({ handleCreateAccount: mockHandleCreateAccount }),
}))

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

let mockRouteParams: { autoConnectSelected?: boolean } | undefined
const mockSetParams = vi.fn()
vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
        useNavigation: () => ({ setParams: mockSetParams }),
    }
})

const mockSuccessToast = vi.fn()
const mockErrorToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: mockErrorToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { AccountSortContent } from '@modules/accounts/components/AccountSortContent'
import { useCardOnboardingStatusScreen } from '../useCardOnboardingStatusScreen'

const account = (
    address: string,
    type: WalletAccount['type'],
    extra: Partial<WalletAccount> = {},
): WalletAccount => ({ address, type, ...extra }) as WalletAccount

beforeEach(() => {
    vi.clearAllMocks()
    mockVerificationState = null
    mockQueryOptions = undefined
    mockOnboardingStep = OnboardingStep.Verification
    mockConnectedAddress = null
    mockStoredFundingType = null
    mockIsConnecting = false
    mockAccounts = []
    mockRouteParams = undefined
    mockSelectedAddress = null
})

describe('useCardOnboardingStatusScreen', () => {
    it('reports pending (and keeps polling) while Veriff reviews', () => {
        mockVerificationState = 'PENDING'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('pending')
        expect(mockQueryOptions?.refetchInterval).not.toBe(false)
    })

    it('reports verified and stops polling once the identity is confirmed', async () => {
        mockVerificationState = 'VERIFIED'
        const { result, rerender } = renderHook(() =>
            useCardOnboardingStatusScreen(),
        )

        expect(result.current.documentsState).toBe('verified')
        // The post-decision render disables the poll interval.
        act(() => rerender())
        expect(mockQueryOptions?.refetchInterval).toBe(false)
    })

    it('reports rejected when verification failed', () => {
        mockVerificationState = 'REJECTED'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('rejected')
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
        mockRequest.mockResolvedValue({
            kind: 'selected',
            account: account('ADDR1', 'hdWallet'),
        })
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
        mockRequest.mockResolvedValue({
            kind: 'selected',
            account: account('ADDR1', 'algo25'),
        })
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
    })

    it('runs the standard add-account flow when the add button is tapped', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockRequest.mockResolvedValue({ kind: 'add-account' })
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        await waitFor(() => expect(mockHandleCreateAccount).toHaveBeenCalled())
        expect(mockConnectAsync).not.toHaveBeenCalled()
    })

    it('opens the account menu with the card header and the funding-source filter', () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        const props = mockRequest.mock.calls[0][0].contents.props as {
            headerContent: unknown
            accountFilter: (account: WalletAccount) => boolean
            selectedAddress: string | null
        }
        // The "Choose Card account" header is passed via the existing prop.
        expect(props.headerContent).toBeTruthy()
        // Fresh pick: nothing connected yet → no account pre-highlighted.
        expect(props.selectedAddress).toBeNull()
        // Eligible: standard / HD / Ledger, non-rekeyed.
        expect(props.accountFilter(account('A', 'algo25'))).toBe(true)
        expect(props.accountFilter(account('B', 'hdWallet'))).toBe(true)
        expect(props.accountFilter(account('C', 'hardware'))).toBe(true)
        expect(props.accountFilter(account('D', 'watch'))).toBe(false)
        expect(props.accountFilter(account('E', 'multisig'))).toBe(false)
        expect(
            props.accountFilter(account('F', 'algo25', { rekeyAddress: 'X' })),
        ).toBe(false)
    })

    it('highlights the connected funding source when changing it', () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockConnectedAddress = 'ADDR1'
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        const props = mockRequest.mock.calls[0][0].contents.props as {
            selectedAddress: string | null
        }
        expect(props.selectedAddress).toBe('ADDR1')
    })

    it('opens the sort sheet then reopens the picker when Sort is tapped', async () => {
        mockOnboardingStep = OnboardingStep.Completed
        mockRequest
            .mockResolvedValueOnce({ kind: 'sort' }) // initial picker
            .mockResolvedValueOnce(undefined) // sort sheet
            .mockResolvedValueOnce(undefined) // reopened picker
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleConnectAccount()
        })

        await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(3))
        // The second request opens the account sort sheet.
        expect(mockRequest.mock.calls[1][0].contents.type).toBe(
            AccountSortContent,
        )
        expect(mockConnectAsync).not.toHaveBeenCalled()
        expect(mockHandleCreateAccount).not.toHaveBeenCalled()
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

    it('persists the funding type and finishes onboarding on Create Pera Card', () => {
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleSelectFundingType(FundingType.Manual)
        })
        act(() => {
            result.current.handleCreatePeraCard()
        })

        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Manual,
        )
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
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
