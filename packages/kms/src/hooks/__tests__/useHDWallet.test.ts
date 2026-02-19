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
import { KeyType, KeyPair, StoredKeyMaterial } from '../../models'
import { InvalidKeyError } from '../../errors'

const mockKeyGen = vi.fn()
const mockSignAlgoTransaction = vi.fn()
const mockSignData = vi.fn()

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    XHDWalletAPI: class {
        keyGen = (...args: any[]) => mockKeyGen(...args)
        signAlgoTransaction = (...args: any[]) =>
            mockSignAlgoTransaction(...args)
        signData = (...args: any[]) => mockSignData(...args)
    },
    fromSeed: vi.fn(() => 'mock-root-key'),
    KeyContext: { Address: 0 },
    BIP32DerivationType: { Peikert: 9 },
    Encoding: { BASE64: 'base64' },
}))

const mockGenerateMnemonic = vi.fn()
const mockMnemonicToSeed = vi.fn()
const mockMnemonicToEntropy = vi.fn()
const mockEntropyToMnemonic = vi.fn()

vi.mock('bip39', () => ({
    generateMnemonic: (...args: any[]) => mockGenerateMnemonic(...args),
    mnemonicToSeed: (...args: any[]) => mockMnemonicToSeed(...args),
    mnemonicToEntropy: (...args: any[]) => mockMnemonicToEntropy(...args),
    entropyToMnemonic: (...args: any[]) => mockEntropyToMnemonic(...args),
}))

vi.mock('../../crypto/wordlist', () => ({
    WORDLIST: ['abandon', 'ability', 'able'],
}))

const mockSaveKey = vi.fn()
const mockExecuteWithKey = vi.fn()

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        saveKey: (...args: any[]) => mockSaveKey(...args),
        executeWithKey: (...args: any[]) => mockExecuteWithKey(...args),
    }),
}))

const mockGetSeedFromMasterKey = vi.fn()
const mockGetEntropyFromMasterKey = vi.fn()

vi.mock('../../utils', async () => {
    const actual = await vi.importActual<object>('../../utils')
    return {
        ...actual,
        getSeedFromMasterKey: (...args: any[]) =>
            mockGetSeedFromMasterKey(...args),
        getEntropyFromMasterKey: (...args: any[]) =>
            mockGetEntropyFromMasterKey(...args),
    }
})

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

describe('useHDWallet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createHDWalletKey', () => {
        beforeEach(() => {
            const fakeSeed = Buffer.from('seed-data')
            mockGenerateMnemonic.mockReturnValue('generated mnemonic')
            mockMnemonicToSeed.mockResolvedValue(fakeSeed)
            mockMnemonicToEntropy.mockReturnValue('entropy-hex')
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
        })

        test('saves key with seed and entropy', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'my mnemonic',
                })
            })

            expect(mockSaveKey).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'hd-1',
                    type: KeyType.HDWalletRootKey,
                }),
                expect.objectContaining({
                    seed: expect.any(String),
                    seedFormat: 'base64',
                    entropy: 'entropy-hex',
                }),
            )
        })

        test('generates uuid when id is not provided', async () => {
            const { result } = renderHook(() => useHDWallet())

            let keyResult: KeyPair | undefined
            await act(async () => {
                keyResult = await result.current.createHDWalletKey()
            })

            expect(keyResult!.id).toBe('mock-uuid-v7')
        })

        test('zeros out the master seed after saving', async () => {
            const fakeSeed = Buffer.from('seed-data-to-clear')
            mockMnemonicToSeed.mockResolvedValue(fakeSeed)

            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({ mnemonic: 'test' })
            })

            expect(fakeSeed.every(byte => byte === 0)).toBe(true)
        })

        test('uses provided mnemonic instead of generating', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey({
                    mnemonic: 'provided mnemonic words',
                })
            })

            expect(mockGenerateMnemonic).not.toHaveBeenCalled()
            expect(mockMnemonicToSeed).toHaveBeenCalledWith(
                'provided mnemonic words',
            )
        })

        test('generates a new mnemonic when none is provided', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.createHDWalletKey()
            })

            expect(mockGenerateMnemonic).toHaveBeenCalledWith(256, undefined, [
                'abandon',
                'ability',
                'able',
            ])
        })
    })

    describe('withHDSession', () => {
        const testSeedBytes = new Uint8Array(64).fill(7)
        const mockKey: KeyPair = {
            id: 'hd-key-1',
            publicKey: '',
            type: KeyType.HDWalletRootKey,
            privateDataStorageKey: 'hdwallet-root-key-hd-key-1',
        }

        const derivationParams = {
            account: 0,
            keyIndex: 0,
            derivationType: 9,
        }

        beforeEach(() => {
            mockGetSeedFromMasterKey.mockReturnValue(testSeedBytes)
            mockExecuteWithKey.mockImplementation(
                async (_key: any, _domain: string, handler: any) => {
                    const mockPrivateData: StoredKeyMaterial = {
                        seed: Buffer.from(testSeedBytes).toString('base64'),
                        seedFormat: 'base64',
                        entropy: Buffer.from('entropy').toString('base64'),
                    }
                    return handler(mockPrivateData)
                },
            )
        })

        test('session signTransaction delegates to XHDWalletAPI', async () => {
            const mockSig = new Uint8Array(64).fill(1)
            mockSignAlgoTransaction.mockResolvedValue(mockSig)

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
            expect(mockSignAlgoTransaction).toHaveBeenCalledWith(
                'mock-root-key',
                0, // KeyContext.Address
                0, // account
                0, // keyIndex
                new Uint8Array([1, 2, 3]),
                9, // derivationType
            )
        })

        test('session signData delegates to XHDWalletAPI', async () => {
            const mockSig = new Uint8Array(64).fill(2)
            mockSignData.mockResolvedValue(mockSig)

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
            expect(mockSignData).toHaveBeenCalledWith(
                'mock-root-key',
                0, // KeyContext.Address
                0, // account
                0, // keyIndex
                new Uint8Array([4, 5, 6]),
                expect.objectContaining({ encoding: 'base64' }),
                9, // derivationType
            )
        })

        test('session getPublicKey delegates to XHDWalletAPI keyGen', async () => {
            const mockPubKey = new Uint8Array(32).fill(3)
            mockKeyGen.mockResolvedValue(mockPubKey)

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
            expect(mockKeyGen).toHaveBeenCalledWith(
                'mock-root-key',
                0, // KeyContext.Address
                0, // account
                0, // keyIndex
                9, // derivationType
            )
        })

        test('session getMnemonic returns mnemonic from entropy', async () => {
            const entropy = Buffer.from('entropy')
            mockGetEntropyFromMasterKey.mockReturnValue(new Uint8Array(entropy))
            mockEntropyToMnemonic.mockReturnValue('recovered mnemonic words')

            const { result } = renderHook(() => useHDWallet())

            let mnemonicResult: string | undefined
            await act(async () => {
                mnemonicResult = await result.current.withHDSession(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getMnemonic()
                    },
                )
            })

            expect(mnemonicResult).toBe('recovered mnemonic words')
            expect(mockEntropyToMnemonic).toHaveBeenCalled()
        })

        test('session getMnemonic throws InvalidKeyError when no entropy', async () => {
            mockGetEntropyFromMasterKey.mockReturnValue(null)

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
            ).rejects.toThrow(InvalidKeyError)
        })

        test('passes the correct key and domain to executeWithKey', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.withHDSession(
                    mockKey,
                    'my-domain',
                    async () => 'ok',
                )
            })

            expect(mockExecuteWithKey).toHaveBeenCalledWith(
                mockKey,
                'my-domain',
                expect.any(Function),
            )
        })
    })
})
