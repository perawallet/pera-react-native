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
    truncateAlgorandAddress,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    AccountTypes,
    type BaseWalletAccount,
    type HardwareWalletAccount,
    type HDWalletAccount,
    type Algo25Account,
    type QuantumAccount,
    type MultiSigAccount,
    type WatchAccount,
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

export const isRekeyedAccount = (account: Nullable<WalletAccount>): boolean =>
    !!account?.rekeyAddress

export const isAlgo25Account = (
    account: WalletAccount,
): account is Algo25Account => {
    return account.type === AccountTypes.algo25
}

export const isQuantumAccount = (
    account: WalletAccount,
): account is QuantumAccount => {
    return account.type === AccountTypes.quantum
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
 * True iff `accounts` holds at least one of `participantAddresses` that can
 * sign with its own key (own keypair or hardware). Multisig signing is
 * propose-based, so one local signable participant is enough. A participant
 * counts only with its OWN key — slots bind to the participant's pubkey, so
 * rekey indirection is not followed and watch-only participants don't count.
 * Quantum participants don't count either: multisig slots verify Ed25519
 * signatures only, so a post-quantum key can never satisfy a slot.
 */
export const canSignViaParticipants = (
    participantAddresses: string[],
    accounts: WalletAccount[],
): boolean =>
    participantAddresses.some(addr => {
        const participant = accounts.find(a => a.address === addr)
        return (
            !!participant &&
            !isQuantumAccount(participant) &&
            canSignDirectly(participant)
        )
    })

/**
 * True iff `multisig` has at least one participant in `accounts` that can
 * sign with its own key. Multisig signing is propose-based, so a single
 * local signable participant is enough.
 */
const canSignViaMultisig = (
    multisig: MultiSigAccount,
    accounts: WalletAccount[],
): boolean =>
    canSignViaParticipants(multisig.multisigDetails.addresses, accounts)

/**
 * Tagged resolution of the signer. Use `getSignerFor` / `canSignWith` when
 * you only need the happy path; use the tagged form to branch on *why*
 * signing isn't possible.
 */
export type SignerResolution =
    | { kind: 'ok'; signer: WalletAccount }
    | { kind: 'accountNotFound' }
    | { kind: 'watch'; account: WalletAccount }
    | {
          kind: 'authMissing'
          account: WalletAccount
          authAddress: string
      }
    | { kind: 'authIsWatch'; account: WalletAccount; auth: WalletAccount }
    | {
          kind: 'authNoLocalParticipant'
          account: WalletAccount
          auth: MultiSigAccount
      }
    | { kind: 'noLocalParticipant'; account: MultiSigAccount }

/** Account-in-hand counterpart to {@link resolveSignerFor}. */
export const resolveSignerForAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): SignerResolution => {
    if (account.rekeyAddress) {
        const auth = accounts.find(a => a.address === account.rekeyAddress)
        if (!auth) {
            return {
                kind: 'authMissing',
                account,
                authAddress: account.rekeyAddress,
            }
        }
        if (isMultisigAccount(auth)) {
            return canSignViaMultisig(auth, accounts)
                ? { kind: 'ok', signer: auth }
                : { kind: 'authNoLocalParticipant', account, auth }
        }
        if (canSignDirectly(auth)) return { kind: 'ok', signer: auth }
        return { kind: 'authIsWatch', account, auth }
    }
    if (isMultisigAccount(account)) {
        return canSignViaMultisig(account, accounts)
            ? { kind: 'ok', signer: account }
            : { kind: 'noLocalParticipant', account }
    }
    if (canSignDirectly(account)) return { kind: 'ok', signer: account }
    return { kind: 'watch', account }
}

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
 * Tagged resolution of the signer for `address`. Single-hop only.
 */
export const resolveSignerFor = (
    address: string,
    accounts: WalletAccount[],
): SignerResolution => {
    const account = accounts.find(a => a.address === address)
    if (!account) return { kind: 'accountNotFound' }
    return resolveSignerForAccount(account, accounts)
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
 *
 * Use `resolveSignerFor` when the failure reason matters.
 */
export const getSignerFor = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const r = resolveSignerFor(address, accounts)
    return r.kind === 'ok' ? r.signer : null
}

/**
 * True when the wallet can produce signatures for `account`. Unlike
 * `getSignerFor`, this does not require `account` to be present in
 * `accounts` — pass the account in hand.
 */
export const canSignWith = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => resolveSignerForAccount(account, accounts).kind === 'ok'

/**
 * True iff the wallet can produce an arbitrary-data signature (algo_signData
 * / ARC-60) for `account`. The dApp verifies against the requested account's
 * own pubkey — there is no on-chain auth-addr lookup for off-chain data — so
 * we must sign with that account's own keypair. Rekey indirection is NOT
 * followed: a watch-rekeyed account cannot sign arbitrary data even when its
 * auth chain is locally held.
 *
 * Equivalent to `hasSigningKeys`: Algo25, HDWallet, and quantum accounts all
 * carry their own keyPairId. Hardware (no raw-byte opcode), multisig (no
 * signature shape), and watch accounts are naturally excluded.
 */
export const canSignArbitraryData = (account: WalletAccount): boolean =>
    hasSigningKeys(account)

/**
 * True iff the wallet can produce an ARC-60 signature for `account`, by
 * either of the two supported mechanisms:
 *
 * - a local key (Algo25 / HDWallet) signed via the KMS, or
 * - a Ledger device signed on-device via the hardware signing strategy.
 *
 * This is broader than {@link canSignArbitraryData} (which is local-key only)
 * because ARC-60 — unlike the legacy `algo_signData` path — also has an
 * on-device signing path. Watch and multisig accounts can do neither.
 */
export const canSignArc60 = (account: WalletAccount): boolean =>
    canSignArbitraryData(account) || isHardwareWalletAccount(account)

/**
 * True iff `account` is rekeyed and the wallet can't sign for the auth
 * chain. Distinguishes the "rekeyed but stranded" display state from a pure
 * `isWatchAccount`.
 */
export const isRekeyedUnsignable = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean =>
    !!account.rekeyAddress &&
    resolveSignerForAccount(account, accounts).kind !== 'ok'

/**
 * True iff `account` is a multisig account this wallet cannot sign for —
 * either a multisig with no local signable participant, or one rekeyed to an
 * account it can't sign for. Mirrors `isRekeyedUnsignable`: distinguishes the
 * "multisig we can't sign for" display state from a signable multisig.
 */
export const isMultisigUnsignable = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => isMultisigAccount(account) && !canSignWith(account, accounts)

/**
 * True iff the user can initiate a rekey from `account`. Aliased to
 * `canSignWith` — the rekey txn itself must be signed by the current auth
 * chain — but exported under the intent-revealing name.
 */
export const canInitiateRekey = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => canSignWith(account, accounts)

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
 * Source-account fields consulted for rekey-target eligibility: the source's
 * own address (rekeying to self is a no-op) and its current auth address
 * (re-rekeying to the existing auth is an equally pointless fee-burning
 * no-op). A full {@link WalletAccount} satisfies this shape.
 */
type RekeySourceFields = Pick<BaseWalletAccount, 'address' | 'rekeyAddress'>

/**
 * True when `target` may be chosen as the new auth address for a "rekey to
 * standard account" flow originating from `source`. Mirrors Android
 * `RekeyToStandardAccountSelectionPreviewUseCase.isAccountEligibleToRekey`:
 * the target must be a standard signing account (algo25 / HD wallet) or a
 * quantum account (the rekey-in migration path to post-quantum keys),
 * not the source itself, not the source's current auth, hold its own
 * signing keys, and not already be rekeyed away.
 *
 * Quantum targets are additionally gated on `isQuantumTargetEnabled` (the
 * quantum-accounts feature flag): until quantum signing ships (PQ-006),
 * rekeying to a quantum account is a one-way door — undo/re-rekey would
 * resolve a quantum auth that no signer supports yet.
 */
export const isEligibleRekeyTarget = (
    target: WalletAccount,
    source: RekeySourceFields,
    isQuantumTargetEnabled: boolean,
): boolean => {
    if (target.address === source.address) return false
    if (target.address === source.rekeyAddress) return false
    if (
        target.type !== AccountTypes.algo25 &&
        target.type !== AccountTypes.hdWallet &&
        target.type !== AccountTypes.quantum
    )
        return false
    if (target.type === AccountTypes.quantum && !isQuantumTargetEnabled)
        return false
    if (!hasSigningKeys(target)) return false
    if (isRekeyedAccount(target)) return false
    return true
}

/**
 * True when `account`'s effective signing authority is a quantum key — i.e.
 * following a single rekey hop lands on a quantum account. A broken auth chain
 * (the auth account is not held locally, so {@link resolveAuthAccount} throws)
 * is treated as non-quantum: we cannot assert protection we cannot resolve.
 */
const hasQuantumAuthority = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    try {
        return isQuantumAccount(resolveAuthAccount(account, accounts))
    } catch {
        return false
    }
}

/**
 * True iff rekeying `source` to `target` removes quantum protection: `source`'s
 * effective signing authority is quantum, but `target`'s is not (Ed25519 —
 * standard / ledger / multisig).
 *
 * Both sides are compared by *effective* authority (resolved through one rekey
 * hop), not raw account type, because that is where the protection actually
 * lives:
 * - An Ed25519 account rekeyed to a quantum auth (the rekey-in migration) is
 *   quantum-protected and IS downgraded when rekeyed back to Ed25519, even
 *   though its own `type` is still `algo25`.
 * - A quantum-typed account already rekeyed away to Ed25519 has no quantum
 *   protection left, so rekeying it further is NOT a downgrade.
 */
export const isQuantumDowngrade = (
    source: WalletAccount,
    target: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (!hasQuantumAuthority(source, accounts)) return false
    return !hasQuantumAuthority(target, accounts)
}

/**
 * True when `target` may be chosen as the new auth address for a "rekey to
 * Ledger account" flow originating from `source`. The target must be a
 * hardware wallet account already imported in the wallet, not the source
 * itself, not the source's current auth, and not already rekeyed away.
 */
export const isEligibleLedgerRekeyTarget = (
    target: WalletAccount,
    source: RekeySourceFields,
): boolean => {
    if (target.address === source.address) return false
    if (target.address === source.rekeyAddress) return false
    if (target.type !== AccountTypes.hardware) return false
    if (isRekeyedAccount(target)) return false
    return true
}

/**
 * True when `target` may be chosen as the new auth address for a "rekey to
 * shared (multisig) account" flow originating from `source`. The target
 * must be a multisig account in the wallet, not the source itself, not the
 * source's current auth, and not already rekeyed away.
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
    source: RekeySourceFields,
    allAccounts: WalletAccount[],
): boolean => {
    if (target.address === source.address) return false
    if (target.address === source.rekeyAddress) return false
    if (!isMultisigAccount(target)) return false
    if (isRekeyedAccount(target)) return false
    return canSignViaMultisig(target, allAccounts)
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

/**
 * Auto-detects the import account type from the mnemonic's word count.
 *
 * NOTE: quantum mnemonics are ALSO 25 words — indistinguishable from algo25
 * by count. 25 words deliberately resolves to algo25 (the insertion order of
 * MNEMONIC_WORD_COUNT guarantees it); quantum import never goes through
 * auto-detection, only through its dedicated entrypoint (PQ-009).
 */
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
