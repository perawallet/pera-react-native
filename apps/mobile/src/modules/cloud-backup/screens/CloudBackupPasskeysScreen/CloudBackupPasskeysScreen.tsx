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
import { DevicePasskeyRow } from './DevicePasskeyRow'
import { useCloudBackupPasskeys } from './useCloudBackupPasskeys'
import { useStyles } from './styles'

export const CloudBackupPasskeysScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        passkeys,
        isBackedUp,
        isLoading,
        hasUnsupportedPasskeys,
        notBackedUpCount,
        availableFromBackupCount,
        busyCredentialId,
        onBackUp,
        onReview,
    } = useCloudBackupPasskeys()

    // Proving the credentials runs a PBKDF2 per seed, so the first open has a
    // real wait; showing the empty state through it would read as "none". And
    // a device whose credentials all failed the proof does hold passkeys — it
    // just cannot back any of them up, which is a different thing to say.
    if (passkeys.length === 0 && availableFromBackupCount === 0) {
        return (
            <PWScreen testID='cloud_backup_passkeys_screen'>
                <EmptyView
                    icon='person-key'
                    title={t(
                        hasUnsupportedPasskeys
                            ? 'cloud_backup.passkeys.unsupported_title'
                            : 'cloud_backup.passkeys.empty_title',
                    )}
                    body={t(
                        hasUnsupportedPasskeys
                            ? 'cloud_backup.passkeys.unsupported_body'
                            : 'cloud_backup.passkeys.empty_body',
                    )}
                    isLoading={isLoading}
                    shouldTruncateBody={false}
                />
            </PWScreen>
        )
    }

    return (
        <PWScreen testID='cloud_backup_passkeys_screen'>
            <PWView style={styles.container}>
                <BackupReviewCard
                    title={t('cloud_backup.passkeys.review_title')}
                    lines={[
                        ...(notBackedUpCount > 0
                            ? [
                                  {
                                      icon: 'cloud-off' as const,
                                      isNegative: true,
                                      label: t(
                                          'cloud_backup.passkeys.not_backed_up_count',
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
                                          'cloud_backup.passkeys.available_count',
                                          { count: availableFromBackupCount },
                                      ),
                                  },
                              ]
                            : []),
                    ]}
                    actionLabel={t('cloud_backup.passkeys.review_action')}
                    onReview={onReview}
                    testID='passkeys_to_review_card'
                />
                <PWView style={styles.section}>
                    <SectionHeading
                        title={t('cloud_backup.passkeys.device_title')}
                        subtitle={t('cloud_backup.passkeys.device_subtitle')}
                    />
                    <PWView>
                        {passkeys.map((passkey, index) => (
                            <Fragment key={passkey.credentialId}>
                                {index > 0 && <ListItemDivider />}
                                <DevicePasskeyRow
                                    passkey={passkey}
                                    isBackedUp={isBackedUp(
                                        passkey.credentialId,
                                    )}
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
            </PWView>
        </PWScreen>
    )
}
