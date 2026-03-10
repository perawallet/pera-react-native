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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
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

export const useTransactionSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
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
                                derivationType: hdWalletDetails.derivationType,
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
            const key = getKeyOrThrow(account.keyPairId)
            return await withAlgo25Session(
                key,
                SIGNING_KEY_DOMAIN,
                async session => {
                    const signedTxns = txns.map(async txn => {
                        const encodedTransaction = encodeTransaction(txn)
                        const signature =
                            await session.signTransaction(encodedTransaction)

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
            dontFollowRekey?: boolean,
        ): Promise<PeraSignedTransaction[]> => {
            if (account.rekeyAddress && !dontFollowRekey) {
                const rekeyedAccount =
                    accounts.find(a => a.address === account.rekeyAddress) ??
                    null
                if (!rekeyedAccount) {
                    return Promise.reject(
                        `No rekeyed account found for ${account.rekeyAddress}`,
                    )
                }
                //rekeys don't chain, so only follow rekeys for one level
                return signSingleAccountTransactions(rekeyedAccount, txns, true)
            }

            if (isHDWalletAccount(account)) {
                return signHDWalletTransactions(
                    account as HDWalletAccount,
                    txns,
                )
            }

            if (isAlgo25Account(account)) {
                return signAlgo25Transactions(account as Algo25Account, txns)
            }

            //TODO: handle hardware accounts

            return Promise.reject(
                `Unsupported account type ${account.type} for ${account.address}`,
            )
        },
        [accounts, signHDWalletTransactions, signAlgo25Transactions],
    )

    const signTransactions = useCallback(
        async (
            txnGroup: PeraTransaction[],
            indexesToSign: number[],
        ): Promise<PeraSignedTransaction[]> => {
            // we want to group the transactions by account for signing efficiency
            // but we must remember where they were originally in the array
            const originalIndexes = txnGroup.map((txn, index) => ({
                index,
                txn,
            }))
            const groupedByAccount = originalIndexes.reduce(
                (acc, { index, txn }) => {
                    const account = accounts.find(
                        a => a.address === txn.sender.toString(),
                    )
                    if (!account) {
                        return acc
                    }
                    if (!acc.has(account.address)) {
                        acc.set(account.address, [])
                    }
                    acc.get(account.address)?.push({ index, txn })
                    return acc
                },
                new Map<string, { index: number; txn: PeraTransaction }[]>(),
            )

            // sign each group of transactions for the same account
            const result = txnGroup.map(txn => ({
                txn,
            })) as PeraSignedTransaction[]
            await Promise.all(
                Array.from(groupedByAccount.entries()).map(async entry => {
                    const accountAddress = entry[0]
                    const txns = entry[1]
                    const toSign = txns.filter(txnHolder =>
                        indexesToSign.includes(txnHolder.index),
                    )

                    const account = accounts.find(
                        a => a.address === accountAddress,
                    )
                    if (!account) {
                        return Promise.reject(
                            `No account found for ${accountAddress}`,
                        )
                    }
                    const signedTxns = await signSingleAccountTransactions(
                        account,
                        toSign.map(txnHolder => txnHolder.txn),
                    )
                    signedTxns.forEach((signedTxn, idx) => {
                        result[toSign[idx].index] = signedTxn
                    })
                }),
            )
            return result
        },
        [accounts, signSingleAccountTransactions],
    )

    return {
        signTransactions,
    }
}
