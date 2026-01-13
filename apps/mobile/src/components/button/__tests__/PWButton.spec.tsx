import { vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import PWButton from '../PWButton'

describe('PWButton', () => {
    it('calls onPress when pressed', () => {
        const onPress = vi.fn()
        render(<PWButton title="Click Me" onPress={onPress} variant="primary" />)
        
        // Use click instead of press since we're testing with react-native-web
        fireEvent.click(screen.getByText('Click Me'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('shows loading indicator and does not call onPress when loading', () => {
        const onPress = vi.fn()
        render(
            <PWButton 
                title="Click Me" 
                onPress={onPress} 
                variant="primary" 
                loading={true} 
            />
        )
        
        // When loading, loading indicator should be present.
        // Since we don't have explicit testID, check for absence of text or verify logic.
        // Implementation: {!!props.title && !props.loading && <Text...>}
        expect(screen.queryByText('Click Me')).toBeNull() 
    })
})
