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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    AccountTypes,
    type AccountProvenance,
    type AccountType,
    type LocalProvenance,
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
import { accountsChainAdapters } from './chain-adapter'

// Matches any `prefix...suffix`/`prefix…suffix` truncation of the address,
// not just our own 5+5 format — legacy apps auto-named accounts with a 6+6
// truncation that migration carries over verbatim.
const isTruncationOfAddress = (name: string, address: string) => {
    const match = name.match(/^([A-Z2-7]+)(?:\.\.\.|…)([A-Z2-7]+)$/)
    if (!match) return false
    const [, prefix, suffix] = match
    return (
        prefix.length + suffix.length < address.length &&
        address.startsWith(prefix) &&
        address.endsWith(suffix)
    )
}

export const getAccountDisplayName = (account: Nullable<WalletAccount>) => {
    if (!account) return 'No Account'
    if (!account.address) return account.name || 'No Address Found'
    // A name that is just the account's own address — full or any truncation of
    // it — isn't a distinguishing label. Treat it as unnamed so callers render
    // a single truncated address instead of the address twice.
    const isAddressName =
        !!account.name &&
        (account.name === account.address ||
            isTruncationOfAddress(account.name, account.address))
    if (account.name && !isAddressName) return account.name
    return truncateAlgorandAddress(account.address)
}

const LOCAL_ACCOUNT_TYPES = {
    algo25: AccountTypes.algo25,
    quantum: AccountTypes.quantum,
    bip39: AccountTypes.hdWallet,
} as const satisfies Record<LocalProvenance['seed'], AccountType>

const accountTypeOf = (provenance: AccountProvenance): AccountType => {
    switch (provenance.kind) {
        case 'local': {
            return LOCAL_ACCOUNT_TYPES[provenance.seed]
        }
        case 'hardware': {
            return AccountTypes.hardware
        }
        case 'multisig': {
            return AccountTypes.multisig
        }
        case 'watch': {
            return AccountTypes.watch
        }
    }
}

/**
 * Rekey state is ignored: a watch account with an auth address stays `watch`.
 * A record the backfill left without a provenance keeps its stored `type`.
 */
export const accountType = (account: WalletAccount): AccountType =>
    account.provenance ? accountTypeOf(account.provenance) : account.type

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

/** False on a chain whose signing authority can't be delegated. */
export const isRekeyedAccount = (
    account: Nullable<WalletAccount>,
    chainId: ChainId,
): boolean =>
    !!account &&
    (accountsChainAdapters.get(chainId).authority?.isDelegated(account) ??
        false)

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

/** Signing capability for a single account, without following rekeys. */
export const canSignDirectly = (account: WalletAccount): boolean =>
    hasSigningKeys(account) || isHardwareWalletAccount(account)

/**
 * Multisig signing is propose-based, so one local signable participant is
 * enough. Slots bind to the participant's own pubkey, so rekey indirection is
 * not followed. Quantum participants never count — slots verify Ed25519 only.
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
 * Off-chain data has no auth-addr lookup — the dApp verifies against the
 * requested account's own pubkey — so rekey indirection is NOT followed: a
 * watch-rekeyed account cannot sign arbitrary data even with a local auth chain.
 */
export const canSignArbitraryData = (account: WalletAccount): boolean =>
    hasSigningKeys(account)

/**
 * Diverges from {@link canSignArbitraryData} only in that ARC-60 also has an
 * on-device Ledger signing path.
 *
 * Deliberately account-local: an ARC-60 signature verifies against `signer`'s
 * own public key, so a rekeyed signer holding no key of its own cannot be
 * signed for by its auth account (every verifier would reject the result). A
 * dApp that wants a rekeyed account authenticated names the auth address as
 * `signer` and the account as the SIWA `account_address`; the signing
 * package's `validateArc60AuthRequest` enforces that shape (a rekeyed account
 * may not sign for itself even when it still holds its key). Must stay in
 * lockstep with
 * `resolveSigningAccount` in the signing package.
 */
export const canSignArc60 = (account: WalletAccount): boolean =>
    canSignDirectly(account)

/** False on a chain that can't sign programs. */
export const canSignProgram = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    accountsChainAdapters.get(chainId).authority?.canSignProgram(account) ??
    false

/** An on-chain address, an internal account id, or both. */
export type AccountKey = {
    address?: string
    id?: string
}

/** Address takes precedence over id; an empty key matches nothing. */
export const matchesAccountKey =
    (key: AccountKey) =>
    (account: { address?: string; id?: string }): boolean =>
        (!!key.address && account.address === key.address) ||
        (!!key.id && account.id === key.id)

export const findAccountByKey = <T extends { address?: string; id?: string }>(
    accounts: readonly T[],
    key: AccountKey,
): T | undefined => accounts.find(matchesAccountKey(key))

export type MnemonicAccountTypeResult =
    | { success: true; accountType: ImportAccountType }
    | { success: false; wordCount: number }

/**
 * Quantum mnemonics are ALSO 25 words, so 25 deliberately resolves to algo25
 * (guaranteed by MNEMONIC_WORD_COUNT's insertion order). Quantum import never
 * goes through auto-detection, only its dedicated entrypoint.
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
