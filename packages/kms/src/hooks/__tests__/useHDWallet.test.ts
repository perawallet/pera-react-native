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
import { useHDWallet } from '../useHDWallet'
import type { HDWalletKeyResult } from '../useHDWallet'
import { KeyType, KeyPair } from '../../models'
import { KeyManagementError } from '../../errors'

const mockGenerateHDMasterKey = vi.fn()
const mockEntropyToMnemonic = vi.fn()

vi.mock('../../crypto/hdwallet-utils', () => ({
    generateHDMasterKey: (...args: any[]) => mockGenerateHDMasterKey(...args),
    entropyToMnemonic: (...args: any[]) => mockEntropyToMnemonic(...args),
}))

const mockFromSeed = vi.fn()

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9, Khovratovich: 0 },
    KeyContext: { Address: 0, Identity: 1 },
    fromSeed: (...args: any[]) => mockFromSeed(...args),
}))

const mockSaveKey = vi.fn()
const mockCheckAccess = vi.fn()
const mockKeyStoreImport = vi.fn()
const mockKeyStoreGenerate = vi.fn()
const mockKeyStoreSign = vi.fn()
const mockKeyStoreExport = vi.fn()
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
            generate: (...args: any[]) => mockKeyStoreGenerate(...args),
            sign: (...args: any[]) => mockKeyStoreSign(...args),
            export: (...args: any[]) => mockKeyStoreExport(...args),
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

const mockAddKey = vi.fn()
const mockStoreKeys = new Map<string, KeyPair>()

vi.mock('../../store', () => ({
    useKeyManagerStore: (selector: any) => {
        const state = {
            addKey: mockAddKey,
            keys: mockStoreKeys,
        }
        return selector(state)
    },
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

describe('useHDWallet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStoreKeys.clear()
    })

    describe('createHDWalletKey', () => {
        const mockRootKey = new Uint8Array(96).fill(42)

        beforeEach(() => {
            mockGenerateHDMasterKey.mockResolvedValue({
                mnemonic: 'generated mnemonic',
                seed: Buffer.from('seed-data'),
                entropy: 'abcdef01',
            })
            mockFromSeed.mockReturnValue(mockRootKey)
            mockKeyStoreImport
                .mockResolvedValueOnce('ks-root-1')
                .mockResolvedValueOnce('ks-root-1-entropy')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)
        })

        test('creates an HD wallet root key and returns entropyKeyId', async () => {
            const { result } = renderHook(() => useHDWallet())

            let keyResult: HDWalletKeyResult | undefined
            await act(async () => {
                keyResult = await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'my mnemonic',
                })
            })

            expect(keyResult!.keyPair.id).toBe('hd-1')
            expect(keyResult!.keyPair.publicKey).toBe('')
            expect(keyResult!.keyPair.type).toBe(KeyType.HDWalletRootKey)
            expect(keyResult!.keyPair.keystoreKeyId).toBe('ks-root-1')
            expect(keyResult!.entropyKeyId).toBe('ks-root-1-entropy')
        })

        test('imports root key without entropy in metadata and entropy as separate key', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'my mnemonic',
                })
            })

            expect(mockFromSeed).toHaveBeenCalledTimes(1)
            expect(mockKeyStoreImport).toHaveBeenCalledTimes(2)

            // First call: root key without entropy in metadata
            expect(mockKeyStoreImport).toHaveBeenNthCalledWith(
                1,
                {
                    type: 'hd-root-key',
                    algorithm: 'raw',
                    extractable: true,
                    keyUsages: ['deriveKey', 'deriveBits'],
                    privateKey: mockRootKey,
                    metadata: { name: 'hd-1' },
                },
                'raw',
            )
            // Ensure no entropy in root key metadata
            const rootKeyArg = mockKeyStoreImport.mock.calls[0][0]
            expect(rootKeyArg.metadata?.entropy).toBeUndefined()

            // Second call: entropy key with raw entropy bytes
            expect(mockKeyStoreImport).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    id: 'hd-1-entropy',
                    type: 'hd-seed',
                    algorithm: 'raw',
                    extractable: true,
                    privateKey: expect.any(Uint8Array),
                }),
                'raw',
            )
        })

        test('generates uuid when id is not provided', async () => {
            const { result } = renderHook(() => useHDWallet())

            let keyResult: HDWalletKeyResult | undefined
            await act(async () => {
                keyResult = await result.current.createHDWalletKey()
            })

            expect(keyResult!.keyPair.id).toBe('mock-uuid-v7')
        })

        test('zeros out the master seed and root key after saving', async () => {
            const fakeSeed = Buffer.from('seed-data-to-clear')
            const fakeRootKey = new Uint8Array(96).fill(99)
            mockGenerateHDMasterKey.mockResolvedValue({
                mnemonic: 'test mnemonic',
                seed: fakeSeed,
                entropy: 'abcdef01',
            })
            mockFromSeed.mockReturnValue(fakeRootKey)

            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({ mnemonic: 'test' })
            })

            expect(fakeSeed.every(byte => byte === 0)).toBe(true)
            expect(fakeRootKey.every(byte => byte === 0)).toBe(true)
        })

        test('uses provided mnemonic via generateHDMasterKey', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({
                    mnemonic: 'provided mnemonic words',
                })
            })

            expect(mockGenerateHDMasterKey).toHaveBeenCalledWith(
                'provided mnemonic words',
            )
        })

        test('generates a new mnemonic when none is provided', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey()
            })

            expect(mockGenerateHDMasterKey).toHaveBeenCalledWith(undefined)
        })

        test('rolls back root key if entropy key import fails', async () => {
            mockKeyStoreImport
                .mockReset()
                .mockResolvedValueOnce('ks-root-1')
                .mockRejectedValueOnce(new Error('Entropy import failed'))

            const { result } = renderHook(() => useHDWallet())

            let caughtError: Error | undefined
            await act(async () => {
                try {
                    await result.current.createHDWalletKey({
                        id: 'hd-1',
                        mnemonic: 'my mnemonic',
                    })
                } catch (e) {
                    caughtError = e as Error
                }
            })

            expect(caughtError?.message).toBe('Entropy import failed')
            expect(mockKeyStoreRemove).toHaveBeenCalledWith('ks-root-1')
        })
    })

    describe('generateDerivedKey', () => {
        test('generates a derived key via keystore', async () => {
            mockKeyStoreGenerate.mockResolvedValue('ks-derived-1')

            const { result } = renderHook(() => useHDWallet())

            let derivedKeyId: string | undefined
            await act(async () => {
                derivedKeyId = await result.current.generateDerivedKey(
                    'ks-root-1',
                    0,
                    0,
                    9,
                )
            })

            expect(derivedKeyId).toBe('ks-derived-1')
            expect(mockKeyStoreGenerate).toHaveBeenCalledWith({
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                keyUsages: ['sign'],
                params: {
                    parentKeyId: 'ks-root-1',
                    account: 0,
                    index: 0,
                    context: 0, // KeyContext.Address
                    derivation: 9,
                },
            })
        })
    })

    describe('withHDSession', () => {
        const mockKey: KeyPair = {
            id: 'hd-key-1',
            publicKey: '',
            type: KeyType.HDWalletRootKey,
            keystoreKeyId: 'ks-root-1',
        }

        const derivationParams = {
            account: 0,
            keyIndex: 0,
            derivationType: 9, // BIP32DerivationType.Peikert
        }

        beforeEach(() => {
            mockKeyStoreGenerate.mockResolvedValue('ks-derived-1')
            mockKeyStoreSign.mockResolvedValue(new Uint8Array(64).fill(1))
            mockKeyStoreExport.mockResolvedValue({
                publicKey: new Uint8Array(32).fill(3),
            })
        })

        test('session signTransaction signs via keyStore.sign with derived key', async () => {
            const mockSig = new Uint8Array(64).fill(1)
            mockKeyStoreSign.mockResolvedValue(mockSig)

            const { result } = renderHook(() => useHDWallet())

            const encodedTx = new Uint8Array([84, 88, 1, 2, 3])
            let signResult: Uint8Array | undefined
            await act(async () => {
                signResult = await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.signTransaction(
                            derivationParams,
                            encodedTx,
                        )
                    },
                )
            })

            expect(signResult).toBe(mockSig)
            expect(mockKeyStoreGenerate).toHaveBeenCalled()
            expect(mockKeyStoreSign).toHaveBeenCalledWith(
                'ks-derived-1',
                encodedTx,
            )
        })

        test('session signData signs via keyStore.sign without prefix', async () => {
            const mockSig = new Uint8Array(64).fill(2)
            mockKeyStoreSign.mockResolvedValue(mockSig)

            const { result } = renderHook(() => useHDWallet())

            let signResult: Uint8Array | undefined
            await act(async () => {
                signResult = await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.signData(
                            derivationParams,
                            new Uint8Array([4, 5, 6]),
                        )
                    },
                )
            })

            expect(signResult).toBe(mockSig)
            expect(mockKeyStoreSign).toHaveBeenCalledWith(
                'ks-derived-1',
                new Uint8Array([4, 5, 6]),
            )
        })

        test('session getPublicKey derives key and exports public key', async () => {
            const mockPubKey = new Uint8Array(32).fill(3)
            mockKeyStoreExport.mockResolvedValue({
                publicKey: mockPubKey,
            })

            const { result } = renderHook(() => useHDWallet())

            let pubKeyResult: Uint8Array | undefined
            await act(async () => {
                pubKeyResult = await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getPublicKey(derivationParams)
                    },
                )
            })

            expect(pubKeyResult).toBe(mockPubKey)
            expect(mockKeyStoreGenerate).toHaveBeenCalled()
            expect(mockKeyStoreExport).toHaveBeenCalledWith('ks-derived-1')
        })

        test('getMnemonic retrieves mnemonic from entropy key when entropyKeyId is provided', async () => {
            const entropyBytes = Buffer.from('abcdef01', 'hex')
            mockKeyStoreExport.mockResolvedValueOnce({
                privateKey: new Uint8Array(entropyBytes),
            })
            mockEntropyToMnemonic.mockReturnValue('recovered mnemonic words')

            const { result } = renderHook(() => useHDWallet())

            let mnemonic: Uint8Array | undefined
            await act(async () => {
                mnemonic = await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getMnemonic()
                    },
                    'ks-entropy-1',
                )
            })

            expect(ArrayBuffer.isView(mnemonic)).toBe(true)
            expect(new TextDecoder().decode(mnemonic)).toBe(
                'recovered mnemonic words',
            )
            expect(mockKeyStoreExport).toHaveBeenCalledWith('ks-entropy-1')
            expect(mockEntropyToMnemonic).toHaveBeenCalled()
        })

        test('getMnemonic throws when no entropyKeyId is provided', async () => {
            const { result } = renderHook(() => useHDWallet())

            await expect(
                act(async () => {
                    await result.current.withHDSession(
                        mockKey,
                        'test-domain',
                        async session => {
                            return session.getMnemonic()
                        },
                    )
                }),
            ).rejects.toThrow(KeyManagementError)
        })

        test('getPublicKey clears exported key data after use', async () => {
            const mockKeyData = {
                publicKey: new Uint8Array(32).fill(3),
                privateKey: new Uint8Array(64).fill(9),
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => session.getPublicKey(derivationParams),
                )
            })

            expect(mockClearKeyData).toHaveBeenCalledWith(mockKeyData)
        })

        test('getMnemonic clears exported entropy key data after use', async () => {
            const mockEntropyKeyData = {
                privateKey: new Uint8Array(Buffer.from('abcdef01', 'hex')),
            }
            mockKeyStoreExport.mockResolvedValue(mockEntropyKeyData)
            mockEntropyToMnemonic.mockReturnValue('recovered mnemonic')

            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => session.getMnemonic(),
                    'ks-entropy-1',
                )
            })

            expect(mockClearKeyData).toHaveBeenCalledWith(mockEntropyKeyData)
        })

        test('calls checkAccess with key and domain', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.withHDSession(
                    mockKey,
                    'my-domain',
                    async () => 'ok',
                )
            })

            expect(mockCheckAccess).toHaveBeenCalledWith(mockKey, 'my-domain')
        })

        test('throws when keystoreKeyId is missing', async () => {
            const keyWithoutKeystoreId: KeyPair = {
                id: 'hd-key-1',
                publicKey: '',
                type: KeyType.HDWalletRootKey,
            }

            const { result } = renderHook(() => useHDWallet())

            await expect(
                act(async () => {
                    await result.current.withHDSession(
                        keyWithoutKeystoreId,
                        'test-domain',
                        async () => 'ok',
                    )
                }),
            ).rejects.toThrow(KeyManagementError)
        })

        test('passes derivation params correctly for different derivation types', async () => {
            const mockSig = new Uint8Array(64).fill(5)
            mockKeyStoreSign.mockResolvedValue(mockSig)
            mockKeyStoreGenerate.mockResolvedValue('ks-derived-khov')

            const khovratovichParams = {
                account: 1,
                keyIndex: 2,
                derivationType: 0, // BIP32DerivationType.Khovratovich
            }

            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        await session.signTransaction(
                            khovratovichParams,
                            new Uint8Array([1]),
                        )
                    },
                )
            })

            // Verify keyStore.generate received correct derivation params
            expect(mockKeyStoreGenerate).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: expect.objectContaining({
                        parentKeyId: 'ks-root-1',
                        account: 1,
                        index: 2,
                        context: 0, // KeyContext.Address
                        derivation: 0, // Khovratovich
                    }),
                }),
            )
            expect(mockKeyStoreSign).toHaveBeenCalledWith(
                'ks-derived-khov',
                new Uint8Array([1]),
            )
        })
    })
})
