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

import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { TrendIndicator } from '../TrendIndicator'

describe('TrendIndicator', () => {
    it('renders the up icon for a positive (or zero) change', () => {
        render(<TrendIndicator percentage={new Decimal('12.34')} />)

        expect(screen.getByTestId('trend-indicator-up')).toBeTruthy()
        expect(screen.queryByTestId('trend-indicator-down')).toBeNull()
    })

    it('renders the down icon for a negative change', () => {
        render(<TrendIndicator percentage={new Decimal('-5')} />)

        expect(screen.getByTestId('trend-indicator-down')).toBeTruthy()
        expect(screen.queryByTestId('trend-indicator-up')).toBeNull()
    })

    it('renders the absolute value of the percentage with a percent sign', () => {
        render(<TrendIndicator percentage={new Decimal('-5.5')} />)

        expect(screen.getByText('5.50%')).toBeTruthy()
    })

    it('renders the absolute currency line when provided', () => {
        render(
            <TrendIndicator
                percentage={new Decimal('10')}
                absolute={{ amount: new Decimal('42.5'), currency: 'USD' }}
            />,
        )

        expect(screen.getByText(/42\.5/)).toBeTruthy()
    })

    it('omits the absolute currency line when not provided', () => {
        render(<TrendIndicator percentage={new Decimal('10')} />)

        expect(screen.queryByText(/\$/)).toBeNull()
    })
})
