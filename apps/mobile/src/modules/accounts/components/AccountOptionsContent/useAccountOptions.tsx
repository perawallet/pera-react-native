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
    type WalletAccount,
    hasSigningKeys,
    isAlgo25Account,
    isHDWalletAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
    useAllAccounts,
    useCanSignWith,
    useFindAccountByAddress,
    useMultisigDetailsBackfill,
    useRemoveAccountByAddress,
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
import {
    SharedAccountDetailsContent,
    type SharedAccountDetails,
} from '../SharedAccountDetailsContent'
import { type IconName } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import {
    trackEvent,
    AccountDetailsEvent,
    AccountOptionsEvent,
} from '@analytics'
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
    isRekeyed: boolean
    canUndoRekey: boolean
    authAccount: WalletAccount | undefined
    authAddress: string | undefined
    handleUndoRekey: () => void
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
    const removeAccount = useRemoveAccountByAddress()
    const updateAccount = useUpdateAccount()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const { openViewPassphraseFlow } = useViewPassphraseFlow()

    useMultisigDetailsBackfill(account)

    const canSign = useCanSignWith(account)
    const isRekeyed = isRekeyedAccount(account)
    const showPassphrase =
        !isRekeyed && (isAlgo25Account(account) || isHDWalletAccount(account))
    const canUndoRekey = isRekeyed && canSign
    const isHdWallet = isHDWalletAccount(account)
    const isSharedAccount = isMultisigAccount(account)
    const participantCount = isMultisigAccount(account)
        ? (account.multisigDetails?.addresses.length ?? 0)
        : 0

    const authAccount = useFindAccountByAddress(account.rekeyAddress ?? '')

    const handleCopyAddress = useCallback(() => {
        trackEvent(AccountOptionsEvent.CopyAddress)
        void copyToClipboard(account.address)
        onClose()
    }, [copyToClipboard, account.address, onClose])

    const handleShowAddress = useCallback(() => {
        onClose()
        onShowAddress()
    }, [onClose, onShowAddress])

    const handleViewPassphrase = useCallback(() => {
        trackEvent(AccountOptionsEvent.ViewPassphrase)
        // Dismiss the options menu first so we don't end up with the menu
        // sheet stacked under the PIN/acknowledge/display sheets.
        onClose()
        void openViewPassphraseFlow(account.address)
    }, [onClose, openViewPassphraseFlow, account.address])

    const handleUndoRekey = useCallback(() => {
        onClose()
        navigation.navigate('UndoRekey', {
            screen: 'UndoRekeyConfirm',
            params: { sourceAddress: account.address },
        })
    }, [onClose, navigation, account.address])

    const handleRekeyToLedger = useCallback(() => {
        trackEvent(AccountOptionsEvent.RekeyToLedger)
        onClose()
        navigation.navigate('RekeyToLedger', {
            screen: 'RekeyToLedgerIntro',
            params: { sourceAddress: account.address },
        })
    }, [onClose, navigation, account.address])

    const handleRekeyToStandard = useCallback(() => {
        trackEvent(AccountOptionsEvent.RekeyToStandard)
        onClose()
        navigation.navigate('RekeyToStandard', {
            screen: 'RekeyToStandardIntro',
            params: { sourceAddress: account.address },
        })
    }, [onClose, navigation, account.address])

    const handleRekeyToShared = useCallback(() => {
        trackEvent(AccountDetailsEvent.JointAccountRekey)
        onClose()
        navigation.navigate('RekeyToShared', {
            screen: 'RekeyToSharedIntro',
            params: { sourceAddress: account.address },
        })
    }, [onClose, navigation, account.address])

    const handleExportShareAccount = useCallback(async () => {
        trackEvent(AccountDetailsEvent.JointAccountExport)
        onClose()
        await requestBottomSheet<void>({
            contents: (
                <ExportShareAccountContent accountAddress={account.address} />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [onClose, requestBottomSheet, account.address])

    const handleOpenSharedAccountDetail = useCallback(async () => {
        if (!isMultisigAccount(account) || !account.multisigDetails) return
        trackEvent(AccountDetailsEvent.JointAccountDetail)
        onClose()
        const details: SharedAccountDetails = {
            name: account.name ?? '',
            address: account.address,
            participantCount: account.multisigDetails.addresses.length,
            threshold: account.multisigDetails.threshold,
            addresses: account.multisigDetails.addresses,
        }
        await requestBottomSheet<void>({
            contents: <SharedAccountDetailsContent details={details} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [onClose, requestBottomSheet, account])

    const handleOpenRename = useCallback(async () => {
        trackEvent(AccountOptionsEvent.Rename)
        onClose()
        const newName = await requestBottomSheet<string>({
            contents: <RenameAccountContent accountAddress={account.address} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
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
            a =>
                a.rekeyAddress === account.address &&
                a.address !== account.address,
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
        void removeAccount(account.address)
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
    }, [accounts, account.address, removeAccount, navigation, showToast, t])

    const handleOpenRemoveConfirm = useCallback(async () => {
        trackEvent(AccountOptionsEvent.Remove)
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

        if (isSharedAccount) {
            items.push({
                id: 'shared-account-detail',
                icon: 'people',
                title: t('account_options.shared_account_detail', {
                    count: participantCount,
                }),
                onPress: () => void handleOpenSharedAccountDetail(),
            })
        }

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
            // Rekeying needs a signature from the source account, so only
            // offer it when this wallet can actually sign for the multisig.
            // Export stays available regardless — it only reads metadata.
            if (canSign) {
                items.push({
                    id: 'rekey-to-shared',
                    icon: 'rekey',
                    title: t('account_options.rekey_to_shared'),
                    onPress: handleRekeyToShared,
                })
            }

            items.push({
                id: 'export-share-account',
                icon: 'share',
                title: t('account_options.export_share_account'),
                onPress: () => void handleExportShareAccount(),
            })
        }

        items.push({
            id: 'rename-account',
            icon: 'edit-pen',
            title: t('account_options.rename_account'),
            onPress: () => void handleOpenRename(),
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
            onPress: () => void handleOpenRemoveConfirm(),
            variant: 'destructive',
        })

        return items
    }, [
        t,
        account.address,
        participantCount,
        showPassphrase,
        canSign,
        isSharedAccount,
        notificationsEnabled,
        handleCopyAddress,
        handleShowAddress,
        handleViewPassphrase,
        isHdWallet,
        handleRekeyToLedger,
        handleRekeyToStandard,
        handleRekeyToShared,
        handleExportShareAccount,
        handleOpenSharedAccountDetail,
        handleOpenRename,
        handleToggleNotifications,
        handleOpenRemoveConfirm,
    ])

    return {
        options,
        isRekeyed,
        canUndoRekey,
        authAccount: authAccount ?? undefined,
        authAddress: account.rekeyAddress,
        handleUndoRekey,
    }
}
