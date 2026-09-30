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

import type {
    HDWalletDetails,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    createChainAdapterRegistry,
    type ChainId,
    type ChainKeyStore,
    type DerivedAccount,
} from '@perawallet/wallet-core-chain-contract'
import { kmsCore } from '@perawallet/wallet-core-kms'
import type {
    AsbBackupAccount,
    AsbBackupEnvelope,
    AsbBackupPayload,
    AsbImportablePartition,
} from './asb/models'

export type ImportFromSeed = (params: {
    /** Encoded account address; validated before any keystore work. */
    address: string
    /** Raw 32- or 64-byte ed25519 key from the backup. */
    privateKey: Uint8Array
    /** Persisted after the import when set. */
    name?: string | null
}) => Promise<WalletAccount>

/** The chain-specific halves of a backup restore; registered by the chain package. */
export interface BackupChainAdapter {
    readonly chainId: ChainId
    /**
     * The id a seed's `secrets/` and passkey items are filed and joined under.
     * The wire format fixes it, so it never changes.
     */
    seedReference(kms: ChainKeyStore, seedKeyId: string): Promise<string>
    /** Derives, and commits, the HD child at the account's stored coordinates and derivation type. */
    deriveHdAccount(
        kms: ChainKeyStore,
        seedKeyId: string,
        details: HDWalletDetails,
    ): Promise<DerivedAccount>
    /** Imports one account from its raw ed25519 key and marks it backed up. */
    useImportFromSeed(): ImportFromSeed
    readonly secureBackup: {
        parseEnvelope(raw: string): AsbBackupEnvelope
        decryptPayload(
            envelope: AsbBackupEnvelope,
            recoveryIndices: Uint16Array,
        ): AsbBackupPayload
        partitionImportable(
            accounts: AsbBackupAccount[],
            existing: WalletAccount[],
        ): AsbImportablePartition
        useImportAccount(): (
            account: AsbBackupAccount,
        ) => Promise<WalletAccount>
    }
}

export const backupChainAdapters =
    createChainAdapterRegistry<BackupChainAdapter>('backup')

// Every backup item kind and every legacy account belongs to the legacy chain.
export const backupAdapterFor = (): BackupChainAdapter =>
    backupChainAdapters.get(LEGACY_CHAIN_ID)

export const backupSeedReference = (seedKeyId: string): Promise<string> =>
    backupAdapterFor().seedReference(kmsCore, seedKeyId)
