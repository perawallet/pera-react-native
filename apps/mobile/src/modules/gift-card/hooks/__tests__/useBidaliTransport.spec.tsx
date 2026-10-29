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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import { renderHook, act } from '@testing-library/react'
import type {
    WalletAccount,
    AccountBalances,
} from '@perawallet/wallet-core-accounts'
import {
    BIDALI_PAYMENT_CURRENCIES,
    useBidaliTransport,
} from '../useBidaliTransport'

const mockAddSignRequest = vi.fn()
// Mutable so the "fallback network" providerJS test below can switch away
// from mainnet without a new vi.mock factory.
let mockNetwork = 'mainnet'
let mockChainMode = 'live'
const mockBuildTransferTxs = vi.fn()

vi.mock('react-native', () => ({
    Linking: { openURL: vi.fn() },
    Platform: { OS: 'ios' },
}))

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        bidaliApiKey: 'test-api-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    },
    getPeraServicesConfig: () => ({
        bidaliApiKey: 'test-api-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: (chainId: string) => ({
        chainId,
        networkId: mockNetwork,
    }),
    getSelectedScope: (chainId: string) => ({
        chainId,
        networkId: mockNetwork,
    }),
    useSelectedChainMode: () => mockChainMode,
}))

// The account's own chain, as useAccountScope resolves it.
vi.mock('../useGiftCardScope', () => ({
    useGiftCardScope: (account?: { chains: Record<string, unknown> }) => ({
        chainId:
            account && 'ethereum' in account.chains ? 'ethereum' : 'algorand',
        networkId: mockNetwork,
    }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    sendFlowChainAdapters: {
        get: () => ({ buildTransferTxs: mockBuildTransferTxs }),
    },
}))

const NATIVE_ASSET = vi.hoisted(() => ({ assetId: '0', decimals: 6 }))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => NATIVE_ASSET,
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane, so
    // getCurrencyInfo's `assetId === null` branch is reachable here.
    getKnownAssetId: (
        key: string,
        { networkId: network }: { networkId: string },
    ) => {
        if (key !== 'USDC') return null
        return { mainnet: '31566704', testnet: '10458941' }[network] ?? null
    },
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const { displayUnitsToBaseUnits } = await vi.importActual<
        typeof import('@packages/shared/src/utils/unit-conversion')
    >('@packages/shared/src/utils/unit-conversion')
    // Error classes in the import graph extend AppError at module load.
    const { AppError, ErrorCategory } = await vi.importActual<
        typeof import('@packages/shared/src/errors/base')
    >('@packages/shared/src/errors/base')
    return {
        AppError,
        ErrorCategory,
        generateOrderedUniqueId: () => 'test-id-123',
        logger: {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        },
        displayUnitsToBaseUnits,
    }
})

vi.mock('@hooks/useLanguage')

const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAccount: WalletAccount = {
    id: 'bidali-transport-account',
    chains: {
        algorand: { address: VALID_ADDRESS, keyPairId: 'test-key-pair-id' },
    },
    name: 'Test',
    custody: { kind: 'local', seed: null },
}

const emptyBalances: AccountBalances = new Map()

const bidaliRPC = (method: string, params?: Record<string, unknown>) => ({
    jsonrpc: '2.0' as const,
    method,
    params,
    id: 'bidali-1234',
})

// Stands in for the Algorand codec, which the unit registry lacks.
beforeEach(() => {
    addressCodecs.register({
        ...fixtureCodec,
        chainId: LEGACY_CHAIN_ID,
        isValid: address => /^[A-Z2-7]{58}$/.test(address),
    })
})

afterEach(() => {
    addressCodecs.reset()
})

describe('useBidaliTransport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockNetwork = 'mainnet'
        mockChainMode = 'live'
        mockBuildTransferTxs.mockResolvedValue([{ fake: 'txn' }])
    })

    // -- providerJS --------------------------------------------------------

    describe('providerJS', () => {
        it('includes the API key and bidaliProvider object', () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            expect(result.current.providerJS).toContain('key: "test-api-key"')
            expect(result.current.providerJS).toContain('window.bidaliProvider')
        })

        it('exposes the key, currencies and balances on the page when run', () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            const fakeWindow: {
                bidaliProvider?: Record<string, unknown>
                ReactNativeWebView?: unknown
            } = {}

            new Function('window', result.current.providerJS)(fakeWindow)

            expect(fakeWindow.bidaliProvider?.key).toBe('test-api-key')
            expect(fakeWindow.bidaliProvider?.paymentCurrencies).toEqual(
                BIDALI_PAYMENT_CURRENCIES,
            )
            expect(fakeWindow.bidaliProvider?.balances).toEqual({
                algorand: '0',
                usdcalgorand: '0',
            })
        })

        it('includes supported currencies', () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )
            expect(result.current.providerJS).toContain('"algorand"')
            expect(result.current.providerJS).toContain('"usdcalgorand"')
        })

        it('selects the usdcalgorand balance key in live mode', () => {
            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )

            expect(result.current.providerJS).toContain('"usdcalgorand":')
            expect(result.current.providerJS).not.toContain(
                '"testusdcalgorand":',
            )
        })

        // Custom has no Bidali catalogue of its own, so developer-override must
        // select the same testusdcalgorand balance key as the default test network.
        it('selects the testusdcalgorand balance key in developer-override mode', () => {
            mockNetwork = 'custom'
            mockChainMode = 'developer-override'

            const { result } = renderHook(() =>
                useBidaliTransport(mockAccount, emptyBalances),
            )

            expect(result.current.providerJS).toContain('"testusdcalgorand":')
            expect(result.current.providerJS).not.toContain('"usdcalgorand":')
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
            expect(mockBuildTransferTxs).toHaveBeenCalledWith({
                scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' },
                sender: VALID_ADDRESS,
                receiver: VALID_ADDRESS,
                assetId: '0',
                amount: 1_500_000n,
                note: undefined,
            })
            expect(mockAddSignRequest).not.toHaveBeenCalledWith(
                expect.objectContaining({ chainId: expect.anything() }),
            )
            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'transactions',
                    transport: 'network',
                    txs: [{ fake: 'txn' }],
                    sourceMetadata: expect.objectContaining({
                        name: 'giftCard.signing.source_name',
                        description: 'giftCard.signing.source_description',
                    }),
                }),
            )
        })

        it("builds the payment on an Ethereum account's own chain", async () => {
            addressCodecs.register({
                ...fixtureCodec,
                chainId: 'ethereum',
                isValid: address => address.startsWith('0x'),
            })
            const ethereumAccount: WalletAccount = {
                id: 'bidali-ethereum-account',
                chains: { ethereum: { address: '0xSENDER', keyPairId: 'kp' } },
                name: 'Eth',
                custody: { kind: 'local', seed: null },
            }
            const { result } = renderHook(() =>
                useBidaliTransport(ethereumAccount, emptyBalances),
            )

            await act(async () =>
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: '0xRECEIVER',
                        amount: '1.5',
                        protocol: 'algorand',
                    }),
                ),
            )

            expect(mockBuildTransferTxs).toHaveBeenCalledWith(
                expect.objectContaining({
                    scope: { chainId: 'ethereum', networkId: 'mainnet' },
                    sender: '0xSENDER',
                    receiver: '0xRECEIVER',
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
            expect(mockBuildTransferTxs).toHaveBeenCalledTimes(1)
            expect(mockBuildTransferTxs).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: VALID_ADDRESS,
                    receiver: VALID_ADDRESS,
                    assetId: '31566704',
                    amount: 10_000_000n,
                }),
            )
            expect(mockAddSignRequest).toHaveBeenCalled()
        })

        it('refuses a USDC transfer on a network with no known USDC id', async () => {
            // getCurrencyInfo returns null there, which the caller already
            // treats as an unsupported protocol — no transfer is composed
            // against another chain's asset id.
            mockNetwork = 'betanet'
            const { logger } = await import('@perawallet/wallet-core-shared')
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

            expect(mockBuildTransferTxs).not.toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith(
                'Bidali: unsupported protocol',
                expect.anything(),
            )
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
            expect(mockBuildTransferTxs).toHaveBeenCalledWith(
                expect.objectContaining({ note: 'bidali-charge-123' }),
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
            expect(mockBuildTransferTxs).toHaveBeenCalledWith(
                expect.objectContaining({ note: undefined }),
            )
        })

        it('sends paymentCancelled when transaction build fails', async () => {
            mockBuildTransferTxs.mockRejectedValueOnce(
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
