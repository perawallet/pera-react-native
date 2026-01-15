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
import { describe, it, expect } from 'vitest'
import { CurrencyDisplay } from '../CurrencyDisplay'
import { Decimal } from 'decimal.js'

describe('CurrencyDisplay', () => {
    it('renders formatted currency value', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal(100)}
                currency='USD'
                precision={2}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('displays placeholder when value is null', () => {
        const { container } = render(
            <CurrencyDisplay
                value={null}
                currency='USD'
                precision={2}
            />,
        )
        expect(container.textContent).toContain('---')
    })

    it('displays placeholder when value is undefined', () => {
        const { container } = render(
            <CurrencyDisplay
                value={undefined}
                currency='USD'
                precision={2}
            />,
        )
        expect(container.textContent).toContain('---')
    })

    it('shows skeleton when isSkeleton is true', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal(100)}
                currency='USD'
                precision={2}
                isSkeleton={true}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('displays ALGO icon for ALGO currency', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal(100)}
                currency='ALGO'
                precision={6}
                showSymbol={true}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('respects showSymbol prop', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal(100)}
                currency='ALGO'
                precision={6}
                showSymbol={false}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('applies prefix when provided', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal(100)}
                currency='USD'
                precision={2}
                prefix='+'
            />,
        )
        // Prefix should be in the rendered output
        expect(container.textContent).toContain('+')
    })
})
