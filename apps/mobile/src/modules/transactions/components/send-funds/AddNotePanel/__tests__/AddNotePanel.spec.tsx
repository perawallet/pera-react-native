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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { useSendFunds } from '@modules/transactions/hooks'
import { AddNotePanel } from '../AddNotePanel'

const mockSetNote = vi.fn()
const mockOnClose = vi.fn()
const mockReset = vi.fn()

type RenderCallback = (props: {
    field: { onChange: (v: string) => void; onBlur: () => void; value?: string }
}) => React.ReactElement

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('@hookform/resolvers/zod', () => ({
    zodResolver: () => vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    noteSchema: {},
}))

vi.mock('react-hook-form', () => ({
    useForm: () => ({
        control: {},
        handleSubmit: (cb: (data: { note?: string }) => void) => () =>
            cb({ note: undefined }),
        reset: mockReset,
        formState: { errors: {} },
    }),
    Controller: ({ render: renderProp }: { render: RenderCallback }) => {
        return renderProp({
            field: {
                onChange: vi.fn(),
                onBlur: vi.fn(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value: (useSendFunds as any)()?.note ?? '',
            },
        })
    },
}))

describe('AddNotePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            note: '',
            setNote: mockSetNote,
        })
    })

    it('does not render when isVisible is false', () => {
        render(
            <AddNotePanel
                isVisible={false}
                onClose={mockOnClose}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeFalsy()
    })

    it('renders when isVisible is true', () => {
        render(
            <AddNotePanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('PWBottomSheet')).toBeTruthy()
    })

    it('shows add note title when note is empty', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            note: '',
            setNote: mockSetNote,
        })

        const { container } = render(
            <AddNotePanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(container.textContent).toContain('send_funds.add_note.button')
    })

    it('shows edit title when note exists', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            note: 'existing note',
            setNote: mockSetNote,
        })

        const { container } = render(
            <AddNotePanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(container.textContent).toContain('send_funds.add_note.edit')
    })

    it('calls onClose when close icon is pressed', () => {
        render(
            <AddNotePanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        fireEvent.click(screen.getByTestId('icon-cross'))
        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls setNote and onClose when done is pressed', () => {
        render(
            <AddNotePanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        const doneButton = screen.getByText('send_funds.add_note.done')
        fireEvent.click(doneButton)

        expect(mockSetNote).toHaveBeenCalled()
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('renders input with current note value', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            note: 'test note value',
            setNote: mockSetNote,
        })

        render(
            <AddNotePanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        const input = screen.getByTestId('PWInput')
        expect(input).toBeTruthy()
        expect(input.getAttribute('value')).toBe('test note value')
    })
})
