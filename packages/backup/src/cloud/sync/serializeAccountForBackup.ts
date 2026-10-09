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
    chainAccountOf,
    isStandaloneAccount,
    standaloneSecretOf,
    isHDWalletAccount,
    isQuantumAccount,
    type HDWalletAccount,
    type StandaloneAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import {
    secretsItemKey,
    BackupAccountType,
    BackupItemType,
    type SecretsBackupPayload,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import {
    backupChainEntriesOf,
    serializeAccountItems,
    serializeChainEntryItem,
} from './serializeAccountItems'
import type {
    SerializedAccount,
    SerializedItem,
    SerializeHdResolver,
    SerializeMnemonicResolver,
    SerializePrivateKeyResolver,
} from './types'

type Deps = {
    updatedAt: number
    hashAddress: ItemKeyHasher
    /** Omitted/null => the account is skipped rather than backed up without
     *  its secret. */
    resolveMnemonic?: SerializeMnemonicResolver
    /** Resolves HD seed/derived material; omitted/null => HD account skipped. */
    resolveHd?: SerializeHdResolver
    /** Reads a private-key account's key; omitted/null => the account is skipped. */
    resolvePrivateKey?: SerializePrivateKeyResolver
}

/** The legacy chain's item leads when the account has one, else the first
 *  chain item does; everything else rides as an extra item. */
const combine = (
    legacy: SerializedAccount | null,
    chainItems: SerializedItem[],
): SerializedAccount | null => {
    const [first, ...rest] = chainItems
    const address = legacy?.address ?? first
    if (!address) return null
    const extraItems = [
        ...(legacy?.extraItems ?? []),
        ...(legacy ? chainItems : rest),
    ]
    return {
        address,
        secrets: legacy?.secrets ?? null,
        ...(extraItems.length > 0 ? { extraItems } : {}),
    }
}

/** Imperative (non-hook) account serializer for the background manager. The
 *  secret resolvers are injected because reading key material is hook-bound in
 *  the KMS; secret-less types => address-only. */
export const serializeAccountForBackup = async (
    account: WalletAccount,
    {
        updatedAt,
        hashAddress,
        resolveMnemonic,
        resolveHd,
        resolvePrivateKey,
    }: Deps,
): Promise<SerializedAccount | null> => {
    if (isHDWalletAccount(account)) {
        return serializeHdAccount(account, updatedAt, hashAddress, resolveHd)
    }
    if (
        isStandaloneAccount(account) &&
        standaloneSecretOf(account) === 'privateKey'
    ) {
        return serializePrivateKeyAccount(
            account,
            updatedAt,
            hashAddress,
            resolvePrivateKey,
        )
    }

    let secrets: SecretsBackupPayload | null = null
    if (
        (isStandaloneAccount(account) &&
            standaloneSecretOf(account) === 'mnemonic') ||
        isQuantumAccount(account)
    ) {
        if (!resolveMnemonic) return null
        const mnemonic = await resolveMnemonic(account)
        if (!mnemonic) return null
        secrets = {
            type: isQuantumAccount(account)
                ? BackupAccountType.quantum
                : BackupAccountType.algo25,
            mnemonic,
            address: account.address,
        }
    }
    const legacy = serializeAccountItems(account, {
        updatedAt,
        secrets,
        hashAddress,
    })
    const chainItems = backupChainEntriesOf(account).flatMap(entry => {
        const item = serializeChainEntryItem(account, entry, {
            updatedAt,
            hashAddress,
        })
        return item ? [item] : []
    })
    return combine(legacy, chainItems)
}

/** HD child -> hdWallet and hdChain address items; the seed rides as a shared
 *  hdSeed secret at secrets/<hash of seedFirstDerivedAddress> (deduped by
 *  buildLocalItems). */
const serializeHdAccount = async (
    account: HDWalletAccount,
    updatedAt: number,
    hashAddress: ItemKeyHasher,
    resolveHd?: SerializeHdResolver,
): Promise<SerializedAccount | null> => {
    if (!resolveHd) return null
    const entries = backupChainEntriesOf(account)
    if (!chainAccountOf(account, LEGACY_CHAIN_ID) && entries.length === 0) {
        return null
    }
    const resolved = await resolveHd(account)
    if (!resolved) return null

    const legacy = serializeAccountItems(account, {
        updatedAt,
        secrets: null,
        hashAddress,
        hd: {
            seedFirstDerivedAddress: resolved.seedFirstDerivedAddress,
            publicKeyHex: resolved.publicKeyHex,
        },
    })
    const chainItems = entries.flatMap(entry => {
        const item = serializeChainEntryItem(account, entry, {
            updatedAt,
            hashAddress,
            seedFirstDerivedAddress: resolved.seedFirstDerivedAddress,
        })
        return item ? [item] : []
    })
    const combined = combine(legacy, chainItems)
    if (!combined) return null

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
    return {
        ...combined,
        extraItems: [seedSecret, ...(combined.extraItems ?? [])],
    }
}

/** A private-key account has one entry, on a chain with no legacy item. The key
 *  is hex-encoded the moment it is read and the bytes are zeroed whatever happens next. */
const serializePrivateKeyAccount = async (
    account: StandaloneAccount,
    updatedAt: number,
    hashAddress: ItemKeyHasher,
    resolvePrivateKey?: SerializePrivateKeyResolver,
): Promise<SerializedAccount | null> => {
    const [target] = backupChainEntriesOf(account)
    if (!target?.entry.keyPairId || !resolvePrivateKey) return null
    const keyBytes = await resolvePrivateKey(
        target.chainId,
        target.entry.keyPairId,
    )
    if (!keyBytes) return null
    try {
        const privateKey = bytesToHex(keyBytes)
        const address = serializeChainEntryItem(account, target, {
            updatedAt,
            hashAddress,
        })
        if (!address) return null
        return {
            address,
            secrets: {
                key: secretsItemKey(hashAddress(target.entry.address)),
                type: BackupItemType.ACCOUNT,
                payload: {
                    type: BackupAccountType.standaloneKey,
                    chain: target.chainId,
                    address: target.entry.address,
                    privateKey,
                },
            },
        }
    } finally {
        zeroBytes(keyBytes)
    }
}
