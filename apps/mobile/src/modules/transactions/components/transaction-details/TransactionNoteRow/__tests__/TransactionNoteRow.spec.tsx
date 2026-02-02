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
import { TransactionNoteRow } from '../TransactionNoteRow'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useModalState } from '@hooks/useModalState'

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
    })),
}))

vi.mock('../../ViewNotePanel', () => ({
    ViewNotePanel: vi.fn(() => null),
}))

describe('TransactionNoteRow', () => {
    const mockTransaction = {
        note: new Uint8Array(Buffer.from('Hello Pera')),
    } as unknown as PeraDisplayableTransaction

    it('renders view note button when note is present', () => {
        const { getByRole } = render(
            <TransactionNoteRow transaction={mockTransaction} />,
        )

        expect(getByRole('button')).toBeTruthy()
        expect(getByRole('button').textContent).toContain(
            'transactions.common.view_note',
        )
    })

    it('calls open modal when button is pressed', () => {
        const open = vi.fn()
        vi.mocked(useModalState).mockReturnValue({
            isOpen: false,
            open,
            close: vi.fn(),
            toggle: vi.fn(),
        })

        const { getByRole } = render(
            <TransactionNoteRow transaction={mockTransaction} />,
        )

        fireEvent.click(getByRole('button'))
        expect(open).toHaveBeenCalled()
    })

    it('renders null when note is missing', () => {
        const noNoteTx = {
            note: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <TransactionNoteRow transaction={noNoteTx} />,
        )

        expect(container.firstChild).toBeNull()
    })
})
