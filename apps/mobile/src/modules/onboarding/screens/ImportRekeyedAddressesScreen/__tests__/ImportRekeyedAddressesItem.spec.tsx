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
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

vi.mock('../RekeyedAccountInfoBottomSheet', () => ({
    RekeyedAccountInfoBottomSheet: ({ isVisible }: { isVisible: boolean }) =>
        isVisible ? (
            <div data-testid='rekeyed-account-info-bottom-sheet' />
        ) : null,
}))

const MOCK_ACCOUNT = {
    id: '1',
    address: 'MOCK_ADDRESS',
    type: AccountTypes.algo25,
    keyPairId: 'pk',
}

const MOCK_DISCOVERED = {
    account: MOCK_ACCOUNT,
    authAddress: 'REKEY_ADDRESS',
}

const TRUNCATED_ADDRESS = truncateAlgorandAddress(MOCK_ACCOUNT.address)

describe('ImportRekeyedAddressesItem', () => {
    it('renders correctly with truncated address', () => {
        render(
            <ImportRekeyedAddressesItem
                discovered={MOCK_DISCOVERED}
                isImported={false}
                isSelected={false}
                onToggle={vi.fn()}
            />,
        )

        expect(screen.getByText(TRUNCATED_ADDRESS)).toBeTruthy()
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
                discovered={MOCK_DISCOVERED}
                isImported={false}
                isSelected={false}
                onToggle={onToggle}
            />,
        )

        fireEvent.click(screen.getByText(TRUNCATED_ADDRESS))
        expect(onToggle).toHaveBeenCalledWith('MOCK_ADDRESS')
    })

    it('renders as disabled and shows "already imported" chip when isImported is true', () => {
        render(
            <ImportRekeyedAddressesItem
                discovered={MOCK_DISCOVERED}
                isImported={true}
                isSelected={false}
                onToggle={vi.fn()}
            />,
        )

        expect(
            screen.getByText(content =>
                content.includes(
                    'onboarding.import_rekeyed_addresses.already_imported',
                ),
            ),
        ).toBeTruthy()
    })

    it('opens info bottom sheet when info icon is pressed', () => {
        render(
            <ImportRekeyedAddressesItem
                discovered={MOCK_DISCOVERED}
                isImported={false}
                isSelected={false}
                onToggle={vi.fn()}
            />,
        )

        expect(
            screen.queryByTestId('rekeyed-account-info-bottom-sheet'),
        ).toBeNull()

        const infoButton = screen.getByTestId(
            `import_rekeyed_addresses_item_info_${MOCK_ACCOUNT.address}`,
        )
        fireEvent.click(infoButton)

        expect(
            screen.getByTestId('rekeyed-account-info-bottom-sheet'),
        ).toBeTruthy()
    })

    it('renders selected state correctly', () => {
        render(
            <ImportRekeyedAddressesItem
                discovered={MOCK_DISCOVERED}
                isImported={false}
                isSelected={true}
                onToggle={vi.fn()}
            />,
        )
        expect(screen.getByText(TRUNCATED_ADDRESS)).toBeTruthy()
    })
})
