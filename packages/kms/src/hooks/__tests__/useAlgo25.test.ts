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

const mockCheckAccess = vi.fn()
const mockKeyStoreImport = vi.fn()
const mockKeyStoreExport = vi.fn()
const mockKeyStoreSign = vi.fn()
const mockKeyStoreRemove = vi.fn()
const mockCommit = vi.fn()

vi.mock('@algorandfoundation/keystore', () => ({
    clearKeyData: vi.fn(),
}))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    commit: (...args: any[]) => mockCommit(...args),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        state: { keys: [], status: 'idle' },
        setState: vi.fn(),
        subscribe: () => ({ unsubscribe: () => {} }),
    }),
    getKeystoreHooks: () => ({ wrap: vi.fn() }),
}))

const mockClearKeyData = vi.fn()

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
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
        mockKeyStoreImport.mockResolvedValue('ks-algo25-1-seed')
        mockCommit.mockResolvedValue(undefined)
    })

    describe('createAlgo25Key', () => {
        test('creates and stores an Algo25 key with provided mnemonic and id', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ALGO25ADDR')

            const { result } = renderHook(() => useAlgo25())

            let keyResult: Optional<Algo25KeyResult>
            await act(async () => {
                keyResult = await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            expect(keyResult!.keyPair.id).toBe('my-key')
            expect(keyResult!.keyPair.publicKey).toBe('ALGO25ADDR')
            expect(keyResult!.keyPair.type).toBe(KeyType.Algo25Key)
            expect(keyResult!.keyPair.keystoreKeyId).toBe('my-key')
            expect(keyResult!.seedKeyId).toBe('ks-algo25-1-seed')
        })

        test('commits root key with type "algo25" via react-native-keystore commit()', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            expect(mockCommit).toHaveBeenCalledTimes(1)
            const commitArg = mockCommit.mock.calls[0][0]
            expect(commitArg.keyData).toMatchObject({
                id: 'my-key',
                type: 'algo25',
                algorithm: 'EdDSA',
                extractable: true,
                publicKey: expect.any(Uint8Array),
                privateKey: expect.any(Uint8Array),
            })
            expect(commitArg.keyData.metadata?.pera).toMatchObject({
                createdAt: expect.any(String),
            })

            // Seed key still uses keyStore.import
            expect(mockKeyStoreImport).toHaveBeenCalledTimes(1)
            expect(mockKeyStoreImport).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'my-key-seed',
                    type: 'hd-seed',
                    algorithm: 'raw',
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

            const { result } = renderHook(() => useAlgo25())

            let keyResult: Optional<Algo25KeyResult>
            await act(async () => {
                keyResult = await result.current.createAlgo25Key({
                    mnemonic: 'test',
                })
            })

            expect(keyResult!.keyPair.id).toBe('mock-uuid-v7')
        })

        test('zeros out the seed and secret key after committing', async () => {
            const fakeSeed = new Uint8Array(32).fill(99)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({ mnemonic: 'test' })
            })

            expect(fakeSeed.every(byte => byte === 0)).toBe(true)
        })

        test('commits the seed before zeroBytes runs (regression: addKeyToKeystore must be awaited)', async () => {
            const fakeSeed = new Uint8Array(32).fill(0xab)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')

            // `commit` receives `new Uint8Array(seed)`. The copy is taken at
            // call time, so if zeroBytes wins the race the copy will be all
            // zeros — captured here from the actual call args.
            let committedPrivateKey: Optional<Uint8Array>
            mockCommit.mockImplementationOnce(async (arg: any) => {
                committedPrivateKey = new Uint8Array(arg.keyData.privateKey)
            })

            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.createAlgo25Key({
                    id: 'k',
                    mnemonic: 'test',
                })
            })

            expect(committedPrivateKey).toBeDefined()
            expect(committedPrivateKey!.every(b => b === 0xab)).toBe(true)
        })

        test('generates a new key when no mnemonic is provided', async () => {
            mockEncodeAddress.mockReturnValue('NEWADDR')

            const { result } = renderHook(() => useAlgo25())

            let keyResult: Optional<Algo25KeyResult>
            await act(async () => {
                keyResult = await result.current.createAlgo25Key()
            })

            expect(mockSeedFromMnemonic).not.toHaveBeenCalled()
            expect(keyResult!.keyPair.publicKey).toBe('NEWADDR')
            expect(mockCommit).toHaveBeenCalledTimes(1)
            expect(mockKeyStoreImport).toHaveBeenCalledTimes(1)
        })

        test('rolls back the root key if seed key import fails', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockKeyStoreImport.mockRejectedValueOnce(
                new Error('Seed import failed'),
            )

            const { result } = renderHook(() => useAlgo25())

            let caughtError: Optional<Error>
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
            expect(mockKeyStoreRemove).toHaveBeenCalledWith('my-key')
        })
    })

    describe('withAlgo25Session', () => {
        const mockKey: KeyPair = {
            id: 'algo-key-1',
            publicKey: 'ADDR',
            type: KeyType.Algo25Key,
            keystoreKeyId: 'algo-key-1',
        }

        beforeEach(() => {
            // The seed for tweetnacl. fromSeed(seed) deterministically produces
            // the keypair below.
            const fakeSeed = new Uint8Array(32).fill(1)
            mockKeyStoreExport.mockResolvedValue({
                publicKey: new Uint8Array(32).fill(2),
                privateKey: fakeSeed,
            })
        })

        test('signs transaction data locally via tweetnacl after exporting the seed', async () => {
            const { result } = renderHook(() => useAlgo25())

            let signResult: Optional<Uint8Array>
            await act(async () => {
                signResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session =>
                        session.signTransaction(new Uint8Array([1, 2, 3])),
                )
            })

            expect(mockKeyStoreExport).toHaveBeenCalledWith('algo-key-1')
            expect(signResult).toBeInstanceOf(Uint8Array)
            expect(signResult!.length).toBe(64)
            // Local signing — the platform keystore's sign is never invoked.
            expect(mockKeyStoreSign).not.toHaveBeenCalled()
        })

        test('signs arbitrary data locally via tweetnacl', async () => {
            const { result } = renderHook(() => useAlgo25())

            let signResult: Optional<Uint8Array>
            await act(async () => {
                signResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session =>
                        session.signData(new Uint8Array([4, 5, 6])),
                )
            })

            expect(signResult).toBeInstanceOf(Uint8Array)
            expect(signResult!.length).toBe(64)
            expect(mockKeyStoreSign).not.toHaveBeenCalled()
        })

        test('getPublicKey returns the raw public key derived from the seed', async () => {
            const { result } = renderHook(() => useAlgo25())

            let pubKey: Optional<Uint8Array>
            await act(async () => {
                pubKey = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => session.getPublicKey(),
                )
            })

            expect(pubKey).toBeInstanceOf(Uint8Array)
            expect(pubKey!.length).toBe(32)
        })

        test('getMnemonic exports the seed entry by deterministic id', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockKeyStoreExport
                .mockReset()
                .mockResolvedValueOnce({
                    publicKey: new Uint8Array(32).fill(2),
                    privateKey: fakeSeed,
                })
                .mockResolvedValueOnce({ privateKey: fakeSeed })
            mockMnemonicFromSeed.mockReturnValue('recovered mnemonic words')

            const { result } = renderHook(() => useAlgo25())

            let mnemonic: Optional<Uint8Array>
            await act(async () => {
                mnemonic = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => session.getMnemonic(),
                )
            })

            expect(ArrayBuffer.isView(mnemonic)).toBe(true)
            expect(new TextDecoder().decode(mnemonic)).toBe(
                'recovered mnemonic words',
            )
            // First export = root key (for sign session); second = seed entry.
            expect(mockKeyStoreExport).toHaveBeenNthCalledWith(1, 'algo-key-1')
            expect(mockKeyStoreExport).toHaveBeenNthCalledWith(
                2,
                'algo-key-1-seed',
            )
        })

        test('getMnemonic throws when seed keystore entry has no privateKey', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockKeyStoreExport
                .mockReset()
                .mockResolvedValueOnce({
                    publicKey: new Uint8Array(32).fill(2),
                    privateKey: fakeSeed,
                })
                .mockResolvedValueOnce({})

            const { result } = renderHook(() => useAlgo25())

            await expect(
                act(async () => {
                    await result.current.withAlgo25Session(
                        mockKey,
                        'test-domain',
                        async session => session.getMnemonic(),
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
    })
})
