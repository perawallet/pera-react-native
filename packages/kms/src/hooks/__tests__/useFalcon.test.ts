/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { isValidAddress } from 'algosdk'

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

const mockCommitFalconChildKey = vi.fn()
vi.mock('../../storage/falcon-child', () => ({
    commitFalconChildKey: (...args: unknown[]) =>
        mockCommitFalconChildKey(...args),
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

import { useFalcon, type FalconKeyResult } from '../useFalcon'
import { quantumSignKeyId, FALCON_CHILD_KEY_TYPE } from '../../models'
import { FALCON_PUBLIC_KEY_LENGTH } from '../../crypto/falcon-utils'
import { SeedScheme } from '../../constants'

// THROWAWAY TEST VECTOR — same as algo25-integration.test.ts; NEVER fund it.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

describe('useFalcon', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeyStoreImport.mockResolvedValue('my-key')
        mockCommitFalconChildKey.mockResolvedValue(undefined)
    })

    describe('createFalconKey', () => {
        test('imports the seed, commits a falcon child, and returns address + seedKey + signKeyId', async () => {
            const { result } = renderHook(() => useFalcon())

            let keyResult: Optional<FalconKeyResult>
            await act(async () => {
                keyResult = await result.current.createFalconKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(keyResult!.seedKey.id).toBe('my-key')
            expect(keyResult!.seedKey.type).toBe('seed')
            expect(
                (keyResult!.seedKey.metadata as { scheme?: string }).scheme,
            ).toBe(SeedScheme.Falcon)
            expect(keyResult!.signKeyId).toBe(quantumSignKeyId('my-key'))
            expect(keyResult!.address).toHaveLength(58)
            expect(isValidAddress(keyResult!.address)).toBe(true)
        })

        test('persists the seed with scheme=falcon metadata and zeroes the buffer after import', async () => {
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

            const { result } = renderHook(() => useFalcon())
            await act(async () => {
                await result.current.createFalconKey({
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
            expect(arg.metadata.scheme).toBe(SeedScheme.Falcon)
            expect(arg.metadata.pera.createdAt).toBeDefined()
        })

        test('commits the falcon child with the quantum id, parentKeyId and 1,793-byte public key', async () => {
            const { result } = renderHook(() => useFalcon())
            await act(async () => {
                await result.current.createFalconKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(mockCommitFalconChildKey).toHaveBeenCalledTimes(1)
            const arg = mockCommitFalconChildKey.mock.calls[0][0]
            expect(arg.id).toBe(quantumSignKeyId('my-key'))
            expect(arg.parentKeyId).toBe('my-key')
            expect(arg.publicKey).toHaveLength(FALCON_PUBLIC_KEY_LENGTH)
        })

        test('generates a random 32-byte seed and a uuid id when no params given', async () => {
            const { result } = renderHook(() => useFalcon())
            let keyResult: Optional<FalconKeyResult>
            await act(async () => {
                keyResult = await result.current.createFalconKey()
            })
            expect(keyResult!.seedKey.id).toBe('mock-uuid-v7')
            expect(isValidAddress(keyResult!.address)).toBe(true)
        })

        test('same mnemonic produces the same public key and address across fresh hook instances', async () => {
            const publicKeys: number[][] = []
            mockCommitFalconChildKey.mockImplementation(
                async (params: { publicKey: Uint8Array }) => {
                    publicKeys.push(Array.from(params.publicKey))
                },
            )

            const addresses: string[] = []
            for (let i = 0; i < 2; i++) {
                const { result, unmount } = renderHook(() => useFalcon())
                await act(async () => {
                    const created = await result.current.createFalconKey({
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

        test('rolls back the seed if the falcon child commit fails', async () => {
            mockCommitFalconChildKey.mockRejectedValueOnce(new Error('boom'))

            const { result } = renderHook(() => useFalcon())
            await expect(
                act(async () => {
                    await result.current.createFalconKey({
                        id: 'my-key',
                        mnemonic: TEST_MNEMONIC,
                    })
                }),
            ).rejects.toThrow('boom')

            expect(mockKeyStoreRemove).toHaveBeenCalledWith('my-key')
        })
    })
})
