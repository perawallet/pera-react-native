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

import EmptyView from '@components/common/empty-view/EmptyView'
import PWView from '@components/common/view/PWView'
import { Text } from '@rneui/themed'
import { useStyles } from './ViewContactScreen.styles'
import ContactAvatar from '@components/common/contact-avatar/ContactAvatar'
import AddressDisplay from '@components/address/address-display/AddressDisplay'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useLanguage } from '@hooks/language'

const ViewContactScreen = () => {
    const { selectedContact } = useContacts()
    const styles = useStyles()
    const { t } = useLanguage()

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
                    size='large'
                />
            </PWView>
            <PWView>
                <Text style={styles.label}>
                    {t('contacts.view_contact.name_label')}
                </Text>
                <Text style={styles.value}>{selectedContact.name}</Text>
            </PWView>
            <PWView>
                <Text style={styles.label}>
                    {t('contacts.view_contact.address_label')}
                </Text>
                <AddressDisplay
                    address={selectedContact.address}
                    showCopy
                    rawDisplay
                />
            </PWView>
        </PWView>
    )
}

export default ViewContactScreen
