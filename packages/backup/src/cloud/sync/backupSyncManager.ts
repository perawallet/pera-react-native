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
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { useCloudBackupStore, useBackupSyncStateStore } from '../store'
import {
    withBackupAuthSecretKey,
    withBackupEncryptionKey,
    hasBackupCredentials,
    deleteBackupKeys,
} from '../credentials/keyStorage'
import { createEmptySyncState } from '../models'
import { buildBackupWebSocketToken } from '../crypto/buildBackupWebSocketToken'
import { syncBackup } from './syncBackup'
import { pullBackupDeltas } from './pullBackupDeltas'
import { serializeAccountForBackup } from './serializeAccountForBackup'
import {
    BackupWebSocketClient,
    type BackupSocketFactory,
    type BackupWebSocketEvent,
} from './webSocketClient'
import type {
    SyncEngineDeps,
    SerializeHdResolver,
    SerializeMnemonicResolver,
} from './types'

const PERIODIC_SYNC_MS = 5 * 60 * 1000

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
        const backupId = useCloudBackupStore.getState().backupId
        const deviceId =
            useDeviceStore.getState().deviceIDs?.get(network) ?? null
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

    async start(): Promise<void> {
        if (this.running) return
        // No credentials = nothing to sync. This also covers the post-delete
        // state: a server-deleted backup wipes the on-device keys, so start()
        // becomes a no-op until the user sets up a fresh backup.
        if (!hasBackupCredentials()) return
        this.running = true
        // Defensive: never leak a prior interval/socket if start races a stop.
        if (this.periodic != null) clearInterval(this.periodic)
        this.socket?.disconnect()
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
        if (!ctx) return
        this.syncInProgress = true
        this.deps.onStateChange?.()
        try {
            const state =
                useBackupSyncStateStore.getState().syncState ??
                createEmptySyncState(ctx.backupId)
            const next = await this.withEngineDeps(ctx, deps =>
                syncBackup(deps, state),
            )
            if (next) useBackupSyncStateStore.getState().setSyncState(next)
        } catch (error) {
            logger.warn('BackupSyncManager: sync failed', {
                error: error instanceof Error ? error.message : String(error),
            })
            const s = useBackupSyncStateStore.getState().syncState
            if (s)
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
