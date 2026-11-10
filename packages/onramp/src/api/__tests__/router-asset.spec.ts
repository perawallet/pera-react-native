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
import { beforeEach, describe, expect, it } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { registerFakeChain } from '../../__tests__/fakeChains'
import { coinAsset } from '../../__tests__/routerFixtures'
import { isQuotableRampAmount, toRampToken } from '../router-asset'

describe('toRampToken', () => {
    beforeEach(() => {
        getProvider().chains.reset()
        registerFakeChain({
            chainId: 'bsc',
            caip2: 'eip155:56',
            displayName: 'BNB Chain',
        })
    })

    it("names a deposit coin's network as the wallet does when it runs the chain", () => {
        const token = toRampToken(
            coinAsset({
                asset_id: 'eip155:56/erc20:0xusdc',
                chain: 'BSC Chain',
            }),
        )

        expect(token.network).toStrictEqual({
            name: 'BNB Chain',
            logo: null,
            chainId: 'bsc',
        })
    })

    it("keeps the router's label for a chain the wallet doesn't run", () => {
        const token = toRampToken(coinAsset())

        expect(token.network).toStrictEqual({
            name: 'Other Chain',
            logo: null,
        })
    })

    it('gives a token that is not a deposit coin no network', () => {
        const token = toRampToken(
            coinAsset({ asset_id: 'eip155:56/erc20:0xusdc', chain: null }),
        )

        expect(token.network).toStrictEqual({ name: '', logo: null })
    })
})

describe('isQuotableRampAmount', () => {
    it('accepts an amount of at least one base unit', () => {
        expect(isQuotableRampAmount(new Decimal('0.000001'), 6)).toBe(true)
        expect(isQuotableRampAmount(new Decimal('12.5'), 2)).toBe(true)
    })

    it('rejects an amount that floors to zero base units', () => {
        expect(isQuotableRampAmount(new Decimal('0.0000009'), 6)).toBe(false)
        expect(isQuotableRampAmount(new Decimal('0.001'), 2)).toBe(false)
    })

    it('rejects zero and negative amounts', () => {
        expect(isQuotableRampAmount(new Decimal(0), 6)).toBe(false)
        expect(isQuotableRampAmount(new Decimal('-1'), 6)).toBe(false)
    })
})
