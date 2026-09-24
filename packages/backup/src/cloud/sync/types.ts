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

import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type {
    Algo25Account,
    HDWalletAccount,
    QuantumAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    AddressBackupPayload,
    BackupAccountType,
    BackupId,
    BackupItemKey,
    BackupItemType,
    ContactBackupPayload,
    DeviceId,
    SecretsBackupPayload,
    SyncState,
} from '../models'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import type { PulledAccount } from '../restore'

export class UnsupportedBackupAccountTypeError extends Error {
    constructor(public readonly type: string) {
        super(`Backup sync does not support account type: ${type}`)
        this.name = 'UnsupportedBackupAccountTypeError'
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

/** A single backup item ready to hash/encrypt. `payload` is the parsed object. */
export type SerializedItem = {
    key: BackupItemKey
    type: BackupItemType
    payload: AddressBackupPayload | SecretsBackupPayload | ContactBackupPayload
}

export type SerializedAccount = {
    address: SerializedItem
    secrets: SerializedItem | null
    /** Shared items emitted alongside this account (e.g. the hdSeed secret keyed
     *  at the hashed seedFirstDerivedAddress); deduped by key downstream. */
    extraItems?: SerializedItem[]
}

/** Resolves an account's 25-word phrase. Hook-bound: the phrase only exists
 *  inside a `useKMS().executeWithMnemonic` session, which maps the signing
 *  `keyPairId` back to its seed. algo25 and quantum share the format, so one
 *  resolver covers both. Null when unavailable. */
export type SerializeMnemonicResolver = (
    account: Algo25Account | QuantumAccount,
) => Promise<string | null>

/** Resolves an HD account's derived/seed material for serialization. Hook-bound
 *  (needs KMS), injected from the app layer; null when the seed is unavailable. */
export type SerializeHdResolver = (account: HDWalletAccount) => Promise<{
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
    accountType: BackupAccountType | null
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

export type SyncImportFn = (accounts: PulledAccount[]) => Promise<ImportSummary>

/** A contact import never reports duplicates: an address already held is
 *  updated in place, because last-write-wins settled the winner upstream. */
export type ContactImportSummary = {
    imported: number
    failed: { address: string; reason: string }[]
}

export type ContactImportFn = (
    contacts: ContactBackupPayload[],
) => Promise<ContactImportSummary>

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
    /** Snapshot of local contacts to serialize/push. */
    listContacts: () => Contact[]
    /** Decrypted remote contacts → contacts store (insert or update). */
    importContacts: ContactImportFn
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
}

/** The backup's own persisted state, which the sync manager reads and writes. */
export type BackupSyncStatePort = {
    getBackupId: () => Nullable<BackupId>
    getDeviceId: (network: Network) => Nullable<DeviceId>
    getSyncState: () => Nullable<SyncState>
    setSyncState: (state: SyncState) => void
    setIsSyncing: (isSyncing: boolean) => void
    /** Wipes config, sync state and activity so the backup reads "not set up". */
    reset: () => void
}

export type { PulledAccount }
