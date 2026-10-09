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

import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type {
    HardwareWalletAccount,
    MultiSigAccount,
    WalletAccount,
    WatchAccount,
} from './models'
import { accountsChainAdapters } from './chain-adapter'
import { chainAccountOf, hasCustody } from './credentials/accessors'

// Matches any `prefix...suffix`/`prefix…suffix` truncation of the address,
// not just our own format — legacy apps auto-named accounts with a 6+6
// truncation that migration carries over verbatim.
const TRUNCATION_SEPARATORS = ['...', '…'] as const

// Split on the first separator by index: a backtracking regex here runs in
// polynomial time on long names.
const splitTruncation = (name: string): [string, string] | undefined => {
    const cuts = TRUNCATION_SEPARATORS.flatMap(separator => {
        const at = name.indexOf(separator, 1)
        return at === -1 ? [] : [{ at, separator }]
    })
    if (cuts.length === 0) return undefined
    const { at, separator } = cuts.reduce((a, b) => (b.at < a.at ? b : a))
    const suffix = name.slice(at + separator.length)
    return suffix.length > 0 ? [name.slice(0, at), suffix] : undefined
}

const isTruncationOfAddress = (name: string, address: string) => {
    const parts = splitTruncation(name)
    if (!parts) return false
    const [prefix, suffix] = parts
    return (
        prefix.length + suffix.length < address.length &&
        address.startsWith(prefix) &&
        address.endsWith(suffix)
    )
}

/** The account's name, or its address on `chainId` truncated by the chain's codec when it has none. */
export const getAccountDisplayName = (
    account: Nullable<WalletAccount>,
    chainId: ChainId,
) => {
    if (!account) return 'No Account'
    const address = chainAccountOf(account, chainId)?.address
    if (!address) return account.name || 'No Address Found'
    // A name that is just the account's own address — full or any truncation of
    // it — isn't a distinguishing label. Treat it as unnamed so callers render
    // a single truncated address instead of the address twice.
    const isAddressName =
        !!account.name &&
        (account.name === address ||
            isTruncationOfAddress(account.name, address))
    if (account.name && !isAddressName) return account.name
    return addressCodecs.has(chainId)
        ? addressCodecs.get(chainId).truncate(address)
        : address
}

export const isHardwareWalletAccount = (
    account: WalletAccount,
): account is HardwareWalletAccount => hasCustody(account, 'hardware')

export const isLedgerAccount = (
    account: WalletAccount,
): account is HardwareWalletAccount =>
    isHardwareWalletAccount(account) &&
    account.custody.device.manufacturer === 'ledger'

/** Answers on the chain's selected network. False on a chain whose signing authority can't be delegated. */
export const isDelegatedAccount = (
    account: Nullable<WalletAccount>,
    chainId: ChainId,
): boolean =>
    !!account &&
    (accountsChainAdapters
        .get(chainId)
        .authority?.isDelegated(account, getSelectedScope(chainId)) ??
        false)

export const isWatchAccount = (
    account: WalletAccount,
): account is WatchAccount => hasCustody(account, 'watch')

export const isMultisigAccount = (
    account: WalletAccount,
): account is MultiSigAccount => hasCustody(account, 'multisig')

/** Whether the account holds a local key on any chain. */
export const hasSigningKeys = (account: WalletAccount): boolean =>
    Object.values(account.chains).some(entry => !!entry?.keyPairId)

/** Signing capability for a single account, without following rekeys. */
export const canSignDirectly = (account: WalletAccount): boolean =>
    hasSigningKeys(account) || isHardwareWalletAccount(account)

/**
 * Off-chain data has no auth-addr lookup — the dApp verifies against the
 * requested account's own pubkey — so rekey indirection is NOT followed: a
 * watch-rekeyed account cannot sign arbitrary data even with a local auth chain.
 */
export const canSignArbitraryData = (account: WalletAccount): boolean =>
    hasSigningKeys(account)

/** Answers on the chain's selected network. False on a chain that can't sign programs. */
export const canSignProgram = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    accountsChainAdapters
        .get(chainId)
        .authority?.canSignProgram(account, getSelectedScope(chainId)) ?? false

/** The account holding `address` on `chainId`, compared through the chain's codec. */
export const findAccountByAddressOn = (
    accounts: readonly WalletAccount[],
    chainId: ChainId,
    address: string,
): WalletAccount | undefined =>
    accounts.find(account => {
        const held = chainAccountOf(account, chainId)?.address
        return held !== undefined && isSameAddress(chainId, held, address)
    })

// A chain whose codec isn't registered (a build-gated chain) falls back to
// string equality rather than throwing on every account write.
export const isSameAddress = (
    chainId: ChainId,
    a: string,
    b: string,
): boolean =>
    addressCodecs.has(chainId)
        ? addressCodecs.get(chainId).areEqual(a, b)
        : a === b
