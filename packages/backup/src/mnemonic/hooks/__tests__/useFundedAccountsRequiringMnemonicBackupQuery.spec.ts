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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    createFakeKeystore,
    fakeChildKey,
    fakeSeedKey,
} from '../../../__tests__/fakeKeystore'

const keystore = createFakeKeystore()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
        },
        chains: {
            has: () => true,
            get: (chainId: string) => ({
                descriptor: {
                    signing: {
                        standaloneSecret:
                            chainId === 'ethereum' ? 'privateKey' : 'mnemonic',
                    },
                },
            }),
        },
    }),
    getKeystoreStore: () => keystore.store,
}))

const mockFundedAccountIds = vi.fn()
const mockAuthorityAccountIds = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useFundedAccountIdsQuery: (...args: unknown[]) =>
            mockFundedAccountIds(...args),
        useAuthorityAccountIds: (...args: unknown[]) =>
            mockAuthorityAccountIds(...args),
    }
})

const mockCanBackUpMnemonic = vi.fn()
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-chain-shared')
        >()
    return {
        ...original,
        useAnyEnabledChainHasCapability: (...args: unknown[]) =>
            mockCanBackUpMnemonic(...args),
    }
})

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const account = (
    id: string,
    custody: WalletAccount['custody'],
    chains: WalletAccount['chains'],
): WalletAccount => ({ id, custody, chains })

const hd = (id: string, keyPairId: string, keyIndex: number) =>
    account(
        id,
        { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex } },
        { algorand: { address: `ADDR-${id}`, keyPairId } },
    )

describe('useFundedAccountsRequiringMnemonicBackupQuery', () => {
    beforeEach(async () => {
        vi.resetModules()
        keystore.setKeys([
            fakeSeedKey('seed-a'),
            fakeChildKey('a-child-0', 'seed-a'),
            fakeChildKey('a-child-1', 'seed-a'),
            fakeSeedKey('seed-b'),
            fakeChildKey('b-child-0', 'seed-b'),
            fakeChildKey('raw-key'),
        ])
        mockCanBackUpMnemonic.mockReset()
        mockCanBackUpMnemonic.mockReturnValue(true)
        mockFundedAccountIds.mockReset()
        mockFundedAccountIds.mockImplementation(
            (candidates: WalletAccount[]) => ({
                fundedAccountIds: candidates.map(({ id }) => id),
                failedAccountIds: [],
                isPending: false,
            }),
        )
        mockAuthorityAccountIds.mockReset()
        mockAuthorityAccountIds.mockReturnValue([])
        const { registerFakeBackupAdapter } =
            await import('../../../__tests__/fakeBackupAdapter')
        registerFakeBackupAdapter()
    })

    const render = async (accounts: WalletAccount[]) => {
        const { useFundedAccountsRequiringMnemonicBackupQuery } =
            await import('../useFundedAccountsRequiringMnemonicBackupQuery')
        return renderHook(() =>
            useFundedAccountsRequiringMnemonicBackupQuery(accounts, SCOPE),
        )
    }

    const ids = (accounts: WalletAccount[]) => accounts.map(({ id }) => id)

    test('lists the funded accounts whose seed has no manual backup, in input order', async () => {
        const { result } = await render([
            hd('hd-1', 'a-child-1', 1),
            hd('b', 'b-child-0', 0),
        ])

        expect(ids(result.current.accounts)).toEqual(['hd-1', 'b'])
    })

    test('leaves out a marked seed and its HD siblings', async () => {
        const { useMnemonicBackupStore } = await import('../../store')
        act(() => {
            useMnemonicBackupStore.getState().markBackedUp('seed-a')
        })

        const { result } = await render([
            hd('hd-0', 'a-child-0', 0),
            hd('hd-1', 'a-child-1', 1),
            hd('b', 'b-child-0', 0),
        ])

        expect(ids(result.current.accounts)).toEqual(['b'])
    })

    test('never lists hardware, watch, multisig or raw private key accounts', async () => {
        const algorand = { algorand: { address: 'ADDR', keyPairId: 'kp' } }
        const { result } = await render([
            account(
                'ledger',
                { kind: 'hardware' } as unknown as WalletAccount['custody'],
                algorand,
            ),
            account(
                'watch',
                { kind: 'watch' } as unknown as WalletAccount['custody'],
                algorand,
            ),
            account(
                'shared',
                { kind: 'multisig' } as unknown as WalletAccount['custody'],
                algorand,
            ),
            account(
                'evm-key',
                { kind: 'local', seed: null },
                { ethereum: { address: '0xE1', keyPairId: 'raw-key' } },
            ),
        ])

        expect(result.current.accounts).toEqual([])
    })

    test('leaves out accounts that hold nothing', async () => {
        mockFundedAccountIds.mockReturnValue({
            fundedAccountIds: ['b'],
            failedAccountIds: [],
            isPending: false,
        })

        const { result } = await render([
            hd('hd-0', 'a-child-0', 0),
            hd('b', 'b-child-0', 0),
        ])

        expect(ids(result.current.accounts)).toEqual(['b'])
    })

    test('lists an unfunded account that a held account delegates its signing to', async () => {
        mockFundedAccountIds.mockReturnValue({
            fundedAccountIds: [],
            failedAccountIds: [],
            isPending: false,
        })
        mockAuthorityAccountIds.mockReturnValue(['hd-0'])

        const { result } = await render([
            hd('hd-0', 'a-child-0', 0),
            hd('b', 'b-child-0', 0),
        ])

        expect(ids(result.current.accounts)).toEqual(['hd-0'])
        expect(mockAuthorityAccountIds).toHaveBeenCalledWith(
            expect.any(Array),
            SCOPE.chainId,
        )
    })

    test('lists an account whose balance lookup failed', async () => {
        mockFundedAccountIds.mockReturnValue({
            fundedAccountIds: [],
            failedAccountIds: ['b'],
            isPending: false,
        })

        const { result } = await render([
            hd('hd-0', 'a-child-0', 0),
            hd('b', 'b-child-0', 0),
        ])

        expect(ids(result.current.accounts)).toEqual(['b'])
    })

    test('queries only the accounts that lack a manual backup', async () => {
        const { useMnemonicBackupStore } = await import('../../store')
        act(() => {
            useMnemonicBackupStore.getState().markBackedUp('seed-a')
        })

        await render([hd('hd-0', 'a-child-0', 0), hd('b', 'b-child-0', 0)])

        const queried = mockFundedAccountIds.mock.calls.map(([candidates]) =>
            ids(candidates as WalletAccount[]).join(),
        )
        expect(new Set(queried)).toEqual(new Set(['b']))
    })

    test('lists nothing, and queries nothing, when no chain offers mnemonic backup', async () => {
        mockCanBackUpMnemonic.mockReturnValue(false)

        const { result } = await render([hd('hd-0', 'a-child-0', 0)])

        expect(result.current.accounts).toEqual([])
        expect(mockFundedAccountIds).toHaveBeenCalledWith([], SCOPE)
    })

    test('passes the lookup pending state through', async () => {
        mockFundedAccountIds.mockReturnValue({
            fundedAccountIds: [],
            failedAccountIds: [],
            isPending: true,
        })

        const { result } = await render([hd('hd-0', 'a-child-0', 0)])

        expect(result.current.isPending).toBe(true)
    })
})
