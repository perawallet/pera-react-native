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

import React, { createContext, PropsWithChildren, useState } from 'react'
import PWBottomSheet from '../components/common/bottom-sheet/PWBottomSheet'
import { StatusBar, useWindowDimensions } from 'react-native'
import PWWebView from '../components/webview/PWWebView'
import { v7 as uuidv7 } from 'uuid'
import PWView from '../components/common/view/PWView'

type WebViewRequest = {
    id: string
    url: string
}

type WebViewStack = {
    openWebViews: WebViewRequest[]
    pushWebView: (view: WebViewRequest) => void
    popWebView: () => void
    removeWebView: (id: string) => void
    clearWebViews: () => void
}

export const WebViewContext = createContext<WebViewStack>({
    openWebViews: [],
    pushWebView: () => { },
    popWebView: () => { },
    removeWebView: () => { },
    clearWebViews: () => { },
})

type WebViewProviderProps = {} & PropsWithChildren

const flexStyle = { flex: 1, }

const WebViewProvider = ({ children }: WebViewProviderProps) => {
    const [openWebViews, setOpenWebViews] = useState<WebViewRequest[]>([])
    const { height } = useWindowDimensions()

    const pushWebView = (view: WebViewRequest) => {
        setOpenWebViews(prev => [...prev, { ...view, id: uuidv7() }])
    }

    const popWebView = () => {
        setOpenWebViews(prev => prev.slice(0, prev.length - 1))
    }

    const removeWebView = (id: string) => {
        setOpenWebViews(prev => prev.filter(view => view.id !== id))
    }

    const clearWebViews = () => {
        setOpenWebViews([])
    }

    return (
        <WebViewContext.Provider
            value={{
                openWebViews,
                pushWebView,
                popWebView,
                removeWebView,
                clearWebViews,
            }}
        >
            {children}
            {openWebViews.map(view => (
                <PWBottomSheet
                    key={view.id}
                    innerContainerStyle={{
                        height: height - (StatusBar.currentHeight ?? 20),
                    }}
                    isVisible={true}
                    scrollEnabled={false}
                >
                    <PWView style={flexStyle}>
                        <PWWebView
                            requestId={view.id}
                            url={view.url}
                            enablePeraConnect={false}
                            showControls
                        />
                    </PWView>
                </PWBottomSheet>
            ))}
        </WebViewContext.Provider>
    )
}

export default WebViewProvider
