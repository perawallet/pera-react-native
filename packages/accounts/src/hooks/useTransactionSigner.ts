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
import { withKey } from '../utils'
import { encodeTransaction, Transaction } from '@algorandfoundation/algokit-utils/transact'
import { useCallback } from 'react'

export const useTransactionSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signTransaction } = useHDWallet()
    const { executeWithKey } = useWithKey()

    //TODO: this is really inefficient because we refetch the key for each account on each tx
    //we should batch these up and sign all txs for the same account at the same time, then 
    //recompose the array of signed txs
    const signTransactions = useCallback(async (
        txnGroup: Transaction[],
        indexesToSign: number[]): Promise<Uint8Array[]> => {
        const signedTransactions = await Promise.all(txnGroup.map(async (txn, index) => {
            const account = accounts.find(a => a.address === txn.sender.toString()) ?? null
            const hdWalletDetails = account?.hdWalletDetails

            if (!hdWalletDetails) {
                return Promise.reject(`No HD wallet found for ${txn.sender.toString()}`)
            }

            const storageKey = `rootkey-${hdWalletDetails.walletId}`
            return await withKey(storageKey, secureStorage, async keyData => {
                if (!keyData) {
                    return Promise.reject(`No signing keys found for ${txn.sender.toString()}`)
                }

                let seed: Buffer
                try {
                    // Try to parse as JSON first (new format)
                    const masterKey = JSON.parse(keyData.toString())
                    seed = Buffer.from(masterKey.seed, 'base64')
                } catch {
                    // Fall back to treating it as raw seed data (old format or tests)
                    seed = keyData
                }
                if (indexesToSign.includes(index)) {
                    const encodedTransaction = encodeTransaction(txn)
                    return await signTransaction(seed, hdWalletDetails, encodedTransaction)
                }
                return null
            })
        }))
        return signedTransactions.filter((txn) => txn !== null)
    }, [accounts, signTransaction, secureStorage])

    return {
        signTransactions,
    }
}
