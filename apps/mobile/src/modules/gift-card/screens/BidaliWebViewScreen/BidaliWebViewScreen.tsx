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
import { PWButton, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { PWWebView } from '@modules/webview/browser'
import { useBidaliWebViewScreen } from './useBidaliWebViewScreen'
import { useStyles } from './styles'

export const BidaliWebViewScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const {
        isAvailable,
        url,
        bidaliProviderJS,
        onClose,
        handleMessage,
        onShouldStartLoadWithRequest,
        webviewRef,
    } = useBidaliWebViewScreen()

    if (!isAvailable) {
        return (
            <PWView style={styles.container}>
                <EmptyView
                    title={t('giftCard.unavailable.title')}
                    body={t('giftCard.unavailable.body')}
                    button={
                        <PWButton
                            variant='primary'
                            title={t('common.close.label')}
                            onPress={onClose}
                        />
                    }
                />
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWWebView
                // oxlint-disable-next-line pera/no-unvalidated-open-url -- buildBidaliUrl over the services config base URL
                url={url}
                enablePeraConnect={false}
                showControls
                showFooterBar={false}
                onClose={onClose}
                customJavaScript={bidaliProviderJS}
                onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
                onCustomMessage={handleMessage}
                webviewRef={webviewRef}
                inBottomSheet
            />
        </PWView>
    )
}
