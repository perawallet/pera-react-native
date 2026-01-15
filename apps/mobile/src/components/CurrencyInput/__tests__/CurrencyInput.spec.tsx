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
import { describe, it, expect, vi } from 'vitest'
import { CurrencyInput } from '../CurrencyInput'

// Mock react-native-advanced-input-mask
vi.mock('react-native-advanced-input-mask', async () => {
    const React = await import('react')
    return {
        MaskedTextInput: (props: Record<string, unknown>) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'currency-input',
            }),
    }
})

describe('CurrencyInput', () => {
    it('renders correctly', () => {
        render(
            <CurrencyInput
                minPrecision={2}
                maxPrecision={6}
            />,
        )
        expect(screen.getByTestId('currency-input')).toBeTruthy()
    })
})
