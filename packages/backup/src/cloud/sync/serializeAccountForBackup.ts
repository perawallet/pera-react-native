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
    AccountTypes,
    type HDWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    BackupAccountType,
    BackupItemType,
    type SecretsBackupPayload,
} from '../models'
import { serializeAccountItems } from './serializeAccountItems'
import type {
    SerializedAccount,
    SerializedItem,
    SerializeHdResolver,
    SerializeMnemonicResolver,
} from './types'

type Deps = {
    updatedAt: number
    /** Resolves the 25-word phrase for algo25/quantum accounts; omitted/null
     *  => the account is skipped rather than backed up without its secret. */
    resolveMnemonic?: SerializeMnemonicResolver
    /** Resolves HD seed/derived material; omitted/null => HD account skipped. */
    resolveHd?: SerializeHdResolver
}

/** Imperative (non-hook) account serializer for the background manager. Both
 *  secret-bearing paths are injected because reading key material is hook-bound
 *  in the KMS: `resolveMnemonic` covers algo25 and quantum (they share the
 *  25-word format), `resolveHd` covers HD (whose seed rides as a shared hdSeed
 *  secret in extraItems); secret-less types => address-only. */
export const serializeAccountForBackup = async (
    account: WalletAccount,
    { updatedAt, resolveMnemonic, resolveHd }: Deps,
): Promise<SerializedAccount | null> => {
    if (account.type === AccountTypes.hdWallet) {
        return serializeHdAccount(account, updatedAt, resolveHd)
    }

    let secrets: SecretsBackupPayload | null = null
    if (
        account.type === AccountTypes.algo25 ||
        account.type === AccountTypes.quantum
    ) {
        if (!resolveMnemonic) return null
        const mnemonic = await resolveMnemonic(account)
        if (!mnemonic) return null
        secrets = { type: account.type, mnemonic }
    }
    return serializeAccountItems(account, { updatedAt, secrets })
}

/** HD child -> hdWallet address item; the seed rides as a shared hdSeed secret
 *  at secrets/<seedFirstDerivedAddress> (deduped by buildLocalItems). */
const serializeHdAccount = async (
    account: HDWalletAccount,
    updatedAt: number,
    resolveHd?: SerializeHdResolver,
): Promise<SerializedAccount | null> => {
    if (!resolveHd) return null
    const resolved = await resolveHd(account)
    if (!resolved) return null

    const base = serializeAccountItems(account, {
        updatedAt,
        secrets: null,
        hd: {
            seedFirstDerivedAddress: resolved.seedFirstDerivedAddress,
            publicKeyHex: resolved.publicKeyHex,
        },
    })
    if (!base) return null

    const seedSecret: SerializedItem = {
        key: `secrets/${resolved.seedFirstDerivedAddress}`,
        type: BackupItemType.ACCOUNT,
        payload: {
            type: BackupAccountType.hdSeed,
            seed: resolved.seedHex,
            entropy: resolved.entropyHex,
        },
    }
    return { ...base, extraItems: [seedSecret] }
}
