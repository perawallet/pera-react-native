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
import type WebView from 'react-native-webview'

import { sendNotificationToWebview } from './handlers'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type ContextFingerprints = {
    settings?: string
    accounts?: string
}

/**
 * Sends an `onHostContextChanged` notification to the webview
 * when the provided context fingerprints change.
 *
 * Withheld while the webview is on an untrusted origin (`!isSecure`): the
 * changed context names are host-state metadata untrusted pages must not
 * observe. They are queued, not dropped, and flushed on the way back to a
 * trusted origin — otherwise a page that outlives the excursion would keep
 * showing stale context.
 */
export function useNotifyWebViewOnContextChange(
    webviewRef: React.RefObject<Nullable<WebView>>,
    contextFingerprints: ContextFingerprints | undefined,
    isSecure: boolean,
) {
    const prevFingerprints = useRef<ContextFingerprints>({})
    const withheldContexts = useRef(new Set<string>())

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

        if (!isSecure) {
            changedContexts.forEach(context =>
                withheldContexts.current.add(context),
            )
            return
        }

        const contexts = [
            ...new Set([...withheldContexts.current, ...changedContexts]),
        ]
        withheldContexts.current.clear()

        if (contexts.length > 0) {
            sendNotificationToWebview(
                'onHostContextChanged',
                { contexts },
                webviewRef.current,
            )
        }
    }, [contextFingerprints, isSecure, webviewRef])
}
