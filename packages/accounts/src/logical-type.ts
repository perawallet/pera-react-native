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

/**
 * True when `account` is a multisig the wallet can sign for: it holds at
 * least one participant that can sign with its own key. Multisig signing is
 * propose-based, so a single local participant is enough — mirrors the
 * `getLocalParticipants` rule in the signing pipeline.
 */
const canSignViaMultisig = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (account.type !== AccountTypes.multisig) return false
    return account.multisigDetails.addresses.some(participantAddress => {
        const participant = accounts.find(a => a.address === participantAddress)
        return !!participant && canSignDirectly(participant)
    })
}

export const baseTypeFor = (account: WalletAccount): AccountLogicalType => {
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
 * Classification:
 *   1. If rekeyed and the immediate auth account is one we can sign with —
 *      a key we hold, or a multisig we hold a signable participant of →
 *      RekeyedAuth.
 *   2. If rekeyed but we can't sign with the immediate auth account →
 *      Rekeyed. (Applies regardless of whether the original account was a
 *      watch — what matters visually is that the account IS rekeyed; the
 *      "can we sign?" answer surfaces at submission time via algod.)
 *   3. Otherwise → map from stored account type. Watch accounts that are
 *      not rekeyed still classify as NoAuth.
 *
 * The signing-capability check is a single rekey hop: rekey indirection is
 * not transitive, so we only consult the immediate auth account.
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
        ? canSignDirectly(authAccount) ||
          canSignViaMultisig(authAccount, accounts)
        : false

    return authCanSign
        ? AccountLogicalTypes.RekeyedAuth
        : AccountLogicalTypes.Rekeyed
}

/**
 * Convenience: true when the account can sign transactions in this wallet.
 * Matches `isSigningAccount` semantics — returns false for NoAuth and
 * Rekeyed (rekeyed but we don't hold the auth keys).
 */
export const isSigningLogicalType = (type: AccountLogicalType): boolean =>
    type !== AccountLogicalTypes.NoAuth && type !== AccountLogicalTypes.Rekeyed

export type RekeyTransition = {
    /** Base type of the rekeyed account itself. */
    from: AccountLogicalType
    /** Base type of the account it is now rekeyed to. */
    to: AccountLogicalType
}

/**
 * For a signable rekeyed account (`RekeyedAuth`), returns the base type of the
 * account and of its immediate auth account, so the UI can render a
 * "Rekeyed (<from> to <to>)" label. Returns null when the account is not a
 * signable rekey, or when the auth account is not held in this wallet (e.g. a
 * multi-hop chain where the immediate auth address is unknown locally).
 */
export const rekeyTransitionFor = (
    account: WalletAccount,
    accounts: WalletAccount[],
): RekeyTransition | null => {
    if (
        deriveAccountLogicalType(account, accounts) !==
        AccountLogicalTypes.RekeyedAuth
    ) {
        return null
    }
    if (!account.rekeyAddress) return null

    const authAccount = accounts.find(a => a.address === account.rekeyAddress)
    if (!authAccount) return null

    return {
        from: baseTypeFor(account),
        to: baseTypeFor(authAccount),
    }
}
