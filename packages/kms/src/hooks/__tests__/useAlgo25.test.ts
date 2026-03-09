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
const mockEncodeAddress = vi.fn()

vi.mock('@algorandfoundation/algokit-utils/algo25', () => ({
    seedFromMnemonic: (...args: any[]) => mockSeedFromMnemonic(...args),
    mnemonicFromSeed: (...args: any[]) => mockMnemonicFromSeed(...args),
}))

vi.mock('@algorandfoundation/algokit-utils', () => ({
    encodeAddress: (...args: any[]) => mockEncodeAddress(...args),
}))

const mockSaveKey = vi.fn()
const mockCheckAccess = vi.fn()
const mockKeyStoreImport = vi.fn()
const mockKeyStoreExport = vi.fn()
const mockKeyStoreSign = vi.fn()

const mockClearKeyData = vi.fn()

vi.mock('@algorandfoundation/keystore', () => ({
    clearKeyData: (...args: any[]) => mockClearKeyData(...args),
}))

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        saveKey: (...args: any[]) => mockSaveKey(...args),
        checkAccess: (...args: any[]) => mockCheckAccess(...args),
        keyStore: {
            import: (...args: any[]) => mockKeyStoreImport(...args),
            export: (...args: any[]) => mockKeyStoreExport(...args),
            sign: (...args: any[]) => mockKeyStoreSign(...args),
        },
        withExportedKey: async (keyId: string, handler: (keyData: any) => any) => {
            const keyData = await mockKeyStoreExport(keyId)
            try {
                return await handler(keyData)
            } finally {
                mockClearKeyData(keyData)
            }
        },
    }),
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

describe('useAlgo25', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeyStoreImport.mockResolvedValue('ks-algo25-1')
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
            expect(keyResult!.keystoreKeyId).toBe('ks-algo25-1')
        })

        test('imports key into keystore with mnemonic in metadata', async () => {
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

            expect(mockKeyStoreImport).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'hd-derived-ed25519',
                    algorithm: 'EdDSA',
                    extractable: true,
                    metadata: { mnemonic: 'test mnemonic' },
                }),
                'raw',
            )
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

        test('zeros out the seed and secret key after saving', async () => {
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

            expect(mockKeyStoreImport).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { mnemonic: 'generated mnemonic words' },
                }),
                'raw',
            )
        })
    })

    describe('withAlgo25Session', () => {
        const mockKey: KeyPair = {
            id: 'algo-key-1',
            publicKey: 'ADDR',
            type: KeyType.Algo25Key,
            keystoreKeyId: 'ks-algo25-1',
        }

        beforeEach(() => {
            const fakeSeed = new Uint8Array(32).fill(1)
            const fakeSecretKey = new Uint8Array(64)
            fakeSecretKey.set(fakeSeed)
            mockKeyStoreExport.mockResolvedValue({
                privateKey: fakeSecretKey,
                publicKey: new Uint8Array(32).fill(2),
                metadata: { mnemonic: 'test mnemonic words' },
            })
        })

        test('signs transaction data using nacl via keystore export', async () => {
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

            expect(mockKeyStoreExport).toHaveBeenCalledWith('ks-algo25-1')
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

        test('getMnemonic returns mnemonic from keystore metadata', async () => {
            const { result } = renderHook(() => useAlgo25())

            let mnemonic: string | undefined
            await act(async () => {
                mnemonic = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getMnemonic()
                    },
                )
            })

            expect(mnemonic).toBe('test mnemonic words')
        })

        test('getMnemonic throws when mnemonic not in metadata', async () => {
            mockKeyStoreExport.mockResolvedValue({
                privateKey: new Uint8Array(64),
                publicKey: new Uint8Array(32),
                metadata: {},
            })

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

        test('throws KeyManagementError when keystoreKeyId is missing', async () => {
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
                        async session => session.getPublicKey(),
                    )
                }),
            ).rejects.toThrow(KeyManagementError)
        })

        test('clears exported key data after session completes', async () => {
            const mockKeyData = {
                privateKey: new Uint8Array(64).fill(1),
                publicKey: new Uint8Array(32).fill(2),
                metadata: { mnemonic: 'test mnemonic words' },
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => session.getPublicKey(),
                )
            })

            expect(mockClearKeyData).toHaveBeenCalledWith(mockKeyData)
        })

        test('clears exported key data even when handler throws', async () => {
            const mockKeyData = {
                privateKey: new Uint8Array(64).fill(1),
                publicKey: new Uint8Array(32).fill(2),
                metadata: { mnemonic: 'test mnemonic words' },
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useAlgo25())

            let caughtError: Error | undefined
            await act(async () => {
                try {
                    await result.current.withAlgo25Session(
                        mockKey,
                        'test-domain',
                        async () => {
                            throw new Error('handler error')
                        },
                    )
                } catch (e) {
                    caughtError = e as Error
                }
            })

            expect(caughtError?.message).toBe('handler error')
            expect(mockClearKeyData).toHaveBeenCalledWith(mockKeyData)
        })

        test('throws KeyManagementError when exported key has no privateKey', async () => {
            mockKeyStoreExport.mockResolvedValue({
                privateKey: undefined,
                publicKey: new Uint8Array(32),
                metadata: {},
            })

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
