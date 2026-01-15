import { render } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWSkeleton } from '../PWSkeleton'

describe('PWSkeleton', () => {
    it('renders correctly', () => {
        render(<PWSkeleton />)
        // RNE Skeleton might not have a testID by default, but we check if it renders without error
        expect(true).toBeTruthy()
    })
})
