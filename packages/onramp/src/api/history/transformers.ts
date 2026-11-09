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

import type { Decimal } from 'decimal.js'
import {
    baseUnitsToDisplayUnits,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'

import type { RampHistoryItem, RampToken } from '../../models'
import { buildRampPair } from '../../utils'
import {
    addressOfRouterAccount,
    knownFractionDecimalsOf,
    QUOTE_KIND_BY_FUNDING_METHOD,
    toRampToken,
    type RampAssetItem,
} from '../router-asset'
import type { RampHistoryItemApiResponse } from './schema'

// What a legacy order that names no asset renders as.
const PLACEHOLDER_TOKEN: RampToken = {
    id: '',
    kind: 'token',
    symbol: '',
    name: '',
    fractionDecimals: 0,
    logo: null,
    network: { name: '', logo: null },
}

// A `wallet_transaction` order is a Swap; Fund lists the others, and an order
// with no funding method is a legacy Fund order.
const WALLET_FUNDING_METHOD = 'wallet_transaction'

export const isFundHistoryItem = (item: RampHistoryItemApiResponse): boolean =>
    item.funding_method !== WALLET_FUNDING_METHOD

const toAmount = (
    baseUnits: Maybe<string>,
    asset: Maybe<RampAssetItem>,
): Nullable<Decimal> => {
    if (baseUnits === null || baseUnits === undefined) return null
    if (asset === null || asset === undefined) return null
    const decimals = knownFractionDecimalsOf(asset)
    return decimals === null
        ? null
        : baseUnitsToDisplayUnits(baseUnits, decimals)
}

export const transformRampHistoryItem = (
    item: RampHistoryItemApiResponse,
): RampHistoryItem => ({
    id: item.order_id,
    kind:
        item.funding_method === null || item.funding_method === undefined
            ? null
            : (QUOTE_KIND_BY_FUNDING_METHOD[item.funding_method] ?? null),
    status: item.status,
    creationDatetime: item.created_at,
    provider: item.provider ?? '',
    pair: buildRampPair(
        item.source_asset ? toRampToken(item.source_asset) : PLACEHOLDER_TOKEN,
        item.destination_asset
            ? toRampToken(item.destination_asset)
            : PLACEHOLDER_TOKEN,
    ),
    sourceAmount: toAmount(item.source_amount, item.source_asset),
    destinationAmount: toAmount(
        item.destination_amount_received ?? item.destination_amount_expected,
        item.destination_asset,
    ),
    ...(item.destination_account
        ? { toAddress: addressOfRouterAccount(item.destination_account) }
        : {}),
})
