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

import type { CollectionRegistry } from '@perawallet/wallet-core-database'
import { ALGO_ASSET } from '../models'
import { upsertAssets } from './repository'

/**
 * Seeds the ALGO asset into both mainnet and testnet. Called once during
 * app bootstrap (after `bootstrapCollections`) so callers that read ALGO
 * via the assets collections always get a hit, even before the first
 * sync tick has run.
 */
export async function seedAlgoAsset(
    registry?: CollectionRegistry,
): Promise<void> {
    const items = [ALGO_ASSET]

    await upsertAssets({ registry, items, network: 'mainnet' })
    await upsertAssets({ registry, items, network: 'testnet' })
}
