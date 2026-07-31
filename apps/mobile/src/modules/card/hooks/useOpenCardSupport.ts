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
import { config } from '@perawallet/wallet-core-config'
import { useWebView } from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'

/** Opens Pera support: in-app WebView where available, else the browser. */
export const useOpenCardSupport = (): (() => void) => {
    const { pushWebView } = useWebView()

    return useCallback(() => {
        if (!routeCapabilities.inAppWebView) {
            void Linking.openURL(config.supportBaseUrl)
            return
        }
        pushWebView({ url: config.supportBaseUrl, id: 'card-support' })
    }, [pushWebView])
}
