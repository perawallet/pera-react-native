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
    authorityOf,
    AuthorityTargetCategories,
    hasSigningKeys,
    isHardwareWalletAccount,
    isMultisigAccount,
    type AccountAuthorityOps,
    type AuthorityTargetKind,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_SCOPES,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { hasLocalCoSigner } from './multisig-participants'
import { getAlgorandAuthAccount } from './signer-resolution'
import {
    algorandAddressOf,
    isStandaloneAccount,
    isHDWalletAccount,
    isQuantumAccount,
} from './vocabulary'

export const AlgorandAuthorityTargetKinds = {
    standard: 'standard',
    quantum: 'quantum',
    hardware: 'hardware',
    shared: 'shared',
} as const

const isDelegated = (account: WalletAccount, scope: ChainScope): boolean =>
    !!authorityOf(account, scope)

/**
 * Rekeying to self or to the current auth are both fee-burning no-ops, so
 * every kind starts from these exclusions.
 */
const isCurrentOrSelf = (
    target: WalletAccount,
    source: WalletAccount,
    scope: ChainScope,
): boolean => {
    const address = algorandAddressOf(target)
    return (
        address === algorandAddressOf(source) ||
        address === authorityOf(source, scope)
    )
}

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
    scope: ChainScope,
): boolean => {
    if (isCurrentOrSelf(target, source, scope)) return false
    if (!isStandaloneAccount(target) && !isHDWalletAccount(target)) return false
    if (!hasSigningKeys(target)) return false
    if (isDelegated(target, scope)) return false
    return true
}

/**
 * The `quantumAccounts` capability is a hard functional limit rather than a
 * rollout toggle. Signing works locally, but an algod that rejects the
 * `pqsig` field makes the rekey a one-way door that strands the funds: every
 * later transaction needs a `pqsig`, *including the rekey-back that would
 * undo it*.
 */
const isQuantumTargetEnabled = (): boolean => {
    const { chains } = getProvider()
    return (
        chains.has(ALGORAND_CHAIN_ID) &&
        chains.capabilities(ALGORAND_CHAIN_ID).quantumAccounts
    )
}

const isEligibleQuantumTarget = (
    target: WalletAccount,
    source: WalletAccount,
    scope: ChainScope,
): boolean => {
    if (!isQuantumTargetEnabled()) return false
    if (isCurrentOrSelf(target, source, scope)) return false
    if (!isQuantumAccount(target)) return false
    if (!hasSigningKeys(target)) return false
    if (isDelegated(target, scope)) return false
    return true
}

const isEligibleHardwareTarget = (
    target: WalletAccount,
    source: WalletAccount,
    scope: ChainScope,
): boolean => {
    if (isCurrentOrSelf(target, source, scope)) return false
    if (!isHardwareWalletAccount(target)) return false
    if (isDelegated(target, scope)) return false
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
    scope: ChainScope,
): boolean => {
    if (isCurrentOrSelf(target, source, scope)) return false
    if (!isMultisigAccount(target)) return false
    if (isDelegated(target, scope)) return false
    return hasLocalCoSigner(target, accounts)
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
 *   `hasSigningKeys`, because a chain entry's key is optional and a multisig
 *   account is only key-less by convention.
 * - Rekeyed accounts — deferred, not impossible. A delegated LSig authorizes
 *   spending, so the chain verifies it against the sender's auth-addr: the
 *   delegation is signable, but only by the auth account. Supporting that
 *   needs auth-account resolution in `useProgramSigner` (which signs with the
 *   sender's own key today) plus on-chain rekey verification in the AB and
 *   Pera backends — until then a rekeyed sender must be refused, whereas
 *   `canSignArbitraryData` deliberately ignores rekeys because off-chain data
 *   has no auth-addr lookup.
 */
const canSignProgram = (account: WalletAccount, scope: ChainScope): boolean =>
    !isHardwareWalletAccount(account) &&
    !isMultisigAccount(account) &&
    !isDelegated(account, scope) &&
    hasSigningKeys(account)

/**
 * Looks across every Algorand scope, not just the selected one: a mainnet
 * rekey still strands the mainnet account while the user is browsing testnet.
 */
const accountsDelegatedTo = (
    address: string,
    accounts: WalletAccount[],
): WalletAccount[] =>
    accounts.filter(
        a =>
            algorandAddressOf(a) !== address &&
            LEGACY_SCOPES.some(scope => authorityOf(a, scope) === address),
    )

const isEligibleTarget = (
    kindId: string,
    target: WalletAccount,
    source: WalletAccount,
    accounts: WalletAccount[],
    scope: ChainScope,
): boolean => {
    switch (kindId) {
        case AlgorandAuthorityTargetKinds.standard: {
            return isEligibleStandardTarget(target, source, scope)
        }
        case AlgorandAuthorityTargetKinds.quantum: {
            return isEligibleQuantumTarget(target, source, scope)
        }
        case AlgorandAuthorityTargetKinds.hardware: {
            return isEligibleHardwareTarget(target, source, scope)
        }
        case AlgorandAuthorityTargetKinds.shared: {
            return isEligibleSharedTarget(target, source, accounts, scope)
        }
        default: {
            return false
        }
    }
}

/**
 * A broken auth chain counts as non-quantum: we cannot assert protection we
 * cannot resolve.
 */
const hasQuantumAuthority = (
    account: WalletAccount,
    accounts: WalletAccount[],
    scope: ChainScope,
): boolean => {
    const auth = getAlgorandAuthAccount(account, accounts, scope)
    return !!auth && isQuantumAccount(auth)
}

/**
 * Compares *effective* authority (one rekey hop), not the account's own kind,
 * because that is where the protection lives:
 * - An Ed25519 account rekeyed to a quantum auth IS downgraded when rekeyed
 *   back to Ed25519, even though it is still an algo25 account.
 * - A quantum account already rekeyed away to Ed25519 has no protection
 *   left, so rekeying it further is NOT a downgrade.
 */
const isAuthorityDowngrade = (
    source: WalletAccount,
    target: WalletAccount,
    accounts: WalletAccount[],
    scope: ChainScope,
): boolean =>
    hasQuantumAuthority(source, accounts, scope) &&
    !hasQuantumAuthority(target, accounts, scope)

const TARGET_KINDS: readonly AuthorityTargetKind[] = [
    {
        id: AlgorandAuthorityTargetKinds.standard,
        category: AuthorityTargetCategories.standard,
    },
    {
        id: AlgorandAuthorityTargetKinds.quantum,
        category: AuthorityTargetCategories.quantum,
    },
    {
        id: AlgorandAuthorityTargetKinds.hardware,
        category: AuthorityTargetCategories.hardware,
    },
    {
        id: AlgorandAuthorityTargetKinds.shared,
        category: AuthorityTargetCategories.shared,
    },
]

export const algorandAuthority: AccountAuthorityOps = {
    targetKinds: TARGET_KINDS,
    isDelegated,
    accountsDelegatedTo,
    isEligibleTarget,
    canSignProgram,
    isAuthorityDowngrade,
}
