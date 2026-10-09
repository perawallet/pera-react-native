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

import type { HdIndex, WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    createChainAdapterRegistry,
    type ChainId,
    type ChainKeyStore,
    type DerivedAccount,
} from '@perawallet/wallet-core-chain-contract'
import { kmsCore } from '@perawallet/wallet-core-kms'
import type { SeedScheme } from '@perawallet/wallet-core-kms/constants'
import type {
    AsbBackupAccount,
    AsbBackupEnvelope,
    AsbBackupPayload,
    AsbImportablePartition,
} from './asb/models'
import type {
    AddressBackupPayload,
    SecretsBackupPayload,
} from './cloud/models/payloads'

/**
 * HD coordinates. A backup payload also records the derivation type, which
 * the chain validates; a held account's coordinates omit it.
 */
export type BackupHdCoordinates = HdIndex & { derivationType?: number }

/** What an HD account's address item records beyond the account itself. */
export type BackupHdContext = {
    /** The wallet seed's first derived address, which files the seed's `secrets/` item. */
    seedFirstDerivedAddress: string
    publicKeyHex: string
}

/** The local key an account's backup item restores into. */
export type BackupLocalKind = {
    seed: SeedScheme
    /** Derives from a backed-up HD seed rather than holding its own recovery phrase. */
    isHd: boolean
}

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
        coordinates: BackupHdCoordinates,
    ): Promise<DerivedAccount>
    /**
     * The account's address item, byte-for-byte what the backup format
     * stores for its kind, or `null` when it isn't backed up: an HD account
     * without `hd`, or an account with no address on this chain.
     */
    serializeAccount(
        account: WalletAccount,
        context: { updatedAt: number; hd?: BackupHdContext },
    ): AddressBackupPayload | null
    /**
     * Decodes an address item's wire `type` into the local key it restores;
     * `undefined` for an item that holds no local key (watch, hardware,
     * multisig, a bare seed).
     */
    localKindOf(type: AddressBackupPayload['type']): BackupLocalKind | undefined
    /**
     * Decodes an address item's wire `type` into the kind id the chain's
     * account presentation describes; `undefined` for an item that isn't an
     * account (a bare seed).
     */
    kindIdOf(type: AddressBackupPayload['type']): string | undefined
    /** The secrets item a single-key local account's recovery phrase is stored as; `null` for any other account. */
    serializeMnemonicSecret(
        account: WalletAccount,
        mnemonic: string,
    ): SecretsBackupPayload | null
    /**
     * The id one backup state is kept under for every account the same
     * recovery phrase restores; `null` for an account without one.
     */
    mnemonicBackupKeyId(account: WalletAccount): string | null
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
export const BACKUP_CHAIN_ID: ChainId = LEGACY_CHAIN_ID

export const backupAdapterFor = (): BackupChainAdapter =>
    backupChainAdapters.get(BACKUP_CHAIN_ID)

export const backupSeedReference = (seedKeyId: string): Promise<string> =>
    backupAdapterFor().seedReference(kmsCore, seedKeyId)

/** The presentation kind id for a backup item shown without a local account. */
export const backupItemKindId = (
    type: AddressBackupPayload['type'],
    chainId: ChainId,
): string | undefined => backupChainAdapters.get(chainId).kindIdOf(type)
