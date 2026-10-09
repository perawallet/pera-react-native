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
    type BackupItemKind,
    type BackupLocalKind,
    type ChainBackupKind,
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
    isStandaloneAccount,
    isHDWalletAccount,
    isQuantumAccount,
} from '../accounts/vocabulary'

// Algorand HD accounts all derive on the external chain.
const HD_CHANGE = 0

/**
 * Algorand's own account-item kinds. Persisted wire values: every existing
 * cloud backup carries them, whatever the local kinds are called now.
 */
export const AlgorandBackupKinds = {
    standalone: 'algo25' as ChainBackupKind,
    quantum: 'quantum' as ChainBackupKind,
    hdAccount: 'hdWallet' as ChainBackupKind,
} as const

const nameValue = (account: WalletAccount): string | null =>
    account.name ?? null

export const serializeAlgorandAccount: BackupChainAdapter['serializeAccount'] =
    (account, { updatedAt, hd }): AddressBackupPayload | null => {
        const address = algorandAddressOf(account)
        if (!address) return null
        const customName = nameValue(account)
        if (isStandaloneAccount(account)) {
            return {
                type: AlgorandBackupKinds.standalone,
                address,
                customName,
                updatedAt,
            }
        }
        if (isQuantumAccount(account)) {
            return {
                type: AlgorandBackupKinds.quantum,
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
                type: AlgorandBackupKinds.hdAccount,
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
        return { type: AlgorandBackupKinds.quantum, mnemonic, address }
    }
    if (isStandaloneAccount(account)) {
        return { type: AlgorandBackupKinds.standalone, mnemonic, address }
    }
    return null
}

// Quantum accounts export the same 25-word recovery phrase format as algo25,
// so they back up through the identical key-scoped state.
export const algorandMnemonicBackupKeyId = (
    account: WalletAccount,
): string | null =>
    isStandaloneAccount(account) ||
    isHDWalletAccount(account) ||
    isQuantumAccount(account)
        ? (algorandKeyOf(account) ?? null)
        : null

// Maps, not object literals: a wire `type` is untrusted input, and an object
// lookup would answer for `constructor` and the other prototype keys.
const LOCAL_KIND_BY_WIRE_TYPE: ReadonlyMap<BackupItemKind, BackupLocalKind> =
    new Map<BackupItemKind, BackupLocalKind>([
        [AlgorandBackupKinds.standalone, { seed: null, isHd: false }],
        [
            AlgorandBackupKinds.quantum,
            { seed: SeedScheme.Quantum, isHd: false },
        ],
        [AlgorandBackupKinds.hdAccount, { seed: SeedScheme.Bip39, isHd: true }],
    ])

export const algorandBackupLocalKindOf: BackupChainAdapter['localKindOf'] =
    type => LOCAL_KIND_BY_WIRE_TYPE.get(type)

const KIND_ID_BY_WIRE_TYPE: ReadonlyMap<BackupItemKind, AccountType> = new Map<
    BackupItemKind,
    AccountType
>([
    [AlgorandBackupKinds.standalone, AccountTypes.standalone],
    [AlgorandBackupKinds.hdAccount, AccountTypes.hdWallet],
    [BackupAccountType.hardware, AccountTypes.hardware],
    [BackupAccountType.watch, AccountTypes.watch],
    [BackupAccountType.multisig, AccountTypes.multisig],
    [AlgorandBackupKinds.quantum, AccountTypes.quantum],
])

export const algorandBackupKindIdOf: BackupChainAdapter['kindIdOf'] = type =>
    KIND_ID_BY_WIRE_TYPE.get(type)
