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
    canSignDirectly,
    chainAccountOf,
    hasCustody,
    type AccountCustody,
    type LocalAccount,
    type LocalCustody,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'
import { ALGORAND_CHAIN_ID } from '../chain-id'

/** The account kinds Algorand distinguishes; the backup and devices wire formats spell them this way too. */
export const AccountTypes = {
    standalone: 'standalone',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    multisig: 'multisig',
    watch: 'watch',
    quantum: 'quantum',
} as const

export type AccountType = (typeof AccountTypes)[keyof typeof AccountTypes]

export const DerivationTypes = {
    Khovratovich: 32,
    Peikert: 9,
} as const

export type DerivationType =
    (typeof DerivationTypes)[keyof typeof DerivationTypes]

/** An HD account's coordinates as the backup wire format and legacy records spell them. */
export type HDWalletDetails = {
    account: number
    change: number
    keyIndex: number
    derivationType: DerivationType
}

/** A multisig account's parameters as legacy records and the backup wire format spell them. */
export type MultiSigDetails = {
    threshold: number
    addresses: string[]
    /** Algorand multisig version byte. Always 1 today. */
    version: number
}

type LocalAccountWithSeed<S extends LocalCustody['seed']> = LocalAccount & {
    custody: Extract<LocalCustody, { seed: S }>
}

/** Its key is the stored secret itself; nothing derives it. Algorand backs it with a 25-word phrase. */
export type StandaloneAccount = LocalAccountWithSeed<null>
export type QuantumAccount = LocalAccountWithSeed<typeof SeedScheme.Quantum>
export type HDWalletAccount = LocalAccountWithSeed<typeof SeedScheme.Bip39>

const SEEDED_ACCOUNT_TYPES = {
    [SeedScheme.Quantum]: AccountTypes.quantum,
    [SeedScheme.Bip39]: AccountTypes.hdWallet,
} as const satisfies Record<NonNullable<LocalCustody['seed']>, AccountType>

export const accountTypeOfCustody = (custody: AccountCustody): AccountType => {
    if (custody.kind !== 'local') return custody.kind
    return custody.seed === null
        ? AccountTypes.standalone
        : SEEDED_ACCOUNT_TYPES[custody.seed]
}

/** Rekey state is ignored: a watch account with an auth address stays `watch`. */
export const accountType = (account: WalletAccount): AccountType =>
    accountTypeOfCustody(account.custody)

const hasSeed =
    <S extends LocalCustody['seed']>(seed: S) =>
    (account: WalletAccount): account is LocalAccountWithSeed<S> =>
        hasCustody(account, 'local') && account.custody.seed === seed

export const isStandaloneAccount = hasSeed(null)
export const isQuantumAccount = hasSeed(SeedScheme.Quantum)
export const isHDWalletAccount = hasSeed(SeedScheme.Bip39)

/** The account's Algorand address, or `undefined` when it has no Algorand entry. */
export const algorandAddressOf = (account: WalletAccount): string | undefined =>
    chainAccountOf(account, ALGORAND_CHAIN_ID)?.address

/** The KMS key that signs for the account on Algorand, when a local one does. */
export const algorandKeyOf = (account: WalletAccount): string | undefined =>
    chainAccountOf(account, ALGORAND_CHAIN_ID)?.keyPairId

/**
 * Deliberately account-local: an ARC-60 signature verifies against `signer`'s
 * own public key, so a rekeyed signer holding no key of its own cannot be
 * signed for by its auth account (every verifier would reject the result). A
 * dApp that wants a rekeyed account authenticated names the auth address as
 * `signer` and the account as the SIWA `account_address`; the signing
 * package's `validateArc60AuthRequest` enforces that shape (a rekeyed account
 * may not sign for itself even when it still holds its key). Must stay in
 * lockstep with `resolveSigningAccount` in the signing package. Diverges from
 * arbitrary-data signing only in that ARC-60 also has an on-device Ledger
 * signing path.
 */
export const canSignArc60 = (account: WalletAccount): boolean =>
    canSignDirectly(account)
