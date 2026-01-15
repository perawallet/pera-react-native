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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InfoButton } from '../InfoButton'

// Mock dependencies
const mockOpen = vi.fn()
const mockClose = vi.fn()

vi.mock('@hooks/modal-state', () => ({
    useModalState: () => ({
        isOpen: false,
        open: mockOpen,
        close: mockClose,
    }),
}))

describe('InfoButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders and handles press interaction', () => {
        const { container } = render(<InfoButton title='Test Info' />)

        // Use querySelector because the environment renders 'testid' instead of 'data-testid' for TouchableOpacity
        const button = container.querySelector('[testid="info-button"]')
        expect(button).toBeTruthy()

        if (button) {
            fireEvent.click(button)
            expect(mockOpen).toHaveBeenCalledTimes(1)
        }
    })
})
