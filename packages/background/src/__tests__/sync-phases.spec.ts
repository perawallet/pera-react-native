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
    isRateLimitError,
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
    hasCachedHistoryRows: vi.fn((chainId: string) => chainId === 'algorand'),
    warn: vi.fn(),
    concurrencyLimits: [] as number[],
    adapters: {} as Record<string, { maxConcurrentStateReads?: number }>,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    accountsChainAdapters: {
        get: (chainId: string) => mocks.adapters[chainId],
    },
    fetchAndPersistAccount: mocks.fetchAndPersistAccount,
    getAllHeldAssetIdsForNetwork: mocks.getAllHeldAssetIdsForNetwork,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: mocks.fetchAndPersistAssets,
    fetchAndPersistPrices: mocks.fetchAndPersistPrices,
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    fetchAndPersistTransactions: mocks.fetchAndPersistTransactions,
    hasCachedHistoryRows: mocks.hasCachedHistoryRows,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actualShared =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        logger: { warn: mocks.warn },
        getHttpStatus: actualShared.getHttpStatus,
        // Unbounded stand-in that records the limit it was given.
        mapWithConcurrency: async <T, R>(
            items: T[],
            limit: number,
            mapper: (item: T, index: number) => Promise<R>,
        ) => {
            mocks.concurrencyLimits.push(limit)
            return Promise.allSettled(
                items.map((item, index) => mapper(item, index)),
            )
        },
    }
})

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

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
        mocks.concurrencyLimits = []
        mocks.adapters = {
            algorand: { maxConcurrentStateReads: 6 },
            ethereum: {},
        }
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
                MAINNET,
                'account',
            )

            expect(mocks.fetchAndPersistAccount).toHaveBeenCalledWith('A', {
                chainId: 'algorand',
                networkId: 'mainnet',
            })
            expect(mocks.fetchAndPersistAccount).toHaveBeenCalledWith('B', {
                chainId: 'algorand',
                networkId: 'mainnet',
            })
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
                TESTNET,
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
                    scope: TESTNET,
                    subject: 'B',
                }),
            )
        })

        it('flags a 429 as rate limited without logging it', async () => {
            mocks.fetchAndPersistAccount.mockRejectedValue(
                Object.assign(new Error('Too Many Requests'), { status: 429 }),
            )

            const result = await syncAccountsPhase(['A'], MAINNET, 'account')

            expect(result.isRateLimited).toBe(true)
            expect(result.hasSuccess).toBe(false)
            expect(mocks.warn).not.toHaveBeenCalled()
        })

        it('does not treat a 429 that only appears in the message as rate limited', async () => {
            mocks.fetchAndPersistAccount.mockRejectedValue(
                new Error('HTTP 429 Too Many Requests'),
            )

            const result = await syncAccountsPhase(['A'], MAINNET, 'account')

            expect(result.isRateLimited).toBe(false)
            expect(mocks.warn).toHaveBeenCalledWith(
                'Sync step failed',
                expect.objectContaining({ phase: 'account', subject: 'A' }),
            )
        })
    })

    describe('syncAccountsPhase read concurrency', () => {
        const addresses = Array.from({ length: 10 }, (_, i) => `0x${i}`)

        beforeEach(() => {
            mocks.fetchAndPersistAccount.mockResolvedValue(syncResult())
        })

        it('caps the reads in flight at the chain cap', async () => {
            await syncAccountsPhase(addresses, MAINNET, 'account')

            expect(mocks.concurrencyLimits).toEqual([6])
        })

        it('starts every read at once on a chain without a cap', async () => {
            await syncAccountsPhase(addresses, ETHEREUM, 'account')

            expect(mocks.concurrencyLimits).toEqual([10])
            expect(mocks.fetchAndPersistAccount).toHaveBeenCalledWith(
                '0x0',
                ETHEREUM,
            )
        })
    })

    describe('syncTransactionsPhase', () => {
        it('fetches every address and summarises the outcomes', async () => {
            mocks.fetchAndPersistTransactions
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('indexer down'))

            const result = await syncTransactionsPhase(
                ['A', 'B'],
                MAINNET,
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
        it('reports neither success nor failure on a chain that keeps no history rows', async () => {
            const result = await syncTransactionsPhase(
                ['0xA', '0xB'],
                ETHEREUM,
                'transactions',
            )

            expect(mocks.fetchAndPersistTransactions).not.toHaveBeenCalled()
            expect(result).toEqual({
                results: [],
                hasSuccess: false,
                hasFailure: false,
                isRateLimited: false,
            })
        })
    })

    describe('syncAssetsPhase', () => {
        beforeEach(() => {
            mocks.getAllHeldAssetIdsForNetwork.mockResolvedValue(['1', '2'])
        })

        it('runs only the requested kinds against the held asset ids', async () => {
            mocks.fetchAndPersistPrices.mockResolvedValue(undefined)

            const result = await syncAssetsPhase(
                MAINNET,
                ['prices'],
                'asset-metadata-or-prices',
            )

            expect(mocks.getAllHeldAssetIdsForNetwork).toHaveBeenCalledWith({
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            })
            expect(mocks.fetchAndPersistAssets).not.toHaveBeenCalled()
            expect(mocks.fetchAndPersistPrices).toHaveBeenCalledWith(
                ['1', '2'],
                MAINNET,
            )
            expect(result.succeededKinds).toEqual(['prices'])
        })

        it('reports which kinds succeeded when one fails', async () => {
            mocks.fetchAndPersistAssets.mockRejectedValue(new Error('boom'))
            mocks.fetchAndPersistPrices.mockResolvedValue(undefined)

            const result = await syncAssetsPhase(
                MAINNET,
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

        it('prices a non-Algorand scope under that scope', async () => {
            mocks.fetchAndPersistAssets.mockResolvedValue(undefined)
            mocks.fetchAndPersistPrices.mockResolvedValue(undefined)

            const result = await syncAssetsPhase(
                ETHEREUM,
                ['assets', 'prices'],
                'asset-metadata-or-prices',
            )

            expect(mocks.fetchAndPersistAssets).toHaveBeenCalledWith(
                ['1', '2'],
                ETHEREUM,
            )
            expect(mocks.fetchAndPersistPrices).toHaveBeenCalledWith(
                ['1', '2'],
                ETHEREUM,
            )
            expect(result.succeededKinds).toEqual(['assets', 'prices'])
            expect(result.hasFailure).toBe(false)
        })

        it('lets a failed held-id read throw so the caller decides', async () => {
            mocks.getAllHeldAssetIdsForNetwork.mockRejectedValue(
                new Error('db locked'),
            )

            await expect(
                syncAssetsPhase(MAINNET, ['assets'], 'asset'),
            ).rejects.toThrow('db locked')
            expect(mocks.fetchAndPersistAssets).not.toHaveBeenCalled()
        })
    })

    describe('isRateLimitError', () => {
        it('reads a flat status', () => {
            expect(isRateLimitError({ status: 429 })).toBe(true)
        })

        it('reads a response status', () => {
            expect(isRateLimitError({ response: { status: 429 } })).toBe(true)
        })

        it('finds a 429 down the cause chain', () => {
            const error = Object.assign(new Error('Contract read failed'), {
                cause: Object.assign(new Error('HTTP request failed.'), {
                    status: 429,
                }),
            })

            expect(isRateLimitError(error)).toBe(true)
        })

        it('ignores a 429 that only appears in the message', () => {
            expect(
                isRateLimitError(new Error('HTTP 429 Too Many Requests')),
            ).toBe(false)
        })

        it('ignores other statuses', () => {
            expect(isRateLimitError({ status: 500 })).toBe(false)
        })

        it('terminates on a self-referencing cause', () => {
            const error = new Error('loop') as Error & { cause?: unknown }
            error.cause = error

            expect(isRateLimitError(error)).toBe(false)
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

        it('falls back to the signal cursor when no fetch observed one', () => {
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
