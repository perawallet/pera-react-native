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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useAccountsStore,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'
import type {
    Algo25Account,
    HDWalletAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useBackupFlowWords } from '../../context'
import type { BackupStackParamList } from '../../routes/types'

type MnemonicState = {
    mnemonic: string | null
    error: Error | null
    isLoading: boolean
}

const DOMAIN = 'backup-flow'

const useMnemonicForSelectedAccount = (
    account: WalletAccount | null,
): MnemonicState => {
    const { getKeyOrThrow, withHDSession, withAlgo25Session } = useKMS()
    const [state, setState] = useState<MnemonicState>({
        mnemonic: null,
        error: null,
        isLoading: true,
    })

    useEffect(() => {
        if (!account) {
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
                    setState({
                        mnemonic: null,
                        error: new Error(
                            'Account type does not support backup',
                        ),
                        isLoading: false,
                    })
                }
            } catch (err) {
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
    }, [account, getKeyOrThrow, withHDSession, withAlgo25Session])

    return state
}

export type UseBackupMnemonicScreenResult = {
    words: string[]
    isLoading: boolean
    error: Error | null
    onContinue: () => void
}

export const useBackupMnemonicScreen = (): UseBackupMnemonicScreenResult => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<BackupStackParamList, 'BackupMnemonic'>
        >()
    const route = useRoute<RouteProp<BackupStackParamList, 'BackupMnemonic'>>()
    const accounts = useAccountsStore(state => state.accounts)
    const address = route.params?.address
    const account = useMemo<WalletAccount | null>(() => {
        if (!address) return null
        return accounts.find(a => a.address === address) ?? null
    }, [address, accounts])

    const { mnemonic, error, isLoading } =
        useMnemonicForSelectedAccount(account)
    const { setWords } = useBackupFlowWords()

    const words = useMemo(
        () => (mnemonic ? mnemonic.split(' ') : []),
        [mnemonic],
    )

    const onContinue = useCallback(() => {
        setWords(words)
        if (address) {
            navigation.navigate('BackupVerification', { address })
        }
    }, [words, setWords, navigation, address])

    return { words, isLoading, error, onContinue }
}
