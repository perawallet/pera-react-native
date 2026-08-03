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
    if (!account.address) return account.name || 'No Address Found'
    const truncated = truncateAlgorandAddress(account.address)
    // A name that is just the account's own address — full OR truncated — isn't
    // a distinguishing label. Treat it as unnamed so callers render a single
    // truncated address instead of the address twice.
    const isAddressName =
        account.name === account.address || account.name === truncated
    if (account.name && !isAddressName) return account.name
    return truncated
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

/** Signing capability for a single account, without following rekeys. */
const canSignDirectly = (account: WalletAccount): boolean =>
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

const canSignViaMultisig = (
    multisig: MultiSigAccount,
    accounts: WalletAccount[],
): boolean =>
    canSignViaParticipants(multisig.multisigDetails.addresses, accounts)

/** Use the tagged form to branch on *why* signing isn't possible. */
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
 * The immediate auth-addr relationship only. For "who actually signs", use
 * `getSignerFor` — it also resolves multisig participation and signability.
 */
export const getRekeyAccount = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const account = accounts.find(a => a.address === address)
    if (!account?.rekeyAddress) return null
    return accounts.find(a => a.address === account.rekeyAddress) ?? null
}

/** Single-hop only. */
export const resolveSignerFor = (
    address: string,
    accounts: WalletAccount[],
): SignerResolution => {
    const account = accounts.find(a => a.address === address)
    if (!account) return { kind: 'accountNotFound' }
    return resolveSignerForAccount(account, accounts)
}

/**
 * The account that will produce signatures for `address`, or null. Single-hop
 * only: cyclic and multi-hop auth chains are not followed. Use
 * `resolveSignerFor` when the failure reason matters.
 */
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
 * Off-chain data has no auth-addr lookup — the dApp verifies against the
 * requested account's own pubkey — so rekey indirection is NOT followed: a
 * watch-rekeyed account cannot sign arbitrary data even with a local auth chain.
 */
export const canSignArbitraryData = (account: WalletAccount): boolean =>
    hasSigningKeys(account)

/**
 * Broader than {@link canSignArbitraryData} because ARC-60 — unlike the legacy
 * `algo_signData` path — also has an on-device Ledger signing path.
 */
export const canSignArc60 = (account: WalletAccount): boolean =>
    canSignArbitraryData(account) || isHardwareWalletAccount(account)

/**
 * Whether `account` can sign a LogicSig *program* (delegated LSig / dLSig),
 * which requires the raw private key. Hardware wallets are excluded by design,
 * not merely because they carry no `keyPairId`: their firmware signs
 * transactions and ARC-60 payloads only, and will never sign a program. That
 * makes this a permanent limitation, unlike {@link canSignArc60}, which Ledger
 * does satisfy.
 */
export const canSignProgram = (account: WalletAccount): boolean =>
    !isHardwareWalletAccount(account) && hasSigningKeys(account)

/** The "rekeyed but stranded" display state, distinct from `isWatchAccount`. */
export const isRekeyedUnsignable = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean =>
    !!account.rekeyAddress &&
    resolveSignerForAccount(account, accounts).kind !== 'ok'

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

/** Backs the UI's "Rekeyed (<from> to <to>)" label. */
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
 * Rekeying to self or to the current auth are both fee-burning no-ops, so
 * eligibility needs both fields. A full {@link WalletAccount} satisfies this.
 */
type RekeySourceFields = Pick<BaseWalletAccount, 'address' | 'rekeyAddress'>

/**
 * Mirrors Android
 * `RekeyToStandardAccountSelectionPreviewUseCase.isAccountEligibleToRekey`.
 *
 * Quantum targets are gated on `isQuantumTargetEnabled`: until quantum signing
 * ships (PQ-006), rekeying to a quantum account is a one-way door — undo would
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
 * A broken auth chain ({@link resolveAuthAccount} throws) counts as
 * non-quantum: we cannot assert protection we cannot resolve.
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
 * Requires one signable participant, not `threshold` of them: signing is
 * propose-based, so one local participant can propose and the rest are
 * collected from co-signers. Zero would permanently lock the source account.
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
 * Single hop, because rekey indirection is NOT transitive: if A is rekeyed to
 * B and B to C, B still signs for A (A's auth-addr is literally B).
 *
 * Throws `RekeyTargetNotFoundError` when the rekey target isn't held locally.
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
 * goes through auto-detection, only its dedicated entrypoint (PQ-009).
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
