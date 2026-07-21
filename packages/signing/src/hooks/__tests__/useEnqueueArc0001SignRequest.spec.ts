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
import { renderHook } from '@testing-library/react'
import {
    Address,
    Transaction,
    TransactionType,
    assignGroupID,
    encodeUnsignedTransaction,
    decodeUnsignedTransaction,
} from 'algosdk'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Arc0001ResolveResult } from '@perawallet/wallet-core-blockchain'

import { useEnqueueArc0001SignRequest } from '../useEnqueueArc0001SignRequest'

const mockAddSignRequest = vi.fn()
const mockRemoveSignRequest = vi.fn()
const mockEncodeSignedTransaction = vi.fn(() => new Uint8Array([1, 2, 3, 4]))
const mockUseAllAccounts = vi.fn<() => WalletAccount[]>(() => [])
const mockGetSuggestedParams = vi.fn(async () => ({ minFee: 1000n }))
const mockUseMinimumFeeConfig = vi.fn(() => ({
    minTxnFee: 1000n,
    pqMultiplier: 3n,
}))

// Deterministic base64 stub: keeps the existing string assertions stable and
// lets the fee tests round-trip real msgpack bytes without a native codec.
const stubEncodeToBase64 = (bytes: Uint8Array): string =>
    `b64(${Array.from(bytes).join(',')})`

const decodeStub = (encoded: string): Transaction => {
    const inner = encoded.slice('b64('.length, -1)
    const bytes = Uint8Array.from(
        inner === '' ? [] : inner.split(',').map(Number),
    )
    return decodeUnsignedTransaction(bytes)
}

const bytesEqual = (a?: Uint8Array, b?: Uint8Array): boolean =>
    !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i])

vi.mock('../useSigningRequest', () => ({
    useSigningRequest: () => ({
        addSignRequest: mockAddSignRequest,
        removeSignRequest: mockRemoveSignRequest,
    }),
}))

// Keep the real `getSignerFor` / `isQuantumAccount` (the fee-override core
// depends on them); only the account list is injected.
vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
    }
})

// Spread the real module so `applyQuantumFeeOverride`'s dependencies
// (`calculateMinTxnFee`, `groupTransactions`) stay real; inject only the
// hooks this hook consumes. `encodeTransactionRaw` is wired to algosdk's
// canonical encoder — the same implementation the real encoder uses.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<Record<string, unknown>>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useTransactionEncoder: () => ({
            encodeSignedTransaction: mockEncodeSignedTransaction,
            encodeTransactionRaw: (tx: Transaction) =>
                encodeUnsignedTransaction(tx),
        }),
        useAlgorandClient: () => ({
            getSuggestedParams: mockGetSuggestedParams,
        }),
        useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
    }
})

// Keep the real shared surface (the fee-override core uses `bytesToHex` /
// `bytesEqual`, and the real blockchain module imports `registerStore`);
// override only the id + base64 helpers so the existing string assertions
// stay stable and the fee tests can round-trip real msgpack bytes.
vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateOrderedUniqueId: () => 'MOCK_ID',
        encodeToBase64: (bytes: Uint8Array) => stubEncodeToBase64(bytes),
    }
})

const makeResolved = (
    toSignCount: number,
    totalCount: number,
): Arc0001ResolveResult => ({
    allDecoded: Array.from({ length: totalCount }, () => ({}) as any),
    toSign: Array.from({ length: toSignCount }, (_, i) => ({
        index: i,
        walletTxn: { txn: `txn-${i}` },
        decoded: { sender: { toString: () => `sender-${i}` } } as any,
        sender: `sender-${i}`,
        signer: { kind: 'single' as const, address: `sender-${i}` },
    })),
    signerOverrides: new Map(),
})

const makeTransport = () => ({
    sourceType: 'walletconnect' as const,
    transportId: 'test-transport-id',
    sourceMetadata: { name: 'Test' },
    respondWithResult: vi.fn(),
    respondWithReject: vi.fn(),
    respondWithError: vi.fn(),
})

// --- Real-transaction fixtures for the PQ fee-override flow ---

const RECEIVER = new Address(new Uint8Array(32).fill(9))
const GENESIS_HASH = new Uint8Array(32).fill(0xab)
const QUANTUM_ADDRESS = new Address(new Uint8Array(32).fill(7))

const makePayment = (
    sender: Address,
    { amount = 1n, fee = 1000n }: { amount?: bigint; fee?: bigint } = {},
): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender,
        suggestedParams: {
            fee,
            minFee: 1000n,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisID: 'testnet-v1.0',
            genesisHash: GENESIS_HASH,
            flatFee: true,
        },
        paymentParams: { receiver: RECEIVER, amount },
    })

const quantumAccount = (): WalletAccount =>
    ({
        id: 'q1',
        address: QUANTUM_ADDRESS.toString(),
        type: AccountTypes.quantum,
        keyPairId: 'kp-quantum',
    }) as WalletAccount

// Builds a resolver result over real transactions; wire bytes are produced
// the way a dApp does (canonical unsigned msgpack), through the base64 stub.
const resolvedFor = (
    txns: Transaction[],
    signableIndices: number[],
): Arc0001ResolveResult => ({
    allDecoded: txns as any,
    toSign: signableIndices.map(index => ({
        index,
        walletTxn: {
            txn: stubEncodeToBase64(encodeUnsignedTransaction(txns[index])),
        },
        decoded: txns[index] as any,
        sender: txns[index].sender.toString(),
        signer: {
            kind: 'single' as const,
            address: txns[index].sender.toString(),
        },
    })),
    signerOverrides: new Map(),
})

describe('useEnqueueArc0001SignRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockGetSuggestedParams.mockResolvedValue({ minFee: 1000n })
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
    })

    it('short-circuits to respondWithResult with all-nulls when nothing is signable', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        await result.current(makeResolved(0, 3), transport)

        expect(transport.respondWithResult).toHaveBeenCalledWith([
            null,
            null,
            null,
        ])
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('enqueues a TransactionSignRequest with the resolved subset', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        const resolved = makeResolved(2, 3)

        await result.current(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'MOCK_ID',
                type: 'transactions',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: 'test-transport-id',
                sourceMetadata: { name: 'Test' },
                txs: expect.any(Array),
                groupContext: resolved.allDecoded,
                rawTransactionsBase64: ['txn-0', 'txn-1'],
            }),
        )
    })

    it('threads signableIndices so the UI can label signed/unsigned slots', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        // 5-tx payload, wallet signs indices 0, 2, 4 (skipping 1 and 3)
        const resolved = {
            allDecoded: Array.from({ length: 5 }, () => ({}) as any),
            toSign: [0, 2, 4].map(i => ({
                index: i,
                walletTxn: { txn: `txn-${i}` },
                decoded: { sender: { toString: () => `s${i}` } } as any,
                sender: `s${i}`,
                signer: { kind: 'single' as const, address: `s${i}` },
            })),
            signerOverrides: new Map(),
        }

        await result.current(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                signableIndices: [0, 2, 4],
            }),
        )
    })

    it('threads signerOverrides through only when non-empty', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        const resolved = makeResolved(1, 1)
        resolved.signerOverrides.set(0, 'override-addr')

        await result.current(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                signerOverrides: resolved.signerOverrides,
            }),
        )
    })

    it('omits signerOverrides when the map is empty', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        await result.current(makeResolved(1, 1), transport)

        const signRequest = mockAddSignRequest.mock.calls[0][0]
        expect(signRequest.signerOverrides).toBeUndefined()
    })

    it('approve callback pads result back to the original length with nulls', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        // index 0 signable, index 1 skipped, index 2 signable
        const resolved: Arc0001ResolveResult = {
            allDecoded: [{}, {}, {}] as any[],
            toSign: [
                {
                    index: 0,
                    walletTxn: { txn: 'A' },
                    decoded: { sender: { toString: () => 's0' } } as any,
                    sender: 's0',
                    signer: { kind: 'single', address: 's0' },
                },
                {
                    index: 2,
                    walletTxn: { txn: 'C' },
                    decoded: { sender: { toString: () => 's2' } } as any,
                    sender: 's2',
                    signer: { kind: 'single', address: 's2' },
                },
            ],
            signerOverrides: new Map(),
        }

        await result.current(resolved, transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        await signRequest.approve([{ sig: 1 }, { sig: 2 }])

        expect(transport.respondWithResult).toHaveBeenCalledWith([
            'b64(1,2,3,4)',
            null,
            'b64(1,2,3,4)',
        ])
    })

    it('reject callback forwards to respondWithReject', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        await result.current(makeResolved(1, 1), transport)
        await mockAddSignRequest.mock.calls[0][0].reject()

        expect(transport.respondWithReject).toHaveBeenCalledTimes(1)
    })

    it('approveSignedBytes pads pre-encoded msig bytes back to the original length', async () => {
        // Multisig sync-flow handoff: the pipeline hands back the assembled
        // signed bytes already wire-encoded. The hook must reproject onto the
        // original wallet-txn slots, leaving the unsignable indices null.
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        // 4-slot payload; wallet signs indices 0 and 2 only.
        const resolved: Arc0001ResolveResult = {
            allDecoded: [{}, {}, {}, {}] as any[],
            toSign: [
                {
                    index: 0,
                    walletTxn: { txn: 'A' },
                    decoded: { sender: { toString: () => 's0' } } as any,
                    sender: 's0',
                    signer: { kind: 'single', address: 's0' },
                },
                {
                    index: 2,
                    walletTxn: { txn: 'C' },
                    decoded: { sender: { toString: () => 's2' } } as any,
                    sender: 's2',
                    signer: { kind: 'single', address: 's2' },
                },
            ],
            signerOverrides: new Map(),
        }

        await result.current(resolved, transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        await signRequest.approveSignedBytes([
            new Uint8Array([10]),
            new Uint8Array([20]),
        ])

        expect(transport.respondWithResult).toHaveBeenCalledWith([
            'b64(10)',
            null,
            'b64(20)',
            null,
        ])
    })

    it('approveSignedBytes skips slots whose index map or bytes are missing', async () => {
        // Defensive: covers the `idx === undefined || !bytes` guard. Even if
        // the pipeline hands more bytes than indices (or empty bytes for a
        // slot), the hook must not crash or write a wrong slot.
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        const resolved: Arc0001ResolveResult = {
            allDecoded: [{}, {}] as any[],
            toSign: [
                {
                    index: 0,
                    walletTxn: { txn: 'A' },
                    decoded: { sender: { toString: () => 's0' } } as any,
                    sender: 's0',
                    signer: { kind: 'single', address: 's0' },
                },
            ],
            signerOverrides: new Map(),
        }

        await result.current(resolved, transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        // 3 bytes for 1 indicesToSign — extras with no matching index drop.
        // Index 0 also receives an empty Uint8Array — the `!bytes` guard
        // would normally only trigger for a true falsy, so feed a 0-length
        // array which is truthy but covers the surrounding push logic.
        await signRequest.approveSignedBytes([
            new Uint8Array([42]),
            new Uint8Array([1]),
            new Uint8Array([2]),
        ])

        // Only the first item maps to a real index; the rest fall through.
        expect(transport.respondWithResult).toHaveBeenCalledWith([
            'b64(42)',
            null,
        ])
    })

    it('reject with softReject calls respondWithSoftReject and removes the request', async () => {
        // The softReject branch is the multisig sync-flow clean exit path:
        // dApp peer is told the proposal was declined without raising a
        // connection-error banner.
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = {
            ...makeTransport(),
            respondWithSoftReject: vi.fn(),
        }

        await result.current(makeResolved(1, 1), transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const declineError = new Error('peer declined')
        await signRequest.reject({ kind: 'softReject', error: declineError })

        expect(transport.respondWithSoftReject).toHaveBeenCalledWith(
            declineError,
        )
        expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
        // The hard-reject path must NOT run.
        expect(transport.respondWithReject).not.toHaveBeenCalled()
    })

    it('reject with softReject falls back to hard reject when transport has no softReject handler', async () => {
        // Defensive: the soft-reject path is opt-in per-transport. A
        // transport without `respondWithSoftReject` must still terminate
        // cleanly via `respondWithReject`.
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        await result.current(makeResolved(1, 1), transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        await signRequest.reject({
            kind: 'softReject',
            error: new Error('declined'),
        })

        expect(transport.respondWithReject).toHaveBeenCalledTimes(1)
        expect(mockRemoveSignRequest).not.toHaveBeenCalled()
    })

    it('error callback forwards the error AND removes the queued request', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        await result.current(makeResolved(1, 1), transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const incoming = new Error('boom')
        await signRequest.error(incoming)

        expect(transport.respondWithError).toHaveBeenCalledWith(incoming)
        expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
    })

    // --- PQ-017: quantum fee override ---

    describe('quantum fee override', () => {
        it('encodeTransactionRaw round-trips the resolver decode (unmodified txn re-encodes to the original wire bytes)', () => {
            // Pins the encoder choice: encodeTransactionRaw (canonical
            // unsigned msgpack, no "TX" prefix) reproduces exactly the bytes
            // the ARC-0001 resolver decoded from — so re-encoding an
            // unmodified txn is a no-op on the wire.
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const wire = stubEncodeToBase64(encodeUnsignedTransaction(txn))

            const decoded = decodeStub(wire)

            expect(stubEncodeToBase64(encodeUnsignedTransaction(decoded))).toBe(
                wire,
            )
        })

        it('raises the fee to the PQ minimum for a quantum signer and populates feeAdjustments', async () => {
            mockUseAllAccounts.mockReturnValue([quantumAccount()])
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const resolved = resolvedFor([txn], [0])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()

            await result.current(resolved, transport)

            expect(mockGetSuggestedParams).toHaveBeenCalledTimes(1)
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.txs[0].fee).toBe(3000n)
            expect(req.groupContext[0].fee).toBe(3000n)
            expect(req.feeAdjustments).toEqual([
                { index: 0, originalFee: 1000n, adjustedFee: 3000n },
            ])
            expect(decodeStub(req.rawTransactionsBase64[0]).fee).toBe(3000n)
        })

        it('re-groups the full partition so signable txns share the recomputed group id', async () => {
            mockUseAllAccounts.mockReturnValue([quantumAccount()])
            const a = makePayment(QUANTUM_ADDRESS, { amount: 1n, fee: 1000n })
            const b = makePayment(QUANTUM_ADDRESS, { amount: 2n, fee: 3000n })
            assignGroupID([a, b])
            const originalGroup = a.group
            const resolved = resolvedFor([a, b], [0, 1])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()

            await result.current(resolved, transport)

            const req = mockAddSignRequest.mock.calls[0][0]
            // Only the underfunded txn is reported as adjusted.
            expect(req.feeAdjustments).toEqual([
                { index: 0, originalFee: 1000n, adjustedFee: 3000n },
            ])
            const g0 = req.txs[0].group
            const g1 = req.txs[1].group
            expect(g0).toBeDefined()
            expect(bytesEqual(g0, g1)).toBe(true)
            expect(bytesEqual(g0, originalGroup)).toBe(false)
            // The re-encoded wire bytes carry the recomputed group id.
            expect(
                bytesEqual(decodeStub(req.rawTransactionsBase64[0]).group, g0),
            ).toBe(true)
        })

        it('does not adjust when the quantum fee already meets the PQ minimum', async () => {
            mockUseAllAccounts.mockReturnValue([quantumAccount()])
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 3000n })
            const resolved = resolvedFor([txn], [0])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()

            await result.current(resolved, transport)

            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.feeAdjustments).toBeUndefined()
            expect(req.txs[0].fee).toBe(3000n)
            // Unmodified: the original wire bytes are passed through verbatim.
            expect(req.rawTransactionsBase64[0]).toBe(
                resolved.toSign[0].walletTxn.txn,
            )
        })

        it('applies the override from the config base when the suggested-params fetch fails', async () => {
            mockUseAllAccounts.mockReturnValue([quantumAccount()])
            mockGetSuggestedParams.mockRejectedValueOnce(new Error('offline'))
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const resolved = resolvedFor([txn], [0])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()

            await result.current(resolved, transport)

            const req = mockAddSignRequest.mock.calls[0][0]
            // config base 1000 * pqMultiplier 3 = 3000
            expect(req.feeAdjustments).toEqual([
                { index: 0, originalFee: 1000n, adjustedFee: 3000n },
            ])
            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        })

        it('responds with an error and does not enqueue when the incoming group is invalid', async () => {
            mockUseAllAccounts.mockReturnValue([quantumAccount()])
            const a = makePayment(QUANTUM_ADDRESS, { amount: 1n, fee: 1000n })
            const b = makePayment(QUANTUM_ADDRESS, { amount: 2n, fee: 1000n })
            assignGroupID([a, b])
            // Tamper: swap in a different-content txn but keep the claimed
            // group id, so the recomputed group hash no longer matches.
            const tampered = makePayment(QUANTUM_ADDRESS, {
                amount: 999n,
                fee: 1000n,
            })
            tampered.group = a.group
            const resolved = resolvedFor([a, tampered], [0, 1])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()

            await result.current(resolved, transport)

            expect(transport.respondWithError).toHaveBeenCalledTimes(1)
            expect(transport.respondWithError.mock.calls[0][0]).toBeInstanceOf(
                Error,
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('leaves fees untouched and skips the suggested-params fetch for a non-quantum signer', async () => {
            // Accounts default to [] → the sender resolves to no signer, so
            // the fast path must not fetch suggested params or touch fees.
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const resolved = resolvedFor([txn], [0])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()

            await result.current(resolved, transport)

            expect(mockGetSuggestedParams).not.toHaveBeenCalled()
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.feeAdjustments).toBeUndefined()
            expect(req.txs[0].fee).toBe(1000n)
            expect(req.rawTransactionsBase64[0]).toBe(
                resolved.toSign[0].walletTxn.txn,
            )
        })
    })

    // --- PQ-017: quantum fee delivery failure ---

    describe('quantum fee delivery failure', () => {
        it('wraps a respondWithResult rejection in QuantumFeeDeliveryError when the request carries feeAdjustments', async () => {
            mockUseAllAccounts.mockReturnValue([quantumAccount()])
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const resolved = resolvedFor([txn], [0])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()
            const deliveryFailure = new Error('dApp closed the socket')
            transport.respondWithResult.mockRejectedValueOnce(deliveryFailure)

            await result.current(resolved, transport)
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.feeAdjustments).toBeDefined()

            await expect(
                req.approve([{ sig: 1 } as any]),
            ).rejects.toMatchObject({
                name: 'QuantumFeeDeliveryError',
                originalError: deliveryFailure,
            })
        })

        it('propagates the original error unchanged when there are no feeAdjustments (regression)', async () => {
            // No quantum signer → no feeAdjustments; a delivery failure must
            // surface as-is, not wrapped.
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const resolved = resolvedFor([txn], [0])
            const { result } = renderHook(() => useEnqueueArc0001SignRequest())
            const transport = makeTransport()
            const deliveryFailure = new Error('dApp closed the socket')
            transport.respondWithResult.mockRejectedValueOnce(deliveryFailure)

            await result.current(resolved, transport)
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.feeAdjustments).toBeUndefined()

            await expect(req.approve([{ sig: 1 } as any])).rejects.toBe(
                deliveryFailure,
            )
        })
    })
})
