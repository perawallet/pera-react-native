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

import React from 'react'
import { render, screen } from '@test-utils/render'
import { PWText } from '../../PWText'
import { PWToolbar } from '../PWToolbar'

describe('PWToolbar', () => {
    it('renders left, center and right content', () => {
        render(
            <PWToolbar
                left={<PWText>Left</PWText>}
                center={<PWText>Center</PWText>}
                right={<PWText>Right</PWText>}
            />,
        )

        expect(screen.getByText('Left')).toBeTruthy()
        expect(screen.getByText('Center')).toBeTruthy()
        expect(screen.getByText('Right')).toBeTruthy()
    })

    it('always renders three child containers even if props are missing', () => {
        const { container } = render(<PWToolbar testID='toolbar' />)

        expect(container.querySelector('[testid="toolbar-left"]')).toBeTruthy()
        expect(
            container.querySelector('[testid="toolbar-center"]'),
        ).toBeTruthy()
        expect(container.querySelector('[testid="toolbar-right"]')).toBeTruthy()
    })

    it('renders correctly with only center prop', () => {
        const { container } = render(
            <PWToolbar
                center={<PWText>Center Only</PWText>}
                testID='toolbar'
            />,
        )

        expect(screen.getByText('Center Only')).toBeTruthy()
        expect(container.querySelector('[testid="toolbar-left"]')).toBeTruthy()
        expect(container.querySelector('[testid="toolbar-right"]')).toBeTruthy()
    })
})
