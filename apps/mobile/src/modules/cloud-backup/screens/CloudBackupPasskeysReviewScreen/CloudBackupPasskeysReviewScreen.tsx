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
import { AvailablePasskeyRow } from './AvailablePasskeyRow'
import { NotBackedUpPasskeyRow } from './NotBackedUpPasskeyRow'
import { useCloudBackupPasskeysReview } from './useCloudBackupPasskeysReview'
import { useStyles } from './styles'

export const CloudBackupPasskeysReviewScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        availableFromBackup,
        notBackedUpPasskeys,
        isExpanded,
        busyCredentialId,
        onToggleExpanded,
        onAdd,
        onDelete,
        onBackUp,
    } = useCloudBackupPasskeysReview()

    if (availableFromBackup.length === 0 && notBackedUpPasskeys.length === 0) {
        return (
            <PWScreen testID='cloud_backup_passkeys_review_screen'>
                <EmptyView
                    icon='cloud-check'
                    title={t('cloud_backup.passkeys.review_empty_title')}
                    body={t('cloud_backup.passkeys.review_empty_body')}
                    shouldTruncateBody={false}
                />
            </PWScreen>
        )
    }

    return (
        <PWScreen testID='cloud_backup_passkeys_review_screen'>
            <PWView style={styles.container}>
                {availableFromBackup.length > 0 && (
                    <PWView style={styles.card}>
                        <PWTouchableOpacity
                            style={styles.cardHeader}
                            onPress={onToggleExpanded}
                            testID='add_passkey_from_backup_toggle'
                        >
                            <PWView style={styles.cardHeading}>
                                <SectionHeading
                                    title={t(
                                        'cloud_backup.passkeys.add_from_backup_title',
                                    )}
                                    subtitle={t(
                                        'cloud_backup.passkeys.add_from_backup_subtitle',
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
                                    <Fragment key={entry.credentialId}>
                                        {index > 0 && <ListItemDivider />}
                                        <AvailablePasskeyRow
                                            credentialId={entry.credentialId}
                                            label={entry.label}
                                            isBusy={
                                                busyCredentialId ===
                                                entry.credentialId
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

                {notBackedUpPasskeys.length > 0 && (
                    <PWView style={styles.section}>
                        <SectionHeading
                            title={t(
                                'cloud_backup.passkeys.not_backed_up_title',
                            )}
                            subtitle={t(
                                'cloud_backup.passkeys.not_backed_up_subtitle',
                            )}
                            count={notBackedUpPasskeys.length}
                        />
                        <PWView>
                            {notBackedUpPasskeys.map((passkey, index) => (
                                <Fragment key={passkey.credentialId}>
                                    {index > 0 && <ListItemDivider />}
                                    <NotBackedUpPasskeyRow
                                        passkey={passkey}
                                        isBusy={
                                            busyCredentialId ===
                                            passkey.credentialId
                                        }
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
