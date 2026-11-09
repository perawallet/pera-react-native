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

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@test-utils/render'
import { CheckboxRow } from '../CheckboxRow'

describe('CheckboxRow', () => {
    it('shows the label beside the checkbox', () => {
        render(
            <CheckboxRow
                label='I have checked the full address'
                isChecked={false}
                onToggle={vi.fn()}
                testID='acknowledge'
            />,
        )

        expect(screen.getByTestId('acknowledge').textContent).toBe(
            'I have checked the full address',
        )
    })

    it('toggles when the row is pressed', () => {
        const onToggle = vi.fn()
        render(
            <CheckboxRow
                label='Accept'
                isChecked={false}
                onToggle={onToggle}
                testID='acknowledge'
            />,
        )

        fireEvent.click(screen.getByTestId('acknowledge'))

        expect(onToggle).toHaveBeenCalledTimes(1)
    })
})
