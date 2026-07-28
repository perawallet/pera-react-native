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
import { ActivityIndicator } from 'react-native'
import { WebView, type WebViewProps } from 'react-native-webview'
import { useStyles } from './styles'
import type { PWStaticWebViewSource } from './PWStaticWebView.types'

export type PWStaticWebViewProps = {
    source: PWStaticWebViewSource
} & Omit<WebViewProps, 'source'>

/**
 * Thin wrapper around `react-native-webview` for static, trusted content
 * (bundled HTML or a simple remote URL). Unlike `PWWebView` it carries no dapp
 * chrome, Pera Connect bridge, or origin gating. It bakes in the Android-correct
 * defaults the raw WebView lacks — chiefly `nestedScrollEnabled`, without which
 * content does not scroll on Android inside a gesture host (e.g. a bottom sheet).
 * Every default is overridable through the spread props.
 *
 * No bottom-sheet awareness is needed: it renders no chrome that consumes a
 * bottom inset, and `nestedScrollEnabled` is a no-op outside a nested-scroll
 * parent. If sheet-aware behavior is ever required, consume `BottomSheetIdContext`
 * from `@modules/bottom-sheet` rather than adding a prop.
 */
export const PWStaticWebView = ({
    source,
    style,
    renderLoading,
    ...rest
}: PWStaticWebViewProps) => {
    const styles = useStyles()

    return (
        <WebView
            source={source}
            nestedScrollEnabled
            renderLoading={renderLoading ?? (() => <ActivityIndicator />)}
            style={[styles.webView, style]}
            {...rest}
        />
    )
}
