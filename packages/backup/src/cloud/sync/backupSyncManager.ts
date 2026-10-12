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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import {
    withBackupAuthSecretKey,
    withBackupEncryptionKey,
    withBackupItemKey,
    hasBackupCredentials,
    deleteBackupKeys,
} from '../credentials/keyStorage'
import {
    areKeysDeletedFromBackup,
    createEmptySyncState,
    isAddressBackedUp,
    isContactBackedUp,
    isPasskeyBackedUp,
    type BackupItemKey,
    type SyncState,
} from '../models'
import { buildBackupWebSocketToken } from '../crypto/buildBackupWebSocketToken'
import { withItemKeyHasher } from '../crypto/itemKeyHash'
import {
    deleteContactFromBackup,
    deleteFromBackup,
    deletePasskeyFromBackup,
    importContactFromBackup,
    importFromBackup,
    importPasskeyFromBackup,
    keepAccountInBackup,
    keepContactInBackup,
    keepPasskeyInBackup,
    markAccountForBackup,
    markContactForBackup,
    markPasskeyForBackup,
    reviewActionDeps,
    type BackupDeleteResult,
} from './reviewActions'
import { accountFingerprint } from './accountFingerprint'
import { contactsFingerprint } from './contactsFingerprint'
import { canonicalJson } from './canonicalize'
import { syncBackup } from './syncBackup'
import { pullBackupDeltas } from './pullBackupDeltas'
import { serializeAccountForBackup } from './serializeAccountForBackup'
import { createBackupSyncStatePort } from './backupSyncStatePort'
import { backupBusyItemKey, type BackupReviewItemKind } from './busyItems'
import {
    BackupWebSocketClient,
    type BackupSocketFactory,
    type BackupWebSocketEvent,
} from './webSocketClient'
import { BackupPushIncompleteError, BackupSyncAbortedError } from './types'
import type {
    BackupActionOutcome,
    BackupBackUpOutcome,
    BackupSyncSources,
    BackupSyncStatePort,
    ContactImportFn,
    ContactImportSummary,
    ImportSummary,
    PasskeyImportSummary,
    SyncEngineDeps,
    SerializeHdResolver,
    SerializeMnemonicResolver,
} from './types'

const PERIODIC_SYNC_MS = 5 * 60 * 1000
const LOCAL_CHANGE_DEBOUNCE_MS = 2000

export type BackupSyncManagerDeps = {
    /** The chain whose account entries the backup carries; its items record none. */
    chainId: ChainId
    importAccounts: SyncEngineDeps['importAccounts']
    importContacts: ContactImportFn
    /** Hook-bound 25-word phrase resolver, injected from RootComponent. */
    resolveMnemonic: SerializeMnemonicResolver
    /** Hook-bound HD seed/derived resolver, injected from RootComponent. */
    resolveHd: SerializeHdResolver
    /** App-lock state from the app layer; nothing syncs or pulls while it holds. */
    isLocked: () => boolean
    listPasskeys: SyncEngineDeps['listPasskeys']
    importPasskeys: SyncEngineDeps['importPasskeys']
    /** Fires on any keystore write that could touch a passkey; the manager
     *  doesn't distinguish a passkey change from a false alarm here — the
     *  caller does that cheaply, since deciding here would mean deriving
     *  first via `listPasskeys`, which is the expensive part. */
    subscribePasskeyChanges: (onChange: () => void) => () => void
    socketFactory?: BackupSocketFactory
    /** Called after the server deletes the backup and local state is wiped, so
     *  the app can inform the user. */
    onBackupDeleted?: () => void
    /** Accounts, contacts and network; `createBackupSyncStoreSources()` in the app. */
    sources: BackupSyncSources
    /** Defaults to the backup package's own stores; overridable for tests. */
    state?: BackupSyncStatePort
}

export class BackupSyncManager {
    private running = false
    private inFlight: Nullable<Promise<unknown>> = null
    private isPullQueued = false
    private isSyncQueued = false
    private readonly pendingActions = new Map<
        string,
        { itemKey: string; promise: Promise<unknown> }
    >()
    private periodic: Nullable<ReturnType<typeof setInterval>> = null
    private socket: Nullable<BackupWebSocketClient> = null
    private unwatchAccounts: Nullable<() => void> = null
    private unwatchContacts: Nullable<() => void> = null
    private unwatchPasskeys: Nullable<() => void> = null
    private unwatchSettings: Nullable<() => void> = null
    private localChangeTimer: Nullable<ReturnType<typeof setTimeout>> = null
    private stopEpoch = 0
    /** Edits made while a run was in flight. That run read the state before
     *  them and commits its own, so they are applied again on top of it. */
    private pendingLocalEdits: ((state: SyncState) => SyncState)[] = []
    private accountsFingerprint = ''
    private contactsFingerprint = ''
    private settingsFingerprint = ''
    private readonly state: BackupSyncStatePort

    constructor(private readonly deps: BackupSyncManagerDeps) {
        this.state = deps.state ?? createBackupSyncStatePort()
    }

    isSyncing(): boolean {
        return this.inFlight !== null
    }

    private hold<T>(work: () => Promise<T>): Promise<T> {
        this.state.setIsSyncing(true)
        const run = (async () => {
            try {
                return await work()
            } finally {
                this.inFlight = null
                this.pendingLocalEdits = []
                this.state.setIsSyncing(false)
                this.runQueued()
            }
        })()
        this.inFlight = run
        return run
    }

    private commitSyncState(next: SyncState): void {
        const edits = this.pendingLocalEdits
        this.pendingLocalEdits = []
        this.state.setSyncState(
            edits.reduce((state, edit) => edit(state), next),
        )
    }

    /** Lands now rather than waiting out a long sync, which made a removal
     *  look like it did nothing; re-applied over whatever that sync commits. */
    private applyLocalEdit(edit: (state: SyncState) => SyncState): boolean {
        if (this.deps.isLocked()) return false
        const ctx = this.context()
        if (!ctx) return false
        this.state.setSyncState(
            edit(
                this.state.getSyncState() ?? createEmptySyncState(ctx.backupId),
            ),
        )
        if (this.inFlight) this.pendingLocalEdits.push(edit)
        return true
    }

    /** A full sync pulls too, so it supersedes a queued pull. */
    private runQueued(): void {
        if (!this.running) return
        if (this.isSyncQueued) {
            this.isSyncQueued = false
            this.isPullQueued = false
            void this.syncNow()
        } else if (this.isPullQueued) {
            this.isPullQueued = false
            void this.runPull()
        }
    }

    private async waitUntilIdle(): Promise<void> {
        while (this.inFlight) {
            await this.inFlight.catch(() => undefined)
        }
    }

    /** The checks and the claim share one continuation, or every waiter sees the
     *  same free slot. Null when a stop or the app lock landed while waiting:
     *  a queued action must not outlive the one or read keys under the other. */
    private async holdWhenIdle<T>(
        work: () => Promise<T>,
    ): Promise<Nullable<T>> {
        const epoch = this.stopEpoch
        while (this.inFlight) {
            await this.inFlight.catch(() => undefined)
        }
        if (this.wasInterrupted(epoch)) return null
        return this.hold(work)
    }

    private wasInterrupted(epoch: number): boolean {
        return this.stopEpoch !== epoch || this.deps.isLocked()
    }

    private context(): Nullable<{
        network: Network
        backupId: string
        deviceId: string
    }> {
        const network = this.deps.sources.getNetwork()
        const backupId = this.state.getBackupId()
        const deviceId = this.state.getDeviceId(network)
        if (!backupId || !deviceId) return null
        return { network, backupId, deviceId }
    }

    private async withEngineDeps<T>(
        ctx: { network: Network; backupId: string; deviceId: string },
        run: (deps: SyncEngineDeps) => Promise<T>,
    ): Promise<Nullable<T>> {
        const epoch = this.stopEpoch
        // Nested, not sequenced: each scope zeroes its key material on exit,
        // and the hasher's copy of K_item outlives the keystore's buffer.
        return withBackupEncryptionKey(encryptionKey =>
            withBackupItemKey(itemKey =>
                withItemKeyHasher(itemKey, hashAddress =>
                    run({
                        network: ctx.network,
                        backupId: ctx.backupId,
                        deviceId: ctx.deviceId,
                        encryptionKey,
                        hashAddress,
                        isAborted: () =>
                            this.stopEpoch !== epoch || this.deps.isLocked(),
                        listAccounts: () => this.deps.sources.listAccounts(),
                        serializeAccount: account =>
                            serializeAccountForBackup(account, {
                                chainId: this.deps.chainId,
                                updatedAt: Date.now(),
                                hashAddress,
                                resolveMnemonic: this.deps.resolveMnemonic,
                                resolveHd: this.deps.resolveHd,
                            }),
                        importAccounts: this.deps.importAccounts,
                        listContacts: () => this.deps.sources.listContacts(),
                        importContacts: this.deps.importContacts,
                        listPasskeys: this.deps.listPasskeys,
                        importPasskeys: this.deps.importPasskeys,
                        getSettings: () => this.deps.sources.getSettings(),
                        importSettings: settings =>
                            this.deps.sources.importSettings(settings),
                    }),
                ),
            ),
        )
    }

    /** Publishes the item as busy until the action settles, and hands a
     *  repeat of the same action on the same item the run already queued. */
    private trackAction<T>(
        kind: BackupReviewItemKind,
        id: string,
        action: 'backUp' | 'add' | 'delete',
        run: () => Promise<T>,
    ): Promise<T> {
        const itemKey = backupBusyItemKey(kind, id)
        const actionKey = `${itemKey}|${action}`
        const pending = this.pendingActions.get(actionKey)
        if (pending) return pending.promise as Promise<T>
        const promise = run().finally(() => {
            this.pendingActions.delete(actionKey)
            this.publishBusyItems()
        })
        this.pendingActions.set(actionKey, { itemKey, promise })
        this.publishBusyItems()
        return promise
    }

    private publishBusyItems(): void {
        const items = new Set(
            [...this.pendingActions.values()].map(entry => entry.itemKey),
        )
        this.state.setBusyItems([...items])
    }

    /** Runs one exclusive mutation of the sync state, so a review action and a
     *  background sync can't both write the whole state and lose the other's
     *  edit. Waits out a running sync rather than refusing: a large backup's
     *  first sync can run for a while, and a tap during it is not a failure. */
    private async withExclusiveState(
        run: (state: SyncState, deps: SyncEngineDeps) => Promise<SyncState>,
    ): Promise<boolean> {
        const done = await this.holdWhenIdle(async () => {
            const ctx = this.context()
            if (!ctx) return false
            const state =
                this.state.getSyncState() ?? createEmptySyncState(ctx.backupId)
            const next = await this.withEngineDeps(ctx, deps =>
                run(state, deps),
            )
            if (!next) return false
            this.commitSyncState(next)
            return true
        })
        return done ?? false
    }

    /** A sync that timers or the socket started while this one staged would
     *  make `syncNow` return early, before the staged item is pushed. */
    private async syncWhenIdle(): Promise<void> {
        await this.holdWhenIdle(async () => {
            const ctx = this.context()
            if (ctx) await this.runSync(ctx)
        })
    }

    /** `syncNow` swallows transport failures, and a push the server rejects on
     *  version leaves knownVer at 0 inside a run that otherwise succeeded — so
     *  the state, not "it returned", says whether the account landed. */
    backUpAccount(address: string): Promise<BackupBackUpOutcome> {
        return this.trackAction('account', address, 'backUp', async () => {
            const epoch = this.stopEpoch
            const staged = await this.withExclusiveState(async state =>
                markAccountForBackup(state, address),
            )
            if (!staged) return 'refused'
            await this.syncWhenIdle()
            if (isAddressBackedUp(this.state.getSyncState(), address)) {
                return 'settled'
            }
            return this.wasInterrupted(epoch) ? 'deferred' : 'failed'
        })
    }

    addAccountFromBackup(address: string): Promise<ImportSummary | null> {
        return this.trackAction('account', address, 'add', async () => {
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
        })
    }

    /** A failed delete is a queued retry rather than a throw, so the state —
     *  not "it returned" — says the keys are gone, and only the delete knows
     *  which keys those were. */
    private async runDelete(
        run: (
            state: SyncState,
            deps: SyncEngineDeps,
        ) => Promise<BackupDeleteResult>,
    ): Promise<BackupActionOutcome> {
        let deleted: BackupItemKey[] = []
        const staged = await this.withExclusiveState(async (state, deps) => {
            const result = await run(state, deps)
            deleted = result.keys
            return result.state
        })
        if (!staged) return 'refused'
        return areKeysDeletedFromBackup(this.state.getSyncState(), deleted)
            ? 'settled'
            : 'queued'
    }

    deleteAccountFromBackup(address: string): Promise<BackupActionOutcome> {
        return this.trackAction('account', address, 'delete', () =>
            this.runDelete((state, deps) =>
                deleteFromBackup({
                    state,
                    address,
                    deps: reviewActionDeps(deps),
                }),
            ),
        )
    }

    /** Leaves the backup's copy in place, so the address returns to the review
     *  screen under "available from backup". */
    async keepAccountInBackup(address: string): Promise<boolean> {
        return this.applyLocalEdit(state => keepAccountInBackup(state, address))
    }

    backUpContact(address: string): Promise<BackupBackUpOutcome> {
        return this.trackAction('contact', address, 'backUp', async () => {
            const epoch = this.stopEpoch
            const staged = await this.withExclusiveState(async state =>
                markContactForBackup(state, address),
            )
            if (!staged) return 'refused'
            await this.syncWhenIdle()
            if (isContactBackedUp(this.state.getSyncState(), address)) {
                return 'settled'
            }
            return this.wasInterrupted(epoch) ? 'deferred' : 'failed'
        })
    }

    addContactFromBackup(
        address: string,
    ): Promise<ContactImportSummary | null> {
        return this.trackAction('contact', address, 'add', async () => {
            let summary: ContactImportSummary | null = null
            const done = await this.withExclusiveState(async (state, deps) => {
                const result = await importContactFromBackup({
                    state,
                    address,
                    deps: reviewActionDeps(deps),
                })
                summary = result.summary
                return result.state
            })
            return done ? summary : null
        })
    }

    deleteContactFromBackup(address: string): Promise<BackupActionOutcome> {
        return this.trackAction('contact', address, 'delete', () =>
            this.runDelete((state, deps) =>
                deleteContactFromBackup({
                    state,
                    address,
                    deps: reviewActionDeps(deps),
                }),
            ),
        )
    }

    /** Leaves the backup's copy in place, so the contact returns to the review
     *  screen under "available from backup". */
    async keepContactInBackup(address: string, name: string): Promise<boolean> {
        return this.applyLocalEdit(state =>
            keepContactInBackup(state, address, name),
        )
    }

    backUpPasskey(credentialId: string): Promise<BackupBackUpOutcome> {
        return this.trackAction('passkey', credentialId, 'backUp', async () => {
            const epoch = this.stopEpoch
            const staged = await this.withExclusiveState(async state =>
                markPasskeyForBackup(state, credentialId),
            )
            if (!staged) return 'refused'
            await this.syncWhenIdle()
            if (isPasskeyBackedUp(this.state.getSyncState(), credentialId)) {
                return 'settled'
            }
            return this.wasInterrupted(epoch) ? 'deferred' : 'failed'
        })
    }

    addPasskeyFromBackup(
        credentialId: string,
    ): Promise<PasskeyImportSummary | null> {
        return this.trackAction('passkey', credentialId, 'add', async () => {
            let summary: PasskeyImportSummary | null = null
            const done = await this.withExclusiveState(async (state, deps) => {
                const result = await importPasskeyFromBackup({
                    state,
                    credentialId,
                    deps: reviewActionDeps(deps),
                })
                summary = result.summary
                return result.state
            })
            return done ? summary : null
        })
    }

    deletePasskeyFromBackup(
        credentialId: string,
    ): Promise<BackupActionOutcome> {
        return this.trackAction('passkey', credentialId, 'delete', () =>
            this.runDelete((state, deps) =>
                deletePasskeyFromBackup({
                    state,
                    credentialId,
                    deps: reviewActionDeps(deps),
                }),
            ),
        )
    }

    /** Leaves the backup's copy in place, so the credential returns to the
     *  review screen under "available from backup". */
    async keepPasskeyInBackup(
        credentialId: string,
        label: string,
    ): Promise<boolean> {
        return this.applyLocalEdit(state =>
            keepPasskeyInBackup(state, credentialId, label),
        )
    }

    private watchLocalStores(): void {
        const { sources } = this.deps
        this.accountsFingerprint = accountFingerprint(sources.listAccounts())
        this.unwatchAccounts = sources.subscribeAccounts(accounts => {
            const next = accountFingerprint(accounts)
            if (next === this.accountsFingerprint) return
            this.accountsFingerprint = next
            this.scheduleLocalSync()
        })

        this.contactsFingerprint = contactsFingerprint(sources.listContacts())
        this.unwatchContacts = sources.subscribeContacts(contacts => {
            const next = contactsFingerprint(contacts)
            if (next === this.contactsFingerprint) return
            this.contactsFingerprint = next
            this.scheduleLocalSync()
        })

        // The settings stores also hold state that is not synced (theme,
        // preferences), so every write fires this; the fingerprint drops those.
        this.settingsFingerprint = canonicalJson(sources.getSettings())
        this.unwatchSettings = sources.subscribeSettings(() => {
            const next = canonicalJson(sources.getSettings())
            if (next === this.settingsFingerprint) return
            this.settingsFingerprint = next
            this.scheduleLocalSync()
        })

        // A credential minted by the OS provider extension is written outside
        // the JS process and fires nothing here; the periodic and foreground
        // syncs are what pick those up. The cheap filtering that keeps a
        // caller's unrelated keystore write from reaching this at all lives
        // with `subscribePasskeyChanges`'s injector, not here — this is
        // already told only about changes worth a sync.
        this.unwatchPasskeys = this.deps.subscribePasskeyChanges(() => {
            this.scheduleLocalSync()
        })
    }

    /** Debounced so a batch import lands as one sync. Re-arms rather than
     *  dropping when a sync is already running: syncBackup snapshots the
     *  accounts and contacts at its start, so an in-flight run cannot see this
     *  change. */
    private scheduleLocalSync(): void {
        if (this.localChangeTimer != null) clearTimeout(this.localChangeTimer)
        this.localChangeTimer = setTimeout(() => {
            this.localChangeTimer = null
            if (!this.running) return
            if (this.isSyncing()) {
                this.scheduleLocalSync()
                return
            }
            void this.syncNow()
        }, LOCAL_CHANGE_DEBOUNCE_MS)
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
        this.unwatchContacts?.()
        this.unwatchPasskeys?.()
        this.unwatchSettings?.()
        this.watchLocalStores()
        const epoch = this.stopEpoch
        // A run the preceding stop() cut off can still hold the slot; skipping
        // here would leave anything it staged for the periodic tick.
        if (this.isSyncing()) {
            this.isSyncQueued = true
        } else {
            await this.syncNow()
        }
        // Stale once a stop() lands during that await, even if a newer start()
        // followed: installing here too would leak a socket and an interval.
        if (this.stopEpoch !== epoch) return
        this.connectSocket()
        this.periodic = setInterval(() => {
            if (!this.running) return
            void this.syncNow()
        }, PERIODIC_SYNC_MS)
    }

    stop(): void {
        this.running = false
        this.stopEpoch += 1
        this.isPullQueued = false
        this.isSyncQueued = false
        if (this.periodic != null) {
            clearInterval(this.periodic)
            this.periodic = null
        }
        if (this.localChangeTimer != null) {
            clearTimeout(this.localChangeTimer)
            this.localChangeTimer = null
        }
        this.unwatchAccounts?.()
        this.unwatchAccounts = null
        this.unwatchContacts?.()
        this.unwatchContacts = null
        this.unwatchPasskeys?.()
        this.unwatchPasskeys = null
        this.unwatchSettings?.()
        this.unwatchSettings = null
        this.socket?.disconnect()
        this.socket = null
    }

    /** Stops and waits out the run under way, whose last request still holds
     *  the server's write lock. The resume restarts only a manager that was
     *  running and nothing has stopped since, so it never overrides the lifecycle. */
    async suspend(): Promise<() => Promise<void>> {
        const wasRunning = this.running
        this.stop()
        const epoch = this.stopEpoch
        await this.waitUntilIdle()
        return async () => {
            if (!wasRunning || this.running || this.stopEpoch !== epoch) return
            await this.start()
        }
    }

    /** The server deleted the backup: stop syncing and wipe all on-device backup
     *  state (config, sync state, and keys) so it returns to "not set up". No
     *  remote call is made — the backup is already gone server-side. */
    private async clearLocalBackup(): Promise<void> {
        this.stop()
        this.state.reset()
        try {
            await deleteBackupKeys()
        } catch (error) {
            logger.warn('BackupSyncManager: failed to delete backup keys', {
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async syncNow(): Promise<void> {
        if (this.isSyncing() || this.deps.isLocked()) return
        const ctx = this.context()
        if (!ctx) {
            logger.warn('BackupSyncManager: sync skipped, no backup context')
            return
        }
        await this.hold(() => this.runSync(ctx))
    }

    private async runSync(ctx: {
        network: Network
        backupId: string
        deviceId: string
    }): Promise<void> {
        try {
            const state =
                this.state.getSyncState() ?? createEmptySyncState(ctx.backupId)
            const next = await this.withEngineDeps(ctx, deps =>
                syncBackup(deps, state),
            )
            if (next) {
                this.commitSyncState(next)
            } else {
                logger.warn(
                    'BackupSyncManager: sync produced no state, encryption key unavailable',
                )
            }
        } catch (error) {
            // A stop mid-run is deliberate, not a failed sync.
            if (error instanceof BackupSyncAbortedError) return
            logger.warn('BackupSyncManager: sync failed', {
                error: error instanceof Error ? error.message : String(error),
            })
            // Seed an empty state when the first-ever sync is the one that
            // failed, so the overview reports FAILED instead of falling back
            // to the never-synced badge.
            const s =
                error instanceof BackupPushIncompleteError
                    ? error.state
                    : (this.state.getSyncState() ??
                      createEmptySyncState(ctx.backupId))
            this.commitSyncState({ ...s, lastSyncResult: 'FAILED' })
        }
    }

    private async runPull(): Promise<void> {
        if (this.deps.isLocked()) return
        // The running sync may have fetched its deltas before this change
        // landed; dropping the pull would leave it for the periodic tick.
        if (this.isSyncing()) {
            this.isPullQueued = true
            return
        }
        const ctx = this.context()
        if (!ctx) return
        await this.hold(async () => {
            try {
                const state =
                    this.state.getSyncState() ??
                    createEmptySyncState(ctx.backupId)
                const next = await this.withEngineDeps(ctx, deps =>
                    pullBackupDeltas(deps, state),
                )
                if (next) this.commitSyncState(next)
            } catch (error) {
                if (error instanceof BackupSyncAbortedError) return
                logger.warn('BackupSyncManager: pull failed', {
                    error:
                        error instanceof Error ? error.message : String(error),
                })
            }
        })
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
