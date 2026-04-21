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

import { useCallback, useState } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { usePinCode } from '@perawallet/wallet-core-security'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupWriteDownScreenResult = {
    isPinVisible: boolean
    onContinue: () => Promise<void>
    closePin: () => void
    handlePinVerified: () => void
}

export const useBackupWriteDownScreen = (): UseBackupWriteDownScreenResult => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<BackupStackParamList, 'BackupWriteDown'>
        >()
    const route = useRoute<RouteProp<BackupStackParamList, 'BackupWriteDown'>>()
    const address = route.params?.address
    const { checkPinEnabled } = usePinCode()
    const [isPinVisible, setIsPinVisible] = useState(false)

    const navigateToMnemonic = useCallback(() => {
        if (address) {
            navigation.navigate('BackupMnemonic', { address })
        }
    }, [navigation, address])

    const onContinue = useCallback(async () => {
        const isPinEnabled = await checkPinEnabled()
        if (isPinEnabled) {
            setIsPinVisible(true)
        } else {
            navigateToMnemonic()
        }
    }, [checkPinEnabled, navigateToMnemonic])

    const closePin = useCallback(() => setIsPinVisible(false), [])

    const handlePinVerified = useCallback(() => {
        setIsPinVisible(false)
        navigateToMnemonic()
    }, [navigateToMnemonic])

    return { isPinVisible, onContinue, closePin, handlePinVerified }
}
