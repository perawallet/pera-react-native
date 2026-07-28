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
const mockGetPQSigningInfo = vi.fn()
let mockAccounts: WalletAccount[] = []

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signTransactionsWithKey: (...args: unknown[]) =>
            mockSignTransactionsWithKey(...args),
        getPQSigningInfo: (...args: unknown[]) => mockGetPQSigningInfo(...args),
    }),
}))

const mockIsHDWalletAccount = vi.fn()
const mockIsAlgo25Account = vi.fn()
const mockIsQuantumAccount = vi.fn()
const mockIsHardwareWalletAccount = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAccountsStore: (selector: (state: unknown) => unknown) =>
            selector({ accounts: mockAccounts }),
        isHDWalletAccount: (acc: WalletAccount) => mockIsHDWalletAccount(acc),
        isAlgo25Account: (acc: WalletAccount) => mockIsAlgo25Account(acc),
        isQuantumAccount: (acc: WalletAccount) => mockIsQuantumAccount(acc),
        isHardwareWalletAccount: (acc: WalletAccount) =>
            mockIsHardwareWalletAccount(acc),
    }
})

const encodeTransactionMock = vi.fn()
const assemblePQSignedTransactionMock = vi.fn()
const pqSigningDigestMock = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useTransactionEncoder: () => ({
            encodeTransaction: encodeTransactionMock,
        }),
        encodeAlgorandAddress: () => 'SENDER_PK',
        Address: { fromString: (addr: string) => ({ _addr: addr }) },
        assemblePQSignedTransaction: (...args: unknown[]) =>
            assemblePQSignedTransactionMock(...args),
        pqSigningDigest: (...args: unknown[]) => pqSigningDigestMock(...args),
    }
})

import { pqSigningDigest } from '@perawallet/wallet-core-blockchain'
import { SIGNING_KEY_DOMAIN } from '../../constants'
import {
    useLocalKeyTransactionSigner,
    SIGN_BATCH_SIZE,
} from '../useLocalKeyTransactionSigner'

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-hd-child',
    type: 'hdWallet',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9,
    },
} as unknown as WalletAccount

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-algo25-ed25519',
    type: 'algo25',
} as unknown as WalletAccount

const quantumAccount = {
    address: 'QUANTUM_ADDR',
    keyPairId: 'key-quantum',
    type: 'quantum',
} as unknown as WalletAccount

const participantWithRekey = {
    address: 'PARTICIPANT_ADDR',
    type: 'algo25',
    keyPairId: 'key-participant-ed25519',
    rekeyAddress: 'ALGO25_ADDR',
} as unknown as WalletAccount

const unsupportedAccount = {
    address: 'UNKNOWN_ADDR',
    type: 'watch',
} as unknown as WalletAccount

const hardwareAccount = {
    address: 'LEDGER_ADDR',
    type: 'hardware',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
} as unknown as WalletAccount

const makeTxn = (senderAddr: string) =>
    ({
        sender: {
            publicKey: new Uint8Array(32),
            toString: () => senderAddr,
        },
    }) as never

describe('useLocalKeyTransactionSigner', () => {
    beforeEach(() => {
        mockSignTransactionsWithKey.mockReset()
        mockGetPQSigningInfo.mockReset().mockReturnValue(null)
        mockIsHDWalletAccount.mockReset().mockReturnValue(false)
        mockIsAlgo25Account.mockReset().mockReturnValue(false)
        mockIsQuantumAccount.mockReset().mockReturnValue(false)
        mockIsHardwareWalletAccount.mockReset().mockReturnValue(false)
        encodeTransactionMock.mockReset().mockReturnValue(new Uint8Array([1]))
        pqSigningDigestMock
            .mockReset()
            .mockReturnValue(new Uint8Array([9, 9, 9]))
        assemblePQSignedTransactionMock
            .mockReset()
            .mockImplementation(
                ({ signature }: { signature: { signature: Uint8Array } }) => ({
                    pqsig: { sig: signature.signature },
                }),
            )
        mockAccounts = []
    })

    test('signs HD wallet transactions via signTransactionsWithKey on the child id', async () => {
        mockIsHDWalletAccount.mockImplementation(acc => acc.type === 'hdWallet')
        mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([9])])

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('HD_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            hdAccount,
        )

        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'key-hd-child',
            expect.any(String),
            [new Uint8Array([1])],
        )
        expect(signed).toHaveLength(1)
        expect(signed[0].sig).toEqual(new Uint8Array([9]))
    })

    test('signs algo25 transactions via signTransactionsWithKey on the child id', async () => {
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([7])])

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('ALGO25_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            algo25Account,
        )

        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'key-algo25-ed25519',
            expect.any(String),
            [new Uint8Array([1])],
        )
        expect(signed).toHaveLength(1)
    })

    test('does NOT follow rekey from the public signTransactions — caller must pre-resolve', async () => {
        mockAccounts = [participantWithRekey, algo25Account]
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([3])])

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('PARTICIPANT_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            participantWithRekey,
        )

        // Participant's own keyPairId (its child id) drove the sign call —
        // NOT the rekey target's.
        const [childIdArg] = mockSignTransactionsWithKey.mock.calls[0]
        expect(childIdArg).toBe('key-participant-ed25519')
        expect(childIdArg).not.toBe('key-algo25-ed25519')
        expect(signed).toHaveLength(1)
    })

    test('signs only the indexes in indexesToSign (unsigned pass-through)', async () => {
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([1])])

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn1 = makeTxn('ALGO25_ADDR')
        const txn2 = makeTxn('ALGO25_ADDR')

        const signed = await result.current.signTransactions(
            [txn1, txn2],
            [1],
            algo25Account,
        )

        expect(signed[0]).toBeDefined()
        expect(signed[0].sig).toBeUndefined()
        expect(signed[1].sig).toBeDefined()
    })

    test('signs with the explicit account even when txn.sender differs (multisig cosign)', async () => {
        mockIsHDWalletAccount.mockImplementation(acc => acc.type === 'hdWallet')
        mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([42])])

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        // sender is the multisig (NOT in our accounts list at all)
        const txn = makeTxn('MULTISIG_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            hdAccount, // explicit signer = HD participant
        )

        // The signing call used the participant's child key, not the
        // multisig sender.
        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'key-hd-child',
            expect.any(String),
            expect.any(Array),
        )
        expect(signed).toHaveLength(1)
        expect(signed[0].sig).toEqual(new Uint8Array([42]))
    })

    test('signs large batches in chunks (yielding between) preserving order [PERA-3353]', async () => {
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        // One signature per encoded tx in each batch.
        mockSignTransactionsWithKey.mockImplementation(
            (_id: string, _domain: string, encoded: Uint8Array[]) =>
                Promise.resolve(encoded.map(() => new Uint8Array([9]))),
        )

        const total = SIGN_BATCH_SIZE * 2 + 3 // 3 chunks: full, full, remainder
        const txns = Array.from({ length: total }, () => makeTxn('ALGO25_ADDR'))
        const indexes = txns.map((_, i) => i)

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const signed = await result.current.signTransactions(
            txns,
            indexes,
            algo25Account,
        )

        // One signing call per chunk — not a single 1000-wide burst.
        const calls = mockSignTransactionsWithKey.mock.calls
        expect(calls).toHaveLength(3)
        expect(calls[0][2]).toHaveLength(SIGN_BATCH_SIZE)
        expect(calls[1][2]).toHaveLength(SIGN_BATCH_SIZE)
        expect(calls[2][2]).toHaveLength(3)

        // Every transaction is signed and order is preserved.
        expect(signed).toHaveLength(total)
        expect(signed.every(s => s.sig !== undefined)).toBe(true)
    })

    test('rejects for unsupported account type', async () => {
        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('UNKNOWN_ADDR')

        await expect(
            result.current.signTransactions([txn], [0], unsupportedAccount),
        ).rejects.toContain('Unsupported account type')
    })

    test('rejects hardware-wallet accounts — those go through the pipeline', async () => {
        mockIsHardwareWalletAccount.mockImplementation(
            acc => acc.type === 'hardware',
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        await expect(
            result.current.signTransactions(
                [makeTxn('LEDGER_ADDR')],
                [0],
                hardwareAccount,
            ),
        ).rejects.toContain('Unsupported account type')
    })

    describe('quantum accounts', () => {
        beforeEach(() => {
            mockIsQuantumAccount.mockImplementation(
                acc => acc.type === 'quantum',
            )
            mockGetPQSigningInfo.mockImplementation(keyPairId =>
                keyPairId === quantumAccount.keyPairId
                    ? { schemeId: 'falcon1024', publicKey: new Uint8Array([5]) }
                    : null,
            )
        })

        test('signs a quantum account through the same entry point as algo25', async () => {
            mockSignTransactionsWithKey.mockResolvedValue([
                new Uint8Array([1, 2, 3]),
            ])

            const { result } = renderHook(() => useLocalKeyTransactionSigner())
            const txn = makeTxn('QUANTUM_ADDR')

            const signed = await result.current.signTransactions(
                [txn],
                [0],
                quantumAccount,
            )

            expect(signed).toHaveLength(1)
            expect(signed[0].pqsig).toBeDefined()
            expect(signed[0].sig).toBeUndefined()

            // Pin the full PQSignature handed to the adapter, not just that
            // `pqsig` exists. `assemblePQSignedTransaction` derives BOTH the
            // authorizing address and the `sgnr` decision from `publicKey`
            // (see quantumAdapter.ts), so a wrong or stale public key yields
            // a wrong or spurious `sgnr` with no other visible symptom — and
            // the mock echoes the signature back, so it cannot catch that on
            // its own.
            expect(assemblePQSignedTransactionMock).toHaveBeenCalledTimes(1)
            expect(assemblePQSignedTransactionMock).toHaveBeenCalledWith({
                txn,
                signature: {
                    schemeId: 'falcon1024',
                    publicKey: new Uint8Array([5]),
                    signature: new Uint8Array([1, 2, 3]),
                },
            })
        })

        test('pairs each signature with its own transaction across a multi-transaction group', async () => {
            // Three transactions, three distinct signatures: an off-by-one or
            // a reused index in the `pqInfo` branch's `signatures[idx]`
            // pairing would put the wrong signature on the wrong txn, which a
            // single-transaction group can never reveal.
            const txns = [
                makeTxn('QUANTUM_ADDR'),
                makeTxn('QUANTUM_ADDR'),
                makeTxn('QUANTUM_ADDR'),
            ]
            const signatures = [
                new Uint8Array([10]),
                new Uint8Array([20]),
                new Uint8Array([30]),
            ]
            mockSignTransactionsWithKey.mockResolvedValue(signatures)
            // Distinct digest per txn so the payload ordering is pinned too.
            pqSigningDigestMock.mockImplementation(
                (txn: unknown) =>
                    new Uint8Array([txns.indexOf(txn as never) + 1]),
            )

            const { result } = renderHook(() => useLocalKeyTransactionSigner())
            const signed = await result.current.signTransactions(
                txns,
                [0, 1, 2],
                quantumAccount,
            )

            expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
                quantumAccount.keyPairId,
                SIGNING_KEY_DOMAIN,
                [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])],
            )

            expect(assemblePQSignedTransactionMock).toHaveBeenCalledTimes(3)
            txns.forEach((txn, idx) => {
                expect(assemblePQSignedTransactionMock).toHaveBeenNthCalledWith(
                    idx + 1,
                    {
                        txn,
                        signature: {
                            schemeId: 'falcon1024',
                            publicKey: new Uint8Array([5]),
                            signature: signatures[idx],
                        },
                    },
                )
            })

            expect(signed).toHaveLength(3)
            signed.forEach((signedTxn, idx) => {
                expect(signedTxn.pqsig?.sig).toEqual(signatures[idx])
            })
        })

        test('signs the SHA-512/256 digest, not the raw encoding, for quantum accounts', async () => {
            mockSignTransactionsWithKey.mockResolvedValue([
                new Uint8Array([1, 2, 3]),
            ])
            const txn = makeTxn('QUANTUM_ADDR')

            const { result } = renderHook(() => useLocalKeyTransactionSigner())
            await result.current.signTransactions([txn], [0], quantumAccount)

            expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
                quantumAccount.keyPairId,
                SIGNING_KEY_DOMAIN,
                [pqSigningDigest(txn)],
            )
            // The raw ("TX"-prefixed) encoder must NEVER be consulted for a
            // quantum account — that's the exact bug this refactor closes.
            expect(encodeTransactionMock).not.toHaveBeenCalled()
        })

        test('still signs algo25 accounts with a plain Ed25519 signature', async () => {
            mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
            mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([9])])

            const { result } = renderHook(() => useLocalKeyTransactionSigner())
            const signed = await result.current.signTransactions(
                [makeTxn('ALGO25_ADDR')],
                [0],
                algo25Account,
            )

            expect(signed[0].sig).toBeDefined()
            expect(signed[0].pqsig).toBeUndefined()
        })
    })
})
