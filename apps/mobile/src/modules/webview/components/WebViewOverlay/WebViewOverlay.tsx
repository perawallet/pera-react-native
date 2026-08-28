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

import { useEffect, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebViewStack, type WebViewRequest } from '../../hooks'
import { PWWebView } from '../PWWebView'

/**
 * WebViewOverlay opens a WebView bottom sheet for each entry in the
 * webview stack via the managed bottom-sheet system. Place this at the
 * app root so `useWebView().pushWebView(...)` resolves anywhere in the
 * app.
 */
export const WebViewOverlay = () => {
    const { openWebViews, removeWebView } = useWebViewStack()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()

    // Track which webview ids we've already opened a sheet for so we
    // don't re-request on every render.
    const openedRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const currentIds = new Set(openWebViews.map(v => v.id))

        // Open sheets for newly-added entries.
        for (const view of openWebViews) {
            if (openedRef.current.has(view.id)) continue
            openedRef.current.add(view.id)

            const onCloseRequested = () => {
                if (view.onCloseRequested) {
                    view.onCloseRequested()
                } else {
                    removeWebView(view.id)
                }
            }

            void requestBottomSheet({
                id: view.id,
                contents: (
                    <WebViewSheetContents
                        view={view}
                        onClose={onCloseRequested}
                    />
                ),
                options: {
                    size: 'full',
                    autoCreateContainer: false,
                    // The WebView insets its own content (PERA-4708).
                    avoidKeyboard: false,
                },
            }).finally(() => {
                openedRef.current.delete(view.id)
                // If the sheet was dismissed externally (e.g. pan-down),
                // make sure the store reflects that.
                removeWebView(view.id)
            })
        }

        // Close sheets that have been removed from the store.
        for (const id of Array.from(openedRef.current)) {
            if (!currentIds.has(id)) {
                openedRef.current.delete(id)
                dismiss(id)
            }
        }
    }, [openWebViews, requestBottomSheet, dismiss, removeWebView])

    return null
}

type WebViewSheetContentsProps = {
    view: WebViewRequest
    onClose: () => void
}

const WebViewSheetContents = ({ view, onClose }: WebViewSheetContentsProps) => (
    <PWWebView
        requestId={view.id}
        url={view.url}
        enablePeraConnect={view.enablePeraConnect ?? false}
        showControls
        favorite={view.favorite}
        onBack={view.onBackRequested}
        onClose={onClose}
        inBottomSheet
    />
)
