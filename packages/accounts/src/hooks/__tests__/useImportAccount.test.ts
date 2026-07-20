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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import algosdk from 'algosdk'
import { createHash } from 'crypto'
import { useImportAccount } from '../useImportAccount'
import { useAccountsStore } from '../../store'
import { SeedScheme } from '@perawallet/wallet-core-kms'
import { DuplicateAccountError } from '../../errors'

const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))

// Test-only stand-in for the quantum address derivation: deterministic per
// seed (so repeated imports of the same mnemonic hit the duplicate guard)
// and distinct across seeds. Not the real Falcon derivation — that's covered
// by the kms package's own tests (useQuantum.test.ts, useKMS.test.ts) — this
// only needs to exercise useImportAccount's dedup/branching logic.
const deriveTestQuantumAddress = (seed: Uint8Array): string =>
    algosdk.encodeAddress(
        new Uint8Array(createHash('sha512-256').update(seed).digest()),
    )

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
    KeyContext: { Address: 0 },
    XHDWalletAPI: class {},
    fromSeed: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn((address: Uint8Array) =>
        Buffer.from(address).toString('base64'),
    ),
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...actual,
        generateOrderedUniqueId: uuidSpies.v7,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const mockKeyStoreExport = vi.fn()

const kmsMock = vi.hoisted(() => ({
    getKey: vi.fn(),
    getKeyOrThrow: vi.fn(),
    createHDWalletKey: vi.fn(),
    createAlgo25Key: vi.fn(),
    createQuantumKey: vi.fn(),
    removeKeyAndChildren: vi.fn(),
    persistHDMasterKey: vi.fn(),
    generateDerivedKey: vi.fn(),
    withExportedKey: vi.fn(),
}))

const prepareHDMasterKeyMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-kms', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-kms')
    >('@perawallet/wallet-core-kms')
    return {
        ...actual,
        useKMS: vi.fn(() => kmsMock),
        prepareHDMasterKey: prepareHDMasterKeyMock,
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useUpdateDeviceMutation: vi.fn(() => ({
        mutateAsync: vi.fn(async () => ({})),
    })),
    useDeviceID: vi.fn(() => 'device-id'),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: {
            getDevicePlatform: () => 'ios',
        },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

describe('useImportAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        kmsMock.getKey.mockReset()
        kmsMock.getKeyOrThrow.mockReset()
        kmsMock.createHDWalletKey.mockReset()
        kmsMock.createAlgo25Key.mockReset()
        kmsMock.createQuantumKey.mockReset()
        kmsMock.removeKeyAndChildren.mockReset()
        kmsMock.generateDerivedKey.mockReset()
        kmsMock.withExportedKey.mockReset()
        mockKeyStoreExport.mockReset()

        kmsMock.getKey.mockReturnValue(null)
        kmsMock.getKeyOrThrow.mockReturnValue(null)
        kmsMock.createHDWalletKey.mockResolvedValue({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Bip39 },
            },
        })
        kmsMock.createAlgo25Key.mockResolvedValue({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'ALGO25_PUBLIC_KEY',
        })
        kmsMock.createQuantumKey.mockResolvedValue({
            seedKey: {
                id: 'QSEED1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Quantum },
            },
            address: 'QUANTUM_ADDRESS',
            signKeyId: 'QSEED1-quantum',
        })
        kmsMock.removeKeyAndChildren.mockResolvedValue(undefined)
        kmsMock.generateDerivedKey.mockResolvedValue('ks-derived-1')
        mockKeyStoreExport.mockResolvedValue({
            publicKey: new Uint8Array(32).fill(2),
        })
        kmsMock.withExportedKey.mockImplementation(
            async (keyId: string, handler: (keyData: any) => any) => {
                const keyData = await mockKeyStoreExport(keyId)
                return handler(keyData)
            },
        )
        prepareHDMasterKeyMock.mockReset()
        prepareHDMasterKeyMock.mockResolvedValue({
            keyId: 'WALLET1',
            rootKey: new Uint8Array(96).fill(1),
            entropy: new Uint8Array(32).fill(2),
            mnemonic: 'test mnemonic',
        })
    })

    test('hd wallet path: prepares import session, does not create an account', async () => {
        prepareHDMasterKeyMock.mockResolvedValueOnce({
            keyId: 'WALLET1',
            rootKey: new Uint8Array(96).fill(1),
            entropy: new Uint8Array(32).fill(2),
            mnemonic: 'test mnemonic',
        })

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'hdWallet',
            })
        })

        expect(imported.type).toBe('hdWallet')
        expect(imported.walletKeyId).toBe('WALLET1')
        expect(imported.derivationType).toBe(9)
        // No WalletAccount should have been pushed to the store yet.
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
        // createHDWalletKey must not be called in the new flow.
        expect(kmsMock.createHDWalletKey).not.toHaveBeenCalled()
    })

    test('hd wallet path: surfaces prepareHDMasterKey errors', async () => {
        prepareHDMasterKeyMock.mockRejectedValueOnce(
            new Error('Invalid mnemonic'),
        )

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'invalid mnemonic',
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Invalid mnemonic')
        })
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    test('imports algo25 account with mnemonic', async () => {
        kmsMock.createAlgo25Key.mockResolvedValueOnce({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'ALGO25_PUBLIC_KEY',
        })

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'algo25',
            })
        })

        expect(kmsMock.createAlgo25Key).toHaveBeenCalledWith({
            mnemonic: 'test mnemonic',
        })
        expect(imported.address).toBe('ALGO25_PUBLIC_KEY')
        expect(imported.type).toBe('algo25')
        // keyPairId is the deterministic ed25519 child of the seed.
        expect(imported.keyPairId).toBe('WALLET1-ed25519')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('uses the seed reference from createAlgo25Key without consulting getKey (regression: stale useMemo)', async () => {
        // Simulate the stale-useMemo race: the freshly-minted key isn't yet
        // visible to getKey, which reads from a useMemo bound to the previous
        // render. Without passing the seed reference through, the import
        // would fall back to creating a new no-mnemonic key (random address).
        kmsMock.createAlgo25Key.mockResolvedValueOnce({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'CORRECT_ADDRESS',
        })
        kmsMock.getKey.mockReturnValue(null)

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'algo25',
            })
        })

        expect(kmsMock.createAlgo25Key).toHaveBeenCalledTimes(1)
        expect(kmsMock.createAlgo25Key).toHaveBeenCalledWith({
            mnemonic: 'test mnemonic',
        })
        expect(kmsMock.getKey).not.toHaveBeenCalled()
        expect(imported.address).toBe('CORRECT_ADDRESS')
        expect(imported.keyPairId).toBe('WALLET1-ed25519')
    })

    test('throws when createAlgo25Key fails', async () => {
        kmsMock.createAlgo25Key.mockRejectedValueOnce(
            new Error('Import failed'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'test mnemonic',
                    type: 'algo25',
                }),
            ).rejects.toThrow('Import failed')
        })
    })

    test('rejects a second import of the same address within one batch (no re-render between calls)', async () => {
        kmsMock.createAlgo25Key.mockResolvedValue({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'SAME_ADDRESS',
        })
        uuidSpies.v7.mockImplementation(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        // Two back-to-back imports, no re-render between them — mirrors the
        // Pera Web / ASB import loop.
        await act(async () => {
            await result.current({ mnemonic: 'a', type: 'algo25' })
            await expect(
                result.current({ mnemonic: 'a', type: 'algo25' }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        // The duplicate attempt's keystore entries were swept (seed + child).
        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('WALLET1')
    })

    test('imports quantum account with explicit quantum type', async () => {
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'quantum',
            })
        })

        expect(kmsMock.createQuantumKey).toHaveBeenCalledWith({
            mnemonic: 'test mnemonic',
        })
        expect(imported.type).toBe('quantum')
        expect(imported.address).toBe('QUANTUM_ADDRESS')
        // keyPairId is the scheme-agnostic quantum signing child of the seed.
        expect(imported.keyPairId).toBe('QSEED1-quantum')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('rejects a duplicate quantum import and sweeps the freshly minted key', async () => {
        uuidSpies.v7.mockImplementation(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await result.current({ mnemonic: 'a', type: 'quantum' })
            await expect(
                result.current({ mnemonic: 'a', type: 'quantum' }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        // The duplicate attempt's keystore entries were swept (seed + child).
        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('QSEED1')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('same mnemonic imported as quantum vs algo25 yields different addresses and both coexist', async () => {
        // Real derivations on both sides (algosdk ed25519 vs the KMS quantum
        // derivation) prove the two account types cannot collide by address
        // in the store — not just that the mocks were wired differently.
        const generated = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(generated.sk)

        kmsMock.createAlgo25Key.mockImplementation(
            async ({ mnemonic: m }: { mnemonic: string }) => ({
                seedKey: {
                    id: 'A25SEED',
                    type: 'seed',
                    algorithm: 'raw',
                    extractable: true,
                    metadata: { scheme: SeedScheme.Algo25 },
                },
                address: algosdk.mnemonicToSecretKey(m).addr.toString(),
            }),
        )
        kmsMock.createQuantumKey.mockImplementation(
            async ({ mnemonic: m }: { mnemonic: string }) => {
                const seed = algosdk.seedFromMnemonic(m)
                return {
                    seedKey: {
                        id: 'QSEED1',
                        type: 'seed',
                        algorithm: 'raw',
                        extractable: true,
                        metadata: { scheme: SeedScheme.Quantum },
                    },
                    address: deriveTestQuantumAddress(seed),
                    signKeyId: 'QSEED1-quantum',
                }
            },
        )

        let counter = 0
        uuidSpies.v7.mockImplementation(() => `ACC${++counter}`)

        const { result } = renderHook(() => useImportAccount())

        let asAlgo25: any
        let asQuantum: any
        await act(async () => {
            asAlgo25 = await result.current({ mnemonic, type: 'algo25' })
            asQuantum = await result.current({ mnemonic, type: 'quantum' })
        })

        expect(asAlgo25.type).toBe('algo25')
        expect(asQuantum.type).toBe('quantum')
        expect(asQuantum.address).not.toBe(asAlgo25.address)
        expect(useAccountsStore.getState().accounts).toHaveLength(2)
    })

    test('repeated quantum imports of the same mnemonic derive the same address', async () => {
        // Device-portability NFR: the second import derives the identical
        // address (real derivation), so it must hit the duplicate guard.
        kmsMock.createQuantumKey.mockImplementation(
            async ({ mnemonic: m }: { mnemonic: string }) => {
                const seed = algosdk.seedFromMnemonic(m)
                return {
                    seedKey: {
                        id: 'QSEED1',
                        type: 'seed',
                        algorithm: 'raw',
                        extractable: true,
                        metadata: { scheme: SeedScheme.Quantum },
                    },
                    address: deriveTestQuantumAddress(seed),
                    signKeyId: 'QSEED1-quantum',
                }
            },
        )
        const generated = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(generated.sk)

        uuidSpies.v7.mockImplementation(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await result.current({ mnemonic, type: 'quantum' })
            await expect(
                result.current({ mnemonic, type: 'quantum' }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })
        // Discriminate the quantum path: both imports must have gone through
        // createQuantumKey (not fallen through to the algo25 branch), and the
        // duplicate attempt swept the quantum seed's keystore entries.
        expect(kmsMock.createQuantumKey).toHaveBeenCalledTimes(2)
        expect(kmsMock.createAlgo25Key).not.toHaveBeenCalled()
        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('QSEED1')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })
})
