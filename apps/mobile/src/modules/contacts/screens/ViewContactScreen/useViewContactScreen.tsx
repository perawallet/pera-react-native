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
    CHAIN_FAMILIES,
    LEGACY_CHAIN_ID,
    type ChainFamily,
} from '@perawallet/wallet-core-chain-contract'
import { type Contact, useContacts } from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'

import { useBottomSheet } from '@modules/bottom-sheet'
import { ContactQRContent } from '@modules/contacts/components/ContactQRContent'
import { useSendToContact } from '@modules/contacts/hooks'
import { shareText } from '@utils/shareText'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useClipboard } from '@hooks/useClipboard'

export type ViewContactAddressRow = {
    family: ChainFamily
    address: string
    canSend: boolean
}

export type UseViewContactScreenResult = {
    selectedContact: Maybe<Contact>
    /** One per family the contact holds an address on, in family order. */
    addressRows: ViewContactAddressRow[]
    nfdName: Optional<string>
    openQR: (family: ChainFamily) => void
    copyAddress: (address: string) => void
    sendTo: (family: ChainFamily, address: string) => void
    goToEdit: () => void
    handleShare: () => Promise<void>
}

export const useViewContactScreen = (): UseViewContactScreenResult => {
    // NFDs name Algorand addresses only.
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { selectedContact } = useContacts()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const { copyToClipboard } = useClipboard()
    const { canSendOn, sendTo: sendToContact } = useSendToContact()

    const algorandAddress = selectedContact?.addresses.algorand ?? ''
    const { data: nfdNames } = useNfdForAddressQuery(scope, algorandAddress, {
        enabled: !!algorandAddress,
    })
    const nfdName = nfdNames?.at(0)?.name

    const addressRows = useMemo(
        (): ViewContactAddressRow[] =>
            CHAIN_FAMILIES.flatMap(family => {
                const address = selectedContact?.addresses[family]
                return address
                    ? [{ family, address, canSend: canSendOn(family) }]
                    : []
            }),
        [selectedContact, canSendOn],
    )

    const openQR = useCallback(
        (family: ChainFamily) => {
            if (!selectedContact) return
            void requestBottomSheet<void>({
                contents: (
                    <ContactQRContent
                        contact={selectedContact}
                        initialFamily={family}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
        },
        [requestBottomSheet, selectedContact],
    )

    const copyAddress = useCallback(
        (address: string) => void copyToClipboard(address),
        [copyToClipboard],
    )

    const sendTo = useCallback(
        (family: ChainFamily, address: string) =>
            void sendToContact(family, address),
        [sendToContact],
    )

    const goToEdit = useCallback(() => {
        navigation.navigate('EditContact')
    }, [navigation])

    const handleShare = useCallback(async () => {
        if (!selectedContact) return
        try {
            await shareText({
                title: selectedContact.name,
                message: addressRows.map(({ address }) => address).join('\n'),
            })
        } catch {
            // User cancelled — ignore.
        }
    }, [selectedContact, addressRows])

    return {
        selectedContact,
        addressRows,
        nfdName,
        openQR,
        copyAddress,
        sendTo,
        goToEdit,
        handleShare,
    }
}
