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
    type ImportAccountType,
    type WalletAccount,
} from './models'
import { MNEMONIC_WORD_COUNT } from './constants'
import { RekeyTargetNotFoundError } from './errors'

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

export const isHardwareWalletAccount = (
    account: WalletAccount,
): account is HardwareWalletAccount => {
    return account.type === AccountTypes.hardware
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

export const hasSigningKeys = (account: WalletAccount): boolean => {
    return !!account.keyPairId
}

export const canSignWithAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (hasSigningKeys(account)) return true
    if (account.rekeyAddress) {
        const authAccount = accounts.find(
            a => a.address === account.rekeyAddress,
        )
        if (authAccount) return canSignWithAccount(authAccount, accounts)
    }
    return false
}

export type AccountStatus =
    | 'standard'
    | 'ledger'
    | 'hardware'
    | 'watch'
    | 'noAuth'
    | 'rekeyedStandard'
    | 'rekeyedLedger'
    | 'rekeyedHardware'
    | 'hdWallet'
    | 'multisig'

export const resolveAccountStatus = (
    account: WalletAccount,
    accounts: WalletAccount[],
): AccountStatus => {
    if (isRekeyedAccount(account)) {
        const authAccount = accounts.find(
            a => a.address === account.rekeyAddress,
        )
        if (!authAccount) return 'noAuth'
        if (isLedgerAccount(authAccount)) return 'rekeyedLedger'
        if (isHardwareWalletAccount(authAccount)) return 'rekeyedHardware'
        return 'rekeyedStandard'
    }
    if (isHDWalletAccount(account)) return 'hdWallet'
    if (isMultisigAccount(account)) return 'multisig'
    if (isWatchAccount(account)) return 'watch'
    if (isLedgerAccount(account)) return 'ledger'
    if (isHardwareWalletAccount(account)) return 'hardware'
    if (isAlgo25Account(account)) return 'standard'
    return 'standard'
}

/**
 * Returns true if the account can sign transactions based on its
 * derived account status. Returns false for true watch accounts and
 * rekeyed accounts whose auth account is not present in the wallet (noAuth).
 */
export const isSigningAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    const status = resolveAccountStatus(account, accounts)
    return status !== 'watch' && status !== 'noAuth'
}

/**
 * Resolve the auth account for a given account.
 * If the account is rekeyed, returns the rekey target.
 * Only follows one level to prevent circular references.
 */
export const resolveAuthAccount = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): WalletAccount => {
    if (!account.rekeyAddress) {
        return account
    }

    const rekeyTarget = allAccounts.find(
        a => a.address === account.rekeyAddress,
    )

    if (!rekeyTarget) {
        throw new RekeyTargetNotFoundError(account.rekeyAddress)
    }

    return rekeyTarget
}

export type MnemonicAccountTypeResult =
    | { success: true; accountType: ImportAccountType }
    | { success: false; wordCount: number }

export const resolveImportAccountType = (
    mnemonic: string,
): MnemonicAccountTypeResult => {
    const wordCount = mnemonic.trim().split(/\s+/).length

    for (const [type, count] of Object.entries(MNEMONIC_WORD_COUNT)) {
        if (wordCount === count) {
            return { success: true, accountType: type as ImportAccountType }
        }
    }

    return { success: false, wordCount }
}
