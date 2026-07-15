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

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWView } from '@components/core'
import { PWWebView } from '@modules/webview/components/PWWebView'
import { useBidaliWebViewScreen } from './useBidaliWebViewScreen'
import { useStyles } from './styles'

export const BidaliWebViewScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { url, bidaliProviderJS, onClose, handleMessage, webviewRef } =
        useBidaliWebViewScreen()

    return (
        <PWView style={styles.container}>
            <PWWebView
                url={url}
                enablePeraConnect={false}
                showControls
                showFooterBar={false}
                onClose={onClose}
                customJavaScript={bidaliProviderJS}
                onCustomMessage={handleMessage}
                webviewRef={webviewRef}
                inBottomSheet
            />
        </PWView>
    )
}
