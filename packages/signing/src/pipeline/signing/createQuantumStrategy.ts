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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { isQuantumAccount } from '@perawallet/wallet-core-accounts'
import type {
    PeraTransaction,
    QuantumSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import { toError } from '@perawallet/wallet-core-shared'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    SigningResult,
    SigningCallbacks,
    SignerInfo,
} from '../types'
import { CannotSignError, SigningError } from '../errors'
import {
    signArbitraryDataCase,
    signArc60Case,
    type LocalArbitrarySigningFunction,
    type LocalArc60SigningFunction,
} from './standardDataSigning'

/**
 * Signs a transaction group with a quantum (Falcon-1024) account's key,
 * matching the shape of the KMS-backed hook that will implement it (PQ-006's
 * follow-up task). Returns the pqsig byte carrier — see
 * `QuantumSignedTransaction` — rather than a plain algosdk `SignedTransaction`,
 * because the Falcon-signed bytes come pre-encoded from Seam B
 * (`pq/quantumAdapter.ts`) and must not be re-decoded/re-encoded outside it.
 */
export type QuantumSigningFunction = (
    txnGroup: PeraTransaction[],
    indexesToSign: number[],
    account: WalletAccount,
) => Promise<QuantumSignedTransaction[]>

export type QuantumStrategyOptions = {
    signQuantumTransactions: QuantumSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
}

/**
 * Creates a dedicated signing strategy for quantum (post-quantum, Falcon)
 * accounts. Unlike `createLocalKeyStrategy` — which currently still
 * accepts quantum accounts as part of its broader local-key guard — this
 * strategy produces the carrier-typed `QuantumSignedTransaction` result for
 * the `transactions` modality instead of a plain algosdk `SignedTransaction`,
 * so downstream code (encoding, submission) can distinguish a pqsig byte
 * carrier from a normal signed transaction via `isQuantumSignedTransaction`.
 *
 * Arbitrary-data and ARC-60 signing are identical in shape to the local-key
 * path (same injected function types), so both are delegated to the shared
 * helpers in `./standardDataSigning`.
 *
 * Not yet wired into the strategy selector — see PQ-006 follow-up task.
 */
export const createQuantumStrategy = (
    options: QuantumStrategyOptions,
): SigningStrategy => {
    const { signQuantumTransactions, signArbitraryData, signArc60 } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return isQuantumAccount(account)
        },

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            if (!isQuantumAccount(account)) {
                throw new CannotSignError(
                    account.address,
                    `Unsupported account type: ${account.type}`,
                )
            }

            try {
                switch (group.data.type) {
                    case 'transactions': {
                        const { transactions, indicesToSign } = group.data
                        callbacks?.onSigningStart?.()
                        callbacks?.onProgress?.(0, transactions.length)

                        const signed = await signQuantumTransactions(
                            transactions,
                            indicesToSign,
                            account,
                        )

                        callbacks?.onProgress?.(
                            transactions.length,
                            transactions.length,
                        )
                        callbacks?.onSigningComplete?.()

                        // The pqsig carrier holds pre-encoded, node-ready
                        // bytes (`pqSignedBytes`) rather than an isolated
                        // per-txn signature, so there is nothing to surface
                        // on `signers[].signatures` yet (unlike the local-key
                        // strategy's `sig`-based signatures, used by
                        // multisig cosign — quantum accounts are not
                        // multisig participants).
                        const signerInfo: SignerInfo = {
                            address: account.address,
                            accountType: account.type,
                            signatures: signed.map(() => null),
                        }
                        return {
                            signedData: { type: 'transactions', signed },
                            signers: [signerInfo],
                            originalIndices: group.originalIndices,
                        }
                    }

                    case 'arbitrary-data':
                        return await signArbitraryDataCase(
                            group.data,
                            group.originalIndices,
                            account,
                            signArbitraryData,
                            callbacks,
                        )

                    case 'arc60':
                        return await signArc60Case(
                            group.data,
                            group.originalIndices,
                            account,
                            signArc60,
                            callbacks,
                        )
                }
            } catch (error) {
                const cause = toError(error)
                const signingError = new SigningError(cause.message, cause)
                callbacks?.onError?.(signingError)
                throw signingError
            }
        },
    }
}
