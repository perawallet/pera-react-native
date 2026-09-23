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

import { useEffect, useRef, type RefObject } from 'react'
import { AppState } from 'react-native'
import {
    canonicalJson,
    getBackupSyncManager,
    initializeBackupSyncManager,
    useCloudBackupContactImport,
    useCloudBackupImport,
    useCloudBackupPasskeyImport,
    useCloudBackupStore,
    useResolveHdSeedForBackup,
    useResolveMnemonicForBackup,
    useResolveSeedEntropyForBackup,
    type SerializeHdResolver,
    type SerializeMnemonicResolver,
} from '@perawallet/wallet-core-backup'
import { isPasskeyKey } from '@perawallet/wallet-core-passkeys'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useIsCloudBackupEnabled } from '@hooks/useIsCloudBackupEnabled'
import {
    getAppStatePlatform,
    getPollingTransitionAction,
    isActiveAppState,
} from '@utils/app-state'
import { useListPasskeysForBackup } from './useListPasskeysForBackup'

type BackupSyncCallbacks = {
    importAccounts: ReturnType<typeof useCloudBackupImport>['importAccounts']
    importContacts: ReturnType<
        typeof useCloudBackupContactImport
    >['importContacts']
    resolveHd: SerializeHdResolver
    resolveMnemonic: SerializeMnemonicResolver
    listPasskeys: ReturnType<typeof useListPasskeysForBackup>
    importPasskeys: ReturnType<
        typeof useCloudBackupPasskeyImport
    >['importPasskeys']
    showToast: ReturnType<typeof useToast>['showToast']
    t: ReturnType<typeof useLanguage>['t']
}

const runManagerAction = (action: 'start' | 'stop') => {
    try {
        const manager = getBackupSyncManager()
        if (action === 'start') void manager.start()
        else manager.stop()
    } catch (error) {
        logger.error('useBackupSyncLifecycle: manager action failed', {
            action,
            error,
        })
    }
}

const startBackupSync = () => runManagerAction('start')
const stopBackupSync = () => runManagerAction('stop')

type KeystoreKey = ReturnType<typeof getKeystoreStore>['state']['keys'][number]

const metadataOf = (key: KeystoreKey): Record<string, unknown> =>
    (key.metadata as Record<string, unknown> | undefined) ?? {}

const counterOf = (key: KeystoreKey): number => {
    const counter = metadataOf(key).counter
    return typeof counter === 'number' ? counter : 0
}

/** Cheap enough to run on every keystore write: no derivation, just fields
 *  already sitting in memory on the keystore snapshot. Covers both what
 *  `listPasskeys` derivation depends on (`id`, `counter` — `origin`/`identity`
 *  never change for an existing credential, and add/remove shows up in the id
 *  set) and what the review row renders (`origin`, `displayName`, `userName`;
 *  the row's label is `displayName ?? origin`), so a credential whose display
 *  metadata changed doesn't wait for an unrelated sync to refresh it.
 *  `canonicalJson` per entry rather than delimiter-joining, since these are
 *  unconstrained strings that could otherwise collide across the separator. */
const passkeyKeysFingerprint = (): string =>
    getKeystoreStore()
        .state.keys.filter(isPasskeyKey)
        .map(key => {
            const metadata = metadataOf(key)
            return canonicalJson({
                id: key.id,
                counter: counterOf(key),
                origin: metadata.origin ?? null,
                displayName: metadata.displayName ?? null,
                userName: metadata.userName ?? null,
            })
        })
        .sort()
        .join('|')

/** The keystore store fires on every write — account import, HD derivation,
 *  ledger add, all of it — so this filters to passkey keys and fingerprints
 *  them before deciding whether `onChange` (the manager's expensive
 *  `listPasskeys` sweep) needs to run at all. */
const subscribePasskeyChanges = (onChange: () => void): (() => void) => {
    let last = passkeyKeysFingerprint()
    const sub = getKeystoreStore().subscribe(() => {
        const next = passkeyKeysFingerprint()
        if (next === last) return
        last = next
        onChange()
    })
    return () => sub.unsubscribe()
}

/** Holds the newest callback identities behind a stable ref, so the manager can
 *  call them without being re-created when one of them changes. */
const useLatestBackupSyncCallbacks = (): RefObject<BackupSyncCallbacks> => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { importAccounts } = useCloudBackupImport()
    const { importContacts } = useCloudBackupContactImport()
    const resolveHd = useResolveHdSeedForBackup()
    const resolveMnemonic = useResolveMnemonicForBackup()
    const listPasskeys = useListPasskeysForBackup()
    const { importPasskeys } = useCloudBackupPasskeyImport(
        useResolveSeedEntropyForBackup(),
    )

    const latest = useRef<BackupSyncCallbacks>({
        importAccounts,
        importContacts,
        resolveHd,
        resolveMnemonic,
        listPasskeys,
        importPasskeys,
        showToast,
        t,
    })

    useEffect(() => {
        latest.current = {
            importAccounts,
            importContacts,
            resolveHd,
            resolveMnemonic,
            listPasskeys,
            importPasskeys,
            showToast,
            t,
        }
    }, [
        importAccounts,
        importContacts,
        resolveHd,
        resolveMnemonic,
        listPasskeys,
        importPasskeys,
        showToast,
        t,
    ])

    return latest
}

/** Installs the sync singleton once for the app's lifetime. The manager holds a
 *  live WebSocket, so re-creating it on a callback identity change would drop
 *  the socket mid-session — hence the wrappers over the ref. */
const useBackupSyncManagerSetup = () => {
    const latest = useLatestBackupSyncCallbacks()

    useEffect(() => {
        initializeBackupSyncManager({
            importAccounts: accounts => latest.current.importAccounts(accounts),
            importContacts: contacts => latest.current.importContacts(contacts),
            resolveHd: account => latest.current.resolveHd(account),
            resolveMnemonic: account => latest.current.resolveMnemonic(account),
            listPasskeys: () => latest.current.listPasskeys(),
            importPasskeys: passkeys => latest.current.importPasskeys(passkeys),
            subscribePasskeyChanges,
            onBackupDeleted: () =>
                latest.current.showToast({
                    title: latest.current.t('cloud_backup.deleted_remotely'),
                    body: '',
                    type: 'info',
                }),
        })
    }, [latest])
}

/** Runs the manager only while `isActive` and the app is foregrounded, matching
 *  how the account poll is gated. */
const useForegroundBackupSync = (isActive: boolean) => {
    const platform = useRef(getAppStatePlatform()).current
    const appState = useRef(AppState.currentState)

    useEffect(() => {
        if (!isActive) return

        // Cold starts can begin in the background (push-launched, iOS
        // prewarming), and syncing reads every account's key material — so the
        // initial run is gated on the same "foregrounded" condition the
        // transitions below apply, not just on `isActive`.
        appState.current = AppState.currentState
        if (isActiveAppState(appState.current)) startBackupSync()

        const subscription = AppState.addEventListener(
            'change',
            nextAppState => {
                const action = getPollingTransitionAction(
                    appState.current,
                    nextAppState,
                    platform,
                )
                if (action === 'start') startBackupSync()
                else if (action === 'stop') stopBackupSync()

                appState.current = nextAppState
            },
        )

        return () => {
            stopBackupSync()
            subscription.remove()
        }
    }, [isActive, platform])
}

export const useBackupSyncLifecycle = () => {
    const isCloudBackupEnabled = useIsCloudBackupEnabled()
    const backupId = useCloudBackupStore(state => state.backupId)

    useBackupSyncManagerSetup()
    // `backupId` lands in the same turn as the on-device keys, so gating on it
    // is what starts the manager when backup is enabled mid-session —
    // `start()` silently no-ops while there are no credentials.
    useForegroundBackupSync(isCloudBackupEnabled && backupId != null)
}
