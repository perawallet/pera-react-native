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

import type { MultiSigAccount, WalletAccount } from './models'
import {
    canSignDirectly,
    canSignViaParticipants,
    isMultisigAccount,
    isQuantumAccount,
} from './utils'
import { RekeyTargetNotFoundError } from './errors'

/**
 * Every "who signs for this account" question derives from this resolution.
 *
 * Rekey indirection follows exactly ONE hop: if A is rekeyed to B and B to C,
 * B still signs for A (A's auth-addr is literally B), so B's own rekey is
 * never followed. The same rule makes cyclic chains terminate.
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

type AuthHop =
    | { kind: 'self'; auth: WalletAccount }
    | { kind: 'rekeyed'; auth: WalletAccount }
    | { kind: 'authMissing'; authAddress: string }

/**
 * The one place the auth-addr hop is followed. Kept apart from the
 * signability check because the auth-account forms must not evaluate it:
 * legacy multisig records persisted without `multisigDetails` would throw.
 */
const followAuthHop = (
    account: WalletAccount,
    accounts: WalletAccount[],
): AuthHop => {
    if (!account.rekeyAddress) return { kind: 'self', auth: account }
    const auth = accounts.find(a => a.address === account.rekeyAddress)
    return auth
        ? { kind: 'rekeyed', auth }
        : { kind: 'authMissing', authAddress: account.rekeyAddress }
}

/** `account` need not be present in `accounts`; its auth account must be. */
export const resolveSignerForAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): SignerResolution => {
    const hop = followAuthHop(account, accounts)
    if (hop.kind === 'authMissing') {
        return { kind: 'authMissing', account, authAddress: hop.authAddress }
    }
    const { auth } = hop
    const isRekeyed = hop.kind === 'rekeyed'
    if (isMultisigAccount(auth)) {
        if (canSignViaParticipants(auth.multisigDetails.addresses, accounts)) {
            return { kind: 'ok', signer: auth }
        }
        return isRekeyed
            ? { kind: 'authNoLocalParticipant', account, auth }
            : { kind: 'noLocalParticipant', account: auth }
    }
    if (canSignDirectly(auth)) return { kind: 'ok', signer: auth }
    return isRekeyed
        ? { kind: 'authIsWatch', account, auth }
        : { kind: 'watch', account }
}

export const resolveSignerFor = (
    address: string,
    accounts: WalletAccount[],
): SignerResolution => {
    const account = accounts.find(a => a.address === address)
    if (!account) return { kind: 'accountNotFound' }
    return resolveSignerForAccount(account, accounts)
}

/** The account that will produce signatures for `address`, or null. */
export const getSignerFor = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const r = resolveSignerFor(address, accounts)
    return r.kind === 'ok' ? r.signer : null
}

/** Unlike `getSignerFor`, `account` need not be present in `accounts`. */
export const canSignWith = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => resolveSignerForAccount(account, accounts).kind === 'ok'

/**
 * The auth-addr account (itself when not rekeyed) with no signability check —
 * callers classify it themselves (watch, multisig, hardware). Null only when
 * the rekey target isn't held locally.
 */
export const getAuthAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const hop = followAuthHop(account, accounts)
    return hop.kind === 'authMissing' ? null : hop.auth
}

/**
 * Throwing form of {@link getAuthAccount}, for the signing path: throws
 * `RekeyTargetNotFoundError`, which the signing UI maps to a specific message.
 */
export const resolveAuthAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): WalletAccount => {
    const auth = getAuthAccount(account, accounts)
    if (!auth) {
        throw new RekeyTargetNotFoundError(account.rekeyAddress ?? '')
    }
    return auth
}

/**
 * The auth account only when `address` is rekeyed; null when it is not, when
 * it isn't held, or when its rekey target isn't held.
 */
export const getRekeyAccount = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const account = accounts.find(a => a.address === address)
    if (!account?.rekeyAddress) return null
    return getAuthAccount(account, accounts)
}

/** The "rekeyed but stranded" display state, distinct from `isWatchAccount`. */
export const isRekeyedUnsignable = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => !!account.rekeyAddress && !canSignWith(account, accounts)

/** Display-state counterpart to `isRekeyedUnsignable`. */
export const isMultisigUnsignable = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => isMultisigAccount(account) && !canSignWith(account, accounts)

/**
 * Aliases `canSignWith` — the rekey txn itself must be signed by the current
 * auth chain — under an intent-revealing name.
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

/** Backs the UI's "Rekeyed (Signed by <to>)" label and its info-sheet copy. */
export const rekeyTransitionFor = (
    account: WalletAccount,
    accounts: WalletAccount[],
): RekeyTransition | null => {
    if (!account.rekeyAddress) return null
    const r = resolveSignerForAccount(account, accounts)
    return r.kind === 'ok' ? { from: account.type, to: r.signer.type } : null
}

/**
 * A broken auth chain counts as non-quantum: we cannot assert protection we
 * cannot resolve.
 */
const hasQuantumAuthority = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    const auth = getAuthAccount(account, accounts)
    return !!auth && isQuantumAccount(auth)
}

/**
 * Compares *effective* authority (one rekey hop), not raw account type,
 * because that is where the protection lives:
 * - An Ed25519 account rekeyed to a quantum auth IS downgraded when rekeyed
 *   back to Ed25519, even though its own `type` is still `algo25`.
 * - A quantum-typed account already rekeyed away to Ed25519 has no protection
 *   left, so rekeying it further is NOT a downgrade.
 */
export const isQuantumDowngrade = (
    source: WalletAccount,
    target: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (!hasQuantumAuthority(source, accounts)) return false
    return !hasQuantumAuthority(target, accounts)
}
