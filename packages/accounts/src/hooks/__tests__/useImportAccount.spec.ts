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
    FAKE_EXPLICIT_SEED,
    FAKE_HD_SEED,
    FAKE_SINGLE_SEED,
    fakeAccountsChain,
    MAINNET_SCOPE,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import { addressOn } from '../../credentials'

const DUMMY_INDICES = new Uint16Array(25)

const mintedOf = (address: string, seedKeyId = 'SEED1'): MintedAccount => ({
    account: buildTestAccount(
        TEST_CUSTODY.local,
        { algorand: { address, keyPairId: `${seedKeyId}-sign` } },
        { id: `ACC-${address}` },
    ),
    seedKeyId,
    isNewSeed: true,
})

// A signing key is `<seed>-sign`, so `seedOf` reads the seed off its id.
vi.mock('../../credentials', async importOriginal => {
    const actual = await importOriginal<typeof import('../../credentials')>()
    return {
        ...actual,
        seedOf: (account: WalletAccount) =>
            actual.signingKeyOn(account, 'algorand')?.replace(/-sign$/, ''),
    }
})

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

const kmsMock = vi.hoisted(() => ({
    removeKeyAndChildren: vi.fn(),
    persistHDMasterKey: vi.fn(),
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
        kmsMock.removeKeyAndChildren.mockResolvedValue(undefined)
        prepareHDMasterKeyMock.mockReset()
        prepareHDMasterKeyMock.mockResolvedValue({
            keyId: 'WALLET1',
            rootKey: new Uint8Array(96).fill(1),
            entropy: new Uint8Array(32).fill(2),
        })
    })

    test('hd wallet path: prepares import session, does not create an account', async () => {
        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        let imported: unknown
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: DUMMY_INDICES,
                seed: FAKE_HD_SEED,
            })
        })

        expect(imported).toEqual({ kind: 'hd', walletKeyId: 'WALLET1' })
        expect(prepareHDMasterKeyMock).toHaveBeenCalledWith({
            mnemonicIndices: DUMMY_INDICES,
        })
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
        expect(importOp()).not.toHaveBeenCalled()
    })

    test('hd wallet path: surfaces prepareHDMasterKey errors', async () => {
        prepareHDMasterKeyMock.mockRejectedValueOnce(
            new Error('Invalid mnemonic'),
        )

        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    seed: FAKE_HD_SEED,
                }),
            ).rejects.toThrow('Invalid mnemonic')
        })
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    test('hands the kind and scope to the adapter and returns what it imports', async () => {
        const account = mintedOf('ADDR1').account
        importOp().mockResolvedValue(account)

        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        let imported: unknown
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: DUMMY_INDICES,
                seed: FAKE_SINGLE_SEED,
            })
        })

        expect(imported).toBe(account)
        expect(importOp()).toHaveBeenCalledWith(
            expect.objectContaining({
                seed: FAKE_SINGLE_SEED,
                mnemonicIndices: DUMMY_INDICES,
            }),
            MAINNET_SCOPE,
            expect.any(Function),
        )
    })

    test('reports an address as held from the live store, not a render snapshot', async () => {
        importOp().mockImplementation(async ({ isHeld }) => {
            useAccountsStore.setState({
                accounts: [mintedOf('HELD').account],
            })
            expect(isHeld('HELD')).toBe(true)
            expect(isHeld('OTHER')).toBe(false)
            return []
        })

        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        await act(async () => {
            await result.current({
                mnemonicIndices: DUMMY_INDICES,
                seed: FAKE_EXPLICIT_SEED,
            })
        })

        expect(importOp()).toHaveBeenCalledTimes(1)
    })

    test('persists each account the adapter saves, one at a time', async () => {
        importOp().mockImplementation(async (_request, _scope, save) => {
            const first = mintedOf('ADDR1')
            const second = mintedOf('ADDR2')
            await save(first)
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
            await save(second)
            return [first.account, second.account]
        })

        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        await act(async () => {
            await result.current({
                mnemonicIndices: DUMMY_INDICES,
                seed: FAKE_EXPLICIT_SEED,
            })
        })

        expect(
            useAccountsStore
                .getState()
                .accounts.map(a => addressOn(a, MAINNET_SCOPE)),
        ).toEqual(['ADDR1', 'ADDR2'])
        expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()
    })

    test('rejects a second import of the same address and sweeps the seed it minted', async () => {
        importOp().mockImplementation(async (_request, _scope, save) => {
            const minted = mintedOf('ADDR1', 'WALLET1')
            await save(minted)
            return minted.account
        })

        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        // Back to back with no re-render, as the Pera Web / ASB import loop does.
        await act(async () => {
            await result.current({
                mnemonicIndices: DUMMY_INDICES,
                seed: FAKE_SINGLE_SEED,
            })
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    seed: FAKE_SINGLE_SEED,
                }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('WALLET1')
    })

    test('keeps a seed that a sibling account still depends on when a duplicate is found', async () => {
        const sibling: WalletAccount = buildTestAccount(
            TEST_CUSTODY.explicit,
            { algorand: { address: 'SIBLING_ADDR', keyPairId: 'SEED1-sign' } },
            { id: 'SIBLING' },
        )
        useAccountsStore.setState({
            accounts: [sibling, mintedOf('DUP', 'OTHER_SEED').account],
        })
        importOp().mockImplementation(async (_request, _scope, save) => {
            await save(mintedOf('DUP', 'SEED1'))
            return []
        })

        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    seed: FAKE_EXPLICIT_SEED,
                }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()
    })

    test('fails closed on a chain without single-key accounts, minting nothing', async () => {
        registerFakeAccountsChain({ singleKeyAccounts: undefined })

        const { result } = renderHook(() => useImportAccount(MAINNET_SCOPE))

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    seed: FAKE_EXPLICIT_SEED,
                }),
            ).rejects.toBeInstanceOf(SingleKeyAccountsUnsupportedError)
        })
        expect(useAccountsStore.getState().accounts).toEqual([])
    })
})
