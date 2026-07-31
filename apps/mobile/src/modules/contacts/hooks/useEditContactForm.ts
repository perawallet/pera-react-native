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

import { useCallback, useMemo } from 'react'
import {
    useNavigation,
    useRoute,
    type ParamListBase,
    type RouteProp,
} from '@react-navigation/native'
import {
    ContactNotFoundError,
    DuplicateAddressError,
    useContacts,
    type Contact,
} from '@perawallet/wallet-core-contacts'

import { useLanguage } from '@hooks/useLanguage'
import { trackEvent, ContactsEvent } from '@analytics'
import { useContactForm, type UseContactFormResult } from './useContactForm'

import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ContactsStackParamsList } from '@modules/contacts/routes'

export type UseEditContactFormResult = UseContactFormResult & {
    /**
     * The contact being edited: the deeplink target when the screen was reached
     * via QR/deeplink, otherwise the in-app store selection. Deliberately not
     * named `selectedContact` — it is no longer always the store's selection.
     */
    contact: Contact | null
    save: (data: Contact) => void
    removeContact: () => void
}

export const useEditContactForm = (): UseEditContactFormResult => {
    const {
        editContact,
        deleteContact,
        contacts,
        selectedContact,
        setSelectedContact,
    } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()

    // EDIT_CONTACT deeplinks / QR carry the target address+label in route
    // params. When present, the contact to edit is the one that address
    // identifies — resolve it from the store (falling back to the link's own
    // values when it isn't a saved contact yet, e.g. after a force-quit before
    // the store rehydrates), NOT whatever was previously selected in-app.
    // Without this a QR "for B" would prefill, edit, and delete the stale
    // in-app selection A. In-app (no params) keeps using the store selection.
    const route = useRoute<RouteProp<ContactsStackParamsList, 'EditContact'>>()
    const routeAddress = route.params?.address
    const routeLabel = route.params?.label
    const targetContact = useMemo<Contact | null>(() => {
        if (!routeAddress) return selectedContact
        return (
            contacts.find(contact => contact.address === routeAddress) ?? {
                address: routeAddress,
                name: routeLabel ?? '',
            }
        )
    }, [routeAddress, routeLabel, contacts, selectedContact])

    const form = useContactForm(targetContact)

    const save = useCallback(
        (data: Contact) => {
            if (!form.isValid || !targetContact) return

            try {
                editContact(targetContact.address, data)
                trackEvent(ContactsEvent.Edit)
            } catch (e) {
                if (e instanceof DuplicateAddressError) {
                    form.setError('address', {
                        message: t(
                            'contacts.add_contact.duplicate_address_error',
                        ),
                    })
                    return
                }
                if (e instanceof ContactNotFoundError) {
                    // The contact was removed (e.g. on another device)
                    // between selection and save. Drop the stale
                    // selection and pop back rather than reporting a
                    // false success.
                    setSelectedContact(null)
                    navigation.goBack()
                    return
                }
                throw e
            }

            // Keep the saved contact as selected so ViewContact re-renders
            // with the updated values when we pop back.
            setSelectedContact(data)
            navigation.goBack()
        },
        [form, t, editContact, targetContact, setSelectedContact, navigation],
    )

    const removeContact = useCallback(() => {
        // `deleteContact` reports whether it matched. A deeplink can name an
        // address that was never saved, in which case the target is synthesized
        // from the link and there is nothing to remove — don't report a Delete
        // that didn't happen or clear a selection we never owned.
        if (targetContact && deleteContact(targetContact)) {
            trackEvent(ContactsEvent.Delete)
            setSelectedContact(null)
        }
        navigation.replace('Contacts')
    }, [targetContact, deleteContact, setSelectedContact, navigation])

    return useMemo(
        () => ({
            ...form,
            contact: targetContact,
            save,
            removeContact,
        }),
        [form, targetContact, save, removeContact],
    )
}
