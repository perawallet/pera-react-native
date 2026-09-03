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

import {
    PWIcon,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
    type IconName,
    type PWIconVariant,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { OverviewRow } from './OverviewRow'
import { SyncStatusBadge } from './SyncStatusBadge'
import {
    useCloudBackupOverview,
    type SyncBadge,
} from './useCloudBackupOverview'
import { useStyles } from './styles'

const SYNC_ICON: Record<SyncBadge, { name: IconName; variant: PWIconVariant }> =
    {
        success: { name: 'cloud-check', variant: 'positive' },
        failed: { name: 'cloud-x', variant: 'error' },
        syncing: { name: 'cloud-check', variant: 'secondary' },
    }

const NEVER_SYNCED_ICON: { name: IconName; variant: PWIconVariant } = {
    name: 'cloud-off',
    variant: 'secondary',
}

export const CloudBackupOverviewScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        syncStatus,
        lastSyncedLabel,
        credentialAddressLabel,
        accountsInSync,
        accountsNotBackedUp,
        contactsInSync,
        onPressAccounts,
        onPressContacts,
        onPressCredentialAddress,
        onPressCredentialInfo,
        onPressSyncDevices,
        onPressTurnOff,
    } = useCloudBackupOverview()

    const syncIcon = syncStatus ? SYNC_ICON[syncStatus] : NEVER_SYNCED_ICON

    return (
        <PWScreen testID='cloud_backup_overview_screen'>
            <PWView style={styles.container}>
                <OverviewRow
                    variant='bordered'
                    icon={syncIcon.name}
                    iconVariant={syncIcon.variant}
                    title={t('cloud_backup.overview.latest_sync')}
                    subtitle={lastSyncedLabel}
                    trailing={
                        syncStatus ? (
                            <SyncStatusBadge status={syncStatus} />
                        ) : undefined
                    }
                    testID='cloud_backup_overview_latest_sync'
                />

                <PWView style={styles.section}>
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        style={styles.sectionLabel}
                    >
                        {t('cloud_backup.overview.protected_data')}
                    </PWText>
                    <PWView style={styles.rows}>
                        <OverviewRow
                            variant='filled'
                            icon='wallet'
                            title={t('cloud_backup.overview.accounts')}
                            subtitle={
                                accountsNotBackedUp > 0
                                    ? t(
                                          'cloud_backup.overview.accounts_not_backed_up',
                                          {
                                              count: accountsNotBackedUp,
                                          },
                                      )
                                    : t(
                                          'cloud_backup.overview.accounts_in_sync',
                                          {
                                              count: accountsInSync,
                                          },
                                      )
                            }
                            subtitleIcon={
                                accountsNotBackedUp > 0
                                    ? 'cloud-off'
                                    : undefined
                            }
                            subtitleIconVariant='error'
                            showChevron
                            onPress={onPressAccounts}
                            testID='cloud_backup_overview_accounts'
                        />
                        <OverviewRow
                            variant='filled'
                            icon='contacts'
                            title={t('cloud_backup.overview.contacts')}
                            subtitle={t(
                                'cloud_backup.overview.contacts_in_sync',
                                {
                                    count: contactsInSync,
                                },
                            )}
                            showChevron
                            onPress={onPressContacts}
                            testID='cloud_backup_overview_contacts'
                        />
                    </PWView>
                </PWView>

                <PWView style={styles.section}>
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        style={styles.sectionLabel}
                    >
                        {t('cloud_backup.overview.backup_details')}
                    </PWText>
                    <PWView style={styles.rows}>
                        <OverviewRow
                            variant='bordered'
                            icon='key'
                            title={t(
                                'cloud_backup.overview.credential_address',
                            )}
                            subtitle={credentialAddressLabel}
                            titleAccessory={
                                <PWTouchableOpacity
                                    onPress={onPressCredentialInfo}
                                    testID='cloud_backup_overview_credential_info'
                                >
                                    <PWIcon
                                        name='info'
                                        variant='secondary'
                                    />
                                </PWTouchableOpacity>
                            }
                            showChevron
                            onPress={() => void onPressCredentialAddress()}
                            testID='cloud_backup_overview_credential_address'
                        />
                        <OverviewRow
                            variant='bordered'
                            icon='qr'
                            title={t('cloud_backup.overview.sync_devices')}
                            subtitle={t(
                                'cloud_backup.overview.sync_devices_description',
                            )}
                            showChevron
                            onPress={onPressSyncDevices}
                            testID='cloud_backup_overview_sync_devices'
                        />
                        <OverviewRow
                            variant='bordered'
                            tone='negative'
                            icon='cloud-off'
                            iconVariant='error'
                            title={t('cloud_backup.overview.turn_off')}
                            subtitle={t(
                                'cloud_backup.overview.turn_off_description',
                            )}
                            onPress={() => void onPressTurnOff()}
                            testID='cloud_backup_overview_turn_off'
                        />
                    </PWView>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
