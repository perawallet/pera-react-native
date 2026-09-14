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
import { PWIcon, PWScreen, PWTouchableOpacity, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { ListItemDivider } from '@components/ListItemDivider'
import { useLanguage } from '@hooks/useLanguage'
import { SectionHeading } from '../../components/SectionHeading'
import { AvailableContactRow } from './AvailableContactRow'
import { NotBackedUpContactRow } from './NotBackedUpContactRow'
import { useCloudBackupContactsReview } from './useCloudBackupContactsReview'
import { useStyles } from './styles'

export const CloudBackupContactsReviewScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        availableFromBackup,
        notBackedUpContacts,
        isExpanded,
        busyAddress,
        onToggleExpanded,
        onAdd,
        onDelete,
        onBackUp,
    } = useCloudBackupContactsReview()

    if (availableFromBackup.length === 0 && notBackedUpContacts.length === 0) {
        return (
            <PWScreen testID='cloud_backup_contacts_review_screen'>
                <EmptyView
                    icon='cloud-check'
                    title={t('cloud_backup.contacts.review_empty_title')}
                    body={t('cloud_backup.contacts.review_empty_body')}
                    shouldTruncateBody={false}
                />
            </PWScreen>
        )
    }

    return (
        <PWScreen testID='cloud_backup_contacts_review_screen'>
            <PWView style={styles.container}>
                {availableFromBackup.length > 0 && (
                    <PWView style={styles.card}>
                        <PWTouchableOpacity
                            style={styles.cardHeader}
                            onPress={onToggleExpanded}
                            testID='add_contact_from_backup_toggle'
                        >
                            <PWView style={styles.cardHeading}>
                                <SectionHeading
                                    title={t(
                                        'cloud_backup.contacts.add_from_backup_title',
                                    )}
                                    subtitle={t(
                                        'cloud_backup.contacts.add_from_backup_subtitle',
                                    )}
                                    count={availableFromBackup.length}
                                />
                            </PWView>
                            <PWIcon
                                name={
                                    isExpanded
                                        ? 'chevron-down'
                                        : 'chevron-right'
                                }
                                variant='secondary'
                            />
                        </PWTouchableOpacity>
                        <ExpandablePanel isExpanded={isExpanded}>
                            <PWView style={styles.cardRows}>
                                {availableFromBackup.map((entry, index) => (
                                    <Fragment key={entry.address}>
                                        {index > 0 && <ListItemDivider />}
                                        <AvailableContactRow
                                            address={entry.address}
                                            name={entry.name}
                                            isBusy={
                                                busyAddress === entry.address
                                            }
                                            onAdd={onAdd}
                                            onDelete={onDelete}
                                        />
                                    </Fragment>
                                ))}
                            </PWView>
                        </ExpandablePanel>
                    </PWView>
                )}

                {notBackedUpContacts.length > 0 && (
                    <PWView style={styles.section}>
                        <SectionHeading
                            title={t(
                                'cloud_backup.contacts.not_backed_up_title',
                            )}
                            subtitle={t(
                                'cloud_backup.contacts.not_backed_up_subtitle',
                            )}
                            count={notBackedUpContacts.length}
                        />
                        <PWView>
                            {notBackedUpContacts.map((contact, index) => (
                                <Fragment key={contact.address}>
                                    {index > 0 && <ListItemDivider />}
                                    <NotBackedUpContactRow
                                        contact={contact}
                                        isBusy={busyAddress === contact.address}
                                        onBackUp={onBackUp}
                                    />
                                </Fragment>
                            ))}
                        </PWView>
                    </PWView>
                )}
            </PWView>
        </PWScreen>
    )
}
