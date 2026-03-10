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

import { useEffect, useRef } from 'react'
import WebView from 'react-native-webview'

import { sendNotificationToWebview } from './handlers'

export type ContextFingerprints = {
    settings?: string
    accounts?: string
}

/**
 * Sends an `onHostContextChanged` notification to the webview
 * when the provided context fingerprints change.
 */
export function useNotifyWebViewOnContextChange(
    webviewRef: React.RefObject<WebView | null>,
    contextFingerprints?: ContextFingerprints,
) {
    const prevFingerprints = useRef<ContextFingerprints>({})

    useEffect(() => {
        if (!contextFingerprints) return

        const changedContexts: string[] = []

        if (
            contextFingerprints.settings !== undefined &&
            prevFingerprints.current.settings !== undefined &&
            contextFingerprints.settings !== prevFingerprints.current.settings
        ) {
            changedContexts.push('settings')
        }

        if (
            contextFingerprints.accounts !== undefined &&
            prevFingerprints.current.accounts !== undefined &&
            contextFingerprints.accounts !== prevFingerprints.current.accounts
        ) {
            changedContexts.push('accounts')
        }

        prevFingerprints.current = { ...contextFingerprints }

        if (changedContexts.length > 0) {
            sendNotificationToWebview(
                'onHostContextChanged',
                { contexts: changedContexts },
                webviewRef.current,
            )
        }
    }, [contextFingerprints, webviewRef])
}
