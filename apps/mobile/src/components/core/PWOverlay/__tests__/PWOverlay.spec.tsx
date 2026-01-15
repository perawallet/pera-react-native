import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWOverlay } from '../PWOverlay'
import { Text } from 'react-native'

describe('PWOverlay', () => {
    it('renders content when observable', () => {
        render(
            <PWOverlay isVisible={true}>
                <Text>Overlay Content</Text>
            </PWOverlay>
        )
        expect(screen.getByText('Overlay Content')).toBeTruthy()
    })
})
