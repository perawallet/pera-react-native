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

import {
    truncateAlgorandAddress,
    type Nullable,
} from '@perawallet/wallet-core-shared'
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
import { deriveAccountLogicalType, isSigningLogicalType } from './logical-type'

export const getAccountDisplayName = (account: Nullable<WalletAccount>) => {
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

/**
 * True when `target` may be chosen as the new auth address for a "rekey to
 * standard account" flow originating from `sourceAddress`. Mirrors Android
 * `RekeyToStandardAccountSelectionPreviewUseCase.isAccountEligibleToRekey`:
 * the target must be a standard signing account (algo25 / HD wallet),
 * not the source itself, hold its own signing keys, and not already be
 * rekeyed away.
 */
export const isEligibleRekeyTarget = (
    target: WalletAccount,
    sourceAddress: string,
): boolean => {
    if (target.address === sourceAddress) return false
    if (
        target.type !== AccountTypes.algo25 &&
        target.type !== AccountTypes.hdWallet
    )
        return false
    if (!hasSigningKeys(target)) return false
    if (target.rekeyAddress) return false
    return true
}

/**
 * True when `target` may be chosen as the new auth address for a "rekey to
 * Ledger account" flow originating from `sourceAddress`. The target must be
 * a hardware wallet account already imported in the wallet, not the source
 * itself, and not already rekeyed away.
 */
export const isEligibleLedgerRekeyTarget = (
    target: WalletAccount,
    sourceAddress: string,
): boolean => {
    if (target.address === sourceAddress) return false
    if (target.type !== AccountTypes.hardware) return false
    if (target.rekeyAddress) return false
    return true
}

/**
 * Returns true if the account can sign transactions in this wallet. Delegates
 * to `deriveAccountLogicalType` — the single source of truth — so the result
 * is consistent with UI classification and the webview bridge payload.
 */
export const isSigningAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => isSigningLogicalType(deriveAccountLogicalType(account, accounts))

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
