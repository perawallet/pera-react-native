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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionWarnings } from '../TransactionWarnings'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useModalState } from '@hooks/useModalState'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        truncateAlgorandAddress: vi.fn(a => a),
    }
})

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        encodeAlgorandAddress: vi.fn(
            (bytes: Uint8Array) => `ENCODED_${new TextDecoder().decode(bytes)}`,
        ),
    }
})

const mockUserAccount = {
    address: 'USER_ADDR',
    type: 'algo25',
    keyPairId: 'key-1',
}

describe('TransactionWarnings', () => {
    beforeEach(() => {
        vi.mocked(useAllAccounts).mockReturnValue([
            mockUserAccount,
        ] as unknown as ReturnType<typeof useAllAccounts>)
        vi.mocked(useModalState).mockReturnValue({
            isOpen: false,
            open: vi.fn(),
            close: vi.fn(),
            toggle: vi.fn(),
        })
    })

    const mockTransaction = {
        sender: 'USER_ADDR',
        paymentTransaction: {
            closeRemainderTo: 'CLOSE_ADDRESS',
        },
        rekeyTo: {
            publicKey: new Uint8Array([1, 2, 3]),
        },
        id: 'TX_ID',
    } as unknown as PeraDisplayableTransaction

    it('renders warning button when warnings exist', () => {
        const { getByText } = render(
            <TransactionWarnings transaction={mockTransaction} />,
        )

        expect(getByText('transactions.warning.title')).toBeTruthy()
    })

    it('calls open when warning button is pressed', () => {
        const open = vi.fn()
        vi.mocked(useModalState).mockReturnValue({
            isOpen: false,
            open,
            close: vi.fn(),
            toggle: vi.fn(),
        })

        const { getByText } = render(
            <TransactionWarnings transaction={mockTransaction} />,
        )

        fireEvent.click(getByText('transactions.warning.title'))
        expect(open).toHaveBeenCalled()
    })

    it('renders null when no warnings exist', () => {
        const noWarningsTx = {
            sender: 'USER_ADDR',
            id: 'TX_ID',
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <TransactionWarnings transaction={noWarningsTx} />,
        )

        expect(container.firstChild).toBeNull()
    })

    it('shows close account warning in bottom sheet when sender is a user account', () => {
        vi.mocked(useModalState).mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close: vi.fn(),
            toggle: vi.fn(),
        })

        const { getByText } = render(
            <TransactionWarnings transaction={mockTransaction} />,
        )

        expect(getByText('transactions.warning.close_warning')).toBeTruthy()
    })

    it('hides close warning when sender is not a user account', () => {
        vi.mocked(useModalState).mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close: vi.fn(),
            toggle: vi.fn(),
        })

        const closeTx = {
            sender: 'EXTERNAL_ADDR',
            paymentTransaction: {
                closeRemainderTo: 'CLOSE_ADDRESS',
            },
            id: 'TX_ID',
        } as unknown as PeraDisplayableTransaction

        const { queryByText } = render(
            <TransactionWarnings transaction={closeTx} />,
        )

        expect(queryByText('transactions.warning.close_warning')).toBeNull()
    })

    it('shows rekey warning when sender is a user account', () => {
        vi.mocked(useModalState).mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close: vi.fn(),
            toggle: vi.fn(),
        })

        const rekeyTx = {
            sender: 'USER_ADDR',
            rekeyTo: {
                publicKey: new Uint8Array([1, 2, 3]),
            },
            id: 'TX_ID',
        } as unknown as PeraDisplayableTransaction

        const { getByText } = render(
            <TransactionWarnings transaction={rekeyTx} />,
        )

        expect(getByText('transactions.warning.rekey_warning')).toBeTruthy()
    })

    it('hides rekey warning when sender is not a user account', () => {
        const rekeyTx = {
            sender: 'EXTERNAL_ADDR',
            rekeyTo: {
                publicKey: new Uint8Array([1, 2, 3]),
            },
            id: 'TX_ID',
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <TransactionWarnings transaction={rekeyTx} />,
        )

        expect(container.firstChild).toBeNull()
    })

    it('renders null for close-only transaction when sender is not a user account', () => {
        const closeTx = {
            sender: 'EXTERNAL_ADDR',
            paymentTransaction: {
                closeRemainderTo: 'CLOSE_ADDRESS',
            },
            id: 'TX_ID',
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <TransactionWarnings transaction={closeTx} />,
        )

        expect(container.firstChild).toBeNull()
    })
})
