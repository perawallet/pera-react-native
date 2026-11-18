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

import { describe, it, expect } from 'vitest'
import { PWText } from '@components/core/PWText'
import { render, screen } from '@test-utils/render'
import { PWSheetLayout } from '../PWSheetLayout'
import { PWSheetSizeContext } from '../../PWBottomSheet/sheetSizeContext'

describe('PWSheetLayout', () => {
    it('renders the header above the body', () => {
        render(
            <PWSheetLayout header={<PWText>Header</PWText>}>
                <PWText>Body</PWText>
            </PWSheetLayout>,
        )

        expect(screen.getByText('Header')).toBeTruthy()
        expect(screen.getByText('Body')).toBeTruthy()
    })

    it('renders the body without a header', () => {
        render(
            <PWSheetLayout>
                <PWText>Body</PWText>
            </PWSheetLayout>,
        )

        expect(screen.getByText('Body')).toBeTruthy()
    })

    it('renders the pinned footer alongside the body', () => {
        render(
            <PWSheetLayout footer={<PWText>Footer</PWText>}>
                <PWText>Body</PWText>
            </PWSheetLayout>,
        )

        expect(screen.getByText('Body')).toBeTruthy()
        expect(screen.getByText('Footer')).toBeTruthy()
    })

    it('pins the footer over the bottom of an auto sheet', () => {
        render(
            <PWSheetSizeContext.Provider value='auto'>
                <PWSheetLayout
                    footer={<PWText>Footer</PWText>}
                    testID='layout'
                >
                    <PWText>Body</PWText>
                </PWSheetLayout>
            </PWSheetSizeContext.Provider>,
        )

        const footer = getComputedStyle(screen.getByTestId('layout_footer'))
        expect(footer.position).toBe('absolute')
        expect(footer.bottom).toBe('0px')
    })

    it('stacks the footer under the body in a modal sheet', () => {
        render(
            <PWSheetSizeContext.Provider value='modal'>
                <PWSheetLayout
                    footer={<PWText>Footer</PWText>}
                    testID='layout'
                >
                    <PWText>Body</PWText>
                </PWSheetLayout>
            </PWSheetSizeContext.Provider>,
        )

        expect(
            getComputedStyle(screen.getByTestId('layout_footer')).position,
        ).not.toBe('absolute')
    })
})
