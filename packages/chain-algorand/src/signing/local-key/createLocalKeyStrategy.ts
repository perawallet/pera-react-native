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
import {
    AppError,
    encodeToBase64,
    ErrorCategory,
    isRetryableError,
    logger,
    toError,
} from '@perawallet/wallet-core-shared'
import {
    CannotSignError,
    SIGNING_ERROR_KEYS,
    SigningError,
    type AnalyzedSignableGroup,
    type LocalKeyStrategyOptions,
    type SignerInfo,
    type SigningCallbacks,
    type SigningResult,
    type SigningStrategy,
} from '@perawallet/wallet-core-signing'
import {
    signArbitraryDataCase,
    signAuthDataCase,
} from '../message/standardDataSigning'

/**
 * Creates a signing strategy for accounts whose signing key lives on this
 * device: Algo25, HD wallet, and quantum (post-quantum) accounts.
 *
 * All three share one path. The signature scheme is resolved inside
 * `signTransactionsWithLocalKey` from the key itself, so this strategy does
 * not branch on account type beyond validating that the key is local.
 */
export const createLocalKeyStrategy = (
    options: LocalKeyStrategyOptions,
): SigningStrategy => {
    const { signTransactions, signArbitraryData, signAuthData } = options

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

                    case 'auth-data': {
                        return await signAuthDataCase(
                            group.data,
                            group.originalIndices,
                            account,
                            signAuthData,
                            callbacks,
                        )
                    }
                }
            } catch (error) {
                const cause = toError(error)
                const causeMetadata =
                    cause instanceof AppError ? cause.metadata : undefined
                // ARC-60 and arbitrary-data validation run inside this try:
                // a malformed request is the dApp's fault, never a key fault.
                const isRequestFault =
                    causeMetadata?.category === ErrorCategory.VALIDATION
                const causeKey = causeMetadata?.messageKey
                const signingError = new SigningError(cause.message, cause, {
                    retryable: isRetryableError(cause),
                    messageKey:
                        causeKey ??
                        (isRequestFault
                            ? undefined
                            : SIGNING_ERROR_KEYS.localKeyFailed),
                    params: causeKey ? causeMetadata?.params : undefined,
                })
                if (!isRequestFault) {
                    // The toast never shows the reason, so without this report
                    // a keystore fault is indistinguishable from a network one.
                    logger.error('Local-key signing failed', {
                        error: cause,
                        accountType: account.type,
                        dataType: group.data.type,
                    })
                }
                callbacks?.onError?.(signingError)
                throw signingError
            }
        },
    }
}
