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

import { useCallback } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupWriteDownScreenResult = {
    onContinue: () => void
}

// PIN gating lives on BackupMnemonicScreen itself so the mnemonic is never
// pulled into memory without a fresh PIN verification, regardless of how the
// screen is reached.
export const useBackupWriteDownScreen = (): UseBackupWriteDownScreenResult => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<BackupStackParamList, 'BackupWriteDown'>
        >()
    const route = useRoute<RouteProp<BackupStackParamList, 'BackupWriteDown'>>()
    const address = route.params?.address

    const onContinue = useCallback(() => {
        if (address) {
            navigation.navigate('BackupMnemonic', { address })
        }
    }, [navigation, address])

    return { onContinue }
}
