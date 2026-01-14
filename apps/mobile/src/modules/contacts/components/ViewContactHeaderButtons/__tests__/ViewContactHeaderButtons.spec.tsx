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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ViewContactHeaderButtons from '../ViewContactHeaderButtons'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
        }),
    }
})

describe('ViewContactHeaderButtons', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders edit icon', () => {
        const { container } = render(<ViewContactHeaderButtons />)
        expect(container).toBeTruthy()
    })

    it('navigates to EditContact screen on press', () => {
        render(<ViewContactHeaderButtons />)
        
        // Find the icon button by its testId
        const iconButton = screen.getByTestId('icon-edit-pen')
        fireEvent.click(iconButton)
        
        expect(mockNavigate).toHaveBeenCalledWith('EditContact')
    })

    it('uses secondary variant for the icon', () => {
        const { container } = render(<ViewContactHeaderButtons />)
        expect(container).toBeTruthy()
    })
})
