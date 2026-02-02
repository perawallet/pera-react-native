import React from 'react'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountMenuBottomSheet } from '../AccountMenuBottomSheet'

vi.mock('@components/core', async () => {
    return {
        PWBottomSheet: ({ children, isVisible }: any) => (isVisible ? <div data-testid="PWBottomSheet">{children}</div> : null),
    }
})

vi.mock('@modules/accounts/components/AccountMenu', () => ({
    AccountMenu: () => <div data-testid="AccountMenu" />,
}))

describe('AccountMenuBottomSheet', () => {
    it('renders correctly when isVisible is true', () => {
        const props = {
            isVisible: true,
            onClose: vi.fn(),
            onSelected: vi.fn(),
            showInbox: true,
        }

        render(<AccountMenuBottomSheet {...props} />)
        expect(screen.getByTestId('PWBottomSheet')).toBeTruthy()
        expect(screen.getByTestId('AccountMenu')).toBeTruthy()
    })

    it('does not render when isVisible is false', () => {
        const props = {
            isVisible: false,
            onClose: vi.fn(),
            onSelected: vi.fn(),
            showInbox: true,
        }

        render(<AccountMenuBottomSheet {...props} />)
        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })
})
