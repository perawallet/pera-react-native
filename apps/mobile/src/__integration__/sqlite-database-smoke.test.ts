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

// Smoke test for the SQLite test plumbing: confirms that
// `setupTestDatabase()` runs migrations end-to-end, `seedAlgoAsset()`
// inserts a row that the assets repository can read back, and
// `resetTestDatabase()` produces a clean slate. Integration tests that
// touch the on-device DB should rely on this scaffold.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { ALGO_ASSET_ID, getAssetsByIds } from '@perawallet/wallet-core-assets'

describe('Integration test plumbing: SQLite database', () => {
    beforeAll(setupTestDatabase)
    afterAll(teardownTestDatabase)
    beforeEach(resetTestDatabase)

    it('Given a freshly migrated DB with the ALGO seed, when the assets repository reads by id, then ALGO_ASSET is returned', async () => {
        await seedAlgoAsset('mainnet')

        const rows = await getAssetsByIds({
            assetIds: [ALGO_ASSET_ID],
            network: 'mainnet',
        })

        expect(rows).toHaveLength(1)
        expect(rows[0].assetId).toBe(ALGO_ASSET_ID)
        expect(rows[0].unitName).toBe('ALGO')
    })

    it('Given a previous test seeded the DB, when the next test starts, then the seed is gone', async () => {
        // The beforeEach reset wipes whatever the previous test inserted.
        // No seed call here — assert empty.
        const rows = await getAssetsByIds({
            assetIds: [ALGO_ASSET_ID],
            network: 'mainnet',
        })
        expect(rows).toHaveLength(0)
    })
})
