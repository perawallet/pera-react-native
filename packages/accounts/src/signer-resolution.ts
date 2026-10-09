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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { authorityOf } from './credentials'
import type { MultiSigAccount, WalletAccount } from './models'
import {
    findAccountByAddressOn,
    isMultisigAccount,
    isRekeyedAccount,
} from './utils'
import { DelegationTargetNotFoundError } from './errors'
import { accountsChainAdapters } from './chain-adapter'

/**
 * Every "who signs for this account" question derives from this resolution.
 * An account can span chains, so `chainId` names the chain the question is
 * asked on (the transaction's, or the active network's), and that chain's
 * adapter decides. It is answered on the chain's selected network.
 */
export type SignerResolution =
    | { kind: 'ok'; signer: WalletAccount }
    | { kind: 'accountNotFound' }
    | { kind: 'watch'; account: WalletAccount }
    | {
          kind: 'authMissing'
          account: WalletAccount
          authorityAddress: string
      }
    | { kind: 'authIsWatch'; account: WalletAccount; auth: WalletAccount }
    | {
          kind: 'authNoLocalParticipant'
          account: WalletAccount
          auth: MultiSigAccount
      }
    | { kind: 'noLocalParticipant'; account: MultiSigAccount }

/** `account` need not be present in `accounts`; its auth account must be. */
export const resolveSignerForAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): SignerResolution =>
    accountsChainAdapters
        .get(chainId)
        .resolveSigner(account, accounts, getSelectedScope(chainId))

export const resolveSignerFor = (
    address: string,
    accounts: WalletAccount[],
    chainId: ChainId,
): SignerResolution => {
    const account = findAccountByAddressOn(accounts, chainId, address)
    if (!account) return { kind: 'accountNotFound' }
    return resolveSignerForAccount(account, accounts, chainId)
}

/** The account that will produce signatures for `address`, or null. */
export const getSignerFor = (
    address: string,
    accounts: WalletAccount[],
    chainId: ChainId,
): WalletAccount | null => {
    const r = resolveSignerFor(address, accounts, chainId)
    return r.kind === 'ok' ? r.signer : null
}

/** Unlike `getSignerFor`, `account` need not be present in `accounts`. */
export const canSignWith = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): boolean => resolveSignerForAccount(account, accounts, chainId).kind === 'ok'

/**
 * The auth-addr account (itself when not rekeyed) with no signability check —
 * callers classify it themselves (watch, multisig, hardware). Null only when
 * the rekey target isn't held locally.
 */
export const getAuthAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): WalletAccount | null =>
    accountsChainAdapters
        .get(chainId)
        .getAuthAccount(account, accounts, getSelectedScope(chainId))

/**
 * Throwing form of {@link getAuthAccount}, for the signing path: throws
 * `DelegationTargetNotFoundError`, which the signing UI maps to a specific message.
 */
export const resolveAuthAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): WalletAccount => {
    const auth = getAuthAccount(account, accounts, chainId)
    if (auth) return auth
    throw new DelegationTargetNotFoundError(
        authorityOf(account, getSelectedScope(chainId)) ?? '',
    )
}

/**
 * The auth account only when `address` is rekeyed; null when it is not, when
 * it isn't held, or when its rekey target isn't held.
 */
export const getRekeyAccount = (
    address: string,
    accounts: WalletAccount[],
    chainId: ChainId,
): WalletAccount | null => {
    const account = findAccountByAddressOn(accounts, chainId, address)
    if (!account || !isRekeyedAccount(account, chainId)) return null
    return getAuthAccount(account, accounts, chainId)
}

/** The "rekeyed but stranded" display state, distinct from `isWatchAccount`. */
export const isRekeyedUnsignable = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): boolean =>
    isRekeyedAccount(account, chainId) &&
    !canSignWith(account, accounts, chainId)

/** Display-state counterpart to `isRekeyedUnsignable`. */
export const isMultisigUnsignable = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): boolean =>
    isMultisigAccount(account) && !canSignWith(account, accounts, chainId)

export type DelegateTransition = {
    /** The rekeyed account itself, not followed through the rekey. */
    from: WalletAccount
    /** The account it is now rekeyed to. */
    to: WalletAccount
}

/** Backs the UI's "Rekeyed (Signed by <to>)" label and its info-sheet copy. */
export const delegateTransitionFor = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): DelegateTransition | null => {
    if (!isRekeyedAccount(account, chainId)) return null
    const r = resolveSignerForAccount(account, accounts, chainId)
    return r.kind === 'ok' ? { from: account, to: r.signer } : null
}

/** False on a chain whose signing authority can't be delegated. */
export const isAuthorityDowngrade = (
    source: WalletAccount,
    target: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): boolean =>
    accountsChainAdapters
        .get(chainId)
        .authority?.isAuthorityDowngrade(
            source,
            target,
            accounts,
            getSelectedScope(chainId),
        ) ?? false
