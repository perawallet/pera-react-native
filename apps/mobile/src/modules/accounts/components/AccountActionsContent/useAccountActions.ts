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
import { useContacts, type Contact } from '@perawallet/wallet-core-contacts'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useSendFundsStore } from '@modules/transactions'

type UseAccountActionsParams = {
    address: string
    label?: string
    onClose: () => void
}

type UseAccountActionsResult = {
    /**
     * Every contact saved at this address; more than one when the same person
     * is kept as two contacts. The sheet offers "Edit Contact" for each, or
     * "Add New Contact" when there are none.
     */
    existingContacts: Contact[]
    canAddWatchAccount: boolean
    openSendTransaction: () => void
    openWatchAddress: () => void
    addContact: () => void
    editContact: (contact: Contact) => void
}

export const useAccountActions = ({
    address,
    label,
    onClose,
}: UseAccountActionsParams): UseAccountActionsResult => {
    const navigation = useAppNavigation()
    const { requestByType } = useBottomSheet()
    const { contacts, setSelectedContact } = useContacts()
    const canAddWatchAccount = useCapability({ anyChain: 'watchAccounts' })

    const existingContacts = useMemo(
        // The address may be on any chain, so any of a contact's families can hold it.
        () =>
            contacts.filter(c => Object.values(c.addresses).includes(address)),
        [contacts, address],
    )

    const openSendTransaction = useCallback(() => {
        // Prefill the destination via the send-funds store, then open the
        // SendFunds bottom sheet — same pattern as the deeplink ALGO/ASSET
        // transfer handlers.
        const sendFundsStore = useSendFundsStore.getState()
        sendFundsStore.reset()
        sendFundsStore.setDestination(address)

        onClose()

        void requestByType(
            'send-funds',
            {},
            {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        )
    }, [address, onClose, requestByType])

    const openWatchAddress = useCallback(() => {
        onClose()
        navigation.navigate('AddAccount', {
            screen: 'WatchAccount',
            params: { prefillAddress: address },
        })
    }, [address, navigation, onClose])

    const addContact = useCallback(() => {
        onClose()
        navigation.navigate('Contacts', {
            screen: 'AddContact',
            params: { address, label },
        })
    }, [address, label, navigation, onClose])

    const editContact = useCallback(
        (contact: Contact) => {
            onClose()
            // EditContactScreen reads the contact via the contacts store
            // (selectedContact), not route params — set it before navigating
            // so the form opens populated.
            setSelectedContact(contact)
            navigation.navigate('Contacts', { screen: 'EditContact' })
        },
        [navigation, onClose, setSelectedContact],
    )

    return {
        existingContacts,
        canAddWatchAccount,
        openSendTransaction,
        openWatchAddress,
        addContact,
        editContact,
    }
}
