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

import { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Asset detail screen actions. */
export enum AssetDetailsEvent {
    Show = 'asset_detail_asset', // Viewed an asset's detail (includes asset id)
    Change = 'asset_detail_asset_change', // Switched the selected asset in detail
    AddAsset = 'assetscr_asset_add', // Added an asset
    ManageAsset = 'assetscr_assets_manage', // Opened manage assets
    Receive = 'tap_asset_detail_receive', // Tapped Receive on asset detail
    Send = 'tap_asset_detail_send', // Tapped Send on asset detail
    SwapAlgo = 'algoasadetail_swap_click', // Tapped Swap on the ALGO asset detail
}

export interface AssetDetailsRequiredPayloads {
    [AssetDetailsEvent.Show]: {
        [Key.AssetId]: string
    }
}
