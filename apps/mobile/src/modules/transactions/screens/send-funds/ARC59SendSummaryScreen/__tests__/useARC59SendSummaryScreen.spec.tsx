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
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { useARC59SendSummaryScreen } from '../useARC59SendSummaryScreen'
import { Decimal } from 'decimal.js'
import { useSpendableBalanceQuery } from '@perawallet/wallet-core-transactions'
import { useSendFunds } from '@modules/transactions/hooks'

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()
const mockReplace = vi.fn()
const mockSetArc59Summary = vi.fn()

const { mockRequestBottomSheet, mockPushWebView } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
    mockPushWebView: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock(
    '@modules/transactions/components/send-funds/ARC59WarningContent',
    () => ({
        ARC59WarningContent: () => null,
    }),
)

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
        goBack: mockGoBack,
        replace: mockReplace,
    }),
    // Focus reset is exercised at the integration level; no-op here.
    useFocusEffect: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({
        id: 'sender',
        custody: { kind: 'watch' },
        chains: { algorand: { address: 'SENDERADDR' } },
    })),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetInboxSendSummaryQuery: vi.fn(() => ({
        data: null,
        isLoading: true,
    })),
    useSpendableBalanceQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

const NATIVE_ASSET = vi.hoisted(() => ({ assetId: '0', decimals: 6 }))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => NATIVE_ASSET,
    toWholeUnits: vi.fn((value: number | bigint) => Number(value) / 1_000_000),
    useSingleAssetDetailsQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
    })),
}))

// Stands in for the real network store, which needs the shared store registry this spec mocks away.
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    ALGO_ASSET_NAME: 'ALGO',
    formatCurrency: vi.fn(
        (value: number, _precision: number, currency: string) =>
            `${value.toFixed(6)} ${currency}`,
    ),
    generateOrderedUniqueId: vi.fn(() => 'webview-id'),
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        assetInboxSupportUrl: 'https://support.example/asset-inbox',
    },
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
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
    useSendScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

// Base units of ALGO.
const spendableWithMax = (max: number) =>
    (useSpendableBalanceQuery as Mock).mockReturnValue({
        data: {
            balance: new Decimal(max + 100_000),
            max: new Decimal(max),
            reserved: new Decimal(100_000),
        },
        isPending: false,
    })

// The chain quotes the amount it signs as `fundingAmount`; the opaque `quote` is
// what the send flow carries on to the builder.
const mockSummary = { quote: { opaque: true }, fundingAmount: 300_000n }

describe('useARC59SendSummaryScreen', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        mockRequestBottomSheet.mockResolvedValue(undefined)
        ;(useSendFunds as Mock).mockReturnValue({
            selectedAssetId: '123',
            destination: 'RECEIVERADDR',
            amount: '50',
            setArc59Summary: mockSetArc59Summary,
        })

        // Reset query mocks to known defaults — `vi.clearAllMocks()` clears
        // call history but not return values set via `mockReturnValue`
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: null,
            isLoading: true,
        })
        spendableWithMax(9_900_000)
    })

    it('returns loading state when query is loading', () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        expect(result.current.isLoading).toBe(true)
    })

    it('requests the warning bottom sheet on handleSend', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        await act(async () => {
            result.current.handleSend()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0]?.[0]
        expect(arg?.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
        })
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("navigates to TransactionProcessing when warning resolves with 'confirm'", async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        await act(async () => {
            result.current.handleSend()
        })

        expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
        // Slider stays in its slid/loading state through to the processing
        // screen — it is not reset on confirm.
        expect(result.current.isProcessing).toBe(true)
    })

    it('does not navigate when warning is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        await act(async () => {
            result.current.handleSend()
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        // Dismissing the warning returns the slider to idle so the user can retry.
        expect(result.current.isProcessing).toBe(false)
    })

    it('goes back on handleClose', () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        result.current.handleClose()

        expect(mockGoBack).toHaveBeenCalled()
    })

    it('opens the asset inbox support article on handleReadMore', async () => {
        const { result } = renderHook(() => useARC59SendSummaryScreen())

        await act(async () => {
            result.current.handleReadMore()
        })

        expect(mockPushWebView).toHaveBeenCalledTimes(1)
        expect(mockPushWebView).toHaveBeenCalledWith({
            id: 'webview-id',
            url: 'https://support.example/asset-inbox',
        })
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('stores the chain quote for the send flow once the summary lands', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: mockSummary,
            isLoading: false,
        })

        renderHook(() => useARC59SendSummaryScreen())

        expect(mockSetArc59Summary).toHaveBeenCalledWith(mockSummary.quote)
    })

    it('computes fee from summary', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: mockSummary,
            isLoading: false,
        })

        const { result } = renderHook(() => useARC59SendSummaryScreen())

        expect(result.current.fee).toBe(0.3)
        expect(result.current.isLoading).toBe(false)
    })

    it('forwards isUnavailableOnNetwork from the summary query', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: null,
            isLoading: false,
            isUnavailableOnNetwork: true,
        })

        const { result } = renderHook(() => useARC59SendSummaryScreen())

        expect(result.current.isUnavailableOnNetwork).toBe(true)
    })

    it('redirects to InsufficientBalance when sender lacks ALGO for the inbox fees', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: mockSummary,
            isLoading: false,
        })
        spendableWithMax(150_000)

        renderHook(() => useARC59SendSummaryScreen())

        expect(mockReplace).toHaveBeenCalledWith('InsufficientBalance', {
            requiredBalanceLabel: '0.300000 ALGO',
        })
    })

    it('stays on the summary when the spendable ALGO covers the inbox fees', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: mockSummary,
            isLoading: false,
        })
        spendableWithMax(300_000)

        renderHook(() => useARC59SendSummaryScreen())

        expect(mockReplace).not.toHaveBeenCalled()
        expect(useSpendableBalanceQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({
                asset: { chainId: 'algorand', assetId: '0' },
                fee: new Decimal(0),
            }),
        )
    })
})
