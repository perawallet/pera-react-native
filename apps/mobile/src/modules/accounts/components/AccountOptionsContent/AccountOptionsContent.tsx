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
    PWDivider,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import {
    isWatchAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useStyles } from './styles'
import { type AccountOption, useAccountOptions } from './useAccountOptions'
import { AccountInfoCard } from '../AccountInfoCard'

export type AccountOptionsContentProps = {
    onShowAddress: () => void
    account: WalletAccount
}

const OptionRow = ({
    option,
    styles,
}: {
    option: AccountOption
    styles: ReturnType<typeof useStyles>
}) => {
    const isDestructive = option.variant === 'destructive'

    return (
        <PWTouchableOpacity
            testID={`account_option_${option.id}`}
            style={[
                styles.optionRow,
                option.disabled && styles.optionRowDisabled,
            ]}
            onPress={option.onPress}
            disabled={option.disabled}
        >
            <PWIcon
                name={option.icon}
                variant={isDestructive ? 'error' : 'primary'}
            />
            <PWView style={styles.optionTextContainer}>
                <PWText
                    variant='h4'
                    style={isDestructive ? styles.dangerText : undefined}
                    truncate
                >
                    {option.title}
                </PWText>
                {option.subtitle ? (
                    <PWText
                        variant='body'
                        style={styles.optionSubtitle}
                        numberOfLines={1}
                    >
                        {option.subtitle}
                    </PWText>
                ) : null}
            </PWView>
        </PWTouchableOpacity>
    )
}

export const AccountOptionsContent = ({
    onShowAddress,
    account,
}: AccountOptionsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const {
        options,
        isRekeyed,
        canUndoRekey,
        authAccount,
        authAddress,
        handleUndoRekey,
        removeConfirmView,
        handleConfirmBackupWarning,
        handleConfirmRemove,
        handleCancelRemove,
    } = useAccountOptions({ account, onClose: dismiss, onShowAddress })

    if (removeConfirmView === 'backup-warning') {
        return (
            <ConfirmActionContent
                icon='trash'
                iconVariant='error'
                title={t('account_options.backup_warning_title')}
                message={t('account_options.backup_warning_message')}
                confirmLabel={t('account_options.backup_warning_continue')}
                cancelLabel={t('account_options.backup_warning_cancel')}
                confirmVariant='destructive'
                buttonPaddingStyle='dense'
                confirmTestID='remove_account_backup_continue_button'
                cancelTestID='remove_account_backup_cancel_button'
                onConfirm={handleConfirmBackupWarning}
                onCancel={handleCancelRemove}
            />
        )
    }

    if (removeConfirmView === 'remove-confirm') {
        return (
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
        )
    }

    const generalOptions = options.filter(
        o =>
            o.id === 'shared-account-detail' ||
            o.id === 'copy-address' ||
            o.id === 'show-address' ||
            o.id === 'view-passphrase' ||
            o.id === 'auth-address',
    )

    const rekeyOptions = options.filter(
        o =>
            o.id === 'undo-rekey' ||
            o.id === 'rekey-account' ||
            o.id === 'export-share-account' ||
            o.id === 'scan-rekeyed',
    )

    const managementOptions = options.filter(
        o =>
            o.id === 'rename-account' ||
            o.id === 'toggle-notifications' ||
            o.id === 'remove-account',
    )

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={<SheetHeader title={account.name} />}
        >
            <PWView style={styles.accountInfoContainer}>
                <AccountInfoCard
                    account={account}
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

            <PWView>
                {generalOptions.map(option => (
                    <OptionRow
                        key={option.id}
                        option={option}
                        styles={styles}
                    />
                ))}
            </PWView>

            {rekeyOptions.length > 0 && (
                <>
                    <PWDivider style={styles.divider} />
                    <PWView>
                        {rekeyOptions.map(option => (
                            <OptionRow
                                key={option.id}
                                option={option}
                                styles={styles}
                            />
                        ))}
                    </PWView>
                </>
            )}

            <PWDivider style={styles.divider} />
            <PWView>
                {managementOptions.map(option => (
                    <OptionRow
                        key={option.id}
                        option={option}
                        styles={styles}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
