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

import { Fragment } from 'react'
import { PWScreen, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { ListItemDivider } from '@components/ListItemDivider'
import { useLanguage } from '@hooks/useLanguage'
import { BackupReviewCard } from '../../components/BackupReviewCard'
import { SectionHeading } from '../../components/SectionHeading'
import { DeviceContactRow } from './DeviceContactRow'
import { useCloudBackupContacts } from './useCloudBackupContacts'
import { useStyles } from './styles'

export const CloudBackupContactsScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        contacts,
        isBackedUp,
        notBackedUpCount,
        availableFromBackupCount,
        busyAddress,
        onBackUp,
        onReview,
    } = useCloudBackupContacts()

    if (contacts.length === 0 && availableFromBackupCount === 0) {
        return (
            <PWScreen testID='cloud_backup_contacts_screen'>
                <EmptyView
                    icon='person'
                    title={t('cloud_backup.contacts.empty_title')}
                    body={t('cloud_backup.contacts.empty_body')}
                    shouldTruncateBody={false}
                />
            </PWScreen>
        )
    }

    return (
        <PWScreen testID='cloud_backup_contacts_screen'>
            <PWView style={styles.container}>
                <BackupReviewCard
                    title={t('cloud_backup.contacts.review_title')}
                    lines={[
                        ...(notBackedUpCount > 0
                            ? [
                                  {
                                      icon: 'cloud-off' as const,
                                      isNegative: true,
                                      label: t(
                                          'cloud_backup.contacts.not_backed_up_count',
                                          { count: notBackedUpCount },
                                      ),
                                  },
                              ]
                            : []),
                        ...(availableFromBackupCount > 0
                            ? [
                                  {
                                      icon: 'cloud-download' as const,
                                      isNegative: false,
                                      label: t(
                                          'cloud_backup.contacts.available_count',
                                          { count: availableFromBackupCount },
                                      ),
                                  },
                              ]
                            : []),
                    ]}
                    actionLabel={t('cloud_backup.contacts.review_action')}
                    onReview={onReview}
                    testID='contacts_to_review_card'
                />
                <PWView style={styles.section}>
                    <SectionHeading
                        title={t('cloud_backup.contacts.device_title')}
                        subtitle={t('cloud_backup.contacts.device_subtitle')}
                    />
                    <PWView>
                        {contacts.map((contact, index) => (
                            <Fragment key={contact.address}>
                                {index > 0 && <ListItemDivider />}
                                <DeviceContactRow
                                    contact={contact}
                                    isBackedUp={isBackedUp(contact.address)}
                                    isBusy={busyAddress === contact.address}
                                    onBackUp={onBackUp}
                                />
                            </Fragment>
                        ))}
                    </PWView>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
