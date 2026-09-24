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
import {
    canSignArbitraryData,
    canSignArc60,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    encodeToBase64,
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type SignRequestSource,
    isArc60WirePayload,
    parseArc60WireRequest,
    useSigningRequest,
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

// ARC-60 and legacy arbitrary-data requests share one page answer.
const webviewDataSignRequestBase = (
    messageId: string,
    webview: Nullable<WebView>,
) => ({
    id: generateOrderedUniqueId(),
    transport: 'callback' as const,
    sourceType: 'webview' as const,
    transportId: messageId,
    approve: async (signed: PeraArbitraryDataSignResult[]) => {
        sendMessageToWebview(
            messageId,
            signed.map(s => encodeToBase64(s.signature)),
            webview,
        )
    },
    reject: async () => {
        sendErrorToWebview(
            messageId,
            JsonRpcErrorCode.InternalError,
            'User rejected',
            webview,
        )
    },
    error: async (err: Error) =>
        sendErrorToWebview(
            messageId,
            JsonRpcErrorCode.InternalError,
            err,
            webview,
        ),
})

export const useDataSigningHandler = (
    webview: Nullable<WebView>,
    sourceUrl: string | null,
): BridgeHandler => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const allAccounts = useAllAccounts()
    const { addSignRequest } = useSigningRequest()
    const hasRequiredParams = useRequiredParams(webview)

    const sendInvalidSigner = useCallback(
        (messageId: string) =>
            sendErrorToWebview(
                messageId,
                JsonRpcErrorCode.InvalidParams,
                t('errors.webview.invalid_params', { params: 'signer' }),
                webview,
            ),
        [t, webview],
    )

    return useCallback(
        (message, security) => {
            // ARC-60 (`StdSigData` + `Metadata`) and the legacy arbitrary-data
            // shape both arrive on `requestDataSigning`; discriminate on the
            // ARC-60 signals before the legacy param check (which an ARC-60
            // payload would also satisfy).
            if (isArc60WirePayload(message.params)) {
                try {
                    const { stdSigData, metadata } = parseArc60WireRequest(
                        message.params,
                    )
                    const account = allAccounts.find(
                        a => a.address === stdSigData.signer,
                    )
                    if (!account || !canSignArc60(account)) {
                        sendInvalidSigner(message.id)
                        return
                    }
                    addSignRequest({
                        ...webviewDataSignRequestBase(message.id, webview),
                        type: 'arc60',
                        // The verified webview origin — NOT the dApp-asserted
                        // metadata — is what the analyzer checks the SIWA
                        // domain against.
                        sourceMetadata: security.sourceUrl
                            ? { url: security.sourceUrl }
                            : undefined,
                        verifiedOrigin: security.sourceUrl ?? undefined,
                        stdSigData,
                        metadata,
                    })
                } catch (e) {
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InvalidParams,
                        e as Error,
                        webview,
                    )
                }
                return
            }

            if (!hasRequiredParams(['data', 'metadata'], message)) {
                return
            }
            const data = message.params![
                'data'
            ] as Partial<PeraArbitraryDataMessage>
            const signer = data.signer

            if (!signer) {
                sendInvalidSigner(message.id)
                return
            }
            // Preflight parity with the WC transport: a signer that can't sign
            // raw bytes (Ledger, watch) must be rejected before the review
            // sheet, not after the user slides.
            const signerAccount = allAccounts.find(
                account => account.address === signer,
            )
            if (!signerAccount || !canSignArbitraryData(signerAccount)) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    'Signer cannot sign arbitrary data',
                    webview,
                )
                return
            }
            const metadata = message.params!['metadata'] as SignRequestSource
            try {
                addSignRequest({
                    ...webviewDataSignRequestBase(message.id, webview),
                    type: 'arbitrary-data',
                    sourceMetadata: metadata,
                    // Platform-observed origin, not page-asserted — gates the
                    // verification badge.
                    verifiedOrigin: sourceUrl ?? undefined,
                    data: [data as PeraArbitraryDataMessage],
                })
            } catch (e) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InternalError,
                    e as Error,
                    webview,
                )
                // The dApp gets the protocol message above; the user gets
                // localized copy, with the raw detail logged (and appended
                // only when config.debugEnabled).
                showError(e, t('errors.signing.title'))
            }
        },
        [
            webview,
            hasRequiredParams,
            addSignRequest,
            allAccounts,
            sendInvalidSigner,
            sourceUrl,
            showError,
            t,
        ],
    )
}
