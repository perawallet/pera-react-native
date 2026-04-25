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

import { useCallback } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useMultisigCreationStore } from '../../hooks/useMultisigCreation'
import type { MultisigStackParamList } from '../../routes/types'

const nicknameSchema = z.object({
    name: z.string().min(1, { message: 'Please enter a nickname' }),
})

type EditParticipantFormValues = z.infer<typeof nicknameSchema>

type UseEditParticipantScreenResult = {
    address: string
    control: Control<EditParticipantFormValues>
    isDoneDisabled: boolean
    handleDone: () => void
    handleRemove: () => void
}

export const useEditParticipantScreen = (): UseEditParticipantScreenResult => {
    const navigation = useAppNavigation()
    const route =
        useRoute<RouteProp<MultisigStackParamList, 'EditParticipant'>>()
    const { address } = route.params

    const { findContacts, addContact, editContact } = useContacts()
    const removeParticipant = useMultisigCreationStore(
        state => state.removeParticipant,
    )
    const updateParticipant = useMultisigCreationStore(
        state => state.updateParticipant,
    )

    const existingContacts = findContacts({
        keyword: address,
        matchAddress: true,
        matchName: false,
        matchNFD: false,
    })
    const existingContact = existingContacts.find(c => c.address === address)

    const {
        control,
        handleSubmit,
        formState: { isValid },
    } = useForm<EditParticipantFormValues>({
        resolver: zodResolver(nicknameSchema),
        mode: 'onChange',
        defaultValues: {
            name: existingContact?.name ?? '',
        },
    })

    const onDone = useCallback(
        (data: EditParticipantFormValues) => {
            const nickname = data.name.trim()
            const contactData = { name: nickname, address }
            if (existingContact) {
                editContact(address, contactData)
            } else {
                addContact(contactData)
            }
            updateParticipant(address, nickname)
            navigation.goBack()
        },
        [
            address,
            existingContact,
            addContact,
            editContact,
            updateParticipant,
            navigation,
        ],
    )

    const handleDone = handleSubmit(onDone)

    const handleRemove = useCallback(() => {
        removeParticipant(address)
        navigation.goBack()
    }, [removeParticipant, address, navigation])

    return {
        address,
        control,
        isDoneDisabled: !isValid,
        handleDone,
        handleRemove,
    }
}
