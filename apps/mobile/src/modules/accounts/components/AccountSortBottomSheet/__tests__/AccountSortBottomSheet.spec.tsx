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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountSortBottomSheet } from '../AccountSortBottomSheet'

const mockSetSortMode = vi.fn()
const mockSetManualAccountOrder = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: vi.fn(() => []),
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map(),
            portfolioAlgoValue: '0',
            isPending: false,
        })),
        useSortedAccounts: vi.fn(() => ({
            sortedAccounts: [],
            sortMode: 'manual',
            setSortMode: mockSetSortMode,
            manualAccountOrder: [],
            setManualAccountOrder: mockSetManualAccountOrder,
        })),
    }
})

describe('AccountSortBottomSheet', () => {
    it('renders all sort options', () => {
        const onClose = vi.fn()
        render(
            <AccountSortBottomSheet
                isVisible={true}
                onClose={onClose}
            />,
        )

        expect(screen.getByTestId('sort_option_alphabeticalAsc')).toBeTruthy()
        expect(screen.getByTestId('sort_option_alphabeticalDesc')).toBeTruthy()
        expect(screen.getByTestId('sort_option_balanceAsc')).toBeTruthy()
        expect(screen.getByTestId('sort_option_balanceDesc')).toBeTruthy()
        expect(screen.getByTestId('sort_option_manual')).toBeTruthy()
    })

    it('calls setSortMode when a sort option is pressed', () => {
        const onClose = vi.fn()
        render(
            <AccountSortBottomSheet
                isVisible={true}
                onClose={onClose}
            />,
        )

        const alphaOption = screen.getByTestId('sort_option_alphabeticalAsc')
        fireEvent.click(alphaOption)

        expect(mockSetSortMode).toHaveBeenCalledWith('alphabeticalAsc')
    })
})
