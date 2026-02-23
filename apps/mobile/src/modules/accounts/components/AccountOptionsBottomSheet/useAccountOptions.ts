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
    useRemoveAccountById,
    useUpdateAccount,
} from '@perawallet/wallet-core-accounts'
import { useNotificationPreferences } from '@perawallet/wallet-core-notifications'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useModalState } from '@hooks/useModalState'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { IconName } from '@components/core'

export type AccountOption = {
    id: string
    icon: IconName
    title: string
    onPress: () => void
    variant?: 'default' | 'destructive'
}

export type UseAccountOptionsResult = {
    options: AccountOption[]
    isRenameVisible: boolean
    handleCloseRename: () => void
    handleRename: (newName: string) => void
    isRemoveConfirmVisible: boolean
    handleCloseRemoveConfirm: () => void
    handleConfirmRemove: () => void
    isQrVisible: boolean
    handleCloseQr: () => void
}

export const useAccountOptions = (
    account: WalletAccount,
    onClose: () => void,
): UseAccountOptionsResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { copyToClipboard } = useClipboard()
    const { isAccountEnabled, setAccountEnabled } = useNotificationPreferences()
    const removeAccountById = useRemoveAccountById()
    const updateAccount = useUpdateAccount()
    const navigation = useAppNavigation()

    const {
        isOpen: isRenameVisible,
        open: openRename,
        close: handleCloseRename,
    } = useModalState()

    const {
        isOpen: isRemoveConfirmVisible,
        open: openRemoveConfirm,
        close: handleCloseRemoveConfirm,
    } = useModalState()

    const {
        isOpen: isQrVisible,
        open: openQr,
        close: handleCloseQr,
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

    const handleShowQr = useCallback(() => {
        openQr()
    }, [openQr])

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
        openRename()
    }, [openRename])

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

    const handleOpenRemoveConfirm = useCallback(() => {
        openRemoveConfirm()
    }, [openRemoveConfirm])

    const handleRename = useCallback(
        (newName: string) => {
            updateAccount({ ...account, name: newName })
            handleCloseRename()
            onClose()
            showToast({
                title: t('account_options.rename_account'),
                body: '',
                type: 'success',
            })
        },
        [updateAccount, account, handleCloseRename, onClose, showToast, t],
    )

    const handleConfirmRemove = useCallback(() => {
        if (account.id) {
            removeAccountById(account.id)
        }
        handleCloseRemoveConfirm()
        onClose()
        navigation.navigate('TabBar', { screen: 'Home' })
    }, [
        account.id,
        removeAccountById,
        handleCloseRemoveConfirm,
        onClose,
        navigation,
    ])

    const notificationsEnabled = isAccountEnabled(account.address)

    const options = useMemo(() => {
        const items: AccountOption[] = []

        items.push({
            id: 'copy-address',
            icon: 'copy',
            title: t('account_options.copy_address'),
            onPress: handleCopyAddress,
        })

        items.push({
            id: 'show-qr',
            icon: 'inflow',
            title: t('account_options.show_qr'),
            onPress: handleShowQr,
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

        if (isRekeyedAccount(account) && canSignWithAccount(account)) {
            items.push({
                id: 'undo-rekey',
                icon: 'undo',
                title: t('account_options.undo_rekey'),
                onPress: handleUndoRekey,
            })
        }

        if (canSignWithAccount(account)) {
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
            icon: notificationsEnabled ? 'bell-off' : 'bell',
            title: notificationsEnabled
                ? t('account_options.mute_notifications')
                : t('account_options.unmute_notifications'),
            onPress: handleToggleNotifications,
        })

        items.push({
            id: 'remove-account',
            icon: 'trash',
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
        handleShowQr,
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
        isRemoveConfirmVisible,
        handleCloseRemoveConfirm,
        handleConfirmRemove,
        isQrVisible,
        handleCloseQr,
    }
}
