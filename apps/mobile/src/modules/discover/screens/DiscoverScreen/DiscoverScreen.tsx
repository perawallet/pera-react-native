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

import { config } from '@perawallet/wallet-core-config'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { logger } from '@perawallet/wallet-core-shared'
import { PWView } from '@components/core'
import { useStyles } from './styles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWWebView } from '@modules/webview/components/PWWebView'
import { isSafeRelativePath } from '@modules/webview/hooks/handlers'
import type { TabBarStackParamList } from '@routes/tabbar'

const joinDiscoverPath = (baseUrl: string, path?: string): string => {
    if (!path) return baseUrl
    if (!isSafeRelativePath(path)) {
        logger.warn('DiscoverScreen: ignoring unsafe path param', { path })
        return baseUrl
    }
    const normalizedBase = baseUrl.endsWith('/')
        ? baseUrl.slice(0, -1)
        : baseUrl
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${normalizedBase}${normalizedPath}`
}

export const DiscoverScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const route = useRoute<RouteProp<TabBarStackParamList, 'Discover'>>()
    const url = joinDiscoverPath(config.discoverBaseUrl, route.params?.path)

    return (
        <PWView style={styles.container}>
            <PWWebView
                url={url}
                enablePeraConnect={true}
                containerStyle={styles.webview}
            />
        </PWView>
    )
}
