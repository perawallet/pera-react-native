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
import { useAppNavigation } from '@hooks/useAppNavigation'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useTheme } from '@rneui/themed'
import { OnboardingStackParamList } from '../../routes/types'
import { useWebView } from '@modules/webview'
import { RECOVERY_PASSPHRASE_SUPPORT_URL } from '@perawallet/wallet-core-config'

import KeyImage from '@assets/images/key.svg'
import KeyInvertedImage from '@assets/images/key-inverted.svg'


export const useImportInfoScreen = () => {
    const { theme } = useTheme()
    const navigation = useAppNavigation()
    const { pushWebView } = useWebView()
    const {
        params: { accountType },
    } = useRoute<RouteProp<OnboardingStackParamList, 'ImportInfo'>>()

    const handleBackPress = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    const handleRecoverPress = useCallback(() => {
        navigation.push('ImportAccount', { accountType })
    }, [navigation, accountType])

    const handleInfoPress = useCallback(() => {
        pushWebView({ url: RECOVERY_PASSPHRASE_SUPPORT_URL })
    }, [pushWebView])

    const KeyImageComponent =
        theme.mode === 'dark' ? KeyInvertedImage : KeyImage

    return {
        handleBackPress,
        handleRecoverPress,
        handleInfoPress,
        KeyImageComponent,
    }
}
