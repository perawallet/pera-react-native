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
import NumberPad from '../NumberPad'

describe('NumberPad', () => {
    it('renders keys', () => {
        const onPress = vi.fn()
        render(<NumberPad onPress={onPress} />)
        expect(screen.getByText('1')).toBeTruthy()
        expect(screen.getByText('9')).toBeTruthy()
        expect(screen.getByText('0')).toBeTruthy()
    })

    it('calls onPress when key is pressed', () => {
        const onPress = vi.fn()
        render(<NumberPad onPress={onPress} />)
        fireEvent.click(screen.getByText('5'))
        expect(onPress).toHaveBeenCalledWith('5')
    })
})
