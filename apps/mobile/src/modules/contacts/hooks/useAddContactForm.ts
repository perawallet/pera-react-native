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
    contactFromFormValues,
    useContacts,
    type ContactFormValues,
    type NewContact,
} from '@perawallet/wallet-core-contacts'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { trackEvent, ContactsEvent } from '@analytics'
import { contactFamilyOf } from '../utils/contactFamily'
import { useContactForm, type UseContactFormResult } from './useContactForm'

import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ContactsStackParamsList } from '@modules/contacts/routes'

export type UseAddContactFormResult = UseContactFormResult & {
    save: (data: ContactFormValues) => void
}

export const useAddContactForm = (): UseAddContactFormResult => {
    const { addContact, setSelectedContact } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    // Forwarded by ADD_CONTACT deeplinks and the AccountActions sheet so the
    // form opens with the address (and optional label → name) prefilled.
    const route = useRoute<RouteProp<ContactsStackParamsList, 'AddContact'>>()
    const prefillAddress = route.params?.address ?? ''
    const prefillName = route.params?.label ?? ''
    const family = contactFamilyOf(route.params?.chainId)
    const initialContact = useMemo<Nullable<NewContact>>(() => {
        if (!prefillAddress && !prefillName) return null
        return { addresses: { [family]: prefillAddress }, name: prefillName }
    }, [family, prefillAddress, prefillName])
    const form = useContactForm(initialContact)

    const save = useCallback(
        (data: ContactFormValues) => {
            if (!form.isValid) return

            addContact(contactFromFormValues(data))
            trackEvent(ContactsEvent.Add)

            setSelectedContact(null)
            navigation.goBack()
        },
        [form, addContact, setSelectedContact, navigation],
    )

    return useMemo(() => ({ ...form, save }), [form, save])
}
