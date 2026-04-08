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

import { EmptyView } from '@components/EmptyView'
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { ContactAvatar } from '@components/ContactAvatar'
import { AddressDisplay } from '@components/AddressDisplay'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useLanguage } from '@hooks/useLanguage'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useMemo } from 'react'

export const ViewContactScreen = () => {
    const { selectedContact } = useContacts()
    const styles = useStyles()
    const { t } = useLanguage()

    const { data: nfdNames } = useNfdForAddressQuery(
        selectedContact?.address ?? '',
        {
            enabled: !!selectedContact?.address,
        },
    )
    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    if (!selectedContact) {
        return (
            <EmptyView
                title={t('contacts.view_contact.no_contact_title')}
                body={t('contacts.view_contact.no_contact_body')}
                icon='person'
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.avatar}>
                <ContactAvatar
                    contact={selectedContact}
                    size='lg'
                />
            </PWView>
            <PWView>
                <PWText style={styles.label}>
                    {t('contacts.view_contact.name_label')}
                </PWText>
                <PWText style={styles.value}>{selectedContact.name}</PWText>
            </PWView>
            <PWView>
                <PWText style={styles.label}>
                    {t('contacts.view_contact.address_label')}
                </PWText>
                <AddressDisplay
                    address={selectedContact.address}
                    showCopy
                    displayType='address-only'
                />
            </PWView>
            {nfdName && (
                <PWView>
                    <PWText style={styles.label}>
                        {t('contacts.view_contact.nfd_label')}
                    </PWText>
                    <PWText style={styles.value}>{nfdName}</PWText>
                </PWView>
            )}
        </PWView>
    )
}
