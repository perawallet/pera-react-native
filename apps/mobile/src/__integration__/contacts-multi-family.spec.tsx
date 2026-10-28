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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'

// The integration setup registers whichever chains config enables.
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

import { useContacts } from '@perawallet/wallet-core-contacts'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { isElementDisabled } from '@test-utils/rnw'
import { AddressSearchView } from '@components/AddressSearchView'
import { AddContactScreen } from '@modules/contacts/screens/AddContactScreen/AddContactScreen'
import { ContactListScreen } from '@modules/contacts/screens/ContactListScreen/ContactListScreen'
import { ViewContactScreen } from '@modules/contacts/screens/ViewContactScreen/ViewContactScreen'
import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const EVM_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const CHECKSUMMED_EVM_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const contactsHook = () => renderHook(() => useContacts()).result

const resetContacts = () => {
    const result = contactsHook()
    act(() => {
        for (const contact of result.current.contacts) {
            result.current.deleteContact(contact.id)
        }
        result.current.setSelectedContact(null)
    })
}

const seedBothFamilies = () => {
    const result = contactsHook()
    act(() => {
        result.current.addContact({
            name: 'Alice',
            addresses: {
                algorand: HD_TEST_ADDRESS,
                evm: CHECKSUMMED_EVM_ADDRESS,
            },
        })
    })
    return contactsHook().current.contacts[0]!
}

const renderPicker = (chainId: 'algorand' | 'ethereum') => {
    const onSelected = vi.fn()
    renderWithNavigation(
        () => (
            <AddressSearchView
                onSelected={onSelected}
                scope={{ chainId, networkId: 'mainnet' }}
                showAllContactsWhenEmpty
            />
        ),
        'AddressSearchHost',
    )
    return onSelected
}

const pickAlice = async () => {
    await waitFor(() =>
        expect(
            screen.queryAllByText(
                (_, node) => (node?.textContent ?? '') === 'Alice',
            ).length,
        ).toBeGreaterThan(0),
    )
    const matches = screen.getAllByText(
        (_, node) => (node?.textContent ?? '') === 'Alice',
    )
    const leaf = matches.find(el => el.children.length === 0) ?? matches[0]!
    fireEvent.click(leaf.closest('[role="button"]') ?? leaf)
}

describe('Flow: contacts with an address per chain family', () => {
    beforeEach(() => {
        resetContacts()
    })

    afterEach(() => {
        resetContacts()
    })

    it('Given AddContactScreen, when a 0x address is pasted, then it is saved under the EVM family, checksummed, without the user picking one', async () => {
        renderWithNavigation(AddContactScreen, 'AddContact')

        fireEvent.change(screen.getByTestId('contact_name_input'), {
            target: { value: 'Alice' },
        })
        fireEvent.change(screen.getByTestId('contact_address_input'), {
            target: { value: EVM_ADDRESS },
        })

        await waitFor(() =>
            expect(screen.getByTestId('contact_address_row_evm')).toBeTruthy(),
        )
        expect(screen.getByText('chain_families.evm')).toBeTruthy()
        await waitFor(() =>
            expect(
                isElementDisabled(screen.getByTestId('add_contact_button')),
            ).toBe(false),
        )
        fireEvent.click(screen.getByTestId('add_contact_button'))

        await waitFor(() =>
            expect(contactsHook().current.contacts).toHaveLength(1),
        )
        expect(contactsHook().current.contacts[0]!.addresses).toEqual({
            evm: CHECKSUMMED_EVM_ADDRESS,
        })
    })

    it('Given a contact with an EVM address, when Send runs from an Ethereum account, then the picker offers its EVM address; from an Algorand account its Algorand address', async () => {
        seedBothFamilies()

        const onEthereum = renderPicker('ethereum')
        await pickAlice()
        expect(onEthereum).toHaveBeenCalledWith(CHECKSUMMED_EVM_ADDRESS)
    })

    it('Given a contact with an Algorand and an EVM address, when the Algorand picker opens, then it offers the Algorand address', async () => {
        seedBothFamilies()

        const onAlgorand = renderPicker('algorand')
        await pickAlice()
        expect(onAlgorand).toHaveBeenCalledWith(HD_TEST_ADDRESS)
    })

    it('Given a contact with two addresses, then the list counts its networks and search finds it by either address', async () => {
        seedBothFamilies()

        renderWithNavigation(ContactListScreen, 'ContactsList')

        expect(screen.getByText('contacts.list.networks_count')).toBeTruthy()

        for (const term of [
            EVM_ADDRESS.slice(2, 10),
            HD_TEST_ADDRESS.slice(0, 8),
        ]) {
            fireEvent.change(screen.getByTestId('contacts_search_input'), {
                target: { value: term },
            })
            await waitFor(() =>
                expect(
                    screen.getByTestId(`contact_row_${HD_TEST_ADDRESS}`),
                ).toBeTruthy(),
            )
        }
    })

    it('Given a contact with two addresses, when it is viewed, then each family has its own row with copy and QR', () => {
        const alice = seedBothFamilies()
        const contacts = contactsHook()
        act(() => {
            contacts.current.setSelectedContact(alice)
        })

        renderWithNavigation(ViewContactScreen, 'ViewContact')

        for (const family of ['algorand', 'evm']) {
            expect(
                screen.getByTestId(`view_contact_address_row_${family}`),
            ).toBeTruthy()
            expect(
                screen.getByTestId(`view_contact_copy_${family}`),
            ).toBeTruthy()
            expect(screen.getByTestId(`view_contact_qr_${family}`)).toBeTruthy()
        }
    })
})
