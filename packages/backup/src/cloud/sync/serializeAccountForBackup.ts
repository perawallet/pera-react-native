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

import {
    hasCustody,
    hdIndexOf,
    standaloneSecretOf,
    type ChainAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    bytesToHex,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { backupAdapterFor } from '../../chain-adapter'
import {
    accountRecordIdentity,
    accountRecordItemKey,
    secretsItemKey,
    BackupAccountType,
    BackupItemType,
    orderAccountRecordChains,
    type AccountRecordPayload,
    type SecretsBackupPayload,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import { isBackupChain } from './backupChains'
import { buildAccountRecord, hasBackupChains } from './serializeAccountItems'
import type {
    SerializedAccount,
    SerializedItem,
    SeedSecretsCache,
    SerializeHdResolver,
    SerializeMnemonicResolver,
    SerializePrivateKeyResolver,
} from './types'

type Deps = {
    /** The scope chain, whose backup adapter files a recovery phrase. */
    chainId: ChainId
    updatedAt: number
    hashAddress: ItemKeyHasher
    /** Omitted/null => the account is skipped rather than backed up without
     *  its secret. */
    resolveMnemonic?: SerializeMnemonicResolver
    /** Resolves HD seed/derived material; omitted/null => HD account skipped. */
    resolveHd?: SerializeHdResolver
    seedSecrets?: SeedSecretsCache
    /** Reads a private-key account's key; omitted/null => the account is skipped. */
    resolvePrivateKey?: SerializePrivateKeyResolver
}

const recordItem = (
    payload: AccountRecordPayload,
    hashAddress: ItemKeyHasher,
): SerializedItem => ({
    key: accountRecordItemKey(hashAddress(accountRecordIdentity(payload))),
    type: BackupItemType.ACCOUNT,
    payload,
})

const secretsItem = (
    payload: SecretsBackupPayload,
    hashAddress: ItemKeyHasher,
): SerializedItem => ({
    key: secretsItemKey(hashAddress(payload.address)),
    type: BackupItemType.ACCOUNT,
    payload,
})

/** Imperative (non-hook) account serializer for the background manager. The
 *  secret resolvers are injected because reading key material is hook-bound in
 *  the KMS; secret-less accounts => record only. */
export const serializeAccountForBackup = async (
    account: WalletAccount,
    {
        chainId,
        updatedAt,
        hashAddress,
        resolveMnemonic,
        resolveHd,
        resolvePrivateKey,
        seedSecrets,
    }: Deps,
): Promise<Nullable<SerializedAccount>> => {
    // Checked first: reading a seed or key is KMS work and can prompt.
    if (!hasBackupChains(account)) return null

    if (hasCustody(account, 'local') && hdIndexOf(account)) {
        if (!resolveHd) return null
        const resolved = await resolveHd(account, seedSecrets)
        if (!resolved) return null
        const payload = buildAccountRecord(account, {
            updatedAt,
            hd: {
                seedFirstDerivedAddress: resolved.seedFirstDerivedAddress,
                publicKeyHex: resolved.publicKeyHex,
            },
        })
        if (!payload) return null
        // One per seed, filed under the seed's first address; every account of
        // the seed emits it and the keyed dedupe downstream keeps one.
        const seedSecret = secretsItem(
            {
                type: BackupAccountType.hdSeed,
                seed: resolved.seedHex,
                entropy: resolved.entropyHex,
                address: resolved.seedFirstDerivedAddress,
            },
            hashAddress,
        )
        return {
            record: recordItem(payload, hashAddress),
            secrets: null,
            extraItems: [seedSecret],
        }
    }

    const payload = buildAccountRecord(account, { updatedAt })
    if (!payload) return null
    if (!hasCustody(account, 'local')) {
        return { record: recordItem(payload, hashAddress), secrets: null }
    }

    let secrets: Nullable<SecretsBackupPayload>
    if (standaloneSecretOf(account) === 'privateKey') {
        secrets = await privateKeySecrets(account, resolvePrivateKey)
    } else {
        if (!resolveMnemonic) return null
        const mnemonic = await resolveMnemonic(account)
        if (!mnemonic) return null
        secrets = backupAdapterFor(chainId).serializeMnemonicSecret(
            account,
            mnemonic,
        )
    }
    return secrets
        ? {
              record: recordItem(payload, hashAddress),
              secrets: secretsItem(secrets, hashAddress),
          }
        : null
}

/** The key is hex-encoded the moment it is read and the bytes are zeroed
 *  whatever happens next. A private-key account holds one key whichever chains
 *  it is on, so it is backed up once, under the first chain in record order:
 *  the entry the record's identity names. */
const privateKeySecrets = async (
    account: WalletAccount,
    resolvePrivateKey?: SerializePrivateKeyResolver,
): Promise<Nullable<SecretsBackupPayload>> => {
    const [held] = orderAccountRecordChains(
        (
            Object.entries(account.chains) as [
                ChainId,
                Optional<ChainAccount>,
            ][]
        ).flatMap(([chain, entry]) =>
            entry?.keyPairId && isBackupChain(chain) ? [{ chain, entry }] : [],
        ),
    )
    if (!held || !resolvePrivateKey) return null
    const { chain, entry } = held
    const keyBytes = await resolvePrivateKey(chain, entry.keyPairId as string)
    if (!keyBytes) return null
    try {
        return {
            type: BackupAccountType.standaloneKey,
            chain,
            address: entry.address,
            privateKey: bytesToHex(keyBytes),
        }
    } finally {
        zeroBytes(keyBytes)
    }
}
