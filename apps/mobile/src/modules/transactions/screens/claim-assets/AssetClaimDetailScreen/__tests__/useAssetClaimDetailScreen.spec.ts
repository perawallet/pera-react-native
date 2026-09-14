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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useAssetClaimDetailScreen } from '../useAssetClaimDetailScreen'

const mockPush = vi.fn()
const mockNavigate = vi.fn()
const mockShowToast = vi.fn()
const mockErrorToast = vi.fn()

let mockAssetRequests: unknown[] = []

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        assetRequests: mockAssetRequests,
        accountAddress: 'ACCOUNT_ADDR',
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [{ address: 'ACCOUNT_ADDR', name: 'Main' }],
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mockPush, navigate: mockNavigate }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: { assetIndex: 0 } }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: vi.fn() }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: vi.fn() }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast, errorToast: mockErrorToast }),
}))

const buildRequest = (
    overrides: {
        insufficientAlgoForClaiming?: boolean
        shouldUseFundsBeforeClaiming?: boolean
        insufficientAlgoForRejecting?: boolean
        shouldUseFundsBeforeRejecting?: boolean
    } = {},
) => ({
    id: '123',
    inboxAddress: 'INBOX_ADDR',
    totalAmount: new Decimal(5),
    asset: { assetId: '123', decimals: 0, name: 'TEST' },
    usdValue: null,
    microAlgoGainOnClaim: new Decimal(0),
    microAlgoGainOnReject: new Decimal(0),
    senders: { count: 0, results: [] },
    insufficientAlgoForClaiming: false,
    insufficientAlgoForRejecting: false,
    shouldUseFundsBeforeClaiming: false,
    shouldUseFundsBeforeRejecting: false,
    ...overrides,
})

describe('useAssetClaimDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAssetRequests = [buildRequest()]
    })

    it('does not block a claim the account can afford', () => {
        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isClaimBlocked).toBe(false)
    })

    it('blocks the claim when the account cannot cover the opt-in', () => {
        mockAssetRequests = [
            buildRequest({ insufficientAlgoForClaiming: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isClaimBlocked).toBe(true)
    })

    it('does not block when the inbox funds cover the opt-in', () => {
        mockAssetRequests = [
            buildRequest({
                insufficientAlgoForClaiming: true,
                shouldUseFundsBeforeClaiming: true,
            }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isClaimBlocked).toBe(false)

        act(() => {
            result.current.handleClaim()
        })

        expect(mockPush).toHaveBeenCalledWith('Messages', {
            screen: 'ClaimProcessing',
            params: {
                mode: 'claimArc59',
                assetIndex: 0,
                shouldClaimAlgo: true,
            },
        })
    })

    it('blocks the reject when the account cannot cover its fee', () => {
        mockAssetRequests = [
            buildRequest({ insufficientAlgoForRejecting: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isRejectBlocked).toBe(true)
        expect(result.current.isClaimBlocked).toBe(false)
    })

    it('does not block the reject when the inbox funds cover the fee', () => {
        mockAssetRequests = [
            buildRequest({
                insufficientAlgoForRejecting: true,
                shouldUseFundsBeforeRejecting: true,
            }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isRejectBlocked).toBe(false)
    })

    it('sends the user to the fund tab to cover the shortfall', () => {
        mockAssetRequests = [
            buildRequest({ insufficientAlgoForClaiming: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        act(() => {
            result.current.handleAddFunds()
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Fund' })
    })

    it('never navigates to processing while the claim is blocked', () => {
        mockAssetRequests = [
            buildRequest({ insufficientAlgoForClaiming: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        act(() => {
            result.current.handleClaim()
        })

        expect(mockPush).not.toHaveBeenCalled()
        expect(mockShowToast).toHaveBeenCalled()
    })
})
