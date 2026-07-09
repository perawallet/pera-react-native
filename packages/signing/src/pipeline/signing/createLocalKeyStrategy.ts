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
    Arc60StdSigData,
    Arc60Metadata,
} from '../types'
import { CannotSignError, SigningError } from '../errors'

/**
 * Signing function type that matches useLocalKeyTransactionSigner's signTransactions.
 */
export type LocalSigningFunction = (
    txnGroup: PeraSignedTransaction['txn'][],
    indexesToSign: number[],
    account: WalletAccount,
) => Promise<PeraSignedTransaction[]>

/**
 * Signing function type that matches useArbitraryDataSigner's signArbitraryData
 */
export type LocalArbitrarySigningFunction = (
    account: WalletAccount,
    data: string | string[],
) => Promise<Uint8Array[]>

/**
 * Signing function type that matches useLocalKeyArc60Signer's signArc60
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
 * Creates a signing strategy for accounts with local keys (Algo25, HDWallet,
 * Quantum). These accounts have immediate access to private keys via KMS.
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
                        // signer so the transport can post
                        // them to the backend if needed
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
                        // Defense in depth: never sign an item whose claimed
                        // signer differs from the account producing the
                        // signature (the build step already rejects mixed
                        // signers, but the signing key must never be applied to
                        // data attributed to another account).
                        const mismatched = group.data.data.find(
                            m => m.signer !== account.address,
                        )
                        if (mismatched) {
                            throw new CannotSignError(
                                account.address,
                                `Arbitrary-data item claims signer ${mismatched.signer} but is being signed by ${account.address}`,
                            )
                        }

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
                    }

                    case 'arc60': {
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
