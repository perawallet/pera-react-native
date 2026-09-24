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
import { Linking } from 'react-native'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { config } from '@perawallet/wallet-core-config'

import { useWebView } from '@modules/webview/hooks'
import { routeCapabilities } from '@routes/capabilities'

export type UseSettingsDeveloperMenuScreenResult = {
    isGalleryAvailable: boolean
    handleNavigate: (page: string) => void
    handleOpenTestingDapp: () => void
}

export const useSettingsDeveloperMenuScreen =
    (): UseSettingsDeveloperMenuScreenResult => {
        const navigation =
            useNavigation<NativeStackNavigationProp<ParamListBase>>()
        const { pushWebView } = useWebView()

        const handleNavigate = useCallback(
            (page: string) => {
                navigation.push(page)
            },
            [navigation],
        )

        const handleOpenTestingDapp = useCallback(() => {
            if (!routeCapabilities.inAppWebView) {
                void Linking.openURL(config.peraDemoDappUrl)
                return
            }
            pushWebView({
                url: config.peraDemoDappUrl,
                id: 'Testing Dapp',
                enablePeraConnect: true,
            })
        }, [pushWebView])

        return {
            isGalleryAvailable: routeCapabilities.developerGallery,
            handleNavigate,
            handleOpenTestingDapp,
        }
    }
