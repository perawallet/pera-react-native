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
import { useContacts, type Contact } from '@perawallet/wallet-core-contacts'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useSendFundsStore } from '@modules/transactions/hooks'

type UseAccountActionsParams = {
    address: string
    label?: string
    onClose: () => void
}

type UseAccountActionsResult = {
    /**
     * The contact already saved at this address, if any. The sheet uses
     * this to flip the third action between "Add New Contact" and "Edit
     * Contact" — and `openContact` routes to the right screen.
     */
    existingContact: Contact | null
    openSendTransaction: () => void
    openWatchAddress: () => void
    openContact: () => void
}

export const useAccountActions = ({
    address,
    label,
    onClose,
}: UseAccountActionsParams): UseAccountActionsResult => {
    const navigation = useAppNavigation()
    const { requestByType } = useBottomSheet()
    const { contacts, setSelectedContact } = useContacts()

    const existingContact = useMemo(
        () => contacts.find(c => c.address === address) ?? null,
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

    const openContact = useCallback(() => {
        onClose()
        if (existingContact) {
            // EditContactScreen reads the contact via the contacts store
            // (selectedContact), not route params — set it before navigating
            // so the form opens populated.
            setSelectedContact(existingContact)
            navigation.navigate('Contacts', { screen: 'EditContact' })
            return
        }
        navigation.navigate('Contacts', {
            screen: 'AddContact',
            params: { address, label },
        })
    }, [
        address,
        label,
        existingContact,
        navigation,
        onClose,
        setSelectedContact,
    ])

    return {
        existingContact,
        openSendTransaction,
        openWatchAddress,
        openContact,
    }
}
