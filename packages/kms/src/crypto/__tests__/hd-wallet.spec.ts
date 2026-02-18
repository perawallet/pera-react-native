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
import {
    generateHDMasterKey,
    createHDWalletKey,
    withHDSession,
} from '../hd-wallet'
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

vi.mock('../wordlist', () => ({
    WORDLIST: ['abandon', 'ability', 'able'],
}))

const mockSaveKey = vi.fn()
const mockExecuteWithKey = vi.fn()
const mockGetSeedFromMasterKey = vi.fn()
const mockGetEntropyFromMasterKey = vi.fn()

vi.mock('../../utils', () => ({
    saveKey: (...args: any[]) => mockSaveKey(...args),
    executeWithKey: (...args: any[]) => mockExecuteWithKey(...args),
    getSeedFromMasterKey: (...args: any[]) => mockGetSeedFromMasterKey(...args),
    getEntropyFromMasterKey: (...args: any[]) =>
        mockGetEntropyFromMasterKey(...args),
}))

vi.mock('uuid', () => ({
    v7: () => 'mock-uuid-v7',
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
    }
})

describe('crypto/hd-wallet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('generateHDMasterKey', () => {
        test('generates a new mnemonic when none is provided', async () => {
            const fakeMnemonic = 'word1 word2 word3'
            const fakeSeed = Buffer.from('seed-data')
            const fakeEntropy = 'abcdef1234567890'

            mockGenerateMnemonic.mockReturnValue(fakeMnemonic)
            mockMnemonicToSeed.mockResolvedValue(fakeSeed)
            mockMnemonicToEntropy.mockReturnValue(fakeEntropy)

            const result = await generateHDMasterKey()

            expect(mockGenerateMnemonic).toHaveBeenCalledWith(256, undefined, [
                'abandon',
                'ability',
                'able',
            ])
            expect(result.mnemonic).toBe(fakeMnemonic)
            expect(result.seed).toBe(fakeSeed)
            expect(result.entropy).toBe(fakeEntropy)
        })

        test('uses provided mnemonic instead of generating', async () => {
            const mnemonic = 'provided mnemonic words'
            const fakeSeed = Buffer.from('seed-data')
            const fakeEntropy = 'abc123'

            mockMnemonicToSeed.mockResolvedValue(fakeSeed)
            mockMnemonicToEntropy.mockReturnValue(fakeEntropy)

            const result = await generateHDMasterKey(mnemonic)

            expect(mockGenerateMnemonic).not.toHaveBeenCalled()
            expect(mockMnemonicToSeed).toHaveBeenCalledWith(mnemonic)
            expect(mockMnemonicToEntropy).toHaveBeenCalledWith(mnemonic)
            expect(result.mnemonic).toBe(mnemonic)
        })
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
            const result = await createHDWalletKey({
                id: 'hd-1',
                mnemonic: 'my mnemonic',
            })

            expect(result.id).toBe('hd-1')
            expect(result.publicKey).toBe('')
            expect(result.type).toBe(KeyType.HDWalletRootKey)
        })

        test('saves key with seed and entropy', async () => {
            await createHDWalletKey({ id: 'hd-1', mnemonic: 'my mnemonic' })

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
            const result = await createHDWalletKey()

            expect(result.id).toBe('mock-uuid-v7')
        })

        test('zeros out the master seed after saving', async () => {
            const fakeSeed = Buffer.from('seed-data-to-clear')
            mockMnemonicToSeed.mockResolvedValue(fakeSeed)

            await createHDWalletKey({ mnemonic: 'test' })

            expect(fakeSeed.every(byte => byte === 0)).toBe(true)
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

            const result = await withHDSession(
                mockKey,
                'test-domain',
                async session => {
                    return session.signTransaction(
                        derivationParams,
                        new Uint8Array([1, 2, 3]),
                    )
                },
            )

            expect(result).toBe(mockSig)
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

            const result = await withHDSession(
                mockKey,
                'test-domain',
                async session => {
                    return session.signData(
                        derivationParams,
                        new Uint8Array([4, 5, 6]),
                    )
                },
            )

            expect(result).toBe(mockSig)
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

            const result = await withHDSession(
                mockKey,
                'test-domain',
                async session => {
                    return session.getPublicKey(derivationParams)
                },
            )

            expect(result).toBe(mockPubKey)
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

            const result = await withHDSession(
                mockKey,
                'test-domain',
                async session => {
                    return session.getMnemonic()
                },
            )

            expect(result).toBe('recovered mnemonic words')
            expect(mockEntropyToMnemonic).toHaveBeenCalled()
        })

        test('session getMnemonic throws InvalidKeyError when no entropy', async () => {
            mockGetEntropyFromMasterKey.mockReturnValue(null)

            await expect(
                withHDSession(mockKey, 'test-domain', async session => {
                    return session.getMnemonic()
                }),
            ).rejects.toThrow(InvalidKeyError)
        })

        test('passes the correct key and domain to executeWithKey', async () => {
            await withHDSession(mockKey, 'my-domain', async () => 'ok')

            expect(mockExecuteWithKey).toHaveBeenCalledWith(
                mockKey,
                'my-domain',
                expect.any(Function),
            )
        })
    })
})
