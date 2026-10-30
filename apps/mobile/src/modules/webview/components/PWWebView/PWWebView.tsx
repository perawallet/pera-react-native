/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import React from 'react'
import { PWView, PWButton, PWScrollView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { WebViewTitleBar } from './WebViewTitleBar'
import { WebViewFooterBar } from './WebViewFooterBar'
import { useStyles } from './styles'
import { usePWWebView, type PWWebViewProps } from './usePWWebView'

export type {PWWebViewProps}

export const PWWebView = (props: PWWebViewProps) => {
    const { t } = useLanguage()
    const {
        title,
        committedUrl,
        onCloseRequested,
        reload,
        loadState,
        renderWebView,
        showControls,
        showFooterBar,
        favorite,
        webview,
        homeUrl,
        navigationState,
        bottomInset,
    } = usePWWebView(props)
    const styles = useStyles({ bottomInset })

    return (
        <PWView style={styles.flex}>
            {showControls && (
                <WebViewTitleBar
                    onCloseRequested={onCloseRequested}
                    onReload={reload}
                    title={title}
                    url={committedUrl}
                />
            )}

            <PWScrollView
                style={styles.flex}
                contentContainerStyle={styles.scrollContent}
            >
                {renderWebView()}
                {loadState.showOfflineView && (
                    <PWView
                        style={styles.absoluteFill}
                        testID='pw-webview-offline'
                    >
                        <EmptyView
                            title={t('common.webview.offline_title')}
                            body={t('common.webview.offline_body')}
                            button={
                                <PWButton
                                    title={t('common.webview.reload')}
                                    onPress={loadState.handleRetry}
                                    variant='primary'
                                />
                            }
                        />
                    </PWView>
                )}
                {loadState.showTimeoutView && (
                    <PWView
                        style={styles.absoluteFill}
                        testID='pw-webview-timeout'
                    >
                        <EmptyView
                            title={t('common.webview.failed_title')}
                            body={t('common.webview.failed_body')}
                            button={
                                <PWButton
                                    title={t('common.webview.reload')}
                                    onPress={loadState.handleRetry}
                                    variant='primary'
                                />
                            }
                        />
                    </PWView>
                )}
            </PWScrollView>

            {showControls && showFooterBar && (
                <WebViewFooterBar
                    webview={webview}
                    homeUrl={homeUrl}
                    navigationState={navigationState}
                    favorite={favorite}
                    bottomInset={bottomInset}
                />
            )}
        </PWView>
    )
}
