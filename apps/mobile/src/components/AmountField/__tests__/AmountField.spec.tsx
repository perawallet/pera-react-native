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

import { render, screen } from '@test-utils/render'
import { PWText } from '@components/core'
import { AmountField } from '../AmountField'

const renderField = (
    props?: Partial<React.ComponentProps<typeof AmountField>>,
) =>
    render(
        <AmountField
            variant='plain'
            label='You pay'
            amountSize='h1'
            amount={<PWText>123.45</PWText>}
            selector={<PWText>USDC</PWText>}
            fiat={<PWText>$123.45</PWText>}
            {...props}
        />,
    )

describe('AmountField', () => {
    it('renders the label and every slot', () => {
        renderField()

        expect(screen.getByText('You pay')).toBeTruthy()
        expect(screen.getByText('123.45')).toBeTruthy()
        expect(screen.getByText('USDC')).toBeTruthy()
        expect(screen.getByText('$123.45')).toBeTruthy()
    })

    it('renders header trailing content when provided', () => {
        renderField({ headerTrailing: <PWText>Balance 5.00</PWText> })

        expect(screen.getByText('Balance 5.00')).toBeTruthy()
    })

    it('omits header trailing content when not provided', () => {
        renderField()

        expect(screen.queryByText('Balance 5.00')).toBeNull()
    })

    it('renders in the card variant', () => {
        renderField({ variant: 'card' })

        expect(screen.getByText('You pay')).toBeTruthy()
    })
})
