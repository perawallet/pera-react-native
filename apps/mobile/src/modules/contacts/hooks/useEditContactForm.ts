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

import { useCallback, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    ContactNotFoundError,
    DuplicateAddressError,
    useContacts,
} from '@perawallet/wallet-core-contacts'

import { useLanguage } from '@hooks/useLanguage'
import { trackEvent, ContactsEvent } from '@perawallet/wallet-core-analytics'
import { useContactForm } from './useContactForm'

import type { ParamListBase } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { UseContactFormResult } from './useContactForm'

export type UseEditContactFormResult = UseContactFormResult & {
    selectedContact: Contact | null
    save: (data: Contact) => void
    removeContact: () => void
}

export const useEditContactForm = (): UseEditContactFormResult => {
    const { editContact, deleteContact, selectedContact, setSelectedContact } =
        useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const form = useContactForm(selectedContact)

    const save = useCallback(
        (data: Contact) => {
            if (!form.isValid || !selectedContact) return

            try {
                editContact(selectedContact.address, data)
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
        [form, t, editContact, selectedContact, setSelectedContact, navigation],
    )

    const removeContact = useCallback(() => {
        if (selectedContact) {
            deleteContact(selectedContact)
            trackEvent(ContactsEvent.Delete)
            setSelectedContact(null)
        }
        navigation.replace('Contacts')
    }, [selectedContact, deleteContact, setSelectedContact, navigation])

    return useMemo(
        () => ({
            ...form,
            selectedContact,
            save,
            removeContact,
        }),
        [form, selectedContact, save, removeContact],
    )
}
