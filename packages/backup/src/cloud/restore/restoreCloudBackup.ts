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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    AppError,
    ErrorCategory,
    isPeraNetworkError,
    logger,
    toError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    deleteBackupKeys,
    persistBackupKeys,
    withBackupEncryptionKey,
} from '../credentials/keyStorage'
import {
    BackupAccountType,
    createEmptySyncState,
    hdPositionOf,
    isAccountRecordKey,
    isLegacyItemKey,
    trackedItemsFromManifest,
} from '../models'
import type {
    Argon2idConfig,
    BackupId,
    BackupItemKey,
    DeviceId,
    SyncItemState,
    SyncState,
} from '../models'
import type {
    ContactImportFn,
    ContactImportSummary,
    ImportSummary,
    PasskeyImportFn,
    PulledContact,
    PulledPasskey,
    SettingsImportFn,
    SyncImportFn,
} from '../sync/types'
import { readableBackupChains } from '../sync/backupChains'
import { recordImportResults } from '../sync/importRetry'
import { holdAccountsInBackup } from '../sync/reviewActions'
import { mergeRemoteSettings } from '../sync/settingsDocument'
import type { BackupKeys } from '../crypto/deriveBackupKeys'
import {
    collectBackupItems,
    fetchBackupItems,
    previewBackupAccounts,
} from './pullBackupItems'
import type {
    BackupAccountOption,
    FetchedBackup,
    PulledAccount,
    PulledSettings,
    PullBackupItemsResult,
} from './pullBackupItems'

/** What a failure means to the restore flow. Deliberately not the shared
 *  `errors.api.*` mapping: "no backup for this phrase" is not "not found". */
export type RestoreErrorCategory =
    | 'NOT_FOUND'
    | 'INVALID_CREDENTIALS'
    | 'UNKNOWN'

export class CloudBackupRestoreError extends AppError {
    readonly category: RestoreErrorCategory

    constructor(category: RestoreErrorCategory, cause?: unknown) {
        super(
            `Cloud backup restore failed: ${category}`,
            { category: ErrorCategory.STORAGE },
            cause instanceof Error ? cause : undefined,
        )
        // AppError can't forward { cause } to Error, and serializeError follows only cause.
        this.cause = cause
        this.name = 'CloudBackupRestoreError'
        this.category = category
    }
}

export type RestoreProgress =
    | { phase: 'unlocking' }
    | { phase: 'downloading' }
    // Counts backup entries, not wallet accounts: one recovery phrase can add several.
    | { phase: 'importing'; done: number; total: number }
    | { phase: 'finishing' }

type PrepareCloudBackupRestoreParams = {
    mnemonic: string[]
    /** Base64 salt the UI calls the "encryption key". */
    salt: string
    /** Defaults to this build's `ARGON2ID_CONFIG`. A sync QR carries the
     *  parameters its backup was created under, so that path passes them. */
    argon2id?: Argon2idConfig
    deviceId: DeviceId
    onProgress?: (progress: RestoreProgress) => void
}

/** A backup unlocked and downloaded, with nothing written to the wallet yet. */
export type PreparedCloudBackupRestore = {
    backupId: BackupId
    /** The pull ran under this id, and the backup must stay registered to it. */
    deviceId: DeviceId
    accounts: BackupAccountOption[]
    fetched: FetchedBackup
}

/** `'all'` also restores a seed whose accounts were all removed, which no
 *  option names. Otherwise the `group`s of the accounts to restore. */
export type RestoreAccountSelection = 'all' | ReadonlySet<string>

type CompleteCloudBackupRestoreParams = {
    prepared: PreparedCloudBackupRestore
    selection: RestoreAccountSelection
    /** An account left unchosen but already on this device is not held: it
     *  syncs from here like any account the device holds. */
    isOnDevice?: (address: string) => boolean
    /** Decrypted remote accounts → wallet. Hook-bound (needs KMS), so the app
     *  layer injects it. */
    importAccounts: SyncImportFn
    /** Decrypted remote contacts → contacts store. */
    importContacts: ContactImportFn
    /** Re-derives and writes each credential. Runs after `importAccounts`,
     *  which is what puts the owning seed in the keystore. */
    importPasskeys: PasskeyImportFn
    /** Runs last, so a pinned launch account is already in the wallet. */
    importSettings: SettingsImportFn
    onProgress?: (progress: RestoreProgress) => void
}

type RestoreCloudBackupParams = PrepareCloudBackupRestoreParams &
    Omit<
        CompleteCloudBackupRestoreParams,
        'prepared' | 'selection' | 'isOnDevice'
    >

export type RestoreCloudBackupResult = {
    backupId: BackupId
    /** Seeded from the pull's manifest, so the first background sync resumes at
     *  `lastSeq` and pushes at the versions the server actually holds. */
    syncState: SyncState
    summary: ImportSummary
    contactSummary: ContactImportSummary
    /** Accounts with at least one chain that failed to restore. `summary`
     *  counts failures per chain address, which overstates an account that
     *  restored without one of its chains. */
    incompleteAccountCount: number
    /** Accounts only a newer version of the app can restore. They stay in the
     *  backup, untouched, for that version. */
    newerAccountCount: number
}

/** Reads the category off a rejection from {@link restoreCloudBackup}. */
export const restoreErrorCategoryOf = (error: unknown): RestoreErrorCategory =>
    error instanceof CloudBackupRestoreError ? error.category : 'UNKNOWN'

const categorize = (error: unknown): RestoreErrorCategory => {
    if (error instanceof CloudBackupRestoreError) return error.category
    if (!isPeraNetworkError(error)) return 'UNKNOWN'
    if (error.status === 404) return 'NOT_FOUND'
    if (error.status === 401 || error.status === 403) {
        return 'INVALID_CREDENTIALS'
    }
    return 'UNKNOWN'
}

const logFailure = (error: unknown, category: RestoreErrorCategory): void => {
    logger.error(error instanceof Error ? error : String(error), {
        scope: 'restoreCloudBackup',
        category,
    })
}

/** Don't leave half-configured keys (incl. the persisted phrase) behind. */
const cleanUpAfterRestoreFailure = async (): Promise<void> => {
    try {
        await deleteBackupKeys()
    } catch (cleanupError) {
        logger.error(
            'restoreCloudBackup: failed to clean up keys after restore error',
            {
                error: toError(cleanupError).message,
            },
        )
    }
}

/** Never let the contacts half sink a restore whose accounts already landed:
 *  the keys are committed by this point, so a throw here would roll them back
 *  and leave the wallet with neither. */
const importContactsSafely = async (
    importContacts: ContactImportFn,
    contacts: PulledContact[],
): Promise<ContactImportSummary> => {
    try {
        return await importContacts(contacts)
    } catch (error) {
        logger.warn('restoreCloudBackup: contact import failed', {
            error: toError(error).message,
        })
        return { imported: 0, failed: [] }
    }
}

/** The manifest knows only keys, and a key is an HMAC, so the pull is the only
 *  place these identifiers exist. An item the pull could not read is left
 *  without them, which reads as unknown, never as "not ours". */
const trackedItemsFromPull = (
    pull: PullBackupItemsResult,
): Record<BackupItemKey, SyncItemState> => {
    const items = trackedItemsFromManifest(pull.manifestItems)
    for (const [key, identifiers] of Object.entries(pull.trackedByKey)) {
        const tracked = items[key]
        if (tracked !== undefined) items[key] = { ...tracked, ...identifiers }
    }
    return items
}

/** A credential that cannot be written must never fail the restore: accounts
 *  and contacts are already in place by the time this runs. */
const importPasskeysSafely = async (
    importPasskeys: PasskeyImportFn,
    passkeys: PulledPasskey[],
): Promise<void> => {
    if (passkeys.length === 0) return
    try {
        const summary = await importPasskeys(passkeys)
        if (summary.skipped.length > 0 || summary.failed.length > 0) {
            logger.warn('restoreCloudBackup: some passkeys were not written', {
                skipped: summary.skipped.length,
                failed: summary.failed.length,
            })
        }
    } catch (error) {
        logger.warn('restoreCloudBackup: passkey import failed', {
            error: toError(error).message,
        })
    }
}

/** Joining a backup adopts its settings outright: this device's values are
 *  either defaults or older than anything the backup has been told. */
const importSettingsSafely = (
    importSettings: SettingsImportFn,
    settings: Nullable<PulledSettings>,
): void => {
    if (settings === null) return
    try {
        importSettings(mergeRemoteSettings(undefined, settings.payload).toApply)
    } catch (error) {
        logger.warn('restoreCloudBackup: settings import failed', {
            error: toError(error).message,
        })
    }
}

const incompleteAccounts = (
    accounts: readonly PulledAccount[],
    { failed }: ImportSummary,
): number => {
    const groupOf = new Map(
        accounts.map(({ address, group }) => [address, group]),
    )
    return new Set(failed.map(({ address }) => groupOf.get(address) ?? address))
        .size
}

/** Every field starts unobserved, so the first sync records what the import
 *  wrote as this device's baseline rather than as an edit to push. */
const withPulledSettings = (
    items: Record<BackupItemKey, SyncItemState>,
    settings: Nullable<PulledSettings>,
): Record<BackupItemKey, SyncItemState> => {
    const tracked = settings ? items[settings.key] : undefined
    if (!settings || !tracked) return items
    return {
        ...items,
        [settings.key]: {
            ...tracked,
            settingsFields: mergeRemoteSettings(undefined, settings.payload)
                .doc,
        },
    }
}

const partition = <T>(
    items: readonly T[],
    isKept: (item: T) => boolean,
): [T[], T[]] => [items.filter(isKept), items.filter(item => !isKept(item))]

/** The manifest leaves every item unread, so marking a failed import is all
 *  it takes for the first syncs to retry it. */
const syncStateFromPull = (
    backupId: BackupId,
    pull: PullBackupItemsResult,
    imported: readonly PulledAccount[],
    failed: ImportSummary['failed'],
    isOnDevice: (address: string) => boolean,
): SyncState => {
    const items = trackedItemsFromPull(pull)
    recordImportResults(items, Object.keys(items), failed)
    const restored = new Set(imported)
    const [kept, held] = partition(
        pull.accounts,
        account => restored.has(account) || isOnDevice(account.address),
    )
    return holdAccountsInBackup(
        {
            ...createEmptySyncState(backupId),
            lastKnownBackupHash: pull.backupGlobalHash,
            lastSyncedSeq: pull.lastSeq,
            lastSyncedAt: Date.now(),
            lastSyncResult: 'SUCCESS',
            // What this restore could read, so the first sync doesn't re-read
            // the items it just skipped as unreadable.
            readableChains: readableBackupChains(),
            items: withPulledSettings(items, pull.settings),
        },
        held.map(({ address }) => address),
        kept.map(({ address }) => address),
    )
}

const deriveKeys = async (
    mnemonic: string[],
    salt: string,
    argon2id?: Argon2idConfig,
): Promise<BackupKeys> => {
    // Lazy import keeps tweetnacl/@noble/argon2 out of the startup module graph.
    const { deriveBackupKeys } = await import('../crypto')

    try {
        return await deriveBackupKeys({ mnemonic, salt, argon2id })
    } catch (error) {
        // The phrase and the salt are the only inputs, and a truncated paste of
        // the salt throws out of `decodeFromBase64` — so a derive failure here
        // is always a bad credential, never a transport problem.
        logFailure(error, 'INVALID_CREDENTIALS')
        throw new CloudBackupRestoreError('INVALID_CREDENTIALS', error)
    }
}

const failWith = async (error: unknown): Promise<never> => {
    const category = categorize(error)
    logFailure(error, category)
    await cleanUpAfterRestoreFailure()
    throw new CloudBackupRestoreError(category, error)
}

/**
 * Unlocks and downloads the backup, and decrypts only what the user needs to
 * choose accounts. The keys are stored, since every signed request reads them
 * back, but the backup is not configured, so nothing syncs until
 * {@link completeCloudBackupRestore}; {@link discardPreparedCloudBackupRestore}
 * removes them. Rejects with a {@link CloudBackupRestoreError}.
 */
export const prepareCloudBackupRestore = async ({
    mnemonic,
    salt,
    argon2id,
    deviceId,
    onProgress,
}: PrepareCloudBackupRestoreParams): Promise<PreparedCloudBackupRestore> => {
    onProgress?.({ phase: 'unlocking' })
    const { backupId, encryptionKey, authSecretKey, itemKey } =
        await deriveKeys(mnemonic, salt, argon2id)

    try {
        onProgress?.({ phase: 'downloading' })
        await persistBackupKeys({
            encryptionKey,
            authSecretKey,
            itemKey,
            mnemonic,
        })

        const fetched = await fetchBackupItems({ backupId, deviceId })

        /* A legacy backup's secrets payloads lack the `address` field and no
         * longer parse, while its address records still do: importing would
         * leave watch-only copies of the accounts the user just restored. */
        const legacyKeyCount = Object.keys(fetched.manifestItems).filter(
            isLegacyItemKey,
        ).length
        if (legacyKeyCount > 0) {
            logger.warn(
                'restoreCloudBackup: backup uses legacy address keys, refusing to restore',
                { legacyKeyCount },
            )
            throw new CloudBackupRestoreError('UNKNOWN')
        }

        return {
            backupId,
            deviceId,
            accounts: previewBackupAccounts(fetched, {
                backupId,
                encryptionKey,
            }),
            fetched,
        }
    } catch (error) {
        return failWith(error)
    } finally {
        zeroBytes(encryptionKey)
        zeroBytes(authSecretKey)
        zeroBytes(itemKey)
    }
}

/** The user backed out before choosing: the device must not stay joined. */
export const discardPreparedCloudBackupRestore = (): Promise<void> =>
    cleanUpAfterRestoreFailure()

const decryptPrepared = async ({
    backupId,
    fetched,
}: PreparedCloudBackupRestore): Promise<PullBackupItemsResult> => {
    const pull = await withBackupEncryptionKey(encryptionKey =>
        collectBackupItems(fetched, { backupId, encryptionKey }),
    )
    if (pull === null) {
        throw new CloudBackupRestoreError(
            'UNKNOWN',
            new Error('Backup encryption key is missing'),
        )
    }
    return pull
}

/** A seed's secret rides on the entry filed under the seed's first address,
 *  which the user may have left out. The chosen accounts still need it, so it
 *  goes in on its own, which restores the seed and creates no account. */
const withTheirSeeds = (
    chosen: PulledAccount[],
    all: readonly PulledAccount[],
): PulledAccount[] => {
    const carried = new Set(
        chosen.flatMap(({ secretsPayload }) =>
            secretsPayload?.type === BackupAccountType.hdSeed
                ? [secretsPayload.address]
                : [],
        ),
    )
    const needed = new Set(
        chosen.flatMap(({ addressPayload }) => {
            const position = hdPositionOf(addressPayload)
            return position ? [position.seedReference] : []
        }),
    )
    const seeds = new Map<string, PulledAccount>()
    for (const { secretsPayload } of all) {
        if (
            secretsPayload?.type !== BackupAccountType.hdSeed ||
            !needed.has(secretsPayload.address) ||
            carried.has(secretsPayload.address)
        )
            continue
        const { address } = secretsPayload
        seeds.set(address, {
            address,
            group: address,
            addressPayload: { type: BackupAccountType.hdSeed, address },
            secretsPayload,
        })
    }
    return [...chosen, ...seeds.values()]
}

/**
 * Imports the chosen accounts, then contacts, passkeys and settings, and
 * holds every other account in the backup for the user to add later. Rejects
 * with a {@link CloudBackupRestoreError}, having removed the stored keys.
 */
export const completeCloudBackupRestore = async ({
    prepared,
    selection,
    importAccounts,
    importContacts,
    importPasskeys,
    importSettings,
    isOnDevice = () => false,
    onProgress,
}: CompleteCloudBackupRestoreParams): Promise<RestoreCloudBackupResult> => {
    try {
        const pull = await decryptPrepared(prepared)
        const accounts =
            selection === 'all'
                ? pull.accounts
                : pull.accounts.filter(({ group }) => selection.has(group))

        const summary = await importAccounts(
            selection === 'all'
                ? accounts
                : withTheirSeeds(accounts, pull.accounts),
            (done, total) => onProgress?.({ phase: 'importing', done, total }),
        )
        onProgress?.({ phase: 'finishing' })
        const contactSummary = await importContactsSafely(
            importContacts,
            pull.contacts,
        )
        await importPasskeysSafely(importPasskeys, pull.passkeys)
        importSettingsSafely(importSettings, pull.settings)

        return {
            backupId: prepared.backupId,
            syncState: syncStateFromPull(
                prepared.backupId,
                pull,
                accounts,
                summary.failed,
                isOnDevice,
            ),
            summary,
            contactSummary,
            incompleteAccountCount: incompleteAccounts(accounts, summary),
            newerAccountCount: pull.skipped.filter(
                ({ key, reason }) =>
                    reason === 'newer' && isAccountRecordKey(key),
            ).length,
        }
    } catch (error) {
        return failWith(error)
    }
}

/** Restores every account, with no choice offered. Rejects with a
 *  {@link CloudBackupRestoreError}. */
export const restoreCloudBackup = async ({
    mnemonic,
    salt,
    argon2id,
    deviceId,
    onProgress,
    ...imports
}: RestoreCloudBackupParams): Promise<RestoreCloudBackupResult> =>
    completeCloudBackupRestore({
        prepared: await prepareCloudBackupRestore({
            mnemonic,
            salt,
            argon2id,
            deviceId,
            onProgress,
        }),
        selection: 'all',
        onProgress,
        ...imports,
    })
