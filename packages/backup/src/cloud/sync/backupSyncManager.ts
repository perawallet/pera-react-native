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

import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import {
    useCloudBackupStore,
    useBackupSyncStateStore,
    resolveBackupDeviceId,
} from '../store'
import {
    withBackupAuthSecretKey,
    withBackupEncryptionKey,
    hasBackupCredentials,
    deleteBackupKeys,
} from '../credentials/keyStorage'
import { createEmptySyncState, type SyncState } from '../models'
import { buildBackupWebSocketToken } from '../crypto/buildBackupWebSocketToken'
import {
    deleteFromBackup,
    importFromBackup,
    keepAccountInBackup,
    markAccountForBackup,
    reviewActionDeps,
} from './reviewActions'
import { accountFingerprint } from './accountFingerprint'
import { syncBackup } from './syncBackup'
import { pullBackupDeltas } from './pullBackupDeltas'
import { serializeAccountForBackup } from './serializeAccountForBackup'
import {
    BackupWebSocketClient,
    type BackupSocketFactory,
    type BackupWebSocketEvent,
} from './webSocketClient'
import type {
    ImportSummary,
    SyncEngineDeps,
    SerializeHdResolver,
    SerializeMnemonicResolver,
} from './types'

const PERIODIC_SYNC_MS = 5 * 60 * 1000
const ACCOUNT_CHANGE_DEBOUNCE_MS = 2000

export type BackupSyncManagerDeps = {
    importAccounts: SyncEngineDeps['importAccounts']
    /** Hook-bound 25-word phrase resolver, injected from RootComponent. */
    resolveMnemonic: SerializeMnemonicResolver
    /** Hook-bound HD seed/derived resolver, injected from RootComponent. */
    resolveHd: SerializeHdResolver
    socketFactory?: BackupSocketFactory
    onStateChange?: () => void
    /** Called after the server deletes the backup and local state is wiped, so
     *  the app can inform the user. */
    onBackupDeleted?: () => void
}

export class BackupSyncManager {
    private running = false
    private syncInProgress = false
    private periodic: Nullable<ReturnType<typeof setInterval>> = null
    private socket: Nullable<BackupWebSocketClient> = null
    private unwatchAccounts: Nullable<() => void> = null
    private accountTimer: Nullable<ReturnType<typeof setTimeout>> = null
    private accountsFingerprint = ''

    constructor(private readonly deps: BackupSyncManagerDeps) {}

    isSyncing(): boolean {
        return this.syncInProgress
    }

    private context(): Nullable<{
        network: Network
        backupId: string
        deviceId: string
    }> {
        const network = useNetworkStore.getState().network
        const { backupId } = useCloudBackupStore.getState()
        const deviceId = resolveBackupDeviceId(network)
        if (!backupId || !deviceId) return null
        return { network, backupId, deviceId }
    }

    private async withEngineDeps<T>(
        ctx: { network: Network; backupId: string; deviceId: string },
        run: (deps: SyncEngineDeps) => Promise<T>,
    ): Promise<Nullable<T>> {
        return withBackupEncryptionKey(encryptionKey =>
            run({
                network: ctx.network,
                backupId: ctx.backupId,
                deviceId: ctx.deviceId,
                encryptionKey,
                listAccounts: () => useAccountsStore.getState().accounts,
                serializeAccount: account =>
                    serializeAccountForBackup(account, {
                        updatedAt: Date.now(),
                        resolveMnemonic: this.deps.resolveMnemonic,
                        resolveHd: this.deps.resolveHd,
                    }),
                importAccounts: this.deps.importAccounts,
            }),
        )
    }

    /** Runs one exclusive mutation of the sync state, so a review action and a
     *  background sync can't both write the whole state and lose the other's
     *  edit. Returns false when a sync already holds the slot. */
    private async withExclusiveState(
        run: (state: SyncState, deps: SyncEngineDeps) => Promise<SyncState>,
    ): Promise<boolean> {
        if (this.syncInProgress) return false
        const ctx = this.context()
        if (!ctx) return false
        this.syncInProgress = true
        this.deps.onStateChange?.()
        try {
            const state =
                useBackupSyncStateStore.getState().syncState ??
                createEmptySyncState(ctx.backupId)
            const next = await this.withEngineDeps(ctx, deps =>
                run(state, deps),
            )
            if (!next) return false
            useBackupSyncStateStore.getState().setSyncState(next)
            return true
        } finally {
            this.syncInProgress = false
            this.deps.onStateChange?.()
        }
    }

    async backUpAccount(address: string): Promise<boolean> {
        const staged = await this.withExclusiveState(async state =>
            markAccountForBackup(state, address),
        )
        if (!staged) return false
        await this.syncNow()
        return true
    }

    async addAccountFromBackup(address: string): Promise<ImportSummary | null> {
        let summary: ImportSummary | null = null
        const done = await this.withExclusiveState(async (state, deps) => {
            const result = await importFromBackup({
                state,
                address,
                deps: reviewActionDeps(deps),
            })
            summary = result.summary
            return result.state
        })
        return done ? summary : null
    }

    async deleteAccountFromBackup(address: string): Promise<boolean> {
        return this.withExclusiveState(async (state, deps) =>
            deleteFromBackup({
                state,
                address,
                deps: reviewActionDeps(deps),
            }),
        )
    }

    /** Leaves the backup's copy in place, so the address returns to the review
     *  screen under "available from backup". */
    async keepAccountInBackup(address: string): Promise<boolean> {
        return this.withExclusiveState(async state =>
            keepAccountInBackup(state, address),
        )
    }

    private watchAccounts(): void {
        this.accountsFingerprint = accountFingerprint(
            useAccountsStore.getState().accounts,
        )
        this.unwatchAccounts = useAccountsStore.subscribe(state => {
            const next = accountFingerprint(state.accounts)
            if (next === this.accountsFingerprint) return
            this.accountsFingerprint = next
            this.scheduleAccountSync()
        })
    }

    /** Debounced so a batch import lands as one sync. Re-arms rather than
     *  dropping when a sync is already running: syncBackup snapshots the
     *  accounts at its start, so an in-flight run cannot see this change. */
    private scheduleAccountSync(): void {
        if (this.accountTimer != null) clearTimeout(this.accountTimer)
        this.accountTimer = setTimeout(() => {
            this.accountTimer = null
            if (!this.running) return
            if (this.syncInProgress) {
                this.scheduleAccountSync()
                return
            }
            void this.syncNow()
        }, ACCOUNT_CHANGE_DEBOUNCE_MS)
    }

    async start(): Promise<void> {
        if (this.running) return
        // No credentials = nothing to sync. This also covers the post-delete
        // state: a server-deleted backup wipes the on-device keys, so start()
        // becomes a no-op until the user sets up a fresh backup.
        if (!hasBackupCredentials()) {
            logger.warn(
                'BackupSyncManager: start skipped, no backup credentials',
            )
            return
        }
        this.running = true
        // Defensive: never leak a prior interval/socket if start races a stop.
        if (this.periodic != null) clearInterval(this.periodic)
        this.socket?.disconnect()
        this.unwatchAccounts?.()
        this.watchAccounts()
        await this.syncNow()
        this.connectSocket()
        this.periodic = setInterval(() => void this.syncNow(), PERIODIC_SYNC_MS)
    }

    stop(): void {
        this.running = false
        if (this.periodic != null) {
            clearInterval(this.periodic)
            this.periodic = null
        }
        if (this.accountTimer != null) {
            clearTimeout(this.accountTimer)
            this.accountTimer = null
        }
        this.unwatchAccounts?.()
        this.unwatchAccounts = null
        this.socket?.disconnect()
        this.socket = null
    }

    /** The server deleted the backup: stop syncing and wipe all on-device backup
     *  state (config, sync state, and keys) so it returns to "not set up". No
     *  remote call is made — the backup is already gone server-side. */
    private async clearLocalBackup(): Promise<void> {
        this.stop()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        try {
            await deleteBackupKeys()
        } catch (error) {
            logger.warn('BackupSyncManager: failed to delete backup keys', {
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async syncNow(): Promise<void> {
        if (this.syncInProgress) return
        const ctx = this.context()
        if (!ctx) {
            logger.warn('BackupSyncManager: sync skipped, no backup context')
            return
        }
        this.syncInProgress = true
        this.deps.onStateChange?.()
        try {
            const state =
                useBackupSyncStateStore.getState().syncState ??
                createEmptySyncState(ctx.backupId)
            const next = await this.withEngineDeps(ctx, deps =>
                syncBackup(deps, state),
            )
            if (next) {
                useBackupSyncStateStore.getState().setSyncState(next)
            } else {
                logger.warn(
                    'BackupSyncManager: sync produced no state, encryption key unavailable',
                )
            }
        } catch (error) {
            logger.warn('BackupSyncManager: sync failed', {
                error: error instanceof Error ? error.message : String(error),
            })
            // Seed an empty state when the first-ever sync is the one that
            // failed, so the overview reports FAILED instead of falling back
            // to the never-synced badge.
            const s =
                useBackupSyncStateStore.getState().syncState ??
                createEmptySyncState(ctx.backupId)
            useBackupSyncStateStore
                .getState()
                .setSyncState({ ...s, lastSyncResult: 'FAILED' })
        } finally {
            this.syncInProgress = false
            this.deps.onStateChange?.()
        }
    }

    private async runPull(): Promise<void> {
        if (this.syncInProgress) return
        const ctx = this.context()
        if (!ctx) return
        this.syncInProgress = true
        try {
            const state =
                useBackupSyncStateStore.getState().syncState ??
                createEmptySyncState(ctx.backupId)
            const next = await this.withEngineDeps(ctx, deps =>
                pullBackupDeltas(deps, state),
            )
            if (next) useBackupSyncStateStore.getState().setSyncState(next)
        } catch (error) {
            logger.warn('BackupSyncManager: pull failed', {
                error: error instanceof Error ? error.message : String(error),
            })
        } finally {
            this.syncInProgress = false
        }
    }

    private connectSocket(): void {
        const ctx = this.context()
        if (!ctx) return
        this.socket = new BackupWebSocketClient({
            baseUrl: config.backupBaseUrl,
            backupId: ctx.backupId,
            deviceId: ctx.deviceId,
            timestamp: () => new Date().toISOString(),
            withAuthSecretKey: withBackupAuthSecretKey,
            buildToken: buildBackupWebSocketToken,
            socketFactory: this.deps.socketFactory,
            onEvent: event => void this.handleSocketEvent(event),
        })
        void this.socket.connect()
    }

    async handleSocketEvent(event: BackupWebSocketEvent): Promise<void> {
        switch (event.kind) {
            case 'itemsUpdated': {
                await this.runPull()
                break
            }
            case 'backupDeleted': {
                await this.clearLocalBackup()
                this.deps.onBackupDeleted?.()
                break
            }
            default: {
                break
            }
        }
    }
}

let instance: Nullable<BackupSyncManager> = null

export const initializeBackupSyncManager = (
    deps: BackupSyncManagerDeps,
): BackupSyncManager => {
    instance?.stop()
    instance = new BackupSyncManager(deps)
    return instance
}

export const getBackupSyncManager = (): BackupSyncManager => {
    if (instance === null) {
        throw new Error(
            'BackupSyncManager not initialized. Call initializeBackupSyncManager() first.',
        )
    }
    return instance
}
