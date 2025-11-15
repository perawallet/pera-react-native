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

import type {
    Asset,
    AssetDetailSerializerResponse,
    AssetSerializerResponse,
} from '@api/index'

export type PeraAsset =
    | Asset
    | AssetDetailSerializerResponse
    | AssetSerializerResponse

export const ALGO_ASSET: PeraAsset = {
    asset_id: 0,
    fraction_decimals: 6,
    unit_name: 'ALGO',
    name: 'Algo',
    verification_tier: 'verified',
    last_24_hours_algo_price_change_percentage: 0,
    total: '0',
    is_deleted: false,
    creator: {
        address: '',
    },
    is_verified: true,
    category: 0,
}
