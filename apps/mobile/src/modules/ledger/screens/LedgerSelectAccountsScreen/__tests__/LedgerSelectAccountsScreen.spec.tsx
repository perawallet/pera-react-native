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
]

const { mockToggleSelection, mockToggleSelectAll, mockHandleContinue, mockHandleFindAnother, mockHandleOpenInfo, mockHandleCloseInfo } = vi.hoisted(() => ({
    mockToggleSelection: vi.fn(),
    mockToggleSelectAll: vi.fn(),
    mockHandleContinue: vi.fn(),
    mockHandleFindAnother: vi.fn(),
    mockHandleOpenInfo: vi.fn(),
    mockHandleCloseInfo: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, opts?: { count?: number }) =>
            opts?.count !== undefined ? `${key}:${opts.count}` : key,
    }),
}))

vi.mock('@assets/icons/accounts/light/ledger-account.svg', () => ({
    default: 'LedgerAccountIcon',
}))

vi.mock('../useLedgerSelectAccountsScreen', () => ({
    useLedgerSelectAccountsScreen: () => ({
        accounts: ACCOUNTS,
        selectedAddresses: new Set<string>(),
        isAllSelected: false,
        areAllImported: false,
        canContinue: false,
        alreadyImportedAddresses: new Set<string>(),
        isFetchingMore: false,
        infoAddress: null,
        toggleSelection: mockToggleSelection,
        toggleSelectAll: mockToggleSelectAll,
        handleContinue: mockHandleContinue,
        handleFindAnother: mockHandleFindAnother,
        handleOpenInfo: mockHandleOpenInfo,
        handleCloseInfo: mockHandleCloseInfo,
        t: (key: string, opts?: { count?: number }) =>
            opts?.count !== undefined ? `${key}:${opts.count}` : key,
    }),
}))

import { LedgerSelectAccountsScreen } from '../LedgerSelectAccountsScreen'

describe('LedgerSelectAccountsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the pluralized title with the account count', () => {
        render(<LedgerSelectAccountsScreen />)
        expect(screen.getByText('ledger.select_accounts.title:1')).toBeTruthy()
    })

    it('does not render the Select all toggle when accounts.length === 1', () => {
        render(<LedgerSelectAccountsScreen />)
        expect(
            screen.queryByText('ledger.select_accounts.select_all'),
        ).toBeNull()
    })

    it('renders the CTA with the selected count', () => {
        render(<LedgerSelectAccountsScreen />)
        expect(screen.getByText('ledger.select_accounts.cta:0')).toBeTruthy()
    })

    it('calls handleOpenInfo when the row info button is pressed', () => {
        render(<LedgerSelectAccountsScreen />)
        fireEvent.click(
            screen.getByTestId(`ledger_select_row_${ACCOUNTS[0].address}-info-button`),
        )
        expect(mockHandleOpenInfo).toHaveBeenCalledWith(ACCOUNTS[0].address)
    })
})
