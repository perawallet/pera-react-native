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
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SwapScreen } from '../SwapScreen'

const mockUseSwapIntroduction = vi.hoisted(() => vi.fn())

vi.mock('@modules/swap/hooks', () => ({
    useSwapIntroduction: mockUseSwapIntroduction,
}))

vi.mock('@modules/swap/components', () => ({
    SwapIntroduction: ({
        isVisible,
        onStartSwapping,
    }: {
        isVisible: boolean
        onStartSwapping: () => void
        onClose: () => void
    }) =>
        isVisible ? (
            <button
                data-testid='swap-introduction'
                onClick={onStartSwapping}
            />
        ) : null,
}))

describe('SwapScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows introduction when user has not seen it', () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: false,
            markIntroductionSeen: vi.fn(),
        })

        render(<SwapScreen />)

        expect(screen.getByTestId('swap-introduction')).toBeTruthy()
    })

    it('shows swap content when user has already seen introduction', () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: true,
            markIntroductionSeen: vi.fn(),
        })

        render(<SwapScreen />)

        expect(screen.queryByTestId('swap-introduction')).toBeNull()
        expect(screen.getByText('common.not_implemented.title')).toBeTruthy()
    })
})
