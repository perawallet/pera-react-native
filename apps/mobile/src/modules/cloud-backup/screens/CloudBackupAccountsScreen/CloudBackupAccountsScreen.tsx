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
import { ListItemDivider } from '@components/ListItemDivider'
import { useLanguage } from '@hooks/useLanguage'
import { BackupReviewCard } from '../../components/BackupReviewCard'
import { SectionHeading } from '../../components/SectionHeading'
import { DeviceAccountRow } from './DeviceAccountRow'
import { useCloudBackupAccounts } from './useCloudBackupAccounts'
import { useStyles } from './styles'

export const CloudBackupAccountsScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        accounts,
        isBackedUp,
        notBackedUpCount,
        availableFromBackupCount,
        busyAddress,
        onBackUp,
        onReview,
    } = useCloudBackupAccounts()

    return (
        <PWScreen testID='cloud_backup_accounts_screen'>
            <PWView style={styles.container}>
                <BackupReviewCard
                    title={t('cloud_backup.accounts.review_title')}
                    lines={[
                        ...(notBackedUpCount > 0
                            ? [
                                  {
                                      icon: 'cloud-off' as const,
                                      isNegative: true,
                                      label: t(
                                          'cloud_backup.accounts.not_backed_up_count',
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
                                          'cloud_backup.accounts.available_count',
                                          { count: availableFromBackupCount },
                                      ),
                                  },
                              ]
                            : []),
                    ]}
                    actionLabel={t('cloud_backup.accounts.review_action')}
                    onReview={onReview}
                    testID='accounts_to_review_card'
                />
                <PWView style={styles.section}>
                    <SectionHeading
                        title={t('cloud_backup.accounts.device_title')}
                        subtitle={t('cloud_backup.accounts.device_subtitle')}
                    />
                    <PWView>
                        {accounts.map((account, index) => (
                            <Fragment key={account.address}>
                                {index > 0 && <ListItemDivider />}
                                <DeviceAccountRow
                                    account={account}
                                    isBackedUp={isBackedUp(account.address)}
                                    isBusy={busyAddress === account.address}
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
