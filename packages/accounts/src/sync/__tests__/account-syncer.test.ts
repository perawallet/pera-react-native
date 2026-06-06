/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { fetchAndPersistAccount } from '../account-syncer'

const mockAccountInformation = vi.fn()
const mockLookupAccountAssets = vi.fn()
const mockGetAlgorandClient = vi.fn(() => ({
    client: {
        algod: { accountInformation: mockAccountInformation },
        indexer: { lookupAccountAssets: mockLookupAccountAssets },
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    getAlgorandClient: (...args: unknown[]) => mockGetAlgorandClient(...args),
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
}))

describe('fetchAndPersistAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpsertAccountBalance.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        mockGetAccountBalance.mockResolvedValue(undefined)
        mockLookupAccountAssets.mockResolvedValue({ assets: [] })
    })

    it('persists converted balance from algod account info (assets excluded)', async () => {
        mockAccountInformation.mockResolvedValue({
            amount: 1_500_000n,
            minBalance: 100_000n,
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 1,
            totalAppsOptedIn: 0,
            status: 'Online',
            authAddr: { toString: () => 'REKEY_ADDR' },
        })
        mockLookupAccountAssets.mockResolvedValue({
            assets: [
                { assetId: 10n, amount: 500n },
                { assetId: 20n, amount: 0n },
            ],
        })

        const result = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockGetAlgorandClient).toHaveBeenCalledWith('mainnet')
        expect(mockAccountInformation).toHaveBeenCalledWith('ADDR1', {
            exclude: 'all',
        })

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
                { assetId: '0', amount: new Decimal(1_500_000) },
                { assetId: '10', amount: new Decimal(500) },
                { assetId: '20', amount: new Decimal(0) },
            ],
        })

        // First sync of an account with no prior row → changed.
        expect(result).toEqual({ changed: true, holdingsChanged: true })
    })

    it('defaults missing optional fields', async () => {
        mockAccountInformation.mockResolvedValue({
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
                holdings: [{ assetId: '0', amount: new Decimal(0) }],
            }),
        )
    })

    it('treats a missing asset amount as zero', async () => {
        mockAccountInformation.mockResolvedValue({
            amount: 0n,
            minBalance: 0n,
        })
        mockLookupAccountAssets.mockResolvedValue({
            assets: [{ assetId: 42n }],
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    { assetId: '0', amount: new Decimal(0) },
                    { assetId: '42', amount: new Decimal(0) },
                ],
            }),
        )
    })

    it('pages through holdings using the indexer nextToken', async () => {
        mockAccountInformation.mockResolvedValue({ amount: 0n, minBalance: 0n })
        mockLookupAccountAssets
            .mockResolvedValueOnce({
                assets: [{ assetId: 1n, amount: 1n }],
                nextToken: 'page2',
            })
            .mockResolvedValueOnce({
                assets: [{ assetId: 2n, amount: 2n }],
            })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockLookupAccountAssets).toHaveBeenNthCalledWith(1, 'ADDR1', {
            limit: 1000,
            next: undefined,
        })
        expect(mockLookupAccountAssets).toHaveBeenNthCalledWith(2, 'ADDR1', {
            limit: 1000,
            next: 'page2',
        })
        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [
                    { assetId: '0', amount: new Decimal(0) },
                    { assetId: '1', amount: new Decimal(1) },
                    { assetId: '2', amount: new Decimal(2) },
                ],
            }),
        )
    })

    it('reports no change when balance and holdings are unchanged', async () => {
        mockAccountInformation.mockResolvedValue({
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

        expect(result).toEqual({ changed: false, holdingsChanged: false })
    })

    it('coalesces concurrent fetches for the same account', async () => {
        mockAccountInformation.mockResolvedValue({ amount: 0n, minBalance: 0n })

        const [a, b] = await Promise.all([
            fetchAndPersistAccount('ADDR1', 'mainnet'),
            fetchAndPersistAccount('ADDR1', 'mainnet'),
        ])

        expect(a).toEqual(b)
        expect(mockAccountInformation).toHaveBeenCalledTimes(1)
    })
})
