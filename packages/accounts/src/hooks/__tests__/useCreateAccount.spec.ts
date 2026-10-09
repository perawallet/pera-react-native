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
import { accountType } from '../../utils'
import { SeedScheme } from '@perawallet/wallet-core-kms'
import { SingleKeyAccountsUnsupportedError } from '../../errors'
import type { MintedAccount } from '../../chain-adapter'
import {
    consumePendingAccountRollback,
    usePendingAccountCreationStore,
} from '../../store/pendingAccountCreation'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'

const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

const deriveAccount = () =>
    vi.mocked(fakeAccountsChain().derivation.deriveAccount)

const MAINNET_ED25519 = { scheme: 'ed25519', networkId: 'mainnet' }

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
        kmsMock.removeKeyAndChildren.mockResolvedValue(undefined)
    })

    test('does not touch the device API — registration is the single writer', async () => {
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await result.current.saveAccount({
                id: 'ACC1',
                address: 'ADDR1',
                custody: { kind: 'local', seed: null },
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
        expect(deriveAccount()).toHaveBeenCalledWith(
            expect.anything(),
            'WALLET1',
            0,
            0,
            MAINNET_ED25519,
        )
        expect(created.id).toBe('ACC1')
        expect(created.address).toBeTruthy()
        expect(accountType(created)).toBe('hdWallet')
        // keyPairId is the deterministic derived child id; the seed parent
        // is reachable via metadata.parentKeyId on the child.
        expect(created.keyPairId).toBe('WALLET1-acc0-idx0-dt9')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    // The discarded mnemonic's passkey main key must go with it — it is a
    // grandchild of this root (via the entropy child), and `removeKeyAndChildren`
    // is the only thing that reaches it.
    test('rolls the whole new wallet root back when building the account fails', async () => {
        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')
        deriveAccount().mockRejectedValueOnce(new Error('derive boom'))

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current.createHdWalletAccount({
                    account: 0,
                    keyIndex: 0,
                }),
            ).rejects.toThrow('derive boom')
        })

        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('WALLET1')
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
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
        // seed at (account=1, keyIndex=0), derived with the chain's Peikert type.
        expect(created.keyPairId).toBe('EXISTING_WALLET-acc1-idx0-dt9')
        expect(created.hdWalletDetails.account).toBe(1)
        expect(created.custody).toEqual({
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 0 },
        })
        expect(created.chains).toEqual({
            algorand: {
                address: created.address,
                keyPairId: 'EXISTING_WALLET-acc1-idx0-dt9',
            },
        })
    })

    test('throws error when key derivation fails', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            metadata: { scheme: SeedScheme.Bip39 },
        })
        deriveAccount().mockRejectedValueOnce(new Error('Derivation failed'))

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

    test('createHdWalletAccountForSeed derives directly from seedKeyId without consulting getKey or createHDWalletKey (regression: stale useMemo)', async () => {
        // The HD migration imports the seed in the same async tick, so
        // `getKey()` (bound to a stale `useKeystoreKeys` snapshot via
        // useMemo) would miss it and the regular `createHdWalletAccount`
        // path would mint a fresh random seed. The for-seed variant goes
        // straight to the chain's key derivation, which reads the live store.
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
        expect(deriveAccount()).toHaveBeenCalledWith(
            expect.anything(),
            'IMPORTED_SEED',
            0,
            0,
            MAINNET_ED25519,
        )
        expect(accountType(created)).toBe('hdWallet')
        expect(created.keyPairId).toBe('IMPORTED_SEED-acc0-idx0-dt9')
    })

    describe('single-key accounts', () => {
        const mintedAccount = (isNewSeed: boolean): MintedAccount => ({
            account: {
                id: 'ACC1',
                address: 'ADDR1',
                custody: { kind: 'local', seed: null },
                keyPairId: 'SEED1-ed25519',
            },
            seedKeyId: 'SEED1',
            isNewSeed,
        })
        const createOp = () =>
            vi.mocked(fakeAccountsChain().adapter.singleKeyAccounts!.create)

        test('returns the adapter account, passing the keystore, kind, id and scope', async () => {
            createOp().mockResolvedValue(mintedAccount(false))

            const { result } = renderHook(() => useCreateAccount())

            let account: any
            await act(async () => {
                account = await result.current.buildStandaloneAccount({
                    id: 'SEED1',
                })
            })

            expect(account).toEqual(mintedAccount(false).account)
            expect(createOp()).toHaveBeenCalledWith(
                kmsMock,
                { kind: 'standalone', id: 'SEED1' },
                MAINNET_SCOPE,
            )
            expect(useAccountsStore.getState().accounts).toHaveLength(0)
        })

        test('registers a rollback for a newly created seed only', async () => {
            createOp()
                .mockResolvedValueOnce(mintedAccount(true))
                .mockResolvedValueOnce(mintedAccount(false))

            const { result } = renderHook(() => useCreateAccount())

            await act(async () => {
                await result.current.buildQuantumWalletAccount()
            })
            expect(
                usePendingAccountCreationStore.getState().pendingRollback,
            ).not.toBeNull()
            await consumePendingAccountRollback()
            expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('SEED1')

            await act(async () => {
                await result.current.buildQuantumWalletAccount()
            })
            expect(
                usePendingAccountCreationStore.getState().pendingRollback,
            ).toBeNull()
        })

        test('create variants persist the account and clear the pending rollback', async () => {
            createOp().mockResolvedValue(mintedAccount(true))

            const { result } = renderHook(() => useCreateAccount())

            await act(async () => {
                await result.current.createStandaloneAccount({})
            })

            expect(useAccountsStore.getState().accounts).toEqual([
                mintedAccount(true).account,
            ])
            expect(
                usePendingAccountCreationStore.getState().pendingRollback,
            ).toBeNull()
        })

        test('propagates adapter failures and stores nothing', async () => {
            createOp().mockRejectedValue(new Error('keystore unavailable'))

            const { result } = renderHook(() => useCreateAccount())

            await act(async () => {
                await expect(
                    result.current.createQuantumWalletAccount(),
                ).rejects.toThrow('keystore unavailable')
            })
            expect(useAccountsStore.getState().accounts).toHaveLength(0)
        })

        test('fails closed on a chain without single-key accounts', async () => {
            registerFakeAccountsChain({ singleKeyAccounts: undefined })

            const { result } = renderHook(() => useCreateAccount())

            await act(async () => {
                await expect(
                    result.current.createQuantumWalletAccount(),
                ).rejects.toBeInstanceOf(SingleKeyAccountsUnsupportedError)
            })
            expect(useAccountsStore.getState().accounts).toHaveLength(0)
        })
    })
})
