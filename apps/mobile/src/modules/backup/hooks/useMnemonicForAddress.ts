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

import { useEffect, useRef, useState } from 'react'
import {
    AccountTypes,
    type Algo25Account,
    type HDWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'

export type UseMnemonicForAddressResult = {
    mnemonic: string | null
    error: Error | null
    isLoading: boolean
}

const DOMAIN = 'backup-flow'

// The effect below intentionally depends only on `address` — KMS + accounts
// are read through refs so new function/array identities from their source
// hooks don't retrigger the fetch and cause a setState loop.
export const useMnemonicForAddress = (
    address: string | undefined,
    accounts: WalletAccount[],
): UseMnemonicForAddressResult => {
    const kms = useKMS()
    const kmsRef = useRef(kms)
    kmsRef.current = kms
    const accountsRef = useRef(accounts)
    accountsRef.current = accounts

    const [state, setState] = useState<UseMnemonicForAddressResult>({
        mnemonic: null,
        error: null,
        isLoading: true,
    })

    useEffect(() => {
        if (!address) {
            logger.error('BackupMnemonic: missing address in route params')
            setState({
                mnemonic: null,
                error: new Error('Account not found'),
                isLoading: false,
            })
            return
        }

        const account =
            accountsRef.current.find(a => a.address === address) ?? null
        if (!account) {
            logger.error('BackupMnemonic: account not found for address', {
                address,
                knownAddresses: accountsRef.current.map(a => a.address),
            })
            setState({
                mnemonic: null,
                error: new Error('Account not found'),
                isLoading: false,
            })
            return
        }

        let cancelled = false
        setState({ mnemonic: null, error: null, isLoading: true })

        const run = async (): Promise<void> => {
            const { getKeyOrThrow, withHDSession, withAlgo25Session } =
                kmsRef.current
            try {
                if (account.type === AccountTypes.hdWallet) {
                    const hdAccount = account as HDWalletAccount
                    const key = getKeyOrThrow(hdAccount.keyPairId)
                    const mnemonic = await withHDSession(
                        key,
                        DOMAIN,
                        async session => session.getMnemonic(),
                        hdAccount.entropyKeyId,
                    )
                    if (!cancelled) {
                        setState({
                            mnemonic,
                            error: null,
                            isLoading: false,
                        })
                    }
                } else if (account.type === AccountTypes.algo25) {
                    const algoAccount = account as Algo25Account
                    const key = getKeyOrThrow(algoAccount.keyPairId)
                    const mnemonic = await withAlgo25Session(
                        key,
                        DOMAIN,
                        async session => session.getMnemonic(),
                        algoAccount.seedKeyId,
                    )
                    if (!cancelled) {
                        setState({
                            mnemonic,
                            error: null,
                            isLoading: false,
                        })
                    }
                } else if (!cancelled) {
                    logger.error('BackupMnemonic: unsupported account type', {
                        accountType: account.type,
                        address: account.address,
                    })
                    setState({
                        mnemonic: null,
                        error: new Error(
                            'Account type does not support backup',
                        ),
                        isLoading: false,
                    })
                }
            } catch (err) {
                logger.error('BackupMnemonic: failed to retrieve mnemonic', {
                    address: account.address,
                    accountType: account.type,
                    error: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                })
                if (!cancelled) {
                    setState({
                        mnemonic: null,
                        error: err as Error,
                        isLoading: false,
                    })
                }
            }
        }

        void run()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address])

    return state
}
