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

import { PWLoadingOverlay, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupSyncStatusRow } from '../../components/BackupSyncStatusRow'
import { OverviewRow } from '../../components/OverviewRow'
import { useCloudBackupOverview } from './useCloudBackupOverview'
import { useStyles } from './styles'

export const CloudBackupOverviewScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        credentialAddressLabel,
        accountsInSync,
        accountsNotBackedUp,
        contactsInSync,
        contactsNotBackedUp,
        passkeysInSync,
        passkeysNotBackedUp,
        arePasskeysResolved,
        onPressAccounts,
        onPressContacts,
        onPressPasskeys,
        onPressCredentialAddress,
        onPressSyncDevices,
        onPressTurnOff,
        isSavingCredentials,
    } = useCloudBackupOverview()

    return (
        <>
            <PWScreen testID='cloud_backup_overview_screen'>
                <PWView style={styles.container}>
                    <BackupSyncStatusRow />

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
                                subtitle={
                                    contactsNotBackedUp > 0
                                        ? t(
                                              'cloud_backup.overview.contacts_not_backed_up',
                                              {
                                                  count: contactsNotBackedUp,
                                              },
                                          )
                                        : t(
                                              'cloud_backup.overview.contacts_in_sync',
                                              {
                                                  count: contactsInSync,
                                              },
                                          )
                                }
                                subtitleIcon={
                                    contactsNotBackedUp > 0
                                        ? 'cloud-off'
                                        : undefined
                                }
                                subtitleIconVariant='error'
                                showChevron
                                onPress={onPressContacts}
                                testID='cloud_backup_overview_contacts'
                            />
                            <OverviewRow
                                variant='filled'
                                icon='key'
                                title={t('cloud_backup.overview.passkeys')}
                                subtitle={
                                    !arePasskeysResolved
                                        ? undefined
                                        : passkeysNotBackedUp > 0
                                          ? t(
                                                'cloud_backup.overview.passkeys_not_backed_up',
                                                {
                                                    count: passkeysNotBackedUp,
                                                },
                                            )
                                          : t(
                                                'cloud_backup.overview.passkeys_in_sync',
                                                {
                                                    count: passkeysInSync,
                                                },
                                            )
                                }
                                subtitleIcon={
                                    passkeysNotBackedUp > 0
                                        ? 'cloud-off'
                                        : undefined
                                }
                                subtitleIconVariant='error'
                                showChevron
                                onPress={onPressPasskeys}
                                testID='cloud_backup_overview_passkeys'
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
                                onPress={() => void onPressSyncDevices()}
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

            <PWLoadingOverlay
                isVisible={isSavingCredentials}
                title={t('cloud_backup.store_credentials.storing')}
            />
        </>
    )
}
