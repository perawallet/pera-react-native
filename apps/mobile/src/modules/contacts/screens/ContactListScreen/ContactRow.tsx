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

import {
    PWListItemLayout,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { useStyles } from './styles'
import { useContactRow } from './useContactRow'

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
    const styles = useStyles()
    const { primaryAddress, subtitle } = useContactRow(contact)
    const handlePress = useCallback(
        () => onSelect(contact),
        [contact, onSelect],
    )
    const handleShowQR = useCallback(
        () => onShowQR(contact),
        [contact, onShowQR],
    )

    return (
        <PWListItemLayout
            onPress={handlePress}
            showDivider
            testID={`contact_row_${primaryAddress}`}
            left={
                <ContactAvatar
                    size='md'
                    contact={contact}
                />
            }
            right={
                <PWTouchableIcon
                    name='qr'
                    variant='primary'
                    onPress={handleShowQR}
                    testID={`contact_row_qr_button_${primaryAddress}`}
                />
            }
        >
            <PWView>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                >
                    {contact.name}
                </PWText>
                <PWText
                    variant='footnoteMedium'
                    weight={400}
                    style={styles.rowSubtitle}
                    numberOfLines={1}
                >
                    {subtitle}
                </PWText>
            </PWView>
        </PWListItemLayout>
    )
}
