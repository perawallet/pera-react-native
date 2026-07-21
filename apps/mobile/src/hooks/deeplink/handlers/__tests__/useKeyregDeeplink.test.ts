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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { DeeplinkType, type KeyregDeeplink } from '../../types'

const {
    mockAddSignRequest,
    mockShowError,
    mockOnlineKeyRegistration,
    mockOfflineKeyRegistration,
    mockEncodeTransaction,
    mockDecodeTransaction,
    mockAllAccounts,
    mockResolveAuthAccount,
    mockGetSuggestedParams,
    mockUseMinimumFeeConfig,
    mockResolveMinFeeForSender,
} = vi.hoisted(() => ({
    mockAddSignRequest: vi.fn(),
    mockShowError: vi.fn(),
    mockOnlineKeyRegistration: vi.fn(),
    mockOfflineKeyRegistration: vi.fn(),
    mockEncodeTransaction: vi.fn((tx: unknown) => tx),
    mockDecodeTransaction: vi.fn((tx: unknown) => tx),
    mockAllAccounts: { current: [] as { address: string; id: string }[] },
    mockResolveAuthAccount: vi.fn((account: unknown) => account),
    mockGetSuggestedParams: vi.fn(),
    mockUseMinimumFeeConfig: vi.fn(),
    mockResolveMinFeeForSender: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // Real-ish: matches the production base32-length check well enough for
    // valid vs invalid sender discrimination in this hook.
    isValidAlgorandAddress: (address: string) =>
        typeof address === 'string' && /^[A-Z2-7]{58}$/.test(address),
    useAlgorandClient: () => ({
        createTransaction: {
            onlineKeyRegistration: mockOnlineKeyRegistration,
            offlineKeyRegistration: mockOfflineKeyRegistration,
        },
        getSuggestedParams: mockGetSuggestedParams,
    }),
    useTransactionEncoder: () => ({
        encodeTransaction: mockEncodeTransaction,
        decodeTransaction: mockDecodeTransaction,
    }),
    useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    resolveMinFeeForSender: (...args: unknown[]) =>
        mockResolveMinFeeForSender(...args),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockAllAccounts.current,
    resolveAuthAccount: (account: unknown) => mockResolveAuthAccount(account),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    generateOrderedUniqueId: () => 'test-sign-request-id',
    decodeFromBase64: (s: string) => Uint8Array.from(Buffer.from(s, 'base64')),
}))

vi.mock('../useDeeplinkErrorHandler', () => ({
    useDeeplinkErrorHandler: () => mockShowError,
}))

// algokit's microAlgo helper returns an `AlgoAmount`; the hook passes it
// straight to createTransaction so the unit test only needs to forward the
// number it was constructed with.
vi.mock('@algorandfoundation/algokit-utils', () => ({
    microAlgo: (n: bigint) => ({ microAlgos: n }),
}))

import { useKeyregDeeplink } from '../useKeyregDeeplink'

const VALID_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

const baseOfflineDeeplink = (
    overrides: Partial<KeyregDeeplink> = {},
): KeyregDeeplink => ({
    type: DeeplinkType.KEYREG,
    sourceUrl: 'perawallet://app/keyreg/?senderAddress=...',
    senderAddress: VALID_ADDRESS,
    keyregType: 'offline',
    ...overrides,
})

const baseOnlineDeeplink = (
    overrides: Partial<KeyregDeeplink> = {},
): KeyregDeeplink =>
    baseOfflineDeeplink({
        keyregType: 'online',
        voteKey: 'AAA',
        selkey: 'AAA',
        sprfkey: 'AAA',
        votefst: '100',
        votelst: '200',
        votekd: '10',
        ...overrides,
    })

const seedSenderInWallet = () => {
    mockAllAccounts.current = [
        { address: VALID_ADDRESS, id: 'wallet-account-1' },
    ]
}

describe('useKeyregDeeplink', () => {
    beforeEach(() => {
        mockAddSignRequest.mockReset()
        mockShowError.mockReset()
        mockOnlineKeyRegistration.mockReset()
        mockOfflineKeyRegistration.mockReset()
        mockEncodeTransaction.mockClear()
        mockDecodeTransaction.mockClear()
        mockResolveAuthAccount.mockReset()
        mockResolveAuthAccount.mockImplementation(account => account)
        mockAllAccounts.current = []

        mockOnlineKeyRegistration.mockResolvedValue({ kind: 'online-tx' })
        mockOfflineKeyRegistration.mockResolvedValue({ kind: 'offline-tx' })

        // Default: network minFee 1000, non-quantum sender (resolved ==
        // suggested, so the PQ override never kicks in unless a test
        // overrides mockResolveMinFeeForSender to return a higher value).
        mockGetSuggestedParams.mockReset()
        mockGetSuggestedParams.mockResolvedValue({ minFee: 1000 })
        mockUseMinimumFeeConfig.mockReset()
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        mockResolveMinFeeForSender.mockReset()
        mockResolveMinFeeForSender.mockReturnValue(1000n)
    })

    afterEach(() => {
        mockAllAccounts.current = []
    })

    describe('preflight gating', () => {
        it('rejects an invalid sender address with the "keyreg" error variant and does not queue a sign request', async () => {
            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(
                    baseOfflineDeeplink({ senderAddress: 'NOT-AN-ADDRESS' }),
                )
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'keyreg',
                    error: 'Invalid sender address',
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(mockOfflineKeyRegistration).not.toHaveBeenCalled()
        })

        it('rejects a sender we don\'t hold with the "keyreg-unknown-account" variant', async () => {
            // mockAllAccounts left empty — wallet doesn't have the sender.
            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'keyreg-unknown-account',
                    error: expect.stringContaining('is not in this wallet'),
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects a rekeyed account whose auth-target is missing, surfacing the resolver error message', async () => {
            // Sender is in the wallet but resolveAuthAccount throws because
            // the rekey target isn't held — the hook should bubble the
            // resolver's message into the error sheet.
            seedSenderInWallet()
            mockResolveAuthAccount.mockImplementation(() => {
                throw new Error('Rekey target X not found in local accounts')
            })

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'keyreg-unknown-account',
                    error: 'Rekey target X not found in local accounts',
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects an online keyreg missing any of the participation key fields with the "keyreg" variant', async () => {
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            // sprfkey omitted → online keyreg requires every key field.
            await act(async () => {
                await result.current(baseOnlineDeeplink({ sprfkey: undefined }))
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'keyreg',
                    error: 'Missing required participation key fields',
                }),
            )
            expect(mockOnlineKeyRegistration).not.toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })
    })

    describe('happy path', () => {
        it('builds an offline keyreg and queues a deeplink-source sign request', async () => {
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(
                    baseOfflineDeeplink({ note: 'going offline', fee: '2000' }),
                )
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    sender: VALID_ADDRESS,
                    staticFee: { microAlgos: 2000n },
                }),
            )
            expect(mockAddSignRequest).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    type: 'transactions',
                    transport: 'algod',
                    // Crucial: 'deeplink' source so SigningOverlays surfaces
                    // the review sheet. 'local' would silently auto-sign.
                    sourceType: 'deeplink',
                }),
            )
            expect(mockShowError).not.toHaveBeenCalled()
        })

        it('builds an online keyreg with every participation field forwarded to algokit', async () => {
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(
                    baseOnlineDeeplink({
                        votefst: '1300',
                        votelst: '11300',
                        votekd: '100',
                    }),
                )
            })

            expect(mockOnlineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    sender: VALID_ADDRESS,
                    voteFirst: 1300n,
                    voteLast: 11_300n,
                    voteKeyDilution: 100n,
                }),
            )
            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
            expect(mockShowError).not.toHaveBeenCalled()
        })

        it('falls back to xnote when no editable note is provided', async () => {
            // Native parity: xnote is locked at the protocol layer and ends
            // up in the same txn note field when the user-editable note is
            // empty.
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(
                    baseOfflineDeeplink({ note: undefined, xnote: 'locked' }),
                )
            })

            const buildArgs = mockOfflineKeyRegistration.mock.calls[0][0] as {
                note?: Uint8Array
            }
            // jsdom's TextEncoder returns a Uint8Array from a different
            // realm than the test global, so `instanceof Uint8Array` is
            // unreliable — assert on the decoded contents instead.
            expect(buildArgs.note).toBeDefined()
            expect(new TextDecoder().decode(buildArgs.note)).toBe('locked')
        })
    })

    describe('PQ fee floor', () => {
        // resolveMinFeeForSender is mocked directly (its own rekey-chain/PQ
        // logic is covered by
        // packages/signing/src/pipeline/sources/__tests__/minFeeResolver.spec.ts).
        // These tests only verify this hook wires the resolver's inputs and
        // applies the override guard on its output, mirroring PQ-007's
        // useTransactionSendFlow.buildNormalTxs pattern.
        it("floors a quantum sender's dApp-set fee up to the resolved PQ minimum", async () => {
            seedSenderInWallet()
            mockResolveMinFeeForSender.mockReturnValue(3000n)

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink({ fee: '1000' }))
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: { microAlgos: 3000n } }),
            )
            expect(mockResolveMinFeeForSender).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    senderAddress: VALID_ADDRESS,
                    accounts: mockAllAccounts.current,
                    suggestedMinFee: 1000n,
                    configMinTxnFee: 1000n,
                    pqMultiplier: 3n,
                }),
            )
        })

        it('floors a quantum sender with no dApp fee up to the resolved PQ minimum', async () => {
            seedSenderInWallet()
            mockResolveMinFeeForSender.mockReturnValue(3000n)

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: { microAlgos: 3000n } }),
            )
        })

        it("never lowers a quantum sender's dApp fee that already exceeds the resolved PQ minimum", async () => {
            seedSenderInWallet()
            mockResolveMinFeeForSender.mockReturnValue(3000n)

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink({ fee: '5000' }))
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: { microAlgos: 5000n } }),
            )
        })

        it("leaves an algo25 sender's dApp-set fee unchanged", async () => {
            seedSenderInWallet()
            mockResolveMinFeeForSender.mockReturnValue(1000n)

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink({ fee: '1000' }))
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: { microAlgos: 1000n } }),
            )
        })

        it('leaves staticFee undefined for an algo25 sender with no dApp fee', async () => {
            seedSenderInWallet()
            mockResolveMinFeeForSender.mockReturnValue(1000n)

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: undefined }),
            )
        })
    })

    describe('build failures', () => {
        it('surfaces a build error through the error sheet with the "keyreg" variant', async () => {
            // algokit's createTransaction can fail for many reasons (algod
            // unreachable, suggestedParams 500, decoder threw, …). The hook
            // is supposed to catch the whole pipeline and route to the
            // error sheet rather than crashing the dispatcher.
            seedSenderInWallet()
            const buildErr = new Error('algod refused to compute params')
            mockOfflineKeyRegistration.mockRejectedValueOnce(buildErr)

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'keyreg',
                    error: buildErr,
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })
    })
})
