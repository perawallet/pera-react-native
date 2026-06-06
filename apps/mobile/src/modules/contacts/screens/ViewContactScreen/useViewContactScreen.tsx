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
import { type Contact, useContacts } from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'

import { useBottomSheet } from '@modules/bottom-sheet'
import { ContactQRContent } from '@modules/contacts/components/ContactQRContent'
import { shareText } from '@utils/shareText'
import { useAppNavigation } from '@hooks/useAppNavigation'

export type UseViewContactScreenResult = {
    selectedContact: Maybe<Contact>
    nfdName: Optional<string>
    openQR: () => void
    goToEdit: () => void
    handleShare: () => Promise<void>
}

export const useViewContactScreen = (): UseViewContactScreenResult => {
    const { selectedContact } = useContacts()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()

    const { data: nfdNames } = useNfdForAddressQuery(
        selectedContact?.address ?? '',
        { enabled: !!selectedContact?.address },
    )
    const nfdName = nfdNames?.at(0)?.name

    const openQR = useCallback(() => {
        if (!selectedContact) return
        void requestBottomSheet<void>({
            contents: <ContactQRContent contact={selectedContact} />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
    }, [requestBottomSheet, selectedContact])

    const goToEdit = useCallback(() => {
        navigation.navigate('EditContact')
    }, [navigation])

    const handleShare = useCallback(async () => {
        if (!selectedContact) return
        try {
            await shareText({
                title: selectedContact.name,
                message: selectedContact.address,
            })
        } catch {
            // User cancelled — ignore.
        }
    }, [selectedContact])

    return {
        selectedContact,
        nfdName,
        openQR,
        goToEdit,
        handleShare,
    }
}
