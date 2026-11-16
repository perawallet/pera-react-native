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

import React from 'react'
import {
    PWButton,
    PWFlatList,
    PWLoadingOverlay,
    PWRadioButton,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { SelectableAccountCheckboxRow } from '@modules/accounts'
import { ChainIconStack } from '@modules/chain-ui/icon'
import {
    useCloudBackupRestoreSelectAccountsScreen,
    type RestoreAccountRow,
    type UseCloudBackupRestoreSelectAccountsScreenParams,
} from './useCloudBackupRestoreSelectAccountsScreen'
import { useStyles } from './styles'

export type CloudBackupRestoreSelectAccountsScreenProps =
    UseCloudBackupRestoreSelectAccountsScreenParams

export const CloudBackupRestoreSelectAccountsScreen = ({
    onDone,
}: CloudBackupRestoreSelectAccountsScreenProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        accountCount,
        deviceAccountCount,
        mode,
        rows,
        canRestore,
        isRestoring,
        restoreProgress,
        handleSelectMode,
        handleToggleAccount,
        handleRestore,
    } = useCloudBackupRestoreSelectAccountsScreen({ onDone })

    const renderItem = ({ item }: { item: RestoreAccountRow }) => (
        <SelectableAccountCheckboxRow
            title={item.title}
            subtitle={item.subtitle}
            details={
                item.chainIds.length > 0 ? (
                    <ChainIconStack chainIds={item.chainIds} />
                ) : undefined
            }
            isSelected={item.isSelected}
            onToggle={() => handleToggleAccount(item.group)}
            checkboxTestID={`cloud_backup_restore_accounts_item_${item.group}`}
        />
    )

    // The list carries the header so the whole screen scrolls: above it, the
    // notice and the choice leave too little room for a backup's accounts.
    const header = (
        <PWView style={styles.header}>
            <ScreenHeader
                title={t('cloud_backup.restore_accounts.title')}
                description={
                    accountCount === 0
                        ? t('cloud_backup.restore_accounts.description_empty')
                        : t('cloud_backup.restore_accounts.description', {
                              count: accountCount,
                          })
                }
            />

            {deviceAccountCount > 0 && (
                <InfoCallout
                    icon='info'
                    title={t(
                        'cloud_backup.restore_accounts.device_notice_title',
                    )}
                    body={t(
                        'cloud_backup.restore_accounts.device_notice_body',
                        { count: deviceAccountCount },
                    )}
                    testID='cloud_backup_restore_accounts_device_notice'
                />
            )}

            {accountCount > 0 && (
                <>
                    <PWRadioButton
                        title={t('cloud_backup.restore_accounts.all_accounts')}
                        isSelected={mode === 'all'}
                        onPress={() => handleSelectMode('all')}
                        testID='cloud_backup_restore_accounts_all'
                    />
                    <PWRadioButton
                        title={t(
                            'cloud_backup.restore_accounts.selected_accounts',
                        )}
                        isSelected={mode === 'selected'}
                        onPress={() => handleSelectMode('selected')}
                        testID='cloud_backup_restore_accounts_selected'
                    />
                </>
            )}

            {mode === 'selected' && (
                <PWText
                    variant='caption'
                    style={styles.hint}
                >
                    {t('cloud_backup.restore_accounts.left_out_hint')}
                </PWText>
            )}
        </PWView>
    )

    return (
        <>
            <PWScreen
                scroll='never'
                testID='cloud_backup_restore_accounts_screen'
                footer={
                    <PWButton
                        variant='primary'
                        title={t('cloud_backup.restore_accounts.restore')}
                        onPress={handleRestore}
                        isDisabled={!canRestore}
                        testID='cloud_backup_restore_accounts_button'
                    />
                }
            >
                <PWFlatList
                    data={mode === 'selected' ? rows : []}
                    renderItem={renderItem}
                    keyExtractor={item => item.group}
                    ListHeaderComponent={header}
                    cardLayout
                    showsVerticalScrollIndicator={false}
                />
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isRestoring}
                title={restoreProgress.title}
                description={restoreProgress.description}
            />
        </>
    )
}
