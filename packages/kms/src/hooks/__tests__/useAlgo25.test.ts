/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import type { Optional } from '@perawallet/wallet-core-shared'

const mockSeedFromMnemonic = vi.fn()
const mockEncodeAddress = vi.fn()

vi.mock('algosdk', async importOriginal => ({
    ...(await importOriginal<typeof import('algosdk')>()),
    seedFromMnemonic: (...args: any[]) => mockSeedFromMnemonic(...args),
    mnemonicFromSeed: vi.fn(),
    encodeAddress: (...args: any[]) => mockEncodeAddress(...args),
}))

const mockKeyStoreImport = vi.fn()
const mockKeyStoreGenerate = vi.fn()
const mockKeyStoreRemove = vi.fn()

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        keyStore: {
            import: (...args: any[]) => mockKeyStoreImport(...args),
            generate: (...args: any[]) => mockKeyStoreGenerate(...args),
            remove: (...args: any[]) => mockKeyStoreRemove(...args),
        },
    }),
}))

// Hoisted: `@perawallet/wallet-core-shared` is imported before this module's
// const declarations would otherwise run.
const { mockLoggerError } = vi.hoisted(() => ({ mockLoggerError: vi.fn() }))
vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<{ logger: object }>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateOrderedUniqueId: () => 'mock-uuid-v7',
        logger: { ...actual.logger, error: mockLoggerError },
    }
})

import { useAlgo25, type Algo25KeyResult } from '../useAlgo25'
import { algo25SignKeyId } from '../../models'
import { SeedScheme } from '../../constants'

describe('useAlgo25', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeyStoreImport.mockResolvedValue('my-key')
        mockKeyStoreGenerate.mockResolvedValue('my-key-ed25519')
    })

    describe('createAlgo25Key', () => {
        test('imports the seed, generates an ed25519 child, and returns address + seedKey + signKeyId', async () => {
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

            expect(keyResult!.address).toBe('ALGO25ADDR')
            expect(keyResult!.seedKey.id).toBe('my-key')
            expect(keyResult!.seedKey.type).toBe('seed')
            expect((keyResult!.seedKey.metadata as any).scheme).toBe(
                SeedScheme.Algo25,
            )
            expect(keyResult!.signKeyId).toBe(algo25SignKeyId('my-key'))
        })

        test('persists the seed with scheme=algo25 metadata via keyStore.import', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            const expectedBytes = Array.from(fakeSeed)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')

            // Snapshot the privateKey contents synchronously when import
            // fires — `createAlgo25Key` now passes the seed buffer
            // directly (no defensive copy) and zeros it in `finally`,
            // so reading `arg.privateKey` after the await would see all
            // zeros. The snapshot captures what the keystore actually
            // received.
            let privateKeySnapshot: number[] = []
            mockKeyStoreImport.mockImplementationOnce(
                async (data: { privateKey?: Uint8Array }) => {
                    if (data.privateKey) {
                        privateKeySnapshot = Array.from(data.privateKey)
                    }
                    return 'my-key'
                },
            )

            const { result } = renderHook(() => useAlgo25())
            await act(async () => {
                await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            // Two imports: the seed, then its Ed25519 signing child.
            expect(mockKeyStoreImport).toHaveBeenCalledTimes(2)
            const arg = mockKeyStoreImport.mock.calls[0][0]
            expect(arg).toMatchObject({
                id: 'my-key',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
            })
            expect(privateKeySnapshot).toEqual(expectedBytes)
            // The post-call buffer is wiped — proves the zeroing path
            // actually fired.
            expect(Array.from(arg.privateKey)).toEqual(new Array(32).fill(0))
            expect(arg.metadata.scheme).toBe(SeedScheme.Algo25)
            expect(arg.metadata.pera.createdAt).toBeDefined()
        })

        test('imports the ed25519 sign child keyed to the seed, not a fresh random key', async () => {
            const fakeSeed = new Uint8Array(32).fill(1)
            mockSeedFromMnemonic.mockReturnValue(fakeSeed)
            mockEncodeAddress.mockReturnValue('ADDR')
            // Both the expectations and the recorded call have to be captured
            // before `createAlgo25Key` zeroes the seed buffer in its finally —
            // the child rides that same reference.
            const expectedSeed = Array.from(fakeSeed)
            const expectedPublicKey = Array.from(
                nacl.sign.keyPair.fromSeed(fakeSeed).publicKey,
            )
            const seen: Array<Record<string, any>> = []
            mockKeyStoreImport.mockImplementation(async (data: any) => {
                seen.push({
                    ...data,
                    privateKey:
                        data.privateKey && Uint8Array.from(data.privateKey),
                    publicKey:
                        data.publicKey && Uint8Array.from(data.publicKey),
                })
                return data.id
            })

            const { result } = renderHook(() => useAlgo25())
            await act(async () => {
                await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            const child = seen.find(d => d.id === algo25SignKeyId('my-key'))
            expect(child).toMatchObject({
                type: 'ed25519',
                algorithm: 'EdDSA',
                metadata: { parentKeyId: 'my-key' },
            })
            // The whole point: the child's keypair must be THIS seed's, or the
            // account's address and its signing key drift apart and every
            // transaction it signs is invalid.
            expect(Array.from(child!.privateKey)).toEqual(expectedSeed)
            expect(Array.from(child!.publicKey)).toEqual(expectedPublicKey)
        })

        test('does not mint the sign child through generate', async () => {
            mockSeedFromMnemonic.mockReturnValue(new Uint8Array(32).fill(1))
            mockEncodeAddress.mockReturnValue('ADDR')

            const { result } = renderHook(() => useAlgo25())
            await act(async () => {
                await result.current.createAlgo25Key({
                    id: 'my-key',
                    mnemonic: 'test mnemonic',
                })
            })

            // canary.14's `generateEd25519` ignores `parentKeyId` and mints a
            // random keypair, silently decoupling the key from the address.
            expect(mockKeyStoreGenerate).not.toHaveBeenCalled()
        })

        test('generates a uuid id when not provided', async () => {
            mockSeedFromMnemonic.mockReturnValue(new Uint8Array(32))
            mockEncodeAddress.mockReturnValue('ADDR')
            const { result } = renderHook(() => useAlgo25())
            let keyResult: Optional<Algo25KeyResult>
            await act(async () => {
                keyResult = await result.current.createAlgo25Key({
                    mnemonic: 'words',
                })
            })
            expect(keyResult!.seedKey.id).toBe('mock-uuid-v7')
        })

        test('rolls back the seed if the ed25519 child fails to import', async () => {
            mockSeedFromMnemonic.mockReturnValue(new Uint8Array(32))
            mockEncodeAddress.mockReturnValue('ADDR')
            // First import is the seed; the second is the signing child.
            mockKeyStoreImport
                .mockResolvedValueOnce('my-key')
                .mockRejectedValueOnce(new Error('boom'))

            const { result } = renderHook(() => useAlgo25())
            await expect(
                act(async () => {
                    await result.current.createAlgo25Key({
                        id: 'my-key',
                        mnemonic: 'words',
                    })
                }),
            ).rejects.toThrow('boom')

            expect(mockKeyStoreRemove).toHaveBeenCalledWith('my-key')
        })

        test('reports which step failed when the signing-child import throws', async () => {
            mockSeedFromMnemonic.mockReturnValue(new Uint8Array(32).fill(1))
            mockEncodeAddress.mockReturnValue('ADDR')
            mockKeyStoreImport
                .mockResolvedValueOnce('my-key')
                .mockRejectedValueOnce(new Error('keystore rejected'))

            const { result } = renderHook(() => useAlgo25())
            await expect(
                act(async () => {
                    await result.current.createAlgo25Key({
                        id: 'my-key',
                        mnemonic: 'words',
                    })
                }),
            ).rejects.toThrow('keystore rejected')

            expect(mockLoggerError).toHaveBeenCalledWith(
                'createAlgo25Key failed',
                expect.objectContaining({ stage: 'signChild' }),
            )
        })

        test('reports the seed stage when the mnemonic is unusable', async () => {
            mockSeedFromMnemonic.mockImplementation(() => {
                throw new Error('not a mnemonic')
            })

            const { result } = renderHook(() => useAlgo25())
            await expect(
                act(async () => {
                    await result.current.createAlgo25Key({
                        mnemonic: 'not a mnemonic',
                    })
                }),
            ).rejects.toThrow()

            expect(mockLoggerError).toHaveBeenCalledWith(
                'createAlgo25Key failed',
                expect.objectContaining({ stage: 'seed' }),
            )
        })
    })
})
