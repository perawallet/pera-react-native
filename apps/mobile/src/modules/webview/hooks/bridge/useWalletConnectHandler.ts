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

import { useCallback, useRef } from 'react'
import type WebView from 'react-native-webview'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { parseWalletConnectUri } from '@perawallet/wallet-core-walletconnect'
import { useConnectionPairing } from '@modules/connections/hooks/useConnectionPairing'
import { useNetworkStatus } from '@modules/network'
import { JsonRpcErrorCode, safeOrigin, sendErrorToWebview } from '../handlers'
import type { BridgeHandler } from './types'
import { useRequiredParams } from './useRequiredParams'

// One page-initiated WC connect per origin per window, so a hostile page can't
// storm the approval sheet. Rate-limits the ORIGIN regardless of URI, unlike
// peraConnectJS's same-duration window which de-dups an identical URI — a
// pairing URI is single-use, so spam arrives as fresh URIs a de-dup waves
// through.
const WC_CONNECT_THROTTLE_WINDOW_MS = 2000

export const useWalletConnectHandler = (
    webview: Nullable<WebView>,
    sourceUrl: string | null,
): BridgeHandler => {
    const { hasInternet } = useNetworkStatus()
    const { pair, describeUri } = useConnectionPairing()
    const hasRequiredParams = useRequiredParams(webview)

    // Keyed by origin: an in-place navigation must not let one site's connect
    // throttle the next site's, and each origin gets its own budget.
    const lastWcConnectByOriginRef = useRef(new Map<string, number>())

    return useCallback(
        message => {
            if (!hasRequiredParams(['uri'], message)) {
                return
            }

            const rawUri = message.params!.uri as string
            const parsed = parseWalletConnectUri(rawUri)
            if (!parsed) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    'Invalid WalletConnect URI',
                    webview,
                )
                return
            }

            // Pairing needs a live bridge; fail the page fast instead of
            // letting the handshake rot silently until its timeout.
            if (!hasInternet) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InternalError,
                    'Cannot open a WalletConnect session while offline',
                    webview,
                )
                return
            }

            const now = Date.now()
            const throttleKey = safeOrigin(sourceUrl ?? '') ?? sourceUrl ?? ''
            const lastConnectAt =
                lastWcConnectByOriginRef.current.get(throttleKey) ?? 0
            if (now - lastConnectAt < WC_CONNECT_THROTTLE_WINDOW_MS) {
                logger.warn('[webview/wc] connect throttled', { throttleKey })
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidRequest,
                    'WalletConnect connection request throttled',
                    webview,
                )
                return
            }
            lastWcConnectByOriginRef.current.set(throttleKey, now)

            // Always surfaces the approval sheet, as if the user scanned the QR
            // — the bridge never auto-approves a session regardless of origin
            // trust, since that would expose addresses with no UI. `pair` is
            // bounded like the deeplink path so the page gets a readable error
            // rather than silence.
            void (async () => {
                const result = await pair(parsed.uri, {
                    origin: { source: 'in-app' },
                })
                if (result.type === 'connect-failed') {
                    // Never log the URI itself: its `key=` param is the
                    // pairing secret.
                    logger.error('[webview/wc] connect failed', {
                        error: result.error,
                        ...describeUri(parsed.uri),
                    })
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        'Could not start the WalletConnect session',
                        webview,
                    )
                    return
                }
                if (result.type === 'error') {
                    // Relay the surfaced reason (e.g. wrong network) — passing
                    // the Error object would collapse it into the generic
                    // signing-error copy.
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        result.error.message,
                        webview,
                    )
                    return
                }
                if (result.type === 'timeout') {
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        'No response from the dApp. The session may be expired or the dApp may be unreachable.',
                        webview,
                    )
                    // The page cannot be un-told; `pair` keeps watching the
                    // grace and abandons the pairing itself.
                }
                // 'session': the peer answered with a proposal; the page hears
                // the decision through the approve/reject path, never from here.
            })()
        },
        [pair, describeUri, hasRequiredParams, webview, hasInternet, sourceUrl],
    )
}
