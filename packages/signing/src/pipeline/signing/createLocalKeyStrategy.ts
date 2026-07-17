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
import { encodeToBase64, toError } from '@perawallet/wallet-core-shared'
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
// `./standardDataSigning`, shared with `createQuantumStrategy`.
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
 * Creates a signing strategy for accounts with local Ed25519 keys (Algo25,
 * HDWallet). These accounts have immediate access to private keys via KMS.
 *
 * Quantum (Falcon) accounts are deliberately NOT handled here — they route
 * through the dedicated {@link createQuantumStrategy}, which produces the
 * pqsig byte carrier rather than a plain algosdk `SignedTransaction`.
 */
export const createLocalKeyStrategy = (
    options: LocalKeyStrategyOptions,
): SigningStrategy => {
    const { signTransactions, signArbitraryData, signArc60 } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return hasSigningKeys(account) && !isQuantumAccount(account)
        },

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

            if (!isAlgo25Account(account) && !isHDWalletAccount(account)) {
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
                        // signer so the transport can post
                        // them to the backend if needed
                        const signerInfo: SignerInfo = {
                            address: account.address,
                            accountType: account.type,
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
                const signingError = new SigningError(cause.message, cause)
                callbacks?.onError?.(signingError)
                throw signingError
            }
        },
    }
}
