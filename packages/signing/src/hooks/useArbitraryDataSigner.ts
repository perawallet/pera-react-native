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

import {
    useAccountsStore,
    useAccountAuthAddresses,
} from '@perawallet/wallet-core-accounts'
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
import { decodeFromBase64, concatBytes } from '@perawallet/wallet-core-shared'
import { SIGNING_KEY_DOMAIN } from '../constants'

export const useArbitraryDataSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { authAddresses } = useAccountAuthAddresses()
    const { getKeyOrThrow, withHDSession, withAlgo25Session } = useKMS()

    const signHDWalletArbitraryData = useCallback(
        async (
            account: HDWalletAccount,
            data: string | string[],
        ): Promise<Uint8Array[]> => {
            const hdWalletDetails = account.hdWalletDetails

            const key = getKeyOrThrow(account.keyPairId)
            return await withHDSession(
                key,
                SIGNING_KEY_DOMAIN,
                async session => {
                    const toSign = [data].flat()

                    const signatures = await Promise.all(
                        toSign.map(async item => {
                            // Match the legacy algo_signData spec: dApps verify
                            // the signature against `MX || data`. The Algo25
                            // branch already does this; HD must mirror it.
                            const bytesToSign = concatBytes(
                                new TextEncoder().encode('MX'),
                                decodeFromBase64(item),
                            )
                            return session.signData(
                                {
                                    account: hdWalletDetails.account,
                                    keyIndex: hdWalletDetails.keyIndex,
                                    derivationType:
                                        hdWalletDetails.derivationType,
                                },
                                bytesToSign,
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
            const key = getKeyOrThrow(account.keyPairId)
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
            const authAddress = authAddresses.get(account.address)
            if (authAddress && authAddress !== account.address) {
                const rekeyedAccount =
                    accounts.find(a => a.address === authAddress) ?? null
                if (!rekeyedAccount) {
                    return Promise.reject(
                        `No rekeyed account found for ${authAddress}`,
                    )
                }

                if (isHDWalletAccount(rekeyedAccount)) {
                    return signHDWalletArbitraryData(
                        rekeyedAccount as HDWalletAccount,
                        data,
                    )
                }
                if (isAlgo25Account(rekeyedAccount)) {
                    return signAlgo25ArbitraryData(
                        rekeyedAccount as Algo25Account,
                        data,
                    )
                }
                return Promise.reject(
                    `Unsupported auth account type ${rekeyedAccount.type} for ${rekeyedAccount.address}`,
                )
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
        [
            accounts,
            authAddresses,
            signHDWalletArbitraryData,
            signAlgo25ArbitraryData,
        ],
    )

    return {
        signArbitraryData,
    }
}
