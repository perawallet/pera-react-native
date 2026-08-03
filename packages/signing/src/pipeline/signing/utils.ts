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
    RekeyTargetNotFoundError,
    resolveAuthAccount,
} from '@perawallet/wallet-core-accounts'
import { SignedTransaction } from 'algosdk'
import type { AnalyzedSignableGroup, SigningResult } from '../types'

/**
 * Ordered by position in `participantAddresses`, NOT wallet order: `signers[0]`
 * becomes the proposer, so wallet-dependent ordering would make different
 * devices pick different proposers for the same multisig. Mirrors Android's
 * `GetJointAccountProposerAddressUseCase`.
 *
 * Slots are validated against the participant's pubkey at multisig creation,
 * so rekeying a participant doesn't affect its slot — rekey indirection is
 * deliberately NOT followed. Hardware participants are included; the strategy
 * selector routes them to `hardwareStrategy`.
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
        if (
            !hasSigningKeys(localAccount) &&
            !isHardwareWalletAccount(localAccount)
        )
            return []
        return [localAccount]
    })
}

/**
 * Skips hardware participants so a Ledger prompt never auto-fires during Send
 * — those defer to the per-row Sign button in `PendingSignaturesContent`.
 *
 * Falls back to the full set when there is no local-key participant: propose
 * needs at least one signature to create the backend record, so a
 * hardware-only proposer must still bootstrap via the Ledger prompt.
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
 * True when the user holds only hardware participants. `multisigSignerActor`
 * then emits a synthetic deferred SigningResult instead of running the
 * strategy, which would fire parallel Ledger prompts during Send and fail —
 * one Ledger can't serve multiple connections at once.
 *
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
 * Empty signers signal the propose transport to create a local draft instead
 * of calling the backend. Unsigned transactions ride along in
 * `signedData.signed[].txn` so the transport can encode the draft's raw bytes
 * without the original group being threaded through.
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

/** Resolves a single rekey hop. */
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

/** 0 once threshold is met. */
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
