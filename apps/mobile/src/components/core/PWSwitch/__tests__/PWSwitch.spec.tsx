import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWSwitch } from '../PWSwitch'

describe('PWSwitch', () => {
    it('calls onValueChange when toggled', () => {
        const onValueChange = vi.fn()
        const { getByRole } = render(
            <PWSwitch value={false} onValueChange={onValueChange} />
        )
        // Switch often has role 'switch'
        fireEvent(getByRole('switch'), 'valueChange', true)
        expect(onValueChange).toHaveBeenCalledWith(true)
    })
})
