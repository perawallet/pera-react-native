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
    afterEach,
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
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
import { useContacts } from '@perawallet/wallet-core-contacts'
import { ContactListScreen } from '@modules/contacts/screens/ContactListScreen/ContactListScreen'
import { useSendFundsStore } from '@modules/transactions'
import { SelectDestinationScreen } from '@modules/transactions/screens/send-funds/SelectDestinationScreen'

import { closestPressable, getAllPressables } from '@test-utils/rnw'
import {
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
    HD_TEST_ADDRESS_1,
} from './__fixtures__/onboarding'

// Add a contact via the public `useContacts` hook (no direct store
// access — `useContactsStore` is internal). Ensures the persisted
// state is the one the screens read.
const addTestContact = (name: string, address: string) => {
    const { result } = renderHook(() => useContacts())
    result.current.addContact({ name, addresses: { algorand: address } })
}

// Reset by deleting all current contacts via the same hook.
const resetTestContacts = () => {
    const { result } = renderHook(() => useContacts())
    for (const c of result.current.contacts) {
        result.current.deleteContact(c.id)
    }
}

const SENDER_ACCOUNT: WalletAccount = {
    id: 'sender-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'sender-key' },
    },
    name: 'Sender',
}

describe('Flow: Contacts → use in send destination picker', () => {
    beforeAll(setupTestDatabase)
    afterAll(teardownTestDatabase)

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([SENDER_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(SENDER_ACCOUNT.id)
        useSendFundsStore.getState().reset()
        resetTestContacts()
    })

    afterEach(() => {
        resetTestContacts()
    })

    it('Given the contacts store is empty, when ContactListScreen mounts, then the empty view is shown', () => {
        renderWithNavigation(ContactListScreen, 'ContactList')

        // The empty-view button has no testid; assert by its label.
        // i18n returns the key under the integration setup.
        const emptyButton = getAllPressables().find(b =>
            (b.textContent ?? '').includes('contacts.list.add_contact'),
        )
        expect(emptyButton).toBeTruthy()
    })

    it('Given a contact is added to the store, when ContactListScreen mounts, then the contact name and truncated address render', () => {
        addTestContact('Alice', HD_TEST_ADDRESS)

        renderWithNavigation(ContactListScreen, 'ContactList')

        // Contact name + truncated address render in the row's
        // PWText elements.
        expect(
            screen.queryAllByText(
                (_, node) => (node?.textContent ?? '') === 'Alice',
            ).length,
        ).toBeGreaterThan(0)
        // The contact row renders a truncated version of the address
        // (e.g. `RP35...OFX7A`). Match the leading 4 chars — the
        // production truncation always keeps the prefix intact.
        const prefix = HD_TEST_ADDRESS.slice(0, 4)
        expect(
            screen.queryAllByText((_, node) =>
                (node?.textContent ?? '').includes(prefix),
            ).length,
        ).toBeGreaterThan(0)
    })

    it('Given saved contacts, when Send opens the destination screen, then contacts show in alphabetical order before and after searching', async () => {
        addTestContact('Zara', HD_TEST_ADDRESS_1)
        addTestContact('Alice', HD_TEST_ADDRESS)
        useSendFundsStore.getState().setSelectedAsset({
            chainId: 'algorand',
            assetId: '0',
        })
        useSendFundsStore.getState().setAmount(new Decimal(1))

        const ConfirmStub = () => null
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination', {
            additionalScreens: [
                { name: 'ConfirmTransaction', component: ConfirmStub },
            ],
        })
        const names = () =>
            screen.getAllByText(/^(Alice|Zara)$/).map(row => row.textContent)
        await waitFor(() => {
            expect(names()).toEqual(['Alice', 'Zara'])
        })
        const fields = screen.getAllByPlaceholderText(
            'address_entry.search_placeholder_recipient',
        )
        fireEvent.change(fields[fields.length - 1], { target: { value: 'a' } })
        await waitFor(() => expect(names()).toEqual(['Alice', 'Zara']))

        const row = closestPressable(screen.getByText('Alice'))
        if (!row) {
            throw new Error('Contact row button not found')
        }
        fireEvent.click(row)

        await waitFor(() =>
            expect(useSendFundsStore.getState().destination).toBe(
                HD_TEST_ADDRESS,
            ),
        )
    })
})
