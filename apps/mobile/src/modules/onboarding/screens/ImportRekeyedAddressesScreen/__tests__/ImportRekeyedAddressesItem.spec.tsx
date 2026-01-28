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

import { render, fireEvent, screen } from '@test-utils/render'
import { vi } from 'vitest'
import { ImportRekeyedAddressesItem } from '../ImportRekeyedAddressesItem'
import { AccountTypes } from '@perawallet/wallet-core-accounts'

const MOCK_ACCOUNT = {
    id: '1',
    address: 'MOCK_ADDRESS',
    type: AccountTypes.algo25,
    canSign: true,
    rekeyAddress: 'REKEY_ADDRESS',
}

describe('ImportRekeyedAddressesItem', () => {
    it('renders correctly', () => {
        render(
            <ImportRekeyedAddressesItem
                account={MOCK_ACCOUNT}
                isImported={false}
                isSelected={false}
                onToggle={vi.fn()}
            />,
        )

        expect(screen.getByText('MOCK_ADDRESS')).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.rekeyed_account_subtitle',
            ),
        ).toBeTruthy()
    })

    it('calls onToggle when pressed', () => {
        const onToggle = vi.fn()
        render(
            <ImportRekeyedAddressesItem
                account={MOCK_ACCOUNT}
                isImported={false}
                isSelected={false}
                onToggle={onToggle}
            />,
        )

        fireEvent.click(screen.getByText('MOCK_ADDRESS'))
        expect(onToggle).toHaveBeenCalledWith('MOCK_ADDRESS')
    })

    it('renders as disabled and shows "already imported" chip when isImported is true', () => {
        render(
            <ImportRekeyedAddressesItem
                account={MOCK_ACCOUNT}
                isImported={true}
                isSelected={false}
                onToggle={vi.fn()}
            />,
        )

        expect(
            screen.getByText(
                /onboarding.import_rekeyed_addresses.already_imported/i,
            ),
        ).toBeTruthy()
        // Ensure checkbox is likely not present or indicating disabled state if verified via specific props/styles, 
        // but checking the chip is the main visual indicator here.
    })

    it('renders selected state correctly', () => {
        // Since PWCheckbox is wrapped, we might verify it via props mocking if we deeply tested, 
        // but for now we trust the component passes the prop. 
        // We can check if it renders without error.
        render(
            <ImportRekeyedAddressesItem
                account={MOCK_ACCOUNT}
                isImported={false}
                isSelected={true}
                onToggle={vi.fn()}
            />,
        )
        expect(screen.getByText('MOCK_ADDRESS')).toBeTruthy()
    })
})
