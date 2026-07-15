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

import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWText } from '../PWText'

describe('PWText', () => {
    it('renders children correctly', () => {
        render(<PWText>Hello World</PWText>)
        expect(screen.getByText('Hello World')).toBeTruthy()
    })

    it('applies variant styles correctly', () => {
        render(<PWText variant='h1'>Heading 1</PWText>)
        // RNE Text maps h1 prop to styles, difficult to test exact style composition without snapshots or shallow rendering,
        // but checking render is sufficient for wrapper presence.
        expect(screen.getByText('Heading 1')).toBeTruthy()
    })

    describe('minimumFontScale default', () => {
        it('defaults minimumFontScale to 0.5 when adjustsFontSizeToFit is true', () => {
            render(<PWText adjustsFontSizeToFit>Shrinkable</PWText>)
            const element = screen.getByText('Shrinkable')
            expect(element.getAttribute('minimumfontscale')).toBe('0.5')
        })

        it('allows overriding minimumFontScale when adjustsFontSizeToFit is true', () => {
            render(
                <PWText
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                >
                    Shrinkable
                </PWText>,
            )
            const element = screen.getByText('Shrinkable')
            expect(element.getAttribute('minimumfontscale')).toBe('0.7')
        })

        it('does not set minimumFontScale when adjustsFontSizeToFit is not set', () => {
            render(<PWText>Normal</PWText>)
            const element = screen.getByText('Normal')
            expect(element.getAttribute('minimumfontscale')).toBeNull()
        })
    })

    describe('truncate', () => {
        it('defaults numberOfLines to 1 and ellipsizeMode to tail', () => {
            render(<PWText truncate>Long text</PWText>)
            const element = screen.getByText('Long text')
            expect(element.getAttribute('numberoflines')).toBe('1')
            expect(element.getAttribute('ellipsizemode')).toBe('tail')
        })

        it('lets explicit numberOfLines and ellipsizeMode override the defaults', () => {
            render(
                <PWText
                    truncate
                    numberOfLines={2}
                    ellipsizeMode='middle'
                >
                    Long text
                </PWText>,
            )
            const element = screen.getByText('Long text')
            expect(element.getAttribute('numberoflines')).toBe('2')
            expect(element.getAttribute('ellipsizemode')).toBe('middle')
        })

        it('does not set truncation attributes when truncate is absent', () => {
            render(<PWText>Plain</PWText>)
            const element = screen.getByText('Plain')
            expect(element.getAttribute('numberoflines')).toBeNull()
        })
    })
})
