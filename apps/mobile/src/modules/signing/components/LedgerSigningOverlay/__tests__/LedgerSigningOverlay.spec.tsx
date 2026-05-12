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
import { useLedgerSigningOverlay } from '../useLedgerSigningOverlay'
import type { UseLedgerSigningOverlayResult } from '../useLedgerSigningOverlay'
import { LedgerSigningOverlay } from '../LedgerSigningOverlay'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
    }),
}))

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

vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) => (isVisible ? <>{children}</> : null),
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
    PWButton: ({
        title,
        onPress,
        testID,
    }: {
        title: string
        onPress: () => void
        testID?: string
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
        >
            {title}
        </button>
    ),
    PWTouchableOpacity: ({
        children,
        onPress,
        testID,
    }: {
        children: React.ReactNode
        onPress: () => void
        testID?: string
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
        >
            {children}
        </button>
    ),
}))

vi.mock('../useLedgerSigningOverlay')

const base: UseLedgerSigningOverlayResult = {
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

describe('LedgerSigningOverlay router', () => {
    it('renders nothing actionable when isVisible is false', () => {
        vi.mocked(useLedgerSigningOverlay).mockReturnValue({
            ...base,
            isVisible: false,
            status: 'idle',
        })
        render(<LedgerSigningOverlay />)
        expect(screen.queryByTestId('ledger-signing-cancel')).toBeNull()
        expect(screen.queryByTestId('ledger-error-close')).toBeNull()
    })

    it('renders LedgerAwaitingApprovalContent for awaitingApproval', () => {
        vi.mocked(useLedgerSigningOverlay).mockReturnValue({
            ...base,
            status: 'awaitingApproval',
        })
        render(<LedgerSigningOverlay />)
        expect(screen.queryByTestId('ledger-signing-cancel')).toBeTruthy()
    })

    it('renders LedgerAwaitingApprovalContent for signing status too', () => {
        vi.mocked(useLedgerSigningOverlay).mockReturnValue({
            ...base,
            status: 'signing',
        })
        render(<LedgerSigningOverlay />)
        expect(screen.queryByTestId('ledger-signing-cancel')).toBeTruthy()
    })

    it('renders LedgerErrorContent for error status', () => {
        vi.mocked(useLedgerSigningOverlay).mockReturnValue({
            ...base,
            status: 'error',
            error: {
                kind: 'connection_failed',
                title: 't',
                body: 'b',
                isTroubleshootable: true,
                isRetryable: true,
            },
        })
        render(<LedgerSigningOverlay />)
        expect(screen.queryByTestId('ledger-error-close')).toBeTruthy()
    })

    it('mounts the troubleshooting sheet when isTroubleshootingVisible=true', () => {
        vi.mocked(useLedgerSigningOverlay).mockReturnValue({
            ...base,
            status: 'error',
            error: {
                kind: 'connection_failed',
                title: 't',
                body: 'b',
                isTroubleshootable: true,
                isRetryable: true,
            },
            isTroubleshootingVisible: true,
        })
        render(<LedgerSigningOverlay />)
        expect(
            screen.queryByTestId('ledger-troubleshooting-close'),
        ).toBeTruthy()
    })
})
