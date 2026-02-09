import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { ViewTextDetailsPanel } from '../ViewTextDetailsPanel'
import { useClipboard } from '@hooks/useClipboard'

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: vi.fn(() => ({
        copyToClipboard: vi.fn(),
    })),
}))

describe('ViewTextDetailsPanel', () => {
    const defaultProps = {
        text: 'Hello World',
        isVisible: true,
        onClose: vi.fn(),
    }

    it('renders text content by default', () => {
        const { container } = render(
            <ViewTextDetailsPanel {...defaultProps} />,
        )

        expect(container.textContent).toContain('Hello World')
    })

    it('renders default title when no titleKey provided', () => {
        const { container } = render(
            <ViewTextDetailsPanel {...defaultProps} />,
        )

        expect(container.textContent).toContain('transactions.common.note')
    })

    it('renders custom title when titleKey is provided', () => {
        const { container } = render(
            <ViewTextDetailsPanel
                {...defaultProps}
                titleKey='transactions.common.view_metadata'
            />,
        )

        expect(container.textContent).toContain(
            'transactions.common.view_metadata',
        )
    })

    it('renders all mode badges', () => {
        const { getByText } = render(
            <ViewTextDetailsPanel {...defaultProps} />,
        )

        expect(getByText('common.text.label')).toBeTruthy()
        expect(getByText('common.hex.label')).toBeTruthy()
        expect(getByText('common.base64.label')).toBeTruthy()
    })

    it('calls close handler when close icon is pressed', () => {
        const onClose = vi.fn()
        const { getByTestId } = render(
            <ViewTextDetailsPanel {...defaultProps} onClose={onClose} />,
        )

        fireEvent.click(getByTestId('icon-cross'))
        expect(onClose).toHaveBeenCalled()
    })

    it('copies text to clipboard when copy icon is pressed', () => {
        const copyToClipboard = vi.fn()
        vi.mocked(useClipboard).mockReturnValue({ copyToClipboard })

        const { getByTestId } = render(
            <ViewTextDetailsPanel {...defaultProps} />,
        )

        fireEvent.click(getByTestId('icon-copy'))
        expect(copyToClipboard).toHaveBeenCalledWith('Hello World')
    })
})
