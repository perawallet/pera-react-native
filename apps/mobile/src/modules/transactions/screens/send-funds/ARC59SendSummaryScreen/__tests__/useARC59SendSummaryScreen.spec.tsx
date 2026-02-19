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

import { renderHook, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { useARC59SendSummaryScreen } from '../useARC59SendSummaryScreen'
import { useSendFunds } from '@modules/transactions/hooks'

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()
const mockReplace = vi.fn()
const mockHasPreference = vi.fn()
const mockSetPreference = vi.fn()
const mockSetArc59Summary = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        hasPreference: mockHasPreference,
        setPreference: mockSetPreference,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({
        address: 'SENDERADDR',
    })),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useArc59SendSummaryQuery: vi.fn(() => ({
        summary: null,
        isLoading: true,
    })),
    useAccountInformationQuery: vi.fn(() => ({
        data: { amount: 10_000_000n, minBalance: 100_000n },
    })),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

const mockSummary = {
    is_arc59_opted_in: false,
    minimum_balance_requirement: 0.1,
    inner_tx_count: 4,
    total_protocol_and_mbr_fee: 0.3,
    inbox_address: 'INBOXADDR',
    algo_fund_amount: 300000,
    warning_message: null,
}

describe('useARC59SendSummaryScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHasPreference.mockReturnValue(true)
        ;(useSendFunds as Mock).mockReturnValue({
            selectedAsset: { assetId: 123 },
            destination: 'RECEIVERADDR',
            amount: '50',
            setArc59Summary: mockSetArc59Summary,
        })
    })

    it('returns loading state when query is loading', () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        expect(result.current.isLoading).toBe(true)
    })

    it('navigates to TransactionProcessing on handleSend', () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleSend()

        expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
    })

    it('goes back on handleClose', () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleClose()

        expect(mockGoBack).toHaveBeenCalled()
    })

    it('sets warning visible on handleReadMore', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleReadMore()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(true)
        })
    })

    it('saves preference and hides warning on handleWarningConfirm', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleReadMore()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(true)
        })

        result.current.handleWarningConfirm()

        expect(mockSetPreference).toHaveBeenCalledWith(
            'has-seen-arc59-warning',
            'true',
        )
        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(false)
        })
    })

    it('hides warning on handleWarningClose without saving preference', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleReadMore()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(true)
        })

        result.current.handleWarningClose()

        expect(mockSetPreference).not.toHaveBeenCalled()
        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(false)
        })
    })

    it('formats fee from summary', async () => {
        const { useArc59SendSummaryQuery } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        ;(useArc59SendSummaryQuery as Mock).mockReturnValue({
            summary: mockSummary,
            isLoading: false,
        })

        const { result } = renderHook(() => useARC59SendSummaryScreen())

        expect(result.current.formattedFee).toBe('0.30')
        expect(result.current.isLoading).toBe(false)
    })
})
