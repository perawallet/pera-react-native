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
    DeviceId,
    SecretsBackupPayload,
} from '../models'
import type { PulledAccount } from '../restore'

export class UnsupportedBackupAccountTypeError extends Error {
    constructor(public readonly type: string) {
        super(`Backup sync does not support account type: ${type}`)
        this.name = 'UnsupportedBackupAccountTypeError'
    }
}

/** A single backup item ready to hash/encrypt. `payload` is the parsed object. */
export type SerializedItem = {
    key: BackupItemKey
    type: BackupItemType
    payload: AddressBackupPayload | SecretsBackupPayload
}

export type SerializedAccount = {
    address: SerializedItem
    secrets: SerializedItem | null
    /** Shared items emitted alongside this account (e.g. the hdSeed secret
     *  keyed at secrets/<seedFirstDerivedAddress>); deduped by key downstream. */
    extraItems?: SerializedItem[]
}

/**
 * Resolves an account's 25-word recovery phrase for serialization. Hook-bound
 * (the phrase is rebuilt inside a `useKMS().executeWithMnemonic` session, which
 * maps the account's signing `keyPairId` back to its seed and zeroes every
 * intermediate buffer); injected from the app layer, null when unavailable.
 *
 * algo25 and quantum share the 25-word wire format, so one resolver covers
 * both — see `executeWithMnemonic` in `@perawallet/wallet-core-kms`.
 */
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

export type ImportSummary = {
    imported: number
    skippedDuplicate: number
    failed: { address: string; reason: string }[]
}

export type SyncImportFn = (accounts: PulledAccount[]) => Promise<ImportSummary>

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
}

export type { PulledAccount }
