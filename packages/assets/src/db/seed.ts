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
import { Networks } from '@perawallet/wallet-core-config'
import { ALGO_ASSET } from '../models'
import { upsertAssets } from './repository'

/**
 * Seeds the ALGO asset row for EVERY network.
 *
 * Derived from `Networks` rather than a hand-written list: this seed previously
 * named mainnet and testnet literally, so when betanet and the runtime-
 * configurable custom slot were added the row was silently missing for them.
 * `useAssetsQuery` reads assets from this table (network-scoped) and only hits
 * the network when explicitly asked to `fetchMissing`, so a missing ALGO row is
 * not merely cosmetic — `InputScreen` gates its whole form on `!asset` and
 * renders a spinner forever, making Send permanently unusable on the affected
 * network. Iterating the enum means a future network cannot reintroduce that.
 *
 * ALGO's metadata is a local constant (`ALGO_ASSET`), so this needs no Pera
 * service and is correct even on a network with no Pera deployment.
 */
export async function seedAlgoAsset(db: Database): Promise<void> {
    const items = [ALGO_ASSET]

    for (const network of Object.values(Networks)) {
        await upsertAssets({ db, items, network })
    }
}
