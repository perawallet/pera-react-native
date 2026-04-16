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
import { Text } from 'react-native'
import { PWTooltip } from '../PWTooltip'

const mockOpen = vi.fn()
const mockClose = vi.fn()
let mockIsOpen = false

vi.mock('@hooks/useModalState', () => ({
    useModalState: () => ({
        isOpen: mockIsOpen,
        open: mockOpen,
        close: mockClose,
        toggle: vi.fn(),
    }),
}))

const mockHasSeen = vi.fn()
const mockMarkSeen = vi.fn()

vi.mock('@perawallet/wallet-core-settings', () => ({
    useTooltipSeen: () => ({
        hasSeen: mockHasSeen,
        markSeen: mockMarkSeen,
        reset: vi.fn(),
    }),
}))

describe('PWTooltip', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsOpen = false
        mockHasSeen.mockReturnValue(false)
    })

    it('renders the default info icon trigger and opens the sheet on press', () => {
        const { container } = render(
            <PWTooltip title='Slippage'>
                <Text>Body copy</Text>
            </PWTooltip>,
        )

        const trigger = container.querySelector('[testid="pw-tooltip-trigger"]')
        expect(trigger).toBeTruthy()

        fireEvent.click(trigger!)
        expect(mockOpen).toHaveBeenCalledTimes(1)
    })

    it('renders a custom trigger when renderTrigger is provided', () => {
        const { getByText, container } = render(
            <PWTooltip
                title='Price Impact'
                renderTrigger={({ onPress }) => (
                    <Text onPress={onPress}>custom-trigger</Text>
                )}
            >
                <Text>Body</Text>
            </PWTooltip>,
        )

        expect(getByText('custom-trigger')).toBeTruthy()
        expect(
            container.querySelector('[testid="pw-tooltip-trigger"]'),
        ).toBeNull()
    })

    it('auto-opens on mount when first-run and id has not been seen', () => {
        mockHasSeen.mockReturnValue(false)

        render(
            <PWTooltip
                id='swap-intro'
                autoOpenFirstRun
            >
                <Text>Body</Text>
            </PWTooltip>,
        )

        expect(mockHasSeen).toHaveBeenCalledWith('swap-intro')
        expect(mockOpen).toHaveBeenCalledTimes(1)
    })

    it('does not auto-open when tooltip has already been seen', () => {
        mockHasSeen.mockReturnValue(true)

        render(
            <PWTooltip
                id='swap-intro'
                autoOpenFirstRun
            >
                <Text>Body</Text>
            </PWTooltip>,
        )

        expect(mockOpen).not.toHaveBeenCalled()
    })

    it('marks the tooltip seen when closed via the confirm button', () => {
        mockIsOpen = true
        const { container } = render(
            <PWTooltip
                id='swap-intro'
                title='Swap intro'
            >
                <Text>Body</Text>
            </PWTooltip>,
        )

        const confirm = container.querySelector('[testid="pw-tooltip-confirm"]')
        expect(confirm).toBeTruthy()

        fireEvent.click(confirm!)
        expect(mockClose).toHaveBeenCalledTimes(1)
        expect(mockMarkSeen).toHaveBeenCalledWith('swap-intro')
    })

    it('does not call markSeen when no id is provided', () => {
        mockIsOpen = true
        const { container } = render(
            <PWTooltip title='One-off'>
                <Text>Body</Text>
            </PWTooltip>,
        )

        fireEvent.click(
            container.querySelector('[testid="pw-tooltip-confirm"]')!,
        )
        expect(mockMarkSeen).not.toHaveBeenCalled()
    })
})
