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
    accountChainIdOf,
    addressOn,
    authorityOf,
    hasRecoverySeed,
    hasSigningKeys,
    isMultisigAccount,
    isDelegatedAccount,
    multisigParametersOf,
    standaloneSecretOf,
    useAccountCapabilityScope,
    useAllAccounts,
    useAuthorityOf,
    useCanSignWith,
    useFindAccountByAddress,
    useMultisigDetailsBackfill,
    useRegisteredChainIds,
    useRemoveAccount,
    useUpdateAccount,
} from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    useNotificationPreferences,
    useNotificationsChainResolver,
} from '@perawallet/wallet-core-messages'
import { getBackupSyncManager } from '@perawallet/wallet-core-backup'
import { logger, toError, type Optional } from '@perawallet/wallet-core-shared'
import type { SheetOption } from '@components/SheetOptionRow'
import { useLanguage } from '@hooks/useLanguage'
import { useAccountName } from '@hooks/useAccountName'
import { useToast } from '@hooks/useToast'
import { useSingleFlight } from '@hooks/useSingleFlight'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { rekeyRequirementFor } from '@hooks/capabilityRequirements'
import { useAccountNotificationToggle } from '@hooks/useAccountNotificationToggle'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useRevealPrivateKeyFlow,
    useViewPassphraseFlow,
} from '@modules/view-passphrase'
import { useIsAccountBackedUp } from '@modules/cloud-backup'
import { useIsCloudBackupAvailable } from '@hooks/useIsCloudBackupAvailable'
import { ExportShareAccountContent } from '@modules/multisig'
import {
    SharedAccountDetailsContent,
    type SharedAccountDetails,
} from '../SharedAccountDetailsContent'
import { useIsMultichain } from '../../hooks/useIsMultichain'
import {
    trackEvent,
    AccountDetailsEvent,
    AccountOptionsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { RenameAccountContent } from './RenameAccountContent'
import {
    useAccountNetworks,
    type UseAccountNetworksResult,
} from './useAccountNetworks'

export type UseAccountOptionsParams = {
    account: WalletAccount
    onClose: () => void
    onShowAddress: (account: WalletAccount, chainId: ChainId) => void
}

export type RemoveConfirmView =
    | 'none'
    | 'backup-warning'
    | 'remove-confirm'
    | 'cloud-backup-delete'

type BackupChoice = 'delete' | 'keep'

export type UseAccountOptionsResult = {
    sheetTitle: string
    /** Names the account when more than one chain is active. */
    networksTitle: string
    /** Rename, notifications where the account's chain can notify it, remove, then the account's secret if it has one. */
    topActions: SheetOption[]
    sharedAccountOptions: SheetOption[]
    networks: UseAccountNetworksResult
    isCloudBackupAvailable: boolean
    isRekeyed: boolean
    canUndoRekey: boolean
    authAccount: Optional<WalletAccount>
    authAddress: Optional<string>
    handleUndoRekey: () => void
    removeConfirmView: RemoveConfirmView
    handleConfirmBackupWarning: () => void
    handleConfirmRemove: () => void
    handleDeleteFromBackup: () => Promise<void>
    handleKeepInBackup: () => Promise<void>
    pendingBackupChoice: Optional<BackupChoice>
    handleCancelRemove: () => void
    handleToggleNotifications: () => void
}

export const useAccountOptions = ({
    account,
    onClose,
    onShowAddress,
}: UseAccountOptionsParams): UseAccountOptionsResult => {
    const { t } = useLanguage()
    const { showToast, errorToast } = useToast()
    const { isAccountEnabled } = useNotificationPreferences()
    const { toggleAccountNotification, isTogglePending } =
        useAccountNotificationToggle()
    const accounts = useAllAccounts()
    const removeAccount = useRemoveAccount()
    const updateAccount = useUpdateAccount()
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const { openViewPassphraseFlow } = useViewPassphraseFlow()
    const { openRevealPrivateKeyFlow } = useRevealPrivateKeyFlow()
    const isCloudBackupAvailable = useIsCloudBackupAvailable()
    const registeredChainIds = useRegisteredChainIds()
    const accountChainId = accountChainIdOf(account, registeredChainIds)
    const scope = useSelectedScope(accountChainId)
    const notificationsChainOf = useNotificationsChainResolver()
    const canToggleNotifications = notificationsChainOf(account) !== undefined
    const { getAccountName } = useAccountName()
    const isMultichain = useIsMultichain()
    const sheetTitle = getAccountName(account, accountChainId)
    const networksTitle = isMultichain
        ? t('account_options.networks_title_named', { name: sheetTitle })
        : t('account_options.networks_title')
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
    const privateKeyScope = useAccountCapabilityScope(account, 'privateKeys')
    const showPrivateKey =
        privateKeyScope !== null && standaloneSecretOf(account) === 'privateKey'
    const isSharedAccount = isMultisigAccount(account)
    const multisigParameters = useMemo(
        () => multisigParametersOf(account, scope.chainId),
        [account, scope.chainId],
    )
    const participantCount = multisigParameters?.addresses.length ?? 0

    const authority = useAuthorityOf(account, scope)
    const authAccount = useFindAccountByAddress(authority ?? '', scope)

    const handleViewPassphrase = useCallback(() => {
        trackEvent(AccountOptionsEvent.ViewPassphrase, {
            [AnalyticsMetadataKey.ChainId]: accountChainId,
        })
        // Dismiss the options menu first so we don't end up with the menu
        // sheet stacked under the PIN/acknowledge/display sheets.
        onClose()
        void openViewPassphraseFlow(address)
    }, [onClose, openViewPassphraseFlow, address, accountChainId])

    const handleViewPrivateKey = useCallback(() => {
        if (!privateKeyScope) return
        // Dismissed first so the menu doesn't stay stacked under the PIN
        // and key sheets.
        onClose()
        void openRevealPrivateKeyFlow(account.id, privateKeyScope.chainId)
    }, [onClose, openRevealPrivateKeyFlow, account.id, privateKeyScope])

    const handleUndoRekey = useCallback(() => {
        onClose()
        navigation.navigate('UndoRekey', {
            screen: 'UndoRekeyConfirm',
            params: { sourceAddress: address },
        })
    }, [onClose, navigation, address])

    const handleExportShareAccount = useCallback(async () => {
        trackEvent(AccountDetailsEvent.JointAccountExport, {
            [AnalyticsMetadataKey.ChainId]: accountChainId,
        })
        onClose()
        await requestBottomSheet<void>({
            contents: (
                <ExportShareAccountContent
                    accountAddress={address}
                    chainId={accountChainId}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [onClose, requestBottomSheet, address, accountChainId])

    const handleOpenSharedAccountDetail = useCallback(async () => {
        if (!isMultisigAccount(account) || !multisigParameters) return
        trackEvent(AccountDetailsEvent.JointAccountDetail, {
            [AnalyticsMetadataKey.ChainId]: accountChainId,
        })
        onClose()
        const details: SharedAccountDetails = {
            name: sheetTitle,
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
    }, [
        onClose,
        requestBottomSheet,
        account,
        address,
        multisigParameters,
        accountChainId,
        sheetTitle,
    ])

    const handleOpenRename = useCallback(async () => {
        trackEvent(AccountOptionsEvent.Rename, {
            [AnalyticsMetadataKey.ChainId]: accountChainId,
        })
        onClose()
        const newName = await requestBottomSheet<string>({
            contents: <RenameAccountContent accountId={account.id} />,
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
        accountChainId,
        onClose,
        requestBottomSheet,
        account,
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

        errorToast(
            t('account_options.remove_rekey_error_title'),
            t('account_options.remove_rekey_error_message', {
                count: rekeyedToThisAccount.length,
            }),
        )
        return true
    }, [accounts, scope, address, account.id, errorToast, t])

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
        trackEvent(AccountOptionsEvent.Remove, {
            [AnalyticsMetadataKey.ChainId]: accountChainId,
        })
        // Render confirmation inline inside the already-open AccountOptions sheet
        // instead of opening a second BottomSheetModal. gorhom's stackBehavior='push'
        // causes the second modal's window to sit behind the first on iOS, making the
        // confirm button non-hittable in XCUITest regardless of timing.
        if (hasSigningKeys(account)) {
            setRemoveConfirmView('backup-warning')
        } else {
            setRemoveConfirmView('remove-confirm')
        }
    }, [account, accountChainId])

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
            errorKey: I18nKey,
        ) => {
            const isRecorded = await runBackupChoice(async () => {
                try {
                    return await choose()
                } catch (error) {
                    logger.warn('useAccountOptions: backup choice failed', {
                        address: address,
                        error: toError(error).message,
                    })
                    return false
                }
            }, choice)
            if (isRecorded === undefined) return
            if (!isRecorded) {
                errorToast(t(errorKey), '')
                return
            }
            finishRemove()
        },
        [runBackupChoice, errorToast, t, finishRemove, address],
    )

    const handleDeleteFromBackup = useCallback(() => {
        trackEvent(AccountOptionsEvent.DeleteFromCloudBackup, {
            [AnalyticsMetadataKey.ChainId]: accountChainId,
        })
        return finishRemoveWithBackupChoice(
            'delete',
            async () =>
                (await getBackupSyncManager().deleteAccountFromBackup(
                    address,
                )) !== 'refused',
            i18nKey('cloud_backup.accounts.delete_error'),
        )
    }, [finishRemoveWithBackupChoice, address, accountChainId])

    const handleKeepInBackup = useCallback(() => {
        trackEvent(AccountOptionsEvent.KeepInCloudBackup, {
            [AnalyticsMetadataKey.ChainId]: accountChainId,
        })
        return finishRemoveWithBackupChoice(
            'keep',
            () => getBackupSyncManager().keepAccountInBackup(address),
            i18nKey('cloud_backup.accounts.keep_error'),
        )
    }, [finishRemoveWithBackupChoice, address, accountChainId])

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

    const networks = useAccountNetworks({ account, onClose, onShowAddress })

    const topActions = useMemo(() => {
        const items: SheetOption[] = [
            {
                id: 'rename-account',
                icon: 'edit-pen',
                title: t('account_options.rename_account'),
                onPress: () => void handleOpenRename(),
            },
        ]

        if (canToggleNotifications) {
            items.push({
                id: 'toggle-notifications',
                icon: 'bell',
                title: notificationsEnabled
                    ? t('account_options.mute_notifications')
                    : t('account_options.unmute_notifications'),
                onPress: handleToggleNotifications,
                disabled: isNotificationTogglePending,
            })
        }

        items.push({
            id: 'remove-account',
            icon: 'unlink',
            title: t('account_options.remove_account'),
            onPress: () => void handleOpenRemoveConfirm(),
            variant: 'destructive',
        })

        if (showPassphrase) {
            items.push({
                id: 'view-passphrase',
                icon: 'key',
                title: t('account_options.view_passphrase'),
                onPress: handleViewPassphrase,
            })
        }

        if (showPrivateKey) {
            items.push({
                id: 'view-private-key',
                icon: 'key',
                title: t('account_options.view_private_key'),
                onPress: handleViewPrivateKey,
            })
        }

        return items
    }, [
        t,
        showPassphrase,
        showPrivateKey,
        canToggleNotifications,
        notificationsEnabled,
        isNotificationTogglePending,
        handleViewPassphrase,
        handleViewPrivateKey,
        handleOpenRename,
        handleToggleNotifications,
        handleOpenRemoveConfirm,
    ])

    const sharedAccountOptions = useMemo((): SheetOption[] => {
        if (!isSharedAccount || !canUseMultisig) return []
        return [
            {
                id: 'shared-account-detail',
                icon: 'people',
                title: t('account_options.shared_account_detail', {
                    count: participantCount,
                }),
                onPress: () => void handleOpenSharedAccountDetail(),
            },
            // Export stays available regardless of signing: it only reads metadata.
            {
                id: 'export-share-account',
                icon: 'share',
                title: t('account_options.export_share_account'),
                onPress: () => void handleExportShareAccount(),
            },
        ]
    }, [
        t,
        isSharedAccount,
        canUseMultisig,
        participantCount,
        handleOpenSharedAccountDetail,
        handleExportShareAccount,
    ])

    return {
        sheetTitle,
        networksTitle,
        topActions,
        sharedAccountOptions,
        networks,
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
