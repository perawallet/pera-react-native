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

import { AccountTypes, type WalletAccount } from './models'

export const AccountLogicalTypes = {
    Algo25: 'Algo25',
    HdKey: 'HdKey',
    LedgerBle: 'LedgerBle',
    Multisig: 'Multisig',
    Rekeyed: 'Rekeyed',
    RekeyedAuth: 'RekeyedAuth',
    NoAuth: 'NoAuth',
} as const

export type AccountLogicalType =
    (typeof AccountLogicalTypes)[keyof typeof AccountLogicalTypes]

const canSignDirectly = (account: WalletAccount): boolean =>
    !!account.keyPairId || account.type === AccountTypes.hardware

const canSignAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (canSignDirectly(account)) return true
    if (!account.rekeyAddress) return false
    const next = accounts.find(a => a.address === account.rekeyAddress)
    return next ? canSignAccount(next, accounts) : false
}

const baseTypeFor = (account: WalletAccount): AccountLogicalType => {
    switch (account.type) {
        case AccountTypes.hdWallet:
            return AccountLogicalTypes.HdKey
        case AccountTypes.hardware:
            return AccountLogicalTypes.LedgerBle
        case AccountTypes.multisig:
            return AccountLogicalTypes.Multisig
        case AccountTypes.algo25:
            return AccountLogicalTypes.Algo25
        case AccountTypes.watch:
            return AccountLogicalTypes.NoAuth
    }
}

/**
 * Derives the logical type of `account` given the full wallet list. The
 * account's `rekeyAddress` is kept in sync by `fetchAndPersistAccount`, so
 * it reflects the current on-chain auth address.
 *
 * Classification follows the Android `GetAccountTypeUseCase` rules with one
 * difference: the signing-capability check for the auth account is recursive
 * across the rekey chain, not single-hop.
 *   1. If rekeyed and the auth account resolves (through the chain) to a
 *      signer we hold → RekeyedAuth.
 *   2. If rekeyed and the auth account cannot sign:
 *        - original was watch → NoAuth
 *        - otherwise          → Rekeyed
 *   3. Otherwise → map from stored account type.
 */
export const deriveAccountLogicalType = (
    account: WalletAccount,
    accounts: WalletAccount[],
): AccountLogicalType => {
    const authAddress = account.rekeyAddress ?? null

    if (!authAddress) {
        return baseTypeFor(account)
    }

    const authAccount = accounts.find(a => a.address === authAddress)
    const authCanSign = authAccount
        ? canSignAccount(authAccount, accounts)
        : false

    if (authCanSign) {
        return AccountLogicalTypes.RekeyedAuth
    }

    if (account.type === AccountTypes.watch) {
        return AccountLogicalTypes.NoAuth
    }

    return AccountLogicalTypes.Rekeyed
}

/**
 * Convenience: true when the account can sign transactions in this wallet.
 * Matches `isSigningAccount` semantics — returns false for NoAuth and
 * Rekeyed (rekeyed but we don't hold the auth keys).
 */
export const isSigningLogicalType = (type: AccountLogicalType): boolean =>
    type !== AccountLogicalTypes.NoAuth && type !== AccountLogicalTypes.Rekeyed
