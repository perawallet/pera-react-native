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
    AccountChains,
    ChainAccount,
    HardwareWalletAccount,
    MultiSigAccount,
    WalletAccount,
    WatchAccount,
} from './models'
import { accountsChainAdapters } from './chain-adapter'
import {
    chainAccountOf,
    hardwareDeviceOf,
    hasCustody,
    hdIndexOf,
} from './credentials/accessors'

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

/**
 * The account's name is just its own address on one of its chains, full or
 * any `...`/`…` cut of it. That isn't a distinguishing label, so callers treat
 * the account as unnamed.
 */
export const isNamedAfterOwnAddress = (account: WalletAccount): boolean => {
    const { name } = account
    if (!name) return false
    return Object.values(account.chains).some(entry => {
        const address = entry?.address
        return (
            !!address &&
            (name === address || isTruncationOfAddress(name, address))
        )
    })
}

/**
 * The account's 1-based position in its seed or device, or `undefined` for
 * custody with no index. HD accounts sum both axes: the app advances one at a
 * time, so the other is 0 for every account it creates.
 */
export const accountNumberOf = (account: WalletAccount): number | undefined => {
    const hd = hdIndexOf(account)
    if (hd) return hd.account + hd.keyIndex + 1
    const hardware = hardwareDeviceOf(account)
    return hardware ? hardware.accountIndex + 1 : undefined
}

/** The account's name, or its address on `chainId` truncated by the chain's codec when it has none. */
export const getAccountDisplayName = (
    account: Nullable<WalletAccount>,
    chainId: ChainId,
) => {
    if (!account) return 'No Account'
    const address = chainAccountOf(account, chainId)?.address
    if (!address) return account.name || 'No Address Found'
    // Unnamed renders a single truncated address rather than the address twice.
    if (account.name && !isNamedAfterOwnAddress(account)) {
        return account.name
    }
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

/** Signing capability for a single account, without following its authority. */
export const canSignDirectly = (account: WalletAccount): boolean =>
    hasSigningKeys(account) || isHardwareWalletAccount(account)

/**
 * Off-chain data has no authority lookup (the dApp verifies against the
 * requested account's own pubkey), so delegation is NOT followed: a delegated
 * watch account cannot sign arbitrary data even when its authority is held.
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

/** The account holding `address` on any of its chains, compared per chain through that chain's codec. */
export const findAccountByAnyChainAddress = (
    accounts: readonly WalletAccount[],
    address: string,
): WalletAccount | undefined =>
    accounts.find(account =>
        (Object.keys(account.chains) as ChainId[]).some(chainId => {
            const held = chainAccountOf(account, chainId)?.address
            return held !== undefined && isSameAddress(chainId, held, address)
        }),
    )

const holdsAnEntryOf = (
    holder: WalletAccount,
    candidate: WalletAccount,
): boolean =>
    (Object.keys(candidate.chains) as ChainId[]).some(chainId => {
        const address = chainAccountOf(candidate, chainId)?.address
        const held = chainAccountOf(holder, chainId)?.address
        return (
            address !== undefined &&
            held !== undefined &&
            isSameAddress(chainId, held, address)
        )
    })

/**
 * What of an HD import candidate the wallet can still take, or `undefined`
 * when it is already held: an HD account at the candidate's index holds one of
 * its addresses (the same seed landed earlier, maybe with only some of them),
 * or other accounts hold every entry. Otherwise the entries another account
 * holds, such as a watched address or a raw-key import, are dropped, so they
 * don't block the rest of the candidate.
 */
export const importableCandidate = <A extends WalletAccount>(
    accounts: readonly WalletAccount[],
    candidate: A,
): A | undefined => {
    const index = hdIndexOf(candidate)
    const isHdHeld =
        index !== undefined &&
        accounts.some(account => {
            const held = hdIndexOf(account)
            return (
                held?.account === index.account &&
                held.keyIndex === index.keyIndex &&
                holdsAnEntryOf(account, candidate)
            )
        })
    if (isHdHeld) return undefined

    const free = (
        Object.entries(candidate.chains) as [
            ChainId,
            ChainAccount | undefined,
        ][]
    ).filter(
        ([chainId, entry]) =>
            entry !== undefined &&
            findAccountByAddressOn(accounts, chainId, entry.address) ===
                undefined,
    )
    if (free.length === 0) return undefined
    if (free.length === Object.keys(candidate.chains).length) return candidate
    return { ...candidate, chains: Object.fromEntries(free) as AccountChains }
}

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
