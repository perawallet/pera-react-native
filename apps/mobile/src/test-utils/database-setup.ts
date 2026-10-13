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

// Gives repository tests the real SQLite schema instead of the platform
// driver's throwing stub. Expected lifecycle:
//
//   beforeAll(setupTestDatabase)
//   beforeEach(resetTestDatabase)
//   afterAll(teardownTestDatabase)
//
// or `withTestDatabase()` for all three at once.

import { Decimal } from 'decimal.js'
import { upsertAccountChainState } from '@perawallet/wallet-core-accounts'
import {
    initializeDatabase,
    resetDatabase,
} from '@perawallet/wallet-core-database'
import {
    nativeAssetFor,
    upsertAssets,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    LEGACY_CHAIN_ID,
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-shared'
import { testDatabaseService } from './sqlite-database'

/**
 * Open the test database and run all migrations. Idempotent — safe to
 * call from `beforeAll` even if a previous test file already
 * initialized.
 */
export const setupTestDatabase = async (): Promise<void> => {
    await initializeDatabase(testDatabaseService)
}

/**
 * Drop all data and re-migrate. Use in `beforeEach` to guarantee a
 * clean slate. Cheaper than tearing down and rebuilding the SQLite
 * handle every test.
 */
export const resetTestDatabase = async (): Promise<void> => {
    testDatabaseService.reset()
    resetDatabase()
    await initializeDatabase(testDatabaseService)
}

/**
 * Close the underlying SQLite handle. Call from `afterAll` if you want
 * the file descriptor released; tests share one process, so this is
 * mostly for cleanliness.
 */
export const teardownTestDatabase = async (): Promise<void> => {
    testDatabaseService.reset()
    resetDatabase()
}

// Seed helpers — narrow, named fixtures rather than a god-mode setter.
// Add new helpers here as more flows need richer pre-loaded state.

/**
 * Insert the native asset into the assets cache. Required by any flow that
 * goes through `useAssetsQuery(['0'])` (send, receive, asset details,
 * confirmation screens). Defaults to mainnet — pass `network` if your
 * test needs testnet.
 */
export const seedAlgoAsset = async (
    network: Network = 'mainnet',
): Promise<void> => {
    await upsertAssets({
        items: [nativeAssetFor(LEGACY_CHAIN_ID)],
        scope: scopeForLegacyNetwork(network),
    })
}

/**
 * Insert an arbitrary list of assets. Useful for tests that exercise
 * the asset-list / opt-in / details screens.
 */
export const seedAssets = async (
    assets: PeraAsset[],
    network: Network = 'mainnet',
): Promise<void> => {
    if (assets.length === 0) return
    await upsertAssets({ items: assets, scope: scopeForLegacyNetwork(network) })
}

type SeedAlgorandAccountStateParams = {
    accountAddress: string
    scope: ChainScope
    /** microAlgos. */
    nativeBalance: Decimal
    /** microAlgos. */
    minBalance?: Decimal
    totalAssetsOptedIn?: number
    totalCreatedAssets?: number
    authAddress?: string
}

/**
 * Insert an account's chain-state row the way the syncer persists it, so
 * balance and holdings reads have data without a network round-trip.
 */
export const seedAlgorandAccountState = async ({
    accountAddress,
    scope,
    nativeBalance,
    minBalance = new Decimal(100_000),
    totalAssetsOptedIn = 0,
    totalCreatedAssets = 0,
    authAddress,
}: SeedAlgorandAccountStateParams): Promise<void> => {
    await upsertAccountChainState({
        accountAddress,
        scope,
        nativeBalance,
        chainData: {
            family: 'algorand',
            minBalance,
            status: 'Offline',
            totalAssetsOptedIn,
            totalCreatedAssets,
            totalAppsOptedIn: 0,
            ...(authAddress ? { authAddress } : {}),
        },
    })
}
