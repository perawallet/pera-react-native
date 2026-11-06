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

import type { RampPair, RampToken } from '@perawallet/wallet-core-onramp'

const MAINNET_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

/** Router asset ids (CAIP-19) as the v4 swap router sends them. */
export const ALGO_ROUTER_ID = `${MAINNET_CAIP2}/asa:0`
export const USDC_ROUTER_ID = `${MAINNET_CAIP2}/asa:31566704`
export const USD_ROUTER_ID = 'swift:0/iso4217:USD'
export const EUR_ROUTER_ID = 'swift:0/iso4217:EUR'
export const BTC_ROUTER_ID = 'bip122:000000000019d6689c085ae165831e93/slip44:0'

export const makeRampToken = (
    overrides: Partial<RampToken> = {},
): RampToken => ({
    id: USDC_ROUTER_ID,
    kind: 'token',
    symbol: 'USDC',
    name: 'USD Coin',
    fractionDecimals: 6,
    logo: 'https://example.com/usdc.png',
    network: { name: '', logo: null },
    ...overrides,
})

export const makeAlgoToken = (overrides: Partial<RampToken> = {}): RampToken =>
    makeRampToken({
        id: ALGO_ROUTER_ID,
        symbol: 'ALGO',
        name: 'Algorand',
        logo: null,
        ...overrides,
    })

export const makeFiatToken = (
    symbol = 'USD',
    overrides: Partial<RampToken> = {},
): RampToken =>
    makeRampToken({
        id: `swift:0/iso4217:${symbol}`,
        kind: 'fiat',
        symbol,
        name: symbol,
        fractionDecimals: 2,
        logo: null,
        countryCode: symbol.slice(0, 2),
        ...overrides,
    })

export const makeDepositToken = (
    symbol = 'BTC',
    overrides: Partial<RampToken> = {},
): RampToken =>
    makeRampToken({
        id: BTC_ROUTER_ID,
        kind: 'deposit',
        symbol,
        name: symbol,
        fractionDecimals: 8,
        logo: null,
        network: { name: 'Bitcoin', logo: null },
        ...overrides,
    })

export const makeRampPair = (
    sourceToken: RampToken,
    destinationToken: RampToken,
): RampPair => ({
    id: `${sourceToken.id}|${destinationToken.id}`,
    sourceToken,
    destinationToken,
})
