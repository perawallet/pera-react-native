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
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useSendFundsStore } from '@modules/transactions'
import { SelectDestinationScreen } from '@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const EVM_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
// One hex digit short: the paste that lost its last character.
const TRUNCATED_EVM_ADDRESS = EVM_ADDRESS.slice(0, -1)

const EVM_SENDER: WalletAccount = {
    id: 'evm-sender-1',
    custody: { kind: 'local', seed: null },
    chains: {
        ethereum: {
            address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            keyPairId: 'evm-key',
        },
    },
    name: 'EVM Sender',
}

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
        'address_entry.search_placeholder_recipient',
    )
    fireEvent.change(fields[fields.length - 1], { target: { value: text } })
}

const renderAndType = async (text: string) => {
    renderWithNavigation(SelectDestinationScreen, 'SelectDestination', {
        additionalScreens: [
            { name: 'ConfirmTransaction', component: ConfirmStub },
        ],
    })
    await waitFor(() =>
        expect(
            screen.getAllByPlaceholderText(
                'address_entry.search_placeholder_recipient',
            ).length,
        ).toBeGreaterThan(0),
    )
    typeIntoSearch(text)
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
                    'address_entry.search_placeholder_recipient',
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

describe('Flow: send to a malformed address', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        useContactsStore.getState().resetState()
        useSendFundsStore.getState().reset()
        useSendFundsStore.getState().setAmount(new Decimal(1))
    })

    const startEtherSend = () => {
        useAccountsStore.getState().setAccounts([EVM_SENDER])
        useAccountsStore.getState().setSelectedAccountId(EVM_SENDER.id)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
    }

    it('Given an ether send, when the user enters an address one hex digit short, then the invalid-address message shows instead of the search miss', async () => {
        startEtherSend()

        await renderAndType(TRUNCATED_EVM_ADDRESS)

        await waitFor(() =>
            expect(
                screen.getByText('address_entry.invalid_address.title'),
            ).toBeTruthy(),
        )
        expect(screen.queryByText('address_entry.no_accounts_found')).toBeNull()
        expect(useSendFundsStore.getState().destination).toBeUndefined()
    })

    it('Given an ether send and a contact at that address, when the user enters it one hex digit short, then the contact is listed with the invalid-address notice above it', async () => {
        useContactsStore
            .getState()
            .addContact({ addresses: { evm: EVM_ADDRESS }, name: 'QA Test' })
        startEtherSend()

        await renderAndType(TRUNCATED_EVM_ADDRESS)

        await waitFor(() => expect(screen.getByText('QA Test')).toBeTruthy())
        expect(
            screen.getByText('address_entry.invalid_address.body'),
        ).toBeTruthy()
    })

    it('Given an ALGO send, when the user enters a cut-off Algorand address, then the invalid-address message shows', async () => {
        useAccountsStore.getState().setAccounts([SENDER])
        useAccountsStore.getState().setSelectedAccountId(SENDER.id)
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: '0' })

        await renderAndType(ALGO25_TEST_ADDRESS.slice(0, -1))

        await waitFor(() =>
            expect(
                screen.getByText('address_entry.invalid_address.title'),
            ).toBeTruthy(),
        )
    })
})
