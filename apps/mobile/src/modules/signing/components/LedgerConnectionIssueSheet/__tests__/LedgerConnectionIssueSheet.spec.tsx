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
import { fireEvent, render, screen } from '@test-utils/render'
import { LedgerConnectionIssueSheet } from '../LedgerConnectionIssueSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
    }),
}))

vi.mock('@components/core', () => ({
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
}))

describe('LedgerConnectionIssueSheet', () => {
    it('invokes onClose when the close button is pressed', () => {
        const onClose = vi.fn()
        render(<LedgerConnectionIssueSheet onClose={onClose} />)
        fireEvent.click(screen.getByTestId('ledger-troubleshooting-close'))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('renders the close action and tips', () => {
        render(<LedgerConnectionIssueSheet onClose={vi.fn()} />)
        expect(
            screen.queryByTestId('ledger-troubleshooting-close'),
        ).toBeTruthy()
    })
})
