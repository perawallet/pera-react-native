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
} from '@perawallet/wallet-core-accounts'
import type { SigningStrategy } from '../types'
import { CannotSignError, RekeyTargetNotFoundError } from '../errors'
import {
    createLocalKeyStrategy,
    type LocalSigningFunction,
} from './createLocalKeyStrategy'
import { createHardwareStrategy } from './createHardwareStrategy'

/**
 * Options for creating the signing strategy selector
 */
export interface GetSigningStrategyOptions {
    /** The signing function from useTransactionSigner */
    signTransactions: LocalSigningFunction
}

/**
 * Creates a function that selects the appropriate signing strategy for an account.
 * This handles rekey resolution and strategy selection.
 */
export const createSigningStrategySelector = (
    options: GetSigningStrategyOptions,
): ((
    account: WalletAccount,
    allAccounts: WalletAccount[],
) => SigningStrategy) => {
    const localStrategy = createLocalKeyStrategy(options.signTransactions)
    const hardwareStrategy = createHardwareStrategy()

    return (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ): SigningStrategy => {
        // Follow rekey chain to find actual signer
        const actualSigner = resolveRekeyChain(account, allAccounts)

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
}

/**
 * Resolve rekey chain to find the account that actually signs.
 * Only follows one level to prevent circular references.
 */
export const resolveRekeyChain = (
    account: WalletAccount,
    allAccounts: WalletAccount[],
): WalletAccount => {
    if (!account.rekeyAddress) {
        return account
    }

    const rekeyTarget = allAccounts.find(
        a => a.address === account.rekeyAddress,
    )

    if (!rekeyTarget) {
        throw new RekeyTargetNotFoundError(account.rekeyAddress)
    }

    // Only follow one level to prevent circular refs
    return rekeyTarget
}

/**
 * Legacy export for backwards compatibility
 * @deprecated Use createSigningStrategySelector instead
 */
export const getSigningStrategy = createSigningStrategySelector
