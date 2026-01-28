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
import { useKMS } from '@perawallet/wallet-core-kms'
import { useCallback } from 'react'
import { KEY_DOMAIN } from '../constants'
import {
    isAlgo25Account,
    isHDWalletAccount,
} from '../utils'
import { Algo25Account, HDWalletAccount, WalletAccount } from '../models'

export const useArbitraryDataSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signTransaction } = useHDWallet()
    const { executeWithKey, executeWithSeed } = useKMS()

    const signHDWalletArbitraryData = useCallback(
        async (
            account: HDWalletAccount,
            data: string | string[],
        ): Promise<Uint8Array[]> => {
            const hdWalletDetails = account.hdWalletDetails
            const storageKey = hdWalletDetails.walletId

            return await executeWithSeed(
                storageKey,
                KEY_DOMAIN,
                async (seed: Uint8Array) => {
                    const seedBuffer = Buffer.from(seed)
                    const toSign = typeof data === 'string' ? [data] : data

                    const signatures = await Promise.all(
                        toSign.map(async data => {
                            const prefixedData = new Uint8Array(
                                Buffer.concat([
                                    //MX prefix required by algosdk.verifyBytes
                                    Buffer.from('MX', 'utf-8'),
                                    Buffer.from(data, 'base64'),
                                ]),
                            )
                            const signature = await signTransaction(
                                seedBuffer,
                                hdWalletDetails,
                                prefixedData,
                            )

                            return signature
                        }),
                    )
                    return signatures
                },
            )
        },
        [executeWithSeed, signTransaction],
    )

    const signAlgo25ArbitraryData = useCallback(
        async (
            account: Algo25Account,
            _: string | string[],
        ): Promise<Uint8Array[]> => {
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

                    //TODO implement this properly - this is not signing anything!
                    throw new Error('Not implemented')
                },
            )
        },
        [executeWithKey],
    )

    const signArbitraryData = useCallback(
        async (
            account: WalletAccount,
            data: string | string[],
        ): Promise<Uint8Array[]> => {
            if (account.rekeyAddress) {
                const rekeyedAccount =
                    accounts.find(a => a.address === account.rekeyAddress) ??
                    null
                if (!rekeyedAccount) {
                    return Promise.reject(
                        `No rekeyed account found for ${account.rekeyAddress}`,
                    )
                }
                return signArbitraryData(rekeyedAccount, data)
            }

            if (isHDWalletAccount(account)) {
                return signHDWalletArbitraryData(
                    account as HDWalletAccount,
                    data,
                )
            }

            if (isAlgo25Account(account)) {
                return signAlgo25ArbitraryData(account as Algo25Account, data)
            }

            return Promise.reject(
                `Unsupported account type ${account.type} for ${account.address}`,
            )
        },
        [accounts, signHDWalletArbitraryData, signAlgo25ArbitraryData],
    )

    return {
        signArbitraryData,
    }
}
