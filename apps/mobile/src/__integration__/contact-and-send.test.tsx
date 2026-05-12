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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { ContactListScreen } from '@modules/contacts/screens/ContactListScreen/ContactListScreen'
import { AddressSearchView } from '@components/AddressSearchView'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

// Add a contact via the public `useContacts` hook (no direct store
// access — `useContactsStore` is internal). Ensures the persisted
// state is the one the screens read.
const addTestContact = (name: string, address: string) => {
    const { result } = renderHook(() => useContacts())
    result.current.addContact({ name, address })
}

// Reset by deleting all current contacts via the same hook.
const resetTestContacts = () => {
    const { result } = renderHook(() => useContacts())
    for (const c of result.current.contacts) {
        result.current.deleteContact(c)
    }
}

const SLOW_TEST_TIMEOUT_MS = 30000

const SENDER_ACCOUNT: WalletAccount = {
    id: 'sender-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'sender-key',
    name: 'Sender',
}

describe('Flow: Contacts → use in send destination picker', () => {
    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([SENDER_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SENDER_ACCOUNT.address)
        resetTestContacts()
        vi.mocked(Notifier.showNotification).mockClear()
    })

    afterEach(() => {
        resetTestContacts()
    })

    it('Given the contacts store is empty, when ContactListScreen mounts, then the empty view is shown', () => {
        renderWithNavigation(ContactListScreen, 'ContactList')

        // The empty-view button has no testid; assert by its label.
        // i18n returns the key under the integration setup.
        const emptyButton = screen
            .getAllByRole('button')
            .find(b =>
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

    it(
        'Given a contact is in the store, when AddressSearchView searches by name, then the matching contact surfaces and tapping it fires onSelected with the address',
        async () => {
            addTestContact('Alice', HD_TEST_ADDRESS)

            const onSelected = vi.fn()
            renderWithNavigation(
                () => (
                    <AddressSearchView
                        onSelected={onSelected}
                        showAllContactsWhenEmpty
                    />
                ),
                'AddressSearchHost',
            )

            // With `showAllContactsWhenEmpty`, contacts surface without
            // typing. Each row renders an `AddressDisplay` with the
            // contact's name as its label (when one is set) — match by
            // the name, not the address.
            await waitFor(() => {
                expect(
                    screen.queryAllByText(
                        (_, node) => (node?.textContent ?? '') === 'Alice',
                    ).length,
                ).toBeGreaterThan(0)
            })

            const matches = screen.getAllByText(
                (_, node) => (node?.textContent ?? '') === 'Alice',
            )
            const leaf =
                matches.find(el => el.children.length === 0) ?? matches[0]
            const row = leaf.closest('button')
            if (!row) {
                throw new Error('Contact row button not found')
            }
            fireEvent.click(row)

            expect(onSelected).toHaveBeenCalledWith(HD_TEST_ADDRESS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
