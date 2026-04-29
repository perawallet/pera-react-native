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
    Arc60StdSigData,
    Arc60Metadata,
} from '../types'
import { CannotSignError, SigningError } from '../errors'

/**
 * Signing function type that matches useLocalKeyTransactionSigner's signTransactions
 */
export type LocalSigningFunction = (
    txnGroup: PeraSignedTransaction['txn'][],
    indexesToSign: number[],
) => Promise<PeraSignedTransaction[]>

/**
 * Signing function type that matches useArbitraryDataSigner's signArbitraryData
 */
export type LocalArbitrarySigningFunction = (
    account: WalletAccount,
    data: string | string[],
) => Promise<Uint8Array[]>

/**
 * Signing function type that matches useArc60Signer's signArc60
 */
export type LocalArc60SigningFunction = (
    account: WalletAccount,
    stdSigData: Arc60StdSigData,
    metadata: Arc60Metadata,
) => Promise<Uint8Array>

export type LocalKeyStrategyOptions = {
    signTransactions: LocalSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
}

/**
 * Creates a signing strategy for accounts with local keys (Algo25, HDWallet).
 * These accounts have immediate access to private keys via KMS.
 */
export const createLocalKeyStrategy = (
    options: LocalKeyStrategyOptions,
): SigningStrategy => {
    const { signTransactions, signArbitraryData, signArc60 } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return hasSigningKeys(account)
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

            switch (group.data.type) {
                case 'transactions': {
                    const { transactions, indicesToSign } = group.data
                    try {
                        callbacks?.onSigningStart?.()
                        callbacks?.onProgress?.(0, transactions.length)

                        const signed = await signTransactions(
                            transactions,
                            indicesToSign,
                        )

                        callbacks?.onProgress?.(
                            transactions.length,
                            transactions.length,
                        )
                        callbacks?.onSigningComplete?.()

                        const signerInfo: SignerInfo = {
                            address: account.address,
                        }
                        return {
                            signedData: { type: 'transactions', signed },
                            signers: [signerInfo],
                            originalIndices: group.originalIndices,
                        }
                    } catch (error) {
                        const signingError = new SigningError(
                            error instanceof Error
                                ? error.message
                                : String(error),
                            error instanceof Error ? error : undefined,
                        )
                        callbacks?.onError?.(signingError)
                        throw signingError
                    }
                }

                case 'arbitrary-data': {
                    try {
                        callbacks?.onSigningStart?.()
                        const payloads = group.data.data.map(m => m.data)
                        const signatures = await signArbitraryData(
                            account,
                            payloads,
                        )
                        callbacks?.onSigningComplete?.()

                        return {
                            signedData: {
                                type: 'arbitrary-data',
                                signatures,
                            },
                            signers: [{ address: account.address }],
                            originalIndices: group.originalIndices,
                        }
                    } catch (error) {
                        const signingError = new SigningError(
                            error instanceof Error
                                ? error.message
                                : String(error),
                            error instanceof Error ? error : undefined,
                        )
                        callbacks?.onError?.(signingError)
                        throw signingError
                    }
                }

                case 'arc60': {
                    try {
                        callbacks?.onSigningStart?.()
                        const signature = await signArc60(
                            account,
                            group.data.stdSigData,
                            group.data.metadata,
                        )
                        callbacks?.onSigningComplete?.()

                        return {
                            signedData: { type: 'arc60', signature },
                            signers: [{ address: account.address }],
                            originalIndices: group.originalIndices,
                        }
                    } catch (error) {
                        const signingError = new SigningError(
                            error instanceof Error
                                ? error.message
                                : String(error),
                            error instanceof Error ? error : undefined,
                        )
                        callbacks?.onError?.(signingError)
                        throw signingError
                    }
                }
            }
        },
    }
}
