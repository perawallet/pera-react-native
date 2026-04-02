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
    isAlgo25Account,
    isHDWalletAccount,
    isRekeyedAccount,
    canSignWithAccount,
    hasSigningKeys,
    useRemoveAccountById,
    useUpdateAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useModalState } from '@hooks/useModalState'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { IconName } from '@components/core'
import { SHORT_PROMPT_DISPLAY_DELAY } from '@constants/ui'

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
    isRenameVisible: boolean
    handleCloseRename: () => void
    handleRename: (newName: string) => void
    isBackupWarningVisible: boolean
    handleCloseBackupWarning: () => void
    handleBackupWarningContinue: () => void
    isRemoveConfirmVisible: boolean
    handleCloseRemoveConfirm: () => void
    handleConfirmRemove: () => void
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

    const {
        isOpen: isRenameVisible,
        open: openRename,
        close: handleCloseRename,
    } = useModalState()

    const {
        isOpen: isBackupWarningVisible,
        open: openBackupWarning,
        close: handleCloseBackupWarning,
    } = useModalState()

    const {
        isOpen: isRemoveConfirmVisible,
        open: openRemoveConfirm,
        close: handleCloseRemoveConfirm,
    } = useModalState()

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
        notImplemented()
    }, [notImplemented])

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

    const handleOpenRename = useCallback(() => {
        onClose()
        openRename()
    }, [onClose, openRename])

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

    const handleBackupWarningContinue = useCallback(() => {
        handleCloseBackupWarning()
        openRemoveConfirm()
    }, [handleCloseBackupWarning, openRemoveConfirm])

    const handleOpenRemoveConfirm = useCallback(() => {
        onClose()
        if (hasSigningKeys(account)) {
            openBackupWarning()
        } else {
            openRemoveConfirm()
        }
    }, [onClose, account, openRemoveConfirm, openBackupWarning])

    const handleRename = useCallback(
        (newName: string) => {
            updateAccount({ ...account, name: newName })
            handleCloseRename()
            setTimeout(() => {
                showToast({
                    title: t('account_options.rename_success'),
                    body: '',
                    type: 'success',
                })
            }, SHORT_PROMPT_DISPLAY_DELAY)
        },
        [updateAccount, account, handleCloseRename, showToast, t],
    )

    const handleConfirmRemove = useCallback(() => {
        const rekeyedToThisAccount = accounts.filter(
            a => a.rekeyAddress === account.address && a.id !== account.id,
        )

        if (rekeyedToThisAccount.length > 0) {
            handleCloseRemoveConfirm()
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
        handleCloseRemoveConfirm()
        if (hasOtherAccounts) {
            navigation.navigate('TabBar', { screen: 'Home' })
        }
    }, [
        accounts,
        account.address,
        account.id,
        removeAccountById,
        handleCloseRemoveConfirm,
        navigation,
        showToast,
        t,
    ])

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

        if (isAlgo25Account(account) || isHDWalletAccount(account)) {
            items.push({
                id: 'view-passphrase',
                icon: 'key',
                title: t('account_options.view_passphrase'),
                onPress: handleViewPassphrase,
            })
        }

        if (isRekeyedAccount(account)) {
            items.push({
                id: 'auth-address',
                icon: 'account-rekeyed',
                title: t('account_options.auth_address'),
                onPress: handleAuthAddress,
            })
        }

        if (isRekeyedAccount(account) && hasSigningKeys(account)) {
            items.push({
                id: 'undo-rekey',
                icon: 'undo',
                title: t('account_options.undo_rekey'),
                onPress: handleUndoRekey,
            })
        }

        if (canSignWithAccount(account, accounts)) {
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
        account,
        notificationsEnabled,
        handleCopyAddress,
        handleShowAddress,
        handleViewPassphrase,
        handleAuthAddress,
        handleUndoRekey,
        handleRekeyToLedger,
        handleRekeyToStandard,
        handleOpenRename,
        handleToggleNotifications,
        handleOpenRemoveConfirm,
    ])

    return {
        options,
        isRenameVisible,
        handleCloseRename,
        handleRename,
        isBackupWarningVisible,
        handleCloseBackupWarning,
        handleBackupWarningContinue,
        isRemoveConfirmVisible,
        handleCloseRemoveConfirm,
        handleConfirmRemove,
    }
}
