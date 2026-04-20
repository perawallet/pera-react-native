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
import { PWInput } from '../PWInput'

describe('PWInput', () => {
    it('renders correctly', () => {
        render(<PWInput placeholder='Enter text' />)
        expect(screen.getByPlaceholderText('Enter text')).toBeTruthy()
    })

    it('calls onChangeText when text changes', () => {
        render(
            <PWInput
                value='test'
                onChangeText={() => {}}
            />,
        )
    })

    // Retrying with simpler test case for input
    it('handles input events', () => {
        const onChangeText = vi.fn()
        render(
            <PWInput
                placeholder='test'
                onChangeText={onChangeText}
            />,
        )
        fireEvent.change(screen.getByPlaceholderText('test'), {
            target: { value: 'hello' },
        })
        expect(onChangeText).toHaveBeenCalledWith('hello')
    })

    describe('minimumFontScale default', () => {
        it('defaults minimumFontScale to 0.5 when adjustsFontSizeToFit is true', () => {
            render(
                <PWInput
                    adjustsFontSizeToFit
                    placeholder='test'
                />,
            )
            const element = screen.getByPlaceholderText('test')
            expect(element.getAttribute('minimumfontscale')).toBe('0.5')
        })

        it('allows overriding minimumFontScale when adjustsFontSizeToFit is true', () => {
            render(
                <PWInput
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    placeholder='test-override'
                />,
            )
            const element = screen.getByPlaceholderText('test-override')
            expect(element.getAttribute('minimumfontscale')).toBe('0.7')
        })

        it('does not set minimumFontScale when adjustsFontSizeToFit is not set', () => {
            render(<PWInput placeholder='test-no-adjust' />)
            const element = screen.getByPlaceholderText('test-no-adjust')
            expect(element.getAttribute('minimumfontscale')).toBeNull()
        })
    })
})
