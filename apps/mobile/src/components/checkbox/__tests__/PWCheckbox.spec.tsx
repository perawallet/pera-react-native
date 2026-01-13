import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import PWCheckbox from '../PWCheckbox'
import { Text } from 'react-native'

describe('PWCheckbox', () => {
    it('calls onPress when pressed', () => {
        const onPress = vi.fn()
        render(
            <PWCheckbox checked={false} onPress={onPress}>
                <Text>Accept Terms</Text>
            </PWCheckbox>
        )
        
        fireEvent.press(screen.getByText('Accept Terms'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })
})
