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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { fetchAndPersistAccount, ensureAccountFetched } from '../account-syncer'
import type { AccountStateSnapshot } from '../../chain-adapter'
import { getAccountChainState } from '../../store'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: vi.fn().mockResolvedValue(undefined),
    fetchAndPersistPrices: vi.fn().mockResolvedValue(undefined),
}))

const mockUpsertAccountBalance = vi.fn()
const mockUpsertAccountChainState = vi.fn()
const mockRefreshAccountHoldings = vi.fn()
const mockGetAccountBalance = vi.fn()

vi.mock('../../db', () => ({
    upsertAccountBalance: (...args: unknown[]) =>
        mockUpsertAccountBalance(...args),
    upsertAccountChainState: (...args: unknown[]) =>
        mockUpsertAccountChainState(...args),
    refreshAccountHoldings: (...args: unknown[]) =>
        mockRefreshAccountHoldings(...args),
    getAccountBalance: (...args: unknown[]) => mockGetAccountBalance(...args),
    getAccountHoldings: vi.fn().mockResolvedValue([]),
}))

const snapshot = (
    overrides: Partial<AccountStateSnapshot> = {},
): AccountStateSnapshot => ({
    nativeBalance: new Decimal('1.5'),
    nativeBalanceBaseUnits: new Decimal(1_500_000),
    minBalance: new Decimal('0.1'),
    totalAssetsOptedIn: 2,
    totalCreatedAssets: 1,
    totalAppsOptedIn: 0,
    status: 'Online',
    authorityAddress: 'REKEY_ADDR',
    chainState: {
        family: 'algorand',
        authAddress: 'REKEY_ADDR',
        minBalance: new Decimal(100_000),
        status: 'Online',
        totalAssetsOptedIn: 2,
        totalCreatedAssets: 1,
        totalAppsOptedIn: 0,
    },
    holdings: [
        { assetId: '0', amount: new Decimal(1_500_000), isFrozen: false },
        { assetId: '10', amount: new Decimal(500), isFrozen: true },
    ],
    observedRound: 1234,
    ...overrides,
})

const fetchAccountState = () =>
    vi.mocked(fakeAccountsChain().adapter.fetchAccountState)

describe('fetchAndPersistAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpsertAccountBalance.mockResolvedValue(undefined)
        mockUpsertAccountChainState.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        mockGetAccountBalance.mockResolvedValue(undefined)
        fetchAccountState().mockResolvedValue(snapshot())
    })

    it("persists the chain's account state as the balance row and holdings", async () => {
        const result = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(fetchAccountState()).toHaveBeenCalledWith(
            'ADDR1',
            MAINNET_SCOPE,
            {
                priorResourceCount: 0,
            },
        )
        expect(mockUpsertAccountBalance).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            algoBalance: new Decimal('1.5'),
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 1,
            totalAppsOptedIn: 0,
            minBalance: new Decimal('0.1'),
            status: 'Online',
            authorityAddress: 'REKEY_ADDR',
        })
        expect(mockUpsertAccountChainState).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            nativeBalance: new Decimal(1_500_000),
            chainData: snapshot().chainState,
        })
        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            holdings: snapshot().holdings,
        })
        expect(getAccountChainState(MAINNET_SCOPE, 'ADDR1')).toEqual(
            snapshot().chainState,
        )
        // First sync of an account with no prior row → changed.
        expect(result).toEqual({
            changed: true,
            holdingsChanged: true,
            observedRound: 1234,
        })
    })

    it("hands the chain the prior row's resource count", async () => {
        mockGetAccountBalance.mockResolvedValue({
            algoBalance: new Decimal(0),
            totalAssetsOptedIn: 1500,
            totalCreatedAssets: 3,
            totalAppsOptedIn: 2,
            minBalance: new Decimal(0),
            status: 'Offline',
            authorityAddress: null,
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(fetchAccountState()).toHaveBeenCalledWith(
            'ADDR1',
            MAINNET_SCOPE,
            {
                priorResourceCount: 1505,
            },
        )
    })

    it('propagates a failed chain read without persisting anything', async () => {
        fetchAccountState().mockRejectedValue(new Error('429'))

        await expect(
            fetchAndPersistAccount('ADDR1', 'mainnet'),
        ).rejects.toThrow('429')

        expect(mockUpsertAccountBalance).not.toHaveBeenCalled()
        expect(mockUpsertAccountChainState).not.toHaveBeenCalled()
        expect(mockRefreshAccountHoldings).not.toHaveBeenCalled()
    })

    it('still refreshes holdings when the chain-state write fails', async () => {
        mockUpsertAccountChainState.mockRejectedValue(new Error('db locked'))

        const result = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockRefreshAccountHoldings).toHaveBeenCalled()
        expect(result.changed).toBe(true)
    })

    it('reports no change when balance and holdings are unchanged', async () => {
        fetchAccountState().mockResolvedValue(
            snapshot({
                nativeBalance: new Decimal('1'),
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                status: 'Offline',
                authorityAddress: null,
                observedRound: null,
            }),
        )
        mockGetAccountBalance.mockResolvedValue({
            algoBalance: new Decimal('1'),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal('0.1'),
            status: 'Offline',
            authorityAddress: null,
        })
        mockRefreshAccountHoldings.mockResolvedValue(false)

        const result = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(result).toEqual({
            changed: false,
            holdingsChanged: false,
            observedRound: null,
        })
    })

    it('coalesces concurrent fetches for the same account', async () => {
        const [a, b] = await Promise.all([
            fetchAndPersistAccount('ADDR1', 'mainnet'),
            fetchAndPersistAccount('ADDR1', 'mainnet'),
        ])

        expect(a).toEqual(b)
        expect(fetchAccountState()).toHaveBeenCalledTimes(1)
    })
})

describe('ensureAccountFetched', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpsertAccountBalance.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        fetchAccountState().mockResolvedValue(snapshot())
    })

    it('skips the fetch when a balance row already exists', async () => {
        mockGetAccountBalance.mockResolvedValue({ algoBalance: new Decimal(1) })

        await ensureAccountFetched('ADDR1', 'mainnet')

        expect(fetchAccountState()).not.toHaveBeenCalled()
    })

    it('fetches when there is no balance row yet', async () => {
        mockGetAccountBalance.mockResolvedValue(undefined)

        await ensureAccountFetched('ADDR1', 'mainnet')

        expect(fetchAccountState()).toHaveBeenCalledWith(
            'ADDR1',
            MAINNET_SCOPE,
            {
                priorResourceCount: 0,
            },
        )
    })

    it('swallows fetch errors (never throws to the caller)', async () => {
        mockGetAccountBalance.mockResolvedValue(undefined)
        fetchAccountState().mockRejectedValue(new Error('algod down'))

        await expect(
            ensureAccountFetched('ADDR1', 'mainnet'),
        ).resolves.toBeUndefined()
    })
})
