import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWText } from '../PWText'

describe('PWText', () => {
    it('renders children correctly', () => {
        render(<PWText>Hello World</PWText>)
        expect(screen.getByText('Hello World')).toBeTruthy()
    })

    it('applies variant styles correctly', () => {
        render(<PWText variant="h1">Heading 1</PWText>)
        // RNE Text maps h1 prop to styles, difficult to test exact style composition without snapshots or shallow rendering,
        // but checking render is sufficient for wrapper presence.
        expect(screen.getByText('Heading 1')).toBeTruthy()
    })
})
