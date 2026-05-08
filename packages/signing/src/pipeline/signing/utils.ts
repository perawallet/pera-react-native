/*
 Copyright 2022-2025 Pera Wallet, LDA
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
} from '@perawallet/wallet-core-accounts'

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
 * on its multisig slot. So the participant must hold its OWN local signing
 * keys — rekey indirection is intentionally NOT followed here. Hardware
 * participants are excluded (Ledger cosigning is deferred).
 *
 * @param account - The multisig account
 * @param allAccounts - All accounts in the wallet
 * @returns Local accounts that are participants and can sign with their own
 *          keys, in participant-list order
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
        if (!hasSigningKeys(localAccount)) return []
        if (isHardwareWalletAccount(localAccount)) return []
        return [localAccount]
    })
}

/**
 * Check if a multisig account has enough local participants to meet threshold.
 *
 * @param account - The multisig account
 * @param allAccounts - All accounts in the wallet
 * @returns True if threshold can be met with local accounts
 */
export const canMeetThresholdLocally = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): boolean => {
    if (!isMultisigAccount(account)) {
        return false
    }

    const multisigAccount = account as MultiSigAccount
    const localParticipants = getLocalParticipants(account, allAccounts)

    return localParticipants.length >= multisigAccount.multisigDetails.threshold
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
