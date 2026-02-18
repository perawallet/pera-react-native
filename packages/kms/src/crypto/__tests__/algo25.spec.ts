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
import nacl from 'tweetnacl'
import {
    generateAlgo25Key,
    algo25Sign,
    algo25PublicKeyFromSeed,
    createAlgo25Key,
    withAlgo25Session,
} from '../algo25'
import { KeyType, KeyPair, StoredKeyMaterial } from '../../models'
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
const mockExecuteWithKey = vi.fn()
const mockGetSeedFromMasterKey = vi.fn()

vi.mock('../../utils', () => ({
    saveKey: (...args: any[]) => mockSaveKey(...args),
    executeWithKey: (...args: any[]) => mockExecuteWithKey(...args),
    getSeedFromMasterKey: (...args: any[]) => mockGetSeedFromMasterKey(...args),
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

describe('crypto/algo25', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('generateAlgo25Key', () => {
        test('returns seed from mnemonic when provided', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)

            const result = await generateAlgo25Key('test mnemonic words')

            expect(mockSeedFromMnemonic).toHaveBeenCalledWith(
                'test mnemonic words',
            )
            expect(result).toBe(fakeSeed)
        })

        test('throws KeyManagementError when no mnemonic is provided', async () => {
            await expect(generateAlgo25Key()).rejects.toThrow(
                KeyManagementError,
            )
        })
    })

    describe('algo25Sign', () => {
        const testSeed = new Uint8Array(32).fill(42)

        test('produces a 64-byte ed25519 signature', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5])
            const signature = algo25Sign(testSeed, data)

            expect(signature).toBeInstanceOf(Uint8Array)
            expect(signature.length).toBe(64)
        })

        test('produces a verifiable signature', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5])
            const signature = algo25Sign(testSeed, data)
            const publicKey = algo25PublicKeyFromSeed(testSeed)

            const isValid = nacl.sign.detached.verify(
                data,
                signature,
                publicKey,
            )
            expect(isValid).toBe(true)
        })

        test('produces different signatures for different data', () => {
            const data1 = new Uint8Array([1, 2, 3])
            const data2 = new Uint8Array([4, 5, 6])

            const sig1 = algo25Sign(testSeed, data1)
            const sig2 = algo25Sign(testSeed, data2)

            expect(sig1).not.toEqual(sig2)
        })

        test('is deterministic for same seed and data', () => {
            const data = new Uint8Array([1, 2, 3])
            const sig1 = algo25Sign(testSeed, data)
            const sig2 = algo25Sign(testSeed, data)

            expect(sig1).toEqual(sig2)
        })
    })

    describe('algo25PublicKeyFromSeed', () => {
        test('returns a 32-byte public key', () => {
            const seed = new Uint8Array(32).fill(42)
            const publicKey = algo25PublicKeyFromSeed(seed)

            expect(publicKey).toBeInstanceOf(Uint8Array)
            expect(publicKey.length).toBe(32)
        })

        test('is deterministic for the same seed', () => {
            const seed = new Uint8Array(32).fill(42)
            const key1 = algo25PublicKeyFromSeed(seed)
            const key2 = algo25PublicKeyFromSeed(seed)

            expect(key1).toEqual(key2)
        })

        test('returns different keys for different seeds', () => {
            const seed1 = new Uint8Array(32).fill(1)
            const seed2 = new Uint8Array(32).fill(2)

            const key1 = algo25PublicKeyFromSeed(seed1)
            const key2 = algo25PublicKeyFromSeed(seed2)

            expect(key1).not.toEqual(key2)
        })
    })

    describe('createAlgo25Key', () => {
        test('creates and saves an Algo25 key with provided mnemonic and id', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ALGO25ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const result = await createAlgo25Key({
                id: 'my-key',
                mnemonic: 'test mnemonic',
            })

            expect(result.id).toBe('my-key')
            expect(result.publicKey).toBe('ALGO25ADDR')
            expect(result.type).toBe(KeyType.Algo25Key)
            expect(mockSaveKey).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'my-key',
                    publicKey: 'ALGO25ADDR',
                    type: KeyType.Algo25Key,
                }),
                expect.objectContaining({
                    seed: expect.any(String),
                    seedFormat: 'base64',
                }),
            )
        })

        test('generates uuid when id is not provided', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            const result = await createAlgo25Key({ mnemonic: 'test' })

            expect(result.id).toBe('mock-uuid-v7')
        })

        test('zeros out the seed after saving', async () => {
            const fakeSeed = new Uint8Array(32).fill(99)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            mockSaveKey.mockImplementation(async (key: KeyPair) => key)

            await createAlgo25Key({ mnemonic: 'test' })

            // The seed should be zeroed out after saving
            expect(fakeSeed.every(byte => byte === 0)).toBe(true)
        })
    })

    describe('withAlgo25Session', () => {
        const testSeed = new Uint8Array(32).fill(42)

        const mockKey: KeyPair = {
            id: 'algo-key-1',
            publicKey: 'ADDR',
            type: KeyType.Algo25Key,
            privateDataStorageKey: 'algo25-key-ADDR',
        }

        beforeEach(() => {
            mockGetSeedFromMasterKey.mockReturnValue(testSeed)
            mockExecuteWithKey.mockImplementation(
                async (_key: any, _domain: string, handler: any) => {
                    const mockPrivateData: StoredKeyMaterial = {
                        seed: Buffer.from(testSeed).toString('base64'),
                        seedFormat: 'base64',
                    }
                    return handler(mockPrivateData)
                },
            )
        })

        test('provides a session with signTransaction method', async () => {
            const txData = new Uint8Array([1, 2, 3])

            const result = await withAlgo25Session(
                mockKey,
                'test-domain',
                async session => {
                    return session.signTransaction(txData)
                },
            )

            expect(result).toBeInstanceOf(Uint8Array)
            expect(result.length).toBe(64)
        })

        test('provides a session with signData method', async () => {
            const data = new Uint8Array([4, 5, 6])

            const result = await withAlgo25Session(
                mockKey,
                'test-domain',
                async session => {
                    return session.signData(data)
                },
            )

            expect(result).toBeInstanceOf(Uint8Array)
            expect(result.length).toBe(64)
        })

        test('provides a session with getPublicKey method', async () => {
            const result = await withAlgo25Session(
                mockKey,
                'test-domain',
                async session => {
                    return session.getPublicKey()
                },
            )

            expect(result).toBeInstanceOf(Uint8Array)
            expect(result.length).toBe(32)
        })

        test('provides a session with getMnemonic method', async () => {
            mockMnemonicFromSeed.mockReturnValue('word1 word2 word3')

            const result = await withAlgo25Session(
                mockKey,
                'test-domain',
                async session => {
                    return session.getMnemonic()
                },
            )

            expect(result).toBe('word1 word2 word3')
            expect(mockMnemonicFromSeed).toHaveBeenCalledWith(testSeed)
        })

        test('passes the correct key and domain to executeWithKey', async () => {
            await withAlgo25Session(mockKey, 'my-domain', async () => 'ok')

            expect(mockExecuteWithKey).toHaveBeenCalledWith(
                mockKey,
                'my-domain',
                expect.any(Function),
            )
        })
    })
})
