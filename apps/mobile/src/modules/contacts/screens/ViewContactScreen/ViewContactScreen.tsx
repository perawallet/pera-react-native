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

import { PWScreen, PWText, PWTouchableIcon, PWView } from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { ContactAddressRow } from '@modules/contacts/components/ContactAddressRow'
import { useViewContactScreen } from './useViewContactScreen'
import { useStyles } from './styles'

export const ViewContactScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        selectedContact,
        addressRows,
        nfdName,
        openQR,
        copyAddress,
        sendTo,
        goToEdit,
        handleShare,
    } = useViewContactScreen()

    useNavigationHeader({
        enabled: true,
        right: selectedContact ? (
            <PWView style={styles.headerButtons}>
                <PWTouchableIcon
                    name='share'
                    variant='primary'
                    onPress={() => void handleShare()}
                    testID='view_contact_share_button'
                />
                <PWTouchableIcon
                    name='edit-pen'
                    variant='primary'
                    onPress={goToEdit}
                    testID='view_contact_edit_button'
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
        <PWScreen testID='view_contact_screen'>
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
                </PWView>
                <PWView style={styles.divider} />
                <PWView style={styles.addressSection}>
                    <PWText
                        variant='h4'
                        style={styles.addressLabel}
                    >
                        {t('contacts.edit_contact.addresses_label')}
                    </PWText>
                    {addressRows.map(({ family, address, canSend }) => (
                        <ContactAddressRow
                            key={family}
                            family={family}
                            address={address}
                            testID={`view_contact_address_row_${family}`}
                            right={
                                <PWView style={styles.rowActions}>
                                    <PWTouchableIcon
                                        name='copy'
                                        variant='secondary'
                                        onPress={() => copyAddress(address)}
                                        accessibilityLabel={t(
                                            'contacts.view_contact.copy',
                                        )}
                                        testID={`view_contact_copy_${family}`}
                                    />
                                    <PWTouchableIcon
                                        name='qr'
                                        variant='secondary'
                                        onPress={() => openQR(family)}
                                        accessibilityLabel={t(
                                            'contacts.view_contact.show_qr',
                                        )}
                                        testID={`view_contact_qr_${family}`}
                                    />
                                    {canSend ? (
                                        <PWTouchableIcon
                                            name='arrow-up-right'
                                            variant='secondary'
                                            onPress={() =>
                                                sendTo(family, address)
                                            }
                                            accessibilityLabel={t(
                                                'contacts.view_contact.send',
                                            )}
                                            testID={`view_contact_send_${family}`}
                                        />
                                    ) : null}
                                </PWView>
                            }
                        />
                    ))}
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
