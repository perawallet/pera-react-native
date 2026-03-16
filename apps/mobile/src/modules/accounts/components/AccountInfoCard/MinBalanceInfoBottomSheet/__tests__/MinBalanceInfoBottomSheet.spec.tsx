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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { MinBalanceInfoBottomSheet } from '../MinBalanceInfoBottomSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('MinBalanceInfoBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render content when isVisible is false', () => {
        render(
            <MinBalanceInfoBottomSheet
                {...defaultProps}
                isVisible={false}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    it('renders title, description, and close button when visible', () => {
        render(<MinBalanceInfoBottomSheet {...defaultProps} />)

        expect(screen.getByText('min_balance_info.title')).toBeTruthy()
        expect(screen.getByText('min_balance_info.description')).toBeTruthy()
        expect(screen.getByText('min_balance_info.close')).toBeTruthy()
    })

    it('does not render an icon', () => {
        render(<MinBalanceInfoBottomSheet {...defaultProps} />)

        expect(screen.queryByTestId('icon-info')).toBeNull()
    })

    it('calls onClose when close button is pressed', () => {
        render(<MinBalanceInfoBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByText('min_balance_info.close'))

        expect(defaultProps.onClose).toHaveBeenCalled()
    })
})
