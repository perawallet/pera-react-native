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
import type { Key } from '@algorandfoundation/keystore'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    InvalidKeyError,
    KeyAccessError,
    KeyManagementError,
    KeyNotFoundError,
} from '../../errors'
import { SeedScheme } from '../../constants'
import { mnemonicIndexToWord } from '../../crypto/mnemonic-indices'
import { getPQProvider } from '../../crypto/pq'
import { FALCON_CHILD_KEY_TYPE } from '../../models'

// Documented compressed Falcon-1024 signature upper bound (see "Key
// contracts" in docs/QUANTUM_PQ_INTEGRATION.md) — not exported by the
// package because production never needs to check it, only tests do.
const FALCON_SIGNATURE_MAX_LENGTH = 1232

// Source-of-truth keystore Key list mocked at the module that bridges to
// the platform keystore. useKMS reads from this via useKeystoreKeys() AND
// directly via getKeystoreStore().state.keys for live (non-React) lookups.
let mockKeystoreKeys: Key[] = []

vi.mock('../useKeystoreState', () => ({
    useKeystoreKeys: () => mockKeystoreKeys,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        get state() {
            return { keys: mockKeystoreKeys, status: 'idle' as const }
        },
    }),
}))

const mockDeleteKey = vi.fn()
const mockKeyStoreRemove = vi.fn()
const mockKeyStoreSign = vi.fn()
const mockKeyStoreExport = vi.fn()
const mockCheckAccess = vi.fn()
vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        deleteKey: (...args: any[]) => mockDeleteKey(...args),
        keyStore: {
            remove: (...args: any[]) => mockKeyStoreRemove(...args),
            sign: (...args: any[]) => mockKeyStoreSign(...args),
            export: (...args: any[]) => mockKeyStoreExport(...args),
        },
        withExportedKey: async (
            keyId: string,
            handler: (keyData: any) => any,
        ) => {
            const keyData = await mockKeyStoreExport(keyId)
            return handler(keyData)
        },
        checkAccess: (...args: any[]) => mockCheckAccess(...args),
    }),
}))

const mockCreateHDWalletKey = vi.fn()
vi.mock('../useHDWallet', () => ({
    useHDWallet: () => ({
        createHDWalletKey: (...args: any[]) => mockCreateHDWalletKey(...args),
        generateDerivedKey: vi.fn(),
        getDerivedPublicKey: vi.fn(),
        persistHDMasterKey: vi.fn(),
    }),
}))

const mockCreateAlgo25Key = vi.fn()
vi.mock('../useAlgo25', () => ({
    useAlgo25: () => ({
        createAlgo25Key: (...args: any[]) => mockCreateAlgo25Key(...args),
    }),
}))

const mockCreateQuantumKey = vi.fn()
vi.mock('../useQuantum', () => ({
    useQuantum: () => ({
        createQuantumKey: (...args: any[]) => mockCreateQuantumKey(...args),
    }),
}))

const mockEntropyToIndices = vi.fn()
vi.mock('../../crypto/hdwallet-utils', () => ({
    entropyToIndices: (...args: any[]) => mockEntropyToIndices(...args),
}))

const mockAlgo25SeedToIndices = vi.fn()
vi.mock('../../crypto/algo25-utils', () => ({
    algo25SeedToIndices: (...args: any[]) => mockAlgo25SeedToIndices(...args),
}))

const mockWithSecret = vi.fn()
vi.mock('../../storage/secrets', () => ({
    withSecret: (...args: any[]) => mockWithSecret(...args),
}))

import { useKMS } from '../useKMS'

// THROWAWAY TEST VECTOR — same as useQuantum.test.ts / algo25-integration; NEVER fund it.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

const seedBip39Root = (id: string): Key => {
    const key: Key = {
        id,
        type: 'seed',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme: SeedScheme.Bip39, pera: {} },
    }
    mockKeystoreKeys.push(key)
    return key
}

const seedAlgo25Root = (id: string): Key => {
    const key: Key = {
        id,
        type: 'seed',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme: SeedScheme.Algo25, pera: {} },
    }
    mockKeystoreKeys.push(key)
    return key
}

const seedQuantumRoot = (id: string): Key => {
    const key: Key = {
        id,
        type: 'seed',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme: SeedScheme.Quantum, pera: {} },
    }
    mockKeystoreKeys.push(key)
    return key
}

const childOf = (childId: string, parentId: string, type = 'ed25519'): Key => {
    const key: Key = {
        id: childId,
        type,
        algorithm: 'EdDSA',
        extractable: false,
        metadata: { parentKeyId: parentId },
    }
    mockKeystoreKeys.push(key)
    return key
}

// The entropy secret-key child, located by metadata (parentKeyId + entropyKey),
// not its id — the id is opaque on purpose.
const entropyChildOf = (
    parentId: string,
    childId = `${parentId}-entropy`,
): Key => {
    const key: Key = {
        id: childId,
        type: 'secret-key',
        algorithm: 'raw',
        extractable: true,
        metadata: { parentKeyId: parentId, entropyKey: true },
    }
    mockKeystoreKeys.push(key)
    return key
}

describe('useKMS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeystoreKeys = []
    })

    it('exposes deleteKey from useKMSService', async () => {
        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.deleteKey('test-id')
        })
        expect(mockDeleteKey).toHaveBeenCalledWith('test-id')
    })

    it('exposes createHDWalletKey from useHDWallet', async () => {
        const mockResult = { seedKey: { id: 'wallet-1', type: 'seed' } }
        mockCreateHDWalletKey.mockResolvedValue(mockResult)
        const { result } = renderHook(() => useKMS())
        let keyResult: any
        await act(async () => {
            keyResult = await result.current.createHDWalletKey({
                id: 'wallet-1',
            })
        })
        expect(mockCreateHDWalletKey).toHaveBeenCalledWith({ id: 'wallet-1' })
        expect(keyResult).toEqual(mockResult)
    })

    it('getKeyOrThrow throws when the key is not in the reactive store', () => {
        const { result } = renderHook(() => useKMS())
        expect(() => result.current.getKeyOrThrow('missing-id')).toThrow(
            KeyNotFoundError,
        )
    })

    it('getKeyOrThrow returns the keystore Key when present', () => {
        seedBip39Root('hd-1')
        const { result } = renderHook(() => useKMS())
        const key = result.current.getKeyOrThrow('hd-1')
        expect(key.id).toBe('hd-1')
        expect(key.type).toBe('seed')
    })

    it('keys map contains only seed entries with a recognised scheme', () => {
        seedBip39Root('hd-1')
        seedAlgo25Root('algo-1')
        childOf('child-1', 'hd-1', 'hd-derived-ed25519')
        mockKeystoreKeys.push({
            id: 'pin',
            type: 'secret-key',
            algorithm: 'raw',
            extractable: true,
        })

        const { result } = renderHook(() => useKMS())

        expect(result.current.keys.size).toBe(2)
        expect(result.current.keys.get('hd-1')?.type).toBe('seed')
        expect(result.current.keys.get('algo-1')?.type).toBe('seed')
        expect(result.current.keys.get('child-1')).toBeUndefined()
        expect(result.current.keys.get('pin')).toBeUndefined()
    })

    it('seedIdOf walks metadata.parentKeyId to the seed', () => {
        seedBip39Root('hd-1')
        childOf('hd-1-acc0-idx0-dt9', 'hd-1', 'hd-derived-ed25519')

        const { result } = renderHook(() => useKMS())

        expect(result.current.seedIdOf('hd-1-acc0-idx0-dt9')).toBe('hd-1')
        // Seeds themselves don't have parents.
        expect(result.current.seedIdOf('hd-1')).toBeUndefined()
        expect(result.current.seedIdOf('unknown')).toBeUndefined()
    })

    it('signTransactionsWithKey calls keyStore.sign(childId) once per item', async () => {
        seedBip39Root('hd-1')
        const child = childOf('hd-1-c0', 'hd-1', 'hd-derived-ed25519')
        mockKeyStoreSign
            .mockResolvedValueOnce(new Uint8Array(64).fill(1))
            .mockResolvedValueOnce(new Uint8Array(64).fill(2))

        const { result } = renderHook(() => useKMS())
        let signed: Optional<Uint8Array[]>
        await act(async () => {
            signed = await result.current.signTransactionsWithKey(
                child.id,
                'test-domain',
                [new Uint8Array([1]), new Uint8Array([2])],
            )
        })
        expect(signed).toHaveLength(2)
        expect(mockKeyStoreSign).toHaveBeenNthCalledWith(
            1,
            child.id,
            new Uint8Array([1]),
        )
        expect(mockKeyStoreSign).toHaveBeenNthCalledWith(
            2,
            child.id,
            new Uint8Array([2]),
        )
    })

    it('signTransactionsWithKey accepts a seed id directly (legacy callers)', async () => {
        seedAlgo25Root('algo-1')
        mockKeyStoreSign.mockResolvedValueOnce(new Uint8Array(64))
        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.signTransactionsWithKey('algo-1', 'd', [
                new Uint8Array([1]),
            ])
        })
        expect(mockKeyStoreSign).toHaveBeenCalledWith(
            'algo-1',
            new Uint8Array([1]),
        )
    })

    it('signDataWithKey calls keyStore.sign(childId) once per item', async () => {
        seedBip39Root('hd-1')
        childOf('child-1', 'hd-1', 'hd-derived-ed25519')
        mockKeyStoreSign.mockResolvedValue(new Uint8Array(64).fill(3))
        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.signDataWithKey('child-1', 'd', [
                new Uint8Array([1]),
                new Uint8Array([2]),
            ])
        })
        expect(mockKeyStoreSign).toHaveBeenCalledTimes(2)
    })

    it('signTransactionsWithKey throws InvalidKeyError when the resolved entry is neither a seed nor a known child', async () => {
        // No seed and no child registered — but the id exists as some
        // other kind of top-level entry. seedIdOf returns undefined and
        // direct lookup finds a non-seed entry, so we error out.
        mockKeystoreKeys.push({
            id: 'rsa-1',
            type: 'rsa',
            algorithm: 'RS256',
            extractable: true,
        })
        const { result } = renderHook(() => useKMS())
        await expect(
            act(async () => {
                await result.current.signTransactionsWithKey('rsa-1', 'd', [
                    new Uint8Array([1]),
                ])
            }),
        ).rejects.toThrow(InvalidKeyError)
    })

    it('executeWithMnemonic for a bip39 seed derives indices from the entropy secret-key', async () => {
        seedBip39Root('hd-1')
        const child = childOf('hd-1-c0', 'hd-1', 'hd-derived-ed25519')
        const entropy = entropyChildOf('hd-1')
        mockEntropyToIndices.mockReturnValue(Uint16Array.from([1, 2, 3]))
        // withSecret hands the entropy bytes to the handler; the seed's XHD
        // root is never exported on the bip39 path.
        mockWithSecret.mockImplementation(async (_id, handler) =>
            handler(new Uint8Array([0xab, 0xcd, 0xef, 0x01])),
        )

        const { result } = renderHook(() => useKMS())
        let received: Optional<string[]>
        await act(async () => {
            received = await result.current.executeWithMnemonic(
                child.id,
                'backup',
                indices => Array.from(indices, mnemonicIndexToWord),
            )
        })
        // The entropy child is resolved by metadata, then read by its id.
        expect(mockWithSecret).toHaveBeenCalledWith(
            entropy.id,
            expect.any(Function),
        )
        expect(mockKeyStoreExport).not.toHaveBeenCalled()
        expect(received).toEqual(['ability', 'able', 'about'])
    })

    it('executeWithMnemonic throws when the bip39 entropy secret is missing', async () => {
        seedBip39Root('hd-1')
        // No entropy child in the keystore → nothing to resolve.
        const child = childOf('hd-1-c0', 'hd-1', 'hd-derived-ed25519')

        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await expect(
                result.current.executeWithMnemonic(
                    child.id,
                    'backup',
                    () => 'unused',
                ),
            ).rejects.toThrow('missing its entropy secret')
        })
        expect(mockWithSecret).not.toHaveBeenCalled()
    })

    it('executeWithMnemonic for an algo25 seed derives indices from the seed', async () => {
        seedAlgo25Root('algo-1')
        const child = childOf('algo-1-ed25519', 'algo-1', 'ed25519')
        mockAlgo25SeedToIndices.mockReturnValue(Uint16Array.from([4, 5, 6]))
        mockKeyStoreExport.mockResolvedValueOnce({
            privateKey: new Uint8Array(32).fill(7),
        })

        const { result } = renderHook(() => useKMS())
        let received: Optional<number[]>
        await act(async () => {
            received = await result.current.executeWithMnemonic(
                child.id,
                'backup',
                indices => Array.from(indices),
            )
        })
        expect(mockKeyStoreExport).toHaveBeenCalledWith('algo-1')
        expect(received).toEqual([4, 5, 6])
    })

    it('executeWithMnemonic zeroes the index buffer after the handler returns', async () => {
        seedBip39Root('hd-1')
        const child = childOf('hd-1-c0', 'hd-1', 'hd-derived-ed25519')
        entropyChildOf('hd-1')
        mockEntropyToIndices.mockReturnValue(Uint16Array.from([1, 2, 3]))
        mockWithSecret.mockImplementation(async (_id, handler) =>
            handler(new Uint8Array([0xab, 0xcd, 0xef, 0x01])),
        )

        const { result } = renderHook(() => useKMS())
        let captured: Optional<Uint16Array>
        await act(async () => {
            await result.current.executeWithMnemonic(
                child.id,
                'backup',
                indices => {
                    captured = indices
                    // [ability, able, about] → non-zero indices, so a wipe is
                    // unambiguous.
                    expect(Array.from(indices)).toEqual([1, 2, 3])
                    return Array.from(indices, mnemonicIndexToWord)
                },
            )
        })
        // Scrubbed once the session ends, not left for GC.
        expect(captured && Array.from(captured)).toEqual([0, 0, 0])
    })

    it('getKey returns null and triggers async keystore.remove when expiresAt is in the past', () => {
        const past = new Date(Date.now() - 60_000).toISOString()
        mockKeystoreKeys.push({
            id: 'expired-key',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            metadata: {
                scheme: SeedScheme.Bip39,
                pera: { expiresAt: past },
            },
        })
        const { result } = renderHook(() => useKMS())
        expect(result.current.getKey('expired-key')).toBeNull()
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('expired-key')
    })

    it('removeKeyAndChildren removes the seed and any keys whose parentKeyId points to it', async () => {
        seedBip39Root('hd-1')
        childOf('child-a', 'hd-1', 'hd-derived-ed25519')
        childOf('child-b', 'hd-1', 'hd-derived-ed25519')
        // The entropy secret-key is a parentKeyId child too, so it cascades.
        childOf('hd-1-bip39-entropy', 'hd-1', 'secret-key')
        seedBip39Root('hd-2')
        childOf('child-c', 'hd-2', 'hd-derived-ed25519')

        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.removeKeyAndChildren('hd-1')
        })

        // children removed first, then the seed
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('child-a')
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('child-b')
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('hd-1-bip39-entropy')
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('hd-1')
        // child-c (under hd-2) is left alone
        expect(mockKeyStoreRemove).not.toHaveBeenCalledWith('child-c')
        expect(mockKeyStoreRemove).not.toHaveBeenCalledWith('hd-2')
    })

    describe('quantum sign dispatch', () => {
        const QUANTUM_SEED_BYTES = new Uint8Array(32).fill(7)

        const arrangeQuantumPair = () => {
            seedQuantumRoot('quantum-1')
            const child = childOf(
                'quantum-1-quantum',
                'quantum-1',
                'falcon1024',
            )
            mockKeyStoreExport.mockResolvedValue({
                privateKey: new Uint8Array(QUANTUM_SEED_BYTES),
            })
            return child
        }

        it('signTransactionsWithKey routes quantum children to the real Falcon signer, not keyStore.sign', async () => {
            const child = arrangeQuantumPair()
            const tx = new Uint8Array([1, 2, 3])

            const { result } = renderHook(() => useKMS())
            let sigs: Optional<Uint8Array[]>
            await act(async () => {
                sigs = await result.current.signTransactionsWithKey(
                    child.id,
                    'pera.accounts',
                    [tx],
                )
            })

            expect(mockKeyStoreSign).not.toHaveBeenCalled()
            expect(mockKeyStoreExport).toHaveBeenCalledWith('quantum-1')
            expect(sigs![0].length).toBeGreaterThan(0)
            expect(sigs![0].length).toBeLessThanOrEqual(
                FALCON_SIGNATURE_MAX_LENGTH,
            )
        })

        it('signTransactionsWithKey produces a real Falcon signature for the seed keypair', async () => {
            const child = arrangeQuantumPair()
            const payload = new Uint8Array([1, 2, 3, 4])

            const { result } = renderHook(() => useKMS())
            let sigs: Optional<Uint8Array[]>
            await act(async () => {
                sigs = await result.current.signTransactionsWithKey(
                    child.id,
                    'pera.accounts',
                    [payload],
                )
            })

            // Cross-check against the provider directly: deriving the
            // keypair from the same seed and signing the same payload must
            // reproduce byte-identical output. This proves the hook routes
            // through the real PQ provider rather than the old hash-based
            // mock (whose output never matched a real Falcon signature).
            const provider = getPQProvider()
            const { secretKey } =
                provider.generateKeypairFromSeed(QUANTUM_SEED_BYTES)
            const expected = provider.sign(secretKey, payload)

            expect(sigs![0].length).toBeGreaterThan(0)
            expect(sigs![0].length).toBeLessThanOrEqual(
                FALCON_SIGNATURE_MAX_LENGTH,
            )
            expect(Array.from(sigs![0])).toEqual(Array.from(expected))
        })

        it('quantum signatures are deterministic per (seed, payload) and differ across payloads', async () => {
            const child = arrangeQuantumPair()
            const txA = new Uint8Array([1, 2, 3])
            const txB = new Uint8Array([4, 5, 6])

            const { result } = renderHook(() => useKMS())
            let first: Optional<Uint8Array[]>
            let second: Optional<Uint8Array[]>
            await act(async () => {
                first = await result.current.signTransactionsWithKey(
                    child.id,
                    'pera.accounts',
                    [txA, txB],
                )
                second = await result.current.signTransactionsWithKey(
                    child.id,
                    'pera.accounts',
                    [txA],
                )
            })

            expect(Array.from(first![0])).toEqual(Array.from(second![0]))
            expect(Array.from(first![0])).not.toEqual(Array.from(first![1]))
        })

        it('signDataWithKey routes quantum children to the real Falcon signer', async () => {
            const child = arrangeQuantumPair()

            const { result } = renderHook(() => useKMS())
            let sigs: Optional<Uint8Array[]>
            await act(async () => {
                sigs = await result.current.signDataWithKey(
                    child.id,
                    'pera.accounts',
                    [new Uint8Array([9])],
                )
            })

            expect(mockKeyStoreSign).not.toHaveBeenCalled()
            expect(sigs![0].length).toBeGreaterThan(0)
            expect(sigs![0].length).toBeLessThanOrEqual(
                FALCON_SIGNATURE_MAX_LENGTH,
            )
        })

        it('rejects and never exports the seed when the ACL denies the domain', async () => {
            const child = arrangeQuantumPair()
            mockCheckAccess.mockImplementationOnce(() => {
                throw new KeyAccessError()
            })

            const { result } = renderHook(() => useKMS())
            await expect(
                result.current.signTransactionsWithKey(
                    child.id,
                    'not-granted-domain',
                    [new Uint8Array([1])],
                ),
            ).rejects.toThrow(KeyAccessError)
            expect(mockKeyStoreExport).not.toHaveBeenCalled()
        })

        it('ed25519 children still route through keyStore.sign', async () => {
            seedAlgo25Root('algo-1')
            const child = childOf('algo-1-ed25519', 'algo-1', 'ed25519')
            mockKeyStoreSign.mockResolvedValue(new Uint8Array(64))

            const { result } = renderHook(() => useKMS())
            await act(async () => {
                await result.current.signTransactionsWithKey(
                    child.id,
                    'pera.accounts',
                    [new Uint8Array([1])],
                )
            })

            expect(mockKeyStoreSign).toHaveBeenCalledTimes(1)
            expect(mockKeyStoreExport).not.toHaveBeenCalled()
        })

        it('executeWithMnemonic for a quantum seed derives indices from the seed bytes like algo25', async () => {
            const child = arrangeQuantumPair()
            mockAlgo25SeedToIndices.mockReturnValue(Uint16Array.from([7, 8, 9]))

            const { result } = renderHook(() => useKMS())
            let received: Optional<number[]>
            await act(async () => {
                received = await result.current.executeWithMnemonic(
                    child.id,
                    'backup-flow',
                    indices => Array.from(indices),
                )
            })

            expect(mockKeyStoreExport).toHaveBeenCalledWith('quantum-1')
            expect(mockAlgo25SeedToIndices).toHaveBeenCalledTimes(1)
            expect(received).toEqual([7, 8, 9])
        })

        // Roundtrip (device-portability NFR, PQ-012): a quantum account created
        // from a known 25-word mnemonic must reconstruct the SAME 25 words when
        // the backup flow calls executeWithMnemonic. Uses the REAL seed→indices
        // derivation (not the top-of-file stub) to prove the end-to-end contract.
        it('executeWithMnemonic reconstructs the same 25 words a quantum seed was created from', async () => {
            const { seedFromMnemonic } = await import('algosdk')
            const { algo25SeedToIndices: realAlgo25SeedToIndices } =
                await vi.importActual<
                    typeof import('../../crypto/algo25-utils')
                >('../../crypto/algo25-utils')
            mockAlgo25SeedToIndices.mockImplementation(realAlgo25SeedToIndices)

            // The quantum seed's private-key bytes ARE seedFromMnemonic(phrase),
            // exactly as useQuantum.createQuantumKey({ mnemonic }) persists them.
            const seedBytes = seedFromMnemonic(TEST_MNEMONIC)
            seedQuantumRoot('quantum-1')
            childOf('quantum-1-quantum', 'quantum-1', 'falcon1024')
            mockKeyStoreExport.mockResolvedValue({
                privateKey: new Uint8Array(seedBytes),
            })

            const { result } = renderHook(() => useKMS())
            let words: Optional<string>
            await act(async () => {
                words = await result.current.executeWithMnemonic(
                    'quantum-1-quantum',
                    'backup-flow',
                    indices =>
                        Array.from(indices, mnemonicIndexToWord).join(' '),
                )
            })

            expect(words).toBe(TEST_MNEMONIC)
            expect(TEST_MNEMONIC.split(' ')).toHaveLength(25)
        })

        it('exposes createQuantumKey from useQuantum', async () => {
            const mockResult = { seedKey: { id: 'f-1', type: 'seed' } }
            mockCreateQuantumKey.mockResolvedValue(mockResult)
            const { result } = renderHook(() => useKMS())
            let keyResult: any
            await act(async () => {
                keyResult = await result.current.createQuantumKey({ id: 'f-1' })
            })
            expect(mockCreateQuantumKey).toHaveBeenCalledWith({ id: 'f-1' })
            expect(keyResult).toEqual(mockResult)
        })

        describe('getQuantumPublicKey', () => {
            it('returns the committed Falcon public key, matching the real seed derivation', async () => {
                const { seedFromMnemonic } = await import('algosdk')
                const seed = seedFromMnemonic(TEST_MNEMONIC)
                const { publicKey } =
                    getPQProvider().generateKeypairFromSeed(seed)

                seedQuantumRoot('quantum-1')
                mockKeystoreKeys.push({
                    id: 'quantum-1-quantum',
                    type: FALCON_CHILD_KEY_TYPE,
                    algorithm: 'raw',
                    extractable: false,
                    publicKey,
                    metadata: { parentKeyId: 'quantum-1' },
                })

                const { result } = renderHook(() => useKMS())
                const pub =
                    result.current.getQuantumPublicKey('quantum-1-quantum')

                expect(pub).toBeInstanceOf(Uint8Array)
                expect(Array.from(pub)).toEqual(Array.from(publicKey))
            })

            it('throws KeyManagementError when the keyPairId is unknown', () => {
                const { result } = renderHook(() => useKMS())
                expect(() =>
                    result.current.getQuantumPublicKey('missing-id'),
                ).toThrow(KeyManagementError)
            })

            it('throws KeyManagementError when the key exists but has no public key', () => {
                seedQuantumRoot('quantum-2')
                mockKeystoreKeys.push({
                    id: 'quantum-2-quantum',
                    type: FALCON_CHILD_KEY_TYPE,
                    algorithm: 'raw',
                    extractable: false,
                    metadata: { parentKeyId: 'quantum-2' },
                })

                const { result } = renderHook(() => useKMS())
                expect(() =>
                    result.current.getQuantumPublicKey('quantum-2-quantum'),
                ).toThrow(KeyManagementError)
            })

            it('throws KeyManagementError when the keyPairId points at a non-quantum child (wrong type)', () => {
                // A real caller now resolves account.keyPairId here; guarding on
                // the child type prevents silently returning the wrong bytes for
                // a keyPairId that belongs to a non-Falcon (e.g. Ed25519) child.
                seedQuantumRoot('quantum-3')
                mockKeystoreKeys.push({
                    id: 'quantum-3-ed25519',
                    type: 'ed25519',
                    algorithm: 'raw',
                    extractable: false,
                    publicKey: new Uint8Array([1, 2, 3]),
                    metadata: { parentKeyId: 'quantum-3' },
                })

                const { result } = renderHook(() => useKMS())
                expect(() =>
                    result.current.getQuantumPublicKey('quantum-3-ed25519'),
                ).toThrow(KeyManagementError)
            })
        })
    })

    describe('getPQSigningInfo', () => {
        it('returns the scheme id and public key for a quantum child', async () => {
            const { seedFromMnemonic } = await import('algosdk')
            const seed = seedFromMnemonic(TEST_MNEMONIC)
            const { publicKey } = getPQProvider().generateKeypairFromSeed(seed)

            seedQuantumRoot('quantum-1')
            mockKeystoreKeys.push({
                id: 'quantum-1-quantum',
                type: FALCON_CHILD_KEY_TYPE,
                algorithm: 'raw',
                extractable: false,
                publicKey,
                metadata: { parentKeyId: 'quantum-1' },
            })

            const { result } = renderHook(() => useKMS())
            const info = result.current.getPQSigningInfo('quantum-1-quantum')

            expect(info?.schemeId).toBe('falcon1024')
            expect(info?.publicKey).toBeInstanceOf(Uint8Array)
            expect(info?.publicKey.length).toBeGreaterThan(1000)
        })

        it('returns null for a non-quantum child so callers take the Ed25519 path', () => {
            seedAlgo25Root('algo-1')
            const child = childOf('algo-1-ed25519', 'algo-1', 'ed25519')

            const { result } = renderHook(() => useKMS())

            expect(result.current.getPQSigningInfo(child.id)).toBeNull()
        })

        it('throws when the keyPairId is not in the keystore at all', () => {
            const { result } = renderHook(() => useKMS())

            expect(() => result.current.getPQSigningInfo('missing-id')).toThrow(
                KeyNotFoundError,
            )
        })

        it('throws when keyPairId resolves to the quantum seed itself rather than its Falcon child, instead of silently returning null', () => {
            // `resolveSeedKey` accepts a seed id directly as a legacy-caller
            // convenience (see its own comment). If a caller ever passed the
            // quantum SEED's id as `account.keyPairId` instead of the child's,
            // the seed-scheme oracle here would say "quantum" while the
            // child-type lookup (finding the seed entry itself, type `seed`,
            // not `falcon1024`) would say "not quantum" — the two oracles
            // this function reconciles disagreeing. That must throw, not
            // return null: returning null here would make the caller sign
            // the un-digested `encodeTransaction(txn)` bytes while
            // `signTransactionsWithKey` (driven by the seed-scheme oracle
            // alone) still Falcon-signs them — silently re-creating the
            // exact un-digested-signing bug PERA-4653 closed.
            seedQuantumRoot('quantum-1')
            childOf('quantum-1-quantum', 'quantum-1', 'falcon1024')

            const { result } = renderHook(() => useKMS())

            expect(() => result.current.getPQSigningInfo('quantum-1')).toThrow(
                KeyManagementError,
            )
        })

        it('throws when a child claims falcon1024 under a non-quantum seed (oracle disagreement)', () => {
            // Inverse mismatch: the child's own type says Falcon, but the
            // seed it hangs off does not carry the quantum scheme metadata.
            seedAlgo25Root('algo-mismatch')
            mockKeystoreKeys.push({
                id: 'algo-mismatch-falcon',
                type: FALCON_CHILD_KEY_TYPE,
                algorithm: 'raw',
                extractable: false,
                publicKey: new Uint8Array([1, 2, 3]),
                metadata: { parentKeyId: 'algo-mismatch' },
            })

            const { result } = renderHook(() => useKMS())

            expect(() =>
                result.current.getPQSigningInfo('algo-mismatch-falcon'),
            ).toThrow(KeyManagementError)
        })
    })

    it('hasSeedWithEntropy returns true when the seed has an entropy secret-key child', () => {
        seedBip39Root('hd-1')
        entropyChildOf('hd-1')

        const { result } = renderHook(() => useKMS())

        expect(result.current.hasSeedWithEntropy('hd-1')).toBe(true)
    })

    it('hasSeedWithEntropy returns false when the seed has no entropy child', () => {
        seedBip39Root('hd-1')
        childOf('hd-1-acc0', 'hd-1', 'hd-derived-ed25519')

        const { result } = renderHook(() => useKMS())

        expect(result.current.hasSeedWithEntropy('hd-1')).toBe(false)
    })

    it('hasSeedWithEntropy returns false when the id is not in the keystore', () => {
        const { result } = renderHook(() => useKMS())

        expect(result.current.hasSeedWithEntropy('missing')).toBe(false)
    })

    it('hasSeedWithEntropy returns false for a non-seed key even when an entropy child points to it', () => {
        mockKeystoreKeys.push({
            id: 'pin',
            type: 'secret-key',
            algorithm: 'raw',
            extractable: true,
        })
        entropyChildOf('pin')

        const { result } = renderHook(() => useKMS())

        expect(result.current.hasSeedWithEntropy('pin')).toBe(false)
    })

    it('hasSeedWithEntropy scopes the entropy child to the given seed', () => {
        seedBip39Root('hd-1')
        seedBip39Root('hd-2')
        entropyChildOf('hd-2')

        const { result } = renderHook(() => useKMS())

        expect(result.current.hasSeedWithEntropy('hd-1')).toBe(false)
        expect(result.current.hasSeedWithEntropy('hd-2')).toBe(true)
    })
})
