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

import { useCallback } from 'react'
import type WebView from 'react-native-webview'
import type {
    Arc0001SignTxnsOpts,
    Arc0001WalletTransaction,
} from '@perawallet/wallet-core-blockchain'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    type SignRequestSource,
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
} from '@perawallet/wallet-core-signing'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    JsonRpcErrorCode,
    sendErrorToWebview,
    sendMessageToWebview,
} from '../handlers'
import type { BridgeHandler } from './types'
import { useRequiredParams } from './useRequiredParams'

export const useTransactionSigningHandler = (
    webview: Nullable<WebView>,
    sourceUrl: string | null,
): BridgeHandler => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const resolveArc0001 = useArc0001Resolver()
    const enqueueSignRequest = useEnqueueArc0001SignRequest()
    const hasRequiredParams = useRequiredParams(webview)

    return useCallback(
        message => {
            if (!hasRequiredParams(['txns', 'metadata'], message)) {
                return
            }
            const txns = message.params!['txns'] as Arc0001WalletTransaction[]
            const opts = message.params!['opts'] as
                | Arc0001SignTxnsOpts
                | undefined
            const metadata = message.params!['metadata'] as SignRequestSource

            try {
                // No authorizedAddresses — the webview's trust model is
                // per-origin (requireSecure), not per-account.
                const resolved = resolveArc0001({ transactions: txns, opts })

                // Fire-and-forget despite `enqueueSignRequest` being async:
                // the dispatcher wants a void handler, `resolveArc0001`'s throw
                // must reach the catch below synchronously, and the enqueue
                // handles its own failures via respondWithError.
                void enqueueSignRequest(resolved, {
                    sourceType: 'webview',
                    transportId: message.id,
                    sourceMetadata: metadata,
                    // Platform-observed origin — unlike sourceMetadata the
                    // page can't assert it, so it's what gates the
                    // verification badge.
                    verifiedOrigin: sourceUrl ?? undefined,
                    respondWithResult: result =>
                        sendMessageToWebview(message.id, result, webview),
                    respondWithReject: () =>
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InternalError,
                            'User rejected',
                            webview,
                        ),
                    respondWithError: err =>
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InternalError,
                            err,
                            webview,
                        ),
                })
            } catch (e) {
                // Logged at the transport boundary, like the WalletConnect
                // transport, so real-world dApp failures stay observable
                // whichever resolve path threw.
                logger.warn('ARC-0001 sign request rejected', {
                    code: (e as { code?: number }).code,
                    message: (e as Error).message,
                })
                // 4100 (Unauthorized) is the only ARC-0001 code that gets a
                // dedicated JSON-RPC slot; everything else (4200/4201/4300) is
                // structurally a bad request.
                const code =
                    (e as { code?: number }).code === 4100
                        ? JsonRpcErrorCode.Unauthorized
                        : JsonRpcErrorCode.InvalidParams
                sendErrorToWebview(message.id, code, e as Error, webview)
                // The dApp gets the protocol message above; the user gets
                // localized copy, with the raw detail logged (and appended
                // only when config.debugEnabled).
                showError(e, t('errors.signing.title'))
            }
        },
        [
            webview,
            hasRequiredParams,
            resolveArc0001,
            enqueueSignRequest,
            sourceUrl,
            showError,
            t,
        ],
    )
}
