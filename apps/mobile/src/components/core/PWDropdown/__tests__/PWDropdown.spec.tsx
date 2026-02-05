import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWDropdown } from '../PWDropdown'
import { PWText } from '@components/core/PWText'

describe('PWDropdown', () => {
    it('renders trigger and shows items on press', () => {
        const onPressItem = vi.fn()
        const items = [
            { label: 'Item 1', onPress: onPressItem },
            { label: 'Item 2', onPress: vi.fn() },
        ]

        render(
            <PWDropdown items={items}>
                <PWText>Trigger</PWText>
            </PWDropdown>,
        )

        // Find trigger
        const trigger = screen.getByText('Trigger')
        expect(trigger).toBeTruthy()

        // Press trigger to open dropdown
        fireEvent.click(trigger)

        // Check if modal/items are visible
        // Note: React Native Modal might be tricky to test with basic render,
        // but typically RNTL can access modal content if not verifying visibility solely by implementation.
        // Or we assume it renders.
        // Since we use RN Modal, we might need to mock it or check if screens contains the text.

        expect(screen.getByText('Item 1')).toBeTruthy()

        // Press item
        fireEvent.click(screen.getByText('Item 1'))

        expect(onPressItem).toHaveBeenCalled()
    })
})
