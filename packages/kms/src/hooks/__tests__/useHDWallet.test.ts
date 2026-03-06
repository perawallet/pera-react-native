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
import { KeyType, KeyPair } from '../../models'
import { KeyManagementError } from '../../errors'

const mockGenerateHDMasterKey = vi.fn()
const mockDeriveAddress = vi.fn()
const mockEntropyToMnemonic = vi.fn()

vi.mock('../../crypto/hdwallet-utils', () => ({
    generateHDMasterKey: (...args: any[]) => mockGenerateHDMasterKey(...args),
    deriveAddress: (...args: any[]) => mockDeriveAddress(...args),
    entropyToMnemonic: (...args: any[]) => mockEntropyToMnemonic(...args),
}))

const mockFromSeed = vi.fn()

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9, Khovratovich: 0 },
    fromSeed: (...args: any[]) => mockFromSeed(...args),
}))

const mockSaveKey = vi.fn()
const mockCheckAccess = vi.fn()
const mockKeyStoreImportSeed = vi.fn()
const mockKeyStoreDeriveFromSeed = vi.fn()
const mockKeyStoreSign = vi.fn()

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        saveKey: (...args: any[]) => mockSaveKey(...args),
        checkAccess: (...args: any[]) => mockCheckAccess(...args),
        keyStore: {
            importSeed: (...args: any[]) => mockKeyStoreImportSeed(...args),
            deriveFromSeed: (...args: any[]) =>
                mockKeyStoreDeriveFromSeed(...args),
            sign: (...args: any[]) => mockKeyStoreSign(...args),
        },
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
        decodeFromBase64: vi.fn(
            (base64: string) => new Uint8Array(Buffer.from(base64, 'base64')),
        ),
        generateOrderedUniqueId: () => 'mock-uuid-v7',
    }
})

describe('useHDWallet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
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
            mockKeyStoreImportSeed.mockResolvedValue('ks-seed-1')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)
        })

        test('creates an HD wallet root key', async () => {
            const { result } = renderHook(() => useHDWallet())

            let keyResult: KeyPair | undefined
            await act(async () => {
                keyResult = await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'my mnemonic',
                })
            })

            expect(keyResult!.id).toBe('hd-1')
            expect(keyResult!.publicKey).toBe('')
            expect(keyResult!.type).toBe(KeyType.HDWalletRootKey)
            expect(keyResult!.keystoreKeyId).toBe('ks-seed-1')
        })

        test('imports root key bytes into keystore extension', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'my mnemonic',
                })
            })

            // fromSeed is called with the BIP39 seed (which gets zeroed after)
            expect(mockFromSeed).toHaveBeenCalledTimes(1)
            expect(mockKeyStoreImportSeed).toHaveBeenCalledWith(mockRootKey, {
                name: 'hd-1',
            })
        })

        test('stores seed and entropy in secure storage', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'my mnemonic',
                })
            })

            expect(mockSecureSetItem).toHaveBeenCalledTimes(2)
            // First call stores the seed
            expect(mockSecureSetItem.mock.calls[0][0]).toBe('hd-seed-hd-1')
            // Second call stores the entropy
            expect(mockSecureSetItem.mock.calls[1][0]).toBe('entropy-hd-1')
        })

        test('generates uuid when id is not provided', async () => {
            const { result } = renderHook(() => useHDWallet())

            let keyResult: KeyPair | undefined
            await act(async () => {
                keyResult = await result.current.createHDWalletKey()
            })

            expect(keyResult!.id).toBe('mock-uuid-v7')
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
    })

    describe('withHDSession', () => {
        const mockKey: KeyPair = {
            id: 'hd-key-1',
            publicKey: '',
            type: KeyType.HDWalletRootKey,
            keystoreKeyId: 'ks-seed-1',
        }

        const derivationParams = {
            account: 0,
            keyIndex: 0,
            derivationType: 9, // BIP32DerivationType.Peikert
        }

        beforeEach(() => {
            // Mock secure storage to return seed and entropy
            const fakeSeedBase64 = Buffer.from('fake-seed').toString('base64')
            const fakeEntropyBase64 =
                Buffer.from('fake-entropy').toString('base64')
            mockSecureGetItem.mockImplementation(async (key: string) => {
                if (key.startsWith('hd-seed-')) {
                    return new TextEncoder().encode(fakeSeedBase64)
                }
                if (key.startsWith('entropy-')) {
                    return new TextEncoder().encode(fakeEntropyBase64)
                }
                return null
            })
        })

        test('session signTransaction derives key then signs via keyStore', async () => {
            const mockSig = new Uint8Array(64).fill(1)
            mockKeyStoreDeriveFromSeed.mockResolvedValue('derived-key-1')
            mockKeyStoreSign.mockResolvedValue(mockSig)

            const { result } = renderHook(() => useHDWallet())

            let signResult: Uint8Array | undefined
            await act(async () => {
                signResult = await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.signTransaction(
                            derivationParams,
                            new Uint8Array([1, 2, 3]),
                        )
                    },
                )
            })

            expect(signResult).toBe(mockSig)
            expect(mockKeyStoreDeriveFromSeed).toHaveBeenCalledWith(
                'ks-seed-1',
                "m/44'/283'/0'/0/0",
                { algorithm: 'EdDSA', mode: 'peikert' },
            )
            expect(mockKeyStoreSign).toHaveBeenCalledWith(
                'derived-key-1',
                new Uint8Array([1, 2, 3]),
            )
        })

        test('session signData derives key then signs via keyStore', async () => {
            const mockSig = new Uint8Array(64).fill(2)
            mockKeyStoreDeriveFromSeed.mockResolvedValue('derived-key-2')
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
                'derived-key-2',
                new Uint8Array([4, 5, 6]),
            )
        })

        test('session getPublicKey derives address locally from seed', async () => {
            const mockPubKey = new Uint8Array(32).fill(3)
            mockDeriveAddress.mockResolvedValue(mockPubKey)

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
            expect(mockDeriveAddress).toHaveBeenCalledWith(
                expect.any(Buffer),
                derivationParams,
            )
        })

        test('session getMnemonic returns mnemonic from entropy', async () => {
            mockEntropyToMnemonic.mockReturnValue('recovered mnemonic words')

            const { result } = renderHook(() => useHDWallet())

            let mnemonic: string | undefined
            await act(async () => {
                mnemonic = await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getMnemonic()
                    },
                )
            })

            expect(mnemonic).toBe('recovered mnemonic words')
            expect(mockEntropyToMnemonic).toHaveBeenCalled()
        })

        test('calls checkAccess with key and domain', async () => {
            mockKeyStoreDeriveFromSeed.mockResolvedValue('derived-key-4')
            mockKeyStoreSign.mockResolvedValue(new Uint8Array(64))

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

        test('caches derived key IDs within a session', async () => {
            const mockSig = new Uint8Array(64).fill(5)
            mockKeyStoreDeriveFromSeed.mockResolvedValue('derived-key-cached')
            mockKeyStoreSign.mockResolvedValue(mockSig)

            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        // Sign twice with same params — should only derive once
                        await session.signTransaction(
                            derivationParams,
                            new Uint8Array([1]),
                        )
                        await session.signTransaction(
                            derivationParams,
                            new Uint8Array([2]),
                        )
                    },
                )
            })

            expect(mockKeyStoreDeriveFromSeed).toHaveBeenCalledTimes(1)
            expect(mockKeyStoreSign).toHaveBeenCalledTimes(2)
        })

        test('throws KeyManagementError when key has no keystoreKeyId', async () => {
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

        test('uses standard mode for Khovratovich derivation type', async () => {
            mockKeyStoreDeriveFromSeed.mockResolvedValue('derived-key-kh')
            mockKeyStoreSign.mockResolvedValue(new Uint8Array(64))

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

            expect(mockKeyStoreDeriveFromSeed).toHaveBeenCalledWith(
                'ks-seed-1',
                "m/44'/283'/1'/0/2",
                { algorithm: 'EdDSA', mode: 'standard' },
            )
        })
    })
})
