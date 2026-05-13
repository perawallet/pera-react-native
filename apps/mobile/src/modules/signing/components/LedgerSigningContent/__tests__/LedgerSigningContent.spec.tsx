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

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@test-utils/render'
import { useLedgerSigningContent } from '../useLedgerSigningContent'
import type { UseLedgerSigningContentResult } from '../useLedgerSigningContent'
import { LedgerSigningContent } from '../LedgerSigningContent'

vi.mock('../useLedgerSigningContent')

// Mock the child components so we only test routing logic.
vi.mock('../../LedgerAwaitingApprovalContent', () => ({
    LedgerAwaitingApprovalContent: () => (
        <button data-testid='ledger-awaiting-mock' />
    ),
}))
vi.mock('../../LedgerErrorContent', () => ({
    LedgerErrorContent: () => <button data-testid='ledger-error-mock' />,
}))

const base: UseLedgerSigningContentResult = {
    isVisible: true,
    status: 'awaitingApproval',
    deviceName: 'Nano X',
    currentTx: null,
    totalTxs: null,
    error: null,
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    isTroubleshootingVisible: false,
    onOpenTroubleshooting: vi.fn(),
    onCloseTroubleshooting: vi.fn(),
}

describe('LedgerSigningContent router', () => {
    it('renders LedgerAwaitingApprovalContent for awaitingApproval', () => {
        vi.mocked(useLedgerSigningContent).mockReturnValue({
            ...base,
            status: 'awaitingApproval',
        })
        render(<LedgerSigningContent />)
        expect(screen.queryByTestId('ledger-awaiting-mock')).toBeTruthy()
        expect(screen.queryByTestId('ledger-error-mock')).toBeNull()
    })

    it('renders LedgerAwaitingApprovalContent for signing status', () => {
        vi.mocked(useLedgerSigningContent).mockReturnValue({
            ...base,
            status: 'signing',
        })
        render(<LedgerSigningContent />)
        expect(screen.queryByTestId('ledger-awaiting-mock')).toBeTruthy()
    })

    it('renders LedgerErrorContent for error status with a preset', () => {
        vi.mocked(useLedgerSigningContent).mockReturnValue({
            ...base,
            status: 'error',
            error: {
                kind: 'user_rejected',
                title: 't',
                body: 'b',
                isTroubleshootable: false,
                isRetryable: true,
            },
        })
        render(<LedgerSigningContent />)
        expect(screen.queryByTestId('ledger-error-mock')).toBeTruthy()
        expect(screen.queryByTestId('ledger-awaiting-mock')).toBeNull()
    })

    it('renders nothing when status is idle / searching', () => {
        vi.mocked(useLedgerSigningContent).mockReturnValue({
            ...base,
            status: 'idle',
        })
        render(<LedgerSigningContent />)
        expect(screen.queryByTestId('ledger-awaiting-mock')).toBeNull()
        expect(screen.queryByTestId('ledger-error-mock')).toBeNull()
    })

    it('renders nothing for error status with no preset', () => {
        vi.mocked(useLedgerSigningContent).mockReturnValue({
            ...base,
            status: 'error',
            error: null,
        })
        render(<LedgerSigningContent />)
        expect(screen.queryByTestId('ledger-error-mock')).toBeNull()
    })
})
