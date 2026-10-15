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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
    HdIndex,
    HdSeedGroup,
    LocalAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useDeriveChainAccount } from '../useDeriveChainAccount'

const CHAIN_ID = 'ethereum' as ChainId

const mocks = vi.hoisted(() => ({
    accounts: [] as WalletAccount[],
    storeAccounts: [] as WalletAccount[],
    groups: [] as HdSeedGroup[],
    canDerive: vi.fn<(accounts: unknown, walletId: string) => boolean>(),
    nextChainPosition: vi.fn<(accounts: WalletAccount[]) => HdIndex>(),
    addChainAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => mocks.accounts,
    useHdSeedGroups: () => ({
        hdSeedGroups: mocks.groups,
        hasMultipleHdSeeds: mocks.groups.length > 1,
    }),
    canDerive: mocks.canDerive,
    nextChainPosition: mocks.nextChainPosition,
    useAccountsStore: {
        getState: () => ({
            accounts: mocks.storeAccounts,
            addChainAccount: mocks.addChainAccount,
        }),
    },
}))

const account = (id: string): LocalAccount => ({
    id,
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { algorand: { address: id, keyPairId: `${id}-key` } },
})

const group = (seedKeyId: string): HdSeedGroup => {
    const first = account(`${seedKeyId}-account`)
    return {
        seedKeyId,
        accounts: [first],
        firstAccount: first,
        accountCount: 1,
    }
}

describe('useDeriveChainAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accounts = []
        mocks.storeAccounts = []
        mocks.groups = []
    })

    it('offers only the wallets that can derive on the chain', () => {
        mocks.groups = [group('seed-a'), group('seed-b')]
        mocks.canDerive.mockImplementation(
            (_accounts, walletId) => walletId === 'seed-b',
        )

        const { result } = renderHook(() => useDeriveChainAccount(CHAIN_ID))

        expect(result.current.derivableWallets.map(g => g.seedKeyId)).toEqual([
            'seed-b',
        ])
        expect(mocks.canDerive).toHaveBeenCalledWith(
            mocks.accounts,
            'seed-a',
            CHAIN_ID,
        )
    })

    it('adds the chain entry at the next free position, read from the store at call time', async () => {
        const derived = account('derived')
        const index = { account: 0, keyIndex: 1 }
        mocks.nextChainPosition.mockReturnValue(index)
        mocks.addChainAccount.mockResolvedValue(derived)
        const { result } = renderHook(() => useDeriveChainAccount(CHAIN_ID))
        mocks.storeAccounts = [account('added-after-render')]

        const created = await result.current.deriveChainAccount('seed-a')

        expect(created).toBe(derived)
        expect(mocks.nextChainPosition).toHaveBeenCalledWith(
            mocks.storeAccounts,
            'seed-a',
            CHAIN_ID,
        )
        expect(mocks.addChainAccount).toHaveBeenCalledWith(
            'seed-a',
            CHAIN_ID,
            index,
        )
    })
})
