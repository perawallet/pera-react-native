/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    AccountTypes,
    HardwareWalletAccount,
    HDWalletAccount,
    Algo25Account,
    MultiSigAccount,
    WatchAccount,
    type WalletAccount,
} from './models'
import { KeyType } from '@perawallet/wallet-core-kms'
import * as bip39 from 'bip39'

export type HDWalletKeyPair = {
    seed: Buffer
    entropy: string
    type: typeof KeyType.HDWalletRootKey
}

export const getAccountDisplayName = (account: WalletAccount | null) => {
    if (!account) return 'No Account'
    if (account.name) return account.name
    if (!account.address) return 'No Address Found'
    return truncateAlgorandAddress(account.address)
}

export const isHDWalletAccount = (
    account: WalletAccount,
): account is HDWalletAccount => {
    return account.type === AccountTypes.hdWallet
}

export const isLedgerAccount = (
    account: WalletAccount,
): account is HardwareWalletAccount => {
    return (
        account.type === AccountTypes.hardware &&
        account.hardwareDetails?.manufacturer === 'ledger'
    )
}

export const isRekeyedAccount = (account: WalletAccount) => {
    return !!account.rekeyAddress
}

export const isAlgo25Account = (
    account: WalletAccount,
): account is Algo25Account => {
    return account.type === AccountTypes.algo25
}

export const isWatchAccount = (
    account: WalletAccount,
): account is WatchAccount => {
    return account.type === AccountTypes.watch
}

export const isMultisigAccount = (
    account: WalletAccount,
): account is MultiSigAccount => {
    return account.type === AccountTypes.multisig
}

export const canSignWithAccount = (account: WalletAccount) => {
    return account.canSign
}

export const getSeedFromMasterKey = (keyData: Uint8Array) => {
    try {
        // Try to parse as JSON first (new format)
        const masterKey = JSON.parse(new TextDecoder().decode(keyData))
        return Buffer.from(masterKey.seed, 'base64')
    } catch {
        // Fall back to treating it as raw seed data (old format or tests)
        return Buffer.from(keyData)
    }
}

export const createHDWalletKeyDataFromMnemonic = async (
    mnemonic: string,
): Promise<HDWalletKeyPair> => {
    const seed = await bip39.mnemonicToSeed(mnemonic)
    const entropy = await bip39.mnemonicToEntropy(mnemonic)

    return {
        seed,
        entropy,
        type: KeyType.HDWalletRootKey,
    }
}
