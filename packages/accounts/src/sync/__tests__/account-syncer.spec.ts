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
import type { Network } from '@perawallet/wallet-core-shared'

// algosdk v9 builders: `accountInformation(addr).do()` and
// `lookupAccountAssets(addr).limit(n).do()`.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    getAlgorandClient: vi.fn(() => ({
        client: {
            algod: {
                accountInformation: vi.fn(() => ({
                    exclude: vi.fn().mockReturnThis(),
                    do: vi.fn().mockResolvedValue({
                        amount: 0n,
                        minBalance: 0n,
                        totalAssetsOptedIn: 0,
                        totalCreatedAssets: 0,
                        totalAppsOptedIn: 0,
                        status: 'Offline',
                        authAddr: { toString: () => 'S' },
                    }),
                })),
            },
            indexer: {
                lookupAccountAssets: vi.fn(() => ({
                    limit: vi.fn().mockReturnThis(),
                    nextToken: vi.fn().mockReturnThis(),
                    do: vi.fn().mockResolvedValue({ assets: [] }),
                })),
            },
        },
    })),
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
    refreshAccountHoldings: vi.fn().mockResolvedValue(true),
    getAccountBalance: vi.fn().mockResolvedValue(undefined),
    getAccountHoldings: vi.fn().mockResolvedValue([]),
}))

describe('fetchAndPersistAccount', () => {
    let fetchAndPersistAccount: typeof import('../account-syncer').fetchAndPersistAccount
    let useAccountsStore: typeof import('../../store').useAccountsStore

    beforeEach(async () => {
        vi.resetModules()
        fetchAndPersistAccount = (await import('../account-syncer'))
            .fetchAndPersistAccount
        useAccountsStore = (await import('../../store')).useAccountsStore
        useAccountsStore.getState().resetState()
        useAccountsStore.getState().setAccounts([
            {
                type: 'watch',
                address: 'A',
            } as unknown as import('../../models').WalletAccount,
        ])
    })

    it('mirrors the chain authAddr into the Zustand account', async () => {
        await fetchAndPersistAccount('A', 'mainnet' as Network)

        const account = useAccountsStore
            .getState()
            .accounts.find(a => a.address === 'A')
        expect(account?.rekeyAddress).toBe('S')
        // The sync's network is threaded into the per-network state, not
        // just the active-network mirror.
        expect(account?.rekeyAddressByNetwork).toEqual({ mainnet: 'S' })
    })
})
