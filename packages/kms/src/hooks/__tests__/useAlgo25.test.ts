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
import nacl from 'tweetnacl'
import { useAlgo25 } from '../useAlgo25'
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

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        saveKey: (...args: any[]) => mockSaveKey(...args),
        executeWithKey: (...args: any[]) => mockExecuteWithKey(...args),
    }),
}))

const mockGetSeedFromMasterKey = vi.fn()

vi.mock('../../utils', () => ({
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

            expect(signResult).toBeInstanceOf(Uint8Array)
            expect(signResult!.length).toBe(64)
        })

        test('provides a session with signData method', async () => {
            const data = new Uint8Array([4, 5, 6])

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

            expect(signResult).toBeInstanceOf(Uint8Array)
            expect(signResult!.length).toBe(64)
        })

        test('provides a session with getPublicKey method', async () => {
            const { result } = renderHook(() => useAlgo25())

            let pubKeyResult: Uint8Array | undefined
            await act(async () => {
                pubKeyResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getPublicKey()
                    },
                )
            })

            expect(pubKeyResult).toBeInstanceOf(Uint8Array)
            expect(pubKeyResult!.length).toBe(32)
        })

        test('provides a session with getMnemonic method', async () => {
            mockMnemonicFromSeed.mockReturnValue('word1 word2 word3')

            const { result } = renderHook(() => useAlgo25())

            let mnemonicResult: string | undefined
            await act(async () => {
                mnemonicResult = await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        return session.getMnemonic()
                    },
                )
            })

            expect(mnemonicResult).toBe('word1 word2 word3')
            expect(mockMnemonicFromSeed).toHaveBeenCalledWith(testSeed)
        })

        test('passes the correct key and domain to executeWithKey', async () => {
            const { result } = renderHook(() => useAlgo25())

            await act(async () => {
                await result.current.withAlgo25Session(
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

        test('produces verifiable signatures through session', async () => {
            const data = new Uint8Array([1, 2, 3, 4, 5])

            const { result } = renderHook(() => useAlgo25())

            let signature: Uint8Array | undefined
            let publicKey: Uint8Array | undefined
            await act(async () => {
                await result.current.withAlgo25Session(
                    mockKey,
                    'test-domain',
                    async session => {
                        signature = await session.signTransaction(data)
                        publicKey = session.getPublicKey()
                    },
                )
            })

            const isValid = nacl.sign.detached.verify(
                data,
                signature!,
                publicKey!,
            )
            expect(isValid).toBe(true)
        })
    })
})
