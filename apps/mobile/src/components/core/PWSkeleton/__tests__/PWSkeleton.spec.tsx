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
import { PWView } from '../../PWView'
import { PWSkeleton } from '../PWSkeleton'

describe('PWSkeleton', () => {
    it('renders without crashing by default', () => {
        expect(() => render(<PWSkeleton />)).not.toThrow()
    })

    it('does not wrap a single skeleton in a container', () => {
        render(
            <PWView testID='parent'>
                <PWSkeleton />
            </PWView>,
        )

        const parent = screen.getByTestId('parent')
        expect(parent.childElementCount).toBe(1)
    })

    it('renders N skeletons inside a wrapper when count > 1', () => {
        render(
            <PWView testID='parent'>
                <PWSkeleton count={3} />
            </PWView>,
        )

        const parent = screen.getByTestId('parent')
        expect(parent.childElementCount).toBe(1)

        const wrapper = parent.firstElementChild as HTMLElement
        expect(wrapper.childElementCount).toBe(3)
    })

    it('renders the same number of skeletons regardless of layout direction', () => {
        const { rerender } = render(
            <PWView testID='parent'>
                <PWSkeleton
                    count={4}
                    horizontal
                />
            </PWView>,
        )

        const horizontalCount = (
            screen.getByTestId('parent').firstElementChild as HTMLElement
        ).childElementCount

        rerender(
            <PWView testID='parent'>
                <PWSkeleton count={4} />
            </PWView>,
        )

        const verticalCount = (
            screen.getByTestId('parent').firstElementChild as HTMLElement
        ).childElementCount

        expect(horizontalCount).toBe(4)
        expect(verticalCount).toBe(4)
    })
})
