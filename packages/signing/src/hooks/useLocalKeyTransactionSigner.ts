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

import { KeyType, useKMS, type KeyPair } from '@perawallet/wallet-core-kms'
import { useCallback } from 'react'
import {
    Address,
    encodeAlgorandAddress,
    PeraSignedTransaction,
    PeraTransaction,
    PeraTransactionGroup,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    isAlgo25Account,
    isHDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    Algo25Account,
    HDWalletAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SIGNING_KEY_DOMAIN } from '../constants'

export type UseLocalKeyTransactionSignerResult = {
    /**
     * Signs the transactions at `indexesToSign` with `account`'s key.
     *
     * The caller is responsible for resolving the correct account before
     * calling: for regular signing flows that means following rekey to the
     * auth account; for multisig cosign that means using the participant's
     * own (un-rekey-resolved) account. This hook signs with whatever account
     * it receives and does NOT follow rekey internally.
     *
     * Do NOT look the account up from `txn.sender`: for multisig cosign and
     * ARC-0001 explicit-`signers` flows, the signer differs from the
     * transaction sender, and lookup-by-sender would either pick the wrong
     * account or none at all.
     */
    signTransactions: (
        txnGroup: PeraTransaction[],
        indexesToSign: number[],
        account: WalletAccount,
    ) => Promise<PeraSignedTransaction[]>
}

export const useLocalKeyTransactionSigner =
    (): UseLocalKeyTransactionSignerResult => {
        const { getKeyOrThrow, withHDSession, withAlgo25Session } = useKMS()
        const { encodeTransaction } = useTransactionEncoder()

        const signHDWalletTransactions = useCallback(
            async (
                account: HDWalletAccount,
                txns: PeraTransactionGroup,
            ): Promise<PeraSignedTransaction[]> => {
                const hdWalletDetails = account.hdWalletDetails
                const key = getKeyOrThrow(account.keyPairId)

                return await withHDSession(
                    key,
                    SIGNING_KEY_DOMAIN,
                    async session => {
                        const signedTxns = txns.map(async txn => {
                            const encodedTransaction = encodeTransaction(txn)

                            const signature = await session.signTransaction(
                                {
                                    account: hdWalletDetails.account,
                                    keyIndex: hdWalletDetails.keyIndex,
                                    derivationType:
                                        hdWalletDetails.derivationType,
                                },
                                encodedTransaction,
                            )

                            const senderPublicKey = encodeAlgorandAddress(
                                txn.sender.publicKey,
                            )
                            const signedTxn: PeraSignedTransaction = {
                                txn,
                                sig: signature,
                                authAddress:
                                    account.address !== senderPublicKey
                                        ? Address.fromString(account.address)
                                        : undefined,
                            }
                            return signedTxn
                        })
                        return Promise.all(signedTxns)
                    },
                )
            },
            [getKeyOrThrow, encodeTransaction, withHDSession],
        )

        const signAlgo25Transactions = useCallback(
            async (
                account: Algo25Account,
                txns: PeraTransactionGroup,
            ): Promise<PeraSignedTransaction[]> => {
                const key: KeyPair = {
                    id: account.keyPairId,
                    keystoreKeyId: account.keyPairId,
                    publicKey: account.address,
                    type: KeyType.Algo25Key,
                    acl: [],
                }
                return await withAlgo25Session(
                    key,
                    SIGNING_KEY_DOMAIN,
                    async session => {
                        const signedTxns = txns.map(async txn => {
                            const encodedTransaction = encodeTransaction(txn)
                            const signature =
                                await session.signTransaction(
                                    encodedTransaction,
                                )

                            const senderPublicKey = encodeAlgorandAddress(
                                txn.sender.publicKey,
                            )
                            const signedTxn: PeraSignedTransaction = {
                                txn,
                                sig: signature,
                                authAddress:
                                    account.address !== senderPublicKey
                                        ? Address.fromString(account.address)
                                        : undefined,
                            }
                            return signedTxn
                        })
                        return Promise.all(signedTxns)
                    },
                )
            },
            [encodeTransaction, withAlgo25Session],
        )

        const signSingleAccountTransactions = useCallback(
            async (
                account: WalletAccount,
                txns: PeraTransactionGroup,
            ): Promise<PeraSignedTransaction[]> => {
                if (isHDWalletAccount(account)) {
                    return signHDWalletTransactions(
                        account as HDWalletAccount,
                        txns,
                    )
                }

                if (isAlgo25Account(account)) {
                    return signAlgo25Transactions(
                        account as Algo25Account,
                        txns,
                    )
                }

                return Promise.reject(
                    `Unsupported account type ${account.type} for ${account.address}`,
                )
            },
            [signHDWalletTransactions, signAlgo25Transactions],
        )

        const signTransactions = useCallback(
            async (
                txnGroup: PeraTransaction[],
                indexesToSign: number[],
                account: WalletAccount,
            ): Promise<PeraSignedTransaction[]> => {
                const result = txnGroup.map(txn => ({
                    txn,
                })) as PeraSignedTransaction[]

                const toSign = indexesToSign.map(i => txnGroup[i])
                const signedTxns = await signSingleAccountTransactions(
                    account,
                    toSign,
                )
                signedTxns.forEach((signedTxn, idx) => {
                    result[indexesToSign[idx]] = signedTxn
                })
                return result
            },
            [signSingleAccountTransactions],
        )

        return {
            signTransactions,
        }
    }
