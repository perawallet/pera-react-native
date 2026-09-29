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
import type WebView from 'react-native-webview'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useDeviceID } from '@perawallet/wallet-core-device'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { sendMessageToWebview } from '../handlers'
import { resolveWebviewLanguage } from '../webviewLanguage'
import type { BridgeHandler } from './types'

type UseSettingsHandlersResult = {
    getSettings: BridgeHandler
    getPublicSettings: BridgeHandler
}

export const useSettingsHandlers = (
    webview: Nullable<WebView>,
): UseSettingsHandlersResult => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const theme = useIsDarkMode() ? 'dark' : 'light'
    const { deviceInfo } = usePeraProvider()
    const { preferredCurrency } = useCurrency()
    const { currentLanguage } = useLanguage()

    const getSettings = useCallback<BridgeHandler>(
        message => {
            const payload = {
                appName: deviceInfo.getAppName(),
                appPackageName: deviceInfo.getAppPackage(),
                appVersion: deviceInfo.getAppVersion(),
                clientType: deviceInfo.getDevicePlatform(),
                deviceId: deviceID,
                deviceVersion: deviceInfo.getDeviceModel(),
                deviceOSVersion: deviceInfo.getDeviceOSVersion(),
                deviceModel: deviceInfo.getDeviceModel(),
                theme,
                network,
                currency: preferredCurrency,
                // "Where are you", which the in-app language picker doesn't
                // change; `language` below is the app's resolved locale.
                region: deviceInfo.getDeviceCountry(),
                language: resolveWebviewLanguage(currentLanguage),
                protocolVersion: '3',
            }
            sendMessageToWebview(message.id, payload, webview)
        },
        [
            deviceID,
            deviceInfo,
            preferredCurrency,
            theme,
            network,
            currentLanguage,
            webview,
        ],
    )

    const getPublicSettings = useCallback<BridgeHandler>(
        message => {
            const payload = {
                theme,
                network,
                currency: preferredCurrency,
                language: resolveWebviewLanguage(currentLanguage),
            }
            sendMessageToWebview(message.id, payload, webview)
        },
        [preferredCurrency, theme, network, currentLanguage, webview],
    )

    return { getSettings, getPublicSettings }
}
