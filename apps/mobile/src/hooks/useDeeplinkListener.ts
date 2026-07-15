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

import { useEffect } from 'react'
import { Linking } from 'react-native'
import { logger } from '@perawallet/wallet-core-shared'
import { useDeepLink } from './useDeepLink'

// This hook is mounted by every layout (SafeAreaLayout / FullScreenLayout /
// HeaderedLayout), so several instances coexist and each one's listener fires
// for the same URL. The guards below are module-level — shared across all
// instances — so a given deep link is processed exactly once:
//
//  - `hasHandledInitialUrl` makes the cold-start launch URL fire a single
//    time. `Linking.getInitialURL()` keeps returning the launch URL for the
//    whole session, so without a shared guard every newly mounted layout
//    (i.e. every screen the user navigates to) would re-handle it — the
//    "modal keeps popping up" bug.
//  - `lastHandledUrl` + `DUPLICATE_WINDOW_MS` collapse the warm-start fan-out:
//    when multiple listeners receive the same `url` event in the same instant,
//    only the first is handled.
let hasHandledInitialUrl = false
let lastHandledUrl: string | null = null
let lastHandledAt = 0
const DUPLICATE_WINDOW_MS = 1500

/** Test-only: clears the module-level dedupe guards between cases. */
export const resetDeeplinkListenerStateForTesting = () => {
    hasHandledInitialUrl = false
    lastHandledUrl = null
    lastHandledAt = 0
}

const isDuplicateUrl = (url: string): boolean => {
    const now = Date.now()
    if (lastHandledUrl === url && now - lastHandledAt < DUPLICATE_WINDOW_MS) {
        return true
    }
    lastHandledUrl = url
    lastHandledAt = now
    return false
}

export const useDeeplinkListener = () => {
    const { handleDeepLink, isValidDeepLink } = useDeepLink()

    useEffect(() => {
        const handleInitialUrl = async () => {
            try {
                const initialUrl = await Linking.getInitialURL()

                if (initialUrl && !hasHandledInitialUrl) {
                    hasHandledInitialUrl = true
                    logger.debug('Deeplink: Initial URL (cold start)', {
                        initialUrl,
                    })

                    if (
                        isValidDeepLink(initialUrl) &&
                        !isDuplicateUrl(initialUrl)
                    ) {
                        // Small delay to ensure navigation is ready
                        setTimeout(() => {
                            void handleDeepLink(initialUrl, false, 'deeplink')
                        }, 500)
                    }
                }
            } catch (error) {
                logger.debug('Deeplink: Error getting initial URL', { error })
            }
        }

        void handleInitialUrl()

        const subscription = Linking.addEventListener('url', event => {
            logger.debug('Deeplink: URL event (warm start)', { url: event.url })

            if (isValidDeepLink(event.url) && !isDuplicateUrl(event.url)) {
                void handleDeepLink(event.url, false, 'deeplink')
            }
        })

        return () => {
            subscription.remove()
        }
    }, [handleDeepLink, isValidDeepLink])
}
