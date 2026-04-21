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

import { useCallback, useMemo } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useBackupFlowWords } from '../../context'
import { useMnemonicForAddress } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

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

    const { mnemonic, error, isLoading } = useMnemonicForAddress(
        address,
        accounts,
    )
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
