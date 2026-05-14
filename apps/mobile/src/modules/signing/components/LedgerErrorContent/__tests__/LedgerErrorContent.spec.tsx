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
import type { LedgerErrorPreset } from '@modules/ledger/utils/ledgerErrorPresets'
import { LedgerErrorContent } from '../LedgerErrorContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
    }),
}))

const baseError: LedgerErrorPreset = {
    kind: 'connection_failed',
    title: 'Connection failed',
    body: 'Could not connect.',
    isTroubleshootable: true,
    isRetryable: true,
}

describe('LedgerErrorContent', () => {
    const baseProps = {
        error: baseError,
        onRetry: vi.fn(),
        onClose: vi.fn(),
        onOpenTroubleshooting: vi.fn(),
    }

    it('renders the troubleshooting link when isTroubleshootable=true', () => {
        render(<LedgerErrorContent {...baseProps} />)
        expect(screen.queryByTestId('ledger-error-troubleshoot')).toBeTruthy()
    })

    it('hides the troubleshooting link when isTroubleshootable=false', () => {
        render(
            <LedgerErrorContent
                {...baseProps}
                error={{ ...baseError, isTroubleshootable: false }}
            />,
        )
        expect(screen.queryByTestId('ledger-error-troubleshoot')).toBeNull()
    })

    it('renders Retry when isRetryable=true', () => {
        render(<LedgerErrorContent {...baseProps} />)
        expect(screen.queryByTestId('ledger-error-retry')).toBeTruthy()
    })

    it('hides Retry when isRetryable=false', () => {
        render(
            <LedgerErrorContent
                {...baseProps}
                error={{ ...baseError, isRetryable: false }}
            />,
        )
        expect(screen.queryByTestId('ledger-error-retry')).toBeNull()
    })

    it('invokes the correct handler per button', () => {
        const onRetry = vi.fn()
        const onClose = vi.fn()
        const onOpenTroubleshooting = vi.fn()
        render(
            <LedgerErrorContent
                {...baseProps}
                onRetry={onRetry}
                onClose={onClose}
                onOpenTroubleshooting={onOpenTroubleshooting}
            />,
        )
        fireEvent.click(screen.getByTestId('ledger-error-retry'))
        fireEvent.click(screen.getByTestId('ledger-error-close'))
        fireEvent.click(screen.getByTestId('ledger-error-troubleshoot'))
        expect(onRetry).toHaveBeenCalledOnce()
        expect(onClose).toHaveBeenCalledOnce()
        expect(onOpenTroubleshooting).toHaveBeenCalledOnce()
    })
})
