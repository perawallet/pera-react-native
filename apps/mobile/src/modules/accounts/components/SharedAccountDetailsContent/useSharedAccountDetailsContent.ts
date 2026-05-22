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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useBottomSheetResult } from '@modules/bottom-sheet'

type UseSharedAccountDetailsContentResult = {
    isUserIncluded: boolean
    isAddressInWallet: (address: string) => boolean
    handleEditContact: (address: string) => void
}

/**
 * Derives whether one of the user's own wallet accounts is a participant of
 * the shared account, so the detail sheet can show the "You included" label,
 * and exposes the edit-contact action used by non-wallet participant rows.
 */
export const useSharedAccountDetailsContent = (
    addresses: string[],
): UseSharedAccountDetailsContentResult => {
    const accounts = useAllAccounts()
    const navigation = useAppNavigation()
    const { dismiss } = useBottomSheetResult<void>()
    const { contacts, setSelectedContact } = useContacts()

    const accountAddressSet = useMemo(
        () => new Set(accounts.map(a => a.address)),
        [accounts],
    )

    const isAddressInWallet = useCallback(
        (address: string) => accountAddressSet.has(address),
        [accountAddressSet],
    )

    const isUserIncluded = useMemo(
        () => addresses.some(isAddressInWallet),
        [addresses, isAddressInWallet],
    )

    const handleEditContact = useCallback(
        (address: string) => {
            const existingContact =
                contacts.find(c => c.address === address) ?? null
            dismiss()
            if (existingContact) {
                // EditContactScreen reads the contact via the contacts store
                // (selectedContact), not route params — set it before
                // navigating so the form opens populated.
                setSelectedContact(existingContact)
                navigation.navigate('Contacts', { screen: 'EditContact' })
                return
            }
            navigation.navigate('Contacts', {
                screen: 'AddContact',
                params: { address },
            })
        },
        [contacts, dismiss, navigation, setSelectedContact],
    )

    return {
        isUserIncluded,
        isAddressInWallet,
        handleEditContact,
    }
}
