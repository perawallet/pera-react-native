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

const mockGenerateHDMasterKey = vi.fn()

vi.mock('../../crypto/hdwallet-utils', () => ({
    generateHDMasterKey: (...args: any[]) => mockGenerateHDMasterKey(...args),
    entropyToMnemonic: vi.fn(),
}))

const mockFromSeed = vi.fn()

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9, Khovratovich: 32 },
    KeyContext: { Address: 0, Identity: 1 },
    fromSeed: (...args: any[]) => mockFromSeed(...args),
}))

const mockKeyStoreImport = vi.fn()
const mockKeyStoreDeriveFromSeed = vi.fn()
const mockKeyStoreSign = vi.fn()
const mockKeyStoreExport = vi.fn()
const mockKeyStoreRemove = vi.fn()
vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        keyStore: {
            import: (...args: any[]) => mockKeyStoreImport(...args),
            deriveFromSeed: (...args: any[]) =>
                mockKeyStoreDeriveFromSeed(...args),
            sign: (...args: any[]) => mockKeyStoreSign(...args),
            export: (...args: any[]) => mockKeyStoreExport(...args),
            remove: (...args: any[]) => mockKeyStoreRemove(...args),
        },
    }),
}))

// `getDerivedPublicKey` reads the publicKey from the live reactive store
// (rather than calling `keyStore.export`, since the rn-keystore stamps
// derived keys `extractable: false`).
const mockReactiveKeys: { id: string; publicKey?: Uint8Array }[] = []
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        get state() {
            return { keys: mockReactiveKeys, status: 'idle' as const }
        },
    }),
}))

const mockCommitSecret = vi.fn()
vi.mock('../../storage/secrets', () => ({
    commitSecret: (...args: any[]) => mockCommitSecret(...args),
}))

import { useHDWallet, type HDWalletKeyResult } from '../useHDWallet'
import { SeedScheme } from '../../constants'

describe('useHDWallet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockReactiveKeys.length = 0
    })

    describe('createHDWalletKey', () => {
        const rootBytes = new Uint8Array(96).fill(42)
        // Snapshot the entropy at commit time: persistHDMasterKey zeroes the
        // source buffer in its `finally`, so reading the captured reference
        // after the call would see all zeros.
        let committedEntropy:
            | { id: string; bytes: number[]; metadata: unknown }
            | undefined

        beforeEach(() => {
            committedEntropy = undefined
            mockGenerateHDMasterKey.mockResolvedValue({
                mnemonic: 'mnemonic words here',
                seed: Buffer.from(new Uint8Array(64).fill(7)),
                entropy: new Uint8Array([0xab, 0xcd, 0xef, 0x01]),
            })
            mockFromSeed.mockReturnValue(new Uint8Array(rootBytes))
            mockKeyStoreImport.mockResolvedValue('hd-1')
            mockKeyStoreRemove.mockResolvedValue(undefined)
            mockCommitSecret.mockImplementation(async (params: any) => {
                committedEntropy = {
                    id: params.id,
                    bytes: Array.from(params.bytes as Uint8Array),
                    metadata: params.metadata,
                }
            })
        })

        test('returns the persisted seed Key with bip39 scheme and no entropy in metadata', async () => {
            const { result } = renderHook(() => useHDWallet())

            let keyResult: Optional<HDWalletKeyResult>
            await act(async () => {
                keyResult = await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'mnemonic words here',
                })
            })

            expect(keyResult!.seedKey.id).toBe('hd-1')
            expect(keyResult!.seedKey.type).toBe('hd-root-key')
            const meta = keyResult!.seedKey.metadata as Record<string, unknown>
            expect(meta.scheme).toBe(SeedScheme.Bip39)
            expect('entropy' in meta).toBe(false)
        })

        test('imports the seed without entropy and commits the entropy as a separate secret-key child', async () => {
            const { result } = renderHook(() => useHDWallet())
            await act(async () => {
                await result.current.createHDWalletKey({
                    id: 'hd-1',
                    mnemonic: 'mnemonic words here',
                })
            })

            expect(mockKeyStoreImport).toHaveBeenCalledTimes(1)
            const arg = mockKeyStoreImport.mock.calls[0][0]
            // `hd-root-key`, not `seed`: canary.14's `deriveFromSeed` rejects
            // any parent that is not typed that way, so adding an account to
            // the wallet fails outright when this regresses.
            expect(arg).toMatchObject({
                id: 'hd-1',
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
            })
            // The 96-byte XHD root from `fromSeed` is what gets persisted
            // as the seed's privateKey — that's what `deriveFromSeed` and
            // `sign` need at signing time.
            expect(arg.privateKey).toBeInstanceOf(Uint8Array)
            expect(arg.privateKey.length).toBe(96)
            expect(arg.metadata.scheme).toBe(SeedScheme.Bip39)
            expect('entropy' in arg.metadata).toBe(false)
            expect(arg.metadata.pera.createdAt).toBeDefined()

            // Entropy goes to a `secret-key` child tagged with metadata that
            // ties it to the seed; the child's own id is opaque.
            expect(mockCommitSecret).toHaveBeenCalledTimes(1)
            expect(committedEntropy).toEqual({
                id: expect.any(String),
                bytes: [0xab, 0xcd, 0xef, 0x01],
                metadata: { parentKeyId: 'hd-1', entropyKey: true },
            })
        })

        test('removes the orphaned seed when committing the entropy child fails', async () => {
            // A seed without its entropy child is unrecoverable, so a failed
            // commit must not leave a partial write behind.
            mockCommitSecret.mockRejectedValueOnce(new Error('commit boom'))
            const { result } = renderHook(() => useHDWallet())

            await expect(
                act(async () => {
                    await result.current.createHDWalletKey({
                        id: 'hd-1',
                        mnemonic: 'mnemonic words here',
                    })
                }),
            ).rejects.toThrow('commit boom')

            expect(mockKeyStoreImport).toHaveBeenCalledTimes(1)
            expect(mockKeyStoreRemove).toHaveBeenCalledWith('hd-1')
        })
    })

    describe('generateDerivedKey', () => {
        beforeEach(() => {
            mockKeyStoreDeriveFromSeed.mockResolvedValue('derived-id-1')
        })

        test('calls deriveFromSeed with the BIP44 path, deterministic id, and sign-ready metadata', async () => {
            const { result } = renderHook(() => useHDWallet())

            await act(async () => {
                await result.current.generateDerivedKey('hd-1', 7, 3, 9)
            })

            expect(mockKeyStoreDeriveFromSeed).toHaveBeenCalledTimes(1)
            const [seedId, path, opts] =
                mockKeyStoreDeriveFromSeed.mock.calls[0]
            expect(seedId).toBe('hd-1')
            expect(path).toBe("m/44'/283'/7'/0/3")
            expect(opts).toMatchObject({
                id: 'hd-1-acc7-idx3-dt9',
                algorithm: 'EdDSA',
                mode: 'peikert',
                // The full canonical path metadata signXHDEd25519 reads.
                // path/context/account/index/derivation all need to be on
                // the persisted child or the BIP44 path resolves wrong and
                // verification fails dApp-side.
                metadata: {
                    path: "m/44'/283'/7'/0/3",
                    context: 0, // KeyContext.Address
                    account: 7,
                    index: 3,
                    derivation: 9,
                },
            })
        })

        test('passes mode="standard" for Khovratovich derivation', async () => {
            const { result } = renderHook(() => useHDWallet())
            await act(async () => {
                await result.current.generateDerivedKey('hd-1', 0, 0, 32)
            })
            expect(mockKeyStoreDeriveFromSeed.mock.calls[0][2].mode).toBe(
                'standard',
            )
        })
    })

    describe('getDerivedPublicKey', () => {
        beforeEach(() => {
            // deriveFromSeed commits the entry to the reactive store as a
            // side effect; the hook then reads the publicKey back from
            // that snapshot. Mirror both halves here.
            mockKeyStoreDeriveFromSeed.mockImplementation(async () => {
                mockReactiveKeys.push({
                    id: 'hd-1-acc0-idx1-dt9',
                    publicKey: new Uint8Array(32).fill(0x77),
                })
                return 'hd-1-acc0-idx1-dt9'
            })
        })

        test('derives the child and returns its publicKey from the reactive store', async () => {
            const { result } = renderHook(() => useHDWallet())
            let pub: Optional<Uint8Array>
            await act(async () => {
                pub = await result.current.getDerivedPublicKey('hd-1', 0, 1, 9)
            })
            expect(mockKeyStoreDeriveFromSeed).toHaveBeenCalledTimes(1)
            // We do NOT call keyStore.export — derived keys are
            // committed `extractable: false`, so we read the live
            // reactive snapshot instead.
            expect(mockKeyStoreExport).not.toHaveBeenCalled()
            expect(pub).toEqual(new Uint8Array(32).fill(0x77))
        })

        test('throws when the derived key has no publicKey on the reactive snapshot', async () => {
            mockKeyStoreDeriveFromSeed.mockImplementationOnce(async () => {
                mockReactiveKeys.push({ id: 'hd-1-acc0-idx1-dt9' })
                return 'hd-1-acc0-idx1-dt9'
            })
            const { result } = renderHook(() => useHDWallet())
            await expect(
                act(async () => {
                    await result.current.getDerivedPublicKey('hd-1', 0, 1, 9)
                }),
            ).rejects.toThrow()
        })
    })
})
