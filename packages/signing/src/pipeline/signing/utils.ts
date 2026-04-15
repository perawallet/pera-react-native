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
    AuthAddressLookup,
} from '@perawallet/wallet-core-accounts'
import {
    isMultisigAccount,
    canSignWithAccount,
} from '@perawallet/wallet-core-accounts'

/**
 * Get local participants for a multisig account.
 * These are accounts in the user's wallet that are part of the multisig
 * and have signing capability.
 *
 * @param account - The multisig account
 * @param allAccounts - All accounts in the wallet
 * @returns Array of local accounts that can sign for this multisig
 */
export const getLocalParticipants = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
    authAddresses: AuthAddressLookup,
): WalletAccount[] => {
    if (!isMultisigAccount(account)) {
        return []
    }

    const multisigAccount = account as MultiSigAccount
    const participantAddresses = multisigAccount.multisigDetails.addresses

    // Find local accounts that are participants and can sign
    return allAccounts.filter(localAccount => {
        // Check if this account is a participant
        const isParticipant = participantAddresses.includes(
            localAccount.address,
        )
        if (!isParticipant) {
            return false
        }

        // Check if this account can sign (has keys or is rekeyed to an account with keys)
        return canSignWithAccount(localAccount, allAccounts, authAddresses)
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
    authAddresses: AuthAddressLookup,
): boolean => {
    if (!isMultisigAccount(account)) {
        return false
    }

    const multisigAccount = account as MultiSigAccount
    const localParticipants = getLocalParticipants(
        account,
        allAccounts,
        authAddresses,
    )

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
