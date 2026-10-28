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

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import * as Clipboard from 'expo-clipboard'

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { render } from '@test-utils/render'
import { longPress, queryPressableByText } from '@test-utils/rnw'

import { AccountOptionsContent } from '@modules/accounts/components/AccountOptionsContent'

import {
    hdSiblingOf,
    seedHdAccount,
    SheetHost,
} from './__fixtures__/accountOptions'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand'], capabilities: {} },
        },
    }
})

describe('Flow: the account options sheet in a single-chain build', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.mocked(Clipboard.setStringAsync).mockClear()
    })

    it('Given a single-chain build, when the user opens the wallet structure, then each row shows its name over a copyable address, with no badge, chain icons or subtitle', async () => {
        const account = await seedHdAccount()
        useAccountsStore
            .getState()
            .setAccounts([account, hdSiblingOf(account, ALGO25_TEST_ADDRESS)])
        const siblingAddress = addressCodecs
            .get('algorand')
            .truncate(ALGO25_TEST_ADDRESS)

        render(
            <SheetHost
                contents={
                    <AccountOptionsContent
                        account={account}
                        onShowAddress={() => {}}
                    />
                }
            />,
        )

        expect(
            await screen.findByText('account_options.networks_title'),
        ).toBeTruthy()

        fireEvent.click(
            await screen.findByText('account_info.see_wallet_structure'),
        )

        expect(
            await screen.findByText('account_info.scan_new_addresses'),
        ).toBeTruthy()
        expect(screen.getByText(siblingAddress)).toBeTruthy()
        expect(screen.queryByText('account_info.viewing')).toBeNull()
        expect(screen.queryByTestId('chain_icon_stack_algorand')).toBeNull()
        expect(
            screen.queryByText('account_info.universal_wallet_subtitle'),
        ).toBeNull()
        expect(
            screen.queryByTestId('account_structure_row_hd-sibling'),
        ).toBeNull()

        await longPress(queryPressableByText(siblingAddress)!)

        await waitFor(() =>
            expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
                ALGO25_TEST_ADDRESS,
            ),
        )
    })
})
