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
import { RekeyedAccountInfoBottomSheet } from '../RekeyedAccountInfoBottomSheet'
import { AccountTypes } from '@perawallet/wallet-core-accounts'
import { Decimal } from 'decimal.js'

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        usdToPreferred: (v: Decimal) => v,
    })),
    usePreferredCurrencyPriceQuery: vi.fn(() => ({
        data: null,
        isPending: false,
    })),
}))

vi.mock('@modules/assets/components/AssetItem', () => ({
    AccountAssetItemView: ({
        accountBalance,
    }: {
        accountBalance: { assetId: string }
    }) => <div data-testid={`asset-item-${accountBalance.assetId}`} />,
}))

const mockUseRekeyedAccountInfoBottomSheet = vi.hoisted(() => vi.fn())

vi.mock('../useRekeyedAccountInfoBottomSheet', () => ({
    useRekeyedAccountInfoBottomSheet: mockUseRekeyedAccountInfoBottomSheet,
}))

const MOCK_ACCOUNT = {
    id: '1',
    address: 'P4ZYH3ABCDEFGHIJKLMNOPQRSTUVWXYZ1234YW4XM4',
    type: AccountTypes.algo25,
    rekeyAddress: 'Z6LHO4ABCDEFGHIJKLMNOPQRSTUVWXYZ1234WBYIMM',
    keyPairId: 'pk',
}

const MOCK_HOOK_RESULT = {
    rekeyedAccountBalances: [
        {
            assetId: '0',
            amount: Decimal(1027),
            algoValue: Decimal(1027),
        },
    ],
    rekeyedAccountAlgoValue: Decimal(1027),
    authAddress: 'Z6LHO4ABCDEFGHIJKLMNOPQRSTUVWXYZ1234WBYIMM',
    authAccountAlgoValue: Decimal(0),
    isPending: false,
}

describe('RekeyedAccountInfoBottomSheet', () => {
    beforeEach(() => {
        mockUseRekeyedAccountInfoBottomSheet.mockReturnValue(MOCK_HOOK_RESULT)
    })

    it('renders section headers when visible', () => {
        render(
            <RekeyedAccountInfoBottomSheet
                isVisible={true}
                onClose={vi.fn()}
                account={MOCK_ACCOUNT}
            />,
        )

        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.info_sheet.account_details',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.info_sheet.assets',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.info_sheet.can_be_signed_by',
            ),
        ).toBeTruthy()
    })

    it('renders the account address in account details section', () => {
        render(
            <RekeyedAccountInfoBottomSheet
                isVisible={true}
                onClose={vi.fn()}
                account={MOCK_ACCOUNT}
            />,
        )

        expect(
            screen.getAllByText(MOCK_ACCOUNT.address).length,
        ).toBeGreaterThanOrEqual(1)
    })

    it('renders the auth address in can be signed by section', () => {
        render(
            <RekeyedAccountInfoBottomSheet
                isVisible={true}
                onClose={vi.fn()}
                account={MOCK_ACCOUNT}
            />,
        )

        expect(screen.getByText(MOCK_ACCOUNT.rekeyAddress)).toBeTruthy()
    })

    it('calls onClose when close button is pressed', () => {
        const onClose = vi.fn()
        render(
            <RekeyedAccountInfoBottomSheet
                isVisible={true}
                onClose={onClose}
                account={MOCK_ACCOUNT}
            />,
        )

        fireEvent.click(screen.getByTestId('close-button'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('hides can be signed by section when no auth address', () => {
        mockUseRekeyedAccountInfoBottomSheet.mockReturnValue({
            ...MOCK_HOOK_RESULT,
            authAddress: undefined,
        })

        render(
            <RekeyedAccountInfoBottomSheet
                isVisible={true}
                onClose={vi.fn()}
                account={{ ...MOCK_ACCOUNT, rekeyAddress: undefined }}
            />,
        )

        expect(
            screen.queryByText(
                'onboarding.import_rekeyed_addresses.info_sheet.can_be_signed_by',
            ),
        ).toBeNull()
    })
})
