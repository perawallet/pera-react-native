/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import {
    useDiscoverWebView,
    type UseDiscoverWebViewResult,
} from '@modules/discover/hooks'
import type { RootStackParamList } from '@routes/types'

export type UseDiscoverDetailScreenResult = UseDiscoverWebViewResult & {
    handleBack: () => void
}

export const useDiscoverDetailScreen = (): UseDiscoverDetailScreenResult => {
    const route = useRoute<RouteProp<RootStackParamList, 'DiscoverDetail'>>()
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const { url, isReady } = useDiscoverWebView(route.params?.path)

    const handleBack = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    return { url, isReady, handleBack }
}
