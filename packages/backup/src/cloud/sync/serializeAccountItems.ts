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
    accountsChainAdapters,
    chainAccountOf,
    isStandaloneAccount,
    standaloneSecretOf,
    isHardwareWalletAccount,
    isHDWalletAccount,
    isMultisigAccount,
    isQuantumAccount,
    isWatchAccount,
    type ChainAccount,
    type HDWalletAccount,
    type HDWalletDetails,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    accountItemKey,
    secretsItemKey,
    BackupAccountType,
    BackupItemType,
    type AddressBackupPayload,
    type SecretsBackupPayload,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import { isBackupChain } from './backupChains'
import type { SerializedAccount, SerializedItem } from './types'

type HdContext = {
    seedFirstDerivedAddress: string
    /** Null when the account has no legacy-chain entry to derive it for. */
    publicKeyHex: string | null
}

type SerializeParams = {
    /** Epoch millis to stamp on the address payload (LWW). */
    updatedAt: number
    /** Secrets payload from KMS, or null for secret-less account types. */
    secrets: SecretsBackupPayload | null
    hashAddress: ItemKeyHasher
    /** Resolved HD derivation data; REQUIRED for hdWallet accounts (the account
     *  carries neither its derived public key nor the seed's first address). */
    hd?: HdContext
}

const nameValue = (a: WalletAccount): string | null => a.name ?? null

/**
 * The legacy chain's HD details, or undefined when the account has no entry
 * there. The top-level details belong to whichever chain created the account,
 * so they only answer when that was the legacy chain.
 */
export const legacyHdDetailsOf = (
    account: HDWalletAccount,
): HDWalletDetails | undefined => {
    const entry = chainAccountOf(account, LEGACY_CHAIN_ID)
    if (!entry) return undefined
    if (account.hdWalletDetails && account.address === entry.address) {
        return account.hdWalletDetails
    }
    return accountsChainAdapters
        .get(LEGACY_CHAIN_ID)
        .legacyDetails(account.custody, entry).hdWalletDetails
}

/** Maps a supported WalletAccount to its legacy-chain address payload, or null
 *  when the account has no legacy entry or HD context is absent. */
const toAddressPayload = (
    a: WalletAccount,
    address: string,
    updatedAt: number,
    hd?: HdContext,
): AddressBackupPayload | null => {
    if (isStandaloneAccount(a)) {
        // A private-key account has no legacy item; its chain's own kind carries it.
        if (standaloneSecretOf(a) !== 'mnemonic') return null
        return {
            type: BackupAccountType.algo25,
            address,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isQuantumAccount(a)) {
        return {
            type: BackupAccountType.quantum,
            address,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isWatchAccount(a)) {
        return {
            type: BackupAccountType.watch,
            address,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isHardwareWalletAccount(a)) {
        return {
            type: BackupAccountType.hardware,
            address,
            deviceId: a.hardwareDetails.deviceId,
            deviceName: a.hardwareDetails.deviceName,
            accountIndex: a.hardwareDetails.accountIndex,
            manufacturer: a.hardwareDetails.manufacturer,
            transportType: a.hardwareDetails.transportType,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isMultisigAccount(a)) {
        return {
            type: BackupAccountType.multisig,
            address,
            participantAddresses: a.multisigDetails.addresses,
            threshold: a.multisigDetails.threshold,
            version: a.multisigDetails.version,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isHDWalletAccount(a)) {
        const details = legacyHdDetailsOf(a)
        if (!hd?.publicKeyHex || !details) return null
        return {
            type: BackupAccountType.hdWallet,
            address,
            seedFirstDerivedAddress: hd.seedFirstDerivedAddress,
            publicKey: hd.publicKeyHex,
            account: details.account,
            change: details.change,
            keyIndex: details.keyIndex,
            derivationType: details.derivationType,
            customName: nameValue(a),
            updatedAt,
        }
    }
    const exhaustive: never = a
    return exhaustive
}

/** The legacy chain's items; null when the account has none there. */
export const serializeAccountItems = (
    account: WalletAccount,
    { updatedAt, secrets, hd, hashAddress }: SerializeParams,
): SerializedAccount | null => {
    const legacyAddress = chainAccountOf(account, LEGACY_CHAIN_ID)?.address
    if (!legacyAddress) return null
    const addressPayload = toAddressPayload(
        account,
        legacyAddress,
        updatedAt,
        hd,
    )
    if (addressPayload === null) return null

    const address = {
        key: accountItemKey(hashAddress(legacyAddress)),
        type: BackupItemType.ACCOUNT,
        payload: addressPayload,
    }
    const secretsItem = secrets
        ? {
              key: secretsItemKey(hashAddress(legacyAddress)),
              type: BackupItemType.ACCOUNT,
              payload: secrets,
          }
        : null
    return { address, secrets: secretsItem }
}

export type BackupChainEntry = { chainId: ChainId; entry: ChainAccount }

/** The account's entries beyond the legacy chain that this build can back up, by chain id. */
export const backupChainEntriesOf = (
    account: WalletAccount,
): BackupChainEntry[] =>
    (Object.entries(account.chains ?? {}) as [ChainId, ChainAccount][])
        .filter(
            ([chainId, entry]) =>
                chainId !== LEGACY_CHAIN_ID &&
                entry !== undefined &&
                isBackupChain(chainId),
        )
        .map(([chainId, entry]) => ({ chainId, entry }))
        .sort((a, b) => a.chainId.localeCompare(b.chainId))

/** Every address the account holds, whatever the chain. */
export const accountAddressesOf = (account: WalletAccount): string[] => [
    ...new Set(
        [
            account.address,
            ...Object.values(account.chains ?? {}).map(entry => entry?.address),
        ].filter((address): address is string => !!address),
    ),
]

/**
 * One chain entry's address item, filed under that entry's own address. Null
 * for custody with no chain-tagged kind (hardware, multisig, quantum) and for
 * an HD entry given no seed reference.
 */
export const serializeChainEntryItem = (
    account: WalletAccount,
    { chainId, entry }: BackupChainEntry,
    {
        updatedAt,
        hashAddress,
        seedFirstDerivedAddress,
    }: {
        updatedAt: number
        hashAddress: ItemKeyHasher
        seedFirstDerivedAddress?: string
    },
): SerializedItem | null => {
    const { custody } = account
    const common = {
        chain: chainId,
        address: entry.address,
        customName: nameValue(account),
        updatedAt,
    }
    let payload: AddressBackupPayload
    if (custody.kind === 'watch') {
        payload = { type: BackupAccountType.watchChain, ...common }
    } else if (custody.kind === 'local' && custody.seed === 'bip39') {
        if (!seedFirstDerivedAddress) return null
        payload = {
            type: BackupAccountType.hdChain,
            ...common,
            seedFirstDerivedAddress,
            account: custody.hd.account,
            keyIndex: custody.hd.keyIndex,
        }
    } else if (custody.kind === 'local' && custody.seed === null) {
        payload = { type: BackupAccountType.standaloneKey, ...common }
    } else {
        return null
    }
    return {
        key: accountItemKey(hashAddress(entry.address)),
        type: BackupItemType.ACCOUNT,
        payload,
    }
}
