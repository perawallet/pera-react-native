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

import type { AssetSearchResultResponse } from '../api/assets/search-schema'
import type { DisplayableAsset } from '../models/assets'

/** Maps a raw `/v1/assets/search/` result to the shared DisplayableAsset shape,
 *  nesting metadata exactly like PeraAsset so one UI can render both. */
export const transformSearchResult = (
    item: AssetSearchResultResponse,
): DisplayableAsset => ({
    assetId: String(item.asset_id),
    name: item.name ?? undefined,
    unitName: item.unit_name ?? undefined,
    peraMetadata: {
        logo: item.logo ?? null,
        verificationTier: item.verification_tier,
        type: item.type ?? undefined,
        collectible: item.collectible
            ? {
                  title: item.collectible.title ?? undefined,
                  primaryImage: item.collectible.primary_image ?? undefined,
                  collection: item.collectible.collection?.name
                      ? { name: item.collectible.collection.name }
                      : undefined,
              }
            : undefined,
    },
})
