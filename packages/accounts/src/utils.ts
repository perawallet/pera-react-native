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

/**
 * True iff the wallet holds key material that produces a signature for
 * `account` directly: either its own key, or a Ledger device for hardware
 * accounts. Used by `getSignerFor` to test signing capability on a single
 * account without following rekeys.
 */
const canSignDirectly = (account: WalletAccount): boolean =>
    hasSigningKeys(account) || isHardwareWalletAccount(account)

/**
 * True iff `multisig` has at least one participant in `accounts` that can
 * sign with its own key. Multisig signing is propose-based, so a single
 * local signable participant is enough.
 */
const canSignViaMultisig = (
    multisig: MultiSigAccount,
    accounts: WalletAccount[],
): boolean =>
    multisig.multisigDetails.addresses.some(addr => {
        const participant = accounts.find(a => a.address === addr)
        return !!participant && canSignDirectly(participant)
    })

/**
 * Returns the auth account `address` is rekeyed to. Null when `address` is
 * not in the wallet, is not rekeyed, or its rekey target is not held locally.
 *
 * Use this for the immediate auth-addr relationship; for "who actually signs",
 * use `getSignerFor` which also accounts for multisig participant resolution
 * and signability.
 */
export const getRekeyAccount = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const account = accounts.find(a => a.address === address)
    if (!account?.rekeyAddress) return null
    return accounts.find(a => a.address === account.rekeyAddress) ?? null
}

/**
 * Returns the account that will produce signatures for `address` in this
 * wallet. Resolves a single rekey hop and multisig participation.
 *
 * - Address not in wallet → null
 * - Rekeyed, auth account locally signable → the auth account
 * - Rekeyed, auth account missing or not signable → null
 * - Multisig with at least one local signable participant → the multisig
 * - Standard/HD with its own key, or Hardware → the account itself
 * - Watch (not rekeyed) → null
 *
 * Single-hop only: cyclic and multi-hop auth chains are not followed.
 */
export const getSignerFor = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const account = accounts.find(a => a.address === address)
    if (!account) return null

    if (account.rekeyAddress) {
        const auth = accounts.find(a => a.address === account.rekeyAddress)
        if (!auth) return null
        if (canSignDirectly(auth)) return auth
        if (isMultisigAccount(auth) && canSignViaMultisig(auth, accounts))
            return auth
        return null
    }

    if (isMultisigAccount(account)) {
        return canSignViaMultisig(account, accounts) ? account : null
    }
    return canSignDirectly(account) ? account : null
}

/**
 * True when the wallet can produce signatures for `account`. Unlike
 * `getSignerFor`, this does not require `account` to be present in
 * `accounts` — pass the account in hand.
 */
export const canSignWith = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (account.rekeyAddress) {
        const auth = accounts.find(a => a.address === account.rekeyAddress)
        if (!auth) return false
        if (canSignDirectly(auth)) return true
        if (isMultisigAccount(auth)) return canSignViaMultisig(auth, accounts)
        return false
    }
    if (isMultisigAccount(account)) return canSignViaMultisig(account, accounts)
    return canSignDirectly(account)
}

export type RekeyTransition = {
    /** Raw type of the rekeyed account itself. */
    from: WalletAccount['type']
    /** Raw type of the account it is now rekeyed to. */
    to: WalletAccount['type']
}

/**
 * For a rekeyed account whose auth we can sign with, returns the types of the
 * rekeyed account and its immediate auth account, so the UI can render a
 * "Rekeyed (<from> to <to>)" label. Returns null when the account is not a
 * signable rekey, or when the auth account is not held locally.
 */
export const rekeyTransitionFor = (
    account: WalletAccount,
    accounts: WalletAccount[],
): RekeyTransition | null => {
    if (!account.rekeyAddress) return null
    const auth = accounts.find(a => a.address === account.rekeyAddress)
    if (!auth) return null
    if (!canSignWith(account, accounts)) return null
    return { from: account.type, to: auth.type }
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
 * True when `target` may be chosen as the new auth address for a "rekey to
 * shared (multisig) account" flow originating from `sourceAddress`. The
 * target must be a multisig account in the wallet, not the source itself,
 * and not already rekeyed away.
 *
 * Additionally requires the wallet to hold at least one participant that can
 * sign. Multisig signing is propose-based: a single local participant can
 * propose the transaction and the remaining signatures are collected from
 * co-signers. Holding zero signable participants would permanently lock the
 * source account — no one here could even propose. Holding fewer than
 * `threshold` is fine, so this only requires one.
 *
 * A participant counts only if it can sign with its OWN key
 * (`hasSigningKeys` or hardware) — multisig slots are bound to the
 * participant's own pubkey, so rekey indirection is not followed here.
 * Watch-only participants don't count.
 */
export const isEligibleSharedRekeyTarget = (
    target: WalletAccount,
    sourceAddress: string,
    allAccounts: WalletAccount[],
): boolean => {
    if (target.address === sourceAddress) return false
    if (target.type !== AccountTypes.multisig) return false
    if (target.rekeyAddress) return false

    const heldByAddress = new Map(allAccounts.map(a => [a.address, a]))
    const signableParticipants = target.multisigDetails.addresses.filter(
        addr => {
            const participant = heldByAddress.get(addr)
            return (
                !!participant &&
                (hasSigningKeys(participant) ||
                    isHardwareWalletAccount(participant))
            )
        },
    ).length
    if (signableParticipants < 1) return false

    return true
}

/**
 * Resolves the auth account that signs for `account` — a single rekey hop.
 *
 * On Algorand an account's `auth-addr` points at exactly one account, and
 * that account's own key is what signs. Rekey indirection is NOT transitive:
 * if A is rekeyed to B and B is rekeyed to C, B still signs for A (A's
 * auth-addr is literally B), and C signs for B. So this resolves one hop only.
 *
 * Returns the account itself when it is not rekeyed. Throws
 * `RekeyTargetNotFoundError` when the rekey target is not held in our local
 * view (the auth chain is broken from our perspective).
 */
export const resolveAuthAccount = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): WalletAccount => {
    if (!account.rekeyAddress) {
        return account
    }

    const authAccount = allAccounts.find(
        a => a.address === account.rekeyAddress,
    )
    if (!authAccount) {
        throw new RekeyTargetNotFoundError(account.rekeyAddress)
    }

    return authAccount
}

/**
 * Either an on-chain address, an internal account id, or both.
 * Lookups should match by address first and fall back to id, so callers
 * holding either field can resolve the same account.
 */
export type AccountKey = {
    address?: string
    id?: string
}

/**
 * Predicate that matches an account by address (preferred) or id (fallback).
 * Falsy fields are skipped; if both fields on the key are empty the predicate
 * matches nothing.
 */
export const matchesAccountKey =
    (key: AccountKey) =>
    (account: { address?: string; id?: string }): boolean =>
        (!!key.address && account.address === key.address) ||
        (!!key.id && account.id === key.id)

/**
 * Find a single account by address-or-id. Returns `undefined` when nothing
 * matches.
 */
export const findAccountByKey = <T extends { address?: string; id?: string }>(
    accounts: readonly T[],
    key: AccountKey,
): T | undefined => accounts.find(matchesAccountKey(key))

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
