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

import { ActivityIndicator } from 'react-native'
import { PWScreen, PWView } from '@components/core'
import { PWWebView } from '@modules/webview/components/PWWebView'
import { useDiscoverScreen } from './useDiscoverScreen'
import { useStyles } from './styles'

export const DiscoverScreen = () => {
    const styles = useStyles()
    const { url, isReady } = useDiscoverScreen()

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
            // The Discover web app sizes its search modal from a viewport
            // height snapshotted at load and anchors it to the viewport
            // bottom; shrinking the WebView with the keyboard pushes the
            // search input off the top of the screen on Android.
            // Let the keyboard overlay the page instead, matching iOS.
            keyboardAvoidance='never'
            style={styles.container}
        >
            {isReady ? (
                <PWWebView
                    url={url}
                    enablePeraConnect={true}
                    containerStyle={styles.webview}
                    openExternalLinksInBrowser
                />
            ) : (
                <PWView style={styles.loadingContainer}>
                    <ActivityIndicator />
                </PWView>
            )}
        </PWScreen>
    )
}
