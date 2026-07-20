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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNetworkStatus } from '@modules/network'

/**
 * How long the initial load may spin before the error surface takes over.
 * Cold-opening a WebView offline doesn't reliably fire a main-frame
 * `onError` on every platform — without a bound the `startInLoadingState`
 * spinner runs forever.
 */
export const WEBVIEW_LOADING_TIMEOUT_MS = 20_000

type UsePWWebViewLoadStateResult = {
    /** No document ever loaded and the device is offline — show the offline surface. */
    showOfflineView: boolean
    /** The initial load overran its budget without a document or a native error. */
    showTimeoutView: boolean
    handleLoadStart: () => void
    handleLoadEnd: () => void
    /** Marks that a main-frame document rendered — the in-page content owns the surface from here. */
    markDocumentLoaded: () => void
    /** Manual retry from the offline/timeout surface. */
    handleRetry: () => void
}

export const usePWWebViewLoadState = ({
    onReload,
}: {
    onReload: () => void
}): UsePWWebViewLoadStateResult => {
    const { hasInternet } = useNetworkStatus()
    const [hasDocument, setHasDocument] = useState(false)
    const [isTimedOut, setIsTimedOut] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const wasOfflineRef = useRef(false)
    const reloadedThisEpisodeRef = useRef(false)

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const handleLoadStart = useCallback(() => {
        clearTimer()
        setIsTimedOut(false)
        timerRef.current = setTimeout(
            () => setIsTimedOut(true),
            WEBVIEW_LOADING_TIMEOUT_MS,
        )
    }, [clearTimer])

    const handleLoadEnd = useCallback(() => {
        clearTimer()
    }, [clearTimer])

    const markDocumentLoaded = useCallback(() => {
        setHasDocument(true)
    }, [])

    const handleRetry = useCallback(() => {
        setIsTimedOut(false)
        onReload()
    }, [onReload])

    useEffect(() => () => clearTimer(), [clearTimer])

    // One automatic reload per offline episode: when connectivity returns
    // while the offline/timeout surface is up, kick a single reload —
    // further failures land back on the error surface instead of looping.
    useEffect(() => {
        if (!hasInternet) {
            wasOfflineRef.current = true
            reloadedThisEpisodeRef.current = false
            return
        }
        if (!wasOfflineRef.current) return
        if (hasDocument || reloadedThisEpisodeRef.current) return
        reloadedThisEpisodeRef.current = true
        setIsTimedOut(false)
        onReload()
    }, [hasInternet, hasDocument, onReload])

    return {
        showOfflineView: !hasInternet && !hasDocument,
        showTimeoutView: hasInternet && isTimedOut && !hasDocument,
        handleLoadStart,
        handleLoadEnd,
        markDocumentLoaded,
        handleRetry,
    }
}
