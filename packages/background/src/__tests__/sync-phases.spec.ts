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
import type { AccountSyncResult } from '@perawallet/wallet-core-accounts'
import {
    resolveCheckpointRound,
    syncAccountsPhase,
    syncAssetsPhase,
    syncTransactionsPhase,
} from '../service/sync-phases'

const mocks = vi.hoisted(() => ({
    fetchAndPersistAccount: vi.fn(),
    getAllHeldAssetIdsForNetwork: vi.fn(),
    fetchAndPersistAssets: vi.fn(),
    fetchAndPersistPrices: vi.fn(),
    fetchAndPersistTransactions: vi.fn(),
    warn: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    fetchAndPersistAccount: mocks.fetchAndPersistAccount,
    getAllHeldAssetIdsForNetwork: mocks.getAllHeldAssetIdsForNetwork,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: mocks.fetchAndPersistAssets,
    fetchAndPersistPrices: mocks.fetchAndPersistPrices,
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    fetchAndPersistTransactions: mocks.fetchAndPersistTransactions,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: mocks.warn },
    mapWithConcurrency: async <T, R>(
        items: T[],
        _limit: number,
        mapper: (item: T, index: number) => Promise<R>,
    ) => Promise.allSettled(items.map((item, index) => mapper(item, index))),
}))

const syncResult = (
    overrides: Partial<AccountSyncResult> = {},
): AccountSyncResult =>
    ({
        changed: false,
        holdingsChanged: false,
        observedRound: null,
        ...overrides,
    }) as AccountSyncResult

const fulfilled = (
    value: AccountSyncResult,
): PromiseFulfilledResult<AccountSyncResult> => ({
    status: 'fulfilled',
    value,
})

const rejected = (reason: unknown): PromiseRejectedResult => ({
    status: 'rejected',
    reason,
})

describe('sync phases', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('syncAccountsPhase', () => {
        it('reports only the changed addresses and whether any holdings changed', async () => {
            mocks.fetchAndPersistAccount.mockImplementation(
                async (address: string) =>
                    address === 'A'
                        ? syncResult({ changed: true, holdingsChanged: true })
                        : syncResult(),
            )

            const result = await syncAccountsPhase(
                ['A', 'B'],
                'mainnet',
                'account',
            )

            expect(mocks.fetchAndPersistAccount).toHaveBeenCalledWith(
                'A',
                'mainnet',
            )
            expect(mocks.fetchAndPersistAccount).toHaveBeenCalledWith(
                'B',
                'mainnet',
            )
            expect(result.changedAddresses).toEqual(['A'])
            expect(result.hasHoldingsChanged).toBe(true)
            expect(result.hasSuccess).toBe(true)
            expect(result.hasFailure).toBe(false)
        })

        it('isolates a failed account and logs it with the phase and address', async () => {
            mocks.fetchAndPersistAccount.mockImplementation(
                async (address: string) => {
                    if (address === 'B') throw new Error('algod down')
                    return syncResult({ changed: true })
                },
            )

            const result = await syncAccountsPhase(
                ['A', 'B'],
                'testnet',
                'refresh-accounts',
            )

            expect(result.changedAddresses).toEqual(['A'])
            expect(result.hasSuccess).toBe(true)
            expect(result.hasFailure).toBe(true)
            expect(result.isRateLimited).toBe(false)
            expect(mocks.warn).toHaveBeenCalledWith(
                'Sync step failed',
                expect.objectContaining({
                    phase: 'refresh-accounts',
                    network: 'testnet',
                    subject: 'B',
                }),
            )
        })

        it('flags a 429 as rate limited without logging it', async () => {
            mocks.fetchAndPersistAccount.mockRejectedValue(
                new Error('HTTP 429 Too Many Requests'),
            )

            const result = await syncAccountsPhase(['A'], 'mainnet', 'account')

            expect(result.isRateLimited).toBe(true)
            expect(result.hasSuccess).toBe(false)
            expect(mocks.warn).not.toHaveBeenCalled()
        })
    })

    describe('syncTransactionsPhase', () => {
        it('fetches every address and summarises the outcomes', async () => {
            mocks.fetchAndPersistTransactions
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('indexer down'))

            const result = await syncTransactionsPhase(
                ['A', 'B'],
                'mainnet',
                'transactions',
            )

            expect(mocks.fetchAndPersistTransactions).toHaveBeenCalledTimes(2)
            expect(result.hasSuccess).toBe(true)
            expect(result.hasFailure).toBe(true)
            expect(mocks.warn).toHaveBeenCalledWith(
                'Sync step failed',
                expect.objectContaining({
                    phase: 'transactions',
                    subject: 'B',
                }),
            )
        })
    })

    describe('syncAssetsPhase', () => {
        beforeEach(() => {
            mocks.getAllHeldAssetIdsForNetwork.mockResolvedValue(['1', '2'])
        })

        it('runs only the requested kinds against the held asset ids', async () => {
            mocks.fetchAndPersistPrices.mockResolvedValue(undefined)

            const result = await syncAssetsPhase(
                'mainnet',
                ['prices'],
                'asset-metadata-or-prices',
            )

            expect(mocks.getAllHeldAssetIdsForNetwork).toHaveBeenCalledWith({
                network: 'mainnet',
            })
            expect(mocks.fetchAndPersistAssets).not.toHaveBeenCalled()
            expect(mocks.fetchAndPersistPrices).toHaveBeenCalledWith(
                ['1', '2'],
                'mainnet',
            )
            expect(result.succeededKinds).toEqual(['prices'])
        })

        it('reports which kinds succeeded when one fails', async () => {
            mocks.fetchAndPersistAssets.mockRejectedValue(new Error('boom'))
            mocks.fetchAndPersistPrices.mockResolvedValue(undefined)

            const result = await syncAssetsPhase(
                'mainnet',
                ['assets', 'prices'],
                'asset-metadata-or-prices',
            )

            expect(result.succeededKinds).toEqual(['prices'])
            expect(result.hasFailure).toBe(true)
            expect(mocks.warn).toHaveBeenCalledWith(
                'Sync step failed',
                expect.objectContaining({ subject: 'assets' }),
            )
        })

        it('lets a failed held-id read throw so the caller decides', async () => {
            mocks.getAllHeldAssetIdsForNetwork.mockRejectedValue(
                new Error('db locked'),
            )

            await expect(
                syncAssetsPhase('mainnet', ['assets'], 'asset'),
            ).rejects.toThrow('db locked')
            expect(mocks.fetchAndPersistAssets).not.toHaveBeenCalled()
        })
    })

    describe('resolveCheckpointRound', () => {
        it('advances to the minimum observed round on a clean pass', () => {
            const round = resolveCheckpointRound(
                [
                    fulfilled(syncResult({ observedRound: 120 })),
                    fulfilled(syncResult({ observedRound: 110 })),
                ],
                200,
            )

            expect(round).toBe(110)
        })

        it('falls back to the backend round when no fetch observed one', () => {
            expect(resolveCheckpointRound([fulfilled(syncResult())], 200)).toBe(
                200,
            )
        })

        it('freezes on any rejected fetch', () => {
            const round = resolveCheckpointRound(
                [
                    fulfilled(syncResult({ observedRound: 120 })),
                    rejected(new Error('boom')),
                ],
                200,
            )

            expect(round).toBeNull()
        })

        it('does not use the fallback when there were no accounts', () => {
            expect(resolveCheckpointRound([], 200)).toBeNull()
        })
    })
})
