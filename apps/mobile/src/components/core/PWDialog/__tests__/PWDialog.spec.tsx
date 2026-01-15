import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWDialog } from '../PWDialog'
import { Text } from 'react-native'

describe('PWDialog', () => {
    it('renders content', () => {
        render(
            <PWDialog isVisible={true}>
                <Text>Dialog Content</Text>
            </PWDialog>
        )
        expect(screen.getByText('Dialog Content')).toBeTruthy()
    })
})
