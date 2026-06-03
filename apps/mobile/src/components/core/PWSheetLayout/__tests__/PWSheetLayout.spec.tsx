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

import { describe, it, expect } from 'vitest'
import { PWText } from '@components/core/PWText'
import { render, screen } from '@test-utils/render'
import { PWSheetLayout } from '../PWSheetLayout'

describe('PWSheetLayout', () => {
    it('renders the header above the body', () => {
        render(
            <PWSheetLayout
                header={<PWText>Header</PWText>}
                body={<PWText>Body</PWText>}
            />,
        )

        expect(screen.getByText('Header')).toBeTruthy()
        expect(screen.getByText('Body')).toBeTruthy()
    })

    it('renders the body without a header', () => {
        render(<PWSheetLayout body={<PWText>Body</PWText>} />)

        expect(screen.getByText('Body')).toBeTruthy()
    })

    it('renders the pinned footer alongside the body', () => {
        render(
            <PWSheetLayout
                footer={<PWText>Footer</PWText>}
                body={<PWText>Body</PWText>}
            />,
        )

        expect(screen.getByText('Body')).toBeTruthy()
        expect(screen.getByText('Footer')).toBeTruthy()
    })
})
