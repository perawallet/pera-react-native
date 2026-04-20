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

const mockGetInformation = vi.fn()
const mockGetAlgorandClient = vi.fn(() => ({
    account: { getInformation: mockGetInformation },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    getAlgorandClient: (...args: unknown[]) => mockGetAlgorandClient(...args),
}))

const mockUpsertAccountBalance = vi.fn()
const mockRefreshAccountHoldings = vi.fn()

vi.mock('../../db', () => ({
    upsertAccountBalance: (...args: unknown[]) =>
        mockUpsertAccountBalance(...args),
    refreshAccountHoldings: (...args: unknown[]) =>
        mockRefreshAccountHoldings(...args),
}))

describe('fetchAndPersistAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpsertAccountBalance.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(undefined)
    })

    it('persists converted balance and holdings from algokit info', async () => {
        mockGetInformation.mockResolvedValue({
            balance: { microAlgos: 1_500_000n },
            minBalance: { microAlgos: 100_000n },
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 1,
            totalAppsOptedIn: 0,
            status: 'Online',
            authAddr: { toString: () => 'REKEY_ADDR' },
            assets: [
                { assetId: 10n, amount: 500n },
                { assetId: 20n, amount: 0n },
            ],
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockGetAlgorandClient).toHaveBeenCalledWith('mainnet')
        expect(mockGetInformation).toHaveBeenCalledWith('ADDR1')

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
                { assetId: '10', amount: new Decimal(500) },
                { assetId: '20', amount: new Decimal(0) },
            ],
        })
    })

    it('defaults missing optional fields', async () => {
        mockGetInformation.mockResolvedValue({
            balance: { microAlgos: 0n },
            minBalance: { microAlgos: 0n },
            // no totals, no status, no authAddr, no assets
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

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({ holdings: [] }),
        )
    })

    it('treats a missing asset amount as zero', async () => {
        mockGetInformation.mockResolvedValue({
            balance: { microAlgos: 0n },
            minBalance: { microAlgos: 0n },
            assets: [{ assetId: 42n }],
        })

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith(
            expect.objectContaining({
                holdings: [{ assetId: '42', amount: new Decimal(0) }],
            }),
        )
    })
})
