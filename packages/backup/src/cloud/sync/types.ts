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
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type {
    LocalAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    AddressBackupPayload,
    BackupItemKind,
    BackupId,
    BackupItemKey,
    BackupItemType,
    BackupSettings,
    ContactBackupPayload,
    DeviceId,
    PasskeyBackupPayload,
    PasskeySecretsBackupPayload,
    SecretsBackupPayload,
    SyncState,
} from '../models'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import type { PulledAccount } from '../restore'

/** An account item of a chain kind the restoring chain's backup adapter
 *  doesn't define; the restore reports it as that item's failure. */
export class UnsupportedBackupAccountTypeError extends Error {
    constructor(
        public readonly type: string,
        public readonly chainId: ChainId,
    ) {
        super(
            `The ${chainId} backup adapter does not decode item type: ${type}`,
        )
        this.name = 'UnsupportedBackupAccountTypeError'
    }
}

export class BackupSyncAbortedError extends Error {
    constructor() {
        super('Backup sync aborted')
        this.name = 'BackupSyncAbortedError'
    }
}

/** A push failed part-way. `state` records what did land, so the next sync
 *  resends only the rest instead of conflicting on items the server already
 *  versioned. */
export class BackupPushIncompleteError extends Error {
    constructor(
        readonly state: SyncState,
        error: unknown,
    ) {
        super(
            `Backup push incomplete: ${error instanceof Error ? error.message : String(error)}`,
        )
        this.name = 'BackupPushIncompleteError'
    }
}

/**
 * How far a review action got:
 *
 * - `settled` — the server confirmed it.
 * - `queued` — recorded locally, the request failed, `pushDirty` will retry.
 * - `refused` — nothing was recorded, so the choice has to be made again.
 */
export type BackupActionOutcome = 'settled' | 'queued' | 'refused'

/**
 * How far a back-up got:
 *
 * - `settled` — the server holds it.
 * - `deferred` — staged, but a stop or lock cut the upload off; the stage is
 *   persisted, so the next sync sends it.
 * - `failed` — staged and the upload ran, but the server does not hold it.
 * - `refused` — nothing was staged.
 */
export type BackupBackUpOutcome = 'settled' | 'deferred' | 'failed' | 'refused'

/** A single backup item ready to hash/encrypt. `payload` is the parsed object. */
export type SerializedItem = {
    key: BackupItemKey
    type: BackupItemType
    payload:
        | AddressBackupPayload
        | SecretsBackupPayload
        | ContactBackupPayload
        | PasskeyBackupPayload
        | PasskeySecretsBackupPayload
}

/** A credential this device can back up: its private key was read from its
 *  own record, or re-derived from its seed. `identity`, `counter` and
 *  `seedAddress` are set only for the latter; `seedAddress` is the
 *  first-derived address of the owning seed, which is how the seed's
 *  `secrets/` item is keyed. */
export type BackupPasskey = {
    credentialId: string
    origin: string
    identity?: string
    counter?: number
    publicKeySpkiDer: string
    seedAddress?: string
    userId?: string
    userName?: string
    displayName?: string
    createdAt: number
}

/** What the sweep hands the engine. `privateKey` is the raw 32-byte P-256
 *  scalar; whoever receives it zeroes it, and it never reaches a store. */
export type LocalPasskey = BackupPasskey & { privateKey: Uint8Array }

export type SerializedAccount = {
    address: SerializedItem
    secrets: SerializedItem | null
    /** Shared items emitted alongside this account (e.g. the hdSeed secret keyed
     *  at the hashed seedFirstDerivedAddress); deduped by key downstream. */
    extraItems?: SerializedItem[]
}

/** Resolves a single-key local account's recovery phrase. Hook-bound: the
 *  phrase only exists inside a `useKMS().executeWithMnemonic` session, which
 *  maps the signing key back to its seed. Null when unavailable. */
export type SerializeMnemonicResolver = (
    account: LocalAccount,
) => Promise<string | null>

/** Resolves an HD account's derived/seed material for serialization. Hook-bound
 *  (needs KMS), injected from the app layer; null when the seed is unavailable. */
export type SerializeHdResolver = (account: LocalAccount) => Promise<{
    seedFirstDerivedAddress: string
    publicKeyHex: string
    seedHex: string
    entropyHex: string
} | null>

/** A local item with its content hash (sha256 of canonical payload sans
 *  updatedAt). `address`/`accountType` are lifted out of the payload for the
 *  tracked item to cache; `accountType` is null for contacts. */
export type LocalItem = SerializedItem & {
    contentHash: string
    address: string
    accountType: BackupItemKind | null
}

export type LocalSnapshot = {
    items: LocalItem[]
    skipped: number
}

export type ImportSummary = {
    imported: number
    skippedDuplicate: number
    failed: { address: string; reason: string }[]
}

/** Failures and duplicates count as done, so `done` always reaches `total`. */
export type ImportProgressFn = (done: number, total: number) => void

export type SyncImportFn = (
    accounts: PulledAccount[],
    onProgress?: ImportProgressFn,
) => Promise<ImportSummary>

/** A contact import never reports duplicates: an address already held is
 *  updated in place, because last-write-wins settled the winner upstream. */
export type ContactImportSummary = {
    imported: number
    failed: { address: string; reason: string }[]
}

export type ContactImportFn = (
    contacts: ContactBackupPayload[],
) => Promise<ContactImportSummary>

/** Why a credential in the backup was not written to this device. */
export type PasskeySkipReason =
    | 'secret-missing'
    | 'seed-missing'
    | 'pubkey-mismatch'
    | 'already-present'

/** A credential's two backup items, joined. `secret` is `null` when the
 *  `passkey-secrets/` item is absent or unreadable. */
export type PulledPasskey = {
    payload: PasskeyBackupPayload
    secret: PasskeySecretsBackupPayload | null
}

export type PasskeyImportSummary = {
    imported: number
    skipped: { credentialId: string; reason: PasskeySkipReason }[]
    failed: { credentialId: string; reason: string }[]
}

export type PasskeyImportFn = (
    passkeys: PulledPasskey[],
) => Promise<PasskeyImportSummary>

/** A value this device cannot apply is skipped; the sync keeps the remote's
 *  copy rather than pushing this device's own over it. */
export type SettingsImportFn = (settings: Partial<BackupSettings>) => void

export type SyncEngineDeps = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    /** AES-256-GCM item key; held only for the duration of one sync run. */
    encryptionKey: Uint8Array
    /** Closes over `K_item`, so it is only valid inside the keystore scope that
     *  produced it. */
    hashAddress: ItemKeyHasher
    /** Snapshot of local accounts to serialize/push. */
    listAccounts: () => WalletAccount[]
    /** Account → payload objects; `null` for unsupported (HD) accounts. Async
     *  because resolving an account's secret (mnemonic) is async. */
    serializeAccount: (
        account: WalletAccount,
    ) => Promise<SerializedAccount | null>
    /** Decrypted remote accounts → wallet (import/update). */
    importAccounts: SyncImportFn
    /** True once `stop()` or the app lock lands mid-run; the engine then throws
     *  `BackupSyncAbortedError` before its next seed read, remote apply or push. */
    isAborted: () => boolean
    /** Snapshot of local contacts to serialize/push. */
    listContacts: () => Contact[]
    /** Decrypted remote contacts → contacts store (insert or update). */
    importContacts: ContactImportFn
    /** Credentials this device can back up, with their private keys. Async
     *  because a credential whose key is not readable is re-derived, which
     *  runs a PBKDF2 per owning seed inside a KMS session. */
    listPasskeys: () => Promise<LocalPasskey[]>
    /** Decrypted remote credentials → native provider records. */
    importPasskeys: PasskeyImportFn
    getSettings: () => BackupSettings
    importSettings: SettingsImportFn
}

/** The wallet state the sync manager reads and watches but does not own. */
export type BackupSyncSources = {
    getNetwork: () => Network
    listAccounts: () => WalletAccount[]
    /** Fires on every accounts change; the manager diffs by fingerprint. */
    subscribeAccounts: (
        listener: (accounts: WalletAccount[]) => void,
    ) => () => void
    listContacts: () => Contact[]
    subscribeContacts: (listener: (contacts: Contact[]) => void) => () => void
    getSettings: () => BackupSettings
    /** Fires on any write to a store holding a synced setting; the manager
     *  diffs by fingerprint. */
    subscribeSettings: (listener: () => void) => () => void
    importSettings: SettingsImportFn
}

/** The backup's own persisted state, which the sync manager reads and writes. */
export type BackupSyncStatePort = {
    getBackupId: () => Nullable<BackupId>
    getDeviceId: (network: Network) => Nullable<DeviceId>
    getSyncState: () => Nullable<SyncState>
    setSyncState: (state: SyncState) => void
    setIsSyncing: (isSyncing: boolean) => void
    setBusyItems: (busyItems: string[]) => void
    /** Wipes config, sync state and activity so the backup reads "not set up". */
    reset: () => void
}

export type { PulledAccount }
