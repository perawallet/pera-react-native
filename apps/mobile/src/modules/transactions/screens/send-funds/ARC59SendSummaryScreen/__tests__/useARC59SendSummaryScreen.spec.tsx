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
const mockSetArc59Summary = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({
        address: 'SENDERADDR',
    })),
}))

vi.mock('@perawallet/wallet-core-asa-inbox', () => ({
    useArc59SendSummaryQuery: vi.fn(() => ({
        data: null,
        isLoading: true,
    })),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAccountInformationQuery: vi.fn(() => ({
        data: { amount: 10_000_000n, minBalance: 100_000n },
    })),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { id: '0', decimals: 6 },
    toWholeUnits: vi.fn((value: number) => value / 1_000_000),
    useSingleAssetDetailsQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
    })),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    formatCurrency: vi.fn(
        (value: number, _precision: number, currency: string) =>
            `${value.toFixed(6)} ${currency}`,
    ),
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@rneui/themed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passthrough = ({ children }: any) => children
    return {
        useThemeMode: () => ({ mode: 'light', setMode: vi.fn() }),
        createTheme: (config: Record<string, unknown>) => config,
        ThemeProvider: passthrough,
        makeStyles:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (fn: (...args: any[]) => Record<string, unknown>) => () =>
                fn({}, {}),
    }
})

vi.mock('@assets/images/asset-inbox-send-light.svg', () => ({
    default: 'LightHeaderImage',
}))

vi.mock('@assets/images/asset-inbox-send-dark.svg', () => ({
    default: 'DarkHeaderImage',
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

const mockSummary = {
    is_arc59_opted_in: false,
    minimum_balance_requirement: 100_000,
    inner_tx_count: 4,
    total_protocol_and_mbr_fee: 300_000,
    inbox_address: 'INBOXADDR',
    algo_fund_amount: 300_000,
    warning_message: null,
}

describe('useARC59SendSummaryScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
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

    it('shows warning on handleSend', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleSend()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(true)
        })
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('navigates to TransactionProcessing on handleWarningConfirm', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleSend()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(true)
        })

        result.current.handleWarningConfirm()

        expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(false)
        })
    })

    it('goes back on handleClose', () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleClose()

        expect(mockGoBack).toHaveBeenCalled()
    })

    it('shows warning on handleReadMore', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleReadMore()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(true)
        })
    })

    it('hides warning on handleWarningClose without navigating', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleSend()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(true)
        })

        result.current.handleWarningClose()

        await waitFor(() => {
            expect(result.current.isWarningVisible).toBe(false)
        })
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('computes fee from summary', async () => {
        const { useArc59SendSummaryQuery } = await import(
            '@perawallet/wallet-core-asa-inbox'
        )
        ;(useArc59SendSummaryQuery as Mock).mockReturnValue({
            data: mockSummary,
            isLoading: false,
        })

        const { result } = renderHook(() => useARC59SendSummaryScreen())

        expect(result.current.fee).toBe(0.3)
        expect(result.current.isLoading).toBe(false)
    })
})
