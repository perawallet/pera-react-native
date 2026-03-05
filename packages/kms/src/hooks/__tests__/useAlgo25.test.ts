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
import { useAlgo25 } from '../useAlgo25'
import { KeyType, KeyPair } from '../../models'
import { KeyManagementError } from '../../errors'

const mockSeedFromMnemonic = vi.fn()
const mockMnemonicFromSeed = vi.fn()

vi.mock('@algorandfoundation/algokit-utils/algo25', () => ({
    seedFromMnemonic: (...args: any[]) => mockSeedFromMnemonic(...args),
    mnemonicFromSeed: (...args: any[]) => mockMnemonicFromSeed(...args),
}))

const mockEncodeAddress = vi.fn()

vi.mock('@algorandfoundation/algokit-utils', () => ({
    encodeAddress: (...args: any[]) => mockEncodeAddress(...args),
}))

const mockSaveKey = vi.fn()
const mockCheckAccess = vi.fn()

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        saveKey: (...args: any[]) => mockSaveKey(...args),
        checkAccess: (...args: any[]) => mockCheckAccess(...args),
        keyStore: {},
    }),
}))

const mockSecureSetItem = vi.fn()
const mockSecureGetItem = vi.fn()

vi.mock('@perawallet/wallet-extension-platform', () => ({
    useSecureStorageService: () => ({
        setItem: mockSecureSetItem,
        getItem: (...args: any[]) => mockSecureGetItem(...args),
    }),
    useKeyStoreService: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        encodeToBase64: vi.fn((data: Uint8Array) =>
            Buffer.from(data).toString('base64'),
        ),
        decodeFromBase64: vi.fn((base64: string) =>
            new Uint8Array(Buffer.from(base64, 'base64')),
        ),
        generateOrderedUniqueId: () => 'mock-uuid-v7',
    }
})

describe('useAlgo25', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createAlgo25Key', () => {
        test('creates and saves an Algo25 key with provided mnemonic and id', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ALGO25ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            let keyResult: KeyPair | undefined
            await act(async () => {
                keyResult = await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            expect(keyResult!.id).toBe('my-key')
            expect(keyResult!.publicKey).toBe('ALGO25ADDR')
            expect(keyResult!.type).toBe(KeyType.Algo25Key)
        })

        test('stores seed and mnemonic in secure storage', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            expect(mockSecureSetItem).toHaveBeenCalledTimes(2)
            // First call stores the seed
            expect(mockSecureSetItem.mock.calls[0][0]).toBe(
                'algo25-seed-my-key',
            )
            // Second call stores the mnemonic
            expect(mockSecureSetItem.mock.calls[1][0]).toBe(
                'mnemonic-my-key',
            )
            const storedMnemonic = new TextDecoder().decode(
                mockSecureSetItem.mock.calls[1][1],
            )
            expect(storedMnemonic).toBe('test mnemonic')
        })

        test('generates uuid when id is not provided', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            let keyResult: KeyPair | undefined
            await act(async () => {
                keyResult = await result.current.createAlgo25Key({
                    mnemonic: 'test',
                })
            })

            expect(keyResult!.id).toBe('mock-uuid-v7')
        })

        test('zeros out the seed after saving', async () => {
            const fakeSeed = new Uint8Array(32).fill(99)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({ mnemonic: 'test' })
            })

            expect(fakeSeed.every(byte => byte === 0)).toBe(true)
        })

        test('generates a new key when no mnemonic is provided', async () => {
            mockMnemonicFromSeed.mockReturnValue('generated mnemonic words')
            mockEncodeAddress.mockReturnValue('NEWADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            let keyResult: KeyPair | undefined
            await act(async () => {
                keyResult = await result.current.createAlgo25Key()
            })

            expect(mockSeedFromMnemonic).not.toHaveBeenCalled()
            expect(mockMnemonicFromSeed).toHaveBeenCalledWith(
                expect.any(Uint8Array),
            )
            expect(keyResult!.publicKey).toBe('NEWADDR')

            const storedMnemonic = new TextDecoder().decode(
                mockSecureSetItem.mock.calls[1][1],
            )
            expect(storedMnemonic).toBe('generated mnemonic words')
        })
    })

    describe('withAlgo25Session', () => {
        const mockKey: KeyPair = {
            id: 'algo-key-1',
            publicKey: 'ADDR',
            type: KeyType.Algo25Key,
        }

        beforeEach(() => {
            // Mock secure storage to return a seed
            const fakeSeedBase64 = Buffer.from(
                new Uint8Array(32).fill(1),
            ).toString('base64')
            mockSecureGetItem.mockImplementation(async (key: string) => {
                if (key.startsWith('algo25-seed-')) {
                    return new TextEncoder().encode(fakeSeedBase64)
                }
                return null
            })
        })

        test('signs transaction data using nacl', async () => {
            const { result } = renderHook(() => useAlgo25())

            let signResult: Uint8Array | undefined
            await act(async () => {
                signResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.signTransaction(
                            new Uint8Array([1, 2, 3]),
                        )
                    },
                )
            })

            expect(signResult).toBeInstanceOf(Uint8Array)
            expect(signResult!.length).toBe(64)
        })

        test('signs arbitrary data using nacl', async () => {
            const { result } = renderHook(() => useAlgo25())

            let signResult: Uint8Array | undefined
            await act(async () => {
                signResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.signData(new Uint8Array([4, 5, 6]))
                    },
                )
            })

            expect(signResult).toBeInstanceOf(Uint8Array)
            expect(signResult!.length).toBe(64)
        })

        test('getPublicKey returns the public key', async () => {
            const { result } = renderHook(() => useAlgo25())

            let pubKey: Uint8Array | undefined
            await act(async () => {
                pubKey = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getPublicKey()
                    },
                )
            })

            expect(pubKey).toBeInstanceOf(Uint8Array)
            expect(pubKey!.length).toBe(32)
        })

        test('getMnemonic throws KeyManagementError', async () => {
            const { result } = renderHook(() => useAlgo25())

            await expect(
                act(async () => {
                    await result.current.withAlgo25Session(
                        mockKey,
                        'test-domain',
                        async session => {
                            return session.getMnemonic()
                        },
                    )
                }),
            ).rejects.toThrow(KeyManagementError)
        })

        test('calls checkAccess with key and domain', async () => {
            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.withAlgo25Session(
                    mockKey,
                    'my-domain',
                    async session => session.getPublicKey(),
                )
            })

            expect(mockCheckAccess).toHaveBeenCalledWith(mockKey, 'my-domain')
        })

        test('throws KeyManagementError when seed is not in storage', async () => {
            mockSecureGetItem.mockResolvedValue(null)

            const { result } = renderHook(() => useAlgo25())

            await expect(
                act(async () => {
                    await result.current.withAlgo25Session(
                        mockKey,
                        'test-domain',
                        async session => session.getPublicKey(),
                    )
                }),
            ).rejects.toThrow(KeyManagementError)
        })
    })
})
