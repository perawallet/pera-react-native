/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useMemo } from 'react'
import {
    WalletAccount,
    hasSigningKeys,
    isMultisigAccount,
    isSigningLogicalType,
    isWatchAccount,
    useAccountLogicalType,
    useAllAccounts,
    useRemoveAccountById,
    useUpdateAccount,
} from '@perawallet/wallet-core-accounts'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useViewPassphraseFlow } from '@modules/view-passphrase'
import { ExportShareAccountContent } from '@modules/multisig/components/ExportShareAccountContent'
import { IconName } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { RenameAccountContent } from './RenameAccountContent'

export type AccountOption = {
    id: string
    icon: IconName
    title: string
    subtitle?: string
    onPress: () => void
    variant?: 'default' | 'destructive'
}

export type UseAccountOptionsParams = {
    account: WalletAccount
    onClose: () => void
    onShowAddress: () => void
}

export type UseAccountOptionsResult = {
    options: AccountOption[]
}

export const useAccountOptions = ({
    account,
    onClose,
    onShowAddress,
}: UseAccountOptionsParams): UseAccountOptionsResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { copyToClipboard } = useClipboard()
    const { isAccountEnabled, setAccountEnabled } = useNotificationPreferences()
    const accounts = useAllAccounts()
    const removeAccountById = useRemoveAccountById()
    const updateAccount = useUpdateAccount()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const { openViewPassphraseFlow } = useViewPassphraseFlow()

    const logicalType = useAccountLogicalType(account.address) ?? 'NoAuth'
    const showPassphrase = logicalType === 'Algo25' || logicalType === 'HdKey'
    const isRekeyed = logicalType === 'Rekeyed' || logicalType === 'RekeyedAuth'
    const showUndoRekey = logicalType === 'RekeyedAuth'
    const isHdWallet = logicalType === 'HdKey'
    const canSign = isSigningLogicalType(logicalType)
    const isSharedAccount = isMultisigAccount(account)

    const notImplemented = useCallback(() => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
        onClose()
    }, [showToast, t, onClose])

    const handleCopyAddress = useCallback(() => {
        copyToClipboard(account.address)
        onClose()
    }, [copyToClipboard, account.address, onClose])

    const handleShowAddress = useCallback(() => {
        onClose()
        onShowAddress()
    }, [onClose, onShowAddress])

    const handleViewPassphrase = useCallback(() => {
        // Dismiss the options menu first so we don't end up with the menu
        // sheet stacked under the PIN / acknowledge / display sheets.
        onClose()
        void openViewPassphraseFlow(account.address)
    }, [onClose, openViewPassphraseFlow, account.address])

    const handleAuthAddress = useCallback(() => {
        if (account.rekeyAddress) {
            copyToClipboard(account.rekeyAddress)
        }
        onClose()
    }, [copyToClipboard, account.rekeyAddress, onClose])

    const handleUndoRekey = useCallback(() => {
        notImplemented()
    }, [notImplemented])

    const handleRekeyToLedger = useCallback(() => {
        notImplemented()
    }, [notImplemented])

    const handleRekeyToStandard = useCallback(() => {
        notImplemented()
    }, [notImplemented])

    const handleRekeyToShared = useCallback(() => {
        notImplemented()
    }, [notImplemented])

    const handleExportShareAccount = useCallback(async () => {
        onClose()
        await requestBottomSheet<void>({
            contents: (
                <ExportShareAccountContent accountAddress={account.address} />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
    }, [onClose, requestBottomSheet, account.address])

    const handleOpenRename = useCallback(async () => {
        if (!account.id) return
        onClose()
        const newName = await requestBottomSheet<string>({
            contents: <RenameAccountContent accountId={account.id} />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!newName) return
        updateAccount({ ...account, name: newName })
        showToast(
            {
                title: t('account_options.rename_success'),
                body: '',
                type: 'success',
            },
            { delayLength: 'short' },
        )
    }, [onClose, requestBottomSheet, account, updateAccount, showToast, t])

    const handleToggleNotifications = useCallback(() => {
        const currentlyEnabled = isAccountEnabled(account.address)
        setAccountEnabled(account.address, !currentlyEnabled)
        showToast({
            title: currentlyEnabled
                ? t('account_options.notifications_muted')
                : t('account_options.notifications_unmuted'),
            body: '',
            type: 'success',
        })
        onClose()
    }, [
        isAccountEnabled,
        setAccountEnabled,
        account.address,
        showToast,
        t,
        onClose,
    ])

    const performRemoveAccount = useCallback(() => {
        const rekeyedToThisAccount = accounts.filter(
            a => a.rekeyAddress === account.address && a.id !== account.id,
        )

        if (rekeyedToThisAccount.length > 0) {
            showToast({
                title: t('account_options.remove_rekey_error_title'),
                body: t('account_options.remove_rekey_error_message', {
                    count: rekeyedToThisAccount.length,
                }),
                type: 'error',
            })
            return
        }
        const hasOtherAccounts = accounts.length > 1
        if (account.id) {
            removeAccountById(account.id)
        }
        showToast(
            {
                title: t('account_options.remove_account_success_message'),
                body: '',
                type: 'success',
            },
            { delayLength: 'short' },
        )

        if (hasOtherAccounts) {
            navigation.navigate('TabBar', { screen: 'Home' })
        }
    }, [
        accounts,
        account.address,
        account.id,
        removeAccountById,
        navigation,
        showToast,
        t,
    ])

    const handleOpenRemoveConfirm = useCallback(async () => {
        onClose()
        if (hasSigningKeys(account)) {
            const acknowledged = await requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='trash'
                        iconVariant='error'
                        title={t('account_options.backup_warning_title')}
                        message={t('account_options.backup_warning_message')}
                        confirmLabel={t(
                            'account_options.backup_warning_continue',
                        )}
                        cancelLabel={t('account_options.backup_warning_cancel')}
                        confirmVariant='destructive'
                        buttonPaddingStyle='dense'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!acknowledged) return
        }
        const confirmed = await requestBottomSheet<boolean>({
            contents: (
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
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!confirmed) return
        performRemoveAccount()
    }, [onClose, account, requestBottomSheet, performRemoveAccount, t])

    const notificationsEnabled = isAccountEnabled(account.address)

    const options = useMemo(() => {
        const items: AccountOption[] = []

        items.push({
            id: 'copy-address',
            icon: 'copy',
            title: t('account_options.copy_address'),
            subtitle: truncateAlgorandAddress(account.address),
            onPress: handleCopyAddress,
        })

        items.push({
            id: 'show-address',
            icon: 'qr',
            title: t('account_options.show_address'),
            onPress: handleShowAddress,
        })

        if (showPassphrase) {
            items.push({
                id: 'view-passphrase',
                icon: 'key',
                title: t(
                    isHdWallet
                        ? 'account_options.view_passphrase_hd'
                        : 'account_options.view_passphrase_algo25',
                ),
                onPress: handleViewPassphrase,
            })
        }

        if (isRekeyed) {
            items.push({
                id: 'auth-address',
                icon: 'account-rekeyed',
                title: t('account_options.auth_address'),
                onPress: handleAuthAddress,
            })
        }

        if (showUndoRekey) {
            items.push({
                id: 'undo-rekey',
                icon: 'undo',
                title: t('account_options.undo_rekey'),
                onPress: handleUndoRekey,
            })
        }

        if (canSign && !isSharedAccount) {
            items.push({
                id: 'rekey-to-ledger',
                icon: 'rekey',
                title: t('account_options.rekey_to_ledger'),
                onPress: handleRekeyToLedger,
            })

            items.push({
                id: 'rekey-to-standard',
                icon: 'rekey',
                title: t('account_options.rekey_to_standard'),
                onPress: handleRekeyToStandard,
            })
        }

        if (isSharedAccount) {
            items.push({
                id: 'rekey-to-shared',
                icon: 'rekey',
                title: t('account_options.rekey_to_shared'),
                onPress: handleRekeyToShared,
            })

            items.push({
                id: 'export-share-account',
                icon: 'share',
                title: t('account_options.export_share_account'),
                onPress: handleExportShareAccount,
            })
        }

        items.push({
            id: 'rename-account',
            icon: 'edit-pen',
            title: t('account_options.rename_account'),
            onPress: handleOpenRename,
        })

        items.push({
            id: 'toggle-notifications',
            icon: 'bell',
            title: notificationsEnabled
                ? t('account_options.mute_notifications')
                : t('account_options.unmute_notifications'),
            onPress: handleToggleNotifications,
        })

        items.push({
            id: 'remove-account',
            icon: 'unlink',
            title: t('account_options.remove_account'),
            onPress: handleOpenRemoveConfirm,
            variant: 'destructive',
        })

        return items
    }, [
        t,
        account.address,
        showPassphrase,
        isRekeyed,
        showUndoRekey,
        canSign,
        isSharedAccount,
        notificationsEnabled,
        handleCopyAddress,
        handleShowAddress,
        handleViewPassphrase,
        handleAuthAddress,
        handleUndoRekey,
        handleRekeyToLedger,
        handleRekeyToStandard,
        handleRekeyToShared,
        handleExportShareAccount,
        handleOpenRename,
        handleToggleNotifications,
        handleOpenRemoveConfirm,
    ])

    return {
        options,
    }
}
