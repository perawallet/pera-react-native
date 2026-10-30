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

import React from 'react'
import { PWView, PWButton } from '@components/core'
import { EmptyView } from '@components/EmptyView/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import type { PWWebViewProps } from './PWWebView'
// The explicit `.web` suffix: `tsc --noEmit` (this repo's `build` script) has
// no platform-suffix resolution, so a bare './usePWWebView' specifier would
// always type-check against the native hook.
import { usePWWebView } from './usePWWebView.web'

export type { PWWebViewProps } from './PWWebView'

const IFrame = 'iframe' as unknown as React.ComponentType<{
    src: string
    sandbox?: string
    referrerPolicy?: 'no-referrer'
    title: string
    style?: Record<string, string | number>
    // Coarse load signals — a cross-origin frame exposes nothing finer.
    onLoad?: () => void
    onError?: () => void
}>

export const PWWebView = ({
    url,
    enablePeraConnect,
    onClose,
    onBack,
    // customJavaScript is intentionally inert on web: the content-script
    // pattern (bidali-main.ts / discover-main.ts) owns provider installation
    // for both Discover and Bidali instead of an injected-JS channel, which
    // doesn't exist for a cross-origin iframe. Callers (e.g.
    // BidaliWebViewScreen) pass it unconditionally so native and web share a
    // single prop surface — accepted here only so destructuring the shared
    // PWWebViewProps type doesn't require a cast.
    customJavaScript: _customJavaScript,
    onCustomMessage,
    containerStyle,
    webviewRef,
}: PWWebViewProps) => {
    const styles = useStyles({ bottomInset: 0 })
    const { t } = useLanguage()

    const {
        status,
        isOffline,
        src,
        bridgeToken,
        reloadNonce,
        handleLoad,
        handleError,
        handleRetry,
    } = usePWWebView({
        url,
        enablePeraConnect,
        onClose,
        onBack,
        onCustomMessage,
        webviewRef,
    })

    return (
        <PWView style={[styles.flex, containerStyle]}>
            <IFrame
                key={`${bridgeToken}:${reloadNonce}`}
                src={src}
                sandbox='allow-same-origin allow-scripts allow-forms allow-popups'
                // Otherwise the frame's load request names the embedding
                // extension page (its origin carries the extension id). A
                // native webview's first load sends no Referer either. The
                // token in the src is scrubbed by the content-script relay.
                referrerPolicy='no-referrer'
                // oxlint-disable-next-line pera/no-hardcoded-ui-strings -- the frame's name for assistive tech, not visible copy
                title='pera-webview'
                onLoad={handleLoad}
                onError={handleError}
                // Raw DOM element rendered via react-dom, not an RN View:
                // makeStyles produces RN stylesheet ids that a host
                // <iframe> can't consume.
                // oxlint-disable-next-line react-native/no-inline-styles
                style={{ border: 0, width: '100%', height: '100%', flex: 1 }}
            />
            {/* Overlays rather than replacements: swapping the iframe out on
                failure would discard its bridge Port and force a full
                re-handshake on retry. */}
            {status === 'loading' && (
                <PWView
                    style={styles.absoluteFill}
                    testID='pw-webview-loading'
                >
                    <EmptyView
                        body=''
                        isLoading
                    />
                </PWView>
            )}
            {status === 'error' && (
                <PWView
                    style={styles.absoluteFill}
                    testID={
                        isOffline ? 'pw-webview-offline' : 'pw-webview-timeout'
                    }
                >
                    <EmptyView
                        title={t(
                            isOffline
                                ? 'common.webview.offline_title'
                                : 'common.webview.failed_title',
                        )}
                        body={t(
                            isOffline
                                ? 'common.webview.offline_body'
                                : 'common.webview.failed_body',
                        )}
                        button={
                            <PWButton
                                title={t('common.webview.reload')}
                                onPress={handleRetry}
                                variant='primary'
                            />
                        }
                    />
                </PWView>
            )}
        </PWView>
    )
}
