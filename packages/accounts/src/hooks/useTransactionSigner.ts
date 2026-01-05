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

import { useAccountsStore } from '../store'
import { useHDWallet } from './useHDWallet'
import { useWithKey } from '@perawallet/wallet-core-kmd'
import { useCallback } from 'react'
import { KEY_DOMAIN } from '../constants'
import {
    PeraTransaction,
    PeraTransactionGroup,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { isAlgo25Account, isHDWalletAccount } from '../utils'
import { Algo25Account, HDWalletAccount, WalletAccount } from '../models'

export const useTransactionSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signTransaction } = useHDWallet()
    const { executeWithKey } = useWithKey()
    const { encodeTransaction } = useTransactionEncoder()

    const signHDWalletTransactions = useCallback(
        async (
            account: HDWalletAccount,
            txns: PeraTransactionGroup,
        ): Promise<PeraTransactionGroup> => {
            const hdWalletDetails = account.hdWalletDetails
            const storageKey = hdWalletDetails.walletId

            return await executeWithKey(
                storageKey,
                KEY_DOMAIN,
                async keyData => {
                    if (!keyData) {
                        return Promise.reject(
                            `No signing keys found for ${account.address}`,
                        )
                    }

                    let seed: Buffer
                    try {
                        // Try to parse as JSON first (new format)
                        const masterKey = JSON.parse(keyData.toString())
                        seed = Buffer.from(masterKey.seed, 'base64')
                    } catch {
                        // Fall back to treating it as raw seed data (old format or tests)
                        seed = Buffer.from(keyData)
                    }

                    const signedTxns = txns.map(async txn => {
                        const encodedTransaction = encodeTransaction(txn)
                        const signature = await signTransaction(
                            seed,
                            hdWalletDetails,
                            encodedTransaction,
                        )
                        txn.signature = signature
                        return txn
                    })
                    return Promise.all(signedTxns)
                },
            )
        },
        [signTransaction],
    )

    const signAlgo25Transactions = useCallback(
        async (
            account: Algo25Account,
            txns: PeraTransactionGroup,
        ): Promise<PeraTransactionGroup> => {
            const storageKey = account.keyPairId

            if (!storageKey) {
                return Promise.reject(
                    `No signing keys found for ${account.address}`,
                )
            }

            return await executeWithKey(
                storageKey,
                KEY_DOMAIN,
                async keyData => {
                    if (!keyData) {
                        return Promise.reject(
                            `No signing keys found for ${account.address}`,
                        )
                    }

                    //TODO: implement this once we can find signTransaction in algokit-utils somewhere
                    // const encodedTransaction = encodeTransaction(txn)
                    // const signature = await signTransaction(encodedTransaction)
                    // txn.signature = signature
                    return txns
                },
            )
        },
        [signTransaction],
    )

    const signSingleAccountTransactions = useCallback(
        async (
            account: WalletAccount,
            txns: PeraTransactionGroup,
        ): Promise<PeraTransactionGroup> => {
            if (account.rekeyAddress) {
                const rekeyedAccount =
                    accounts.find(a => a.address === account.rekeyAddress) ??
                    null
                if (!rekeyedAccount) {
                    return Promise.reject(
                        `No rekeyed account found for ${account.rekeyAddress}`,
                    )
                }
                return signSingleAccountTransactions(rekeyedAccount, txns)
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
        [signTransaction],
    )

    const signTransactions = useCallback(
        async (
            txnGroup: PeraTransactionGroup,
            indexesToSign: number[],
        ): Promise<PeraTransactionGroup> => {
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
            const result = [...txnGroup]
            await Promise.all(
                groupedByAccount.entries().map(async entry => {
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
