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

import type {
    RampNetwork,
    RampPair,
    RampProvider,
    RampToken,
} from '../../models'
import type {
    RampNetworkApiResponse,
    RampPairApiResponse,
    RampProviderApiResponse,
    RampTokenApiResponse,
} from './schema'

const transformRampNetwork = (data: RampNetworkApiResponse): RampNetwork => ({
    id: data.id,
    name: data.name,
    logo: data.logo,
})

const transformRampToken = (data: RampTokenApiResponse): RampToken => ({
    id: data.id,
    symbol: data.symbol,
    name: data.name,
    fractionDecimals: data.fraction_decimals,
    logo: data.logo,
    network: transformRampNetwork(data.network),
    priceInUsd:
        data.price_in_usd === null ? null : new Decimal(data.price_in_usd),
    countryCode: data.extra.country_code,
})

const transformRampProvider = (
    data: RampProviderApiResponse,
): RampProvider => ({
    id: data.id,
    paymentTypes: data.payment_types,
    limits:
        data.limits === null
            ? null
            : {
                  minSourceAmount: new Decimal(data.limits.min_source_amount),
                  maxSourceAmount: new Decimal(data.limits.max_source_amount),
              },
})

export const transformRampPair = (data: RampPairApiResponse): RampPair => ({
    id: data.id,
    sourceToken: transformRampToken(data.source_token),
    destinationToken: transformRampToken(data.destination_token),
    provider: transformRampProvider(data.provider),
})
