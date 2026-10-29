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
import { findNativeAsset } from '@perawallet/wallet-core-assets'
import { fetchAndPersistAccount, ensureAccountFetched } from '../account-syncer'
import type { AccountStateSnapshot } from '../../chain-adapter'
import { getAccountChainState, useHoldingsRefreshStore } from '../../store'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

vi.mock('@perawallet/wallet-core-assets', () => ({
    findNativeAsset: vi.fn(() => ({ assetId: '0' })),
    fetchAndPersistAssets: vi.fn().mockResolvedValue(undefined),
    fetchAndPersistPrices: vi.fn().mockResolvedValue(undefined),
}))

const mockUpsertAccountChainState = vi.fn()
const mockRefreshAccountHoldings = vi.fn()
const mockGetAccountChainStateRow = vi.fn()
const mockInsertAssetHolding = vi.fn()

const { mockGetAddedTokenIdsByAccount } = vi.hoisted(() => ({
    mockGetAddedTokenIdsByAccount: vi.fn(
        async ({ accountAddresses }: { accountAddresses: string[] }) =>
            new Map(accountAddresses.map(address => [address, [] as string[]])),
    ),
}))

vi.mock('../../db', () => ({
    getAddedTokenIdsByAccount: (...args: unknown[]) =>
        mockGetAddedTokenIdsByAccount(...args),
    insertAssetHolding: (...args: unknown[]) => mockInsertAssetHolding(...args),
    upsertAccountChainState: (...args: unknown[]) =>
        mockUpsertAccountChainState(...args),
    refreshAccountHoldings: (...args: unknown[]) =>
        mockRefreshAccountHoldings(...args),
    getAccountChainStateRow: (...args: unknown[]) =>
        mockGetAccountChainStateRow(...args),
    getAccountHoldings: vi.fn().mockResolvedValue([]),
}))

const snapshot = (
    overrides: Partial<AccountStateSnapshot> = {},
): AccountStateSnapshot => ({
    nativeBalanceBaseUnits: new Decimal(1_500_000),
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
        { assetId: '0', amount: new Decimal(1_500_000) },
        {
            assetId: '10',
            amount: new Decimal(500),
            native: { family: 'algorand', isFrozen: true },
        },
    ],
    observedRound: 1234,
    ...overrides,
})

const fetchAccountState = () =>
    vi.mocked(fakeAccountsChain().adapter.fetchAccountState)

describe('fetchAndPersistAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpsertAccountChainState.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        mockGetAccountChainStateRow.mockResolvedValue(undefined)
        mockInsertAssetHolding.mockResolvedValue(undefined)
        useHoldingsRefreshStore.getState().resetState()
        fetchAccountState().mockResolvedValue(snapshot())
    })

    it('seeds nothing when the first read succeeds, so a funded account never flashes zero', async () => {
        await fetchAndPersistAccount('ADDR1', MAINNET_SCOPE)

        expect(mockInsertAssetHolding).not.toHaveBeenCalled()
    })

    it("seeds the scope's native holding at zero and flags the read when the first read fails", async () => {
        fetchAccountState().mockRejectedValue(new Error('429'))

        await expect(
            fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
        ).rejects.toThrow('429')

        expect(mockInsertAssetHolding).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            assetId: '0',
            scope: MAINNET_SCOPE,
        })
        expect(
            useHoldingsRefreshStore.getState().failed['algorand/mainnet']
                ?.ADDR1,
        ).toBe(true)
    })

    it('still rejects with the read error when the seed itself fails', async () => {
        fetchAccountState().mockRejectedValue(new Error('429'))
        mockInsertAssetHolding.mockRejectedValue(new Error('db locked'))

        await expect(
            fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
        ).rejects.toThrow('429')
    })

    it('seeds nothing for a chain without an assets adapter', async () => {
        vi.mocked(findNativeAsset).mockReturnValueOnce(undefined)
        fetchAccountState().mockRejectedValue(new Error('429'))

        await expect(
            fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
        ).rejects.toThrow('429')

        expect(mockInsertAssetHolding).not.toHaveBeenCalled()
    })

    it("persists the chain's account state as the chain-state row and holdings", async () => {
        const result = await fetchAndPersistAccount('ADDR1', MAINNET_SCOPE)

        expect(fetchAccountState()).toHaveBeenCalledWith(
            'ADDR1',
            MAINNET_SCOPE,
            { priorChainState: undefined },
        )
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

    it('writes a token added during the read at zero, from the list read after it', async () => {
        const order: string[] = []
        fetchAccountState().mockImplementation(async () => {
            order.push('read')
            return snapshot()
        })
        mockGetAddedTokenIdsByAccount.mockImplementationOnce(async () => {
            order.push('added')
            return new Map([['ADDR1', ['10', '77']]])
        })

        await fetchAndPersistAccount('ADDR1', MAINNET_SCOPE)

        expect(order).toEqual(['read', 'added'])
        const { holdings } = mockRefreshAccountHoldings.mock.lastCall![0] as {
            holdings: { assetId: string; amount: Decimal }[]
        }
        expect(holdings.map(h => [h.assetId, h.amount.toFixed()])).toEqual([
            ['0', '1500000'],
            ['10', '500'],
            ['77', '0'],
        ])
    })

    it("hands the chain the prior row's chain state", async () => {
        const priorChainState = {
            family: 'algorand' as const,
            minBalance: new Decimal(0),
            status: 'Offline' as const,
            totalAssetsOptedIn: 1500,
            totalCreatedAssets: 3,
            totalAppsOptedIn: 2,
        }
        mockGetAccountChainStateRow.mockResolvedValue({
            accountAddress: 'ADDR1',
            nativeBalance: new Decimal(0),
            chainData: priorChainState,
        })

        await fetchAndPersistAccount('ADDR1', MAINNET_SCOPE)

        expect(fetchAccountState()).toHaveBeenCalledWith(
            'ADDR1',
            MAINNET_SCOPE,
            { priorChainState },
        )
    })

    it('propagates a failed chain read without persisting anything', async () => {
        fetchAccountState().mockRejectedValue(new Error('429'))

        await expect(
            fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
        ).rejects.toThrow('429')

        expect(mockUpsertAccountChainState).not.toHaveBeenCalled()
        expect(mockRefreshAccountHoldings).not.toHaveBeenCalled()
    })

    it('rejects when the chain-state write fails and refreshes no holdings', async () => {
        mockUpsertAccountChainState.mockRejectedValue(new Error('db locked'))

        await expect(
            fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
        ).rejects.toThrow('db locked')

        expect(mockRefreshAccountHoldings).not.toHaveBeenCalled()
    })

    describe('with a prior row', () => {
        const priorRow = (
            overrides: Partial<{
                nativeBalance: Decimal
                chainData: AccountStateSnapshot['chainState']
            }> = {},
        ) => ({
            accountAddress: 'ADDR1',
            nativeBalance: snapshot().nativeBalanceBaseUnits,
            chainData: snapshot().chainState,
            ...overrides,
        })

        it('seeds nothing when a read fails, since the stored rows still stand', async () => {
            mockGetAccountChainStateRow.mockResolvedValue(priorRow())
            fetchAccountState().mockRejectedValue(new Error('429'))

            await expect(
                fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
            ).rejects.toThrow('429')

            expect(mockInsertAssetHolding).not.toHaveBeenCalled()
        })

        it('reports no change when state and holdings are unchanged', async () => {
            mockGetAccountChainStateRow.mockResolvedValue(priorRow())
            mockRefreshAccountHoldings.mockResolvedValue(false)

            const result = await fetchAndPersistAccount('ADDR1', MAINNET_SCOPE)

            expect(result).toEqual({
                changed: false,
                holdingsChanged: false,
                observedRound: 1234,
            })
        })

        it('reports a change when only the authority was removed', async () => {
            mockGetAccountChainStateRow.mockResolvedValue(priorRow())
            mockRefreshAccountHoldings.mockResolvedValue(false)
            fetchAccountState().mockResolvedValue(
                snapshot({
                    chainState: {
                        family: 'algorand',
                        minBalance: new Decimal(100_000),
                        status: 'Online',
                        totalAssetsOptedIn: 2,
                        totalCreatedAssets: 1,
                        totalAppsOptedIn: 0,
                    },
                }),
            )

            const result = await fetchAndPersistAccount('ADDR1', MAINNET_SCOPE)

            expect(result.changed).toBe(true)
            expect(result.holdingsChanged).toBe(false)
        })

        it('reports a change when only the native balance moved', async () => {
            mockGetAccountChainStateRow.mockResolvedValue(
                priorRow({ nativeBalance: new Decimal(1_499_000) }),
            )
            mockRefreshAccountHoldings.mockResolvedValue(false)

            const result = await fetchAndPersistAccount('ADDR1', MAINNET_SCOPE)

            expect(result.changed).toBe(true)
        })
    })

    it('coalesces concurrent fetches for the same account', async () => {
        const [a, b] = await Promise.all([
            fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
            fetchAndPersistAccount('ADDR1', MAINNET_SCOPE),
        ])

        expect(a).toEqual(b)
        expect(fetchAccountState()).toHaveBeenCalledTimes(1)
    })
})

describe('ensureAccountFetched', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockInsertAssetHolding.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        fetchAccountState().mockResolvedValue(snapshot())
    })

    it('skips the fetch when a chain-state row already exists', async () => {
        mockGetAccountChainStateRow.mockResolvedValue({
            accountAddress: 'ADDR1',
            nativeBalance: new Decimal(1),
            chainData: snapshot().chainState,
        })

        await ensureAccountFetched('ADDR1', MAINNET_SCOPE)

        expect(fetchAccountState()).not.toHaveBeenCalled()
    })

    it('fetches when there is no chain-state row yet', async () => {
        mockGetAccountChainStateRow.mockResolvedValue(undefined)

        await ensureAccountFetched('ADDR1', MAINNET_SCOPE)

        expect(fetchAccountState()).toHaveBeenCalledWith(
            'ADDR1',
            MAINNET_SCOPE,
            { priorChainState: undefined },
        )
    })

    it('swallows fetch errors (never throws to the caller)', async () => {
        mockGetAccountChainStateRow.mockResolvedValue(undefined)
        fetchAccountState().mockRejectedValue(new Error('algod down'))

        await expect(
            ensureAccountFetched('ADDR1', MAINNET_SCOPE),
        ).resolves.toBeUndefined()
    })
})
