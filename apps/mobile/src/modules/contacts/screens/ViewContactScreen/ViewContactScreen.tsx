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

import { useEffect } from 'react'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { trackScreen, AnalyticsScreenName } from '@analytics'

import { PWScreen, PWText, PWTouchableIcon, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { ContactAvatar } from '@components/ContactAvatar'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useViewContactScreen } from './useViewContactScreen'
import { useStyles } from './styles'

export const ViewContactScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { selectedContact, nfdName, openQR, goToEdit, handleShare } =
        useViewContactScreen()

    useEffect(() => {
        trackScreen(AnalyticsScreenName.ContactDetail)
    }, [])

    useNavigationHeader({
        enabled: true,
        right: selectedContact ? (
            <PWView style={styles.headerButtons}>
                <PWTouchableIcon
                    name='share'
                    variant='primary'
                    onPress={() => void handleShare()}
                />
                <PWTouchableIcon
                    name='edit-pen'
                    variant='primary'
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
        <PWScreen>
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
                        {truncateAlgorandAddress(selectedContact.address)}
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
                        <AddressDisplay
                            address={selectedContact.address}
                            addressFormat='full'
                            displayType='address-only'
                            showCopy={false}
                            textProps={{
                                variant: 'body',
                                style: styles.fullAddress,
                            }}
                            style={styles.addressTextWrapper}
                        />
                        <PWTouchableIcon
                            name='qr'
                            variant='primary'
                            onPress={openQR}
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
            </PWView>
        </PWScreen>
    )
}
