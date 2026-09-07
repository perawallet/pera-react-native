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

import { useCallback } from 'react'
import type { Contact } from '@perawallet/wallet-core-contacts'

import { PWTouchableIcon } from '@components/core'
import { AddressListItem } from '@components/AddressListItem'

type ContactRowProps = {
    contact: Contact
    onShowQR: (contact: Contact) => void
    onSelect: (contact: Contact) => void
}

export const ContactRow = ({
    contact,
    onShowQR,
    onSelect,
}: ContactRowProps) => {
    const handlePress = useCallback(
        () => onSelect(contact),
        [contact, onSelect],
    )
    const handleShowQR = useCallback(
        () => onShowQR(contact),
        [contact, onShowQR],
    )

    return (
        <AddressListItem
            address={contact.address}
            onPress={handlePress}
            showDivider
            testID={`contact_row_${contact.address}`}
            right={
                <PWTouchableIcon
                    name='qr'
                    variant='primary'
                    onPress={handleShowQR}
                    testID={`contact_row_qr_button_${contact.address}`}
                />
            }
        />
    )
}
