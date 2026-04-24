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
    DuplicateAddressError,
    useContacts,
} from '@perawallet/wallet-core-contacts'

import { useLanguage } from '@hooks/useLanguage'
import { useContactForm } from './useContactForm'

import type { ParamListBase } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { UseContactFormResult } from './useContactForm'

export type UseAddContactFormResult = UseContactFormResult & {
    save: (data: Contact) => void
}

export const useAddContactForm = (): UseAddContactFormResult => {
    const { saveContact, setSelectedContact } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const form = useContactForm(null)

    const save = useCallback(
        (data: Contact) => {
            if (!form.isValid) return

            try {
                saveContact(data)
            } catch (e) {
                if (e instanceof DuplicateAddressError) {
                    form.setError('address', {
                        message: t(
                            'contacts.add_contact.duplicate_address_error',
                        ),
                    })
                    return
                }
                throw e
            }

            setSelectedContact(null)
            navigation.goBack()
        },
        [form, t, saveContact, setSelectedContact, navigation],
    )

    return useMemo(() => ({ ...form, save }), [form, save])
}
