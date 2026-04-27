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
import { useRoute } from '@react-navigation/native'
import { config } from '@perawallet/wallet-core-config'
import { useWebView } from '@modules/webview'
import { useAppNavigation } from '@hooks/useAppNavigation'

import type { RouteProp } from '@react-navigation/native'
import type { RekeyToStandardStackParamList } from '../../routes/types'

export type UseRekeyIntroScreenResult = {
    handleStartProcess: () => void
    handleLearnMore: () => void
}

export const useRekeyIntroScreen = (): UseRekeyIntroScreenResult => {
    const navigation = useAppNavigation()
    const { pushWebView } = useWebView()
    const route =
        useRoute<
            RouteProp<RekeyToStandardStackParamList, 'RekeyToStandardIntro'>
        >()
    const sourceAddress = route.params.sourceAddress

    const handleStartProcess = useCallback(() => {
        navigation.navigate('RekeyToStandard', {
            screen: 'RekeyToStandardSelectTarget',
            params: { sourceAddress },
        })
    }, [navigation, sourceAddress])

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.rekeyToStandardSupportUrl })
    }, [pushWebView])

    return {
        handleStartProcess,
        handleLearnMore,
    }
}
