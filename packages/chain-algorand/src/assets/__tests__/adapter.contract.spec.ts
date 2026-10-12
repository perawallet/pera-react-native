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

import { Decimal } from 'decimal.js'
import { assetPriceContractTests } from '@perawallet/wallet-core-assets/testing/adapter-contract'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { mockAssetPrices } from '../../pricing/msw-handlers'
import { mockPublicAssetDetails } from '../api/msw-handlers'
import { algorandAssetsAdapter } from '../adapter'

assetPriceContractTests(
    () => algorandAssetsAdapter,
    {
        scope: { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' },
        priced: {
            assetRef: { chainId: ALGORAND_CHAIN_ID, assetId: '31566704' },
            usdPrice: new Decimal('1.0001'),
        },
        unpriced: { chainId: ALGORAND_CHAIN_ID, assetId: '386192725' },
        nativeUsdPrice: new Decimal('0.25'),
        handlers: [
            mockPublicAssetDetails({
                assetID: '0',
                response: {
                    asset_id: 0,
                    name: 'Algo',
                    unit_name: 'ALGO',
                    fraction_decimals: 6,
                    total_supply: 10000000000,
                    total_supply_as_str: '10000000000',
                    verification_tier: 'verified',
                    is_collectible: false,
                    usd_value: '0.25',
                },
            }),
            mockAssetPrices({
                response: [
                    { asset_id: '31566704', price: '1.0001', currency: 'USD' },
                    { asset_id: '386192725', price: null, currency: 'USD' },
                ],
            }),
        ],
    },
    'algorand',
)
