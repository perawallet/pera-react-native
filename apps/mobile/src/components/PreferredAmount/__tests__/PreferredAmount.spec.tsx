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
import { PreferredAmount } from '../PreferredAmount'

// Spy on the child so we can assert which precision variant this component
// selects, independent of locale formatting and digit-count policy (which
// lives in resolvePrecision).
vi.mock('@components/CurrencyAmount', () => ({
    CurrencyAmount: vi.fn(() => null),
}))

const mockUsePreferredAmount = vi.hoisted(() => vi.fn())

vi.mock('../usePreferredAmount', () => ({
    usePreferredAmount: mockUsePreferredAmount,
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({ preferredCurrency: 'USD' }),
}))

const lastChildProps = () =>
    vi.mocked(CurrencyAmount).mock.calls.at(-1)?.[0] as
        | {
              precision?: string
              currency?: string
              value?: Decimal
              isLoading?: boolean
          }
        | undefined

describe('PreferredAmount preferred-currency precision policy', () => {
    beforeEach(() => {
        vi.mocked(CurrencyAmount).mockClear()
        mockUsePreferredAmount.mockReturnValue({
            displayCurrency: 'USD',
            convertedValue: new Decimal('1.23456'),
            isPending: false,
        })
    })

    it("defaults to 'detailed', selecting the preferredFull precision variant", () => {
        render(
            <PreferredAmount
                sourceAmount={new Decimal(1)}
                sourceAssetId='0'
            />,
        )
        expect(lastChildProps()).toMatchObject({ precision: 'preferredFull' })
    })

    it("density='compact' selects the compact precision variant", () => {
        render(
            <PreferredAmount
                sourceAmount={new Decimal(1)}
                sourceAssetId='0'
                density='compact'
            />,
        )
        expect(lastChildProps()).toMatchObject({ precision: 'compact' })
    })

    it('renders a precomputed value in the preferred currency without converting', () => {
        render(<PreferredAmount value={new Decimal('12.34')} />)
        const props = lastChildProps()
        // The precomputed value (not the conversion hook's 1.23456) proves the
        // no-conversion path ran; currency comes from the preferred currency.
        expect(props?.value?.toString()).toBe('12.34')
        expect(props?.currency).toBe('USD')
        expect(props?.precision).toBe('preferredFull')
    })

    it("precomputed value honors density='compact'", () => {
        render(
            <PreferredAmount
                value={new Decimal('12.34')}
                density='compact'
            />,
        )
        expect(lastChildProps()).toMatchObject({ precision: 'compact' })
    })

    it('reflects the pending conversion as isLoading even when the caller passes isLoading={false}', () => {
        mockUsePreferredAmount.mockReturnValue({
            displayCurrency: 'USD',
            convertedValue: null,
            isPending: true,
        })

        render(
            <PreferredAmount
                sourceAmount={new Decimal(1)}
                sourceAssetId='0'
                isLoading={false}
            />,
        )

        expect(lastChildProps()).toMatchObject({ isLoading: true })
    })
})
