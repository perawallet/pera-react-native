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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { CurrencyInput } from '../CurrencyInput'

const { maskedProps } = vi.hoisted(() => ({
    maskedProps: { current: {} as Record<string, unknown> },
}))

vi.mock('react-native-advanced-input-mask', () => ({
    MaskedTextInput: (props: Record<string, unknown>) => {
        maskedProps.current = props
        return null
    },
}))

describe('CurrencyInput', () => {
    it('masks the fraction to the max precision, padding up to the min precision', () => {
        render(
            <CurrencyInput
                minPrecision={2}
                maxPrecision={6}
            />,
        )

        expect(maskedProps.current.mask).toBe(`[0${'9'.repeat(12)}].[999900]`)
    })
})
