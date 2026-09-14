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
import {
    isWalletConnectFocusHint,
    isWalletConnectScheme,
} from '@perawallet/wallet-core-walletconnect'
import { useDeepLink } from './useDeepLink'
import { useDeeplinkErrorHandler } from './deeplink/handlers/useDeeplinkErrorHandler'

// Every layout mounts this hook, so several instances fire for the same URL;
// the guards are module-level so a link is handled once. `Linking.getInitialURL()`
// keeps returning the launch URL all session, so without `hasHandledInitialUrl`
// every newly mounted layout re-handles it. `lastHandledUrl` collapses the warm-start fan-out.
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
    const showError = useDeeplinkErrorHandler()

    useEffect(() => {
        // Dedupe runs BEFORE validation so the unsupported-URI toast fires
        // once despite every mounted layout receiving the same event.
        const shouldDispatch = (url: string): boolean => {
            if (isDuplicateUrl(url)) return false
            if (isValidDeepLink(url)) return true
            // A wc-schemed link the parser refuses is a mangled wrapper (bad
            // percent-encoding, a non-wc payload): a toast, not silence. A
            // pairing URI no handler claims is refused further in, by the
            // registry. Focus hints only exist to foreground the wallet, so
            // they stay silent.
            if (isWalletConnectScheme(url) && !isWalletConnectFocusHint(url)) {
                logger.warn('Deeplink: unsupported WalletConnect URI dropped')
                showError({
                    variant: 'walletconnect_unsupported',
                    parsedType: 'WALLET_CONNECT',
                })
            }
            return false
        }

        const handleInitialUrl = async () => {
            try {
                const initialUrl = await Linking.getInitialURL()

                if (initialUrl && !hasHandledInitialUrl) {
                    hasHandledInitialUrl = true
                    logger.debug('Deeplink: Initial URL (cold start)', {
                        initialUrl,
                    })

                    if (shouldDispatch(initialUrl)) {
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

            if (shouldDispatch(event.url)) {
                void handleDeepLink(event.url, false, 'deeplink')
            }
        })

        return () => {
            subscription.remove()
        }
    }, [handleDeepLink, isValidDeepLink, showError])
}
