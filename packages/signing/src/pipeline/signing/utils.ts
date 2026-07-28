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

import type {
    WalletAccount,
    MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import {
    hasSigningKeys,
    isHardwareWalletAccount,
    isMultisigAccount,
    isQuantumAccount,
    RekeyTargetNotFoundError,
    resolveAuthAccount,
} from '@perawallet/wallet-core-accounts'
import { SignedTransaction } from 'algosdk'
import type { AnalyzedSignableGroup, SigningResult } from '../types'

/**
 * Get local participants for a multisig account, ordered by their position
 * in the multisig's `participantAddresses` (NOT wallet order).
 *
 * Stable participant-list order matters because `signers[0]` is used as the
 * proposer when calling the propose endpoint — wallet-dependent ordering
 * would make different devices pick different proposers for the same
 * multisig, which is undesirable. Mirrors Android's
 * `GetJointAccountProposerAddressUseCase`.
 *
 * Multisig participant slots are validated against the participant's original
 * pubkey at multisig creation; rekey of the participant address has no effect
 * on its multisig slot. So the participant must hold its OWN signing
 * capability (local key or hardware device) — rekey indirection is
 * intentionally NOT followed here. Hardware participants are included; the
 * strategy selector routes them to `hardwareStrategy`, which prompts the
 * connected Ledger device during signing.
 *
 * @param account - The multisig account
 * @param allAccounts - All accounts in the wallet
 * @returns Local accounts that are participants and can sign with their own
 *          keys (or via their backing hardware device), in participant-list
 *          order
 */
export const getLocalParticipants = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): WalletAccount[] => {
    if (!isMultisigAccount(account)) {
        return []
    }

    const multisigAccount = account as MultiSigAccount
    const participantAddresses = multisigAccount.multisigDetails.addresses

    return participantAddresses.flatMap(participantAddress => {
        const localAccount = allAccounts.find(
            a => a.address === participantAddress,
        )
        if (!localAccount) return []
        // Quantum participants are excluded even though they have signing
        // keys: multisig slots verify Ed25519 signatures only, and algosdk's
        // own PQ signer throws "FALCON-1024 does not support multisig
        // signing" — a quantum participant can never contribute a usable
        // subsignature. Mirrors canSignViaParticipants in
        // packages/accounts/src/utils.ts; keep both in agreement rather than
        // "fixing" this by admitting quantum instead.
        if (
            (!hasSigningKeys(localAccount) &&
                !isHardwareWalletAccount(localAccount)) ||
            isQuantumAccount(localAccount)
        )
            return []
        return [localAccount]
    })
}

/**
 * Subset of {@link getLocalParticipants} for the propose (Send) flow.
 *
 * Prefers local-key (Algo25 / HD) participants and skips hardware-wallet
 * participants so a Ledger device prompt never auto-fires during Send.
 * Hardware participants are deferred to the per-row Sign button in
 * `PendingSignaturesContent`, which the proposer can tap explicitly after
 * the propose call completes.
 *
 * Falls back to the full local-participant set (which may include hardware)
 * when the user has no local-key participant — the propose endpoint
 * requires at least one signature to create the backend record, so a
 * hardware-only proposer still needs the Ledger prompt to bootstrap.
 */
export const getProposeParticipants = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): WalletAccount[] => {
    const allLocal = getLocalParticipants(account, allAccounts)
    const localKey = allLocal.filter(p => !isHardwareWalletAccount(p))
    return localKey.length > 0 ? localKey : allLocal
}

/**
 * True if the propose call for this multisig should be deferred until the
 * user explicitly taps Sign on a hardware participant in the pending
 * signatures sheet — i.e. the user holds at least one hardware participant
 * and zero local-key participants in this multisig.
 *
 * When true, `multisigSignerActor` short-circuits and emits a synthetic
 * deferred SigningResult instead of running the strategy (which would
 * otherwise fire parallel Ledger prompts during Send and fail because a
 * single Ledger device can't serve multiple connections in parallel).
 *
 * Returns false for any non-multisig account or for multisigs where the
 * user has any local-key participant (in which case the local-key sigs
 * bootstrap the propose silently and the sheet opens behind the scenes).
 * Resolves a single rekey hop, mirroring `canMeetThresholdLocally`.
 */
export const shouldDeferPropose = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): boolean => {
    let target: WalletAccount
    try {
        target = resolveAuthAccount(account, allAccounts)
    } catch (e) {
        if (e instanceof RekeyTargetNotFoundError) return false
        throw e
    }
    if (!isMultisigAccount(target)) return false

    const localParticipants = getLocalParticipants(target, allAccounts)
    if (localParticipants.length === 0) return false
    return localParticipants.every(isHardwareWalletAccount)
}

/**
 * Produces an empty-signers `SigningResult` that signals the propose
 * transport to skip the backend propose call and create a local draft
 * instead. The unsigned transactions are carried in `signedData.signed[].txn`
 * so the transport can encode the raw bytes for the draft without needing
 * the original group passed through.
 */
export const buildDeferredProposeSigningResult = (
    group: AnalyzedSignableGroup,
): SigningResult => {
    if (group.data.type !== 'transactions') {
        throw new Error(
            'Deferred propose is only supported for transaction signing requests',
        )
    }
    return {
        signedData: {
            type: 'transactions',
            // The transport in deferred mode reads `stx.txn` only — no sig
            // or msig is needed because nothing is actually signed yet.
            signed: group.data.transactions.map(
                txn => new SignedTransaction({ txn }),
            ),
        },
        signers: [],
        originalIndices: group.originalIndices,
    }
}

/**
 * True iff a multisig has enough local participants to meet threshold.
 * Resolves a single rekey hop.
 */
export const canMeetThresholdLocally = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): boolean => {
    let target: WalletAccount
    try {
        target = resolveAuthAccount(account, allAccounts)
    } catch (e) {
        if (e instanceof RekeyTargetNotFoundError) return false
        throw e
    }
    if (!isMultisigAccount(target)) return false

    const localParticipants = getLocalParticipants(target, allAccounts)
    return localParticipants.length >= target.multisigDetails.threshold
}

/**
 * Get the number of additional signatures needed for a multisig transaction.
 *
 * @param account - The multisig account
 * @param existingSignatures - Number of existing signatures
 * @returns Number of additional signatures needed, or 0 if threshold met
 */
export const getSignaturesNeeded = (
    account: WalletAccount,
    existingSignatures: number,
): number => {
    if (!isMultisigAccount(account)) {
        return 0
    }

    const multisigAccount = account as MultiSigAccount
    const threshold = multisigAccount.multisigDetails.threshold

    return Math.max(0, threshold - existingSignatures)
}
