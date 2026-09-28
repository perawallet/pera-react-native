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

import { eq, and } from 'drizzle-orm'
import type {
    AssetsNodeSchema,
    AssetsPeraSchema,
    AssetPricesSchema,
} from '@perawallet/wallet-core-assets'
import { AccountAssetHoldingsSchema } from './schema'

// Home-screen reads. Both join on the indexed accountAddress and let SQLite do
// the summing, sorting and windowing, so the JS thread only materializes rows
// actually on screen. ALGO participates like any holding, so there's no
// synthetic-row union or per-row special-casing.
export const holdingJoin = (
    table:
        | typeof AssetsNodeSchema
        | typeof AssetsPeraSchema
        | typeof AssetPricesSchema,
) =>
    and(
        eq(AccountAssetHoldingsSchema.assetId, table.assetId),
        eq(AccountAssetHoldingsSchema.network, table.network),
    )
