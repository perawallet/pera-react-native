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
import { renderHook, act } from '@testing-library/react'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isValidAddress, seedFromMnemonic } from 'algosdk'

const mockKeyStoreImport = vi.fn()
const mockKeyStoreRemove = vi.fn()

vi.mock('@algorandfoundation/keystore', () => ({
    clearKeyData: vi.fn(),
}))

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        keyStore: {
            import: (...args: unknown[]) => mockKeyStoreImport(...args),
            remove: (...args: unknown[]) => mockKeyStoreRemove(...args),
        },
    }),
}))

const mockCommitQuantumChildKey = vi.fn()
vi.mock('../../storage/quantum-child', () => ({
    commitQuantumChildKey: (...args: unknown[]) =>
        mockCommitQuantumChildKey(...args),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateOrderedUniqueId: () => 'mock-uuid-v7',
    }
})

import { useQuantum, type QuantumKeyResult } from '../useQuantum'
import { quantumSignKeyId, FALCON_CHILD_KEY_TYPE } from '../../models'
import { SeedScheme } from '../../constants'
import { getPQProvider } from '../../crypto/pq'
import { deriveQuantumAddress } from '@perawallet/wallet-core-blockchain'

// THROWAWAY TEST VECTOR — same as algo25-integration.test.ts; NEVER fund it.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

describe('useQuantum', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeyStoreImport.mockResolvedValue('my-key')
        mockCommitQuantumChildKey.mockResolvedValue(undefined)
    })

    describe('createQuantumKey', () => {
        test('imports the seed, commits a quantum child, and returns address + seedKey + signKeyId', async () => {
            const { result } = renderHook(() => useQuantum())

            let keyResult: Optional<QuantumKeyResult>
            await act(async () => {
                keyResult = await result.current.createQuantumKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(keyResult!.seedKey.id).toBe('my-key')
            expect(keyResult!.seedKey.type).toBe('seed')
            expect(
                (keyResult!.seedKey.metadata as { scheme?: string }).scheme,
            ).toBe(SeedScheme.Quantum)
            expect(keyResult!.signKeyId).toBe(quantumSignKeyId('my-key'))
            expect(keyResult!.address).toHaveLength(58)
            expect(isValidAddress(keyResult!.address)).toBe(true)
        })

        test('persists the seed with scheme=quantum metadata and zeroes the buffer after import', async () => {
            // Snapshot the privateKey synchronously when import fires — the
            // hook passes the seed buffer directly (no defensive copy) and
            // zeroes it in `finally`, mirroring createAlgo25Key.
            let privateKeySnapshot: number[] = []
            mockKeyStoreImport.mockImplementationOnce(
                async (data: { privateKey?: Uint8Array }) => {
                    if (data.privateKey) {
                        privateKeySnapshot = Array.from(data.privateKey)
                    }
                    return 'my-key'
                },
            )

            const { result } = renderHook(() => useQuantum())
            await act(async () => {
                await result.current.createQuantumKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(mockKeyStoreImport).toHaveBeenCalledTimes(1)
            const arg = mockKeyStoreImport.mock.calls[0][0]
            expect(arg).toMatchObject({
                id: 'my-key',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
            })
            expect(privateKeySnapshot).toHaveLength(32)
            expect(privateKeySnapshot.some(b => b !== 0)).toBe(true)
            // Post-call the buffer is wiped — the zeroing path fired.
            expect(Array.from(arg.privateKey)).toEqual(new Array(32).fill(0))
            expect(arg.metadata.scheme).toBe(SeedScheme.Quantum)
            expect(arg.metadata.pera.createdAt).toBeDefined()
        })

        test('commits the quantum child with the quantum id, parentKeyId and the provider public-key length', async () => {
            const { result } = renderHook(() => useQuantum())
            await act(async () => {
                await result.current.createQuantumKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(mockCommitQuantumChildKey).toHaveBeenCalledTimes(1)
            const arg = mockCommitQuantumChildKey.mock.calls[0][0]
            expect(arg.id).toBe(quantumSignKeyId('my-key'))
            expect(arg.parentKeyId).toBe('my-key')
            expect(arg.publicKey).toHaveLength(getPQProvider().publicKeyLength)
        })

        test('generates a random 32-byte seed and a uuid id when no params given', async () => {
            const { result } = renderHook(() => useQuantum())
            let keyResult: Optional<QuantumKeyResult>
            await act(async () => {
                keyResult = await result.current.createQuantumKey()
            })
            expect(keyResult!.seedKey.id).toBe('mock-uuid-v7')
            expect(isValidAddress(keyResult!.address)).toBe(true)
        })

        test('same mnemonic produces the same public key and address across fresh hook instances', async () => {
            const publicKeys: number[][] = []
            mockCommitQuantumChildKey.mockImplementation(
                async (params: { publicKey: Uint8Array }) => {
                    publicKeys.push(Array.from(params.publicKey))
                },
            )

            const addresses: string[] = []
            for (let i = 0; i < 2; i++) {
                const { result, unmount } = renderHook(() => useQuantum())
                await act(async () => {
                    const created = await result.current.createQuantumKey({
                        id: `key-${i}`,
                        mnemonic: TEST_MNEMONIC,
                    })
                    addresses.push(created.address)
                })
                unmount()
            }

            expect(addresses[0]).toBe(addresses[1])
            expect(publicKeys[0]).toEqual(publicKeys[1])
        })

        test('rolls back the seed if the quantum child commit fails', async () => {
            mockCommitQuantumChildKey.mockRejectedValueOnce(new Error('boom'))

            const { result } = renderHook(() => useQuantum())
            await expect(
                act(async () => {
                    await result.current.createQuantumKey({
                        id: 'my-key',
                        mnemonic: TEST_MNEMONIC,
                    })
                }),
            ).rejects.toThrow('boom')

            expect(mockKeyStoreRemove).toHaveBeenCalledWith('my-key')
        })

        test('derives the real Falcon address matching the adapter for a fixed mnemonic', async () => {
            const { result } = renderHook(() => useQuantum())

            let created: Optional<QuantumKeyResult>
            await act(async () => {
                created = await result.current.createQuantumKey({
                    mnemonic: TEST_MNEMONIC,
                })
            })

            const seed = seedFromMnemonic(TEST_MNEMONIC)
            const { publicKey } = getPQProvider().generateKeypairFromSeed(seed)
            expect(created!.address).toBe(deriveQuantumAddress(publicKey))
        })
    })
})
