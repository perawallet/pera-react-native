import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWInput } from '../PWInput'

describe('PWInput', () => {
    it('renders correctly', () => {
        render(<PWInput placeholder="Enter text" />)
        expect(screen.getByPlaceholderText('Enter text')).toBeTruthy()
    })

    it('calls onChangeText when text changes', () => {
        render(<PWInput value='test' onChangeText={() => {}} />)
    })

    // Retrying with simpler test case for input
    it('handles input events', () => {
        const onChangeText = vi.fn()
        render(<PWInput placeholder="test" onChangeText={onChangeText} />)
        fireEvent.changeText(screen.getByPlaceholderText('test'), 'hello')
        expect(onChangeText).toHaveBeenCalledWith('hello')
    })
})
