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
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { Control } from 'react-hook-form'
import {
    ContactNotFoundError,
    DuplicateAddressError,
    useContacts,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useContactForm } from '@modules/contacts/hooks'
import { useMultisigCreationStore } from '../../hooks/useMultisigCreation'
import type { MultisigStackParamList } from '../../routes/types'
import type { Optional } from '@perawallet/wallet-core-shared'

type UseEditParticipantScreenResult = {
    address: string
    control: Control<Contact>
    imageUri: Optional<string>
    isDoneDisabled: boolean
    onPickImage: () => Promise<void>
    handleDone: () => Promise<void>
    handleRemove: () => void
}

export const useEditParticipantScreen = (): UseEditParticipantScreenResult => {
    const navigation = useAppNavigation()
    const route =
        useRoute<RouteProp<MultisigStackParamList, 'EditParticipant'>>()
    const { index, address } = route.params

    const { findContacts, addContact, editContact } = useContacts()
    const removeParticipant = useMultisigCreationStore(
        state => state.removeParticipant,
    )
    const updateParticipant = useMultisigCreationStore(
        state => state.updateParticipant,
    )

    const existingContact = useMemo(() => {
        const matches = findContacts({
            keyword: address,
            matchAddress: true,
            matchName: false,
            matchNFD: false,
        })
        return matches.find(c => c.address === address) ?? null
    }, [findContacts, address])

    const initialContact: Contact = useMemo(
        () => existingContact ?? { name: '', address },
        [existingContact, address],
    )

    const { control, handleSubmit, setError, isValid, imageUri, onPickImage } =
        useContactForm(initialContact)

    const onDone = useCallback(
        (data: Contact) => {
            const contactData: Contact = {
                ...data,
                name: data.name.trim(),
                address,
            }

            try {
                if (existingContact) {
                    editContact(address, contactData)
                } else {
                    addContact(contactData)
                }
            } catch (e) {
                if (e instanceof DuplicateAddressError) {
                    setError('address', { message: e.message })
                    return
                }
                if (e instanceof ContactNotFoundError) {
                    navigation.goBack()
                    return
                }
                throw e
            }

            updateParticipant(address, contactData.name)
            navigation.goBack()
        },
        [
            address,
            existingContact,
            addContact,
            editContact,
            updateParticipant,
            setError,
            navigation,
        ],
    )

    const handleDone = handleSubmit(onDone)

    const handleRemove = useCallback(() => {
        removeParticipant(index)
        navigation.goBack()
    }, [removeParticipant, index, navigation])

    return {
        address,
        control,
        imageUri,
        isDoneDisabled: !isValid,
        onPickImage,
        handleDone,
        handleRemove,
    }
}
