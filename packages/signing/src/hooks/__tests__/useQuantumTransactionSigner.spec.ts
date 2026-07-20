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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockSignTransactionsWithKey = vi.fn()
const mockGetQuantumPublicKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signTransactionsWithKey: (...args: unknown[]) =>
            mockSignTransactionsWithKey(...args),
        getQuantumPublicKey: (...args: unknown[]) =>
            mockGetQuantumPublicKey(...args),
    }),
}))

const encodeTransactionMock = vi.fn()
const encodeTransactionRawMock = vi.fn()
const assembleQuantumSignedTxnMock = vi.fn()

// `assembleQuantumSignedTxn`'s real implementation goes through Seam B
// (`@joe-p/algosdk`), which creates its scheme/key byte arrays via
// `TextEncoder`/native `Uint8Array` and checks `instanceof Uint8Array`
// internally. Under vitest's jsdom environment (needed here for
// `renderHook`) that check fails cross-realm — see the node-environment
// quantum adapter spec, which exercises the real path without `renderHook`.
// This hook test mocks the assembly step per the task's documented option,
// asserting the exact byte-encoding split (prefixed vs unprefixed) the hook
// is responsible for.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useTransactionEncoder: () => ({
            encodeTransaction: encodeTransactionMock,
            encodeTransactionRaw: encodeTransactionRawMock,
        }),
        assembleQuantumSignedTxn: (...args: unknown[]) =>
            assembleQuantumSignedTxnMock(...args),
    }
})

import { isQuantumSignedTransaction } from '@perawallet/wallet-core-blockchain'
import { SIGNING_KEY_DOMAIN } from '../../constants'
import {
    useQuantumTransactionSigner,
    QUANTUM_SIGN_BATCH_SIZE,
} from '../useQuantumTransactionSigner'

const quantumAccount = {
    id: 'acc-quantum',
    address: 'QUANTUM_ADDR',
    type: 'quantum',
    keyPairId: 'quantum-key-1',
} as unknown as WalletAccount

const fixedPublicKey = new Uint8Array([7, 7, 7])
const fixedFalconSignature = new Uint8Array([4, 2])

const makeTxn = (senderAddr: string) =>
    ({
        sender: {
            publicKey: new Uint8Array(32),
            toString: () => senderAddr,
        },
    }) as never

describe('useQuantumTransactionSigner', () => {
    beforeEach(() => {
        mockSignTransactionsWithKey.mockReset()
        mockGetQuantumPublicKey.mockReset().mockReturnValue(fixedPublicKey)
        encodeTransactionMock.mockReset().mockReturnValue(new Uint8Array([1]))
        encodeTransactionRawMock
            .mockReset()
            .mockReturnValue(new Uint8Array([2]))
        assembleQuantumSignedTxnMock
            .mockReset()
            .mockResolvedValue(new Uint8Array([9, 9, 9]))
    })

    test('signs a single quantum transaction into a pqsig carrier', async () => {
        mockSignTransactionsWithKey.mockResolvedValue([fixedFalconSignature])

        const { result } = renderHook(() => useQuantumTransactionSigner())
        const txn = makeTxn('QUANTUM_ADDR')

        const signed = await result.current.signQuantumTransactions(
            [txn],
            [0],
            quantumAccount,
        )

        expect(signed).toHaveLength(1)
        expect(signed[0].txn).toBe(txn)
        expect(isQuantumSignedTransaction(signed[0])).toBe(true)
        expect(signed[0].pqSignedBytes.length).toBeGreaterThan(0)

        // Falcon signing got the PREFIXED payload (`encodeTransaction` —
        // "TX" + msgpack, the bytes that get hashed and signed).
        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'quantum-key-1',
            SIGNING_KEY_DOMAIN,
            [new Uint8Array([1])],
        )
        expect(encodeTransactionMock).toHaveBeenCalledWith(txn)

        // Assembly got the UNPREFIXED bytes (`encodeTransactionRaw`), the
        // KMS-reported public key, and the raw Falcon signature verbatim.
        expect(encodeTransactionRawMock).toHaveBeenCalledWith(txn)
        expect(assembleQuantumSignedTxnMock).toHaveBeenCalledWith({
            unsignedTxnBytes: new Uint8Array([2]),
            publicKey: fixedPublicKey,
            falconSignature: fixedFalconSignature,
        })
        expect(mockGetQuantumPublicKey).toHaveBeenCalledWith('quantum-key-1')
    })

    test('signs only the indexes in indexesToSign', async () => {
        mockSignTransactionsWithKey.mockResolvedValue([fixedFalconSignature])

        const { result } = renderHook(() => useQuantumTransactionSigner())
        const txn0 = makeTxn('QUANTUM_ADDR')
        const txn1 = makeTxn('QUANTUM_ADDR')

        const signed = await result.current.signQuantumTransactions(
            [txn0, txn1],
            [1],
            quantumAccount,
        )

        expect(signed).toHaveLength(1)
        expect(signed[0].txn).toBe(txn1)
        expect(encodeTransactionMock).toHaveBeenCalledExactlyOnceWith(txn1)
        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'quantum-key-1',
            SIGNING_KEY_DOMAIN,
            [new Uint8Array([1])],
        )
    })

    test('rekey: signing account address differs from txn sender but still yields a carrier', async () => {
        mockSignTransactionsWithKey.mockResolvedValue([fixedFalconSignature])

        const { result } = renderHook(() => useQuantumTransactionSigner())
        // The txn's sender is a DIFFERENT quantum address than the signing
        // account's own address — i.e. this txn was rekeyed to
        // `quantumAccount`. The hook does not need to special-case this: the
        // fork sets `sgnr` automatically from the decoded txn's own sender
        // vs. the signer's derived quantum address (see quantumAdapter.ts).
        const txn = makeTxn('OTHER_QUANTUM_ADDR')

        const signed = await result.current.signQuantumTransactions(
            [txn],
            [0],
            quantumAccount,
        )

        expect(signed).toHaveLength(1)
        expect(isQuantumSignedTransaction(signed[0])).toBe(true)
        expect(signed[0].pqSignedBytes.length).toBeGreaterThan(0)
        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'quantum-key-1',
            SIGNING_KEY_DOMAIN,
            [new Uint8Array([1])],
        )
        expect(assembleQuantumSignedTxnMock).toHaveBeenCalledWith({
            unsignedTxnBytes: new Uint8Array([2]),
            publicKey: fixedPublicKey,
            falconSignature: fixedFalconSignature,
        })
    })

    test('signs large batches in chunks, preserving order [PERA-3353 batching pattern]', async () => {
        mockSignTransactionsWithKey.mockImplementation(
            (_id: string, _domain: string, encoded: Uint8Array[]) =>
                Promise.resolve(encoded.map(() => fixedFalconSignature)),
        )

        const total = QUANTUM_SIGN_BATCH_SIZE * 2 + 3
        const txns = Array.from({ length: total }, () =>
            makeTxn('QUANTUM_ADDR'),
        )
        const indexes = txns.map((_, i) => i)

        const { result } = renderHook(() => useQuantumTransactionSigner())
        const signed = await result.current.signQuantumTransactions(
            txns,
            indexes,
            quantumAccount,
        )

        const calls = mockSignTransactionsWithKey.mock.calls
        expect(calls).toHaveLength(3)
        expect(calls[0][2]).toHaveLength(QUANTUM_SIGN_BATCH_SIZE)
        expect(calls[1][2]).toHaveLength(QUANTUM_SIGN_BATCH_SIZE)
        expect(calls[2][2]).toHaveLength(3)

        expect(signed).toHaveLength(total)
        expect(signed.every(s => isQuantumSignedTransaction(s))).toBe(true)
        signed.forEach((s, i) => expect(s.txn).toBe(txns[i]))
    })
})
