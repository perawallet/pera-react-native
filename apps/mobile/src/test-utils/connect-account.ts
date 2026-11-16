/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
    ownAddressOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

export const EVM_CONNECT_ROW = 'wc_evm_account_row'

/**
 * Makes `account` the EVM account of an open connect sheet: EVM chains take one
 * account from the row, picked through the picker when the row shows another.
 */
export const selectEvmConnectAccount = async (
    account: WalletAccount,
): Promise<void> => {
    await waitFor(
        () => expect(screen.getByTestId(EVM_CONNECT_ROW)).toBeTruthy(),
        {
            timeout: 5000,
        },
    )
    const name = account.name ?? ''
    if (!within(screen.getByTestId(EVM_CONNECT_ROW)).queryByText(name)) {
        fireEvent.click(screen.getByTestId(EVM_CONNECT_ROW))
        const option = `connect_account_picker-${ownAddressOf(account)}`
        await waitFor(() => expect(screen.getByTestId(option)).toBeTruthy())
        fireEvent.click(screen.getByTestId(option))
    }
    await waitFor(() =>
        expect(
            within(screen.getByTestId(EVM_CONNECT_ROW)).getByText(name),
        ).toBeTruthy(),
    )
}
