import React from 'react'
import { render, screen } from '@test-utils/render'
import PWBottomSheet from '../PWBottomSheet'
import { Text } from 'react-native'

describe('PWBottomSheet', () => {
    it('shows children when visible', () => {
        render(
            <PWBottomSheet isVisible={true}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>
        )
        
        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })
})
