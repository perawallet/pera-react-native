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
import {
    Address,
    Transaction,
    TransactionType,
    assignGroupID,
    decodeUnsignedTransaction,
    encodeUnsignedTransaction,
} from 'algosdk'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Arc0001ResolveResult } from '@perawallet/wallet-core-blockchain'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import {
    FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER,
    type EnqueueArc0001SignRequestDeps,
    type ExternalSignTxnTransport,
} from '@perawallet/wallet-core-signing'

import { assignFeeToGroup } from '../assignMinimumFeesToGroup'
import { enqueueArc0001SignRequest } from '../enqueueArc0001SignRequest'

const mockAddSignRequest = vi.fn()
const mockRemoveSignRequest = vi.fn()
const mockFetchSuggestedMinFee = vi.fn<() => Promise<bigint>>()
const mockEncodeSignedTransaction = vi.fn(() => new Uint8Array([1, 2, 3, 4]))

// Real algosdk encoder, the same one the blockchain module wraps; only the
// signed-transaction encoder is stubbed since the specs pass placeholder signatures.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<Record<string, unknown>>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        encodeSignedTransaction: () => mockEncodeSignedTransaction(),
        encodeTransactionRaw: (tx: Transaction) =>
            encodeUnsignedTransaction(tx),
    }
})

const b64 = (...bytes: number[]): string =>
    encodeToBase64(new Uint8Array(bytes))

const bytesEqual = (a?: Uint8Array, b?: Uint8Array): boolean =>
    !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i])

const decodeWire = (wire: string): Transaction =>
    decodeUnsignedTransaction(decodeFromBase64(wire))

const makeDeps = (
    accounts: WalletAccount[] = [],
): EnqueueArc0001SignRequestDeps => ({
    addSignRequest: mockAddSignRequest,
    removeSignRequest: mockRemoveSignRequest,
    assignFeeToGroup: params =>
        assignFeeToGroup(params, {
            accounts,
            fetchSuggestedMinFee: mockFetchSuggestedMinFee,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        }),
})

// The resolver invariant `allDecoded[toSign[i].index] === toSign[i].decoded`
// must hold in fixtures too: the fee planner resolves signers from the
// full-group array, not the subset.
const resolvedWithSlots = (
    totalCount: number,
    signableIndices: number[],
): Arc0001ResolveResult => {
    const toSign = signableIndices.map(i => ({
        index: i,
        walletTxn: { txn: `txn-${i}` },
        decoded: { sender: { toString: () => `sender-${i}` } } as any,
        sender: `sender-${i}`,
        signer: { kind: 'single' as const, address: `sender-${i}` },
    }))
    return {
        allDecoded: Array.from(
            { length: totalCount },
            (_, i) => toSign.find(t => t.index === i)?.decoded ?? ({} as any),
        ),
        toSign,
        signerOverrides: new Map(),
    }
}

const makeResolved = (
    toSignCount: number,
    totalCount: number,
): Arc0001ResolveResult =>
    resolvedWithSlots(
        totalCount,
        Array.from({ length: toSignCount }, (_, i) => i),
    )

const makeTransport = () => ({
    sourceType: 'walletconnect' as const,
    transportId: 'test-transport-id',
    sourceMetadata: { name: 'Test' },
    respondWithResult: vi.fn(),
    respondWithReject: vi.fn(),
    respondWithError: vi.fn(),
})

const enqueue = (
    resolved: Arc0001ResolveResult,
    transport: ReturnType<typeof makeTransport> &
        Partial<ExternalSignTxnTransport>,
    accounts: WalletAccount[] = [],
) => enqueueArc0001SignRequest(resolved, transport, makeDeps(accounts))

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

// Wire bytes are produced the way a dApp does: canonical unsigned msgpack.
const resolvedFor = (
    txns: Transaction[],
    signableIndices: number[],
): Arc0001ResolveResult => ({
    allDecoded: txns as any,
    toSign: signableIndices.map(index => ({
        index,
        walletTxn: {
            txn: encodeToBase64(encodeUnsignedTransaction(txns[index])),
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

describe('enqueueArc0001SignRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchSuggestedMinFee.mockResolvedValue(1000n)
    })

    it('short-circuits to respondWithResult with all-nulls when nothing is signable', async () => {
        const transport = makeTransport()

        const outcome = await enqueue(makeResolved(0, 3), transport)

        expect(outcome).toBeNull()
        expect(transport.respondWithResult).toHaveBeenCalledWith([
            null,
            null,
            null,
        ])
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('enqueues a TransactionSignRequest with the resolved subset and returns it', async () => {
        const transport = makeTransport()
        const resolved = makeResolved(2, 3)

        const outcome = await enqueue(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: expect.any(String),
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
        expect(outcome).toBe(mockAddSignRequest.mock.calls[0][0])
    })

    it('threads signableIndices so the UI can label signed/unsigned slots', async () => {
        const transport = makeTransport()

        await enqueue(resolvedWithSlots(5, [0, 2, 4]), transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({ signableIndices: [0, 2, 4] }),
        )
    })

    it('threads signerOverrides through only when non-empty', async () => {
        const transport = makeTransport()
        const resolved = makeResolved(1, 1)
        resolved.signerOverrides.set(0, 'override-addr')

        await enqueue(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                signerOverrides: resolved.signerOverrides,
            }),
        )
    })

    it('omits signerOverrides when the map is empty', async () => {
        await enqueue(makeResolved(1, 1), makeTransport())

        expect(
            mockAddSignRequest.mock.calls[0][0].signerOverrides,
        ).toBeUndefined()
    })

    it('approve callback pads result back to the original length with nulls', async () => {
        const transport = makeTransport()

        await enqueue(resolvedWithSlots(3, [0, 2]), transport)
        await mockAddSignRequest.mock.calls[0][0].approve([
            { sig: 1 },
            { sig: 2 },
        ])

        expect(transport.respondWithResult).toHaveBeenCalledWith([
            b64(1, 2, 3, 4),
            null,
            b64(1, 2, 3, 4),
        ])
    })

    it('reject callback forwards to respondWithReject', async () => {
        const transport = makeTransport()

        await enqueue(makeResolved(1, 1), transport)
        await mockAddSignRequest.mock.calls[0][0].reject()

        expect(transport.respondWithReject).toHaveBeenCalledTimes(1)
    })

    it('approveSignedBytes pads pre-encoded msig bytes back to the original length', async () => {
        const transport = makeTransport()

        await enqueue(resolvedWithSlots(4, [0, 2]), transport)
        await mockAddSignRequest.mock.calls[0][0].approveSignedBytes([
            new Uint8Array([10]),
            new Uint8Array([20]),
        ])

        expect(transport.respondWithResult).toHaveBeenCalledWith([
            b64(10),
            null,
            b64(20),
            null,
        ])
    })

    it('reject with softReject calls respondWithSoftReject and removes the request', async () => {
        const transport = { ...makeTransport(), respondWithSoftReject: vi.fn() }

        await enqueue(makeResolved(1, 1), transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const declineError = new Error('peer declined')
        await signRequest.reject({ kind: 'softReject', error: declineError })

        expect(transport.respondWithSoftReject).toHaveBeenCalledWith(
            declineError,
        )
        expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
        expect(transport.respondWithReject).not.toHaveBeenCalled()
    })

    it('reject with softReject falls back to hard reject when transport has no softReject handler', async () => {
        const transport = makeTransport()

        await enqueue(makeResolved(1, 1), transport)
        await mockAddSignRequest.mock.calls[0][0].reject({
            kind: 'softReject',
            error: new Error('declined'),
        })

        expect(transport.respondWithReject).toHaveBeenCalledTimes(1)
        expect(mockRemoveSignRequest).not.toHaveBeenCalled()
    })

    it('threads verifiedOrigin and sourceType for an injected dapp source', async () => {
        const transport = {
            ...makeTransport(),
            sourceType: 'injected' as const,
            verifiedOrigin: 'https://dapp.example',
        }

        await enqueue(makeResolved(1, 1), transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                sourceType: 'injected',
                verifiedOrigin: 'https://dapp.example',
            }),
        )
    })

    it('error callback forwards the error AND removes the queued request', async () => {
        const transport = makeTransport()

        await enqueue(makeResolved(1, 1), transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const incoming = new Error('boom')
        await signRequest.error(incoming)

        expect(transport.respondWithError).toHaveBeenCalledWith(incoming)
        expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
    })

    describe('quantum fee override', () => {
        it('re-encodes an unmodified transaction to the original wire bytes', () => {
            // encodeTransactionRaw (canonical unsigned msgpack, no "TX"
            // prefix) must reproduce what the resolver decoded from, so the
            // no-raise path stays byte-identical.
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const wire = encodeToBase64(encodeUnsignedTransaction(txn))

            expect(
                encodeToBase64(encodeUnsignedTransaction(decodeWire(wire))),
            ).toBe(wire)
        })

        it('raises the fee to the PQ minimum for a quantum signer and populates feeAdjustments', async () => {
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })

            await enqueue(resolvedFor([txn], [0]), makeTransport(), [
                quantumAccount(),
            ])

            expect(mockFetchSuggestedMinFee).toHaveBeenCalledTimes(1)
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.txs[0].fee).toBe(3000n)
            expect(req.groupContext[0].fee).toBe(3000n)
            expect(req.feeAdjustments).toEqual([
                {
                    index: 0,
                    originalFee: 1000n,
                    adjustedFee: 3000n,
                    reason: 'quantum-minimum',
                },
            ])
            expect(decodeWire(req.rawTransactionsBase64[0]).fee).toBe(3000n)
        })

        it('re-groups the full partition so signable txns share the recomputed group id', async () => {
            const a = makePayment(QUANTUM_ADDRESS, { amount: 1n, fee: 1000n })
            const b = makePayment(QUANTUM_ADDRESS, { amount: 2n, fee: 3000n })
            assignGroupID([a, b])
            const originalGroup = a.group

            await enqueue(resolvedFor([a, b], [0, 1]), makeTransport(), [
                quantumAccount(),
            ])

            const req = mockAddSignRequest.mock.calls[0][0]
            // Every quantum txn pays the surcharge: the 3000 µAlgo one was
            // pooling a fee for an inner txn, not sitting at its own minimum.
            expect(req.feeAdjustments).toEqual([
                {
                    index: 0,
                    originalFee: 1000n,
                    adjustedFee: 3000n,
                    reason: 'quantum-minimum',
                },
                {
                    index: 1,
                    originalFee: 3000n,
                    adjustedFee: 5000n,
                    reason: 'quantum-minimum',
                },
            ])
            const g0 = req.txs[0].group
            expect(g0).toBeDefined()
            expect(bytesEqual(g0, req.txs[1].group)).toBe(true)
            expect(bytesEqual(g0, originalGroup)).toBe(false)
            expect(
                bytesEqual(decodeWire(req.rawTransactionsBase64[0]).group, g0),
            ).toBe(true)
        })

        it('applies the config base when the suggested fee resolves to its fallback of 0', async () => {
            mockFetchSuggestedMinFee.mockResolvedValueOnce(0n)
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })

            await enqueue(resolvedFor([txn], [0]), makeTransport(), [
                quantumAccount(),
            ])

            expect(mockAddSignRequest.mock.calls[0][0].feeAdjustments).toEqual([
                {
                    index: 0,
                    originalFee: 1000n,
                    adjustedFee: 3000n,
                    reason: 'quantum-minimum',
                },
            ])
        })

        it('responds with an error and does not enqueue when the incoming group is invalid', async () => {
            const a = makePayment(QUANTUM_ADDRESS, { amount: 1n, fee: 1000n })
            const b = makePayment(QUANTUM_ADDRESS, { amount: 2n, fee: 1000n })
            assignGroupID([a, b])
            // Same claimed group id over different content: the recomputed
            // group hash no longer matches.
            const tampered = makePayment(QUANTUM_ADDRESS, {
                amount: 999n,
                fee: 1000n,
            })
            tampered.group = a.group
            const transport = makeTransport()

            await enqueue(resolvedFor([a, tampered], [0, 1]), transport, [
                quantumAccount(),
            ])

            expect(transport.respondWithError).toHaveBeenCalledTimes(1)
            expect(transport.respondWithError.mock.calls[0][0]).toBeInstanceOf(
                Error,
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('leaves fees untouched and skips the suggested-params fetch for a non-quantum signer', async () => {
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const resolved = resolvedFor([txn], [0])

            await enqueue(resolved, makeTransport())

            expect(mockFetchSuggestedMinFee).not.toHaveBeenCalled()
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.feeAdjustments).toBeUndefined()
            expect(req.txs[0].fee).toBe(1000n)
            expect(req.rawTransactionsBase64[0]).toBe(
                resolved.toSign[0].walletTxn.txn,
            )
        })
    })

    describe('fee-adjustment delivery failure', () => {
        it('wraps a respondWithResult rejection in FeeAdjustmentDeliveryError when the request carries feeAdjustments', async () => {
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const transport = makeTransport()
            const deliveryFailure = new Error('dApp closed the socket')
            transport.respondWithResult.mockRejectedValueOnce(deliveryFailure)

            await enqueue(resolvedFor([txn], [0]), transport, [
                quantumAccount(),
            ])
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.feeAdjustments).toBeDefined()

            await expect(
                req.approve([{ sig: 1 } as any]),
            ).rejects.toMatchObject({
                name: 'FeeAdjustmentDeliveryError',
                originalError: deliveryFailure,
                message: expect.stringContaining(
                    FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER,
                ),
            })
        })

        it('propagates the original error unchanged when there are no feeAdjustments', async () => {
            const txn = makePayment(QUANTUM_ADDRESS, { fee: 1000n })
            const transport = makeTransport()
            const deliveryFailure = new Error('dApp closed the socket')
            transport.respondWithResult.mockRejectedValueOnce(deliveryFailure)

            await enqueue(resolvedFor([txn], [0]), transport)
            const req = mockAddSignRequest.mock.calls[0][0]
            expect(req.feeAdjustments).toBeUndefined()

            await expect(req.approve([{ sig: 1 } as any])).rejects.toBe(
                deliveryFailure,
            )
        })
    })
})
