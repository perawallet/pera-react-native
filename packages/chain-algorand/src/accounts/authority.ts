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
    canSignViaParticipants,
    hasSigningKeys,
    isAlgo25Account,
    isHardwareWalletAccount,
    isHDWalletAccount,
    isMultisigAccount,
    isQuantumAccount,
    type AccountAuthorityOps,
    type AuthorityTargetKind,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const isDelegated = (account: WalletAccount): boolean => !!account.rekeyAddress

/**
 * Rekeying to self or to the current auth are both fee-burning no-ops, so
 * every kind starts from these exclusions.
 */
const isCurrentOrSelf = (
    target: WalletAccount,
    source: WalletAccount,
): boolean =>
    target.address === source.address || target.address === source.rekeyAddress

/**
 * Mirrors Android
 * `RekeyToStandardAccountSelectionPreviewUseCase.isAccountEligibleToRekey`.
 *
 * Quantum accounts are excluded here: the dedicated rekey-to-quantum flow
 * lists them.
 */
const isEligibleStandardTarget = (
    target: WalletAccount,
    source: WalletAccount,
): boolean => {
    if (isCurrentOrSelf(target, source)) return false
    if (!isAlgo25Account(target) && !isHDWalletAccount(target)) return false
    if (!hasSigningKeys(target)) return false
    if (isDelegated(target)) return false
    return true
}

/**
 * `isQuantumTargetEnabled` is a hard functional limit rather than a rollout
 * toggle. Signing works locally, but mainnet and testnet algod still reject
 * the `pqsig` field, so on those networks the rekey is a one-way door that
 * strands the funds: every later transaction needs a `pqsig`, *including the
 * rekey-back that would undo it*.
 */
const isEligibleQuantumTarget = (
    target: WalletAccount,
    source: WalletAccount,
    isQuantumTargetEnabled: boolean,
): boolean => {
    if (!isQuantumTargetEnabled) return false
    if (isCurrentOrSelf(target, source)) return false
    if (!isQuantumAccount(target)) return false
    if (!hasSigningKeys(target)) return false
    if (isDelegated(target)) return false
    return true
}

const isEligibleHardwareTarget = (
    target: WalletAccount,
    source: WalletAccount,
): boolean => {
    if (isCurrentOrSelf(target, source)) return false
    if (!isHardwareWalletAccount(target)) return false
    if (isDelegated(target)) return false
    return true
}

/**
 * Requires one signable participant, not `threshold` of them: signing is
 * propose-based, so one local participant can propose and the rest are
 * collected from co-signers. Zero would permanently lock the source account.
 */
const isEligibleSharedTarget = (
    target: WalletAccount,
    source: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (isCurrentOrSelf(target, source)) return false
    if (!isMultisigAccount(target)) return false
    if (isDelegated(target)) return false
    return canSignViaParticipants(target.multisigDetails.addresses, accounts)
}

/**
 * Whether `account` can produce a *usable* delegated LogicSig (LSig / dLSig).
 *
 * Three exclusions:
 * - Hardware wallets — permanent. Not merely because they carry no
 *   `keyPairId`: their firmware signs transactions and ARC-60 payloads only,
 *   and will never sign a program. Unlike ARC-60, which Ledger does satisfy.
 * - Multisig — permanent for a *delegated* LSig, which carries a single
 *   `sigkey`: `encodeDelegatedLsigAccount` emits one signature, so a threshold
 *   account can never be represented. Stated explicitly rather than relying on
 *   `hasSigningKeys`, because `keyPairId` is optional on `BaseWalletAccount`
 *   and a multisig account is only key-less by convention.
 * - Rekeyed accounts — deferred, not impossible. A delegated LSig authorizes
 *   spending, so the chain verifies it against the sender's auth-addr: the
 *   delegation is signable, but only by the auth account. Supporting that
 *   needs auth-account resolution in `useProgramSigner` (which signs with the
 *   sender's own key today) plus on-chain rekey verification in the AB and
 *   Pera backends — until then a rekeyed sender must be refused, whereas
 *   `canSignArbitraryData` deliberately ignores rekeys because off-chain data
 *   has no auth-addr lookup.
 */
const canSignProgram = (account: WalletAccount): boolean =>
    !isHardwareWalletAccount(account) &&
    !isMultisigAccount(account) &&
    !isDelegated(account) &&
    hasSigningKeys(account)

/**
 * Looks at every network the wallet has observed, not just the active-network
 * `rekeyAddress` mirror: a mainnet rekey still strands the mainnet account
 * while the user is browsing testnet. The legacy mirror is kept in the check
 * for accounts persisted before `rekeyAddressByNetwork` existed.
 */
const accountsDelegatedTo = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount[] =>
    accounts.filter(
        a =>
            a.address !== address &&
            (a.rekeyAddress === address ||
                Object.values(a.rekeyAddressByNetwork ?? {}).includes(address)),
    )

const isEligibleTarget = (
    kind: AuthorityTargetKind,
    target: WalletAccount,
    source: WalletAccount,
    accounts: WalletAccount[],
    { isQuantumTargetEnabled }: { isQuantumTargetEnabled: boolean },
): boolean => {
    switch (kind) {
        case 'standard': {
            return isEligibleStandardTarget(target, source)
        }
        case 'quantum': {
            return isEligibleQuantumTarget(
                target,
                source,
                isQuantumTargetEnabled,
            )
        }
        case 'hardware': {
            return isEligibleHardwareTarget(target, source)
        }
        case 'shared': {
            return isEligibleSharedTarget(target, source, accounts)
        }
    }
}

export const algorandAuthority: AccountAuthorityOps = {
    isDelegated,
    accountsDelegatedTo,
    isEligibleTarget,
    canSignProgram,
}
