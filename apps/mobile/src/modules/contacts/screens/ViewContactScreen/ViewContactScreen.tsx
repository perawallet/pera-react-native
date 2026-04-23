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

import { useCallback, useState } from 'react'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import { PWIcon, PWText, PWView } from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { CopyableText } from '@components/CopyableText'
import { EmptyView } from '@components/EmptyView'
import { SHORT_ADDRESS_FORMAT } from '@constants/ui'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { ContactQRBottomSheet } from '@modules/contacts/components/ContactQRBottomSheet'
import { shareText } from '@utils/shareText'
import { useStyles } from './styles'

export const ViewContactScreen = () => {
    const { selectedContact } = useContacts()
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const [qrVisible, setQrVisible] = useState(false)

    const { data: nfdNames } = useNfdForAddressQuery(
        selectedContact?.address ?? '',
        { enabled: !!selectedContact?.address },
    )
    const nfdName = nfdNames?.at(0)?.name

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

    useNavigationHeader({
        enabled: true,
        right: selectedContact ? (
            <PWView style={styles.headerButtons}>
                <PWIcon
                    variant='primary'
                    name='share'
                    onPress={handleShare}
                />
                <PWIcon
                    variant='primary'
                    name='edit-pen'
                    onPress={goToEdit}
                />
            </PWView>
        ) : null,
    })

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
            <PWView style={styles.header}>
                <ContactAvatar
                    contact={selectedContact}
                    size='xxl'
                />
                <PWText
                    variant='h3'
                    style={styles.name}
                >
                    {selectedContact.name}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.shortAddress}
                >
                    {truncateAlgorandAddress(
                        selectedContact.address,
                        SHORT_ADDRESS_FORMAT,
                    )}
                </PWText>
            </PWView>
            <PWView style={styles.divider} />
            <PWView style={styles.addressSection}>
                <PWText
                    variant='h4'
                    style={styles.addressLabel}
                >
                    {t('contacts.view_contact.account_address')}
                </PWText>
                <PWView style={styles.addressRow}>
                    <CopyableText
                        copyValue={selectedContact.address}
                        style={styles.addressTextWrapper}
                    >
                        <PWText
                            variant='body'
                            style={styles.fullAddress}
                        >
                            {selectedContact.address}
                        </PWText>
                    </CopyableText>
                    <PWIcon
                        name='qr'
                        variant='primary'
                        onPress={() => setQrVisible(true)}
                    />
                </PWView>
            </PWView>
            {nfdName && (
                <PWView style={[styles.addressSection, styles.nfdSection]}>
                    <PWText
                        variant='h4'
                        style={styles.addressLabel}
                    >
                        {t('contacts.view_contact.nfd_label')}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.fullAddress}
                    >
                        {nfdName}
                    </PWText>
                </PWView>
            )}
            <ContactQRBottomSheet
                contact={qrVisible ? selectedContact : null}
                onClose={() => setQrVisible(false)}
            />
        </PWView>
    )
}
