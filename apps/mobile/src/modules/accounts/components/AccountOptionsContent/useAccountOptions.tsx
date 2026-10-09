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

import { useCallback, useMemo, useState } from 'react'
import {
    type WalletAccount,
    addressOn,
    authorityOf,
    hasRecoverySeed,
    hasSigningKeys,
    hdIndexOf,
    isMultisigAccount,
    isDelegatedAccount,
    multisigParametersOf,
    useAllAccounts,
    useAuthorityOf,
    useCanSignWith,
    useFindAccountByAddress,
    useMultisigDetailsBackfill,
    useRemoveAccount,
    useUpdateAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { getBackupSyncManager } from '@perawallet/wallet-core-backup'
import { logger, truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useSingleFlight } from '@hooks/useSingleFlight'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { rekeyRequirementFor } from '@hooks/capabilityRequirements'
import { useAccountNotificationToggle } from '@hooks/useAccountNotificationToggle'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useViewPassphraseFlow } from '@modules/view-passphrase'
import { useIsAccountBackedUp } from '@modules/cloud-backup'
import { useIsCloudBackupAvailable } from '@hooks/useIsCloudBackupAvailable'
import { ExportShareAccountContent } from '@modules/multisig'
import {
    SharedAccountDetailsContent,
    type SharedAccountDetails,
} from '../SharedAccountDetailsContent'
import type { IconName } from '@components/core'
import {
    trackEvent,
    AccountDetailsEvent,
    AccountOptionsEvent,
} from '@analytics'
import { RenameAccountContent } from './RenameAccountContent'
import {
    RekeyOptionsContent,
    type RekeyTargetType,
} from './RekeyOptionsContent'

export type AccountOption = {
    id: string
    icon: IconName
    title: string
    subtitle?: string
    onPress: () => void
    variant?: 'default' | 'destructive'
    disabled?: boolean
}

export type UseAccountOptionsParams = {
    account: WalletAccount
    onClose: () => void
    onShowAddress: () => void
}

export type RemoveConfirmView =
    | 'none'
    | 'backup-warning'
    | 'remove-confirm'
    | 'cloud-backup-delete'

type BackupChoice = 'delete' | 'keep'

export type UseAccountOptionsResult = {
    options: AccountOption[]
    isCloudBackupAvailable: boolean
    isRekeyed: boolean
    canUndoRekey: boolean
    authAccount: WalletAccount | undefined
    authAddress: string | undefined
    handleUndoRekey: () => void
    removeConfirmView: RemoveConfirmView
    handleConfirmBackupWarning: () => void
    handleConfirmRemove: () => void
    handleDeleteFromBackup: () => Promise<void>
    handleKeepInBackup: () => Promise<void>
    pendingBackupChoice: BackupChoice | undefined
    handleCancelRemove: () => void
    handleToggleNotifications: () => void
}

export const useAccountOptions = ({
    account,
    onClose,
    onShowAddress,
}: UseAccountOptionsParams): UseAccountOptionsResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { copyToClipboard } = useClipboard()
    const { isAccountEnabled } = useNotificationPreferences()
    const { toggleAccountNotification, isTogglePending } =
        useAccountNotificationToggle()
    const accounts = useAllAccounts()
    const removeAccount = useRemoveAccount()
    const updateAccount = useUpdateAccount()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const { openViewPassphraseFlow } = useViewPassphraseFlow()
    const isCloudBackupAvailable = useIsCloudBackupAvailable()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const address = addressOn(account, scope) ?? ''
    const isBackedUp = useIsAccountBackedUp(address)

    useMultisigDetailsBackfill(account, scope)

    const canSign = useCanSignWith(account, scope.chainId)
    const canRekey = useCapability(rekeyRequirementFor(scope.chainId))
    const canUseMultisig = useCapability({
        platform: 'sharedAccounts',
        anyChain: 'multisig',
    })
    const isRekeyed = isDelegatedAccount(account, scope.chainId)
    const canBackUpMnemonic = useCapability({
        chain: { chainId: scope.chainId, capability: 'mnemonicBackup' },
    })
    const showPassphrase =
        canBackUpMnemonic && !isRekeyed && hasRecoverySeed(account)
    const canUndoRekey = canRekey && isRekeyed && canSign
    const isHdWallet = hdIndexOf(account) !== undefined
    const isSharedAccount = isMultisigAccount(account)
    const multisigParameters = useMemo(
        () => multisigParametersOf(account, scope.chainId),
        [account, scope.chainId],
    )
    const participantCount = multisigParameters?.addresses.length ?? 0

    const authority = useAuthorityOf(account, scope)
    const authAccount = useFindAccountByAddress(authority ?? '', scope)

    const handleCopyAddress = useCallback(() => {
        trackEvent(AccountOptionsEvent.CopyAddress)
        void copyToClipboard(address)
        onClose()
    }, [copyToClipboard, address, onClose])

    const handleShowAddress = useCallback(() => {
        onClose()
        onShowAddress()
    }, [onClose, onShowAddress])

    const handleViewPassphrase = useCallback(() => {
        trackEvent(AccountOptionsEvent.ViewPassphrase)
        // Dismiss the options menu first so we don't end up with the menu
        // sheet stacked under the PIN/acknowledge/display sheets.
        onClose()
        void openViewPassphraseFlow(address)
    }, [onClose, openViewPassphraseFlow, address])

    const handleUndoRekey = useCallback(() => {
        onClose()
        navigation.navigate('UndoRekey', {
            screen: 'UndoRekeyConfirm',
            params: { sourceAddress: address },
        })
    }, [onClose, navigation, address])

    const navigateToRekeyFlow = useCallback(
        (target: RekeyTargetType | 'shared') => {
            switch (target) {
                case 'ledger': {
                    trackEvent(AccountOptionsEvent.RekeyToLedger)
                    navigation.navigate('RekeyToLedger', {
                        screen: 'RekeyToLedgerIntro',
                        params: { sourceAddress: address },
                    })
                    return
                }
                case 'standard': {
                    trackEvent(AccountOptionsEvent.RekeyToStandard)
                    navigation.navigate('RekeyToStandard', {
                        screen: 'RekeyToStandardIntro',
                        params: { sourceAddress: address },
                    })
                    return
                }
                case 'quantum': {
                    trackEvent(AccountOptionsEvent.RekeyToQuantum)
                    navigation.navigate('RekeyToQuantum', {
                        screen: 'RekeyToQuantumIntro',
                        params: { sourceAddress: address },
                    })
                    return
                }
                case 'shared': {
                    trackEvent(AccountDetailsEvent.JointAccountRekey)
                    navigation.navigate('RekeyToShared', {
                        screen: 'RekeyToSharedIntro',
                        params: { sourceAddress: address },
                    })
                }
            }
        },
        [navigation, address],
    )

    const handleRekeyAccount = useCallback(async () => {
        onClose()
        // A shared account can only be rekeyed to another shared account, so
        // the type sheet would hold a single row — go straight to its intro.
        if (isSharedAccount) {
            navigateToRekeyFlow('shared')
            return
        }
        const target = await requestBottomSheet<RekeyTargetType>({
            contents: <RekeyOptionsContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!target) return
        navigateToRekeyFlow(target)
    }, [onClose, isSharedAccount, requestBottomSheet, navigateToRekeyFlow])

    const handleScanRekeyed = useCallback(() => {
        trackEvent(AccountOptionsEvent.ScanRekeyed)
        onClose()
        navigation.navigate('RescanRekeyed', {
            screen: 'RescanRekeyedSelect',
            params: { sourceAddress: address },
        })
    }, [onClose, navigation, address])

    const handleExportShareAccount = useCallback(async () => {
        trackEvent(AccountDetailsEvent.JointAccountExport)
        onClose()
        await requestBottomSheet<void>({
            contents: <ExportShareAccountContent accountAddress={address} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [onClose, requestBottomSheet, address])

    const handleOpenSharedAccountDetail = useCallback(async () => {
        if (!isMultisigAccount(account) || !multisigParameters) return
        trackEvent(AccountDetailsEvent.JointAccountDetail)
        onClose()
        const details: SharedAccountDetails = {
            name: account.name ?? '',
            address,
            participantCount: multisigParameters.addresses.length,
            threshold: multisigParameters.threshold,
            addresses: [...multisigParameters.addresses],
        }
        await requestBottomSheet<void>({
            contents: <SharedAccountDetailsContent details={details} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [onClose, requestBottomSheet, account, address, multisigParameters])

    const handleOpenRename = useCallback(async () => {
        trackEvent(AccountOptionsEvent.Rename)
        onClose()
        const newName = await requestBottomSheet<string>({
            contents: <RenameAccountContent accountAddress={address} />,
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
    }, [
        onClose,
        requestBottomSheet,
        account,
        address,
        updateAccount,
        showToast,
        t,
    ])

    const handleToggleNotifications = useCallback(() => {
        const currentlyEnabled = isAccountEnabled(address)
        // The sheet closes at once so the interaction feels immediate; the
        // confirmation waits for the backend, because before this
        // toast fired for a request that was never sent.
        onClose()
        void toggleAccountNotification(address, !currentlyEnabled).then(
            succeeded => {
                if (!succeeded) return
                showToast({
                    title: currentlyEnabled
                        ? t('account_options.notifications_muted')
                        : t('account_options.notifications_unmuted'),
                    body: '',
                    type: 'success',
                })
            },
        )
    }, [
        isAccountEnabled,
        toggleAccountNotification,
        address,
        showToast,
        t,
        onClose,
    ])

    /** Runs before the cloud-backup question, not with the removal: answering
     *  "Delete" would drop the backup copy of an account the guard then
     *  refuses to remove. */
    const blockedByRekeyedDependents = useCallback((): boolean => {
        const rekeyedToThisAccount = accounts.filter(
            a => authorityOf(a, scope) === address && a.id !== account.id,
        )
        if (rekeyedToThisAccount.length === 0) return false

        showToast({
            title: t('account_options.remove_rekey_error_title'),
            body: t('account_options.remove_rekey_error_message', {
                count: rekeyedToThisAccount.length,
            }),
            type: 'error',
        })
        return true
    }, [accounts, scope, address, account.id, showToast, t])

    const performRemoveAccount = useCallback(() => {
        const hasOtherAccounts = accounts.length > 1
        void removeAccount(account.id)
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
    }, [accounts, account.id, removeAccount, navigation, showToast, t])

    const [removeConfirmView, setRemoveConfirmView] =
        useState<RemoveConfirmView>('none')

    const handleOpenRemoveConfirm = useCallback(() => {
        trackEvent(AccountOptionsEvent.Remove)
        // Render confirmation inline inside the already-open AccountOptions sheet
        // instead of opening a second BottomSheetModal. gorhom's stackBehavior='push'
        // causes the second modal's window to sit behind the first on iOS, making the
        // confirm button non-hittable in XCUITest regardless of timing.
        if (hasSigningKeys(account)) {
            setRemoveConfirmView('backup-warning')
        } else {
            setRemoveConfirmView('remove-confirm')
        }
    }, [account])

    const handleConfirmBackupWarning = useCallback(() => {
        setRemoveConfirmView('remove-confirm')
    }, [])

    const finishRemove = useCallback(() => {
        setRemoveConfirmView('none')
        onClose()
        performRemoveAccount()
    }, [onClose, performRemoveAccount])

    const handleConfirmRemove = useCallback(() => {
        if (blockedByRekeyedDependents()) {
            setRemoveConfirmView('none')
            onClose()
            return
        }
        if (isCloudBackupAvailable && isBackedUp) {
            setRemoveConfirmView('cloud-backup-delete')
            return
        }
        finishRemove()
    }, [
        blockedByRekeyedDependents,
        isCloudBackupAvailable,
        isBackedUp,
        onClose,
        finishRemove,
    ])

    const { pendingKey: pendingBackupChoice, run: runBackupChoice } =
        useSingleFlight<BackupChoice>()

    /** Both branches record the backup choice before the account leaves the
     *  device: a refused choice would strand it in neither review bucket. */
    const finishRemoveWithBackupChoice = useCallback(
        async (
            choice: BackupChoice,
            choose: () => Promise<boolean>,
            errorKey: string,
        ) => {
            const isRecorded = await runBackupChoice(async () => {
                try {
                    return await choose()
                } catch (error) {
                    logger.warn('useAccountOptions: backup choice failed', {
                        address: address,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    })
                    return false
                }
            }, choice)
            if (isRecorded === undefined) return
            if (!isRecorded) {
                showToast({ title: t(errorKey), body: '', type: 'error' })
                return
            }
            finishRemove()
        },
        [runBackupChoice, showToast, t, finishRemove, address],
    )

    const handleDeleteFromBackup = useCallback(() => {
        trackEvent(AccountOptionsEvent.DeleteFromCloudBackup)
        return finishRemoveWithBackupChoice(
            'delete',
            async () =>
                (await getBackupSyncManager().deleteAccountFromBackup(
                    address,
                )) !== 'refused',
            'cloud_backup.accounts.delete_error',
        )
    }, [finishRemoveWithBackupChoice, address])

    const handleKeepInBackup = useCallback(() => {
        trackEvent(AccountOptionsEvent.KeepInCloudBackup)
        return finishRemoveWithBackupChoice(
            'keep',
            () => getBackupSyncManager().keepAccountInBackup(address),
            'cloud_backup.accounts.keep_error',
        )
    }, [finishRemoveWithBackupChoice, address])

    const handleCancelRemove = useCallback(() => {
        setRemoveConfirmView('none')
    }, [])

    const notificationsEnabled = isAccountEnabled(address)
    // Mirrors NotificationSettingsList: disable the row instead of letting a
    // tap silently resolve `false` while a toggle for this address is
    // already in flight (docs/OFFLINE_PAUSED_STATE.md). Note this only
    // reflects toggles started by *this* hook instance — see the caveat on
    // `isTogglePending` in useAccountNotificationToggle.ts.
    const isNotificationTogglePending = isTogglePending(address)

    const options = useMemo(() => {
        const items: AccountOption[] = []

        if (isSharedAccount && canUseMultisig) {
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
            subtitle: truncateAlgorandAddress(address),
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

        // Gated on the capability, not just on the account: every rekey target
        // is a root stack that a platform may not register, and an
        // unregistered route makes the row a silent no-op rather than an error.
        // Rekeying also needs a signature from the source account, so only
        // offer it when this wallet can actually sign. A shared account's only
        // target is another shared account.
        if (canRekey && canSign && (!isSharedAccount || canUseMultisig)) {
            items.push({
                id: 'rekey-account',
                icon: 'rekey',
                title: t('account_options.rekey_account'),
                onPress: () => void handleRekeyAccount(),
            })
        }

        if (isSharedAccount && canUseMultisig) {
            // Export stays available regardless of `canSign` — it only reads
            // metadata.
            items.push({
                id: 'export-share-account',
                icon: 'share',
                title: t('account_options.export_share_account'),
                onPress: () => void handleExportShareAccount(),
            })
        }

        // Post-import rekey discovery: find accounts whose on-chain auth-addr
        // is this account's key. Signable types only — a watch account holds
        // no key another account could be rekeyed to sign with.
        if (canRekey && canSign) {
            items.push({
                id: 'scan-rekeyed',
                icon: 'magnifying-glass',
                title: t('account_options.scan_rekeyed'),
                onPress: handleScanRekeyed,
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
            disabled: isNotificationTogglePending,
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
        address,
        participantCount,
        showPassphrase,
        canSign,
        canRekey,
        canUseMultisig,
        isSharedAccount,
        notificationsEnabled,
        isNotificationTogglePending,
        handleCopyAddress,
        handleShowAddress,
        handleViewPassphrase,
        isHdWallet,
        handleRekeyAccount,
        handleScanRekeyed,
        handleExportShareAccount,
        handleOpenSharedAccountDetail,
        handleOpenRename,
        handleToggleNotifications,
        handleOpenRemoveConfirm,
    ])

    return {
        options,
        isCloudBackupAvailable,
        isRekeyed,
        canUndoRekey,
        authAccount: authAccount ?? undefined,
        authAddress: authority ?? undefined,
        handleUndoRekey,
        removeConfirmView,
        handleConfirmBackupWarning,
        handleConfirmRemove,
        handleDeleteFromBackup,
        handleKeepInBackup,
        pendingBackupChoice,
        handleCancelRemove,
        handleToggleNotifications,
    }
}
