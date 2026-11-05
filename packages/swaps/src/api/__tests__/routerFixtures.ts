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

import type { z } from 'zod'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fakeRouterAssetId } from '../../__tests__/fakeRouterChains'
import type { SwapAssetItemApiResponse } from '../assets/schema'
import type { swapOrderItemSchema } from '../orders/schema'
import type { SwapOfferApiResponse } from '../quotes/schema'

export const SCOPE_A = { chainId: 'algorand', networkId: 'mainnet' } as const
export const SCOPE_A_TEST = {
    chainId: 'algorand',
    networkId: 'testnet',
} as const
export const SCOPE_B = { chainId: 'ethereum', networkId: 'mainnet' } as const

export const routerAsset = (
    scope: ChainScope,
    assetId: string,
    overrides: Partial<SwapAssetItemApiResponse> = {},
): SwapAssetItemApiResponse => ({
    asset_id: fakeRouterAssetId(scope, assetId),
    name: `Asset ${assetId}`,
    unit_name: `A${assetId}`,
    fraction_decimals: 6,
    logo: null,
    verification_tier: 'verified',
    cross_chain_asset_group: null,
    ...overrides,
})

export const routerOffer = (
    overrides: Partial<SwapOfferApiResponse> = {},
): SwapOfferApiResponse => ({
    quote_id: 'quote-1',
    aggregator: 'agg',
    provider: 'provider-x',
    source_asset: routerAsset(SCOPE_A, 'native'),
    destination_asset: routerAsset(SCOPE_A, '31566704'),
    source_amount: '5000000',
    destination_amount_expected: '1200000',
    destination_amount_minimum: '1194000',
    source_amount_usd_value: '1.10',
    destination_amount_usd_value: '1.09',
    fees: [],
    funding_method: 'wallet',
    expires_at: null,
    extras: null,
    ...overrides,
})

export const routerOrderItem = (
    overrides: Partial<z.input<typeof swapOrderItemSchema>> = {},
): z.input<typeof swapOrderItemSchema> => ({
    order_id: 'order-1',
    aggregator: 'agg',
    provider: 'provider-x',
    status: 'completed',
    funding_method: 'wallet',
    source_account: 'fake-a:main:SENDER',
    destination_account: 'fake-a:main:SENDER',
    source_asset: routerAsset(SCOPE_A, 'native'),
    destination_asset: routerAsset(SCOPE_A, '31566704'),
    source_amount: '5000000',
    destination_amount_expected: '1200000',
    destination_amount_minimum: '1194000',
    destination_amount_received: null,
    source_amount_usd_value: '1.10',
    destination_amount_usd_value: '1.09',
    transactions: [],
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:01:00Z',
    expires_at: null,
    ...overrides,
})
