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
import { useImportAccount } from '../useImportAccount'
import { useAccountsStore } from '../../store'
import {
    DuplicateAccountError,
    SingleKeyAccountsUnsupportedError,
} from '../../errors'
import type { MintedAccount } from '../../chain-adapter'
import type { WalletAccount } from '../../models'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'

const DUMMY_INDICES = new Uint16Array(25)

const mintedOf = (address: string, seedKeyId = 'SEED1'): MintedAccount => ({
    account: {
        id: `ACC-${address}`,
        address,
        type: 'algo25',
        keyPairId: `${seedKeyId}-ed25519`,
    },
    seedKeyId,
    isNewSeed: true,
})

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
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
    withExportedKey: vi.fn(),
    // Mirrors the deterministic suffixes this file's fixtures use, rather than
    // exercising the real keystore-metadata lookup.
    seedIdOf: vi.fn((keyPairId?: string) => {
        if (!keyPairId) return undefined
        for (const suffix of ['-quantum-pqk1', '-quantum', '-ed25519']) {
            if (keyPairId.endsWith(suffix)) {
                return keyPairId.slice(0, -suffix.length)
            }
        }
        return undefined
    }),
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
    const importOp = () =>
        vi.mocked(fakeAccountsChain().adapter.singleKeyAccounts!.importMnemonic)

    beforeEach(() => {
        registerFakeAccountsChain()
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        kmsMock.removeKeyAndChildren.mockReset()
        kmsMock.withExportedKey.mockReset()
        mockKeyStoreExport.mockReset()

        kmsMock.removeKeyAndChildren.mockResolvedValue(undefined)
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
        })
    })

    test('hd wallet path: prepares import session, does not create an account', async () => {
        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'hdWallet',
            })
        })

        expect(imported.type).toBe('hdWallet')
        expect(imported.walletKeyId).toBe('WALLET1')
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
        expect(kmsMock.createHDWalletKey).not.toHaveBeenCalled()
        expect(importOp()).not.toHaveBeenCalled()
    })

    test('hd wallet path: surfaces prepareHDMasterKey errors', async () => {
        prepareHDMasterKeyMock.mockRejectedValueOnce(
            new Error('Invalid mnemonic'),
        )

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Invalid mnemonic')
        })
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    test('hands the keystore, kind and scope to the adapter and returns what it imports', async () => {
        const account = mintedOf('ADDR1').account
        importOp().mockResolvedValue(account)

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'algo25',
            })
        })

        expect(imported).toBe(account)
        expect(importOp()).toHaveBeenCalledWith(
            kmsMock,
            expect.objectContaining({
                kind: 'algo25',
                mnemonicIndices: DUMMY_INDICES,
            }),
            MAINNET_SCOPE,
            expect.any(Function),
        )
    })

    test('reports an address as held from the live store, not a render snapshot', async () => {
        importOp().mockImplementation(async (_kms, { isHeld }) => {
            useAccountsStore.setState({
                accounts: [mintedOf('HELD').account],
            })
            expect(isHeld('HELD')).toBe(true)
            expect(isHeld('OTHER')).toBe(false)
            return []
        })

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'quantum',
            })
        })

        expect(importOp()).toHaveBeenCalledTimes(1)
    })

    test('persists each account the adapter saves, one at a time', async () => {
        importOp().mockImplementation(async (_kms, _request, _scope, save) => {
            const first = mintedOf('ADDR1')
            const second = mintedOf('ADDR2')
            await save(first)
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
            await save(second)
            return [first.account, second.account]
        })

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'quantum',
            })
        })

        expect(
            useAccountsStore.getState().accounts.map(a => a.address),
        ).toEqual(['ADDR1', 'ADDR2'])
        expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()
    })

    test('rejects a second import of the same address and sweeps the seed it minted', async () => {
        importOp().mockImplementation(async (_kms, _request, _scope, save) => {
            const minted = mintedOf('ADDR1', 'WALLET1')
            await save(minted)
            return minted.account
        })

        const { result } = renderHook(() => useImportAccount())

        // Back to back with no re-render, as the Pera Web / ASB import loop does.
        await act(async () => {
            await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'algo25',
            })
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    type: 'algo25',
                }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('WALLET1')
    })

    test('keeps a seed that a sibling account still depends on when a duplicate is found', async () => {
        const sibling: WalletAccount = {
            id: 'SIBLING',
            address: 'SIBLING_ADDR',
            type: 'quantum',
            keyPairId: 'SEED1-quantum-pqk1',
        }
        useAccountsStore.setState({
            accounts: [sibling, mintedOf('DUP', 'OTHER_SEED').account],
        })
        importOp().mockImplementation(async (_kms, _request, _scope, save) => {
            await save(mintedOf('DUP', 'SEED1'))
            return []
        })

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    type: 'quantum',
                }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()
    })

    test('fails closed on a chain without single-key accounts, minting nothing', async () => {
        registerFakeAccountsChain({ singleKeyAccounts: undefined })

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    type: 'quantum',
                }),
            ).rejects.toBeInstanceOf(SingleKeyAccountsUnsupportedError)
        })
        expect(kmsMock.createQuantumKey).not.toHaveBeenCalled()
    })
})
