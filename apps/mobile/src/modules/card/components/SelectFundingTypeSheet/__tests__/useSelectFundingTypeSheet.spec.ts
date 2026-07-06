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

import { renderHook } from '@test-utils/render'
import { act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FundingType } from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { passThroughAuthorizeDelegation } from '@test-utils/cardDelegation'

const mockSetSelectedFundingType = vi.fn()
let mockStoredFundingType: FundingType | null = null
let mockConnectedAddress: string | null = null
let mockHasActiveDelegation = false

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: Object.assign(
            (
                selector: (state: {
                    selectedFundingType: FundingType | null
                    connectedFundingSourceAddress: string | null
                }) => unknown,
            ) =>
                selector({
                    selectedFundingType: mockStoredFundingType,
                    connectedFundingSourceAddress: mockConnectedAddress,
                }),
            {
                getState: () => ({
                    selectedFundingType: mockStoredFundingType,
                    setSelectedFundingType: mockSetSelectedFundingType,
                }),
            },
        ),
        useCardExternalWalletsQuery: () => ({
            delegatedWallet: null,
            hasActiveDelegation: mockHasActiveDelegation,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        }),
    }
})

let mockAccounts: WalletAccount[] = []
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => mockAccounts,
}))

const mockResolve = vi.fn()
const mockDismiss = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: mockResolve,
        dismiss: mockDismiss,
    }),
}))

const mockDelegateTo = vi.fn()
const mockCancelDelegation = vi.fn()
const mockCanDelegate = vi.fn()
const mockShowCardError = vi.fn()
// By default the gate passes through to the delegate fn, so existing Auto
// tests still observe the delegation; tests that exercise a declined
// consent/PIN override it to resolve false.
const mockAuthorizeDelegation = vi.fn(passThroughAuthorizeDelegation)
vi.mock('../../../hooks', () => ({
    useCardErrorToast: () => mockShowCardError,
    useCardFundingDelegation: () => ({
        delegateTo: mockDelegateTo,
        cancelDelegation: mockCancelDelegation,
        isPending: false,
        canDelegate: mockCanDelegate,
    }),
    useAuthorizeCardDelegation: () => ({
        authorizeDelegation: mockAuthorizeDelegation,
    }),
}))

const mockSuccessToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

let mockIsAutoFundingEnabled = true
vi.mock('@hooks/useIsCardAutoFundingEnabled', () => ({
    useIsCardAutoFundingEnabled: () => mockIsAutoFundingEnabled,
}))

import { useSelectFundingTypeSheet } from '../useSelectFundingTypeSheet'

const connectedAccount = {
    address: 'ADDR1',
    type: 'algo25',
    keyPairId: 'key-1',
} as unknown as WalletAccount

describe('useSelectFundingTypeSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStoredFundingType = FundingType.Manual
        mockConnectedAddress = 'ADDR1'
        mockHasActiveDelegation = false
        mockAccounts = [connectedAccount]
        mockDelegateTo.mockResolvedValue(undefined)
        mockCancelDelegation.mockResolvedValue(undefined)
        mockCanDelegate.mockReturnValue(true)
        mockIsAutoFundingEnabled = true
        mockAuthorizeDelegation.mockImplementation(
            passThroughAuthorizeDelegation,
        )
    })

    it('seeds the selection from the stored funding type', () => {
        mockStoredFundingType = FundingType.Auto
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.selectedType).toBe(FundingType.Auto)
    })

    it('treats an unset funding type as Manual, matching the details row', () => {
        mockStoredFundingType = null
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.selectedType).toBe(FundingType.Manual)
    })

    it('dismisses without any call when applying with no change', async () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onApply()
        })

        await waitFor(() => expect(mockDismiss).toHaveBeenCalled())
        expect(mockDelegateTo).not.toHaveBeenCalled()
        expect(mockCancelDelegation).not.toHaveBeenCalled()
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
    })

    it('delegates then persists when switching Manual → Auto', async () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onSelectType(FundingType.Auto)
        })
        act(() => {
            result.current.onApply()
        })

        await waitFor(() =>
            expect(mockDelegateTo).toHaveBeenCalledWith(connectedAccount),
        )
        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Auto,
        )
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockResolve).toHaveBeenCalledWith('applied')
    })

    it('cancels the delegation when switching Auto → Manual', async () => {
        mockStoredFundingType = FundingType.Auto
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        // Seeded to Auto; switch to Manual and apply.
        act(() => {
            result.current.onSelectType(FundingType.Manual)
        })
        act(() => {
            result.current.onApply()
        })

        await waitFor(() =>
            expect(mockCancelDelegation).toHaveBeenCalledWith(connectedAccount),
        )
        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Manual,
        )
    })

    it('dismisses on Auto → Auto while the delegation is live', async () => {
        mockStoredFundingType = FundingType.Auto
        mockHasActiveDelegation = true
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onApply()
        })

        await waitFor(() => expect(mockDismiss).toHaveBeenCalled())
        expect(mockDelegateTo).not.toHaveBeenCalled()
    })

    it('re-delegates on Auto → Auto when no delegation is live (recovery)', async () => {
        mockStoredFundingType = FundingType.Auto
        mockHasActiveDelegation = false
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onApply()
        })

        await waitFor(() =>
            expect(mockDelegateTo).toHaveBeenCalledWith(connectedAccount),
        )
        expect(mockDismiss).not.toHaveBeenCalled()
    })

    it('keeps the sheet open and skips the store write on failure', async () => {
        mockDelegateTo.mockRejectedValue(new Error('baanx down'))
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onSelectType(FundingType.Auto)
        })
        act(() => {
            result.current.onApply()
        })

        await waitFor(() => expect(mockShowCardError).toHaveBeenCalled())
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
        expect(mockResolve).not.toHaveBeenCalled()
        expect(mockDismiss).not.toHaveBeenCalled()
    })

    it('disables the Auto option when the connected account cannot sign', () => {
        mockCanDelegate.mockReturnValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.isAutoDisabled).toBe(true)
    })

    it('falls back from a seeded Auto to Manual when the account cannot sign', () => {
        mockStoredFundingType = FundingType.Auto
        mockCanDelegate.mockReturnValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.isAutoDisabled).toBe(true)
        // The seeded Auto selection migrates to Manual so Apply can't dead-end
        // trying to sign a delegation the account can't produce.
        expect(result.current.selectedType).toBe(FundingType.Manual)
    })

    it('routes the Auto grant through the consent + auth gate', async () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onSelectType(FundingType.Auto)
        })
        act(() => {
            result.current.onApply()
        })

        await waitFor(() =>
            expect(mockAuthorizeDelegation).toHaveBeenCalledWith(
                connectedAccount,
                expect.any(Function),
            ),
        )
    })

    it('keeps the sheet open and skips persisting when authorization is declined', async () => {
        mockAuthorizeDelegation.mockResolvedValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onSelectType(FundingType.Auto)
        })
        act(() => {
            result.current.onApply()
        })

        await waitFor(() => expect(mockAuthorizeDelegation).toHaveBeenCalled())
        expect(mockDelegateTo).not.toHaveBeenCalled()
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
        expect(mockResolve).not.toHaveBeenCalled()
        expect(mockDismiss).not.toHaveBeenCalled()
    })

    it('disables Auto when the kill-switch flag is off', () => {
        mockIsAutoFundingEnabled = false
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.isAutoDisabled).toBe(true)
        expect(result.current.isAutoFundingEnabled).toBe(false)
    })

    it('migrates a seeded Auto to Manual when the kill-switch flag is off', () => {
        mockStoredFundingType = FundingType.Auto
        mockIsAutoFundingEnabled = false
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.selectedType).toBe(FundingType.Manual)
    })

    it('applies Manual without signing a cancel for a non-signing account', async () => {
        // Stale Auto persisted while the connected account is a Ledger.
        mockStoredFundingType = FundingType.Auto
        mockCanDelegate.mockReturnValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => {
            result.current.onApply()
        })

        await waitFor(() =>
            expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
                FundingType.Manual,
            ),
        )
        // A Ledger can't hold a delegation, so there's nothing to cancel and no
        // signing prompt — Apply resolves instead of dead-ending on an error.
        expect(mockCancelDelegation).not.toHaveBeenCalled()
        expect(mockDelegateTo).not.toHaveBeenCalled()
        expect(mockResolve).toHaveBeenCalledWith('applied')
    })
})
