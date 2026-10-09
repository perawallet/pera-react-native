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
    isStandaloneAccount,
    standaloneSecretOf,
    isHardwareWalletAccount,
    isHDWalletAccount,
    isMultisigAccount,
    isQuantumAccount,
    isWatchAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    accountItemKey,
    secretsItemKey,
    BackupAccountType,
    BackupItemType,
    type AddressBackupPayload,
    type SecretsBackupPayload,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import type { SerializedAccount } from './types'

type SerializeParams = {
    /** Epoch millis to stamp on the address payload (LWW). */
    updatedAt: number
    /** Secrets payload from KMS, or null for secret-less account types. */
    secrets: SecretsBackupPayload | null
    hashAddress: ItemKeyHasher
    /** Resolved HD derivation data; REQUIRED for hdWallet accounts (the account
     *  carries neither its derived public key nor the seed's first address). */
    hd?: { seedFirstDerivedAddress: string; publicKeyHex: string }
}

const nameValue = (a: WalletAccount): string | null => a.name ?? null

/** Maps a supported WalletAccount to its address payload, or null when HD context is absent. */
const toAddressPayload = (
    a: WalletAccount,
    updatedAt: number,
    hd?: { seedFirstDerivedAddress: string; publicKeyHex: string },
): AddressBackupPayload | null => {
    if (isStandaloneAccount(a)) {
        // A private-key account has no backup item yet.
        if (standaloneSecretOf(a) !== 'mnemonic') return null
        return {
            type: BackupAccountType.algo25,
            address: a.address,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isQuantumAccount(a)) {
        return {
            type: BackupAccountType.quantum,
            address: a.address,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isWatchAccount(a)) {
        return {
            type: BackupAccountType.watch,
            address: a.address,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isHardwareWalletAccount(a)) {
        return {
            type: BackupAccountType.hardware,
            address: a.address,
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
            address: a.address,
            participantAddresses: a.multisigDetails.addresses,
            threshold: a.multisigDetails.threshold,
            version: a.multisigDetails.version,
            customName: nameValue(a),
            updatedAt,
        }
    }
    if (isHDWalletAccount(a)) {
        if (!hd) return null
        return {
            type: BackupAccountType.hdWallet,
            address: a.address,
            seedFirstDerivedAddress: hd.seedFirstDerivedAddress,
            publicKey: hd.publicKeyHex,
            account: a.hdWalletDetails.account,
            change: a.hdWalletDetails.change,
            keyIndex: a.hdWalletDetails.keyIndex,
            derivationType: a.hdWalletDetails.derivationType,
            customName: nameValue(a),
            updatedAt,
        }
    }
    const exhaustive: never = a
    return exhaustive
}

export const serializeAccountItems = (
    account: WalletAccount,
    { updatedAt, secrets, hd, hashAddress }: SerializeParams,
): SerializedAccount | null => {
    const addressPayload = toAddressPayload(account, updatedAt, hd)
    if (addressPayload === null || !account.address) return null

    const address = {
        key: accountItemKey(hashAddress(account.address)),
        type: BackupItemType.ACCOUNT,
        payload: addressPayload,
    }
    const secretsItem = secrets
        ? {
              key: secretsItemKey(hashAddress(account.address)),
              type: BackupItemType.ACCOUNT,
              payload: secrets,
          }
        : null
    return { address, secrets: secretsItem }
}
