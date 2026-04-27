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
import { describe, it, expect } from 'vitest'
import { NumberedList } from '../NumberedList'

describe('NumberedList', () => {
    it('renders one row per item with a 1-based bullet number', () => {
        render(<NumberedList items={['Alpha', 'Beta', 'Gamma']} />)

        expect(screen.getByText('Alpha')).toBeTruthy()
        expect(screen.getByText('Beta')).toBeTruthy()
        expect(screen.getByText('Gamma')).toBeTruthy()
        expect(screen.getByText('1')).toBeTruthy()
        expect(screen.getByText('2')).toBeTruthy()
        expect(screen.getByText('3')).toBeTruthy()
    })

    it('renders an empty container when items is empty', () => {
        render(<NumberedList items={[]} />)

        expect(screen.queryByText('1')).toBeNull()
        expect(screen.getByTestId('numbered-list')).toBeTruthy()
    })

    it('honors a custom testID', () => {
        render(
            <NumberedList
                items={['x']}
                testID='expectations-list'
            />,
        )

        expect(screen.getByTestId('expectations-list')).toBeTruthy()
    })
})
