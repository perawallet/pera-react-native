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

vi.mock('@algorandfoundation/algokit-utils/algo25', () => ({
    seedFromMnemonic: (...args: any[]) => mockSeedFromMnemonic(...args),
}))

const mockEncodeAddress = vi.fn()

vi.mock('@algorandfoundation/algokit-utils', () => ({
    encodeAddress: (...args: any[]) => mockEncodeAddress(...args),
}))

const mockSaveKey = vi.fn()
const mockCheckAccess = vi.fn()
const mockKeyStoreImport = vi.fn()
const mockKeyStoreSign = vi.fn()

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        saveKey: (...args: any[]) => mockSaveKey(...args),
        checkAccess: (...args: any[]) => mockCheckAccess(...args),
        keyStore: {
            import: (...args: any[]) => mockKeyStoreImport(...args),
            sign: (...args: any[]) => mockKeyStoreSign(...args),
        },
    }),
}))

const mockSecureSetItem = vi.fn()

vi.mock('@perawallet/wallet-extension-platform', () => ({
    useSecureStorageService: () => ({
        setItem: mockSecureSetItem,
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
            mockKeyStoreImport.mockResolvedValue('ks-key-1')
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
            expect(keyResult!.keystoreKeyId).toBe('ks-key-1')
        })

        test('imports key into keystore extension', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockKeyStoreImport.mockResolvedValue('ks-key-1')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({
                    mnemonic: 'test mnemonic',
                })
            })

            expect(mockKeyStoreImport).toHaveBeenCalledWith(
                expect.objectContaining({
                    privateKey: expect.any(Uint8Array),
                    type: 'ecc',
                    algorithm: 'EdDSA',
                    extractable: false,
                    keyUsages: ['sign'],
                }),
                'raw',
            )
        })

        test('stores mnemonic in secure storage', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockKeyStoreImport.mockResolvedValue('ks-key-1')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            expect(mockSecureSetItem).toHaveBeenCalledTimes(1)
            expect(mockSecureSetItem.mock.calls[0][0]).toBe('mnemonic-my-key')
            const storedMnemonic = new TextDecoder().decode(
                mockSecureSetItem.mock.calls[0][1],
            )
            expect(storedMnemonic).toBe('test mnemonic')
        })

        test('generates uuid when id is not provided', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockKeyStoreImport.mockResolvedValue('ks-key-1')
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

        test('zeros out the seed after import', async () => {
            const fakeSeed = new Uint8Array(32).fill(99)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockKeyStoreImport.mockResolvedValue('ks-key-1')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({ mnemonic: 'test' })
            })

            expect(fakeSeed.every(byte => byte === 0)).toBe(true)
        })

        test('throws when no mnemonic is provided', async () => {
            const { result } = renderHook(() => useAlgo25())

            await expect(
                act(async () => {
                    await result.current.createAlgo25Key({})
                }),
            ).rejects.toThrow(KeyManagementError)
        })
    })

    describe('withAlgo25Session', () => {
        const mockKey: KeyPair = {
            id: 'algo-key-1',
            publicKey: 'ADDR',
            type: KeyType.Algo25Key,
            keystoreKeyId: 'ks-key-1',
        }

        test('provides a session with signTransaction that delegates to keyStore', async () => {
            const txData = new Uint8Array([1, 2, 3])
            const mockSig = new Uint8Array(64).fill(1)
            mockKeyStoreSign.mockResolvedValue(mockSig)

            const { result } = renderHook(() => useAlgo25())

            let signResult: Uint8Array | undefined
            await act(async () => {
                signResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.signTransaction(txData)
                    },
                )
            })

            expect(mockKeyStoreSign).toHaveBeenCalledWith('ks-key-1', txData)
            expect(signResult).toBe(mockSig)
        })

        test('provides a session with signData that delegates to keyStore', async () => {
            const data = new Uint8Array([4, 5, 6])
            const mockSig = new Uint8Array(64).fill(2)
            mockKeyStoreSign.mockResolvedValue(mockSig)

            const { result } = renderHook(() => useAlgo25())

            let signResult: Uint8Array | undefined
            await act(async () => {
                signResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.signData(data)
                    },
                )
            })

            expect(mockKeyStoreSign).toHaveBeenCalledWith('ks-key-1', data)
            expect(signResult).toBe(mockSig)
        })

        test('getPublicKey throws KeyManagementError', async () => {
            const { result } = renderHook(() => useAlgo25())

            await expect(
                act(async () => {
                    await result.current.withAlgo25Session(
                        mockKey,
                        'test-domain',
                        async session => {
                            return session.getPublicKey()
                        },
                    )
                }),
            ).rejects.toThrow(KeyManagementError)
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
            mockKeyStoreSign.mockResolvedValue(new Uint8Array(64))

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.withAlgo25Session(
                    mockKey,
                    'my-domain',
                    async () => 'ok',
                )
            })

            expect(mockCheckAccess).toHaveBeenCalledWith(mockKey, 'my-domain')
        })

        test('throws KeyManagementError when key has no keystoreKeyId', async () => {
            const keyWithoutKeystoreId: KeyPair = {
                id: 'algo-key-1',
                publicKey: 'ADDR',
                type: KeyType.Algo25Key,
            }

            const { result } = renderHook(() => useAlgo25())

            await expect(
                act(async () => {
                    await result.current.withAlgo25Session(
                        keyWithoutKeystoreId,
                        'test-domain',
                        async () => 'ok',
                    )
                }),
            ).rejects.toThrow(KeyManagementError)
        })
    })
})
