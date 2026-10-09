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
import { isPeraNetworkError, logger } from '@perawallet/wallet-core-shared'
import type { Network } from '@perawallet/wallet-core-shared'
import { deleteBackupKeys, persistBackupKeys } from '../credentials/keyStorage'
import {
    createEmptySyncState,
    isAccountItemKey,
    isContactItemKey,
    isLegacyItemKey,
    trackedItemsFromManifest,
} from '../models'
import type {
    Argon2idConfig,
    BackupItemKind,
    BackupId,
    BackupItemKey,
    ContactBackupPayload,
    DeviceId,
    SyncItemState,
    SyncState,
} from '../models'
import type {
    ContactImportFn,
    ContactImportSummary,
    ImportSummary,
    PasskeyImportFn,
    PulledPasskey,
    SettingsImportFn,
    SyncImportFn,
} from '../sync/types'
import { mergeRemoteSettings } from '../sync/settingsDocument'
import type { BackupKeys } from '../crypto/deriveBackupKeys'
import { pullBackupItems } from './pullBackupItems'
import type {
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

export class CloudBackupRestoreError extends Error {
    readonly category: RestoreErrorCategory

    constructor(category: RestoreErrorCategory, cause?: unknown) {
        super(`Cloud backup restore failed: ${category}`, { cause })
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

type RestoreCloudBackupParams = {
    mnemonic: string[]
    /** Base64 salt the UI calls the "encryption key". */
    salt: string
    /** Defaults to this build's `ARGON2ID_CONFIG`. A sync QR carries the
     *  parameters its backup was created under, so that path passes them. */
    argon2id?: Argon2idConfig
    deviceId: DeviceId
    network: Network
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

export type RestoreCloudBackupResult = {
    backupId: BackupId
    /** Seeded from the pull's manifest, so the first background sync resumes at
     *  `lastSeq` and pushes at the versions the server actually holds. */
    syncState: SyncState
    summary: ImportSummary
    contactSummary: ContactImportSummary
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
                error:
                    cleanupError instanceof Error
                        ? cleanupError.message
                        : String(cleanupError),
            },
        )
    }
}

/** Never let the contacts half sink a restore whose accounts already landed:
 *  the keys are committed by this point, so a throw here would roll them back
 *  and leave the wallet with neither. */
const importContactsSafely = async (
    importContacts: ContactImportFn,
    contacts: ContactBackupPayload[],
): Promise<ContactImportSummary> => {
    try {
        return await importContacts(contacts)
    } catch (error) {
        logger.warn('restoreCloudBackup: contact import failed', {
            error: error instanceof Error ? error.message : String(error),
        })
        return { imported: 0, failed: [] }
    }
}

type PulledAccountKinds = {
    address: BackupItemKind
    secrets: BackupItemKind | null
}

const accountTypesByAddress = (
    accounts: PulledAccount[],
): Map<string, PulledAccountKinds> =>
    new Map(
        accounts.map(({ address, addressPayload, secretsPayload }) => [
            address,
            {
                address: addressPayload.type,
                secrets: secretsPayload?.type ?? null,
            },
        ]),
    )

const accountTypeOf = (
    key: BackupItemKey,
    address: string,
    types: Map<string, PulledAccountKinds>,
): BackupItemKind | null => {
    if (isContactItemKey(key)) return null
    const pulled = types.get(address)
    if (pulled === undefined) return null
    // An address record and the key material filed under the same address are
    // not the same type: an HD account's secret is the seed.
    return isAccountItemKey(key) ? pulled.address : pulled.secrets
}

/** The manifest knows only keys, and a key is an HMAC of the address, so the
 *  pull is the only place these addresses exist. An item the pull could not
 *  read is left without one, which reads as unknown, never as "not ours". */
const trackedItemsFromPull = (
    pull: PullBackupItemsResult,
): Record<BackupItemKey, SyncItemState> => {
    const items = trackedItemsFromManifest(pull.manifestItems)
    const types = accountTypesByAddress(pull.accounts)

    for (const [key, address] of Object.entries(pull.addressByKey)) {
        const tracked = items[key]
        if (tracked === undefined) continue
        items[key] = {
            ...tracked,
            address,
            accountType: accountTypeOf(key, address, types),
        }
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
            error: error instanceof Error ? error.message : String(error),
        })
    }
}

/** Joining a backup adopts its settings outright: this device's values are
 *  either defaults or older than anything the backup has been told. */
const importSettingsSafely = (
    importSettings: SettingsImportFn,
    settings: PulledSettings | null,
): void => {
    if (settings === null) return
    try {
        importSettings(mergeRemoteSettings(undefined, settings.payload).toApply)
    } catch (error) {
        logger.warn('restoreCloudBackup: settings import failed', {
            error: error instanceof Error ? error.message : String(error),
        })
    }
}

/** Every field starts unobserved, so the first sync records what the import
 *  wrote as this device's baseline rather than as an edit to push. */
const withPulledSettings = (
    items: Record<BackupItemKey, SyncItemState>,
    settings: PulledSettings | null,
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

const syncStateFromPull = (
    backupId: BackupId,
    pull: PullBackupItemsResult,
): SyncState => ({
    ...createEmptySyncState(backupId),
    lastKnownBackupHash: pull.backupGlobalHash,
    lastSyncedSeq: pull.lastSeq,
    lastSyncedAt: Date.now(),
    lastSyncResult: 'SUCCESS',
    items: withPulledSettings(trackedItemsFromPull(pull), pull.settings),
})

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

/**
 * Rejects with a {@link CloudBackupRestoreError} for every failure, so the
 * caller reads one category rather than shape-matching the underlying error.
 */
export const restoreCloudBackup = async ({
    mnemonic,
    salt,
    argon2id,
    deviceId,
    network,
    importAccounts,
    importContacts,
    importPasskeys,
    importSettings,
    onProgress,
}: RestoreCloudBackupParams): Promise<RestoreCloudBackupResult> => {
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

        const pull = await pullBackupItems({
            network,
            backupId,
            deviceId,
            encryptionKey,
        })

        /* A legacy backup's secrets payloads lack the `address` field and no
         * longer parse, while its address records still do: importing would
         * leave watch-only copies of the accounts the user just restored. */
        const legacyKeyCount = Object.keys(pull.manifestItems).filter(
            isLegacyItemKey,
        ).length
        if (legacyKeyCount > 0) {
            logger.warn(
                'restoreCloudBackup: backup uses legacy address keys, refusing to restore',
                { legacyKeyCount },
            )
            throw new CloudBackupRestoreError('UNKNOWN')
        }

        const summary = await importAccounts(pull.accounts, (done, total) =>
            onProgress?.({ phase: 'importing', done, total }),
        )
        onProgress?.({ phase: 'finishing' })
        const contactSummary = await importContactsSafely(
            importContacts,
            pull.contacts,
        )
        await importPasskeysSafely(importPasskeys, pull.passkeys)
        importSettingsSafely(importSettings, pull.settings)

        return {
            backupId,
            syncState: syncStateFromPull(backupId, pull),
            summary,
            contactSummary,
        }
    } catch (error) {
        const category = categorize(error)
        logFailure(error, category)
        await cleanUpAfterRestoreFailure()
        throw new CloudBackupRestoreError(category, error)
    } finally {
        zeroBytes(encryptionKey)
        zeroBytes(authSecretKey)
        zeroBytes(itemKey)
    }
}
