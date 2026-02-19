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

import { useCallback, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'

type UseExpressSendScreenResult = {
    handleContinue: () => void
    handleDontShowAgain: () => void
}

export const useExpressSendScreen = (): UseExpressSendScreenResult => {
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const { hasPreference, setPreference } = usePreferences()

    useEffect(() => {
        if (hasPreference(UserPreferences.expressSendWarningDismissed)) {
            navigation.replace('ConfirmTransaction')
        }
    }, [hasPreference, navigation])

    const handleContinue = useCallback(() => {
        navigation.navigate('ConfirmTransaction')
    }, [navigation])

    const handleDontShowAgain = useCallback(() => {
        setPreference(UserPreferences.expressSendWarningDismissed, 'true')
        navigation.navigate('ConfirmTransaction')
    }, [navigation, setPreference])

    return {
        handleContinue,
        handleDontShowAgain,
    }
}
