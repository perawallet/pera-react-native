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
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Text } from 'react-native'

// The integration setup registers whichever chains config enables, and the
// EVM codec has to be registered for its addresses to be recognised.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSendFundsStore } from '@modules/transactions'
import { SelectDestinationScreen } from '@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const EVM_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

const SENDER: WalletAccount = {
    id: 'sender-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'sender-key' },
    },
    name: 'Sender',
}

const ConfirmStub = () => <Text>confirm-transaction-screen</Text>

const typeIntoSearch = (text: string) => {
    // The sticky mirror renders first; the focusable field is the last.
    const fields = screen.getAllByPlaceholderText(
        'address_entry.search_placeholder',
    )
    fireEvent.change(fields[fields.length - 1], { target: { value: text } })
}

describe('Flow: send to an address on the other network', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        useAccountsStore.getState().setAccounts([SENDER])
        useAccountsStore.getState().setSelectedAccountId(SENDER.id)
        useSendFundsStore.getState().reset()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: '0' })
        useSendFundsStore.getState().setAmount(new Decimal(1))
    })

    it('Given an ALGO send, when the user enters an EVM address, then the wrong-network message shows and nothing lets the send continue', async () => {
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination', {
            additionalScreens: [
                { name: 'ConfirmTransaction', component: ConfirmStub },
            ],
        })

        await waitFor(() =>
            expect(
                screen.getAllByPlaceholderText(
                    'address_entry.search_placeholder',
                ).length,
            ).toBeGreaterThan(0),
        )
        typeIntoSearch(EVM_ADDRESS)

        await waitFor(() =>
            expect(
                screen.getByText('address_entry.wrong_network.title.evm'),
            ).toBeTruthy(),
        )
        expect(
            screen.getByText('address_entry.wrong_network.send_body.algorand'),
        ).toBeTruthy()
        expect(screen.queryByText('address_entry.address')).toBeNull()
        expect(screen.queryByText('address_entry.my_accounts')).toBeNull()
        expect(screen.queryByText('confirm-transaction-screen')).toBeNull()
        expect(useSendFundsStore.getState().destination).toBeUndefined()
    })
})
