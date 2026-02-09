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

import React from 'react'
import { PWBottomSheet, PWView } from '@components/core'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useWebViewStack, WebViewRequest } from '../../hooks'
import { PWWebView } from '../PWWebView'

const flexStyle = { flex: 1 }

/**
 * WebViewOverlay renders WebView bottom sheets from the store.
 * Place this component at the app root level to enable WebView overlays.
 * Use the `useWebView` hook to open webviews from anywhere in the app.
 *
 * @example
 * // In RootComponent
 * <RootContent />
 * <WebViewOverlay />
 */
export const WebViewOverlay = () => {
    const { openWebViews, removeWebView } = useWebViewStack()
    const { height } = useWindowDimensions()
    const insets = useSafeAreaInsets()

    const onCloseRequested = (view: WebViewRequest) => {
        if (view.onCloseRequested) {
            view.onCloseRequested()
        } else {
            removeWebView(view.id)
        }
    }

    return (
        <>
            {openWebViews.map((view: WebViewRequest) => (
                <PWBottomSheet
                    key={view.id}
                    innerContainerStyle={{
                        height: height - insets.top,
                    }}
                    isVisible={true}
                    scrollEnabled={false}
                >
                    <PWView style={flexStyle}>
                        <PWWebView
                            requestId={view.id}
                            url={view.url}
                            enablePeraConnect={view.enablePeraConnect ?? false}
                            showControls
                            onBack={view.onBackRequested}
                            onClose={() => onCloseRequested(view)}
                        />
                    </PWView>
                </PWBottomSheet>
            ))}
        </>
    )
}
