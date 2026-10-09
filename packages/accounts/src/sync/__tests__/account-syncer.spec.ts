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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { authorityOf } from '../../credentials/accessors'

const MAINNET_SCOPE = scopeForLegacyNetwork('mainnet')

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
}))

// Mocked so the resetModules loop below doesn't re-evaluate the real assets
// package graph on every test — under full-suite parallel load that import
// alone can blow the test timeout.
vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: vi.fn().mockResolvedValue(undefined),
    fetchAndPersistPrices: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db', () => ({
    upsertAccountBalance: vi.fn(),
    upsertAccountChainState: vi.fn(),
    refreshAccountHoldings: vi.fn().mockResolvedValue(true),
    getAccountBalance: vi.fn().mockResolvedValue(undefined),
    getAccountHoldings: vi.fn().mockResolvedValue([]),
}))

describe('fetchAndPersistAccount', () => {
    let fetchAndPersistAccount: typeof import('../account-syncer').fetchAndPersistAccount
    let useAccountsStore: typeof import('../../store').useAccountsStore
    let useAccountChainStateStore: typeof import('../../store/accountChainState').useAccountChainStateStore

    beforeEach(async () => {
        vi.resetModules()
        // resetModules drops the registries too, so the fresh graph needs its
        // own fake chain.
        const { Decimal } = await import('decimal.js')
        ;(
            await import('../../__tests__/fakeAccountsChain')
        ).registerFakeAccountsChain({
            fetchAccountState: async () => ({
                nativeBalance: new Decimal(0),
                nativeBalanceBaseUnits: new Decimal(0),
                minBalance: new Decimal(0),
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                status: 'Offline',
                authAddress: 'S',
                chainState: {
                    family: 'algorand',
                    authAddress: 'S',
                    minBalance: new Decimal(0),
                    status: 'Offline',
                    totalAssetsOptedIn: 0,
                    totalCreatedAssets: 0,
                    totalAppsOptedIn: 0,
                },
                holdings: [],
                observedRound: null,
            }),
        })
        fetchAndPersistAccount = (await import('../account-syncer'))
            .fetchAndPersistAccount
        useAccountsStore = (await import('../../store')).useAccountsStore
        useAccountChainStateStore = (
            await import('../../store/accountChainState')
        ).useAccountChainStateStore
        useAccountsStore.getState().resetState()
        useAccountsStore.getState().setAccounts([
            {
                id: 'A',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'A' } },
            },
        ])
    })

    it('mirrors the chain authAddr into the Zustand account', async () => {
        await fetchAndPersistAccount('A', MAINNET_SCOPE)

        const account = useAccountsStore
            .getState()
            .accounts.find(a => a.id === 'A')
        expect(authorityOf(account!, MAINNET_SCOPE)).toBe('S')
        expect(account?.rekeyAddress).toBe('S')
        // The sync's network is threaded into the per-network state, not
        // just the active-network mirror.
        expect(account?.rekeyAddressByNetwork).toEqual({ mainnet: 'S' })
    })

    it('writes the chain-state slice and keeps its reference on an unchanged sync', async () => {
        const mainnetKey = 'algorand/mainnet' as never
        await fetchAndPersistAccount('A', MAINNET_SCOPE)
        const first = useAccountChainStateStore.getState().states[mainnetKey]?.A

        await fetchAndPersistAccount('A', MAINNET_SCOPE)
        const second =
            useAccountChainStateStore.getState().states[mainnetKey]?.A

        expect(first).toMatchObject({ authAddress: 'S' })
        expect(second).toBe(first)
    })
})
