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
    LEGACY_CHAIN_ID,
    type ChainId,
    type ChainScope,
    type StandaloneSecret,
} from '@perawallet/wallet-core-chain-contract'
import { resolveSeedKeyFrom } from '@perawallet/wallet-core-kms'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import type {
    AccountCustody,
    ChainAccount,
    HardwareRef,
    HdIndex,
    WalletAccount,
} from '../models'
import {
    authorityAddressOf,
    getAccountChainState,
} from '../store/accountChainState'
import type { KeystoreSnapshot } from './credentialScheme'

export const custodyOf = (account: WalletAccount): AccountCustody =>
    account.custody

export const hasCustody = <K extends AccountCustody['kind']>(
    account: WalletAccount,
    kind: K,
): account is WalletAccount & {
    custody: Extract<AccountCustody, { kind: K }>
} => account.custody.kind === kind

// The top-level address and key answer for the legacy chain only on a record
// that predates `chains`; once `chains` exists it is authoritative, so an
// account on another chain never reads as held on the legacy one.
export const chainAccountOf = (
    account: WalletAccount,
    chainId: ChainId,
): ChainAccount | undefined => {
    if (account.chains) return account.chains[chainId]
    if (chainId !== LEGACY_CHAIN_ID || account.address === undefined) {
        return undefined
    }
    return {
        address: account.address,
        ...(account.keyPairId !== undefined
            ? { keyPairId: account.keyPairId }
            : {}),
    }
}

/** Takes a scope so a chain whose encoding varies by network can answer per network. */
export const addressOn = (
    account: WalletAccount,
    scope: ChainScope,
): string | undefined => chainAccountOf(account, scope.chainId)?.address

export const signingKeyOn = (
    account: WalletAccount,
    chainId: ChainId,
): string | undefined => chainAccountOf(account, chainId)?.keyPairId

/** Whether any account in `accounts` signs with the KMS key `keyPairId`. */
export const isKeyReferenced = (
    accounts: readonly WalletAccount[],
    keyPairId: string,
): boolean =>
    accounts.some(
        account =>
            account.keyPairId === keyPairId ||
            Object.values(account.chains ?? {}).some(
                entry => entry?.keyPairId === keyPairId,
            ),
    )

export const hdIndexOf = (account: WalletAccount): HdIndex | undefined => {
    const { custody } = account
    return custody.kind === 'local' && custody.seed === 'bip39'
        ? custody.hd
        : undefined
}

/**
 * How a standalone account's secret is shown and backed up, read from the
 * chain it lives on. Undefined for any other account, or an unregistered chain.
 */
export const standaloneSecretOf = (
    account: WalletAccount,
): StandaloneSecret | undefined => {
    const { custody } = account
    if (custody.kind !== 'local' || custody.seed !== null) return undefined
    const chainId =
        (Object.keys(account.chains ?? {})[0] as ChainId | undefined) ??
        LEGACY_CHAIN_ID
    const { chains } = getProvider()
    return chains.has(chainId)
        ? chains.get(chainId).descriptor.signing.standaloneSecret
        : undefined
}

export const hardwareDeviceOf = (
    account: WalletAccount,
): { device: HardwareRef; accountIndex: number } | undefined => {
    const { custody } = account
    return custody.kind === 'hardware'
        ? { device: custody.device, accountIndex: custody.accountIndex }
        : undefined
}

/**
 * The KMS id of the seed behind the account's local keys, or `undefined` for
 * non-local custody or a key the snapshot lacks.
 */
export const seedOf = (
    account: WalletAccount,
    keys: KeystoreSnapshot = getKeystoreStore().state.keys,
): string | undefined => {
    const { custody } = account
    if (custody.kind !== 'local') return undefined
    const keyPairId =
        Object.values(account.chains ?? {}).find(entry => entry?.keyPairId)
            ?.keyPairId ?? account.keyPairId
    if (!keyPairId) return undefined
    try {
        return resolveSeedKeyFrom(keys, keyPairId).id
    } catch {
        return undefined
    }
}

/**
 * The address whose key authorises the account on `scope`, or `null` when it
 * signs for itself. Observed chain state, so it never joins the account record.
 */
export const authorityOf = (
    account: WalletAccount,
    scope: ChainScope,
): string | null => {
    const address = addressOn(account, scope)
    const state =
        address === undefined ? undefined : getAccountChainState(scope, address)
    return state ? authorityAddressOf(state) : null
}
