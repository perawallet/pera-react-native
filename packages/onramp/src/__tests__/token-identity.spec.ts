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

import { beforeEach, describe, expect, it } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'

import type { RampPair, RampToken } from '../models'
import {
    isOfferedRampPair,
    rampTokenAsset,
    rampTokenChainId,
} from '../token-identity'
import { registerFakeChain } from './fakeChains'
import { registerFakeRampAdapters } from './fakeRampAdapter'

const ALGORAND_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const ETHEREUM_CAIP2 = 'eip155:1'

const ALGORAND_MAINNET: ChainScope = {
    chainId: 'algorand',
    networkId: 'mainnet',
}
const ETHEREUM_MAINNET: ChainScope = {
    chainId: 'ethereum',
    networkId: 'mainnet',
}

const token = (id: string, networkId: string, caip19?: string): RampToken => ({
    id,
    symbol: id,
    name: id,
    fractionDecimals: 6,
    logo: null,
    network: { id: networkId, name: networkId, logo: null },
    priceInUsd: null,
    caip19,
})

const pairFrom = (sourceToken: RampToken): RampPair => ({
    id: `pair-${sourceToken.id}`,
    sourceToken,
    destinationToken: token('ALGO', 'ALGORAND'),
    provider: { id: 'xo', paymentTypes: [], limits: null },
})

const ALGO = token('ALGO', 'ALGORAND', `${ALGORAND_CAIP2}/slip44:283`)
const USDC_ALGORAND = token(
    'USDC_ALGORAND',
    'ALGORAND',
    `${ALGORAND_CAIP2}/asa:31566704`,
)
const ETH = token('ETH', 'ETHEREUM', `${ETHEREUM_CAIP2}/slip44:60`)
const USDC_ETHEREUM = token(
    'USDC',
    'ETHEREUM',
    `${ETHEREUM_CAIP2}/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
)
const BTC = token(
    'BTC',
    'BITCOIN',
    'bip122:000000000019d6689c085ae165831e93/slip44:0',
)
const EUR = token('EUR', 'FIAT', 'swift:0/iso4217:EUR')

// Each fake reads the asset reference back out of the token's CAIP-19 id.
const referenceOf = (caip19: string | undefined) =>
    caip19?.split(':').at(-1) ?? null

describe('ramp token identity', () => {
    beforeEach(() => {
        getProvider().chains.reset()
        registerFakeChain({ chainId: 'algorand', caip2: ALGORAND_CAIP2 })
        registerFakeChain({ chainId: 'ethereum', caip2: ETHEREUM_CAIP2 })
        registerFakeRampAdapters(
            {
                chainId: 'algorand',
                rampNetworkIds: ['ALGORAND'],
                isNativeToken: t => t.id === 'ALGO',
                toAssetId: t => (t.id === 'ALGO' ? '0' : referenceOf(t.caip19)),
            },
            {
                chainId: 'ethereum',
                rampNetworkIds: ['ETHEREUM'],
                isNativeToken: t => t.id === 'ETH',
                toAssetId: t =>
                    t.id === 'ETH' ? 'native' : referenceOf(t.caip19),
            },
        )
    })

    describe('rampTokenAsset', () => {
        it('maps a native and a non-native token on each chain', () => {
            expect(rampTokenAsset(ALGO, ALGORAND_MAINNET)).toEqual({
                chainId: 'algorand',
                assetId: '0',
                isNative: true,
            })
            expect(rampTokenAsset(USDC_ALGORAND, ALGORAND_MAINNET)).toEqual({
                chainId: 'algorand',
                assetId: '31566704',
                isNative: false,
            })
            expect(rampTokenAsset(ETH, ETHEREUM_MAINNET)).toEqual({
                chainId: 'ethereum',
                assetId: 'native',
                isNative: true,
            })
            expect(rampTokenAsset(USDC_ETHEREUM, ETHEREUM_MAINNET)).toEqual({
                chainId: 'ethereum',
                assetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                isNative: false,
            })
        })

        it("is null for another chain's token", () => {
            expect(rampTokenAsset(ETH, ALGORAND_MAINNET)).toBeNull()
            expect(rampTokenAsset(ALGO, ETHEREUM_MAINNET)).toBeNull()
        })

        it('is null for a token on no wallet chain', () => {
            expect(rampTokenAsset(BTC, ALGORAND_MAINNET)).toBeNull()
            expect(rampTokenAsset(EUR, ALGORAND_MAINNET)).toBeNull()
        })

        it('is null when the adapter places no asset on the network', () => {
            const unknown = token('UNKNOWN', 'ALGORAND')

            expect(rampTokenAsset(unknown, ALGORAND_MAINNET)).toBeNull()
        })
    })

    describe('rampTokenChainId', () => {
        it('reads the chain from the CAIP-19 id over the ramp network', () => {
            const mislabelled = token('ETH', 'ALGORAND', ETH.caip19)

            expect(rampTokenChainId(mislabelled)).toBe('ethereum')
        })

        it('falls back to the ramp network without a CAIP-19 id', () => {
            expect(rampTokenChainId(token('ALGO', 'ALGORAND'))).toBe('algorand')
            expect(rampTokenChainId(token('ETH', 'ETHEREUM'))).toBe('ethereum')
            expect(rampTokenChainId(token('BTC', 'BITCOIN'))).toBeNull()
        })

        it('is null for a CAIP-19 id on a chain the wallet does not run', () => {
            expect(rampTokenChainId(BTC)).toBeNull()
            expect(rampTokenChainId(EUR)).toBeNull()
        })
    })

    describe('isOfferedRampPair', () => {
        it('offers fiat and crypto from chains the wallet does not run', () => {
            expect(isOfferedRampPair(pairFrom(EUR))).toBe(true)
            expect(isOfferedRampPair(pairFrom(BTC))).toBe(true)
        })

        it('does not offer crypto from a chain the wallet runs', () => {
            expect(isOfferedRampPair(pairFrom(ETH))).toBe(false)
            expect(isOfferedRampPair(pairFrom(USDC_ALGORAND))).toBe(false)
        })

        it('offers it again once the chain is no longer registered', () => {
            getProvider().chains.reset()
            registerFakeChain({ chainId: 'algorand', caip2: ALGORAND_CAIP2 })

            expect(isOfferedRampPair(pairFrom(ETH))).toBe(true)
        })

        it('offers crypto from a chain switched off remotely', () => {
            getProvider().chains.setCapabilityOverrides(() => ({
                chainEnabled: { ethereum: false },
            }))

            expect(isOfferedRampPair(pairFrom(ETH))).toBe(true)
            expect(isOfferedRampPair(pairFrom(USDC_ALGORAND))).toBe(false)
        })
    })
})
