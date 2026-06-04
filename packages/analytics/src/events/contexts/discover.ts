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

/** Discover tab actions. */
export enum DiscoverEvent {
    Search = 'discover_markets_search', // Searched in Discover markets (asset id, opt. query)
    AssetBuy = 'discover_token_detail_buy', // Tapped Buy on a token detail
    AssetSell = 'discover_token_detail_sell', // Tapped Sell on a token detail
    DappDetail = 'discover_dapps_visit_pages', // Visited a dapp page (dapp url, opt. name)
}

export interface DiscoverRequiredPayloads {
    [DiscoverEvent.Search]: {
        [Key.AssetId]: string
        [Key.Query]?: string
    }
    [DiscoverEvent.DappDetail]: {
        [Key.DappUrl]: string
        [Key.DappName]?: string
    }
}
