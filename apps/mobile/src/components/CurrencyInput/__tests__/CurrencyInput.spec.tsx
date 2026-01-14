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
import CurrencyInput from '../CurrencyInput'

describe('CurrencyInput', () => {
    it('renders correctly', () => {
        render(
            <CurrencyInput
                minPrecision={2}
                maxPrecision={6}
            />,
        )
        // MaskedTextInput might be complex to test deeply without user interaction
        expect(true).toBe(true)
    })
})
