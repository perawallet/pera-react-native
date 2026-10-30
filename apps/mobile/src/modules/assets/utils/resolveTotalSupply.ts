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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type {
    AssetDisplayParams,
    AssetSupplyDisplay,
} from '../types/asset-details-display'

// A zero supply is how a source with no figure reads, so it shows as unknown.
export const resolveTotalSupply = ({
    asset,
}: AssetDisplayParams): AssetSupplyDisplay => ({
    labelKey: i18nKey('asset_details.markets.total_supply'),
    infoBodyKey: i18nKey('asset_details.markets.total_supply_info_body'),
    amount: asset.totalSupply.isZero() ? null : asset.totalSupply,
})
