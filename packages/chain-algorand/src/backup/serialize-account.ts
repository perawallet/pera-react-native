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
    hdIndexOf,
    isHardwareWalletAccount,
    isMultisigAccount,
    isWatchAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    BackupAccountType,
    type AddressBackupPayload,
    type BackupChainAdapter,
    type BackupLocalKind,
    type SecretsBackupPayload,
} from '@perawallet/wallet-core-backup'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'
import { ALGORAND_HD_DERIVATION_TYPE } from '../accounts/constants'
import { algorandMultisigOf } from '../accounts/multisig-participants'
import {
    AccountTypes,
    algorandAddressOf,
    algorandKeyOf,
    type AccountType,
    isAlgo25Account,
    isHDWalletAccount,
    isQuantumAccount,
} from '../accounts/vocabulary'

// Algorand HD accounts all derive on the external chain.
const HD_CHANGE = 0

const nameValue = (account: WalletAccount): string | null =>
    account.name ?? null

export const serializeAlgorandAccount: BackupChainAdapter['serializeAccount'] =
    (account, { updatedAt, hd }): AddressBackupPayload | null => {
        const address = algorandAddressOf(account)
        if (!address) return null
        const customName = nameValue(account)
        if (isAlgo25Account(account)) {
            return {
                type: BackupAccountType.algo25,
                address,
                customName,
                updatedAt,
            }
        }
        if (isQuantumAccount(account)) {
            return {
                type: BackupAccountType.quantum,
                address,
                customName,
                updatedAt,
            }
        }
        if (isWatchAccount(account)) {
            return {
                type: BackupAccountType.watch,
                address,
                customName,
                updatedAt,
            }
        }
        if (isHardwareWalletAccount(account)) {
            const { device, accountIndex } = account.custody
            return {
                type: BackupAccountType.hardware,
                address,
                deviceId: device.deviceId,
                deviceName: device.deviceName,
                accountIndex,
                manufacturer: device.manufacturer,
                transportType: device.transportType,
                customName,
                updatedAt,
            }
        }
        if (isMultisigAccount(account)) {
            // A legacy multisig without its parameters can't be restored from
            // its item, so it waits for the backfill rather than being written.
            const multisig = algorandMultisigOf(account)
            if (!multisig) return null
            return {
                type: BackupAccountType.multisig,
                address,
                participantAddresses: multisig.addresses,
                threshold: multisig.threshold,
                version: multisig.version,
                customName,
                updatedAt,
            }
        }
        const index = hdIndexOf(account)
        if (isHDWalletAccount(account) && index) {
            if (!hd) return null
            return {
                type: BackupAccountType.hdAccount,
                address,
                seedFirstDerivedAddress: hd.seedFirstDerivedAddress,
                publicKey: hd.publicKeyHex,
                account: index.account,
                change: HD_CHANGE,
                keyIndex: index.keyIndex,
                derivationType: ALGORAND_HD_DERIVATION_TYPE,
                customName,
                updatedAt,
            }
        }
        return null
    }

export const serializeAlgorandMnemonicSecret = (
    account: WalletAccount,
    mnemonic: string,
): SecretsBackupPayload | null => {
    const address = algorandAddressOf(account)
    if (!address) return null
    if (isQuantumAccount(account)) {
        return { type: BackupAccountType.quantum, mnemonic, address }
    }
    if (isAlgo25Account(account)) {
        return { type: BackupAccountType.algo25, mnemonic, address }
    }
    return null
}

// Quantum accounts export the same 25-word recovery phrase format as algo25,
// so they back up through the identical key-scoped state.
export const algorandMnemonicBackupKeyId = (
    account: WalletAccount,
): string | null =>
    isAlgo25Account(account) ||
    isHDWalletAccount(account) ||
    isQuantumAccount(account)
        ? (algorandKeyOf(account) ?? null)
        : null

const LOCAL_KIND_BY_WIRE_TYPE: Partial<
    Record<BackupAccountType, BackupLocalKind>
> = {
    [BackupAccountType.algo25]: { seed: SeedScheme.Algo25, isHd: false },
    [BackupAccountType.quantum]: { seed: SeedScheme.Quantum, isHd: false },
    [BackupAccountType.hdAccount]: { seed: SeedScheme.Bip39, isHd: true },
}

export const algorandBackupLocalKindOf: BackupChainAdapter['localKindOf'] =
    type => LOCAL_KIND_BY_WIRE_TYPE[type]

const KIND_ID_BY_WIRE_TYPE: Partial<Record<BackupAccountType, AccountType>> = {
    [BackupAccountType.algo25]: AccountTypes.algo25,
    [BackupAccountType.hdAccount]: AccountTypes.hdWallet,
    [BackupAccountType.hardware]: AccountTypes.hardware,
    [BackupAccountType.watch]: AccountTypes.watch,
    [BackupAccountType.multisig]: AccountTypes.multisig,
    [BackupAccountType.quantum]: AccountTypes.quantum,
}

export const algorandBackupKindIdOf: BackupChainAdapter['kindIdOf'] = type =>
    KIND_ID_BY_WIRE_TYPE[type]
