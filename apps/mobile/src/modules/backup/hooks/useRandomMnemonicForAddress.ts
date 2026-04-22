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
import {
    useKMS,
    type MnemonicWordAtPosition,
} from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'

export type UseRandomMnemonicForAddressResult = {
    picks: MnemonicWordAtPosition[] | null
    error: Error | null
    isLoading: boolean
}

const DOMAIN = 'backup-verification'

// Thin wrapper around `session.getRandomMnemonicWords` so the verification
// screen never receives the full mnemonic — only the N {index, word} pairs it
// needs to build the quiz. The KMS does the sampling inside the session; the
// rest of the mnemonic never leaves it.
export const useRandomMnemonicForAddress = (
    address: string | undefined,
    account: WalletAccount | null,
    count: number,
): UseRandomMnemonicForAddressResult => {
    const kms = useKMS()
    const kmsRef = useRef(kms)
    kmsRef.current = kms
    const accountRef = useRef(account)
    accountRef.current = account

    const [state, setState] = useState<UseRandomMnemonicForAddressResult>({
        picks: null,
        error: null,
        isLoading: true,
    })

    useEffect(() => {
        if (!address) {
            setState({
                picks: null,
                error: new Error('Account not found'),
                isLoading: false,
            })
            return
        }

        const currentAccount = accountRef.current
        if (!currentAccount || currentAccount.address !== address) {
            setState({
                picks: null,
                error: new Error('Account not found'),
                isLoading: false,
            })
            return
        }

        let cancelled = false
        setState({ picks: null, error: null, isLoading: true })

        const run = async (): Promise<void> => {
            const { getKeyOrThrow, withHDSession, withAlgo25Session } =
                kmsRef.current
            try {
                let picks: MnemonicWordAtPosition[]
                if (currentAccount.type === AccountTypes.hdWallet) {
                    const hdAccount = currentAccount as HDWalletAccount
                    const key = getKeyOrThrow(hdAccount.keyPairId)
                    picks = await withHDSession(
                        key,
                        DOMAIN,
                        async session => session.getRandomMnemonicWords(count),
                        hdAccount.entropyKeyId,
                    )
                } else if (currentAccount.type === AccountTypes.algo25) {
                    const algoAccount = currentAccount as Algo25Account
                    const key = getKeyOrThrow(algoAccount.keyPairId)
                    picks = await withAlgo25Session(
                        key,
                        DOMAIN,
                        async session => session.getRandomMnemonicWords(count),
                        algoAccount.seedKeyId,
                    )
                } else {
                    if (!cancelled) {
                        setState({
                            picks: null,
                            error: new Error(
                                'Account type does not support backup',
                            ),
                            isLoading: false,
                        })
                    }
                    return
                }

                if (!cancelled) {
                    setState({ picks, error: null, isLoading: false })
                }
            } catch (err) {
                logger.error(
                    'BackupVerification: failed to sample mnemonic words',
                    {
                        accountType: currentAccount.type,
                        error: err instanceof Error ? err.message : String(err),
                        stack: err instanceof Error ? err.stack : undefined,
                    },
                )
                if (!cancelled) {
                    setState({
                        picks: null,
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
    }, [address, count])

    return state
}
