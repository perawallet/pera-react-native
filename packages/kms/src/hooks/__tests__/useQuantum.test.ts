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
import type { Optional } from '@perawallet/wallet-core-shared'
import { isValidAddress, seedFromMnemonic } from 'algosdk'

const mockKeyStoreImport = vi.fn()
const mockKeyStoreRemove = vi.fn()
const mockKeyStoreGenerate = vi.fn()
const mockKeyStoreExport = vi.fn()

vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        keyStore: {
            import: (...args: unknown[]) => mockKeyStoreImport(...args),
            remove: (...args: unknown[]) => mockKeyStoreRemove(...args),
            generate: (...args: unknown[]) => mockKeyStoreGenerate(...args),
            export: (...args: unknown[]) => mockKeyStoreExport(...args),
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

import { useQuantum, type QuantumKeyResult } from '../useQuantum'
import { quantumSignKeyId, FALCON_CHILD_KEY_TYPE } from '../../models'
import { SeedScheme } from '../../constants'
import { getPQProvider } from '../../crypto/pq'
import { deriveQuantumAddress } from '@perawallet/wallet-core-blockchain'

// THROWAWAY TEST VECTOR — same as algo25-integration.test.ts; NEVER fund it.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

// The address `apps/mobile/src/__integration__/__fixtures__/quantum.ts` derives
// for this mnemonic, pinned as a literal from before custody moved into the
// keystore. Custody changed; derivation must not.
const KNOWN_QUANTUM_ADDRESS_FOR_TEST_MNEMONIC =
    'TQLMWJPC7FZQ2EE7HWCWODSGZPCCESJHQIH3VEGKKJ23YFSFCD4Y662IOU'

/** Public keys the keystore double minted, keyed by the id it minted them under. */
const generatedKeys = new Map<string, Uint8Array>()

describe('useQuantum', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        generatedKeys.clear()
        mockKeyStoreImport.mockResolvedValue('my-key')
        // Stands in for keystore-core's `falcon-1024` generator: derive the
        // keypair from `params.seed`, record only the public half on the entry,
        // and hand it back through `export` as plain metadata. It resolves the
        // id the same way the engine does — `params.id ?? randomUUID()` — so a
        // caller that stopped passing one gets a random id here too.
        mockKeyStoreGenerate.mockImplementation(
            async (options: {
                params?: { id?: string; seed: Uint8Array }
            }): Promise<string> => {
                const id = options.params?.id ?? crypto.randomUUID()
                const { publicKey } = getPQProvider().generateKeypairFromSeed(
                    options.params!.seed,
                )
                generatedKeys.set(id, publicKey)
                return id
            },
        )
        mockKeyStoreExport.mockImplementation(async (id: string) => ({
            id,
            publicKey: generatedKeys.get(id),
        }))
    })

    describe('createQuantumKey', () => {
        test('imports the seed, commits a quantum child, and returns address + seedKey + signKeyId', async () => {
            const { result } = renderHook(() => useQuantum())

            let keyResult: Optional<QuantumKeyResult>
            await act(async () => {
                keyResult = await result.current.createQuantumKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(keyResult!.seedKey.id).toBe('my-key')
            expect(keyResult!.seedKey.type).toBe('seed')
            expect(
                (keyResult!.seedKey.metadata as { scheme?: string }).scheme,
            ).toBe(SeedScheme.Quantum)
            expect(keyResult!.signKeyId).toBe(quantumSignKeyId('my-key'))
            expect(keyResult!.address).toHaveLength(58)
            expect(isValidAddress(keyResult!.address)).toBe(true)
        })

        test('persists the seed with scheme=quantum metadata and zeroes the buffer after import', async () => {
            // Snapshot the privateKey synchronously when import fires — the
            // hook passes the seed buffer directly (no defensive copy) and
            // zeroes it in `finally`, mirroring createAlgo25Key.
            let privateKeySnapshot: number[] = []
            mockKeyStoreImport.mockImplementationOnce(
                async (data: { privateKey?: Uint8Array }) => {
                    if (data.privateKey) {
                        privateKeySnapshot = Array.from(data.privateKey)
                    }
                    return 'my-key'
                },
            )

            const { result } = renderHook(() => useQuantum())
            await act(async () => {
                await result.current.createQuantumKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(mockKeyStoreImport).toHaveBeenCalledTimes(1)
            const arg = mockKeyStoreImport.mock.calls[0][0]
            expect(arg).toMatchObject({
                id: 'my-key',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
            })
            expect(privateKeySnapshot).toHaveLength(32)
            expect(privateKeySnapshot.some(b => b !== 0)).toBe(true)
            // Post-call the buffer is wiped — the zeroing path fired.
            expect(Array.from(arg.privateKey)).toEqual(new Array(32).fill(0))
            expect(arg.metadata.scheme).toBe(SeedScheme.Quantum)
            expect(arg.metadata.pera.createdAt).toBeDefined()
        })

        test('links the child to its parent seed and derives the address from the key the keystore minted', async () => {
            const { result } = renderHook(() => useQuantum())
            let created: Optional<QuantumKeyResult>
            await act(async () => {
                created = await result.current.createQuantumKey({
                    id: 'my-key',
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(mockKeyStoreGenerate).toHaveBeenCalledTimes(1)
            const { params } = mockKeyStoreGenerate.mock.calls[0][0]
            expect(params.id).toBe(quantumSignKeyId('my-key'))
            expect(params.parentKeyId).toBe('my-key')

            const publicKey = generatedKeys.get(quantumSignKeyId('my-key'))!
            expect(publicKey).toHaveLength(getPQProvider().publicKeyLength)
            expect(created!.address).toBe(deriveQuantumAddress(publicKey))
        })

        test('generates a random 32-byte seed and a uuid id when no params given', async () => {
            const { result } = renderHook(() => useQuantum())
            let keyResult: Optional<QuantumKeyResult>
            await act(async () => {
                keyResult = await result.current.createQuantumKey()
            })
            expect(keyResult!.seedKey.id).toBe('mock-uuid-v7')
            expect(isValidAddress(keyResult!.address)).toBe(true)
        })

        test('same mnemonic produces the same public key and address across fresh hook instances', async () => {
            const addresses: string[] = []
            for (let i = 0; i < 2; i++) {
                const { result, unmount } = renderHook(() => useQuantum())
                await act(async () => {
                    const created = await result.current.createQuantumKey({
                        id: `key-${i}`,
                        mnemonic: TEST_MNEMONIC,
                    })
                    addresses.push(created.address)
                })
                unmount()
            }

            expect(addresses[0]).toBe(addresses[1])
            expect(Array.from(generatedKeys.get('key-0-quantum')!)).toEqual(
                Array.from(generatedKeys.get('key-1-quantum')!),
            )
        })

        test('rolls back the seed if minting the quantum child fails', async () => {
            mockKeyStoreGenerate.mockRejectedValueOnce(new Error('boom'))

            const { result } = renderHook(() => useQuantum())
            await expect(
                act(async () => {
                    await result.current.createQuantumKey({
                        id: 'my-key',
                        mnemonic: TEST_MNEMONIC,
                    })
                }),
            ).rejects.toThrow('boom')

            expect(mockKeyStoreRemove).toHaveBeenCalledWith('my-key')
        })

        test('derives the real Falcon address matching the adapter for a fixed mnemonic', async () => {
            const { result } = renderHook(() => useQuantum())

            let created: Optional<QuantumKeyResult>
            await act(async () => {
                created = await result.current.createQuantumKey({
                    mnemonic: TEST_MNEMONIC,
                })
            })

            const seed = seedFromMnemonic(TEST_MNEMONIC)
            const { publicKey } = getPQProvider().generateKeypairFromSeed(seed)
            expect(created!.address).toBe(deriveQuantumAddress(publicKey))
        })

        test('mints the signing child through the keystore Falcon generator', async () => {
            const { result } = renderHook(() => useQuantum())

            let created: Optional<QuantumKeyResult>
            await act(async () => {
                created = await result.current.createQuantumKey({
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(mockKeyStoreGenerate).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: FALCON_CHILD_KEY_TYPE,
                    algorithm: 'Falcon-1024',
                    extractable: false,
                    keyUsages: ['sign', 'verify'],
                    params: expect.objectContaining({
                        seed: expect.any(Uint8Array),
                    }),
                }),
            )
            expect(created!.signKeyId).toBe(
                quantumSignKeyId(created!.seedKey.id),
            )
        })

        // The address is derived from the Falcon public key, so a custody change
        // that altered derivation would silently move every quantum account.
        test('derives the same address as the pre-migration provider path', async () => {
            const { result } = renderHook(() => useQuantum())

            let created: Optional<QuantumKeyResult>
            await act(async () => {
                created = await result.current.createQuantumKey({
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(created!.address).toBe(
                KNOWN_QUANTUM_ADDRESS_FOR_TEST_MNEMONIC,
            )
        })

        // `id` is not a declared field on GenerateOptions — the engine resolves
        // it as `params?.id ?? crypto.randomUUID()`. Nothing type-checks that,
        // so pin it: a silently random id would break account.keyPairId and
        // resolveSeedKey's `-quantum` suffix lookup.
        test('honours the deterministic child id rather than minting a random one', async () => {
            const { result } = renderHook(() => useQuantum())

            let created: Optional<QuantumKeyResult>
            await act(async () => {
                created = await result.current.createQuantumKey({
                    mnemonic: TEST_MNEMONIC,
                })
            })

            expect(created!.signKeyId).toBe(`${created!.seedKey.id}-quantum`)
            expect(created!.signKeyId).not.toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            )
        })
    })
})
