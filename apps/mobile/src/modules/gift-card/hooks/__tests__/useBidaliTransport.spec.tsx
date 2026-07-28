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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type {
    WalletAccount,
    AccountBalances,
} from '@perawallet/wallet-core-accounts'
import { useBidaliTransport } from '../useBidaliTransport'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddSignRequest = vi.fn()
const mockAddPayment = vi.fn()
const mockAddAssetTransfer = vi.fn()
const mockBuildTransactions = vi.fn().mockResolvedValue({
    transactions: [{ fake: 'txn' }],
})
const mockComposer = {
    addPayment: mockAddPayment,
    addAssetTransfer: mockAddAssetTransfer,
    buildTransactions: mockBuildTransactions,
}

vi.mock('react-native', () => ({
    Linking: { openURL: vi.fn() },
}))

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        bidaliApiKey: 'test-api-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    },
    getNetworkConfig: () => ({
        bidaliApiKey: 'test-api-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    }),
    isMainnet: (network: string) => network === 'mainnet',
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: (addr: string) => /^[A-Z2-7]{58}$/.test(addr ?? ''),
    useAlgorandClient: () => ({
        newGroup: () => mockComposer,
    }),
    useNetwork: () => ({ network: 'mainnet' }),
    displayUnitsToBaseUnits: (amount: string, decimals: number) => ({
        toFixed: () => String(Number(amount) * 10 ** decimals),
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { decimals: 6 },
    getKnownAssetId: (key: string, _network: string) =>
        key === 'USDC' ? '31566704' : '0',
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    ALGO_ASSET_ID: '0',
    isAlgoAssetId: (assetId: string | number | bigint) =>
        String(assetId) === '0',
    generateOrderedUniqueId: () => 'test-id-123',
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

// BigInt.microAlgo() is a runtime extension added by algokit-utils.
// Patch it for the test environment.
const originalBigInt = globalThis.BigInt
const patchedBigInt = (value: Parameters<typeof originalBigInt>[0]) => {
    const v = originalBigInt(value)
    return Object.assign(v, { microAlgo: () => v })
}
Object.assign(patchedBigInt, originalBigInt)
// eslint-disable-next-line no-global-assign
globalThis.BigInt = patchedBigInt as unknown as typeof BigInt

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAccount: WalletAccount = {
    id: 'bidali-transport-account',
    address: VALID_ADDRESS,
    name: 'Test',
    type: 'algo25',
    keyPairId: 'test-key-pair-id',
}

const emptyBalances: AccountBalances = new Map()

const bidaliRPC = (method: string, params?: Record<string, unknown>) => ({
    jsonrpc: '2.0' as const,
    method,
    params,
    id: 'bidali-1234',
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBidaliTransport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // -- providerJS --------------------------------------------------------

    describe('providerJS', () => {
        it('includes the API key and bidaliProvider object', () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            expect(result.current.providerJS).toContain("key: 'test-api-key'")
            expect(result.current.providerJS).toContain('window.bidaliProvider')
        })

        it('includes supported currencies', () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            expect(result.current.providerJS).toContain('"algorand"')
            expect(result.current.providerJS).toContain('"usdcalgorand"')
        })
    })

    // -- Message routing ---------------------------------------------------

    describe('handleMessage', () => {
        it('ignores non-RPC messages', () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() => result.current.handleMessage('garbage'))
            act(() => result.current.handleMessage(null))
            act(() => result.current.handleMessage({ random: true }))
            act(() =>
                result.current.handleMessage({
                    jsonrpc: '2.0',
                    method: 'x',
                    id: 'not-bidali',
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('ignores messages without params', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(bidaliRPC('bidaliPaymentRequest')),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: message missing params',
                expect.anything(),
            )
        })

        it('warns on unknown methods', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(
                    bidaliRPC('unknownMethod', { foo: 'bar' }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: unknown method',
                expect.objectContaining({ method: 'unknownMethod' }),
            )
        })
    })

    // -- Payment request validation ----------------------------------------

    describe('bidaliPaymentRequest validation', () => {
        it('rejects when no account is selected', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(undefined, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '1.5',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: no selected account',
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects invalid address', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: 'not-valid',
                        amount: '1.5',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: invalid param',
                expect.anything(),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects missing address', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        amount: '1.5',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: invalid param',
                expect.anything(),
            )
        })

        it('rejects non-string amount', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: 123,
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: invalid param',
                expect.anything(),
            )
        })

        it('rejects zero amount', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '0',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: invalid amount',
                expect.anything(),
            )
        })

        it('rejects negative amount', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '-5',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: invalid amount',
                expect.anything(),
            )
        })

        it('rejects NaN amount', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: 'not-a-number',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: invalid amount',
                expect.anything(),
            )
        })

        it('rejects unsupported protocol', async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '1.5',
                        protocol: 'bitcoin',
                    }),
                ),
            )
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: unsupported protocol',
                expect.anything(),
            )
        })
    })

    // -- Payment request: transaction building ------------------------------

    describe('bidaliPaymentRequest transaction building', () => {
        it('builds an ALGO payment and submits a sign request', async () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '1.5',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(mockAddPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: VALID_ADDRESS,
                    receiver: VALID_ADDRESS,
                }),
            )
            expect(mockBuildTransactions).toHaveBeenCalled()
            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'transactions',
                    transport: 'algod',
                    txs: [{ fake: 'txn' }],
                    sourceMetadata: expect.objectContaining({
                        name: 'giftCard.signing.source_name',
                        description: 'giftCard.signing.source_description',
                    }),
                }),
            )
        })

        it('builds a USDC asset transfer for usdcalgorand protocol', async () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '10',
                        protocol: 'usdcalgorand',
                    }),
                ),
            )
            expect(mockAddAssetTransfer).toHaveBeenCalledTimes(1)
            const call = mockAddAssetTransfer.mock.calls[0][0]
            expect(call.sender).toBe(VALID_ADDRESS)
            expect(call.receiver).toBe(VALID_ADDRESS)
            expect(call.assetId.toString()).toBe('31566704')
            expect(mockAddSignRequest).toHaveBeenCalled()
        })

        it('passes extraId as note when provided', async () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '1',
                        protocol: 'algorand',
                        extraId: 'bidali-charge-123',
                    }),
                ),
            )
            expect(mockAddPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    note: 'bidali-charge-123',
                }),
            )
        })

        it('omits note when extraId is empty string', async () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '1',
                        protocol: 'algorand',
                        extraId: '',
                    }),
                ),
            )
            expect(mockAddPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    note: undefined,
                }),
            )
        })

        it('sends paymentCancelled when transaction build fails', async () => {
            mockBuildTransactions.mockRejectedValueOnce(
                new Error('network error'),
            )
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: VALID_ADDRESS,
                        amount: '1',
                        protocol: 'algorand',
                    }),
                ),
            )
            expect(logger.error).toHaveBeenCalledWith(
                'Bidali: failed to build transaction',
                expect.anything(),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })
    })

    // -- openUrl -----------------------------------------------------------

    describe('openUrl', () => {
        it('opens a valid https URL', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(
                    bidaliRPC('openUrl', {
                        url: 'https://example.com/gift-card',
                    }),
                ),
            )
            expect(Linking.openURL).toHaveBeenCalledWith(
                'https://example.com/gift-card',
            )
        })

        it('opens a valid http URL', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(
                    bidaliRPC('openUrl', { url: 'http://example.com' }),
                ),
            )
            expect(Linking.openURL).toHaveBeenCalledWith('http://example.com')
        })

        it('rejects javascript: scheme', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(
                    bidaliRPC('openUrl', {
                        url: 'javascript:alert(1)',
                    }),
                ),
            )
            expect(Linking.openURL).not.toHaveBeenCalled()
        })

        it('rejects data: scheme', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(
                    bidaliRPC('openUrl', {
                        url: 'data:text/html,<h1>hi</h1>',
                    }),
                ),
            )
            expect(Linking.openURL).not.toHaveBeenCalled()
        })

        it('rejects empty url', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(bidaliRPC('openUrl', { url: '' })),
            )
            expect(Linking.openURL).not.toHaveBeenCalled()
        })

        it('rejects non-string url', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            act(() =>
                result.current.handleMessage(
                    bidaliRPC('openUrl', { url: 12_345 }),
                ),
            )
            expect(Linking.openURL).not.toHaveBeenCalled()
        })
    })
})
