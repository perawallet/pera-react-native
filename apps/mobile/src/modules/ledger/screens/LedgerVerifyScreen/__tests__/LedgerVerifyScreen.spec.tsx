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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'

const ACCOUNTS = [
    {
        accountIndex: 0,
        address: '4WU2BYFAVWV33766FLYBEBVMDSCBYB2I5U257SGGHJ6FHFB3ZVDIVSHXLI',
    },
    {
        accountIndex: 1,
        address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
]

const { mockHandleAdd, mockHandleRetry, mockHandleTroubleshoot } = vi.hoisted(
    () => ({
        mockHandleAdd: vi.fn(),
        mockHandleRetry: vi.fn(),
        mockHandleTroubleshoot: vi.fn(),
    }),
)

const hookState = {
    selectedAccounts: ACCOUNTS,
    verifiedIndices: new Set<number>(),
    areAllVerified: false,
    errorPreset: null,
    handleAdd: mockHandleAdd,
    handleRetry: mockHandleRetry,
    handleTroubleshoot: mockHandleTroubleshoot,
    t: (key: string, opts?: { count?: number }) =>
        opts?.count !== undefined ? `${key}:${opts.count}` : key,
}

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, opts?: { count?: number }) =>
            opts?.count !== undefined ? `${key}:${opts.count}` : key,
    }),
}))

vi.mock('../useLedgerVerifyScreen', () => ({
    useLedgerVerifyScreen: () => hookState,
}))

import { LedgerVerifyScreen } from '../LedgerVerifyScreen'

describe('LedgerVerifyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hookState.verifiedIndices = new Set()
        hookState.areAllVerified = false
    })

    it('renders the title and description', () => {
        render(<LedgerVerifyScreen />)
        expect(screen.getByText('ledger.verify.title_redesigned')).toBeTruthy()
        expect(screen.getByText('ledger.verify.description')).toBeTruthy()
    })

    it('renders one card per selected account, all awaiting initially', () => {
        render(<LedgerVerifyScreen />)
        const awaitingLabels = screen.getAllByText('ledger.verify.awaiting')
        expect(awaitingLabels).toHaveLength(2)
    })

    it('renders the verified label for indices in verifiedIndices', () => {
        hookState.verifiedIndices = new Set([0])
        render(<LedgerVerifyScreen />)
        expect(screen.getByText('ledger.verify.verified')).toBeTruthy()
        expect(screen.getAllByText('ledger.verify.awaiting')).toHaveLength(1)
    })

    it('disables the CTA until all are verified', () => {
        hookState.verifiedIndices = new Set([0])
        hookState.areAllVerified = false
        render(<LedgerVerifyScreen />)

        fireEvent.click(screen.getByText('ledger.verify.add_accounts:2'))

        expect(mockHandleAdd).not.toHaveBeenCalled()
    })

    it('calls handleAdd when all are verified and the CTA is pressed', () => {
        hookState.verifiedIndices = new Set([0, 1])
        hookState.areAllVerified = true
        render(<LedgerVerifyScreen />)

        fireEvent.click(screen.getByText('ledger.verify.add_accounts:2'))

        expect(mockHandleAdd).toHaveBeenCalledTimes(1)
    })
})
