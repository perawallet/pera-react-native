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

import { logger } from '@perawallet/wallet-core-shared'
import type { Network } from '@perawallet/wallet-core-shared'
import type {
    Algo25Account,
    HDWalletAccount,
    QuantumAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    AddressBackupPayload,
    BackupId,
    BackupItemKey,
    BackupItemType,
    ContactBackupPayload,
    DeviceId,
    PasskeyBackupPayload,
    SecretsBackupPayload,
} from '../models'
import type { Contact } from '@perawallet/wallet-core-contacts'
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
    payload:
        | AddressBackupPayload
        | SecretsBackupPayload
        | ContactBackupPayload
        | PasskeyBackupPayload
}

/** A credential this device has already proven it can re-derive. `seedAddress`
 *  is the first-derived address of the owning seed, which is how the seed's
 *  `secrets/` item is keyed. */
export type BackupPasskey = {
    credentialId: string
    origin: string
    identity: string
    counter: number
    publicKeySpkiDer: string
    seedAddress: string
    userId?: string
    userName?: string
    displayName?: string
    createdAt: number
}

export type SerializedAccount = {
    address: SerializedItem
    secrets: SerializedItem | null
    /** Shared items emitted alongside this account (e.g. the hdSeed secret
     *  keyed at secrets/<seedFirstDerivedAddress>); deduped by key downstream. */
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

/** A local item with its content hash (sha256 of canonical payload sans updatedAt). */
export type LocalItem = SerializedItem & { contentHash: string }

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

/** Why a credential in the backup was not written to this device. */
export type PasskeySkipReason =
    | 'seed-missing'
    | 'pubkey-mismatch'
    | 'already-present'

export type PasskeyImportSummary = {
    imported: number
    skipped: { credentialId: string; reason: PasskeySkipReason }[]
    failed: { credentialId: string; reason: string }[]
}

export type PasskeyImportFn = (
    passkeys: PasskeyBackupPayload[],
) => Promise<PasskeyImportSummary>

/** No passkey writer exists yet in this codebase, so every call site that
 *  needs a `PasskeyImportFn` shares this one: it gives the sync engine and the
 *  restore flow something type-correct to call, and logs whenever credentials
 *  are actually dropped so that loss leaves a trace instead of the silent
 *  empty summary a local no-op closure would produce. */
export const unwiredPasskeyImportFn: PasskeyImportFn = async passkeys => {
    if (passkeys.length > 0) {
        logger.warn('unwiredPasskeyImportFn: dropped passkeys with no writer', {
            count: passkeys.length,
        })
    }
    return { imported: 0, skipped: [], failed: [] }
}

export type SyncEngineDeps = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    /** AES-256-GCM item key; held only for the duration of one sync run. */
    encryptionKey: Uint8Array
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
    /** Credentials this device has proven it can re-derive. Async because
     *  proving one runs a PBKDF2 per owning seed inside a KMS session. */
    listPasskeys: () => Promise<BackupPasskey[]>
    /** Decrypted remote credentials → native provider records. */
    importPasskeys: PasskeyImportFn
}

export type { PulledAccount }
