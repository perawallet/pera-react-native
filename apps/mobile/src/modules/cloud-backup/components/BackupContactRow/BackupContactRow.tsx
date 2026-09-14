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

import type { ReactNode } from 'react'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWView } from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type BackupContactRowProps = {
    address: string
    /** Name to render. For a contact only the backup holds this is the cached
     *  label, which is why the row takes a name rather than resolving one:
     *  `AddressListItem` reads the local stores, which by definition cannot
     *  name a contact that is not on this device. */
    name: string
    /** Absent for a contact held only in the backup: there is no local record
     *  to take an avatar image from. */
    contact?: Contact
    isBackedUp: boolean
    trailing?: ReactNode
    /** Renders under the text column, so a wide control can't squeeze the name. */
    action?: ReactNode
    testID?: string
}

export const BackupContactRow = ({
    address,
    name,
    contact,
    isBackedUp,
    trailing,
    action,
    testID,
}: BackupContactRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            <ContactAvatar
                contact={contact}
                size='xl'
            />
            <PWView style={styles.body}>
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='bodyLarge'
                        numberOfLines={1}
                        ellipsizeMode='tail'
                        style={styles.title}
                    >
                        {name || t('cloud_backup.contacts.unnamed')}
                    </PWText>
                    <PWIcon
                        name={isBackedUp ? 'cloud-check' : 'cloud-off'}
                        variant={isBackedUp ? 'positive' : 'error'}
                        size='sm'
                        testID={
                            isBackedUp
                                ? 'backup_contact_row_backed_up'
                                : 'backup_contact_row_not_backed_up'
                        }
                    />
                </PWView>
                <PWText
                    variant='body'
                    style={styles.address}
                >
                    {truncateAlgorandAddress(address)}
                </PWText>
                {action}
            </PWView>
            {trailing}
        </PWView>
    )
}
