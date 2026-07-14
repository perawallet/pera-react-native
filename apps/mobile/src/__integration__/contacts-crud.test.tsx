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

// `expo-image-picker` is a native module: importing it under jsdom drags in
// `expo/src/winter/runtime` and crashes resolving `./ImportMetaRegistry`.
// The contact form's image-picker affordance is irrelevant to CRUD, so stub
// the surface `useImagePicker` consumes.
vi.mock('expo-image-picker', () => ({
    getMediaLibraryPermissionsAsync: vi.fn(async () => ({
        granted: true,
        canAskAgain: true,
    })),
    requestMediaLibraryPermissionsAsync: vi.fn(async () => ({
        granted: true,
    })),
    launchImageLibraryAsync: vi.fn(async () => ({
        canceled: true,
        assets: [],
    })),
}))

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { PWButton } from '@components/core'
import { ContactForm } from '@components/ContactForm'
import { AddContactScreen } from '@modules/contacts/screens/AddContactScreen/AddContactScreen'
import { EditContactScreen } from '@modules/contacts/screens/EditContactScreen/EditContactScreen'
import { useEditContactForm } from '@modules/contacts/hooks'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

// EditContactScreen navigates to a 'Contacts' route after a delete via
// navigation.replace. Register a stand-in so the transition has a target.
const ContactsListPlaceholder = () => null

// EditContactScreen's "save" button lives in the native-stack header, which
// the integration test navigator drops (setOptions is a no-op). This host
// runs the real `useEditContactForm` + real `ContactForm` and surfaces the
// same `handleSubmit(save)` through a body button so the edit-save path is
// reachable end-to-end.
const EditContactHost = () => {
    const {
        control,
        handleSubmit,
        errors,
        isValid,
        rawAddressInput,
        nfd,
        onAddressInputChange,
        selectedContact,
        save,
    } = useEditContactForm()

    return (
        <>
            <ContactForm
                control={control}
                address={selectedContact?.address ?? ''}
                nameLabel='name'
                addressLabel='address'
                nameError={errors.name?.message}
                addressError={errors.address?.message}
                onAddressInputChange={onAddressInputChange}
                rawAddressInput={rawAddressInput}
                nfdName={nfd.isNfdResolved ? nfd.nfdName : undefined}
            />
            <PWButton
                title='save'
                variant='primary'
                isDisabled={!isValid}
                onPress={() => void handleSubmit(save)()}
                testID='edit_contact_save_button'
            />
        </>
    )
}

const SENDER_ACCOUNT: WalletAccount = {
    id: 'sender-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'sender-key',
    name: 'Sender',
}

const seedContact = (name: string, address: string) => {
    const { result } = renderHook(() => useContacts())
    act(() => {
        result.current.addContact({ name, address })
    })
}

const selectContact = (name: string, address: string) => {
    const { result } = renderHook(() => useContacts())
    act(() => {
        result.current.setSelectedContact({ name, address })
    })
}

const resetContacts = () => {
    const { result } = renderHook(() => useContacts())
    act(() => {
        for (const c of result.current.contacts) {
            result.current.deleteContact(c)
        }
        result.current.setSelectedContact(null)
    })
}

const readContacts = () => {
    const { result } = renderHook(() => useContacts())
    return result.current.contacts
}

describe('Flow: Contacts CRUD', () => {
    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([SENDER_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SENDER_ACCOUNT.address)
        resetContacts()
    })

    afterEach(() => {
        resetContacts()
    })

    it(
        'Given AddContactScreen, when a valid name and address are entered and submit is tapped, then the contact is persisted',
        async () => {
            renderWithNavigation(AddContactScreen, 'AddContact')

            fireEvent.change(screen.getByTestId('contact_name_input'), {
                target: { value: 'Alice' },
            })
            fireEvent.change(screen.getByTestId('contact_address_input'), {
                target: { value: HD_TEST_ADDRESS },
            })

            await waitFor(() => {
                expect(
                    (
                        screen.getByTestId(
                            'add_contact_button',
                        ) as HTMLButtonElement
                    ).disabled,
                ).toBe(false)
            })
            fireEvent.click(screen.getByTestId('add_contact_button'))

            await waitFor(() => {
                expect(readContacts()).toHaveLength(1)
            })
            const [contact] = readContacts()
            expect(contact.name).toBe('Alice')
            expect(contact.address).toBe(HD_TEST_ADDRESS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a duplicate address is entered on AddContactScreen, when submit is tapped, then no second contact is added',
        async () => {
            seedContact('Existing', HD_TEST_ADDRESS)

            renderWithNavigation(AddContactScreen, 'AddContact')

            fireEvent.change(screen.getByTestId('contact_name_input'), {
                target: { value: 'Duplicate' },
            })
            fireEvent.change(screen.getByTestId('contact_address_input'), {
                target: { value: HD_TEST_ADDRESS },
            })

            await waitFor(() => {
                expect(
                    (
                        screen.getByTestId(
                            'add_contact_button',
                        ) as HTMLButtonElement
                    ).disabled,
                ).toBe(false)
            })
            fireEvent.click(screen.getByTestId('add_contact_button'))

            await waitFor(() => {
                expect(
                    screen
                        .getByTestId('contact_address_input')
                        .getAttribute('errormessage'),
                ).toBe('contacts.add_contact.duplicate_address_error')
            })
            expect(readContacts()).toHaveLength(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it('Given a selected contact, when EditContactScreen mounts, then the form prefills with the contact name and address', () => {
        seedContact('Alice', HD_TEST_ADDRESS)
        selectContact('Alice', HD_TEST_ADDRESS)

        renderWithNavigation(EditContactScreen, 'EditContact', {
            additionalScreens: [
                { name: 'Contacts', component: ContactsListPlaceholder },
            ],
        })

        expect(
            (screen.getByTestId('contact_name_input') as HTMLInputElement)
                .value,
        ).toBe('Alice')
        expect(
            (screen.getByTestId('contact_address_input') as HTMLInputElement)
                .value,
        ).toBe(HD_TEST_ADDRESS)
    })

    it(
        'Given a selected contact, when the name is changed and the edit form is saved, then the store reflects the updated name',
        async () => {
            seedContact('Alice', HD_TEST_ADDRESS)
            selectContact('Alice', HD_TEST_ADDRESS)

            renderWithNavigation(EditContactHost, 'EditContact')

            fireEvent.change(screen.getByTestId('contact_name_input'), {
                target: { value: 'Alice Renamed' },
            })

            await waitFor(() => {
                expect(
                    (
                        screen.getByTestId(
                            'edit_contact_save_button',
                        ) as HTMLButtonElement
                    ).disabled,
                ).toBe(false)
            })
            fireEvent.click(screen.getByTestId('edit_contact_save_button'))

            await waitFor(() => {
                expect(readContacts()[0]?.name).toBe('Alice Renamed')
            })
            expect(readContacts()).toHaveLength(1)
            expect(readContacts()[0].address).toBe(HD_TEST_ADDRESS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a selected contact, when delete is confirmed in the bottom sheet, then the contact is removed from the store',
        async () => {
            seedContact('Alice', HD_TEST_ADDRESS)
            selectContact('Alice', HD_TEST_ADDRESS)

            renderWithNavigation(EditContactScreen, 'EditContact', {
                additionalScreens: [
                    { name: 'Contacts', component: ContactsListPlaceholder },
                ],
            })

            fireEvent.click(screen.getByTestId('edit_contact_delete_button'))

            await waitFor(() =>
                screen.getByTestId('contact_delete_confirm_button'),
            )
            fireEvent.click(screen.getByTestId('contact_delete_confirm_button'))

            await waitFor(() => {
                expect(readContacts()).toHaveLength(0)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
