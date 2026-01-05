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

    const signHDWalletTransaction = useCallback(
        async (
            account: HDWalletAccount,
            txn: PeraTransaction,
        ): Promise<Uint8Array> => {
            const hdWalletDetails = account.hdWalletDetails
            const storageKey = hdWalletDetails.walletId

            return await executeWithKey(
                storageKey,
                KEY_DOMAIN,
                async keyData => {
                    if (!keyData) {
                        return Promise.reject(
                            `No signing keys found for ${txn.sender.toString()}`,
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
                    const encodedTransaction = encodeTransaction(txn)
                    return await signTransaction(
                        seed,
                        hdWalletDetails,
                        encodedTransaction,
                    )
                },
            )
        },
        [signTransaction],
    )

    const signAlgo25Transaction = useCallback(
        async (
            account: Algo25Account,
            txn: PeraTransaction,
        ): Promise<Uint8Array> => {
            const storageKey = account.keyPairId

            if (!storageKey) {
                return Promise.reject(
                    `No signing keys found for ${txn.sender.toString()}`,
                )
            }

            return await executeWithKey(
                storageKey,
                KEY_DOMAIN,
                async keyData => {
                    if (!keyData) {
                        return Promise.reject(
                            `No signing keys found for ${txn.sender.toString()}`,
                        )
                    }

                    const encodedTransaction = encodeTransaction(txn)
                    //TODO: implement this once we can find signTransaction in algokit-utils somewhere
                    return await encodedTransaction
                },
            )
        },
        [signTransaction],
    )

    const signSingleTransaction = useCallback(
        async (
            account: WalletAccount,
            txn: PeraTransaction,
        ): Promise<Uint8Array> => {
            if (!account) {
                return Promise.reject(
                    `No account found for ${txn.sender.toString()}`,
                )
            }

            if (account.rekeyAddress) {
                const rekeyedAccount =
                    accounts.find(a => a.address === account.rekeyAddress) ??
                    null
                if (!rekeyedAccount) {
                    return Promise.reject(
                        `No rekeyed account found for ${account.rekeyAddress}`,
                    )
                }
                return signSingleTransaction(rekeyedAccount, txn)
            }

            if (isHDWalletAccount(account)) {
                return signHDWalletTransaction(account as HDWalletAccount, txn)
            }

            if (isAlgo25Account(account)) {
                return signAlgo25Transaction(account as Algo25Account, txn)
            }

            //TODO: handle hardware accounts

            return Promise.reject(
                `Unsupported account type ${account.type} for ${account.address}`,
            )
        },
        [signTransaction],
    )

    //TODO: this is really inefficient because we refetch the key for each account on each tx
    //we should batch these up and sign all txs for the same account at the same time, then
    //recompose the array of signed txs
    const signTransactions = useCallback(
        async (
            txnGroup: PeraTransactionGroup,
            indexesToSign: number[],
        ): Promise<Uint8Array[]> => {
            const signedTransactions = await Promise.all(
                txnGroup.map(async (txn, index) => {
                    if (indexesToSign.includes(index)) {
                        const account = accounts.find(
                            a => a.address === txn.sender.toString(),
                        )
                        if (!account) {
                            return Promise.reject(
                                `No account found for ${txn.sender.toString()}`,
                            )
                        }
                        return signSingleTransaction(account, txn)
                    }
                    return null
                }),
            )
            return signedTransactions.filter(txn => txn !== null)
        },
        [accounts, signTransaction, executeWithKey],
    )

    return {
        signTransactions,
    }
}
