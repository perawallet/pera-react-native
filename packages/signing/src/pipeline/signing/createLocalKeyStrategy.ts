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
import {
    hasSigningKeys,
    isAlgo25Account,
    isHDWalletAccount,
    isQuantumAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import {
    encodeToBase64,
    isRetryableError,
    toError,
} from '@perawallet/wallet-core-shared'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    SigningResult,
    SigningCallbacks,
    SignerInfo,
} from '../types'
import { CannotSignError, SigningError } from '../errors'
import { signArbitraryDataCase, signArc60Case } from './standardDataSigning'

// Re-exported for backward compatibility with the many call sites that
// import these from `./createLocalKeyStrategy` — the types now live in
// `./standardDataSigning`.
export type {
    LocalArbitrarySigningFunction,
    LocalArc60SigningFunction,
} from './standardDataSigning'
import type {
    LocalArbitrarySigningFunction,
    LocalArc60SigningFunction,
} from './standardDataSigning'

/**
 * Signing function type that matches useLocalKeyTransactionSigner's signTransactions.
 */
export type LocalSigningFunction = (
    txnGroup: PeraSignedTransaction['txn'][],
    indexesToSign: number[],
    account: WalletAccount,
) => Promise<PeraSignedTransaction[]>

export type LocalKeyStrategyOptions = {
    signTransactions: LocalSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
}

/**
 * Creates a signing strategy for accounts whose signing key lives on this
 * device: Algo25, HD wallet, and quantum (post-quantum) accounts.
 *
 * All three share one path. The signature scheme is resolved inside
 * `useLocalKeyTransactionSigner` from the key itself, so this strategy does
 * not branch on account type beyond validating that the key is local.
 */
export const createLocalKeyStrategy = (
    options: LocalKeyStrategyOptions,
): SigningStrategy => {
    const { signTransactions, signArbitraryData, signArc60 } = options

    return {
        canSign: (account: WalletAccount): boolean => hasSigningKeys(account),

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            if (!hasSigningKeys(account)) {
                throw new CannotSignError(
                    account.address,
                    'Account does not have local signing keys',
                )
            }

            if (
                !isAlgo25Account(account) &&
                !isHDWalletAccount(account) &&
                !isQuantumAccount(account)
            ) {
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

                        const signed = await signTransactions(
                            transactions,
                            indicesToSign,
                            account,
                        )

                        callbacks?.onProgress?.(
                            transactions.length,
                            transactions.length,
                        )
                        callbacks?.onSigningComplete?.()

                        // Surface per-transaction base64 signatures on the
                        // signer so the transport can post them to the
                        // backend if needed. A PQ-signed transaction has no
                        // `sig` (its signature lives in `pqsig` instead), so
                        // this yields `null` for those slots with no
                        // quantum-specific code — quantum accounts are not
                        // multisig participants, so nothing reads it in that
                        // case anyway.
                        const signerInfo: SignerInfo = {
                            address: account.address,
                            signatures: signed.map(stx =>
                                stx.sig ? encodeToBase64(stx.sig) : null,
                            ),
                        }
                        return {
                            signedData: { type: 'transactions', signed },
                            signers: [signerInfo],
                            originalIndices: group.originalIndices,
                        }
                    }

                    case 'arbitrary-data': {
                        return await signArbitraryDataCase(
                            group.data,
                            group.originalIndices,
                            account,
                            signArbitraryData,
                            callbacks,
                        )
                    }

                    case 'arc60': {
                        return await signArc60Case(
                            group.data,
                            group.originalIndices,
                            account,
                            signArc60,
                            callbacks,
                        )
                    }
                }
            } catch (error) {
                const cause = toError(error)
                // TTCDIAG: temporary instrumentation, remove before commit.
                console.log(
                    '[TTCDIAG] localKeyStrategy caught',
                    JSON.stringify({
                        name: cause.name,
                        message: cause.message,
                        raw: String(error),
                        keys: Object.keys(
                            (error ?? {}) as Record<string, unknown>,
                        ),
                        stack: cause.stack?.slice(0, 600),
                    }),
                )
                const signingError = new SigningError(cause.message, cause, {
                    retryable: isRetryableError(cause),
                })
                callbacks?.onError?.(signingError)
                throw signingError
            }
        },
    }
}
