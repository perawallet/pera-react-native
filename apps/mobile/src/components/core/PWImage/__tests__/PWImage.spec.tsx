import { render } from '@test-utils/render'
import { describe, it } from 'vitest'
import { PWImage } from '../PWImage'

describe('PWImage', () => {
    it('renders correctly', () => {
        // Just checking basic render, remote images hard to test in node
        render(<PWImage source={{ uri: 'https://example.com/image.png' }} />)
    })
})
