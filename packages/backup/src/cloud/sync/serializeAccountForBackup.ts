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
    type LocalAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { backupAdapterFor } from '../../chain-adapter'
import {
    secretsItemKey,
    BackupAccountType,
    BackupItemType,
    type SecretsBackupPayload,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import { serializeAccountItems } from './serializeAccountItems'
import type {
    SerializedAccount,
    SerializedItem,
    SerializeHdResolver,
    SerializeMnemonicResolver,
} from './types'

type Deps = {
    updatedAt: number
    hashAddress: ItemKeyHasher
    /** Omitted/null => the account is skipped rather than backed up without
     *  its secret. */
    resolveMnemonic?: SerializeMnemonicResolver
    /** Resolves HD seed/derived material; omitted/null => HD account skipped. */
    resolveHd?: SerializeHdResolver
}

/** Imperative (non-hook) account serializer for the background manager. Both
 *  secret resolvers are injected because reading key material is hook-bound in
 *  the KMS; secret-less types => address-only. */
export const serializeAccountForBackup = async (
    account: WalletAccount,
    { updatedAt, hashAddress, resolveMnemonic, resolveHd }: Deps,
): Promise<SerializedAccount | null> => {
    if (hasCustody(account, 'local') && hdIndexOf(account)) {
        return serializeHdAccount(account, updatedAt, hashAddress, resolveHd)
    }

    let secrets: SecretsBackupPayload | null = null
    if (hasCustody(account, 'local')) {
        // A standalone key stored as a raw private key has no backup item.
        if (standaloneSecretOf(account) === 'privateKey' || !resolveMnemonic) {
            return null
        }
        const mnemonic = await resolveMnemonic(account)
        if (!mnemonic) return null
        secrets = backupAdapterFor().serializeMnemonicSecret(account, mnemonic)
        if (!secrets) return null
    }
    return serializeAccountItems(account, { updatedAt, secrets, hashAddress })
}

/** HD child -> HD address item; the seed rides as a shared hdSeed secret
 *  at secrets/<hash of seedFirstDerivedAddress> (deduped by buildLocalItems). */
const serializeHdAccount = async (
    account: LocalAccount,
    updatedAt: number,
    hashAddress: ItemKeyHasher,
    resolveHd?: SerializeHdResolver,
): Promise<SerializedAccount | null> => {
    if (!resolveHd) return null
    const resolved = await resolveHd(account)
    if (!resolved) return null

    const base = serializeAccountItems(account, {
        updatedAt,
        secrets: null,
        hashAddress,
        hd: {
            seedFirstDerivedAddress: resolved.seedFirstDerivedAddress,
            publicKeyHex: resolved.publicKeyHex,
        },
    })
    if (!base) return null

    const seedSecret: SerializedItem = {
        key: secretsItemKey(hashAddress(resolved.seedFirstDerivedAddress)),
        type: BackupItemType.ACCOUNT,
        payload: {
            type: BackupAccountType.hdSeed,
            seed: resolved.seedHex,
            entropy: resolved.entropyHex,
            address: resolved.seedFirstDerivedAddress,
        },
    }
    return { ...base, extraItems: [seedSecret] }
}
