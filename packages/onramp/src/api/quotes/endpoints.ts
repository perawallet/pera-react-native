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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    resolveRouterErrorBody,
    routerAccountId,
    routerRequest,
    type RouterErrorBody,
} from '@perawallet/wallet-core-swaps'

import { RampAmountOutOfRangeError, type RampQuoteLimits } from '../../errors'
import type { RampQuote, RampToken } from '../../models'
import { caip2OfRouterAsset, toBaseUnitString } from '../router-asset'
import { createRampQuoteResponseSchema } from './schema'
import { transformRampOffer } from './transformers'

export type CreateRampQuoteParams = {
    sourceToken: Pick<RampToken, 'id' | 'kind' | 'fractionDecimals'>
    destinationToken: Pick<RampToken, 'id' | 'fractionDecimals'>
    /** Display units. */
    sourceAmount: Decimal
    destinationAddress: string
    countryCode: Nullable<string>
    /** Where a deposit is returned to; sent for a deposit source only. */
    refundAddress: Nullable<string>
}

const toLimit = (
    baseUnits: Maybe<string>,
    decimals: number,
): Nullable<Decimal> =>
    baseUnits === null || baseUnits === undefined
        ? null
        : baseUnitsToDisplayUnits(baseUnits, decimals)

const toAmountOutOfRange = (
    body: RouterErrorBody,
    decimals: number,
): Nullable<RampAmountOutOfRangeError> => {
    if (body.code !== 'amount_too_low' && body.code !== 'amount_too_high') {
        return null
    }
    const limits: RampQuoteLimits = {
        min: toLimit(body.source_amount_minimum, decimals),
        max: toLimit(body.source_amount_maximum, decimals),
    }
    return new RampAmountOutOfRangeError(
        body.code === 'amount_too_low' ? 'min' : 'max',
        limits,
        body.error,
    )
}

/**
 * Offers best first. An amount the router refuses as too low or too high
 * throws `RampAmountOutOfRangeError`; any other error is rethrown unchanged.
 */
export const createRampQuote = async (
    params: CreateRampQuoteParams,
    scope: ChainScope,
): Promise<RampQuote[]> => {
    const { sourceToken, destinationToken } = params
    const sendsRefundAccount =
        sourceToken.kind === 'deposit' && params.refundAddress !== null
    let data: unknown
    try {
        data = await routerRequest({
            scope,
            method: 'POST',
            path: 'quotes/',
            data: {
                source_asset_id: sourceToken.id,
                destination_asset_id: destinationToken.id,
                source_amount: toBaseUnitString(
                    params.sourceAmount,
                    sourceToken.fractionDecimals,
                ),
                destination_account: routerAccountId(
                    scope,
                    params.destinationAddress,
                ),
                ...(params.countryCode === null
                    ? {}
                    : { country: params.countryCode }),
                ...(sendsRefundAccount
                    ? {
                          source_account: `${caip2OfRouterAsset(sourceToken.id)}:${params.refundAddress}`,
                      }
                    : {}),
            },
        })
    } catch (error) {
        const body = resolveRouterErrorBody(error)
        const outOfRange =
            body === null
                ? null
                : toAmountOutOfRange(body, sourceToken.fractionDecimals)
        throw outOfRange ?? error
    }

    const parsed = createRampQuoteResponseSchema.parse(data)
    return parsed.results.flatMap(offer => {
        const quote = transformRampOffer(offer, {
            source: sourceToken.fractionDecimals,
            destination: destinationToken.fractionDecimals,
        })
        return quote === null ? [] : [quote]
    })
}
