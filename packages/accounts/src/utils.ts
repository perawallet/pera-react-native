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
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    AccountTypes,
    type AccountCustody,
    type AccountType,
    type LocalCustody,
    type HardwareWalletAccount,
    type HDWalletAccount,
    type StandaloneAccount,
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
    quantum: AccountTypes.quantum,
    bip39: AccountTypes.hdWallet,
} as const satisfies Record<NonNullable<LocalCustody['seed']>, AccountType>

const accountTypeOf = (custody: AccountCustody): AccountType => {
    switch (custody.kind) {
        case 'local': {
            return custody.seed === null
                ? AccountTypes.standalone
                : LOCAL_ACCOUNT_TYPES[custody.seed]
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

/** Rekey state is ignored: a watch account with an auth address stays `watch`. */
export const accountType = (account: WalletAccount): AccountType =>
    accountTypeOf(account.custody)

export const isHDWalletAccount = (
    account: WalletAccount,
): account is HDWalletAccount => {
    return accountType(account) === AccountTypes.hdWallet
}

export const isHardwareWalletAccount = (
    account: WalletAccount,
): account is HardwareWalletAccount => {
    return accountType(account) === AccountTypes.hardware
}

export const isLedgerAccount = (
    account: WalletAccount,
): account is HardwareWalletAccount => {
    return (
        isHardwareWalletAccount(account) &&
        account.hardwareDetails?.manufacturer === 'ledger'
    )
}

/** Answers on the chain's selected network. False on a chain whose signing authority can't be delegated. */
export const isRekeyedAccount = (
    account: Nullable<WalletAccount>,
    chainId: ChainId,
): boolean =>
    !!account &&
    (accountsChainAdapters
        .get(chainId)
        .authority?.isDelegated(account, getSelectedScope(chainId)) ??
        false)

export const isStandaloneAccount = (
    account: WalletAccount,
): account is StandaloneAccount => {
    return accountType(account) === AccountTypes.standalone
}

export const isQuantumAccount = (
    account: WalletAccount,
): account is QuantumAccount => {
    return accountType(account) === AccountTypes.quantum
}

export const isWatchAccount = (
    account: WalletAccount,
): account is WatchAccount => {
    return accountType(account) === AccountTypes.watch
}

export const isMultisigAccount = (
    account: WalletAccount,
): account is MultiSigAccount => {
    return accountType(account) === AccountTypes.multisig
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

/** Answers on the chain's selected network. False on a chain that can't sign programs. */
export const canSignProgram = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    accountsChainAdapters
        .get(chainId)
        .authority?.canSignProgram(account, getSelectedScope(chainId)) ?? false

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
 * Quantum mnemonics are ALSO 25 words, so 25 deliberately resolves to
 * standalone (guaranteed by MNEMONIC_WORD_COUNT's insertion order). Quantum import never
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
