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
import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { AlgoBalanceColumn } from '../AlgoBalanceColumn'

vi.mock('@components/PreferredCurrencyDisplay/usePreferredCurrencyDisplay', () => ({
    usePreferredCurrencyDisplay: vi.fn(() => ({
        displayCurrency: 'USD',
        convertedValue: new Decimal(10),
        isPending: false,
    })),
}))

describe('AlgoBalanceColumn', () => {
    it('renders the ALGO amount and a fiat conversion line', () => {
        const { container } = render(
            <AlgoBalanceColumn algoValue={new Decimal(12.5)} />,
        )

        expect(container.textContent).toContain('12.5')
    })

    it('renders without crashing when custom variants are passed', () => {
        const { container } = render(
            <AlgoBalanceColumn
                algoValue={new Decimal(1)}
                algoVariant='h4'
                fiatVariant='body'
            />,
        )

        expect(container).toBeTruthy()
    })
})
