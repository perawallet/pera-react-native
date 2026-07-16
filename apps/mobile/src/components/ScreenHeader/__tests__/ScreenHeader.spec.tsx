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
import { ScreenHeader } from '../ScreenHeader'

describe('ScreenHeader', () => {
    it('renders the title', () => {
        render(<ScreenHeader title='Import an account' />)

        expect(screen.getByText('Import an account')).toBeTruthy()
    })

    it('renders the description when provided', () => {
        render(
            <ScreenHeader
                title='Import from Pera Web'
                description='Open the Pera Web Wallet on your computer.'
            />,
        )

        expect(
            screen.getByText('Open the Pera Web Wallet on your computer.'),
        ).toBeTruthy()
    })

    it('renders a hero icon when the icon prop is provided', () => {
        render(
            <ScreenHeader
                title='Import from Pera Web'
                icon='globe'
            />,
        )

        expect(screen.getByTestId('screen-header-icon')).toBeTruthy()
    })

    it('does not render a hero icon when icon is omitted', () => {
        render(<ScreenHeader title='No icon' />)

        expect(screen.queryByTestId('screen-header-icon')).toBeNull()
    })
})
