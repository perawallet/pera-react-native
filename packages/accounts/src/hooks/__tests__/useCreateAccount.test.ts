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
import { useCreateAccount } from '../useCreateAccount'
import { useAccountsStore } from '../../store'
import { SeedScheme } from '@perawallet/wallet-core-kms'

const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))

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

const kmsMock = vi.hoisted(() => ({
    getKey: vi.fn(),
    getKeyOrThrow: vi.fn(),
    createHDWalletKey: vi.fn(),
    createAlgo25Key: vi.fn(),
    getDerivedPublicKey: vi.fn(),
    createQuantumKey: vi.fn(),
    removeKeyAndChildren: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-kms')
    >('@perawallet/wallet-core-kms')
    return {
        ...actual,
        useKMS: vi.fn(() => kmsMock),
    }
})

const mockRegisterDeviceMutation = vi.hoisted(() => vi.fn(async () => ({})))

vi.mock('@perawallet/wallet-core-device', () => ({
    useRegisterDeviceMutation: vi.fn(() => ({
        mutateAsync: mockRegisterDeviceMutation,
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

describe('useCreateAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        kmsMock.getKey.mockReset()
        kmsMock.getKeyOrThrow.mockReset()
        kmsMock.createHDWalletKey.mockReset()
        kmsMock.createAlgo25Key.mockReset()
        kmsMock.getDerivedPublicKey.mockReset()
        kmsMock.createQuantumKey.mockReset()
        kmsMock.removeKeyAndChildren.mockReset()

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
        kmsMock.getDerivedPublicKey.mockResolvedValue(
            new Uint8Array(32).fill(2),
        )
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
    })

    test('does not touch the device API — registration is the single writer', async () => {
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await result.current.saveAccount({
                id: 'ACC1',
                address: 'ADDR1',
                type: 'algo25',
                keyPairId: 'WALLET1-ed25519',
            })
        })

        expect(mockRegisterDeviceMutation).not.toHaveBeenCalled()
    })

    test('creates new HD wallet account when no existing key', async () => {
        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createHdWalletAccount({
                account: 0,
                keyIndex: 0,
            })
        })

        expect(kmsMock.createHDWalletKey).toHaveBeenCalledWith({
            id: 'WALLET1',
        })
        expect(kmsMock.getDerivedPublicKey).toHaveBeenCalledWith(
            'WALLET1',
            0,
            0,
            9,
        )
        expect(created.id).toBe('ACC1')
        expect(created.address).toBeTruthy()
        expect(created.type).toBe('hdWallet')
        // keyPairId is the deterministic derived child id; the seed parent
        // is reachable via metadata.parentKeyId on the child.
        expect(created.keyPairId).toBe('WALLET1-acc0-idx0-dt9')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('creates a sibling HD account on an existing wallet root', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'EXISTING_WALLET',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            metadata: { scheme: SeedScheme.Bip39 },
        })

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createHdWalletAccount({
                walletId: 'EXISTING_WALLET',
                account: 1,
                keyIndex: 0,
            })
        })

        expect(kmsMock.createHDWalletKey).not.toHaveBeenCalled()
        // keyPairId is the deterministic derived child id of the existing
        // seed at (account=1, keyIndex=0, derivationType=9).
        expect(created.keyPairId).toBe('EXISTING_WALLET-acc1-idx0-dt9')
        expect(created.hdWalletDetails.account).toBe(1)
    })

    test('throws error when key derivation fails', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            metadata: { scheme: SeedScheme.Bip39 },
        })
        kmsMock.getDerivedPublicKey.mockRejectedValueOnce(
            new Error('Derivation failed'),
        )

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current.createHdWalletAccount({
                    walletId: 'WALLET1',
                    account: 0,
                    keyIndex: 0,
                }),
            ).rejects.toThrow('Derivation failed')
        })
    })

    test('throws error when createHDWalletKey fails', async () => {
        kmsMock.createHDWalletKey.mockRejectedValueOnce(
            new Error('Failed to generate master key'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current.createHdWalletAccount({
                    account: 0,
                    keyIndex: 0,
                }),
            ).rejects.toThrow('Failed to generate master key')
        })
    })

    test('throws for algo25 when createAlgo25Key fails', async () => {
        kmsMock.createAlgo25Key.mockRejectedValueOnce(
            new Error('Algo25 creation failed'),
        )

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current.createAlgo25WalletAccount({
                    id: 'WALLET1',
                }),
            ).rejects.toThrow('Algo25 creation failed')
        })
    })

    test('creates a new algo25 account', async () => {
        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createAlgo25WalletAccount({})
        })

        expect(created.type).toBe('algo25')
        expect(created.address).toBe('ALGO25_PUBLIC_KEY')
        // keyPairId is the deterministic ed25519 child id committed
        // alongside the seed at `${seedKeyId}-ed25519`.
        expect(created.keyPairId).toBe('WALLET1-ed25519')
    })

    test('creates an algo25 account from an existing root key', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            publicKey: new Uint8Array(),
            metadata: { scheme: SeedScheme.Algo25 },
        })

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createAlgo25WalletAccount({
                id: 'WALLET1',
            })
        })

        expect(kmsMock.createAlgo25Key).not.toHaveBeenCalled()
        expect(created.type).toBe('algo25')
        // The address is encoded from the seed key's persisted publicKey
        // bytes via the wallet-blockchain encodeAlgorandAddress mock; with
        // an empty Uint8Array seed this comes out as ''.
        expect(created.address).toBe('')
        // keyPairId is the deterministic ed25519 child id committed
        // alongside the seed at `${seedKeyId}-ed25519`.
        expect(created.keyPairId).toBe('WALLET1-ed25519')
    })

    test('createHdWalletAccountForSeed derives directly from seedKeyId without consulting getKey or createHDWalletKey (regression: stale useMemo)', async () => {
        // The HD migration imports the seed in the same async tick, so
        // `getKey()` (bound to a stale `useKeystoreKeys` snapshot via
        // useMemo) would miss it and the regular `createHdWalletAccount`
        // path would mint a fresh random seed. The for-seed variant goes
        // straight to `getDerivedPublicKey` which reads the live store.
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createHdWalletAccountForSeed({
                seedKeyId: 'IMPORTED_SEED',
                account: 0,
                keyIndex: 0,
            })
        })

        expect(kmsMock.getKey).not.toHaveBeenCalled()
        expect(kmsMock.createHDWalletKey).not.toHaveBeenCalled()
        expect(kmsMock.getDerivedPublicKey).toHaveBeenCalledWith(
            'IMPORTED_SEED',
            0,
            0,
            9,
        )
        expect(created.type).toBe('hdWallet')
        expect(created.keyPairId).toBe('IMPORTED_SEED-acc0-idx0-dt9')
    })

    test('uses provided seed reference without consulting getKey or createAlgo25Key (regression: stale useMemo)', async () => {
        // getKey is bound to the previous render's keystore snapshot via
        // useMemo, so a key just minted in the same async handler isn't
        // visible. The import flow passes the freshly-minted seed
        // reference directly to bypass that.
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createAlgo25WalletAccount({
                seed: {
                    seedKeyId: 'IMPORTED_KEY',
                    address: 'IMPORTED_ADDRESS',
                },
            })
        })

        expect(kmsMock.getKey).not.toHaveBeenCalled()
        expect(kmsMock.createAlgo25Key).not.toHaveBeenCalled()
        expect(created.type).toBe('algo25')
        expect(created.address).toBe('IMPORTED_ADDRESS')
        // keyPairId is the ed25519 child of the imported seed.
        expect(created.keyPairId).toBe('IMPORTED_KEY-ed25519')
    })

    describe('createQuantumWalletAccount', () => {
        test('creates a quantum account backed by a freshly minted KMS key', async () => {
            uuidSpies.v7.mockImplementation(() => 'ACC1')

            const { result } = renderHook(() => useCreateAccount())

            let account: any
            await act(async () => {
                account = await result.current.createQuantumWalletAccount()
            })

            expect(kmsMock.createQuantumKey).toHaveBeenCalledTimes(1)
            expect(account).toEqual({
                id: 'ACC1',
                address: 'QUANTUM_ADDRESS',
                type: 'quantum',
                keyPairId: 'QSEED1-quantum',
            })
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
            expect(useAccountsStore.getState().accounts[0].address).toBe(
                'QUANTUM_ADDRESS',
            )
        })

        test('uses a provided seed reference without minting a new key', async () => {
            uuidSpies.v7.mockImplementation(() => 'ACC1')

            const { result } = renderHook(() => useCreateAccount())

            let account: any
            await act(async () => {
                account = await result.current.createQuantumWalletAccount({
                    seed: { seedKeyId: 'SEED42', address: 'ADDR42' },
                })
            })

            expect(kmsMock.createQuantumKey).not.toHaveBeenCalled()
            // keyPairId is the scheme-agnostic quantum signing child id.
            expect(account.keyPairId).toBe('SEED42-quantum')
            expect(account.address).toBe('ADDR42')
            expect(account.type).toBe('quantum')
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
        })

        test('propagates createQuantumKey failures and stores nothing', async () => {
            kmsMock.createQuantumKey.mockRejectedValueOnce(
                new Error('keystore unavailable'),
            )

            const { result } = renderHook(() => useCreateAccount())

            await act(async () => {
                await expect(
                    result.current.createQuantumWalletAccount(),
                ).rejects.toThrow('keystore unavailable')
            })
            expect(useAccountsStore.getState().accounts).toHaveLength(0)
        })
    })
})
