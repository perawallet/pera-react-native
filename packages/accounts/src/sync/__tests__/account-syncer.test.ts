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
import { HOLDINGS_PAGE_LIMIT } from '../../constants'

// algosdk v9 exposes fluent builders: `algod.accountInformation(addr).do()`
// and `indexer.lookupAccountAssets(addr).limit(n).nextToken(t).do()`. These
// data mocks back the builders' `.do()` so the existing
// `mockResolvedValue`/`mockRejectedValue` setups (and call-count assertions on
// `.do()`) keep working unchanged.
const mockAccountInformationDo = vi.fn()
const mockLookupAccountAssetsDo = vi.fn()

// Factory spies record the builder-chain args (address, exclude, limit,
// nextToken) so the call-arg assertions can inspect what the source requested.
const mockAccountInformation = vi.fn((_address: string) => {
    const builder = {
        exclude: vi.fn((value: string) => {
            mockAccountInformation.lastExclude = value
            return builder
        }),
        do: () => mockAccountInformationDo(),
    }
    return builder
}) as ReturnType<typeof vi.fn> & { lastExclude?: string }

const mockLookupAccountAssets = vi.fn((_address: string) => {
    const builder = {
        limit: vi.fn((value: number) => {
            mockLookupAccountAssets.lastLimits.push(value)
            return builder
        }),
        nextToken: vi.fn((token: string) => {
            mockLookupAccountAssets.lastNextTokens.push(token)
            return builder
        }),
        do: () => mockLookupAccountAssetsDo(),
    }
    return builder
}) as ReturnType<typeof vi.fn> & {
    lastNextTokens: string[]
    lastLimits: number[]
}
mockLookupAccountAssets.lastNextTokens = []
mockLookupAccountAssets.lastLimits = []

const mockGetAlgorandClient = vi.fn(() => ({
    client: {
        algod: { accountInformation: mockAccountInformation },
        indexer: { lookupAccountAssets: mockLookupAccountAssets },
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    getAlgorandClient: (...args: unknown[]) => mockGetAlgorandClient(...args),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: vi.fn().mockResolvedValue(undefined),
    fetchAndPersistPrices: vi.fn().mockResolvedValue(undefined),
}))

const mockUpsertAccountBalance = vi.fn()
const mockRefreshAccountHoldings = vi.fn()
const mockGetAccountBalance = vi.fn()

vi.mock('../../db', () => ({
    upsertAccountBalance: (...args: unknown[]) =>
        mockUpsertAccountBalance(...args),
    refreshAccountHoldings: (...args: unknown[]) =>
        mockRefreshAccountHoldings(...args),
    getAccountBalance: (...args: unknown[]) => mockGetAccountBalance(...args),
    getAccountHoldings: vi.fn().mockResolvedValue([]),
}))

describe('fetchAndPersistAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccountInformation.lastExclude = undefined
        mockLookupAccountAssets.lastNextTokens = []
        mockLookupAccountAssets.lastLimits = []
        mockUpsertAccountBalance.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        mockGetAccountBalance.mockResolvedValue(undefined)
        mockLookupAccountAssetsDo.mockResolvedValue({ assets: [] })
    })

    it('persists balance and holdings from a single full algod read', async () => {
        mockAccountInformationDo.mockResolvedValue({
            amount: 1_500_000n,
            minBalance: 100_000n,
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 1,
            totalAppsOptedIn: 0,
            status: 'Online',
            authAddr: { toString: () => 'REKEY_ADDR' },
            assets: [
                { assetId: 10n, amount: 500n, isFrozen: true },
                { assetId: 20n, amount: 0n, isFrozen: false },
            ],
        })

        const result = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockGetAlgorandClient).toHaveBeenCalledWith('mainnet')
        // Small account → holdings come inline from algod, no indexer paging.
        expect(mockAccountInformation).toHaveBeenCalledWith('ADDR1')
        expect(mockLookupAccountAssets).not.toHaveBeenCalled()

        expect(mockUpsertAccountBalance).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            network: 'mainnet',
            algoBalance: new Decimal('1.5'),
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 1,
            totalAppsOptedIn: 0,
            minBalance: new Decimal('0.1'),
            status: 'Online',
            authAddress: 'REKEY_ADDR',
        })

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            network: 'mainnet',
            holdings: [
                // ALGO injected as a base-units (microalgos) holding, first.
                {
                    assetId: '0',
                    amount: new Decimal(1_500_000),
                    isFrozen: false,
                },
                { assetId: '10', amount: new Decimal(500), isFrozen: true },
                { assetId: '20', amount: new Decimal(0), isFrozen: false },
            ],
        })

        // First sync of an account with no prior row → changed. The mocked
        // response carries no round, so none is reported.
        expect(result).toEqual({
            changed: true,
            holdingsChanged: true,
            observedRound: null,
        })
    })

    it('reports the algod round the inline read observed', async () => {
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
            round: 1234n,
        })

        const result = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(result.observedRound).toBe(1234)
    })

    it('defaults missing optional fields', async () => {
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
            // no totals, no status, no authAddr
        })

        await fetchAndPersistAccount('ADDR1', 'testnet')

        expect(mockUpsertAccountBalance).toHaveBeenCalledWith(
            expect.objectContaining({
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                status: 'Offline',
                authAddress: null,
            }),
        )

        // No ASAs, but ALGO is always injected as a holding.
        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    { assetId: '0', amount: new Decimal(0), isFrozen: false },
                ],
            }),
        )
    })

    it('treats a missing asset amount as zero', async () => {
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
            assets: [{ assetId: 42n }],
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    { assetId: '0', amount: new Decimal(0), isFrozen: false },
                    { assetId: '42', amount: new Decimal(0), isFrozen: false },
                ],
            }),
        )
    })

    it('skips the full read and pages the indexer when persisted resource counts exceed the inline cap', async () => {
        mockGetAccountBalance.mockResolvedValue({
            algoBalance: new Decimal(0),
            totalAssetsOptedIn: 1500,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(0),
            status: 'Offline',
            authAddress: null,
        })
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
        })
        mockLookupAccountAssetsDo
            .mockResolvedValueOnce({
                assets: [{ assetId: 1n, amount: 1n, isFrozen: true }],
                nextToken: 'page2',
            })
            .mockResolvedValueOnce({
                assets: [{ assetId: 2n, amount: 2n }],
            })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        // Goes straight to the asset-less info read — no doomed full read.
        expect(mockAccountInformation).toHaveBeenCalledTimes(1)
        expect(mockAccountInformation).toHaveBeenCalledWith('ADDR1')
        expect(mockAccountInformation.lastExclude).toBe('all')
        expect(mockLookupAccountAssets).toHaveBeenNthCalledWith(1, 'ADDR1')
        expect(mockLookupAccountAssets).toHaveBeenNthCalledWith(2, 'ADDR1')
        // Every page (initial + paginated follow-up) must request
        // HOLDINGS_PAGE_LIMIT — dropping `.limit()` silently falls back to the
        // indexer default of 100, ~10x-ing request counts for large accounts.
        expect(mockLookupAccountAssets.lastLimits).toEqual([
            HOLDINGS_PAGE_LIMIT,
            HOLDINGS_PAGE_LIMIT,
        ])
        // First page sends no token; the second follows the page-1 token.
        expect(mockLookupAccountAssets.lastNextTokens).toEqual(['page2'])
        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    { assetId: '0', amount: new Decimal(0), isFrozen: false },
                    { assetId: '1', amount: new Decimal(1), isFrozen: true },
                    { assetId: '2', amount: new Decimal(2), isFrozen: false },
                ],
            }),
        )
    })

    it('reports the minimum round across algod and indexer on the split path', async () => {
        mockGetAccountBalance.mockResolvedValue({
            algoBalance: new Decimal(0),
            totalAssetsOptedIn: 1500,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(0),
            status: 'Offline',
            authAddress: null,
        })
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
            round: 1200n,
        })
        // The indexer trails algod — the lower round must win so the
        // checkpoint can't run ahead of what was actually read.
        mockLookupAccountAssetsDo.mockResolvedValue({
            assets: [],
            currentRound: 1188n,
        })

        const result = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(result.observedRound).toBe(1188)
    })

    it('falls back to the split algod+indexer read when algod rejects the full read with 400', async () => {
        // algod's resource-cap rejection surfaces as an ApiError with status.
        const capError = Object.assign(new Error('Result limit exceeded'), {
            status: 400,
        })
        mockAccountInformationDo
            .mockRejectedValueOnce(capError)
            .mockResolvedValueOnce({ amount: 0n, minBalance: 0n })
        mockLookupAccountAssetsDo.mockResolvedValue({
            assets: [{ assetId: 7n, amount: 3n }],
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockAccountInformation).toHaveBeenNthCalledWith(1, 'ADDR1')
        expect(mockAccountInformation).toHaveBeenNthCalledWith(2, 'ADDR1')
        expect(mockAccountInformation.lastExclude).toBe('all')
        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    { assetId: '0', amount: new Decimal(0), isFrozen: false },
                    { assetId: '7', amount: new Decimal(3), isFrozen: false },
                ],
            }),
        )
    })

    it('propagates non-resource-cap errors from the full read without falling back', async () => {
        mockAccountInformationDo.mockRejectedValue(
            Object.assign(new Error('Too Many Requests: 429'), {
                status: 429,
            }),
        )

        await expect(
            fetchAndPersistAccount('ADDR1', 'mainnet'),
        ).rejects.toThrow('429')

        expect(mockAccountInformation).toHaveBeenCalledTimes(1)
        expect(mockLookupAccountAssets).not.toHaveBeenCalled()
    })

    it('reports no change when balance and holdings are unchanged', async () => {
        mockAccountInformationDo.mockResolvedValue({
            amount: 1_000_000n,
            minBalance: 100_000n,
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            status: 'Offline',
        })
        mockGetAccountBalance.mockResolvedValue({
            algoBalance: new Decimal('1'),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal('0.1'),
            status: 'Offline',
            authAddress: null,
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
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
        })

        const [a, b] = await Promise.all([
            fetchAndPersistAccount('ADDR1', 'mainnet'),
            fetchAndPersistAccount('ADDR1', 'mainnet'),
        ])

        expect(a).toEqual(b)
        expect(mockAccountInformation).toHaveBeenCalledTimes(1)
    })

    it('persists the chain freeze flag on each holding', async () => {
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
            assets: [
                { assetId: 1n, amount: 5n, isFrozen: true },
                { assetId: 2n, amount: 7n, isFrozen: false },
            ],
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    { assetId: '0', amount: new Decimal(0), isFrozen: false },
                    { assetId: '1', amount: new Decimal(5), isFrozen: true },
                    { assetId: '2', amount: new Decimal(7), isFrozen: false },
                ],
            }),
        )
    })

    it('marks the synthetic ALGO row as never frozen', async () => {
        mockAccountInformationDo.mockResolvedValue({
            amount: 1_000_000n,
            minBalance: 0n,
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    {
                        assetId: '0',
                        amount: new Decimal(1_000_000),
                        isFrozen: false,
                    },
                ],
            }),
        )
    })
})

describe('ensureAccountFetched', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccountInformation.lastExclude = undefined
        mockLookupAccountAssets.lastNextTokens = []
        mockLookupAccountAssets.lastLimits = []
        mockUpsertAccountBalance.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        mockLookupAccountAssetsDo.mockResolvedValue({ assets: [] })
        mockAccountInformationDo.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
        })
    })

    it('skips the fetch when a balance row already exists', async () => {
        mockGetAccountBalance.mockResolvedValue({ algoBalance: new Decimal(1) })

        await ensureAccountFetched('ADDR1', 'mainnet')

        expect(mockAccountInformation).not.toHaveBeenCalled()
    })

    it('fetches when there is no balance row yet', async () => {
        mockGetAccountBalance.mockResolvedValue(undefined)

        await ensureAccountFetched('ADDR1', 'mainnet')

        expect(mockAccountInformation).toHaveBeenCalledWith('ADDR1')
    })

    it('swallows fetch errors (never throws to the caller)', async () => {
        mockGetAccountBalance.mockResolvedValue(undefined)
        mockAccountInformationDo.mockRejectedValue(new Error('algod down'))

        await expect(
            ensureAccountFetched('ADDR1', 'mainnet'),
        ).resolves.toBeUndefined()
    })
})
