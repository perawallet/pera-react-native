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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWTab } from '../PWTab'

describe('PWTab', () => {
    it('renders correctly', () => {
        const { getByText } = render(
            <PWTab>
                <PWTab.Item title='Tab 1' />
                <PWTab.Item title='Tab 2' />
            </PWTab>,
        )
        expect(getByText('Tab 1')).toBeTruthy()
        expect(getByText('Tab 2')).toBeTruthy()
    })

    it('calls onChange when tab is pressed', () => {
        const onChange = vi.fn()
        const { getByText } = render(
            <PWTab
                onChange={onChange}
                value={0}
            >
                <PWTab.Item title='Tab 1' />
                <PWTab.Item title='Tab 2' />
            </PWTab>,
        )

        fireEvent.click(getByText('Tab 2'))
        expect(onChange).toHaveBeenCalledWith(1)
    })
})
