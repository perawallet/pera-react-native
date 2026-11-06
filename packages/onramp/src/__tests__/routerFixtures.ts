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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'

import type { RampAssetItem } from '../api/router-asset'
import type { RampHistoryItemInput } from '../api/history/schema'
import type { RampOfferApiResponse } from '../api/quotes/schema'
import type { RampPairRowApiResponse } from '../api/pairs/schema'
import { registerFakeChain } from './fakeChains'

export const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
export const FAKE_CAIP2 = 'fake:a'
export const ACCOUNT = 'ADDRESS'
export const ROUTER_ACCOUNT = `${FAKE_CAIP2}:${ACCOUNT}`

export const registerRouterChain = (): void => {
    getProvider().chains.reset()
    registerFakeChain({ chainId: SCOPE.chainId, caip2: FAKE_CAIP2 })
}

export const NATIVE_ID = `${FAKE_CAIP2}/asset:0`
export const STABLE_ID = `${FAKE_CAIP2}/asset:42`
export const FIAT_ID = 'swift:0/iso4217:EUR'
export const COIN_ID = 'other:1/coin:0'

export const nativeAsset = (
    overrides: Partial<RampAssetItem> = {},
): RampAssetItem => ({
    asset_id: NATIVE_ID,
    name: 'Native',
    unit_name: 'NAT',
    fraction_decimals: 6,
    logo: null,
    ...overrides,
})

export const stableAsset = (
    overrides: Partial<RampAssetItem> = {},
): RampAssetItem => ({
    asset_id: STABLE_ID,
    name: 'Stable',
    unit_name: 'STB',
    fraction_decimals: 6,
    logo: 'https://logo/stb.png',
    ...overrides,
})

export const fiatAsset = (
    overrides: Partial<RampAssetItem> = {},
): RampAssetItem => ({
    asset_id: FIAT_ID,
    name: 'Euro',
    unit_name: 'EUR',
    fraction_decimals: 2,
    ...overrides,
})

export const coinAsset = (
    overrides: Partial<RampAssetItem> = {},
): RampAssetItem => ({
    asset_id: COIN_ID,
    name: 'Coin',
    unit_name: 'COIN',
    fraction_decimals: 8,
    chain: 'Other Chain',
    ...overrides,
})

export const pairRow = (
    asset: RampAssetItem,
    overrides: Partial<RampPairRowApiResponse> = {},
): RampPairRowApiResponse => ({
    kind: 'token',
    asset,
    aggregator: 'meld',
    funding_method: 'provider_checkout',
    ...overrides,
})

export const meldOffer = (
    overrides: Partial<RampOfferApiResponse> = {},
): RampOfferApiResponse => ({
    quote_id: 'quote-1',
    aggregator: 'meld',
    provider: 'BANXA',
    source_asset: fiatAsset(),
    destination_asset: stableAsset(),
    source_amount: '60000',
    destination_amount_expected: '999500000',
    destination_amount_minimum: null,
    source_amount_usd_value: '600',
    destination_amount_usd_value: '480',
    funding_method: 'provider_checkout',
    expires_at: null,
    extras: { payment_method: 'CREDIT_DEBIT_CARD' },
    ...overrides,
})

export const depositOffer = (
    overrides: Partial<RampOfferApiResponse> = {},
): RampOfferApiResponse =>
    meldOffer({
        quote_id: 'quote-xo',
        aggregator: 'xo',
        provider: 'XO',
        source_asset: coinAsset(),
        source_amount: '50000000',
        destination_amount_expected: '950500000',
        funding_method: 'external_deposit',
        extras: null,
        ...overrides,
    })

export const historyItem = (
    overrides: Partial<RampHistoryItemInput> = {},
): RampHistoryItemInput => ({
    order_id: 'order-1',
    aggregator: 'meld',
    provider: 'BANXA',
    status: 'completed',
    funding_method: 'provider_checkout',
    source_account: null,
    destination_account: ROUTER_ACCOUNT,
    source_asset: fiatAsset(),
    destination_asset: stableAsset(),
    source_amount: '60000',
    destination_amount_expected: '999500000',
    destination_amount_minimum: null,
    destination_amount_received: null,
    source_amount_usd_value: null,
    destination_amount_usd_value: null,
    created_at: '2025-06-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    expires_at: null,
    ...overrides,
})
