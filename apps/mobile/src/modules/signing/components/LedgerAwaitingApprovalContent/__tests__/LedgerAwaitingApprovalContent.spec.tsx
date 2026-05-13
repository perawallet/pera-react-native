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

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'
import { LedgerAwaitingApprovalContent } from '../LedgerAwaitingApprovalContent'

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: () => false,
}))

vi.mock('lottie-react-native', () => ({
    default: ({ testID }: { testID?: string }) => (
        <div data-testid={testID ?? 'lottie-view'} />
    ),
}))

vi.mock('@assets/animations/ledger-signing.json', () => ({
    default: { __variant: 'light' },
}))

vi.mock('@assets/animations/ledger-signing.dark.json', () => ({
    default: { __variant: 'dark' },
}))

describe('LedgerAwaitingApprovalContent', () => {
    const baseProps = {
        deviceName: 'Nano X',
        currentTx: null,
        totalTxs: null,
        onCancel: vi.fn(),
    }

    it('renders progress block when totalTxs > 1', () => {
        render(
            <LedgerAwaitingApprovalContent
                {...baseProps}
                currentTx={2}
                totalTxs={5}
            />,
        )
        expect(screen.getByTestId('ledger-signing-progress-bar')).toBeTruthy()
    })

    it('hides progress block when totalTxs is 1', () => {
        render(
            <LedgerAwaitingApprovalContent
                {...baseProps}
                currentTx={1}
                totalTxs={1}
            />,
        )
        expect(screen.queryByTestId('ledger-signing-progress-bar')).toBeNull()
    })

    it('hides progress block when totalTxs is null', () => {
        render(<LedgerAwaitingApprovalContent {...baseProps} />)
        expect(screen.queryByTestId('ledger-signing-progress-bar')).toBeNull()
    })

    it('invokes onCancel when the cancel button is pressed', () => {
        const onCancel = vi.fn()
        render(
            <LedgerAwaitingApprovalContent
                {...baseProps}
                onCancel={onCancel}
            />,
        )
        fireEvent.click(screen.getByTestId('ledger-signing-cancel'))
        expect(onCancel).toHaveBeenCalledOnce()
    })
})
