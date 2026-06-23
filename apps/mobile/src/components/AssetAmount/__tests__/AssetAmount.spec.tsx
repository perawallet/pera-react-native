/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { Decimal } from 'decimal.js'
import { AssetAmount } from '../AssetAmount'

// Spy on the child to assert what AssetAmount derives from the asset, without
// depending on locale formatting.
vi.mock('@components/CurrencyAmount', () => ({
    CurrencyAmount: vi.fn(() => null),
}))

const lastChildProps = () =>
    vi.mocked(CurrencyAmount).mock.calls.at(-1)?.[0] as
        | {
              currency?: string
              precision?: string
              assetDecimals?: number
              showSymbol?: boolean
              variant?: string
          }
        | undefined

describe('AssetAmount', () => {
    beforeEach(() => vi.mocked(CurrencyAmount).mockClear())

    it('derives the unit and decimals from the asset and renders at assetFull precision', () => {
        render(
            <AssetAmount
                asset={{ assetId: '123', unitName: 'USDC', decimals: 6 }}
                value={new Decimal('1.5')}
            />,
        )
        expect(lastChildProps()).toMatchObject({
            currency: 'USDC',
            precision: 'assetFull',
            assetDecimals: 6,
        })
    })

    it("density='compact' renders a fixed 2dp (compact) and omits assetDecimals", () => {
        render(
            <AssetAmount
                asset={{ assetId: '123', unitName: 'USDC', decimals: 6 }}
                value={new Decimal('1.5')}
                density='compact'
            />,
        )
        expect(lastChildProps()).toMatchObject({
            currency: 'USDC',
            precision: 'compact',
        })
        expect(lastChildProps()?.assetDecimals).toBeUndefined()
    })

    it("passes the 'ALGO' unit (glyph sentinel) and 6 decimals for Algo", () => {
        render(
            <AssetAmount
                asset={{ assetId: '0', unitName: 'ALGO', decimals: 6 }}
                value={new Decimal('1.5')}
            />,
        )
        expect(lastChildProps()).toMatchObject({
            currency: 'ALGO',
            assetDecimals: 6,
        })
    })

    it('falls back to an empty unit and undefined decimals when the asset is missing', () => {
        render(
            <AssetAmount
                asset={undefined}
                value={new Decimal('1.5')}
            />,
        )
        expect(lastChildProps()).toMatchObject({
            currency: '',
            precision: 'assetFull',
            assetDecimals: undefined,
        })
    })

    it('forwards display props through to CurrencyAmount', () => {
        render(
            <AssetAmount
                asset={{ assetId: '1', unitName: 'X', decimals: 2 }}
                value={new Decimal('1')}
                showSymbol
                variant='h3'
            />,
        )
        expect(lastChildProps()).toMatchObject({
            showSymbol: true,
            variant: 'h3',
        })
    })
})
