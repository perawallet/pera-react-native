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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    chainAccountOf,
    resolveAuthAccount,
} from '@perawallet/wallet-core-accounts'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type { SigningStrategy } from '../types'
import { CannotSignError } from '../errors'
import {
    localKeySignerAdapterFor,
    plannerAdapterForScope,
    type LocalSigningFunction,
    type LocalArbitrarySigningFunction,
    type LocalAuthDataSigningFunction,
} from '../../chain-adapter'
import {
    createHardwareStrategy,
    type EncodeTransactionFunction,
} from './createHardwareStrategy'
import {
    resolveSignerCredential,
    type SignerCustody,
} from '../../machine/utils/resolveSignerCredential'

/**
 * Options for creating the signing strategy selector
 */
export interface GetSigningStrategyOptions {
    /** Transaction signing function from useLocalKeyTransactionSigner */
    signTransactions: LocalSigningFunction

    /** Arbitrary-data signing function from useArbitraryDataSigner */
    signArbitraryData: LocalArbitrarySigningFunction

    /** Auth-data signing function from useAuthDataSigner */
    signAuthData: LocalAuthDataSigningFunction

    /** Get local participants for a multisig account */
    getLocalParticipants: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ) => WalletAccount[]

    /** Get all user accounts */
    getAllAccounts: () => WalletAccount[]

    /** Transaction encoder for hardware wallet signing */
    encodeTransaction: EncodeTransactionFunction

    /** Hardware wallet registry from platform extension (optional) */
    hardwareWalletRegistry?: HardwareWalletRegistry

    /** Picks the chain whose local-key and multisig strategies are built. */
    scope: ChainScope
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
    const localStrategy = localKeySignerAdapterFor(
        options.scope,
    ).createStrategy({
        signTransactions: options.signTransactions,
        signArbitraryData: options.signArbitraryData,
        signAuthData: options.signAuthData,
        scope: options.scope,
    })
    const hardwareStrategy = createHardwareStrategy({
        hardwareWalletRegistry: options.hardwareWalletRegistry,
        encodeTransaction: options.encodeTransaction,
        getAllAccounts: options.getAllAccounts,
        chainId: options.scope.chainId,
    })

    const leafStrategyFor = (
        account: WalletAccount,
        custody: SignerCustody,
    ): SigningStrategy => {
        if (custody === 'hardware') return hardwareStrategy
        if (custody === 'local') return localStrategy
        throw new CannotSignError(
            chainAccountOf(account, options.scope.chainId)?.address ??
                account.id,
            `No signing capability found for account custody: ${custody}`,
        )
    }

    // Given an account that is already the resolved signing account
    // (i.e. rekey has been followed where applicable, or doesn't apply),
    // pick the strategy that produces its signature.
    const selectStrategyForAccount = (
        account: WalletAccount,
    ): SigningStrategy =>
        leafStrategyFor(
            account,
            resolveSignerCredential(account, options.scope.chainId).custody,
        )

    const multisigStrategy = plannerAdapterForScope(
        options.scope,
    ).createMultisigStrategy({
        getLocalParticipants: options.getLocalParticipants,
        // Multisig participant slots are bound to the participant's OWN pubkey
        // at multisig creation — rekey indirection is intentionally NOT
        // followed here, so we pass the participant straight to
        // `selectStrategyForAccount` instead of going through `selectStrategy`.
        getStrategyForParticipant: selectStrategyForAccount,
        getAllAccounts: options.getAllAccounts,
    })

    const selectStrategy = (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ): SigningStrategy => {
        // The AUTH account (single rekey hop; self for non-rekeyed accounts)
        // decides the strategy: a sender rekeyed on-chain to a multisig
        // routes to the multisig strategy exactly like a multisig sender —
        // the auth's template authorizes the transaction. The multisig
        // strategy re-resolves the hop itself, so passing the original
        // account to `sign` stays correct.
        const authAccount = resolveAuthAccount(
            account,
            allAccounts,
            options.scope.chainId,
        )
        const { custody } = resolveSignerCredential(
            authAccount,
            options.scope.chainId,
        )
        return custody === 'multisig'
            ? multisigStrategy
            : leafStrategyFor(authAccount, custody)
    }

    return selectStrategy
}
