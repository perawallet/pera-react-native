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
import { render, screen, fireEvent } from '@test-utils/render'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@assets/icons/accounts/light/ledger-account.svg', () => ({
    default: 'LedgerAccountIcon',
}))

import { LedgerAccountSelectionRow } from '../LedgerAccountSelectionRow'

const ADDRESS = '4WU2BYFAVWV33766FLYBEBVMDSCBYB2I5U257SGGHJ6FHFB3ZVDIVSHXLI'

describe('LedgerAccountSelectionRow', () => {
    it('renders the truncated address and Ledger Account subtitle', () => {
        render(
            <LedgerAccountSelectionRow
                address={ADDRESS}
                isSelected={false}
                isImported={false}
                onToggle={vi.fn()}
                onInfoPress={vi.fn()}
            />,
        )

        expect(
            screen.getByText('ledger.select_accounts.account_subtitle'),
        ).toBeTruthy()
        // Truncated form contains the first and last chars of the address.
        expect(screen.getByText(/4WU2BY/)).toBeTruthy()
        expect(screen.getByText(/VSHXLI/)).toBeTruthy()
    })

    it('calls onToggle when the row is pressed', () => {
        const onToggle = vi.fn()
        render(
            <LedgerAccountSelectionRow
                address={ADDRESS}
                isSelected={false}
                isImported={false}
                onToggle={onToggle}
                onInfoPress={vi.fn()}
                testID='row'
            />,
        )

        fireEvent.click(screen.getByTestId('row'))

        expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('calls onInfoPress when the info button is pressed', () => {
        const onInfoPress = vi.fn()
        render(
            <LedgerAccountSelectionRow
                address={ADDRESS}
                isSelected={false}
                isImported={false}
                onToggle={vi.fn()}
                onInfoPress={onInfoPress}
                testID='row'
            />,
        )

        fireEvent.click(screen.getByTestId('row-info-button'))

        expect(onInfoPress).toHaveBeenCalledTimes(1)
    })

    it('disables presses and shows the imported chip when isImported is true', () => {
        const onToggle = vi.fn()
        render(
            <LedgerAccountSelectionRow
                address={ADDRESS}
                isSelected={false}
                isImported={true}
                onToggle={onToggle}
                onInfoPress={vi.fn()}
                testID='row'
            />,
        )

        expect(
            screen.getByText('ledger.select_accounts.already_imported'),
        ).toBeTruthy()
        fireEvent.click(screen.getByTestId('row'))
        expect(onToggle).not.toHaveBeenCalled()
    })
})
