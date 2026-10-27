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
    PWBottomSheetView,
    PWSheetLayout,
    PWText,
    PWView,
} from '@components/core'
import {
    isWatchAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { DeleteFromBackupSheet } from '@modules/cloud-backup'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { SheetOptionRow } from '@components/SheetOptionRow'
import { useStyles } from './styles'
import { useAccountOptions } from './useAccountOptions'
import { AccountNetworkList } from './AccountNetworkList'
import { AccountTopActions } from './AccountTopActions'
import { AccountInfoCard } from '../AccountInfoCard'

export type AccountOptionsContentProps = {
    onShowAddress: (account: WalletAccount, chainId: ChainId) => void
    account: WalletAccount
}

export const AccountOptionsContent = ({
    onShowAddress,
    account,
}: AccountOptionsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const {
        topActions,
        sharedAccountOptions,
        networks,
        isRekeyed,
        canUndoRekey,
        authAccount,
        authAddress,
        handleUndoRekey,
        isCloudBackupAvailable,
        removeConfirmView,
        handleConfirmBackupWarning,
        handleConfirmRemove,
        handleDeleteFromBackup,
        handleKeepInBackup,
        pendingBackupChoice,
        handleCancelRemove,
    } = useAccountOptions({ account, onClose: dismiss, onShowAddress })

    // The sheet is content-sized and the list reports its height through its
    // scroll view; these plain panels need gorhom's measuring container, or the
    // sheet keeps the list's height around them.
    if (removeConfirmView === 'backup-warning') {
        return (
            <PWBottomSheetView>
                <ConfirmActionContent
                    icon='trash'
                    iconVariant='error'
                    title={t('account_options.backup_warning_title')}
                    message={t(
                        isCloudBackupAvailable
                            ? 'account_options.backup_warning_message_with_cloud_backup'
                            : 'account_options.backup_warning_message',
                    )}
                    confirmLabel={t('account_options.backup_warning_continue')}
                    cancelLabel={t('account_options.backup_warning_cancel')}
                    confirmVariant='destructive'
                    buttonPaddingStyle='dense'
                    confirmTestID='remove_account_backup_continue_button'
                    cancelTestID='remove_account_backup_cancel_button'
                    onConfirm={handleConfirmBackupWarning}
                    onCancel={handleCancelRemove}
                />
            </PWBottomSheetView>
        )
    }

    if (removeConfirmView === 'remove-confirm') {
        return (
            <PWBottomSheetView>
                <ConfirmActionContent
                    icon='trash'
                    iconVariant='error'
                    title={t('account_options.remove_title')}
                    message={t(
                        isWatchAccount(account)
                            ? 'account_options.remove_watch_message'
                            : 'account_options.remove_message',
                    )}
                    confirmLabel={t('account_options.remove_confirm')}
                    cancelLabel={t('account_options.remove_cancel')}
                    confirmVariant='destructive'
                    buttonPaddingStyle='dense'
                    confirmTestID='remove_account_confirm_button'
                    cancelTestID='remove_account_cancel_button'
                    onConfirm={handleConfirmRemove}
                    onCancel={handleCancelRemove}
                />
            </PWBottomSheetView>
        )
    }

    if (removeConfirmView === 'cloud-backup-delete') {
        return (
            <PWBottomSheetView>
                <DeleteFromBackupSheet
                    declineLabel={t('cloud_backup.accounts.keep_action')}
                    onConfirm={() => void handleDeleteFromBackup()}
                    onDecline={() => void handleKeepInBackup()}
                    pendingChoice={pendingBackupChoice}
                />
            </PWBottomSheetView>
        )
    }

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={<SheetHeader title={account.name} />}
        >
            <AccountTopActions actions={topActions} />

            <PWView style={styles.accountInfoContainer}>
                <AccountInfoCard
                    account={networks.account}
                    onClose={dismiss}
                    rekeyedTo={
                        isRekeyed && authAddress
                            ? {
                                  authAccount,
                                  authAddress,
                                  onUndoRekey: canUndoRekey
                                      ? handleUndoRekey
                                      : undefined,
                              }
                            : undefined
                    }
                />
            </PWView>

            <PWText
                variant='h3'
                style={styles.networksTitle}
                testID='account_networks_title'
            >
                {t('account_options.networks_title')}
            </PWText>
            <AccountNetworkList
                networks={networks}
                onClose={dismiss}
            />

            {sharedAccountOptions.length > 0 && (
                <PWView style={styles.sharedAccountOptions}>
                    {sharedAccountOptions.map(option => (
                        <SheetOptionRow
                            key={option.id}
                            option={option}
                        />
                    ))}
                </PWView>
            )}
        </PWSheetLayout>
    )
}
