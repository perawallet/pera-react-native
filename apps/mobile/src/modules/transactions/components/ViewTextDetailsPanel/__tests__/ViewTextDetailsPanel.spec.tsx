/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
        title: 'Title',
        text: 'Hello World',
        isVisible: true,
        onClose: vi.fn(),
    }

    it('renders text content by default', () => {
        const { container } = render(<ViewTextDetailsPanel {...defaultProps} />)

        expect(container.textContent).toContain('Hello World')
    })

    it('renders custom title when titleKey is provided', () => {
        const { container } = render(
            <ViewTextDetailsPanel
                {...defaultProps}
                title='transactions.common.view_metadata'
            />,
        )

        expect(container.textContent).toContain(
            'transactions.common.view_metadata',
        )
    })

    it('renders all mode badges', () => {
        const { getByText } = render(<ViewTextDetailsPanel {...defaultProps} />)

        expect(getByText('common.text.label')).toBeTruthy()
        expect(getByText('common.hex.label')).toBeTruthy()
        expect(getByText('common.base64.label')).toBeTruthy()
    })

    it('calls close handler when close icon is pressed', () => {
        const onClose = vi.fn()
        const { getByTestId } = render(
            <ViewTextDetailsPanel
                {...defaultProps}
                onClose={onClose}
            />,
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
