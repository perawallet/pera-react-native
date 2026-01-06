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
import { isAlgo25Account, isHDWalletAccount } from '../utils'
import { Algo25Account, HDWalletAccount, WalletAccount } from '../models'
import { logger } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'

export const useArbitraryDataSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signTransaction, verifySignature } = useHDWallet()
    const { executeWithKey } = useWithKey()

    const signHDWalletArbitraryData = useCallback(
        async (
            account: HDWalletAccount,
            data: string | string[],
        ): Promise<Uint8Array[]> => {
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

                    const toSign = typeof data === 'string' ? [data] : data

                    logger.debug('To sign', { toSign })

                    const signatures = await Promise.all(
                        toSign.map(
                            async data =>
                                await signTransaction(
                                    seed,
                                    hdWalletDetails,
                                    Buffer.from(data, 'base64'),
                                ),
                        ),
                    )

                    if (config.debugEnabled) {
                        await signatures.forEach(async (signature, index) => {
                            const result = await verifySignature(
                                seed,
                                hdWalletDetails,
                                Buffer.from(toSign[index], 'base64'),
                                signature,
                            )

                            logger.debug('Signature verification result', {
                                index,
                                result,
                            })
                        })
                    }

                    return signatures
                },
            )
        },
        [executeWithKey, signTransaction],
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
        [signHDWalletArbitraryData, signAlgo25ArbitraryData],
    )

    return {
        signArbitraryData,
    }
}
