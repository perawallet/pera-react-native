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

import { useCallback, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useCloudBackupStore,
    useBackupSyncStateStore,
    deriveBackupSyncStatus,
    backupIdToAddress,
    BackupItemType,
    BackupItemStatus,
    type SyncState,
} from '@perawallet/wallet-core-backup'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { usePinCode } from '@perawallet/wallet-core-security'
import {
    formatDatetime,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { PinEditContent } from '@modules/security'
import {
    BackupCredentialsSheet,
    type BackupCredentialsResult,
} from '../../components/BackupCredentialsSheet'
import {
    TurnOffBackupSheet,
    type TurnOffBackupChoice,
} from '../../components/TurnOffBackupSheet'
import {
    useDisableCloudBackup,
    useBackupSync,
    useRemoveCloudBackup,
} from '../../hooks'
import type { CloudBackupStackParamList } from '../../routes/types'

export type SyncBadge = 'success' | 'failed' | 'syncing'

type UseCloudBackupOverviewResult = {
    syncStatus: SyncBadge
    lastSyncedLabel: string
    credentialAddressLabel: string
    accountsInSync: number
    accountsNotBackedUp: number
    contactsInSync: number
    contactsNotBackedUp: number
    onPressAccounts: () => void
    onPressContacts: () => void
    onPressCredentialAddress: () => Promise<void>
    onPressCredentialInfo: () => void
    onPressSyncDevices: () => void
    onPressTurnOff: () => Promise<void>
}

type SyncCounts = {
    accountsInSync: number
    contactsInSync: number
}

const deriveSyncCounts = (syncState: SyncState | null): SyncCounts => {
    let accountsInSync = 0
    let contactsInSync = 0

    if (syncState != null) {
        for (const item of Object.values(syncState.items)) {
            if (item.status !== BackupItemStatus.ACTIVE) continue

            switch (item.type) {
                case BackupItemType.ACCOUNT: {
                    accountsInSync += 1
                    break
                }
                case BackupItemType.CONTACT: {
                    contactsInSync += 1
                    break
                }
            }
        }
    }

    return { accountsInSync, contactsInSync }
}

const formatSyncedAt = (millis: number | null): string => {
    if (millis == null) return '—'
    return formatDatetime(new Date(millis), undefined, 'medium')
}

type BackupSyncStatus = ReturnType<typeof deriveBackupSyncStatus>

const STATUS_TO_BADGE: Record<BackupSyncStatus, SyncBadge> = {
    idle: 'success',
    syncing: 'syncing',
    upToDate: 'success',
    destroyed: 'failed',
    error: 'failed',
}

export const useCloudBackupOverview = (): UseCloudBackupOverviewResult => {
    const { checkPinEnabled } = usePinCode()
    const { request: requestBottomSheet } = useBottomSheet()
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()
    const { disableBackup } = useDisableCloudBackup()
    const { removeBackup } = useRemoveCloudBackup()
    const { syncNow, isSyncing } = useBackupSync()
    const backupId = useCloudBackupStore(state => state.backupId)
    const syncState = useBackupSyncStateStore(state => state.syncState)
    const accountsTotal = useAccountsStore(state => state.accounts.length)
    const contactsTotal = useContactsStore(state => state.contacts.length)

    const { accountsInSync, contactsInSync } = useMemo(
        () => deriveSyncCounts(syncState),
        [syncState],
    )

    const status = deriveBackupSyncStatus({
        isConfigured: backupId != null,
        isSyncing,
        isDestroyed: false,
        lastSyncResult: syncState?.lastSyncResult ?? null,
    })

    const credentialAddressLabel = backupId
        ? truncateAlgorandAddress(backupIdToAddress(backupId))
        : ''

    const lastSyncedAt = syncState?.lastSyncedAt ?? null
    const lastSyncedLabel = useMemo(
        () => formatSyncedAt(lastSyncedAt),
        [lastSyncedAt],
    )

    const noop = useCallback(() => {
        // TODO: wire row destinations as their screens land.
    }, [])

    const verifyPinIfEnabled = useCallback(async (): Promise<boolean> => {
        const pinEnabled = await checkPinEnabled()
        if (!pinEnabled) return true
        const verified = await requestBottomSheet<boolean>({
            contents: <PinEditContent mode='verify' />,
            options: {
                size: 'full',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
            },
        })
        return verified === true
    }, [checkPinEnabled, requestBottomSheet])

    const onPressCredentialAddress = useCallback(async () => {
        if (!(await verifyPinIfEnabled())) return

        const result = await requestBottomSheet<BackupCredentialsResult>({
            contents: <BackupCredentialsSheet />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })

        // The stored phrase couldn't be read, so the only way back to a
        // working backup is re-entering it — see Case 25 in the backup flow
        // docs.
        if (result === 'restore') {
            navigation.navigate('CloudBackupRestorePassphrase')
        }
    }, [verifyPinIfEnabled, requestBottomSheet, navigation])

    const onPressTurnOff = useCallback(async () => {
        const choice = await requestBottomSheet<TurnOffBackupChoice>({
            contents: <TurnOffBackupSheet />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!choice) return
        if (!(await verifyPinIfEnabled())) return

        switch (choice) {
            case 'turnOff': {
                disableBackup()
                break
            }
            case 'turnOffAndRemove': {
                removeBackup()
                break
            }
            default: {
                const exhaustiveCheck: never = choice
                return exhaustiveCheck
            }
        }
    }, [requestBottomSheet, verifyPinIfEnabled, disableBackup, removeBackup])

    const onPressSyncDevices = useCallback(() => {
        void syncNow()
    }, [syncNow])

    return {
        syncStatus: STATUS_TO_BADGE[status],
        lastSyncedLabel,
        credentialAddressLabel,
        accountsInSync,
        accountsNotBackedUp: Math.max(0, accountsTotal - accountsInSync),
        contactsInSync,
        contactsNotBackedUp: Math.max(0, contactsTotal - contactsInSync),
        onPressAccounts: noop,
        onPressContacts: noop,
        onPressCredentialAddress,
        onPressCredentialInfo: noop,
        onPressSyncDevices,
        onPressTurnOff,
    }
}
