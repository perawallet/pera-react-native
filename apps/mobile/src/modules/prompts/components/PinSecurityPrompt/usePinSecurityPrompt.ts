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

import { UserPreferences } from '@constants/user-preferences'
import { PromptViewProps } from '@modules/prompts/models'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCallback } from 'react'

export const usePinSecurityPrompt = ({
    onDismiss,
    onHide,
}: PromptViewProps) => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const handleSetPinCode = useCallback(() => {
        onHide(UserPreferences.securityPinSetupPrompt)
        navigation.navigate('Settings', {
            screen: 'SecuritySettings',
        })
    }, [onHide, navigation])

    const handleNotNow = useCallback(() => {
        onHide(UserPreferences.securityPinSetupPrompt)
    }, [onHide])

    const handleDontAskAgain = useCallback(() => {
        onDismiss(UserPreferences.securityPinSetupPrompt)
    }, [onDismiss])

    return {
        handleSetPinCode,
        handleNotNow,
        handleDontAskAgain,
    }
}
