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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { BalanceListItem } from '../BalanceListItem'

vi.mock('@components/PreferredCurrencyDisplay/usePreferredCurrencyDisplay', () => ({
    usePreferredCurrencyDisplay: vi.fn(() => ({
        displayCurrency: 'USD',
        convertedValue: new Decimal(10),
        isPending: false,
    })),
}))

describe('BalanceListItem', () => {
    it('renders the title, subtitle and balance', () => {
        const { container } = render(
            <BalanceListItem
                icon='wallet-with-algo'
                title='Wallet 1'
                subtitle='3 accounts'
                algoValue={new Decimal(42)}
            />,
        )

        expect(screen.getByText('Wallet 1')).toBeTruthy()
        expect(screen.getByText('3 accounts')).toBeTruthy()
        expect(container.textContent).toContain('42')
    })

    it('fires onPress when tapped', () => {
        const handlePress = vi.fn()
        render(
            <BalanceListItem
                icon='wallet-with-algo'
                title='Wallet 1'
                onPress={handlePress}
                testID='balance_list_item'
            />,
        )

        fireEvent.click(screen.getByTestId('balance_list_item'))

        expect(handlePress).toHaveBeenCalledTimes(1)
    })
})
