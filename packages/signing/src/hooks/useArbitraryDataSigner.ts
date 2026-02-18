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
    isAlgo25Account,
    isHDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    Algo25Account,
    HDWalletAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { SIGNING_KEY_DOMAIN } from '../constants'

const concatBytes = (...arrays: Uint8Array[]): Uint8Array => {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const arr of arrays) {
        result.set(arr, offset)
        offset += arr.length
    }
    return result
}

export const useArbitraryDataSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { loadKey, withHDSession, withAlgo25Session } = useKMS()

    const signHDWalletArbitraryData = useCallback(
        async (
            account: HDWalletAccount,
            data: string | string[],
        ): Promise<Uint8Array[]> => {
            const hdWalletDetails = account.hdWalletDetails

            const key = loadKey(account.keyPairId)
            return await withHDSession(
                key,
                SIGNING_KEY_DOMAIN,
                async session => {
                    const toSign = typeof data === 'string' ? [data] : data

                    const signatures = await Promise.all(
                        toSign.map(async item => {
                            const prefixedData = new Uint8Array(
                                concatBytes(
                                    new TextEncoder().encode('MX'),
                                    decodeFromBase64(item),
                                ),
                            )
                            return session.signData(
                                {
                                    account: hdWalletDetails.account,
                                    keyIndex: hdWalletDetails.keyIndex,
                                    derivationType:
                                        hdWalletDetails.derivationType,
                                },
                                prefixedData,
                            )
                        }),
                    )
                    return signatures
                },
            )
        },
        [withHDSession],
    )

    const signAlgo25ArbitraryData = useCallback(
        async (
            account: Algo25Account,
            data: string | string[],
        ): Promise<Uint8Array[]> => {
            const key = loadKey(account.keyPairId)
            return await withAlgo25Session(
                key,
                SIGNING_KEY_DOMAIN,
                async session => {
                    const toSign = typeof data === 'string' ? [data] : data

                    const signatures = await Promise.all(
                        toSign.map(async item => {
                            const prefixedData = concatBytes(
                                new TextEncoder().encode('MX'),
                                decodeFromBase64(item),
                            )
                            return session.signData(prefixedData)
                        }),
                    )
                    return signatures
                },
            )
        },
        [withAlgo25Session],
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
