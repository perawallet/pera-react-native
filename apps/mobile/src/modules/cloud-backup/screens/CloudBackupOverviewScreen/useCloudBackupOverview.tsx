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
    deriveBackupAccountReview,
    deriveBackupContactReview,
    backupIdToAddress,
} from '@perawallet/wallet-core-backup'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import {
    formatDatetime,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequirePinVerification } from '@modules/security'
import { BackupCredentialsSheet } from '../../components/BackupCredentialsSheet'
import {
    TurnOffBackupSheet,
    type TurnOffBackupChoice,
} from '../../components/TurnOffBackupSheet'
import {
    useDisableCloudBackup,
    useBackupSync,
    useRemoveCloudBackup,
    useSyncDevicesQr,
} from '../../hooks'
import type { CloudBackupStackParamList } from '../../routes/types'

export type SyncBadge = 'success' | 'failed' | 'syncing'

type UseCloudBackupOverviewResult = {
    syncStatus: SyncBadge | null
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
    onPressSyncDevices: () => Promise<void>
    onPressTurnOff: () => Promise<void>
}

const formatSyncedAt = (millis: number | null): string => {
    if (millis == null) return '—'
    return formatDatetime(new Date(millis), undefined, 'medium')
}

type BackupSyncStatus = ReturnType<typeof deriveBackupSyncStatus>

/** `null` renders no badge: a backup that has never synced is neither in sync
 *  nor syncing, and there is no fourth badge to say so. */
const STATUS_TO_BADGE: Record<BackupSyncStatus, SyncBadge | null> = {
    idle: null,
    pending: null,
    syncing: 'syncing',
    upToDate: 'success',
    error: 'failed',
}

export const useCloudBackupOverview = (): UseCloudBackupOverviewResult => {
    const { requirePinVerification } = useRequirePinVerification()
    const { request: requestBottomSheet } = useBottomSheet()
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()
    const { disableBackup } = useDisableCloudBackup()
    const { removeBackup } = useRemoveCloudBackup()
    const { isSyncing } = useBackupSync()
    const { showSyncQr } = useSyncDevicesQr()
    const backupId = useCloudBackupStore(state => state.backupId)
    const syncState = useBackupSyncStateStore(state => state.syncState)
    const accounts = useAccountsStore(state => state.accounts)
    const contacts = useContactsStore(state => state.contacts)

    const contactAddresses = useMemo(
        () => contacts.map(contact => contact.address),
        [contacts],
    )
    const contactReview = useMemo(
        () => deriveBackupContactReview(syncState, contactAddresses),
        [syncState, contactAddresses],
    )

    const addresses = useMemo(
        () => accounts.map(account => account.address),
        [accounts],
    )
    const { backedUp, notBackedUp } = useMemo(
        () => deriveBackupAccountReview(syncState, addresses),
        [syncState, addresses],
    )

    const status = deriveBackupSyncStatus({
        isConfigured: backupId != null,
        isSyncing,
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
        // TODO: wire the credential-info destination as its screen lands.
    }, [])

    const onPressAccounts = useCallback(
        () => navigation.navigate('CloudBackupAccounts'),
        [navigation],
    )

    const onPressContacts = useCallback(
        () => navigation.navigate('CloudBackupContacts'),
        [navigation],
    )

    const onPressCredentialAddress = useCallback(async () => {
        if (!(await requirePinVerification())) return

        await requestBottomSheet({
            contents: <BackupCredentialsSheet />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requirePinVerification, requestBottomSheet])

    const onPressTurnOff = useCallback(async () => {
        const choice = await requestBottomSheet<TurnOffBackupChoice>({
            contents: <TurnOffBackupSheet />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!choice) return
        if (!(await requirePinVerification())) return

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
    }, [
        requestBottomSheet,
        requirePinVerification,
        disableBackup,
        removeBackup,
    ])

    return {
        syncStatus: STATUS_TO_BADGE[status],
        lastSyncedLabel,
        credentialAddressLabel,
        accountsInSync: backedUp.size,
        accountsNotBackedUp: notBackedUp.length,
        contactsInSync: contactReview.backedUp.size,
        contactsNotBackedUp: contactReview.notBackedUp.length,
        onPressAccounts,
        onPressContacts,
        onPressCredentialAddress,
        onPressCredentialInfo: noop,
        onPressSyncDevices: showSyncQr,
        onPressTurnOff,
    }
}
