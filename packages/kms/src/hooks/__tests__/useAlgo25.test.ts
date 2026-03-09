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
import type { Algo25KeyResult } from '../useAlgo25'
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
const mockKeyStoreRemove = vi.fn()

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
            remove: (...args: any[]) => mockKeyStoreRemove(...args),
        },
        withExportedKey: async (
            keyId: string,
            handler: (keyData: any) => any,
        ) => {
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
        mockKeyStoreImport
            .mockResolvedValueOnce('ks-algo25-1')
            .mockResolvedValueOnce('ks-algo25-1-seed')
    })

    describe('createAlgo25Key', () => {
        test('creates and saves an Algo25 key with provided mnemonic and id', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ALGO25ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            let keyResult: Algo25KeyResult | undefined
            await act(async () => {
                keyResult = await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            expect(keyResult!.keyPair.id).toBe('my-key')
            expect(keyResult!.keyPair.publicKey).toBe('ALGO25ADDR')
            expect(keyResult!.keyPair.type).toBe(KeyType.Algo25Key)
            expect(keyResult!.keyPair.keystoreKeyId).toBe('ks-algo25-1')
            expect(keyResult!.seedKeyId).toBe('ks-algo25-1-seed')
        })

        test('imports signing key without mnemonic in metadata and seed as separate key', async () => {
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

            expect(mockKeyStoreImport).toHaveBeenCalledTimes(2)

            // First call: signing key without mnemonic in metadata
            expect(mockKeyStoreImport).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    type: 'hd-derived-ed25519',
                    algorithm: 'EdDSA',
                    extractable: true,
                }),
                'raw',
            )
            // Ensure no mnemonic in the signing key import
            const signingKeyArg = mockKeyStoreImport.mock.calls[0][0]
            expect(signingKeyArg.metadata?.mnemonic).toBeUndefined()

            // Second call: seed key with raw seed bytes
            expect(mockKeyStoreImport).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    id: 'my-key-seed',
                    type: 'hd-derived-ed25519',
                    extractable: true,
                    privateKey: expect.any(Uint8Array),
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

            let keyResult: Algo25KeyResult | undefined
            await act(async () => {
                keyResult = await result.current.createAlgo25Key({
                    mnemonic: 'test',
                })
            })

            expect(keyResult!.keyPair.id).toBe('mock-uuid-v7')
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
            mockEncodeAddress.mockReturnValue('NEWADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const { result } = renderHook(() => useAlgo25())

            let keyResult: Algo25KeyResult | undefined
            await act(async () => {
                keyResult = await result.current.createAlgo25Key()
            })

            expect(mockSeedFromMnemonic).not.toHaveBeenCalled()
            expect(keyResult!.keyPair.publicKey).toBe('NEWADDR')

            // Signing key should not contain mnemonic
            const signingKeyArg = mockKeyStoreImport.mock.calls[0][0]
            expect(signingKeyArg.metadata?.mnemonic).toBeUndefined()

            // Seed key should be imported separately
            expect(mockKeyStoreImport).toHaveBeenCalledTimes(2)
        })

        test('rolls back signing key if seed key import fails', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockKeyStoreImport
                .mockReset()
                .mockResolvedValueOnce('ks-algo25-1')
                .mockRejectedValueOnce(new Error('Seed import failed'))

            const { result } = renderHook(() => useAlgo25())

            let caughtError: Error | undefined
            await act(async () => {
                try {
                    await result.current.createAlgo25Key({
                        id: 'my-key',
                        mnemonic: 'test mnemonic',
                    })
                } catch (e) {
                    caughtError = e as Error
                }
            })

            expect(caughtError?.message).toBe('Seed import failed')
            expect(mockKeyStoreRemove).toHaveBeenCalledWith('ks-algo25-1')
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

        test('getMnemonic retrieves mnemonic from seed key when seedKeyId is provided', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockKeyStoreExport
                .mockResolvedValueOnce({
                    privateKey: new Uint8Array(64).fill(1),
                    publicKey: new Uint8Array(32).fill(2),
                    metadata: {},
                })
                .mockResolvedValueOnce({
                    privateKey: fakeSeed,
                })
            mockMnemonicFromSeed.mockReturnValue('recovered mnemonic words')

            const { result } = renderHook(() => useAlgo25())

            let mnemonic: string | undefined
            await act(async () => {
                mnemonic = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getMnemonic()
                    },
                    'ks-seed-1',
                )
            })

            expect(mnemonic).toBe('recovered mnemonic words')
            expect(mockKeyStoreExport).toHaveBeenCalledWith('ks-seed-1')
            expect(mockMnemonicFromSeed).toHaveBeenCalled()
        })

        test('getMnemonic throws when no seedKeyId is provided', async () => {
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
