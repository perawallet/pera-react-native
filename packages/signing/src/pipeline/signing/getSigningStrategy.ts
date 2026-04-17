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
    AuthAddressLookup,
} from '@perawallet/wallet-core-accounts'
import {
    hasSigningKeys,
    isHardwareWalletAccount,
    isMultisigAccount,
    resolveAuthAccount,
} from '@perawallet/wallet-core-accounts'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type { SigningStrategy } from '../types'
import { CannotSignError } from '../errors'
import {
    createLocalKeyStrategy,
    type LocalSigningFunction,
    type LocalArbitrarySigningFunction,
    type LocalArc60SigningFunction,
} from './createLocalKeyStrategy'
import {
    createHardwareStrategy,
    type EncodeTransactionFunction,
} from './createHardwareStrategy'
import { createMultisigStrategy } from './createMultisigStrategy'

/**
 * Options for creating the signing strategy selector
 */
export interface GetSigningStrategyOptions {
    /** Transaction signing function from useTransactionSigner */
    signTransactions: LocalSigningFunction

    /** Arbitrary-data signing function from useArbitraryDataSigner */
    signArbitraryData: LocalArbitrarySigningFunction

    /** ARC-60 signing function from useArc60Signer */
    signArc60: LocalArc60SigningFunction

    /** Get local participants for a multisig account */
    getLocalParticipants: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
        authAddresses: AuthAddressLookup,
    ) => WalletAccount[]

    /** Get all user accounts */
    getAllAccounts: () => WalletAccount[]

    /** Get the current on-chain auth-address lookup */
    getAuthAddresses: () => AuthAddressLookup

    /** Transaction encoder for hardware wallet signing */
    encodeTransaction: EncodeTransactionFunction

    /** Hardware wallet registry from platform extension (optional) */
    hardwareWalletRegistry?: HardwareWalletRegistry
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
    authAddresses: AuthAddressLookup,
) => SigningStrategy) => {
    const localStrategy = createLocalKeyStrategy({
        signTransactions: options.signTransactions,
        signArbitraryData: options.signArbitraryData,
        signArc60: options.signArc60,
    })
    const hardwareStrategy = createHardwareStrategy({
        hardwareWalletRegistry: options.hardwareWalletRegistry,
        encodeTransaction: options.encodeTransaction,
    })

    // The multisig strategy delegates back to selectStrategy for each
    // participant via a lazy callback, avoiding circular init issues.
    const multisigStrategy = createMultisigStrategy({
        getLocalParticipants: options.getLocalParticipants,
        getStrategyForParticipant: (participant, allAccounts, authAddresses) =>
            selectStrategy(participant, allAccounts, authAddresses),
        getAllAccounts: options.getAllAccounts,
        getAuthAddresses: options.getAuthAddresses,
    })

    const selectStrategy = (
        account: WalletAccount,
        allAccounts: WalletAccount[],
        authAddresses: AuthAddressLookup,
    ): SigningStrategy => {
        // Multisig accounts are handled by the multisig strategy
        if (isMultisigAccount(account)) {
            return multisigStrategy
        }

        // Follow rekey chain to find actual signer
        const actualSigner = resolveAuthAccount(
            account,
            allAccounts,
            authAddresses.get(account.address),
        )

        // Select strategy based on actual signer type
        if (isHardwareWalletAccount(actualSigner)) {
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
