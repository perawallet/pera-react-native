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
    mockResolveSignerForAccount,
    mockNetwork,
    mockAssignFeeToGroup,
} = vi.hoisted(() => ({
    mockAddSignRequest: vi.fn(),
    mockShowError: vi.fn(),
    mockOnlineKeyRegistration: vi.fn(),
    mockOfflineKeyRegistration: vi.fn(),
    mockEncodeTransaction: vi.fn((tx: unknown) => tx),
    mockDecodeTransaction: vi.fn((tx: unknown) => tx),
    mockAllAccounts: { current: [] as { address: string; id: string }[] },
    mockResolveAuthAccount: vi.fn((account: unknown) => account),
    mockResolveSignerForAccount: vi.fn(
        (_account?: unknown, _accounts?: unknown) =>
            ({ kind: 'ok' }) as { kind: string; authAddress?: string },
    ),
    mockNetwork: { current: 'mainnet' },
    mockAssignFeeToGroup: vi.fn(),
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
    }),
    useTransactionEncoder: () => ({
        encodeTransaction: mockEncodeTransaction,
        decodeTransaction: mockDecodeTransaction,
    }),
    useNetwork: () => ({
        network: mockNetwork.current,
        networkConfig: { genesisId: `${mockNetwork.current}-v1.0` },
    }),
    getExpectedGenesisHash: (network: string) => `hash-${network}`,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: mockAssignFeeToGroup,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockAllAccounts.current,
    resolveAuthAccount: (account: unknown) => mockResolveAuthAccount(account),
    resolveSignerForAccount: (account: unknown, accounts: unknown) =>
        mockResolveSignerForAccount(account, accounts),
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
    mockResolveSignerForAccount.mockReturnValue({ kind: 'ok' })
    mockNetwork.current = 'mainnet'
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

        // Default: non-quantum sender — the calculator is a passthrough
        // no-op (same reference, no adjustments), matching its real fast
        // path. Quantum tests override the implementation per case.
        mockAssignFeeToGroup.mockReset()
        mockAssignFeeToGroup.mockImplementation(
            async ({ transactions }: { transactions: unknown[] }) => ({
                transactions,
                adjustments: [],
            }),
        )
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

        // ARC-90 `net:`/`gh:` names the chain. Dropping it built the keyreg
        // against whatever network the wallet happened to be on, and the
        // genesis-hash analyzer cannot catch that — the txn carries the ACTIVE
        // chain's hash, so it always matches. Fail closed instead.
        it('rejects a keyreg whose target network is not the active one', async () => {
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(
                    baseOfflineDeeplink({ targetNetwork: 'testnet-v1.0' }),
                )
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'keyreg-network-mismatch',
                }),
            )
            expect(mockOfflineKeyRegistration).not.toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('accepts a target naming the active network by genesis id', async () => {
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(
                    baseOfflineDeeplink({ targetNetwork: 'mainnet-v1.0' }),
                )
            })

            expect(mockShowError).not.toHaveBeenCalled()
            expect(mockOfflineKeyRegistration).toHaveBeenCalled()
        })

        // A `gh:` qualifier arrives as a base64 genesis hash, so match that
        // too — and via getExpectedGenesisHash, so a Custom network resolves
        // through its stored hash rather than an empty config value.
        it('accepts a target naming the active network by genesis hash', async () => {
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(
                    baseOfflineDeeplink({ targetNetwork: 'hash-mainnet' }),
                )
            })

            expect(mockShowError).not.toHaveBeenCalled()
            expect(mockOfflineKeyRegistration).toHaveBeenCalled()
        })

        // A node runner who added their participation account as watch-only
        // passes every existing check: it IS in the wallet and it has no
        // broken rekey chain. It just cannot sign, which the pipeline only
        // discovers at machine init — surfacing a bare "Signing failed" after
        // the review sheet has already opened.
        it('rejects a watch-only sender before opening the review sheet', async () => {
            seedSenderInWallet()
            mockResolveSignerForAccount.mockReturnValue({ kind: 'watch' })

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ variant: 'keyreg-cannot-sign' }),
            )
            expect(mockOfflineKeyRegistration).not.toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        // Signability is judged on the RESOLVED auth account: a signable
        // account rekeyed to a watch-only one cannot sign either.
        it('rejects a sender rekeyed to an account that cannot sign', async () => {
            seedSenderInWallet()
            mockResolveSignerForAccount.mockReturnValue({ kind: 'authIsWatch' })

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ variant: 'keyreg-cannot-sign' }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        // A missing rekey target is a different failure from an unsignable
        // one: the account genuinely isn't in the wallet, so the copy telling
        // the user to add it is correct.
        it('rejects a missing rekey target as an unknown account', async () => {
            seedSenderInWallet()
            mockResolveSignerForAccount.mockReturnValue({
                kind: 'authMissing',
                authAddress: 'AUTH',
            })

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ variant: 'keyreg-unknown-account' }),
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
        // assignFeeToGroup is mocked at the signing-package boundary (its
        // own quantum/rekey/congestion logic is covered by
        // packages/signing/src/hooks/__tests__/useMinimumFeeCalculator.spec.ts
        // and .../sources/__tests__/assignMinimumFeesToGroup.spec.ts). These
        // tests only verify this hook builds with the dApp fee verbatim,
        // runs the built txn through the calculator, and surfaces the delta
        // only for an explicit dApp fee.
        const adjustedTx = { kind: 'offline-tx', fee: 3000n }
        const quantumRaise = (adjustments: unknown[]) => {
            mockAssignFeeToGroup.mockImplementation(async () => ({
                transactions: [adjustedTx],
                adjustments,
            }))
        }

        it("builds with the dApp fee verbatim, then enqueues the calculator's raised txn with the adjustment surfaced", async () => {
            seedSenderInWallet()
            const adjustments = [
                {
                    index: 0,
                    originalFee: 1000n,
                    adjustedFee: 3000n,
                    reason: 'quantum-minimum',
                },
            ]
            quantumRaise(adjustments)

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink({ fee: '1000' }))
            })

            // The dApp fee reaches the builder untouched; the raise happens
            // after build, on the normalized txn.
            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: { microAlgos: 1000n } }),
            )
            expect(mockAssignFeeToGroup).toHaveBeenCalledExactlyOnceWith({
                transactions: [{ kind: 'offline-tx' }],
            })
            expect(mockAddSignRequest).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    txs: [adjustedTx],
                    feeAdjustments: adjustments,
                }),
            )
        })

        it('omits the adjustment delta when the deeplink set no explicit fee (Pera-set, not an override)', async () => {
            seedSenderInWallet()
            quantumRaise([
                {
                    index: 0,
                    originalFee: 1000n,
                    adjustedFee: 3000n,
                    reason: 'quantum-minimum',
                },
            ])

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink())
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: undefined }),
            )
            // The raised txn is still what gets signed…
            expect(mockAddSignRequest).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    txs: [adjustedTx],
                    // …but no original → adjusted delta is shown.
                    feeAdjustments: undefined,
                }),
            )
        })

        it("passes a non-quantum sender's dApp fee through with no adjustments", async () => {
            seedSenderInWallet()

            const { result } = renderHook(() => useKeyregDeeplink())

            await act(async () => {
                await result.current(baseOfflineDeeplink({ fee: '1000' }))
            })

            expect(mockOfflineKeyRegistration).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ staticFee: { microAlgos: 1000n } }),
            )
            expect(mockAddSignRequest).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    txs: [{ kind: 'offline-tx' }],
                    feeAdjustments: undefined,
                }),
            )
        })

        it('leaves staticFee undefined for a non-quantum sender with no dApp fee', async () => {
            seedSenderInWallet()

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
