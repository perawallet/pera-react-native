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
import { z } from 'zod'
import {
    displayUnitsToBaseUnits,
    toBigInt,
    type Optional,
} from '@perawallet/wallet-core-shared'

import { FIAT_MAX_FRACTION_DIGITS } from '../currency-decimals'
import type { RampToken, RampTokenKind } from '../models'

/**
 * The router's asset item. A pair row, an offer and an order item each carry
 * a different subset of it, so every field but the id is optional.
 */
export const rampAssetItemSchema = z.object({
    /** CAIP-19. */
    asset_id: z.string(),
    name: z.string().nullish(),
    unit_name: z.string().nullish(),
    symbol: z.string().nullish(),
    fraction_decimals: z.number().int().min(0).nullish(),
    decimals: z.number().int().min(0).nullish(),
    logo: z.string().nullish(),
    logo_url: z.string().nullish(),
    /** The chain label of a deposit coin. */
    chain: z.string().nullish(),
})

export type RampAssetItem = z.infer<typeof rampAssetItemSchema>

const FIAT_NAMESPACE_PREFIX = 'swift:'
const ISO_4217_CODE = /\/iso4217:([A-Za-z]+)$/

/** A CAIP-19 id is `<caip2>/<namespace>:<reference>`, and a CAIP-2 never contains '/'. */
export const caip2OfRouterAsset = (routerAssetId: string): string =>
    routerAssetId.split('/')[0]

export const isFiatRouterAsset = (routerAssetId: string): boolean =>
    routerAssetId.startsWith(FIAT_NAMESPACE_PREFIX)

/** The address of a CAIP-10 account id (`<caip2>:<address>`); an address never contains ':'. */
export const addressOfRouterAccount = (routerAccountId: string): string =>
    routerAccountId.slice(routerAccountId.lastIndexOf(':') + 1)

const inferKind = (item: RampAssetItem): RampTokenKind => {
    if (isFiatRouterAsset(item.asset_id)) return 'fiat'
    return item.chain ? 'deposit' : 'token'
}

export const fractionDecimalsOf = (
    item: RampAssetItem,
    kind: RampTokenKind = inferKind(item),
): number =>
    item.fraction_decimals ??
    item.decimals ??
    (kind === 'fiat' ? FIAT_MAX_FRACTION_DIGITS : 0)

// ISO 4217 codes lead with the issuing country's ISO 3166 code (EUR -> EU),
// which is what the flag lookup keys on.
const countryCodeOf = (item: RampAssetItem): Optional<string> => {
    const code = ISO_4217_CODE.exec(item.asset_id)?.[1] ?? item.unit_name
    return code && code.length >= 2 ? code.slice(0, 2).toUpperCase() : undefined
}

export const toRampToken = (
    item: RampAssetItem,
    kind: RampTokenKind = inferKind(item),
): RampToken => {
    const symbol = item.unit_name ?? item.symbol ?? ''
    return {
        id: item.asset_id,
        kind,
        symbol,
        name: item.name ?? symbol,
        fractionDecimals: fractionDecimalsOf(item, kind),
        logo: item.logo ?? item.logo_url ?? null,
        network: {
            name: kind === 'deposit' ? (item.chain ?? '') : '',
            logo: null,
        },
        ...(kind === 'fiat' ? { countryCode: countryCodeOf(item) } : {}),
    }
}

/** Floors: a request must never carry more than was entered. */
export const toBaseUnitString = (amount: Decimal, decimals: number): string =>
    toBigInt(displayUnitsToBaseUnits(amount, decimals)).toString()
