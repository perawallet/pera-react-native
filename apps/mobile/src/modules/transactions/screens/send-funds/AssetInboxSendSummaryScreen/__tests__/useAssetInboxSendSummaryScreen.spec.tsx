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
import { useAssetInboxSendSummaryScreen } from '../useAssetInboxSendSummaryScreen'
import { Decimal } from 'decimal.js'
import { useSpendableBalanceQuery } from '@perawallet/wallet-core-transactions'
import { IntegrityRequiredError } from '@perawallet/wallet-core-shared'
import { useSendFunds } from '@modules/transactions/hooks'

const mockNavigate = vi.fn()
const { recipientSafety } = vi.hoisted(() => ({
    recipientSafety: {
        current: {
            assessment: undefined,
            isPending: false,
            isAcknowledged: false,
            toggleAcknowledged: () => {},
            isConfirmBlocked: false,
        } as Record<string, unknown>,
    },
}))

const mockGoBack = vi.fn()
const mockReplace = vi.fn()
const mockSetAssetInboxQuote = vi.fn()

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
    '@modules/transactions/components/send-funds/AssetInboxWarningContent',
    () => ({
        AssetInboxWarningContent: () => null,
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
    chainAccountOf: (
        account: { chains: Record<string, { address: string }> },
        chainId: string,
    ) => account.chains[chainId],
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

const { sendScope, NATIVE_ASSETS } = vi.hoisted(() => ({
    sendScope: { current: { chainId: 'algorand', networkId: 'mainnet' } },
    NATIVE_ASSETS: {
        algorand: { assetId: '0', decimals: 6, unitName: 'ALGO' },
        ethereum: { assetId: 'eth', decimals: 18, unitName: 'ETH' },
    } as Record<
        string,
        { assetId: string; decimals: number; unitName: string }
    >,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: (scope: { chainId: string }) =>
        NATIVE_ASSETS[scope.chainId],
    toWholeUnits: vi.fn(
        (value: bigint, asset: { decimals: number }) =>
            Number(value) / 10 ** asset.decimals,
    ),
    formatAssetAmount: vi.fn(
        (value: Decimal, asset: { unitName: string }) =>
            `${value.toString()} base ${asset.unitName}`,
    ),
    useSingleAssetDetailsQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
    })),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    class IntegrityRequiredError extends Error {
        constructor(_details: {
            code: string | null
            status: number
            hadToken: boolean
        }) {
            super('integrity token required')
        }
    }
    return {
        ...(await vi.importActual<
            typeof import('@packages/shared/src/errors/base')
        >('@packages/shared/src/errors/base')),
        IntegrityRequiredError,
        isIntegrityRequiredError: (error: unknown) =>
            error instanceof IntegrityRequiredError,
        generateOrderedUniqueId: vi.fn(() => 'webview-id'),
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }
})

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
    useSendScope: () => sendScope.current,
    useRecipientSafety: () => recipientSafety.current,
}))

// Base units of the native asset.
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

describe('useAssetInboxSendSummaryScreen', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        recipientSafety.current = {
            ...recipientSafety.current,
            isConfirmBlocked: false,
        }
        sendScope.current = { chainId: 'algorand', networkId: 'mainnet' }
        mockRequestBottomSheet.mockResolvedValue(undefined)
        ;(useSendFunds as Mock).mockReturnValue({
            selectedAssetId: '123',
            destination: 'RECEIVERADDR',
            amount: '50',
            setAssetInboxQuote: mockSetAssetInboxQuote,
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
        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        expect(result.current.isLoading).toBe(true)
    })

    it('requests the warning bottom sheet on handleSend', async () => {
        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

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
        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        await act(async () => {
            result.current.handleSend()
        })

        expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
        // Slider stays in its slid/loading state through to the processing
        // screen — it is not reset on confirm.
        expect(result.current.isProcessing).toBe(true)
    })

    it('neither warns nor navigates while the recipient check blocks the send', async () => {
        recipientSafety.current = {
            ...recipientSafety.current,
            isConfirmBlocked: true,
        }
        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        await act(async () => {
            result.current.handleSend()
        })

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('does not navigate when warning is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        await act(async () => {
            result.current.handleSend()
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        // Dismissing the warning returns the slider to idle so the user can retry.
        expect(result.current.isProcessing).toBe(false)
    })

    it('goes back on handleClose', () => {
        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        result.current.handleClose()

        expect(mockGoBack).toHaveBeenCalled()
    })

    it('opens the asset inbox support article on handleReadMore', async () => {
        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

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

        renderHook(() => useAssetInboxSendSummaryScreen())

        expect(mockSetAssetInboxQuote).toHaveBeenCalledWith(mockSummary.quote)
    })

    it('computes fee from summary', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: mockSummary,
            isLoading: false,
        })

        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

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

        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        expect(result.current.isUnavailableOnNetwork).toBe(true)
    })

    it('flags a refusal for want of an integrity token', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: null,
            isLoading: false,
            isError: true,
            error: new IntegrityRequiredError({
                code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                status: 403,
                hadToken: false,
            }),
        })

        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        expect(result.current.isIntegrityBlocked).toBe(true)
    })

    it('does not flag any other failure as an integrity refusal', async () => {
        const { useAssetInboxSendSummaryQuery } =
            await import('@perawallet/wallet-core-transactions')
        ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
            data: null,
            isLoading: false,
            isError: true,
            error: new Error('boom'),
        })

        const { result } = renderHook(() => useAssetInboxSendSummaryScreen())

        expect(result.current.isIntegrityBlocked).toBe(false)
    })

    describe.each([
        {
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            nativeAssetId: '0',
            unitName: 'ALGO',
        },
        {
            scope: { chainId: 'ethereum', networkId: 'sepolia' },
            nativeAssetId: 'eth',
            unitName: 'ETH',
        },
    ])('on $scope.chainId', ({ scope, nativeAssetId, unitName }) => {
        beforeEach(async () => {
            sendScope.current = scope
            const { useAssetInboxSendSummaryQuery } =
                await import('@perawallet/wallet-core-transactions')
            ;(useAssetInboxSendSummaryQuery as Mock).mockReturnValue({
                data: mockSummary,
                isLoading: false,
            })
        })

        it("quotes the send on the send flow's scope", async () => {
            const { useAssetInboxSendSummaryQuery } =
                await import('@perawallet/wallet-core-transactions')

            const { result } = renderHook(() =>
                useAssetInboxSendSummaryScreen(),
            )

            expect(useAssetInboxSendSummaryQuery).toHaveBeenCalledWith(
                scope,
                'RECEIVERADDR',
                '123',
            )
            expect(result.current.nativeAsset.unitName).toBe(unitName)
        })

        it('redirects to InsufficientBalance labelled in the native asset when spendable funds fall short', () => {
            spendableWithMax(150_000)

            renderHook(() => useAssetInboxSendSummaryScreen())

            expect(mockReplace).toHaveBeenCalledWith('InsufficientBalance', {
                requiredBalanceLabel: `300000 base ${unitName}`,
            })
        })

        it("stays on the summary when the transfer adapter's spendable native funds cover the quote", () => {
            spendableWithMax(300_000)

            renderHook(() => useAssetInboxSendSummaryScreen())

            expect(mockReplace).not.toHaveBeenCalled()
            expect(useSpendableBalanceQuery).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    asset: { chainId: scope.chainId, assetId: nativeAssetId },
                    scope,
                    fee: new Decimal(0),
                }),
            )
        })
    })
})
