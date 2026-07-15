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
    getSignerFor,
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { calculateMinTxnFee } from '@perawallet/wallet-core-blockchain'

export type ResolveMinFeeForSenderParams = {
    /** Address of the transaction sender */
    senderAddress: string
    /** All wallet accounts, used to resolve the effective signer (auth account) */
    accounts: WalletAccount[]
    /** Network suggested minimum fee in µAlgo (algod suggestedParams.minFee) */
    suggestedMinFee: bigint
    /** Remote-config base minimum txn fee in µAlgo (useMinimumFeeConfig().minTxnFee) */
    configMinTxnFee: bigint
    /** Remote-config PQ fee multiplier (useMinimumFeeConfig().pqMultiplier) */
    pqMultiplier: bigint
}

/**
 * Resolves the minimum fee in µAlgo a transaction sent by `senderAddress`
 * must carry, accounting for post-quantum signers.
 *
 * The effective signer is resolved via `getSignerFor`, so a rekeyed sender
 * pays according to its auth account's type. Senders not in the wallet or
 * without a resolvable signer (watch accounts, missing auth) fall back to
 * the non-quantum base fee.
 *
 * Congestion guard: the base is `max(suggestedMinFee, configMinTxnFee)` and
 * the PQ multiplier is applied at most once, to that max — when algod's
 * suggested minimum already exceeds the configured base (congestion
 * pricing), the higher value is multiplied rather than stacking premiums.
 */
export const resolveMinFeeForSender = ({
    senderAddress,
    accounts,
    suggestedMinFee,
    configMinTxnFee,
    pqMultiplier,
}: ResolveMinFeeForSenderParams): bigint => {
    const baseMinFee =
        suggestedMinFee > configMinTxnFee ? suggestedMinFee : configMinTxnFee
    const signer = getSignerFor(senderAddress, accounts)
    const isPQSigner = signer !== null && isQuantumAccount(signer)
    return calculateMinTxnFee({ baseMinFee, isPQSigner, pqMultiplier })
}

export type MinFeeResolverDependencies = {
    /** Snapshot accessor for all wallet accounts */
    getAccounts: () => WalletAccount[]
    /** Same shape as SourceDependencies.getSuggestedParams */
    getSuggestedParams: () => Promise<{ minFee: bigint }>
    /** Accessor for remote-config fee values (useMinimumFeeConfig subset) */
    getMinFeeConfig: () => { minTxnFee: bigint; pqMultiplier: bigint }
}

/**
 * Builds the async `resolveMinFeeForSender` dependency injected into
 * `SourceDependencies`. See {@link resolveMinFeeForSender} for semantics.
 */
export const createMinFeeResolver = (
    deps: MinFeeResolverDependencies,
): ((senderAddress: string) => Promise<bigint>) => {
    return async (senderAddress: string): Promise<bigint> => {
        const { minFee } = await deps.getSuggestedParams()
        const { minTxnFee, pqMultiplier } = deps.getMinFeeConfig()
        return resolveMinFeeForSender({
            senderAddress,
            accounts: deps.getAccounts(),
            suggestedMinFee: minFee,
            configMinTxnFee: minTxnFee,
            pqMultiplier,
        })
    }
}
