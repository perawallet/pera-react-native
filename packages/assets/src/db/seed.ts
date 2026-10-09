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

import type { Database } from '@perawallet/wallet-core-database'
import {
    LEGACY_CHAIN_ID,
    LEGACY_SCOPES,
} from '@perawallet/wallet-core-chain-contract'
import { nativeAssetFor } from '../chain-adapter'
import { DEFAULT_ASSET_METADATA } from '../models'
import { upsertAssets } from './metadataRepository'

/**
 * Seeds the native asset row for EVERY scope of the legacy chain.
 *
 * Derived from `LEGACY_SCOPES` rather than a hand-written list: this seed previously
 * named mainnet and testnet literally, so when betanet and the runtime-
 * configurable custom slot were added the row was silently missing for them.
 * `useAssetsQuery` reads assets from this table (network-scoped) and only hits
 * the network when explicitly asked to `fetchMissing`, so a missing native row
 * is not merely cosmetic — `InputScreen` gates its whole form on `!asset` and
 * renders a spinner forever, making Send permanently unusable on the affected
 * network. Iterating every scope means a future network cannot reintroduce that.
 *
 * The native asset's metadata comes from the chain adapter, so this needs no
 * Pera service and is correct even on a network with no Pera deployment. The
 * adapter must be registered before this runs.
 *
 * The device-local fields (isFavorited, isPriceAlertEnabled) are stripped:
 * the adapter's record carries concrete `false` defaults, and upsertPeraAssets
 * only preserves the stored value when the incoming one is nullish — seeding
 * the record as-is reset the native asset's favorite on every launch. It is
 * also excluded from the device-scoped bulk sync, so nothing would restore it.
 */
export async function seedNativeAssets(db: Database): Promise<void> {
    const nativeAsset = nativeAssetFor(LEGACY_CHAIN_ID)
    const items = [
        {
            ...nativeAsset,
            peraMetadata: {
                ...DEFAULT_ASSET_METADATA,
                ...nativeAsset.peraMetadata,
                isFavorited: undefined,
                isPriceAlertEnabled: undefined,
            },
        },
    ]

    for (const scope of LEGACY_SCOPES) {
        await upsertAssets({ db, items, scope })
    }
}
