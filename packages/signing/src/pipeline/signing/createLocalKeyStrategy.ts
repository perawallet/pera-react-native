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
    isAlgo25Account,
    isHDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    SigningResult,
    SigningCallbacks,
    SignerInfo,
} from '../types'
import { CannotSignError, SigningError } from '../errors'

/**
 * Signing function type that matches useTransactionSigner's signTransactions
 */
export type LocalSigningFunction = (
    txnGroup: PeraSignedTransaction['txn'][],
    indexesToSign: number[],
) => Promise<PeraSignedTransaction[]>

/**
 * Creates a signing strategy for accounts with local keys (Algo25, HDWallet).
 * These accounts have immediate access to private keys via KMS.
 *
 * @param signTransactions - The signing function from useTransactionSigner
 */
export const createLocalKeyStrategy = (
    signTransactions: LocalSigningFunction,
): SigningStrategy => {
    return {
        canSign: (account: WalletAccount): boolean => {
            return hasSigningKeys(account)
        },

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            // Validate that we can sign with this account
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

            // Only handle transaction signing
            if (group.data.type !== 'transactions') {
                throw new SigningError(
                    'Local key strategy only supports transaction signing',
                )
            }

            const { transactions, indicesToSign } = group.data

            try {
                callbacks?.onSigningStart?.()
                callbacks?.onProgress?.(0, transactions.length)

                // Sign the transactions
                const signedTransactions = await signTransactions(
                    transactions,
                    indicesToSign,
                )

                callbacks?.onProgress?.(
                    transactions.length,
                    transactions.length,
                )
                callbacks?.onSigningComplete?.()

                // Create signer info
                const signerInfo: SignerInfo = {
                    address: account.address,
                }

                return {
                    signedData: {
                        type: 'transactions',
                        signed: signedTransactions,
                    },
                    signers: [signerInfo],
                }
            } catch (error) {
                const signingError = new SigningError(
                    error instanceof Error ? error.message : String(error),
                    error instanceof Error ? error : undefined,
                )
                callbacks?.onError?.(signingError)
                throw signingError
            }
        },
    }
}
