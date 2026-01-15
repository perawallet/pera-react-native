import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWTab } from '../PWTab'

describe('PWTab', () => {
    it('renders correctly', () => {
        const { getByText } = render(
            <PWTab>
                <PWTab.Item title="Tab 1" />
                <PWTab.Item title="Tab 2" />
            </PWTab>
        )
        expect(getByText('Tab 1')).toBeTruthy()
        expect(getByText('Tab 2')).toBeTruthy()
    })

    it('calls onChange when tab is pressed', () => {
        const onChange = vi.fn()
        const { getByText } = render(
            <PWTab onChange={onChange} value={0}>
                <PWTab.Item title="Tab 1" />
                <PWTab.Item title="Tab 2" />
            </PWTab>
        )
        
        fireEvent.press(getByText('Tab 2'))
        expect(onChange).toHaveBeenCalledWith(1)
    })
})
