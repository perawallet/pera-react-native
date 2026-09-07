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

import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { NumberPad } from '../NumberPad'

// The global setup stubs the @components/core barrel with a guard-less
// <button>, which would let the rapid-repeat test pass even without
// allowRapidPress. Use the real PWTouchableOpacity so it can't; the rest
// stay stubs.
vi.mock('@components/core', async () => {
    const { PWTouchableOpacity } = await vi.importActual<
        typeof import('@components/core/PWTouchableOpacity')
    >('@components/core/PWTouchableOpacity')
    return {
        PWTouchableOpacity,
        PWText: ({ children }: { children?: React.ReactNode }) =>
            React.createElement('span', null, children),
        PWIcon: ({ name }: { name?: string }) =>
            React.createElement('span', { 'data-testid': `icon_${name}` }),
        PWView: ({ children }: { children?: React.ReactNode }) =>
            React.createElement('div', null, children),
    }
})

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

    it('registers rapid repeat presses of the same key', () => {
        const onPress = vi.fn()
        render(<NumberPad onPress={onPress} />)

        fireEvent.click(screen.getByText('0'))
        fireEvent.click(screen.getByText('0'))

        expect(onPress).toHaveBeenCalledTimes(2)
    })

    it('renders the decimal key by default', () => {
        const onPress = vi.fn()
        render(<NumberPad onPress={onPress} />)
        expect(screen.getByText('.')).toBeTruthy()
    })

    it('hides the decimal key when allowDecimal is false', () => {
        const onPress = vi.fn()
        render(
            <NumberPad
                onPress={onPress}
                allowDecimal={false}
            />,
        )
        expect(screen.queryByText('.')).toBeNull()
    })
})
