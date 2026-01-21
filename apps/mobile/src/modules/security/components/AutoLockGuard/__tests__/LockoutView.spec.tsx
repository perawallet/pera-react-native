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
import { LockoutView } from '../LockoutView'

const mockFormatTime = vi.fn((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatTime: mockFormatTime,
    }
})

describe('LockoutView', () => {
    const mockOnResetData = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders lockout title', () => {
        const { getByText } = render(
            <LockoutView
                remainingSeconds={60}
                onResetData={mockOnResetData}
            />,
        )

        expect(getByText('security.lockout.title')).toBeTruthy()
    })

    it('renders lockout subtitle', () => {
        const { getByText } = render(
            <LockoutView
                remainingSeconds={60}
                onResetData={mockOnResetData}
            />,
        )

        expect(getByText('security.lockout.subtitle')).toBeTruthy()
    })

    it('renders try again text', () => {
        const { getByText } = render(
            <LockoutView
                remainingSeconds={60}
                onResetData={mockOnResetData}
            />,
        )

        expect(getByText('security.lockout.tryagain_in')).toBeTruthy()
    })

    it('renders formatted remaining time', () => {
        const { getByText } = render(
            <LockoutView
                remainingSeconds={125}
                onResetData={mockOnResetData}
            />,
        )

        expect(getByText('2:05')).toBeTruthy()
    })

    it('renders reset button when onResetData is provided', () => {
        const { getByText } = render(
            <LockoutView
                remainingSeconds={60}
                onResetData={mockOnResetData}
            />,
        )

        expect(getByText('security.lockout.reset_button')).toBeTruthy()
    })

    it('calls onResetData when reset button is clicked', () => {
        const { getByText } = render(
            <LockoutView
                remainingSeconds={60}
                onResetData={mockOnResetData}
            />,
        )

        fireEvent.click(getByText('security.lockout.reset_button'))

        expect(mockOnResetData).toHaveBeenCalled()
    })

    it('does not render reset button when onResetData is not provided', () => {
        const { queryByText } = render(<LockoutView remainingSeconds={60} />)

        expect(queryByText('security.lockout.reset_button')).toBeNull()
    })

    it('renders with zero remaining seconds', () => {
        const { getByText } = render(
            <LockoutView
                remainingSeconds={0}
                onResetData={mockOnResetData}
            />,
        )

        expect(getByText('0:00')).toBeTruthy()
    })
})
