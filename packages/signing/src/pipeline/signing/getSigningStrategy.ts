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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    hasSigningKeys,
    isLedgerAccount,
    isMultisigAccount,
    resolveAuthAccount,
} from '@perawallet/wallet-core-accounts'
import type { SigningStrategy } from '../types'
import { CannotSignError } from '../errors'
import {
    createLocalKeyStrategy,
    type LocalSigningFunction,
} from './createLocalKeyStrategy'
import { createHardwareStrategy } from './createHardwareStrategy'
import { createMultisigStrategy } from './createMultisigStrategy'

/**
 * Options for creating the signing strategy selector
 */
export interface GetSigningStrategyOptions {
    /** The signing function from useTransactionSigner */
    signTransactions: LocalSigningFunction

    /** Get local participants for a multisig account */
    getLocalParticipants: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ) => WalletAccount[]

    /** Get all user accounts */
    getAllAccounts: () => WalletAccount[]
}

/**
 * Creates a function that selects the appropriate signing strategy for an account.
 * This handles multisig detection, rekey resolution, and strategy selection.
 */
export const createSigningStrategySelector = (
    options: GetSigningStrategyOptions,
): ((
    account: WalletAccount,
    allAccounts: WalletAccount[],
) => SigningStrategy) => {
    const localStrategy = createLocalKeyStrategy(options.signTransactions)
    const hardwareStrategy = createHardwareStrategy()

    // The multisig strategy delegates back to selectStrategy for each
    // participant via a lazy callback, avoiding circular init issues.
    const multisigStrategy = createMultisigStrategy({
        getLocalParticipants: options.getLocalParticipants,
        getStrategyForParticipant: (participant, allAccounts) =>
            selectStrategy(participant, allAccounts),
        getAllAccounts: options.getAllAccounts,
    })

    const selectStrategy = (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ): SigningStrategy => {
        // Multisig accounts are handled by the multisig strategy
        if (isMultisigAccount(account)) {
            return multisigStrategy
        }

        // Follow rekey chain to find actual signer
        const actualSigner = resolveAuthAccount(account, allAccounts)

        // Select strategy based on actual signer type
        if (isLedgerAccount(actualSigner)) {
            return hardwareStrategy
        }

        if (hasSigningKeys(actualSigner)) {
            return localStrategy
        }

        throw new CannotSignError(
            account.address,
            `No signing capability found for account type: ${actualSigner.type}`,
        )
    }

    return selectStrategy
}
